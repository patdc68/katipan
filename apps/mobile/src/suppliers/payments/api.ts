import type { Database } from "@katipan/database/types";
import { supabase } from "../../auth/client";
import { isSupplierFinanceManager, mapSupplierFinanceTotals } from "../model";
import type { WorkspaceMembership } from "../../workspace/model";
import type {
  InstallmentDraft,
  InstallmentWrite,
  PendingSupplierPayment,
  SupplierInstallment,
  SupplierPayment,
  SupplierPaymentBudgetItem,
  SupplierPaymentDetailsData,
  SupplierPaymentScheduleData,
} from "./model";
import {
  mapSupplierInstallment,
  mapSupplierPayment,
  pendingPaymentRpcArgs,
  validateInstallmentDraft,
} from "./model";
import type { SupplierLoadResult } from "../model";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];
type BudgetItemRow = Database["public"]["Tables"]["budget_items"]["Row"];
type ScheduleRow = Database["public"]["Views"]["supplier_installment_schedule"]["Row"];
type TransactionRow = Database["public"]["Tables"]["supplier_payment_transactions"]["Row"];
type ReceiptRow = Database["public"]["Tables"]["attachments"]["Row"];

const supplierColumns = "id,wedding_id,name,category,contact_name,email,phone,website,notes,status,committed_amount,committed_on,commitment_notes,created_at,updated_at";
const financeColumns = "supplier_id,wedding_id,committed_amount,scheduled_amount,actual_paid,remaining_commitment,overdue_balance,unscheduled_paid";
const scheduleColumns = "id,wedding_id,supplier_id,budget_item_id,amount,due_date,notes,cancelled_at,paid_amount,unpaid_balance,status";
const paymentColumns = "id,wedding_id,supplier_id,installment_id,budget_item_id,kind,source,amount,paid_at,payment_method,reference_number,notes,recorded_by_user_id,reverses_transaction_id,created_at";
const budgetItemColumns = "id,wedding_id,supplier_id,name";

function permissionError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "42501");
}

function codedError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function nullableRpcText(value: string | null): string {
  // The generated RPC type currently models nullable text arguments as string.
  return value as string;
}

function nullableRpcUuid(value: string | null): string {
  // Postgres accepts NULL here; the generated RPC type currently says string.
  return value as string;
}

function membershipCanManage(membership: WorkspaceMembership): boolean {
  return membership.status === "ACTIVE"
    && membership.weddingId === membership.wedding.id
    && isSupplierFinanceManager(membership);
}

async function readFinanceAccess(
  membership: WorkspaceMembership,
): Promise<{ kind: "ready"; currencyCode: string } | { kind: "private" }> {
  if (!membershipCanManage(membership)) return { kind: "private" };
  const { data, error } = await supabase
    .from("wedding_budget_totals")
    .select("wedding_id,currency_code")
    .eq("wedding_id", membership.weddingId)
    .maybeSingle();
  if (permissionError(error) || (!error && !data)) return { kind: "private" };
  if (error) throw error;
  if (!data || data.wedding_id !== membership.weddingId) return { kind: "private" };
  return { kind: "ready", currencyCode: data.currency_code ?? "PHP" };
}

function requireFinanceWriter(membership: WorkspaceMembership): void {
  if (!membershipCanManage(membership)) {
    throw codedError("42501", "Supplier finance is private.");
  }
}

async function readSupplier(
  membership: WorkspaceMembership,
  supplierId: string,
): Promise<SupplierRow | null> {
  const { data, error } = await supabase.from("suppliers")
    .select(supplierColumns)
    .eq("wedding_id", membership.weddingId)
    .eq("id", supplierId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== membership.weddingId || data.id !== supplierId) return null;
  return data as SupplierRow;
}

async function readBudgetItem(
  membership: WorkspaceMembership,
  supplierId: string,
  budgetItemId: string,
): Promise<SupplierPaymentBudgetItem | null> {
  const { data, error } = await supabase.from("budget_items")
    .select(budgetItemColumns)
    .eq("wedding_id", membership.weddingId)
    .eq("supplier_id", supplierId)
    .eq("id", budgetItemId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== membership.weddingId || data.supplier_id !== supplierId) return null;
  return data as SupplierPaymentBudgetItem;
}

function unavailable(): Error & { code: string } {
  return codedError("22023", "This Supplier finance record is unavailable in this Wedding.");
}

async function readScheduleRow(
  weddingId: string,
  supplierId: string,
  installmentId: string,
): Promise<SupplierInstallment | null> {
  const { data, error } = await supabase.from("supplier_installment_schedule")
    .select(scheduleColumns)
    .eq("wedding_id", weddingId)
    .eq("supplier_id", supplierId)
    .eq("id", installmentId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSupplierInstallment(data as ScheduleRow, weddingId, supplierId) : null;
}

async function paymentReversalIds(
  weddingId: string,
  supplierId: string,
  paymentIds: string[],
): Promise<Set<string>> {
  if (paymentIds.length === 0) return new Set();
  const { data, error } = await supabase.from("supplier_payment_transactions")
    .select("reverses_transaction_id,wedding_id,supplier_id,kind")
    .eq("wedding_id", weddingId)
    .eq("supplier_id", supplierId)
    .eq("kind", "REVERSAL")
    .in("reverses_transaction_id", paymentIds);
  if (error) throw error;
  const reversed = new Set<string>();
  for (const row of data ?? []) {
    if (row.wedding_id !== weddingId || row.supplier_id !== supplierId || row.kind !== "REVERSAL") continue;
    if (row.reverses_transaction_id) reversed.add(row.reverses_transaction_id);
  }
  return reversed;
}

function mapPaymentRows(
  rows: TransactionRow[],
  expected: { weddingId: string; supplierId: string; kind: "PAYMENT" | "REVERSAL" },
  reversedIds: Set<string>,
): SupplierPayment[] | null {
  const result: SupplierPayment[] = [];
  for (const row of rows) {
    if (row.wedding_id !== expected.weddingId || row.supplier_id !== expected.supplierId) return null;
    const payment = mapSupplierPayment(row, expected, Boolean(row.kind === "PAYMENT" && reversedIds.has(row.id)));
    if (!payment) return null;
    result.push(payment);
  }
  return result;
}

export async function loadSupplierPaymentSchedule(
  membership: WorkspaceMembership,
  supplierId: string,
): Promise<SupplierLoadResult<SupplierPaymentScheduleData>> {
  if (membership.status !== "ACTIVE" || membership.weddingId !== membership.wedding.id) return { kind: "private" };
  const access = await readFinanceAccess(membership);
  if (access.kind !== "ready") return access;

  let supplier: SupplierRow | null;
  try {
    supplier = await readSupplier(membership, supplierId);
  } catch (error) {
    if (permissionError(error)) return { kind: "private" };
    throw error;
  }
  if (!supplier) return { kind: "unavailable" };

  const [financeResult, scheduleResult, itemsResult, paymentsResult] = await Promise.all([
    supabase.from("supplier_finance_totals").select(financeColumns)
      .eq("wedding_id", membership.weddingId).eq("supplier_id", supplierId).maybeSingle(),
    supabase.from("supplier_installment_schedule").select(scheduleColumns)
      .eq("wedding_id", membership.weddingId).eq("supplier_id", supplierId).order("due_date", { ascending: true }),
    supabase.from("budget_items").select(budgetItemColumns)
      .eq("wedding_id", membership.weddingId).eq("supplier_id", supplierId).order("name", { ascending: true }),
    supabase.from("supplier_payment_transactions").select(paymentColumns)
      .eq("wedding_id", membership.weddingId).eq("supplier_id", supplierId).eq("kind", "PAYMENT")
      .order("paid_at", { ascending: false }).limit(5),
  ]);
  if ([financeResult.error, scheduleResult.error, itemsResult.error, paymentsResult.error].some(permissionError)) {
    return { kind: "private" };
  }
  if (financeResult.error) throw financeResult.error;
  if (scheduleResult.error) throw scheduleResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  const financeRow = financeResult.data;
  const finance = financeRow
    ? mapSupplierFinanceTotals(financeRow, membership.weddingId, supplierId)
    : null;
  if (!finance) return { kind: "private" };

  const budgetItems: SupplierPaymentBudgetItem[] = [];
  for (const item of (itemsResult.data ?? []) as Pick<BudgetItemRow, "id" | "wedding_id" | "supplier_id" | "name">[]) {
    if (item.wedding_id !== membership.weddingId || item.supplier_id !== supplierId) return { kind: "unavailable" };
    budgetItems.push(item);
  }
  const itemIds = new Set(budgetItems.map((item) => item.id));
  const installments: SupplierInstallment[] = [];
  for (const row of (scheduleResult.data ?? []) as ScheduleRow[]) {
    const installment = mapSupplierInstallment(row, membership.weddingId, supplierId);
    if (!installment || (installment.budgetItemId && !itemIds.has(installment.budgetItemId))) {
      return { kind: "unavailable" };
    }
    installments.push({
      ...installment,
      budgetItemName: installment.budgetItemId
        ? budgetItems.find((item) => item.id === installment.budgetItemId)?.name ?? null
        : null,
    });
  }

  const rawPayments = (paymentsResult.data ?? []) as TransactionRow[];
  if (rawPayments.some((payment) => payment.wedding_id !== membership.weddingId || payment.supplier_id !== supplierId || payment.kind !== "PAYMENT")) {
    return { kind: "unavailable" };
  }
  const reversedIds = await paymentReversalIds(membership.weddingId, supplierId, rawPayments.map((payment) => payment.id));
  const recentPayments = mapPaymentRows(rawPayments, { weddingId: membership.weddingId, supplierId, kind: "PAYMENT" }, reversedIds);
  if (!recentPayments) return { kind: "unavailable" };

  return {
    kind: "ready",
    data: {
      currencyCode: access.currencyCode,
      supplier,
      finance,
      budgetItems,
      installments,
      recentPayments,
    },
  };
}

export async function loadSupplierPaymentDetails(
  membership: WorkspaceMembership,
  supplierId: string,
  paymentId: string,
): Promise<SupplierLoadResult<SupplierPaymentDetailsData>> {
  if (membership.status !== "ACTIVE" || membership.weddingId !== membership.wedding.id) return { kind: "private" };
  const access = await readFinanceAccess(membership);
  if (access.kind !== "ready") return access;

  let supplier: SupplierRow | null;
  try {
    supplier = await readSupplier(membership, supplierId);
  } catch (error) {
    if (permissionError(error)) return { kind: "private" };
    throw error;
  }
  if (!supplier) return { kind: "unavailable" };

  const { data: paymentRow, error: paymentError } = await supabase.from("supplier_payment_transactions")
    .select(paymentColumns)
    .eq("wedding_id", membership.weddingId)
    .eq("supplier_id", supplierId)
    .eq("id", paymentId)
    .eq("kind", "PAYMENT")
    .maybeSingle();
  if (permissionError(paymentError)) return { kind: "private" };
  if (paymentError) throw paymentError;
  if (!paymentRow || paymentRow.wedding_id !== membership.weddingId || paymentRow.supplier_id !== supplierId || paymentRow.kind !== "PAYMENT") {
    return { kind: "unavailable" };
  }
  let payment = mapSupplierPayment(paymentRow as TransactionRow, { weddingId: membership.weddingId, supplierId, kind: "PAYMENT" });
  if (!payment) return { kind: "unavailable" };

  const [reversalResult, receiptLinksResult] = await Promise.all([
    supabase.from("supplier_payment_transactions").select(paymentColumns)
      .eq("wedding_id", membership.weddingId).eq("supplier_id", supplierId)
      .eq("kind", "REVERSAL").eq("reverses_transaction_id", paymentId).maybeSingle(),
    supabase.from("payment_receipt_attachments").select("wedding_id,payment_id,attachment_id,created_at")
      .eq("wedding_id", membership.weddingId).eq("payment_id", paymentId).order("created_at", { ascending: false }),
  ]);
  if ([reversalResult.error, receiptLinksResult.error].some(permissionError)) return { kind: "private" };
  if (reversalResult.error) throw reversalResult.error;
  if (receiptLinksResult.error) throw receiptLinksResult.error;

  let reversal: SupplierPayment | null = null;
  if (reversalResult.data) {
    if (reversalResult.data.wedding_id !== membership.weddingId || reversalResult.data.supplier_id !== supplierId) return { kind: "unavailable" };
    reversal = mapSupplierPayment(reversalResult.data as TransactionRow, { weddingId: membership.weddingId, supplierId, kind: "REVERSAL" });
    if (!reversal || reversal.reverses_transaction_id !== paymentId) return { kind: "unavailable" };
  }
  payment = { ...payment, reversed: Boolean(reversal) };

  let installment: SupplierInstallment | null = null;
  if (payment.installment_id) {
    try {
      installment = await readScheduleRow(membership.weddingId, supplierId, payment.installment_id);
    } catch (error) {
      if (permissionError(error)) return { kind: "private" };
      throw error;
    }
    if (!installment) return { kind: "unavailable" };
  }

  let budgetItem: Pick<SupplierPaymentBudgetItem, "id" | "name"> | null = null;
  if (payment.budget_item_id) {
    try {
      budgetItem = await readBudgetItem(membership, supplierId, payment.budget_item_id);
    } catch (error) {
      if (permissionError(error)) return { kind: "private" };
      throw error;
    }
    if (!budgetItem) return { kind: "unavailable" };
  }

  const links = receiptLinksResult.data ?? [];
  if (links.some((link) => link.wedding_id !== membership.weddingId || link.payment_id !== paymentId)) return { kind: "private" };
  const attachmentIds = [...new Set(links.map((link) => link.attachment_id))];
  const attachmentsResult = attachmentIds.length
    ? await supabase.from("attachments")
      .select("id,wedding_id,original_filename,content_type,size_bytes,visibility,status,bucket_id,object_path,updated_at")
      .eq("wedding_id", membership.weddingId)
      .in("id", attachmentIds)
      .eq("visibility", "FINANCIAL_PRIVATE")
      .eq("status", "AVAILABLE")
    : { data: [], error: null };
  if (permissionError(attachmentsResult.error)) return { kind: "private" };
  if (attachmentsResult.error) throw attachmentsResult.error;
  const receipts: SupplierPaymentDetailsData["receipts"] = [];
  for (const row of (attachmentsResult.data ?? []) as Pick<ReceiptRow,
    "id" | "wedding_id" | "original_filename" | "content_type" | "size_bytes" | "visibility" | "status" | "bucket_id" | "object_path" | "updated_at"
  >[]) {
    if (row.wedding_id !== membership.weddingId || row.visibility !== "FINANCIAL_PRIVATE" || row.status !== "AVAILABLE") return { kind: "private" };
    if (!links.some((link) => link.attachment_id === row.id)) return { kind: "private" };
    receipts.push(row);
  }

  return {
    kind: "ready",
    data: { currencyCode: access.currencyCode, supplier, payment, installment, budgetItem, reversal, receipts },
  };
}

export async function createSupplierInstallment(
  membership: WorkspaceMembership,
  supplierId: string,
  draft: InstallmentDraft,
): Promise<string> {
  requireFinanceWriter(membership);
  const supplier = await readSupplier(membership, supplierId);
  if (!supplier) throw unavailable();
  const item = draft.budgetItemId
    ? await readBudgetItem(membership, supplierId, draft.budgetItemId)
    : null;
  if (draft.budgetItemId && !item) throw codedError("23503", "Budget Item is not linked to this Supplier.");
  const validation = validateInstallmentDraft(draft, item ? [item] : []);
  if (!validation.ok) throw codedError("SUPPLIER_VALIDATION", validation.message);

  const { data, error } = await supabase.rpc("create_supplier_installment", {
    p_wedding_id: membership.weddingId,
    p_supplier_id: supplierId,
    p_budget_item_id: nullableRpcUuid(validation.value.budgetItemId),
    p_amount: validation.value.amount,
    p_due_date: validation.value.dueDate,
    p_notes: nullableRpcText(validation.value.notes),
  });
  if (error) throw error;
  if (!data) throw new Error("Installment creation did not return an ID.");
  return data;
}

export async function updateSupplierInstallment(
  membership: WorkspaceMembership,
  supplierId: string,
  installmentId: string,
  draft: InstallmentDraft,
  budgetItems: readonly SupplierPaymentBudgetItem[],
): Promise<string> {
  requireFinanceWriter(membership);
  const validation = validateInstallmentDraft(draft, budgetItems.map(({ id }) => ({ id })));
  if (!validation.ok) throw codedError("SUPPLIER_VALIDATION", validation.message);
  const supplier = await readSupplier(membership, supplierId);
  if (!supplier) throw unavailable();
  if (validation.value.budgetItemId && !await readBudgetItem(membership, supplierId, validation.value.budgetItemId)) {
    throw codedError("23503", "Budget Item is not linked to this Supplier.");
  }

  // Keep this allowlist aligned with the RLS-protected update contract.
  const update: Database["public"]["Tables"]["supplier_installments"]["Update"] = {
    budget_item_id: validation.value.budgetItemId,
    amount: validation.value.amount,
    due_date: validation.value.dueDate,
    notes: validation.value.notes,
  };
  const { data, error } = await supabase.from("supplier_installments")
    .update(update)
    .eq("wedding_id", membership.weddingId)
    .eq("supplier_id", supplierId)
    .eq("id", installmentId)
    .select("id,wedding_id,supplier_id")
    .maybeSingle();
  if (permissionError(error)) throw error;
  if (error) throw error;
  if (!data || data.wedding_id !== membership.weddingId || data.supplier_id !== supplierId) throw unavailable();
  return data.id;
}

export async function cancelSupplierInstallment(
  membership: WorkspaceMembership,
  supplierId: string,
  installmentId: string,
  now: () => string = () => new Date().toISOString(),
): Promise<void> {
  requireFinanceWriter(membership);
  const supplier = await readSupplier(membership, supplierId);
  if (!supplier) throw unavailable();
  const cancelledAt = now();
  const { data, error } = await supabase.from("supplier_installments")
    .update({ cancelled_at: cancelledAt })
    .eq("wedding_id", membership.weddingId)
    .eq("supplier_id", supplierId)
    .eq("id", installmentId)
    .is("cancelled_at", null)
    .select("id,wedding_id,supplier_id,cancelled_at")
    .maybeSingle();
  if (permissionError(error)) throw error;
  if (error) throw error;
  if (!data || data.wedding_id !== membership.weddingId || data.supplier_id !== supplierId || data.cancelled_at !== cancelledAt) throw unavailable();
}

export async function recordSupplierPayment(
  membership: WorkspaceMembership,
  attempt: PendingSupplierPayment,
): Promise<string> {
  requireFinanceWriter(membership);
  if (attempt.userId !== membership.userId || attempt.weddingId !== membership.weddingId) throw codedError("42501", "Payment attempt does not belong to this signed-in Wedding member.");
  const { data, error } = await supabase.rpc("record_supplier_payment", pendingPaymentRpcArgs(attempt));
  if (error) throw error;
  if (typeof data !== "string" || !data) throw new Error("Payment recording did not return a transaction ID.");
  return data;
}

export async function reverseSupplierPayment(
  membership: WorkspaceMembership,
  supplierId: string,
  paymentId: string,
  reason: string,
): Promise<string> {
  requireFinanceWriter(membership);
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw codedError("23514", "A reversal reason is required.");
  const { data: original, error: originalError } = await supabase.from("supplier_payment_transactions")
    .select("id,wedding_id,supplier_id,kind")
    .eq("wedding_id", membership.weddingId)
    .eq("supplier_id", supplierId)
    .eq("id", paymentId)
    .eq("kind", "PAYMENT")
    .maybeSingle();
  if (permissionError(originalError)) throw originalError;
  if (originalError) throw originalError;
  if (!original || original.wedding_id !== membership.weddingId || original.supplier_id !== supplierId || original.kind !== "PAYMENT") throw unavailable();
  const { data, error } = await supabase.rpc("reverse_supplier_payment", {
    p_payment_id: paymentId,
    p_reason: trimmedReason,
  });
  if (error) throw error;
  if (typeof data !== "string" || !data) throw new Error("Payment reversal did not return a transaction ID.");
  return data;
}

export async function refreshSupplierFinanceAggregates(
  membership: WorkspaceMembership,
  supplierId: string,
): Promise<void> {
  requireFinanceWriter(membership);
  const [scheduleResult, supplierResult, weddingPaymentsResult, weddingBudgetResult] = await Promise.all([
    supabase.from("supplier_installment_schedule").select(scheduleColumns)
      .eq("wedding_id", membership.weddingId).eq("supplier_id", supplierId).order("due_date", { ascending: true }),
    supabase.from("supplier_finance_totals").select("supplier_id,wedding_id")
      .eq("wedding_id", membership.weddingId).eq("supplier_id", supplierId).maybeSingle(),
    supabase.from("wedding_payment_totals").select("wedding_id,paid_total,scheduled_total")
      .eq("wedding_id", membership.weddingId).maybeSingle(),
    supabase.from("wedding_budget_totals").select("wedding_id,actual_total,supplier_actual_total")
      .eq("wedding_id", membership.weddingId).maybeSingle(),
  ]);
  for (const error of [scheduleResult.error, supplierResult.error, weddingPaymentsResult.error, weddingBudgetResult.error]) {
    if (error) throw error;
  }
  if ((scheduleResult.data ?? []).some((row) => !mapSupplierInstallment(row as ScheduleRow, membership.weddingId, supplierId))) {
    throw unavailable();
  }
  const supplierTotals = supplierResult.data;
  const weddingPayments = weddingPaymentsResult.data;
  const weddingBudget = weddingBudgetResult.data;
  if (
    !supplierTotals
    || supplierTotals.wedding_id !== membership.weddingId
    || supplierTotals.supplier_id !== supplierId
    || !weddingPayments
    || weddingPayments.wedding_id !== membership.weddingId
    || !weddingBudget
    || weddingBudget.wedding_id !== membership.weddingId
  ) throw unavailable();
}

async function assertPayment(
  membership: WorkspaceMembership,
  supplierId: string,
  paymentId: string,
): Promise<void> {
  const { data, error } = await supabase.from("supplier_payment_transactions")
    .select("id,wedding_id,supplier_id,kind")
    .eq("wedding_id", membership.weddingId)
    .eq("supplier_id", supplierId)
    .eq("id", paymentId)
    .eq("kind", "PAYMENT")
    .maybeSingle();
  if (permissionError(error)) throw error;
  if (error) throw error;
  if (!data || data.wedding_id !== membership.weddingId || data.supplier_id !== supplierId || data.kind !== "PAYMENT") throw unavailable();
}

export type ReceiptUploadBytes = {
  name: string;
  contentType: string;
  bytes: ArrayBuffer;
};

export async function uploadSupplierPaymentReceipt(
  membership: WorkspaceMembership,
  supplierId: string,
  paymentId: string,
  file: ReceiptUploadBytes,
): Promise<string> {
  requireFinanceWriter(membership);
  if (!file.name.trim() || !file.contentType.trim() || file.bytes.byteLength <= 0) {
    throw codedError("22023", "A named, non-empty receipt file is required.");
  }
  await assertPayment(membership, supplierId, paymentId);
  const { data: reservation, error: reservationError } = await supabase.rpc("reserve_attachment", {
    p_wedding_id: membership.weddingId,
    p_original_filename: file.name,
    p_content_type: file.contentType,
    p_visibility: "FINANCIAL_PRIVATE",
  });
  if (reservationError) throw reservationError;
  const reserved = reservation?.[0];
  if (!reserved?.attachment_id || reserved.bucket_id !== "wedding-files" || !reserved.object_path) {
    throw new Error("Receipt reservation did not return its Storage object identity.");
  }

  const { error: uploadError } = await supabase.storage.from("wedding-files").upload(reserved.object_path, file.bytes, {
    contentType: file.contentType,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { error: confirmationError } = await supabase.rpc("confirm_attachment_uploaded", {
    p_attachment_id: reserved.attachment_id,
    p_size_bytes: file.bytes.byteLength,
  });
  if (confirmationError) throw confirmationError;

  const { error: linkError } = await supabase.rpc("link_payment_receipt_attachment", {
    p_payment_id: paymentId,
    p_attachment_id: reserved.attachment_id,
  });
  if (linkError) throw linkError;
  return reserved.attachment_id;
}

export async function openSupplierPaymentReceipt(
  membership: WorkspaceMembership,
  supplierId: string,
  paymentId: string,
  attachmentId: string,
): Promise<string> {
  requireFinanceWriter(membership);
  const details = await loadSupplierPaymentDetails(membership, supplierId, paymentId);
  if (details.kind !== "ready") throw unavailable();
  const receipt = details.data.receipts.find((item) => item.id === attachmentId);
  if (!receipt || receipt.bucket_id !== "wedding-files" || receipt.visibility !== "FINANCIAL_PRIVATE" || receipt.status !== "AVAILABLE") throw unavailable();
  const { data, error } = await supabase.storage.from("wedding-files").createSignedUrl(receipt.object_path, 60);
  if (permissionError(error)) throw error;
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Receipt access URL was not returned.");
  return data.signedUrl;
}

export async function deleteSupplierPaymentReceipt(
  membership: WorkspaceMembership,
  supplierId: string,
  paymentId: string,
  attachmentId: string,
): Promise<void> {
  requireFinanceWriter(membership);
  const details = await loadSupplierPaymentDetails(membership, supplierId, paymentId);
  if (details.kind !== "ready" || !details.data.receipts.some((item) => item.id === attachmentId)) throw unavailable();
  const { error } = await supabase.rpc("mark_attachment_deleted", { p_attachment_id: attachmentId });
  if (permissionError(error)) throw error;
  if (error) throw error;
}

export function validateInstallmentForApi(
  draft: InstallmentDraft,
  budgetItems: SupplierPaymentBudgetItem[],
): InstallmentWrite {
  const result = validateInstallmentDraft(draft, budgetItems);
  if (!result.ok) throw codedError("SUPPLIER_VALIDATION", result.message);
  return result.value;
}
