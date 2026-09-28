import { describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership, WorkspaceRole } from "../workspace/model";
import {
  BUDGET_ITEM_STATUSES,
  SingleSubmitGate,
  budgetDifference,
  budgetProgressPercent,
  deriveCategorySummary,
  deriveSupplierActualByItem,
  formatCurrency,
  isBudgetFinanceManager,
  isBudgetItemStatus,
  parseAmount,
  validateBudgetItemDraft,
  type BudgetCategory,
  type BudgetItem,
  type BudgetItemDraft,
  type SupplierActualTransaction,
} from "./model";

const weddingId = "wedding-a";
const categoryA: BudgetCategory = {
  id: "category-a", wedding_id: weddingId, name: "Ceremony", description: null, sort_order: 10, archived_at: null,
};
const categoryB: BudgetCategory = {
  id: "category-b", wedding_id: weddingId, name: "Reception", description: null, sort_order: 20, archived_at: null,
};

function membership(role: WorkspaceRole, status: WorkspaceMembership["status"] = "ACTIVE"): WorkspaceMembership {
  return {
    membershipId: `membership-${role}`,
    weddingId,
    userId: "user-a",
    role,
    status,
    partnerNames: ["Juan", "Maria"],
    wedding: {
      id: weddingId,
      display_name: "Juan & Maria",
      wedding_date: null,
      general_location: "Manila",
      status: "ACTIVE",
      origin: "COORDINATOR_CREATED",
      ownership_mode: "COORDINATOR_MANAGED",
    },
  };
}

function item(overrides: Partial<BudgetItem> & Pick<BudgetItem, "id" | "category_id" | "status">): BudgetItem {
  return {
    wedding_id: weddingId,
    supplier_id: null,
    name: overrides.id,
    description: null,
    estimated_amount: 0,
    actual_amount: null,
    notes: null,
    updated_at: "2026-09-28T00:00:00Z",
    ...overrides,
  };
}

function draft(overrides: Partial<BudgetItemDraft> = {}): BudgetItemDraft {
  return {
    name: "Ceremony chairs",
    description: "Wood chairs",
    categoryId: categoryA.id,
    supplierId: null,
    estimatedAmount: "12500",
    actualAmount: "1000",
    notes: "Deliver before noon",
    status: "PLANNED",
    ...overrides,
  };
}

describe("Budget finance access", () => {
  it("allows Owners and Full Coordinators, including the coordinator-managed controller path", () => {
    expect(isBudgetFinanceManager(membership("OWNER"))).toBe(true);
    expect(isBudgetFinanceManager(membership("FULL_COORDINATOR"))).toBe(true);
  });

  it("does not grant finance access to Day-of, Guest Coordinator, or inactive memberships", () => {
    expect(isBudgetFinanceManager(membership("DAY_OF_COORDINATOR"))).toBe(false);
    expect(isBudgetFinanceManager(membership("GUEST_COORDINATOR"))).toBe(false);
    expect(isBudgetFinanceManager(membership("OWNER", "LEFT"))).toBe(false);
  });
});

describe("Budget totals and currency formatting", () => {
  it("shows over-budget differences and caps the progress indicator", () => {
    expect(budgetDifference(1000, 1250)).toEqual({ amount: 250, label: "over budget" });
    expect(budgetDifference(0, 1250)).toEqual({ amount: 1250, label: "no estimate" });
    expect(budgetDifference(1000, 400)).toEqual({ amount: 600, label: "remaining" });
    expect(budgetProgressPercent(1000, 1250)).toBe(100);
    expect(budgetProgressPercent(0, 400)).toBe(0);
  });

  it("uses the Wedding's currency code instead of a peso literal", () => {
    expect(formatCurrency(1234.5, "USD")).toBe(
      new Intl.NumberFormat("en-PH", { style: "currency", currency: "USD", currencyDisplay: "symbol" }).format(1234.5),
    );
    expect(formatCurrency(1234.5, "JPY")).toBe(
      new Intl.NumberFormat("en-PH", { style: "currency", currency: "JPY", currencyDisplay: "symbol" }).format(1234.5),
    );
    expect(formatCurrency(1234.5, "USD")).not.toContain("PHP");
  });
});

describe("Budget category actuals", () => {
  it("sums active estimates, non-Supplier manual actuals, and net linked Supplier transactions separately", () => {
    const items = [
      item({ id: "planned-manual", category_id: categoryA.id, status: "PLANNED", estimated_amount: 1000, actual_amount: 500 }),
      item({ id: "confirmed-supplier", category_id: categoryA.id, status: "CONFIRMED", estimated_amount: 2000, supplier_id: "supplier-a" }),
      item({ id: "cancelled-manual", category_id: categoryA.id, status: "CANCELLED", estimated_amount: 900, actual_amount: 100 }),
      item({ id: "archived-other", category_id: categoryB.id, status: "ARCHIVED", estimated_amount: 800, actual_amount: 200 }),
      // A malformed legacy value must never become manual or Supplier actual activity.
      { ...item({ id: "bad-linked-value", category_id: categoryA.id, status: "CONFIRMED", supplier_id: "supplier-a", estimated_amount: 10, actual_amount: 777 }), legacy_supplier_actual_amount: 999999 } as BudgetItem,
    ];
    const transactions: SupplierActualTransaction[] = [
      { budget_item_id: "confirmed-supplier", kind: "PAYMENT", amount: 900 },
      { budget_item_id: "confirmed-supplier", kind: "REVERSAL", amount: 125 },
      { budget_item_id: null, kind: "PAYMENT", amount: 500 },
      { budget_item_id: "not-in-category", kind: "PAYMENT", amount: 1000 },
    ];

    const summary = deriveCategorySummary(categoryA, items, transactions);
    expect(summary).toMatchObject({
      itemCount: 4,
      activeItemCount: 3,
      estimatedTotal: 3010,
      manualActualTotal: 600,
      supplierActualTotal: 775,
    });
  });

  it("returns net Supplier contribution per linked Budget Item", () => {
    expect(deriveSupplierActualByItem([
      { budget_item_id: "item-a", kind: "PAYMENT", amount: 100 },
      { budget_item_id: "item-a", kind: "REVERSAL", amount: 25 },
      { budget_item_id: null, kind: "PAYMENT", amount: 1000 },
    ])).toEqual(new Map([["item-a", 75]]));
  });
});

describe("Budget Item validation", () => {
  const categories = new Set([categoryA.id]);
  const suppliers = new Set(["supplier-a"]);

  it("accepts zero estimates and a non-Supplier manual actual expense", () => {
    expect(validateBudgetItemDraft(draft({ estimatedAmount: "0", actualAmount: "1,250.50" }), categories, suppliers)).toEqual({
      ok: true,
      value: {
        name: "Ceremony chairs",
        description: "Wood chairs",
        categoryId: categoryA.id,
        supplierId: null,
        estimatedAmount: 0,
        actualAmount: 1250.5,
        notes: "Deliver before noon",
        status: "PLANNED",
      },
    });
  });

  it("rejects negative, malformed, or cross-Wedding amounts and relationships", () => {
    expect(validateBudgetItemDraft(draft({ estimatedAmount: "-1" }), categories, suppliers)).toMatchObject({ ok: false, field: "estimatedAmount" });
    expect(validateBudgetItemDraft(draft({ estimatedAmount: "1.234" }), categories, suppliers)).toMatchObject({ ok: false, field: "estimatedAmount" });
    expect(validateBudgetItemDraft(draft({ categoryId: "category-from-another-wedding" }), categories, suppliers)).toMatchObject({ ok: false, field: "categoryId" });
    expect(validateBudgetItemDraft(draft({ supplierId: "supplier-from-another-wedding" }), categories, suppliers)).toMatchObject({ ok: false, field: "supplierId" });
  });

  it("never writes a Supplier-linked actual amount", () => {
    expect(validateBudgetItemDraft(draft({ supplierId: "supplier-a", actualAmount: "100" }), categories, suppliers)).toMatchObject({
      ok: false,
      field: "actualAmount",
    });
    expect(validateBudgetItemDraft(draft({ supplierId: "supplier-a", actualAmount: "" }), categories, suppliers)).toMatchObject({
      ok: true,
      value: { supplierId: "supplier-a", actualAmount: null },
    });
  });

  it("uses exactly the four backend statuses", () => {
    expect(BUDGET_ITEM_STATUSES).toEqual(["PLANNED", "CONFIRMED", "CANCELLED", "ARCHIVED"]);
    for (const status of BUDGET_ITEM_STATUSES) expect(isBudgetItemStatus(status)).toBe(true);
    expect(isBudgetItemStatus("PENDING")).toBe(false);
    expect(validateBudgetItemDraft(draft({ status: "PENDING" as BudgetItemDraft["status"] }), categories, suppliers)).toMatchObject({ ok: false, field: "status" });
  });

  it("requires a non-empty name and parses only non-negative currency amounts", () => {
    expect(parseAmount("0")).toBe(0);
    expect(parseAmount("12,500.00")).toBe(12500);
    expect(parseAmount("-2")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(validateBudgetItemDraft(draft({ name: "  " }), categories, suppliers)).toMatchObject({ ok: false, field: "name" });
  });
});

describe("duplicate submit protection", () => {
  it("allows only one in-flight submission", async () => {
    const gate = new SingleSubmitGate();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const action = vi.fn(async () => pending);
    const first = gate.run(action);
    await Promise.resolve();
    const second = await gate.run(action);
    expect(second).toBeUndefined();
    finish();
    await first;
    expect(action).toHaveBeenCalledTimes(1);
  });
});
