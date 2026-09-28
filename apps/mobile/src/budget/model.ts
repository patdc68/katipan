import type { Database } from "@katipan/database/types";
import type { WorkspaceMembership } from "../workspace/model";

export type BudgetItemStatus = Database["public"]["Enums"]["budget_item_status"];
export const BUDGET_ITEM_STATUSES: readonly BudgetItemStatus[] = [
  "PLANNED", "CONFIRMED", "CANCELLED", "ARCHIVED",
];

export type BudgetTotals = {
  weddingId: string;
  currencyCode: string;
  activeItemCount: number;
  estimatedTotal: number;
  actualTotal: number;
  manualActualTotal: number;
  supplierActualTotal: number;
};

export type BudgetCategory = Pick<
  Database["public"]["Tables"]["budget_categories"]["Row"],
  "id" | "wedding_id" | "name" | "description" | "sort_order" | "archived_at"
>;

export type BudgetItem = Pick<
  Database["public"]["Tables"]["budget_items"]["Row"],
  "id" | "wedding_id" | "category_id" | "supplier_id" | "name" | "description"
  | "estimated_amount" | "actual_amount" | "notes" | "status" | "updated_at"
>;

export type BudgetSupplier = Pick<
  Database["public"]["Tables"]["suppliers"]["Row"],
  "id" | "wedding_id" | "name" | "category"
>;

export type SupplierActualTransaction = Pick<
  Database["public"]["Tables"]["supplier_payment_transactions"]["Row"],
  "budget_item_id" | "kind" | "amount"
>;

export type BudgetCategorySummary = BudgetCategory & {
  activeItemCount: number;
  itemCount: number;
  estimatedTotal: number;
  manualActualTotal: number;
  supplierActualTotal: number;
};

export type BudgetItemSummary = BudgetItem & {
  supplierLabel: string | null;
  supplierActual: number;
  actualTotal: number;
};

export type BudgetDashboardData = {
  totals: BudgetTotals;
  categories: BudgetCategorySummary[];
  recentItems: BudgetItemSummary[];
};

export type BudgetCategoryData = {
  totals: BudgetTotals;
  category: BudgetCategorySummary;
  items: BudgetItemSummary[];
};

export type BudgetEditorData = {
  totals: BudgetTotals;
  categories: BudgetCategory[];
  suppliers: BudgetSupplier[];
  item: BudgetItem | null;
};

export type BudgetLoadResult<T> =
  | { kind: "ready"; data: T }
  | { kind: "private" }
  | { kind: "unavailable" };

export type BudgetItemDraft = {
  name: string;
  description: string;
  categoryId: string;
  supplierId: string | null;
  estimatedAmount: string;
  actualAmount: string;
  notes: string;
  status: BudgetItemStatus;
};

export type BudgetItemWrite = {
  name: string;
  description: string | null;
  categoryId: string;
  supplierId: string | null;
  estimatedAmount: number;
  actualAmount: number | null;
  notes: string | null;
  status: BudgetItemStatus;
};

export type BudgetItemValidation =
  | { ok: true; value: BudgetItemWrite }
  | { ok: false; field: keyof BudgetItemDraft; message: string };

const activeStatuses: readonly BudgetItemStatus[] = ["PLANNED", "CONFIRMED"];

export function isBudgetFinanceManager(membership: WorkspaceMembership | null | undefined): boolean {
  return Boolean(
    membership
    && membership.status === "ACTIVE"
    && (membership.role === "OWNER" || membership.role === "FULL_COORDINATOR"),
  );
}

export function isBudgetItemStatus(value: string): value is BudgetItemStatus {
  return BUDGET_ITEM_STATUSES.some((status) => status === value);
}

export function isBudgetItemActive(status: BudgetItemStatus): boolean {
  return activeStatuses.includes(status);
}

function safeNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function signedTransactionAmount(transaction: SupplierActualTransaction): number {
  if (transaction.kind === "PAYMENT") return safeNumber(transaction.amount);
  if (transaction.kind === "REVERSAL") return -safeNumber(transaction.amount);
  return 0;
}

export function deriveCategorySummary(
  category: BudgetCategory,
  items: readonly BudgetItem[],
  transactions: readonly SupplierActualTransaction[],
): BudgetCategorySummary {
  const categoryItems = items.filter((item) => item.category_id === category.id);
  const categoryItemIds = new Set(categoryItems.map((item) => item.id));
  const supplierActualTotal = transactions.reduce((total, transaction) => (
    transaction.budget_item_id && categoryItemIds.has(transaction.budget_item_id)
      ? total + signedTransactionAmount(transaction)
      : total
  ), 0);

  return {
    ...category,
    activeItemCount: categoryItems.filter((item) => isBudgetItemActive(item.status)).length,
    itemCount: categoryItems.length,
    estimatedTotal: categoryItems.reduce((total, item) => (
      isBudgetItemActive(item.status) ? total + safeNumber(item.estimated_amount) : total
    ), 0),
    manualActualTotal: categoryItems.reduce((total, item) => (
      item.supplier_id === null ? total + safeNumber(item.actual_amount) : total
    ), 0),
    supplierActualTotal,
  };
}

export function deriveCategorySummaries(
  categories: readonly BudgetCategory[],
  items: readonly BudgetItem[],
  transactions: readonly SupplierActualTransaction[],
): BudgetCategorySummary[] {
  return categories.map((category) => deriveCategorySummary(category, items, transactions));
}

export function deriveSupplierActualByItem(
  transactions: readonly SupplierActualTransaction[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (!transaction.budget_item_id) continue;
    totals.set(
      transaction.budget_item_id,
      (totals.get(transaction.budget_item_id) ?? 0) + signedTransactionAmount(transaction),
    );
  }
  return totals;
}

export function deriveBudgetItemSummary(
  item: BudgetItem,
  supplierActual: number,
  supplierLabel: string | null,
): BudgetItemSummary {
  const manualActual = item.supplier_id === null ? safeNumber(item.actual_amount) : 0;
  return {
    ...item,
    supplierLabel,
    supplierActual,
    actualTotal: manualActual + supplierActual,
  };
}

export function budgetDifference(estimatedTotal: number, actualTotal: number): {
  amount: number;
  label: "remaining" | "over budget" | "no estimate";
} {
  const difference = safeNumber(estimatedTotal) - safeNumber(actualTotal);
  if (estimatedTotal <= 0) return { amount: Math.abs(difference), label: "no estimate" };
  if (difference < 0) return { amount: Math.abs(difference), label: "over budget" };
  return { amount: difference, label: "remaining" };
}

export function budgetProgressPercent(estimatedTotal: number, actualTotal: number): number {
  if (estimatedTotal <= 0) return 0;
  return Math.min(100, Math.max(0, (safeNumber(actualTotal) / estimatedTotal) * 100));
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const safeAmount = safeNumber(amount);
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "symbol",
    }).format(safeAmount);
  } catch {
    return `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(safeAmount)} ${currencyCode}`;
  }
}

export function parseAmount(value: string): number | null {
  const normalized = value.trim().replaceAll(",", "");
  if (!normalized || !/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function validateBudgetItemDraft(
  draft: BudgetItemDraft,
  allowedCategoryIds: ReadonlySet<string>,
  allowedSupplierIds: ReadonlySet<string>,
): BudgetItemValidation {
  const name = draft.name.trim();
  if (!name) return { ok: false, field: "name", message: "Add a name for this Budget Item." };
  if (!allowedCategoryIds.has(draft.categoryId)) {
    return { ok: false, field: "categoryId", message: "Choose an active category from this Wedding." };
  }

  const estimatedAmount = parseAmount(draft.estimatedAmount);
  if (estimatedAmount === null) {
    return { ok: false, field: "estimatedAmount", message: "Enter an estimated amount of zero or more." };
  }

  if (draft.supplierId !== null && !allowedSupplierIds.has(draft.supplierId)) {
    return { ok: false, field: "supplierId", message: "Choose a Supplier from this Wedding." };
  }

  let actualAmount: number | null = null;
  if (draft.supplierId !== null && draft.actualAmount.trim()) {
    return {
      ok: false,
      field: "actualAmount",
      message: "Clear the manual actual before linking a Supplier. Supplier payments are managed separately.",
    };
  }
  if (draft.supplierId === null && draft.actualAmount.trim()) {
    actualAmount = parseAmount(draft.actualAmount);
    if (actualAmount === null) {
      return { ok: false, field: "actualAmount", message: "Enter an actual amount of zero or more." };
    }
  }

  if (!isBudgetItemStatus(draft.status)) {
    return { ok: false, field: "status", message: "Choose a valid Budget Item status." };
  }

  return {
    ok: true,
    value: {
      name,
      description: draft.description.trim() || null,
      categoryId: draft.categoryId,
      supplierId: draft.supplierId,
      estimatedAmount,
      actualAmount,
      notes: draft.notes.trim() || null,
      status: draft.status,
    },
  };
}

export class SingleSubmitGate {
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

export function safeBudgetError(
  error: unknown,
  fallback = "We couldn't save this Budget change. Try again.",
): string {
  if (!error || typeof error !== "object" || !("code" in error)) return fallback;
  switch (error.code) {
    case "42501": return "Budget details are private or you don't have permission to change them.";
    case "23503": return "Choose a category or Supplier from this Wedding.";
    case "23505": return "An active category with this name already exists.";
    case "23514": return "This change doesn't match the Budget rules. Review the amounts and Supplier selection.";
    default: return fallback;
  }
}
