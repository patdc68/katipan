import type { Database } from "@katipan/database/types";
import { parseAmount } from "../../budget/model";
import type { SupplierBudgetItem, SupplierFinanceTotals, SupplierRecord } from "../model";

export const INSTALLMENT_STATUSES = [
  "PENDING",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

type ScheduleRow = Database["public"]["Views"]["supplier_installment_schedule"]["Row"];
type TransactionRow = Database["public"]["Tables"]["supplier_payment_transactions"]["Row"];
type ReceiptRow = Database["public"]["Tables"]["attachments"]["Row"];

export type SupplierInstallment = {
  id: string;
  weddingId: string;
  supplierId: string;
  budgetItemId: string | null;
  budgetItemName: string | null;
  amount: number;
  dueDate: string;
  notes: string | null;
  cancelledAt: string | null;
  paidAmount: number;
  unpaidBalance: number;
  status: InstallmentStatus;
};

export type SupplierPayment = Pick<
  TransactionRow,
  | "id" | "wedding_id" | "supplier_id" | "installment_id" | "budget_item_id"
  | "kind" | "amount" | "paid_at" | "payment_method" | "reference_number"
  | "notes" | "recorded_by_user_id" | "reverses_transaction_id" | "created_at" | "source"
> & { reversed: boolean };

export type SupplierPaymentReceipt = Pick<
  ReceiptRow,
  | "id" | "wedding_id" | "original_filename" | "content_type" | "size_bytes"
  | "visibility" | "status" | "bucket_id" | "object_path" | "updated_at"
>;

export type SupplierPaymentBudgetItem = Pick<
  SupplierBudgetItem,
  "id" | "wedding_id" | "supplier_id" | "name"
>;

export type SupplierPaymentScheduleData = {
  currencyCode: string;
  supplier: SupplierRecord;
  finance: SupplierFinanceTotals;
  budgetItems: SupplierPaymentBudgetItem[];
  installments: SupplierInstallment[];
  recentPayments: SupplierPayment[];
};

export type SupplierPaymentDetailsData = {
  currencyCode: string;
  supplier: SupplierRecord;
  payment: SupplierPayment;
  installment: SupplierInstallment | null;
  budgetItem: Pick<SupplierBudgetItem, "id" | "name"> | null;
  reversal: SupplierPayment | null;
  receipts: SupplierPaymentReceipt[];
};

export type InstallmentDraft = {
  amount: string;
  dueDate: string;
  budgetItemId: string | null;
  notes: string;
};

export type InstallmentWrite = {
  amount: number;
  dueDate: string;
  budgetItemId: string | null;
  notes: string | null;
};

export type PaymentDraft = {
  amount: string;
  paidAt: string | null;
  targetChoice: "UNSELECTED" | "UNSCHEDULED" | "INSTALLMENT";
  installmentId: string | null;
  budgetItemId: string | null;
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
};

export type PaymentFacts = {
  amount: number;
  paidAt: string | null;
  installmentId: string | null;
  budgetItemId: string | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  notes: string | null;
};

export type PendingSupplierPayment = PaymentFacts & {
  version: 1;
  userId: string;
  weddingId: string;
  supplierId: string;
  clientRequestId: string;
  paidAt: string;
};

export type Validation<T, K extends string> =
  | { ok: true; value: T }
  | { ok: false; field: K; message: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const currencyMaximum = 999_999_999_999.99;

function trimOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTimestamp(value: string): boolean {
  if (!value.trim()) return false;
  return Number.isFinite(new Date(value).getTime());
}

function validPositiveAmount(value: string): number | null {
  const amount = parseAmount(value);
  if (amount === null || amount <= 0 || amount > currencyMaximum) return null;
  return Math.round(amount * 100) / 100 === amount ? amount : null;
}

export function isInstallmentStatus(value: string): value is InstallmentStatus {
  return INSTALLMENT_STATUSES.some((status) => status === value);
}

export function mapSupplierInstallment(
  row: ScheduleRow,
  weddingId: string,
  supplierId: string,
): SupplierInstallment | null {
  const status = row.status;
  if (!status || !isInstallmentStatus(status)) return null;
  if (
    row.wedding_id !== weddingId
    || row.supplier_id !== supplierId
    || !row.id
    || !row.due_date
    || !isValidDateOnly(row.due_date)
    || typeof row.amount !== "number"
    || !Number.isFinite(row.amount)
    || row.amount <= 0
    || typeof row.paid_amount !== "number"
    || !Number.isFinite(row.paid_amount)
    || typeof row.unpaid_balance !== "number"
    || !Number.isFinite(row.unpaid_balance)
    || row.unpaid_balance < 0
  ) return null;

  return {
    id: row.id,
    weddingId,
    supplierId,
    budgetItemId: row.budget_item_id,
    budgetItemName: null,
    amount: row.amount,
    dueDate: row.due_date,
    notes: row.notes,
    cancelledAt: row.cancelled_at,
    paidAmount: row.paid_amount,
    unpaidBalance: row.unpaid_balance,
    status,
  };
}

export function installmentStatusLabel(status: InstallmentStatus): string {
  switch (status) {
    case "PENDING": return "Pending";
    case "PARTIALLY_PAID": return "Partially paid";
    case "PAID": return "Paid";
    case "OVERDUE": return "Overdue";
    case "CANCELLED": return "Cancelled";
  }
}

export function installmentStatusTone(status: InstallmentStatus): "success" | "warning" | "error" | "neutral" {
  switch (status) {
    case "PAID": return "success";
    case "PARTIALLY_PAID": return "warning";
    case "OVERDUE": return "error";
    case "PENDING":
    case "CANCELLED": return "neutral";
  }
}

export function mapSupplierPayment(
  row: TransactionRow,
  expected: { weddingId: string; supplierId: string; kind?: "PAYMENT" | "REVERSAL" },
  reversed = false,
): SupplierPayment | null {
  if (
    row.wedding_id !== expected.weddingId
    || row.supplier_id !== expected.supplierId
    || (expected.kind && row.kind !== expected.kind)
    || (row.kind !== "PAYMENT" && row.kind !== "REVERSAL")
    || !row.id
    || typeof row.amount !== "number"
    || !Number.isFinite(row.amount)
    || row.amount <= 0
    || !isValidTimestamp(row.paid_at)
  ) return null;
  return { ...row, reversed };
}

export function validateInstallmentDraft(
  draft: InstallmentDraft,
  budgetItems: readonly Pick<SupplierBudgetItem, "id">[],
): Validation<InstallmentWrite, keyof InstallmentDraft> {
  const amount = validPositiveAmount(draft.amount);
  if (amount === null) return { ok: false, field: "amount", message: "Enter an installment amount greater than zero." };
  if (!isValidDateOnly(draft.dueDate)) return { ok: false, field: "dueDate", message: "Choose a valid due date." };
  if (draft.budgetItemId && !budgetItems.some((item) => item.id === draft.budgetItemId)) {
    return { ok: false, field: "budgetItemId", message: "Choose a Budget Item linked to this Supplier." };
  }
  return {
    ok: true,
    value: {
      amount,
      dueDate: draft.dueDate,
      budgetItemId: draft.budgetItemId,
      notes: trimOptional(draft.notes),
    },
  };
}

export function validatePaymentDraft(
  draft: PaymentDraft,
  context: {
    installments: readonly SupplierInstallment[];
    budgetItems: readonly Pick<SupplierBudgetItem, "id">[];
  },
): Validation<PaymentFacts, keyof PaymentDraft> {
  const amount = validPositiveAmount(draft.amount);
  if (amount === null) return { ok: false, field: "amount", message: "Enter a payment amount greater than zero." };
  if (draft.paidAt !== null && !isValidTimestamp(draft.paidAt)) {
    return { ok: false, field: "paidAt", message: "Choose a valid payment date and time." };
  }
  if (draft.targetChoice === "UNSELECTED") {
    return { ok: false, field: "targetChoice", message: "Choose an installment or confirm this payment is outside the schedule." };
  }
  if (draft.targetChoice === "UNSCHEDULED" && draft.installmentId !== null) {
    return { ok: false, field: "targetChoice", message: "Choose either an installment or an unscheduled payment." };
  }
  if (draft.targetChoice === "INSTALLMENT" && !draft.installmentId) {
    return { ok: false, field: "installmentId", message: "Choose an active installment from this Supplier." };
  }
  if (draft.targetChoice === "INSTALLMENT" && draft.installmentId) {
    const selected = context.installments.find((installment) => installment.id === draft.installmentId);
    if (!selected || selected.status === "CANCELLED") {
      return { ok: false, field: "installmentId", message: "Choose an active installment from this Supplier." };
    }
  }
  if (draft.budgetItemId && !context.budgetItems.some((item) => item.id === draft.budgetItemId)) {
    return { ok: false, field: "budgetItemId", message: "Choose a Budget Item linked to this Supplier." };
  }
  return {
    ok: true,
    value: {
      amount,
      paidAt: draft.paidAt ? new Date(draft.paidAt).toISOString() : null,
      installmentId: draft.installmentId,
      budgetItemId: draft.budgetItemId,
      paymentMethod: trimOptional(draft.paymentMethod),
      referenceNumber: trimOptional(draft.referenceNumber),
      notes: trimOptional(draft.notes),
    },
  };
}

export function createPendingSupplierPayment(
  facts: PaymentFacts,
  identity: { userId: string; weddingId: string; supplierId: string },
  createUuid: () => string,
  now: () => string,
): PendingSupplierPayment {
  const clientRequestId = createUuid();
  const paidAt = facts.paidAt ?? now();
  return {
    version: 1,
    ...identity,
    ...facts,
    clientRequestId,
    paidAt,
  };
}

export function isPendingSupplierPayment(value: unknown): value is PendingSupplierPayment {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 1
    && typeof candidate.userId === "string"
    && typeof candidate.weddingId === "string"
    && typeof candidate.supplierId === "string"
    && typeof candidate.clientRequestId === "string"
    && uuidPattern.test(candidate.clientRequestId)
    && typeof candidate.amount === "number"
    && Number.isFinite(candidate.amount)
    && candidate.amount > 0
    && candidate.amount <= currencyMaximum
    && typeof candidate.paidAt === "string"
    && isValidTimestamp(candidate.paidAt)
    && (candidate.installmentId === null || typeof candidate.installmentId === "string")
    && (candidate.budgetItemId === null || typeof candidate.budgetItemId === "string")
    && (candidate.paymentMethod === null || typeof candidate.paymentMethod === "string")
    && (candidate.referenceNumber === null || typeof candidate.referenceNumber === "string")
    && (candidate.notes === null || typeof candidate.notes === "string");
}

export function pendingPaymentRpcArgs(attempt: PendingSupplierPayment) {
  return {
    p_wedding_id: attempt.weddingId,
    p_supplier_id: attempt.supplierId,
    // PostgREST's generated type currently models nullable UUID args as string.
    p_installment_id: attempt.installmentId as string,
    p_budget_item_id: attempt.budgetItemId as string,
    p_amount: attempt.amount,
    p_paid_at: attempt.paidAt,
    p_client_request_id: attempt.clientRequestId,
    p_payment_method: attempt.paymentMethod as string,
    p_reference_number: attempt.referenceNumber as string,
    p_notes: attempt.notes as string,
  };
}

export function isDefinitivePaymentRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; status?: unknown };
  if (typeof value.status === "number" && value.status >= 400 && value.status < 500) return true;
  if (typeof value.code !== "string" || !/^[0-9A-Z]{5}$/.test(value.code)) return false;
  return !value.code.startsWith("08");
}

export function safeSupplierPaymentError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "We couldn't confirm this payment. Retry the same payment attempt when you're back online.";
  }
  const value = error as { code?: unknown; message?: unknown };
  const message = typeof value.message === "string" ? value.message.toLocaleLowerCase() : "";
  switch (value.code) {
    case "42501": return "Supplier finance is private or you don't have permission to record this payment.";
    case "22023":
      return message.includes("request id") || message.includes("request ID".toLocaleLowerCase())
        ? "This payment attempt key conflicts with different details. Check the ledger before starting a new payment."
        : "Check that the Supplier, installment and Budget Item belong to this Wedding.";
    case "23503": return "Choose an installment or Budget Item linked to this Supplier and Wedding.";
    case "23514": return "This payment doesn't match the finance rules. Review the amount and linked records.";
    case "23505": return "This payment conflicts with an existing finance record. Refresh the payment list to review it.";
    case "23502": return "Enter an amount and choose a payment date.";
    case "22P02": return "Check the payment amount and selected records.";
    default: return "We couldn't confirm this payment. Retry the same payment attempt when you're back online.";
  }
}

export function safeInstallmentError(error: unknown): string {
  if (!error || typeof error !== "object") return "We couldn't save this installment. Check your connection and try again.";
  const value = error as { code?: unknown };
  switch (value.code) {
    case "42501": return "Supplier finance is private or you don't have permission to change installments.";
    case "22023": return "This installment or Supplier is unavailable in this Wedding.";
    case "23503": return "Choose a Budget Item linked to this Supplier and Wedding.";
    case "23514": return "Review the installment amount and due date.";
    case "23502": return "Enter an amount and due date.";
    case "22P02": return "Review the installment amount and due date.";
    default: return "We couldn't save this installment. Check your connection and try again.";
  }
}

export function safeReversalError(error: unknown): string {
  if (!error || typeof error !== "object") return "We couldn't confirm the reversal. Refresh Payment Details before trying again.";
  const value = error as { code?: unknown };
  switch (value.code) {
    case "42501": return "Supplier finance is private or you don't have permission to reverse this payment.";
    case "22023": return "This payment can't be reversed. Refresh Payment Details and check its current state.";
    case "23514": return "Enter a reason for the reversal.";
    case "23505": return "This payment already has a reversal. Refresh Payment Details to review it.";
    default: return "We couldn't confirm the reversal. Refresh Payment Details before trying again.";
  }
}

export function safeReceiptError(error: unknown): string {
  if (!error || typeof error !== "object") return "We couldn't finish the receipt action. Check your connection and try again.";
  const value = error as { code?: unknown };
  switch (value.code) {
    case "42501": return "This receipt is private or you don't have permission to access it.";
    case "22023": return "This receipt is unavailable. Choose the file again or refresh Payment Details.";
    case "23503": return "This receipt doesn't belong to this payment and Wedding.";
    case "23514": return "Receipts can only be attached to actual PAYMENT transactions.";
    default: return "We couldn't finish the receipt action. Check your connection and try again.";
  }
}
