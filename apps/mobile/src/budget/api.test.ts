import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership, WorkspaceRole } from "../workspace/model";
import {
  archiveBudgetCategory,
  createBudgetCategory,
  loadBudgetCategories,
  loadBudgetDashboard,
  reorderBudgetCategories,
  saveBudgetItem,
  updateBudgetCategory,
} from "./api";
import { safeBudgetError, type BudgetItemWrite } from "./model";

type QueryRecord = {
  table: string;
  columns: string;
  filters: { operator: string; column: string; value: unknown }[];
  write: { operation: "insert" | "update" | "delete"; value: unknown } | null;
  orders: { column: string; ascending: boolean }[];
  limit: number | null;
};

type DbResponse = { data: unknown; error: { code: string } | null };
type DbResolver = (record: QueryRecord) => DbResponse;

const { from, rpc, records, calls, settings } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  records: [] as QueryRecord[],
  calls: [] as { name: string; args: Record<string, unknown> }[],
  settings: {
    totalsMissing: false,
    categoryInsertDuplicate: false,
    targetCategoryMissing: false,
    targetSupplierMissing: false,
    targetItemMissing: false,
    resolver: null as DbResolver | null,
  },
}));

vi.mock("../auth/client", () => ({ supabase: { from, rpc } }));

const weddingId = "wedding-a";
const itemRow = {
  id: "item-a",
  wedding_id: weddingId,
  category_id: "category-a",
  supplier_id: "supplier-a",
  name: "Photo and Video",
  description: null,
  estimated_amount: 12000,
  actual_amount: null,
  notes: null,
  status: "CONFIRMED" as const,
  updated_at: "2026-09-28T00:00:00Z",
};
const categoryRow = {
  id: "category-a",
  wedding_id: weddingId,
  name: "Photo & Video",
  description: null,
  sort_order: 10,
  archived_at: null,
};
const transactionRow = { budget_item_id: "item-a", kind: "PAYMENT", amount: 203 };

function membership(role: WorkspaceRole = "OWNER"): WorkspaceMembership {
  const coordinated = role === "FULL_COORDINATOR";
  return {
    membershipId: `membership-${role}`,
    weddingId,
    userId: "user-a",
    role,
    status: "ACTIVE",
    partnerNames: ["Juan", "Maria"],
    wedding: {
      id: weddingId,
      display_name: "Juan & Maria",
      wedding_date: null,
      general_location: "Manila",
      status: "ACTIVE",
      origin: coordinated ? "COORDINATOR_CREATED" : "COUPLE_CREATED",
      ownership_mode: coordinated ? "COORDINATOR_MANAGED" : "COUPLE_OWNED",
    },
  };
}

function responseFor(record: QueryRecord): DbResponse {
  if (settings.resolver) return settings.resolver(record);
  if (record.table === "wedding_budget_totals") {
    if (settings.totalsMissing) return { data: null, error: null };
    return { data: {
      wedding_id: weddingId,
      currency_code: "USD",
      active_item_count: 8,
      estimated_total: 48000,
      actual_total: 303,
      manual_actual_total: 100,
      supplier_actual_total: 203,
    }, error: null };
  }
  if (record.table === "budget_categories") {
    if (record.write?.operation === "insert") {
      return settings.categoryInsertDuplicate
        ? { data: null, error: { code: "23505" } }
        : { data: { id: "category-new" }, error: null };
    }
    if (record.write?.operation === "update") return { data: { id: "category-a" }, error: null };
    if (record.columns === "id") return { data: settings.targetCategoryMissing ? null : { id: "category-a" }, error: null };
    return { data: [categoryRow], error: null };
  }
  if (record.table === "budget_items") {
    if (record.columns === "id") return { data: settings.targetItemMissing ? null : { id: "item-a" }, error: null };
    if (record.filters.some((filter) => filter.column === "status" && filter.operator === "in")) {
      return { data: [itemRow], error: null };
    }
    return { data: [itemRow], error: null };
  }
  if (record.table === "supplier_payment_transactions") return { data: [transactionRow], error: null };
  if (record.table === "suppliers") {
    if (record.columns === "id") return { data: settings.targetSupplierMissing ? null : { id: "supplier-a" }, error: null };
    return { data: [{ id: "supplier-a", wedding_id: weddingId, name: "Film Co.", category: "Photographer" }], error: null };
  }
  throw new Error(`Unexpected table read: ${record.table}`);
}

function mockQueries() {
  records.splice(0, records.length);
  calls.splice(0, calls.length);
  Object.assign(settings, {
    totalsMissing: false,
    categoryInsertDuplicate: false,
    targetCategoryMissing: false,
    targetSupplierMissing: false,
    targetItemMissing: false,
    resolver: null,
  });
  from.mockReset();
  rpc.mockReset();
  rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    return Promise.resolve({ data: name === "create_budget_item" ? "item-created" : "item-a", error: null });
  });
  from.mockImplementation((table: string) => {
    const record: QueryRecord = { table, columns: "", filters: [], write: null, orders: [], limit: null };
    records.push(record);
    const query = {
      select(columns: string) { record.columns = columns; return query; },
      insert(value: unknown) { record.write = { operation: "insert", value }; return query; },
      update(value: unknown) { record.write = { operation: "update", value }; return query; },
      delete() { record.write = { operation: "delete", value: null }; return query; },
      eq(column: string, value: unknown) { record.filters.push({ operator: "eq", column, value }); return query; },
      is(column: string, value: unknown) { record.filters.push({ operator: "is", column, value }); return query; },
      in(column: string, value: unknown) { record.filters.push({ operator: "in", column, value }); return query; },
      order(column: string, options: { ascending?: boolean } = {}) { record.orders.push({ column, ascending: options.ascending ?? true }); return query; },
      limit(value: number) { record.limit = value; return query; },
      maybeSingle() { return Promise.resolve(responseFor(record)); },
      single() { return Promise.resolve(responseFor(record)); },
      then(onfulfilled: (value: DbResponse) => unknown, onrejected?: (reason: unknown) => unknown) {
        return Promise.resolve(responseFor(record)).then(onfulfilled, onrejected);
      },
    };
    return query;
  });
}

const manualItemWrite: BudgetItemWrite = {
  name: "Ceremony chairs",
  description: null,
  categoryId: "category-a",
  supplierId: null,
  estimatedAmount: 2000,
  actualAmount: 450,
  notes: null,
  status: "CONFIRMED",
};

describe("Budget finance reads", () => {
  beforeEach(mockQueries);

  it("loads canonical Wedding totals and never reconstructs top-level values from items", async () => {
    const result = await loadBudgetDashboard(membership());
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.data.totals).toEqual({
      weddingId,
      currencyCode: "USD",
      activeItemCount: 8,
      estimatedTotal: 48000,
      actualTotal: 303,
      manualActualTotal: 100,
      supplierActualTotal: 203,
    });
    const totalsQuery = records.find((record) => record.table === "wedding_budget_totals");
    expect(totalsQuery?.columns).toContain("actual_total");
    expect(totalsQuery?.columns).toContain("manual_actual_total");
    expect(totalsQuery?.columns).toContain("supplier_actual_total");
    expect(totalsQuery?.filters).toContainEqual({ operator: "eq", column: "wedding_id", value: weddingId });
    expect(records.some((record) => record.table === "supplier_payments" || record.table === "supplier_installments")).toBe(false);
    expect(records.find((record) => record.table === "budget_items")?.columns).not.toContain("legacy_supplier_actual_amount");
  });

  it("allows Owner and Full Coordinator controller memberships and rejects Day-of and Guest Coordinators", async () => {
    expect((await loadBudgetCategories(membership("OWNER"))).kind).toBe("ready");
    mockQueries();
    expect((await loadBudgetCategories(membership("FULL_COORDINATOR"))).kind).toBe("ready");
    mockQueries();
    expect((await loadBudgetCategories(membership("DAY_OF_COORDINATOR"))).kind).toBe("private");
    expect(from).not.toHaveBeenCalled();
    mockQueries();
    expect((await loadBudgetCategories(membership("GUEST_COORDINATOR"))).kind).toBe("private");
    expect(from).not.toHaveBeenCalled();
  });

  it("treats an RLS-filtered totals row as private instead of a zero budget", async () => {
    settings.totalsMissing = true;
    const result = await loadBudgetDashboard(membership("OWNER"));
    expect(result).toEqual({ kind: "private" });
    expect(records).toHaveLength(1);
    expect(records[0]?.table).toBe("wedding_budget_totals");
  });

  it("filters active categories in one Wedding-scoped query and does not make N+1 reads", async () => {
    await loadBudgetCategories(membership());
    const categoryQuery = records.find((record) => record.table === "budget_categories");
    expect(categoryQuery?.filters).toContainEqual({ operator: "eq", column: "wedding_id", value: weddingId });
    expect(categoryQuery?.filters).toContainEqual({ operator: "is", column: "archived_at", value: null });
    const itemQuery = records.find((record) => record.table === "budget_items");
    expect(itemQuery?.filters).toContainEqual({ operator: "eq", column: "wedding_id", value: weddingId });
    expect(records.filter((record) => record.table === "budget_items")).toHaveLength(1);
  });

  it("keeps all finance reads within the active Wedding", async () => {
    await loadBudgetDashboard(membership());
    for (const record of records) {
      expect(record.filters).toContainEqual({ operator: "eq", column: "wedding_id", value: weddingId });
    }
  });
});

describe("Budget Category mutations", () => {
  beforeEach(mockQueries);

  it("creates, edits, archives, and reorders categories without hard deletion", async () => {
    expect(await createBudgetCategory(membership(), { name: "Flowers", description: "Ceremony greens", sortOrder: 20 })).toBe("category-new");
    await updateBudgetCategory(membership(), "category-a", { name: "Floral Design", description: null });
    await archiveBudgetCategory(membership(), "category-a", "2026-09-28T12:00:00.000Z");
    await reorderBudgetCategories(membership(), ["category-a", "category-b"]);

    const insert = records.find((record) => record.write?.operation === "insert");
    expect(insert?.filters).toHaveLength(0);
    expect(insert?.write?.value).toMatchObject({ wedding_id: weddingId, name: "Flowers" });
    const updates = records.filter((record) => record.write?.operation === "update");
    expect(updates.every((record) => record.filters.some((filter) => filter.column === "wedding_id" && filter.value === weddingId))).toBe(true);
    expect(updates.some((record) => record.write?.value && typeof record.write.value === "object" && "archived_at" in record.write.value)).toBe(true);
    expect(records.some((record) => record.write?.operation === "delete")).toBe(false);
  });

  it("reports a case-insensitive active-name collision from the database unique index", async () => {
    settings.categoryInsertDuplicate = true;
    let captured: unknown;
    try { await createBudgetCategory(membership(), { name: "photo & video", description: null, sortOrder: 0 }); }
    catch (error) { captured = error; }
    expect(safeBudgetError(captured)).toBe("An active category with this name already exists.");
  });
});

describe("Budget Item mutations", () => {
  beforeEach(mockQueries);

  it("creates a non-Supplier manual actual through the budget-item RPC", async () => {
    expect(await saveBudgetItem(membership(), null, manualItemWrite)).toBe("item-created");
    const categoryGuard = records.find((record) => record.table === "budget_categories");
    expect(categoryGuard?.filters).toContainEqual({ operator: "eq", column: "wedding_id", value: weddingId });
    expect(calls[0]?.name).toBe("create_budget_item");
    expect(calls[0]?.args).toMatchObject({
      p_wedding_id: weddingId,
      p_category_id: "category-a",
      p_supplier_id: null,
      p_estimated_amount: 2000,
      p_actual_amount: 450,
      p_status: "CONFIRMED",
    });
  });

  it("does not call the update RPC for an item ID outside the active Wedding", async () => {
    settings.targetItemMissing = true;
    await expect(saveBudgetItem(membership(), "item-from-another-wedding", manualItemWrite)).rejects.toThrow("unavailable in this Wedding");
    expect(records[0]?.table).toBe("budget_items");
    expect(records[0]?.filters).toContainEqual({ operator: "eq", column: "wedding_id", value: weddingId });
    expect(calls).toHaveLength(0);
  });

  it("rejects a category from another Wedding before creating the Budget Item", async () => {
    settings.targetCategoryMissing = true;
    await expect(saveBudgetItem(membership(), null, manualItemWrite)).rejects.toThrow("Budget Category from this Wedding");
    expect(calls).toHaveLength(0);
    expect(records[0]?.filters).toContainEqual({ operator: "eq", column: "wedding_id", value: weddingId });
  });

  it("rejects a Supplier from another Wedding before writing a Supplier-linked item", async () => {
    settings.targetSupplierMissing = true;
    const supplierWrite = { ...manualItemWrite, supplierId: "supplier-b", actualAmount: null };
    await expect(saveBudgetItem(membership(), null, supplierWrite)).rejects.toThrow("Supplier from this Wedding");
    expect(records.some((record) => record.table === "suppliers" && record.filters.some((filter) => filter.value === weddingId))).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("sends only the four backend item statuses to the edit RPC", async () => {
    for (const status of ["PLANNED", "CONFIRMED", "CANCELLED", "ARCHIVED"] as const) {
      await saveBudgetItem(membership(), "item-a", { ...manualItemWrite, status });
    }
    expect(calls.map((call) => call.args.p_status)).toEqual(["PLANNED", "CONFIRMED", "CANCELLED", "ARCHIVED"]);
    expect(calls.every((call) => call.name === "update_budget_item")).toBe(true);
  });
});
