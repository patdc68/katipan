import type { Database } from "@katipan/database/types";
import type { WorkspaceMembership } from "../workspace/model";
import { parseAmount } from "../budget/model";

export type SupplierStatus = Database["public"]["Enums"]["supplier_status"];
export const SUPPLIER_STATUSES: readonly SupplierStatus[] = [
  "PROSPECT",
  "CONTACTED",
  "BOOKED",
  "COMPLETED",
  "CANCELLED",
];
export const SUPPLIER_STATUS_FILTERS = ["ALL", ...SUPPLIER_STATUSES] as const;
export type SupplierStatusFilter = (typeof SUPPLIER_STATUS_FILTERS)[number];

export type SupplierRecord = Pick<
  Database["public"]["Tables"]["suppliers"]["Row"],
  | "id" | "wedding_id" | "name" | "category" | "contact_name" | "email" | "phone"
  | "website" | "notes" | "status" | "committed_amount" | "committed_on"
  | "commitment_notes" | "created_at" | "updated_at"
>;

export type SupplierFinanceRow = Database["public"]["Views"]["supplier_finance_totals"]["Row"];

export type SupplierFinanceTotals = {
  supplierId: string;
  weddingId: string;
  committedAmount: number | null;
  scheduledAmount: number;
  actualPaid: number;
  remainingCommitment: number | null;
  overdueBalance: number;
  unscheduledPaid: number;
};

export type SupplierListItem = SupplierRecord & { finance: SupplierFinanceTotals };

export type SupplierBudgetItem = Pick<
  Database["public"]["Tables"]["budget_items"]["Row"],
  | "id" | "wedding_id" | "category_id" | "supplier_id" | "name"
  | "estimated_amount" | "actual_amount" | "status"
> & { categoryName: string };

export type SupplierContractDocument = Pick<
  Database["public"]["Tables"]["attachments"]["Row"],
  | "id" | "wedding_id" | "original_filename" | "content_type" | "size_bytes"
  | "visibility" | "status" | "updated_at"
>;

export type SupplierInstallmentPreview = {
  id: string;
  amount: number;
  dueDate: string;
  paidAmount: number;
  unpaidBalance: number;
  status: "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
  budgetItemId: string | null;
  budgetItemName: string | null;
  notes: string | null;
};

export type SupplierRecentPayment = Pick<
  Database["public"]["Tables"]["supplier_payment_transactions"]["Row"],
  "id" | "amount" | "paid_at" | "installment_id" | "budget_item_id"
  | "payment_method" | "reference_number" | "notes"
> & { reversed: boolean };

export type SupplierDetailsData = {
  currencyCode: string;
  supplier: SupplierRecord;
  finance: SupplierFinanceTotals;
  budgetItems: SupplierBudgetItem[];
  contractDocuments: SupplierContractDocument[];
  upcomingInstallments: SupplierInstallmentPreview[];
  recentPayments: SupplierRecentPayment[];
};

export type SupplierEditorData = {
  currencyCode: string;
  supplier: SupplierRecord | null;
};

export type SupplierListData = {
  currencyCode: string;
  suppliers: SupplierListItem[];
};

export type SupplierLoadResult<T> =
  | { kind: "ready"; data: T }
  | { kind: "private" }
  | { kind: "unavailable" };

export type SupplierDraft = {
  name: string;
  category: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  notes: string;
  status: SupplierStatus;
};

export type SupplierWrite = {
  name: string;
  category: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  status: SupplierStatus;
};

export type SupplierDraftField = keyof SupplierDraft;
export type SupplierValidation =
  | { ok: true; value: SupplierWrite }
  | { ok: false; field: SupplierDraftField; message: string };

export type SupplierCommitmentDraft = {
  amount: string;
  committedOn: string;
  notes: string;
};

export type SupplierCommitmentWrite =
  | { amount: number; committedOn: string | null; notes: string | null }
  | { amount: null; committedOn: null; notes: null };

export type SupplierCommitmentValidation =
  | { ok: true; value: Exclude<SupplierCommitmentWrite, { amount: null }> }
  | { ok: false; field: keyof SupplierCommitmentDraft; message: string };

export function isSupplierFinanceManager(
  membership: WorkspaceMembership | null | undefined,
): boolean {
  return Boolean(
    membership
    && membership.status === "ACTIVE"
    && membership.weddingId === membership.wedding.id
    && (membership.role === "OWNER" || membership.role === "FULL_COORDINATOR"),
  );
}

export function isSupplierStatus(value: string): value is SupplierStatus {
  return SUPPLIER_STATUSES.some((status) => status === value);
}

export function supplierStatusLabel(status: SupplierStatus): string {
  switch (status) {
    case "PROSPECT": return "Prospect";
    case "CONTACTED": return "Contacted";
    case "BOOKED": return "Booked";
    case "COMPLETED": return "Completed";
    case "CANCELLED": return "Cancelled";
  }
}

export function supplierStatusTone(
  status: SupplierStatus,
): "success" | "warning" | "error" | "neutral" {
  switch (status) {
    case "BOOKED":
    case "COMPLETED": return "success";
    case "CONTACTED": return "warning";
    case "CANCELLED": return "error";
    case "PROSPECT": return "neutral";
  }
}

function finiteAmount(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableAmount(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function mapSupplierFinanceTotals(
  row: SupplierFinanceRow,
  expectedWeddingId: string,
  expectedSupplierId: string,
): SupplierFinanceTotals | null {
  if (row.wedding_id !== expectedWeddingId || row.supplier_id !== expectedSupplierId) return null;
  return {
    supplierId: expectedSupplierId,
    weddingId: expectedWeddingId,
    committedAmount: nullableAmount(row.committed_amount),
    scheduledAmount: finiteAmount(row.scheduled_amount),
    actualPaid: finiteAmount(row.actual_paid),
    remainingCommitment: nullableAmount(row.remaining_commitment),
    overdueBalance: finiteAmount(row.overdue_balance),
    unscheduledPaid: finiteAmount(row.unscheduled_paid),
  };
}

function cleanOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSupplierDraft(draft: SupplierDraft): SupplierValidation {
  const name = draft.name.trim();
  if (!name) return { ok: false, field: "name", message: "Add a Supplier name." };

  const category = draft.category.trim();
  if (!category) return { ok: false, field: "category", message: "Add a Supplier category." };

  const email = draft.email.trim().toLowerCase();
  if (email && !emailPattern.test(email)) {
    return { ok: false, field: "email", message: "Enter a valid email address." };
  }

  if (!isSupplierStatus(draft.status)) {
    return { ok: false, field: "status", message: "Choose one of the available Supplier statuses." };
  }

  return {
    ok: true,
    value: {
      name,
      category,
      contactName: cleanOptional(draft.contactName),
      email: email || null,
      phone: cleanOptional(draft.phone),
      website: cleanOptional(draft.website),
      notes: cleanOptional(draft.notes),
      status: draft.status,
    },
  };
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateSupplierCommitmentDraft(
  draft: SupplierCommitmentDraft,
): SupplierCommitmentValidation {
  const amount = parseAmount(draft.amount);
  if (amount === null) {
    return { ok: false, field: "amount", message: "Enter a commitment amount of zero or more." };
  }

  const committedOn = draft.committedOn.trim();
  if (committedOn && !isValidDateOnly(committedOn)) {
    return { ok: false, field: "committedOn", message: "Enter a valid date in YYYY-MM-DD format." };
  }

  return {
    ok: true,
    value: {
      amount,
      committedOn: committedOn || null,
      notes: cleanOptional(draft.notes),
    },
  };
}

export function filterSupplierList(
  suppliers: readonly SupplierListItem[],
  input: { search: string; status: SupplierStatusFilter; category?: string },
): SupplierListItem[] {
  const query = input.search.trim().toLocaleLowerCase();
  const category = input.category?.toLocaleLowerCase();
  return suppliers.filter((supplier) => {
    const statusMatches = input.status === "ALL" || supplier.status === input.status;
    const categoryMatches = !category || supplier.category.toLocaleLowerCase() === category;
    const searchable = [supplier.name, supplier.category, supplier.contact_name, supplier.email, supplier.phone]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLocaleLowerCase();
    return statusMatches && categoryMatches && (!query || searchable.includes(query));
  });
}

export function supplierCategories(suppliers: readonly SupplierRecord[]): string[] {
  const unique = new Map<string, string>();
  for (const supplier of suppliers) {
    const value = supplier.category.trim();
    if (value) unique.set(value.toLocaleLowerCase(), value);
  }
  return [...unique.values()].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

export function supplierWebsiteHref(value: string | null): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || !parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function supplierPhoneHref(value: string | null): string | null {
  if (!value) return null;
  const dial = value.replace(/[^\d+]/g, "");
  return /^\+?\d{5,20}$/.test(dial) ? `tel:${dial}` : null;
}

export function supplierEmailHref(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return emailPattern.test(normalized)
    ? `mailto:${normalized.split("@").map(encodeURIComponent).join("@")}`
    : null;
}

export function safeSupplierError(
  error: unknown,
  fallback = "We couldn't save this Supplier. Check your connection and try again.",
): string {
  if (!error || typeof error !== "object" || !("code" in error)) return fallback;
  const code = error.code;
  if (code === "SUPPLIER_VALIDATION" && "message" in error && typeof error.message === "string") return error.message;
  switch (code) {
    case "42501": return "Supplier and finance details are private or you don't have permission to change them.";
    case "22023": return "This Supplier is unavailable in this Wedding.";
    case "23503": return "Choose a record from this Wedding. Cross-Wedding references aren't allowed.";
    case "23514": return "This change doesn't match the Supplier finance rules. Review the commitment details.";
    case "22P02": return "Choose one of the available Supplier statuses.";
    case "23502": return "Supplier name and category are required.";
    default: return fallback;
  }
}

export class SupplierSubmitGate {
  private pending = false;

  async run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (this.pending) return undefined;
    this.pending = true;
    try {
      return await action();
    } finally {
      this.pending = false;
    }
  }
}
