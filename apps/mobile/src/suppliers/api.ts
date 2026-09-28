import type { Database } from "@katipan/database/types";
import { supabase } from "../auth/client";
import type { WorkspaceMembership } from "../workspace/model";
import {
  isSupplierFinanceManager,
  mapSupplierFinanceTotals,
  validateSupplierDraft,
  type SupplierCommitmentWrite,
  type SupplierDetailsData,
  type SupplierEditorData,
  type SupplierFinanceRow,
  type SupplierInstallmentPreview,
  type SupplierListData,
  type SupplierLoadResult,
  type SupplierRecentPayment,
  type SupplierRecord,
  type SupplierWrite,
} from "./model";

const supplierColumns = "id,wedding_id,name,category,contact_name,email,phone,website,notes,status,committed_amount,committed_on,commitment_notes,created_at,updated_at";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];
type SupplierItemRow = Database["public"]["Tables"]["budget_items"]["Row"];
type SupplierCategoryRow = Database["public"]["Tables"]["budget_categories"]["Row"];
type AttachmentLinkRow = Database["public"]["Tables"]["supplier_contract_attachments"]["Row"];
type AttachmentRow = Database["public"]["Tables"]["attachments"]["Row"];

function permissionError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "42501");
}

function unavailableError(message = "This Supplier is unavailable in this Wedding."): Error & { code: string } {
  return Object.assign(new Error(message), { code: "22023" });
}

function validationError(message: string, field: string): Error & { code: string; field: string } {
  return Object.assign(new Error(message), { code: "SUPPLIER_VALIDATION", field });
}

function membershipCanManage(membership: WorkspaceMembership): boolean {
  return isSupplierFinanceManager(membership);
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

async function readSupplierInWedding(
  weddingId: string,
  supplierId: string,
): Promise<SupplierRecord | null> {
  const { data, error } = await supabase
    .from("suppliers")
    .select(supplierColumns)
    .eq("wedding_id", weddingId)
    .eq("id", supplierId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.wedding_id !== weddingId) return null;
  return data;
}

function requireFinanceWriter(membership: WorkspaceMembership): void {
  if (!membershipCanManage(membership)) {
    throw Object.assign(new Error("Supplier management is not permitted."), { code: "42501" });
  }
}

function nullableRpcText(value: string | null): string {
  // Postgres accepts NULL for these nullable function arguments; generated RPC types omit null.
  return value as string;
}

export async function loadSupplierList(
  membership: WorkspaceMembership,
): Promise<SupplierLoadResult<SupplierListData>> {
  if (membership.status !== "ACTIVE" || membership.weddingId !== membership.wedding.id) return { kind: "private" };
  const access = await readFinanceAccess(membership);
  if (access.kind !== "ready") return access;

  const [suppliersResult, totalsResult] = await Promise.all([
    supabase.from("suppliers")
      .select(supplierColumns)
      .eq("wedding_id", membership.weddingId)
      .order("name", { ascending: true }),
    supabase.from("supplier_finance_totals")
      .select("supplier_id,wedding_id,committed_amount,scheduled_amount,actual_paid,remaining_commitment,overdue_balance,unscheduled_paid")
      .eq("wedding_id", membership.weddingId),
  ]);
  if (permissionError(suppliersResult.error) || permissionError(totalsResult.error)) return { kind: "private" };
  if (suppliersResult.error) throw suppliersResult.error;
  if (totalsResult.error) throw totalsResult.error;

  const suppliers = (suppliersResult.data ?? []) as SupplierRow[];
  if (suppliers.some((supplier) => supplier.wedding_id !== membership.weddingId)) return { kind: "private" };
  const totals = new Map<string, SupplierFinanceRow>();
  for (const row of (totalsResult.data ?? []) as SupplierFinanceRow[]) {
    if (row.wedding_id !== membership.weddingId || !row.supplier_id) return { kind: "private" };
    totals.set(row.supplier_id, row);
  }

  const items = [];
  for (const supplier of suppliers) {
    const row = totals.get(supplier.id);
    if (!row) return { kind: "private" };
    const finance = mapSupplierFinanceTotals(row, membership.weddingId, supplier.id);
    if (!finance) return { kind: "private" };
    items.push({ ...supplier, finance });
  }

  return { kind: "ready", data: { currencyCode: access.currencyCode, suppliers: items } };
}

export async function loadSupplierForEditor(
  membership: WorkspaceMembership,
  supplierId: string | null,
): Promise<SupplierLoadResult<SupplierEditorData>> {
  if (membership.status !== "ACTIVE" || membership.weddingId !== membership.wedding.id) return { kind: "private" };
  const access = await readFinanceAccess(membership);
  if (access.kind !== "ready") return access;
  if (!supplierId) return { kind: "ready", data: { currencyCode: access.currencyCode, supplier: null } };

  const { data, error } = await supabase.from("suppliers")
    .select(supplierColumns)
    .eq("wedding_id", membership.weddingId)
    .eq("id", supplierId)
    .maybeSingle();
  if (permissionError(error)) return { kind: "private" };
  if (error) throw error;
  if (!data || data.wedding_id !== membership.weddingId) return { kind: "unavailable" };
  return { kind: "ready", data: { currencyCode: access.currencyCode, supplier: data } };
}

export async function loadSupplierDetails(
  membership: WorkspaceMembership,
  supplierId: string,
): Promise<SupplierLoadResult<SupplierDetailsData>> {
  if (membership.status !== "ACTIVE" || membership.weddingId !== membership.wedding.id) return { kind: "private" };
  const access = await readFinanceAccess(membership);
  if (access.kind !== "ready") return access;

  let supplier: SupplierRecord | null;
  try {
    supplier = await readSupplierInWedding(membership.weddingId, supplierId);
  } catch (error) {
    if (permissionError(error)) return { kind: "private" };
    throw error;
  }
  if (!supplier) return { kind: "unavailable" };

  const [financeResult, itemsResult, linksResult] = await Promise.all([
    supabase.from("supplier_finance_totals")
      .select("supplier_id,wedding_id,committed_amount,scheduled_amount,actual_paid,remaining_commitment,overdue_balance,unscheduled_paid")
      .eq("wedding_id", membership.weddingId)
      .eq("supplier_id", supplierId)
      .maybeSingle(),
    supabase.from("budget_items")
      .select("id,wedding_id,category_id,supplier_id,name,estimated_amount,actual_amount,status")
      .eq("wedding_id", membership.weddingId)
      .eq("supplier_id", supplierId)
      .order("name", { ascending: true }),
    supabase.from("supplier_contract_attachments")
      .select("wedding_id,supplier_id,attachment_id,created_at")
      .eq("wedding_id", membership.weddingId)
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false }),
  ]);
  if ([financeResult.error, itemsResult.error, linksResult.error].some(permissionError)) return { kind: "private" };
  if (financeResult.error) throw financeResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (linksResult.error) throw linksResult.error;

  const financeRow = financeResult.data as SupplierFinanceRow | null;
  const finance = financeRow
    ? mapSupplierFinanceTotals(financeRow, membership.weddingId, supplierId)
    : null;
  if (!finance) return { kind: "private" };

  const budgetItems = (itemsResult.data ?? []) as SupplierItemRow[];
  if (budgetItems.some((item) => item.wedding_id !== membership.weddingId || item.supplier_id !== supplierId || item.actual_amount !== null)) {
    return { kind: "unavailable" };
  }
  const categoryIds = [...new Set(budgetItems.map((item) => item.category_id))];
  const categoriesResult = categoryIds.length
    ? await supabase.from("budget_categories")
      .select("id,wedding_id,name")
      .eq("wedding_id", membership.weddingId)
      .in("id", categoryIds)
    : { data: [], error: null };
  if (permissionError(categoriesResult.error)) return { kind: "private" };
  if (categoriesResult.error) throw categoriesResult.error;
  const categories = new Map<string, string>();
  for (const category of (categoriesResult.data ?? []) as Pick<SupplierCategoryRow, "id" | "wedding_id" | "name">[]) {
    if (category.wedding_id !== membership.weddingId) return { kind: "unavailable" };
    categories.set(category.id, category.name);
  }
  if (categoryIds.some((id) => !categories.has(id))) return { kind: "unavailable" };

  const links = (linksResult.data ?? []) as AttachmentLinkRow[];
  if (links.some((link) => link.wedding_id !== membership.weddingId || link.supplier_id !== supplierId)) {
    return { kind: "private" };
  }
  const attachmentIds = [...new Set(links.map((link) => link.attachment_id))];
  const attachmentsResult = attachmentIds.length
    ? await supabase.from("attachments")
      .select("id,wedding_id,original_filename,content_type,size_bytes,visibility,status,updated_at")
      .eq("wedding_id", membership.weddingId)
      .in("id", attachmentIds)
      .eq("visibility", "FINANCIAL_PRIVATE")
      .neq("status", "DELETED")
    : { data: [], error: null };
  if (permissionError(attachmentsResult.error)) return { kind: "private" };
  if (attachmentsResult.error) throw attachmentsResult.error;
  const documents = (attachmentsResult.data ?? []) as Pick<AttachmentRow,
    "id" | "wedding_id" | "original_filename" | "content_type" | "size_bytes" | "visibility" | "status" | "updated_at"
  >[];
  if (documents.some((document) => document.wedding_id !== membership.weddingId || document.visibility !== "FINANCIAL_PRIVATE")) {
    return { kind: "private" };
  }

  const [schedulePreviewResult, recentPaymentsResult] = await Promise.all([
    supabase.from("supplier_installment_schedule")
      .select("id,wedding_id,supplier_id,budget_item_id,amount,due_date,paid_amount,unpaid_balance,status,notes")
      .eq("wedding_id", membership.weddingId)
      .eq("supplier_id", supplierId)
      .in("status", ["PENDING", "PARTIALLY_PAID", "OVERDUE"])
      .order("due_date", { ascending: true })
      .limit(3),
    supabase.from("supplier_payment_transactions")
      .select("id,wedding_id,supplier_id,installment_id,budget_item_id,kind,amount,paid_at,payment_method,reference_number,notes,reverses_transaction_id")
      .eq("wedding_id", membership.weddingId)
      .eq("supplier_id", supplierId)
      .eq("kind", "PAYMENT")
      .order("paid_at", { ascending: false })
      .limit(3),
  ]);
  if (permissionError(schedulePreviewResult.error) || permissionError(recentPaymentsResult.error)) return { kind: "private" };
  if (schedulePreviewResult.error) throw schedulePreviewResult.error;
  if (recentPaymentsResult.error) throw recentPaymentsResult.error;

  const scheduleRows = schedulePreviewResult.data ?? [];
  if (scheduleRows.some((row) =>
    row.wedding_id !== membership.weddingId
    || row.supplier_id !== supplierId
    || !row.id
    || !row.due_date
    || !["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(row.status ?? "")
    || typeof row.amount !== "number"
    || typeof row.paid_amount !== "number"
    || typeof row.unpaid_balance !== "number"
    || (row.budget_item_id !== null && !budgetItems.some((item) => item.id === row.budget_item_id))
  )) return { kind: "unavailable" };
  const upcomingInstallments: SupplierInstallmentPreview[] = scheduleRows.map((row) => ({
    id: row.id as string,
    amount: row.amount as number,
    dueDate: row.due_date as string,
    paidAmount: row.paid_amount as number,
    unpaidBalance: row.unpaid_balance as number,
    status: row.status as SupplierInstallmentPreview["status"],
    budgetItemId: row.budget_item_id,
    budgetItemName: row.budget_item_id
      ? budgetItems.find((item) => item.id === row.budget_item_id)?.name ?? null
      : null,
    notes: row.notes,
  }));

  const recentPaymentRows = recentPaymentsResult.data ?? [];
  if (recentPaymentRows.some((row) =>
    row.wedding_id !== membership.weddingId
    || row.supplier_id !== supplierId
    || row.kind !== "PAYMENT"
    || !row.id
    || typeof row.amount !== "number"
    || typeof row.paid_at !== "string"
    || !Number.isFinite(Date.parse(row.paid_at))
  )) return { kind: "unavailable" };
  const recentPaymentIds = recentPaymentRows.map((row) => row.id).filter((id): id is string => Boolean(id));
  const reversalsResult = recentPaymentIds.length
    ? await supabase.from("supplier_payment_transactions")
      .select("reverses_transaction_id,wedding_id,supplier_id,kind")
      .eq("wedding_id", membership.weddingId)
      .eq("supplier_id", supplierId)
      .eq("kind", "REVERSAL")
      .in("reverses_transaction_id", recentPaymentIds)
    : { data: [], error: null };
  if (permissionError(reversalsResult.error)) return { kind: "private" };
  if (reversalsResult.error) throw reversalsResult.error;
  const reversedIds = new Set((reversalsResult.data ?? [])
    .filter((row) => row.wedding_id === membership.weddingId && row.supplier_id === supplierId && row.kind === "REVERSAL")
    .map((row) => row.reverses_transaction_id)
    .filter((id): id is string => Boolean(id)));
  const recentPayments: SupplierRecentPayment[] = recentPaymentRows.map((row) => ({
    id: row.id as string,
    amount: row.amount as number,
    paid_at: row.paid_at as string,
    installment_id: row.installment_id,
    budget_item_id: row.budget_item_id,
    payment_method: row.payment_method,
    reference_number: row.reference_number,
    notes: row.notes,
    reversed: reversedIds.has(row.id as string),
  }));

  return {
    kind: "ready",
    data: {
      currencyCode: access.currencyCode,
      supplier,
      finance,
      budgetItems: budgetItems.map((item) => ({ ...item, categoryName: categories.get(item.category_id) ?? "" })),
      contractDocuments: documents,
      upcomingInstallments,
      recentPayments,
    },
  };
}

function validatedWrite(draft: Parameters<typeof validateSupplierDraft>[0]): SupplierWrite {
  const result = validateSupplierDraft(draft);
  if (!result.ok) throw validationError(result.message, result.field);
  return result.value;
}

function supplierRpcArguments(write: SupplierWrite) {
  return {
    p_name: write.name,
    p_category: write.category,
    p_contact_name: nullableRpcText(write.contactName),
    p_email: nullableRpcText(write.email),
    p_phone: nullableRpcText(write.phone),
    p_website: nullableRpcText(write.website),
    p_notes: nullableRpcText(write.notes),
    p_status: write.status,
  };
}

export async function createSupplier(
  membership: WorkspaceMembership,
  draft: Parameters<typeof validateSupplierDraft>[0],
): Promise<string> {
  requireFinanceWriter(membership);
  const write = validatedWrite(draft);
  const { data, error } = await supabase.rpc("create_supplier", {
    p_wedding_id: membership.weddingId,
    ...supplierRpcArguments(write),
  });
  if (error) throw error;
  if (!data) throw new Error("Supplier creation did not return an ID.");
  return data;
}

export async function updateSupplier(
  membership: WorkspaceMembership,
  supplierId: string,
  draft: Parameters<typeof validateSupplierDraft>[0],
): Promise<string> {
  requireFinanceWriter(membership);
  const write = validatedWrite(draft);
  const existing = await readSupplierInWedding(membership.weddingId, supplierId);
  if (!existing) throw unavailableError();
  const { data, error } = await supabase.rpc("update_supplier", {
    p_supplier_id: supplierId,
    ...supplierRpcArguments(write),
  });
  if (error) throw error;
  if (!data) throw new Error("Supplier update did not return an ID.");
  return data;
}

function validDateOnly(value: string | null): boolean {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function setSupplierCommitment(
  membership: WorkspaceMembership,
  supplierId: string,
  commitment: SupplierCommitmentWrite,
): Promise<string> {
  requireFinanceWriter(membership);
  if (commitment.amount === null) {
    if (commitment.committedOn !== null || commitment.notes !== null) {
      throw validationError("Clear the amount, date and notes together to remove the commitment.", "amount");
    }
  } else if (!Number.isFinite(commitment.amount) || commitment.amount < 0 || !validDateOnly(commitment.committedOn)) {
    throw validationError("Enter a valid commitment amount and date.", "amount");
  }

  const existing = await readSupplierInWedding(membership.weddingId, supplierId);
  if (!existing) throw unavailableError();
  // The backend function accepts NULL for all three commitment fields to clear safely.
  const { data, error } = await supabase.rpc("set_supplier_commitment", {
    p_supplier_id: supplierId,
    p_amount: commitment.amount as number,
    p_committed_on: nullableRpcText(commitment.committedOn),
    p_notes: nullableRpcText(commitment.notes),
  });
  if (error) throw error;
  if (!data) throw new Error("Supplier commitment update did not return an ID.");
  return data;
}
