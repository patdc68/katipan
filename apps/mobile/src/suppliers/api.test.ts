import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership, WorkspaceRole } from "../workspace/model";
import {
  createSupplier,
  loadSupplierDetails,
  loadSupplierList,
  setSupplierCommitment,
  updateSupplier,
} from "./api";
import {
  safeSupplierError,
  SUPPLIER_STATUSES,
  type SupplierFinanceRow,
} from "./model";

type QueryRecord = {
  table: string;
  columns: string;
  filters: { operator: string; column: string; value: unknown }[];
  orders: { column: string; ascending: boolean }[];
  operation: "select" | "insert" | "update" | "delete";
  write: unknown;
  singleResult: boolean;
};
type DbResponse = { data: unknown; error: { code: string; message?: string } | null };

const { from, rpc, records, rpcCalls, settings } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  records: [] as QueryRecord[],
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  settings: {
    missingWitness: false,
    unavailableSupplierId: null as string | null,
    actualAmountViolation: false,
    crossWeddingBudgetItem: false,
    hideAttachment: false,
    permissionTables: [] as string[],
  },
}));

vi.mock("../auth/client", () => ({ supabase: { from, rpc } }));

const weddingId = "wedding-a";
const supplierRow = {
  id: "supplier-a",
  wedding_id: weddingId,
  name: "Luntian Studio",
  category: "Photo & Film",
  contact_name: "Mila Santos",
  email: "mila@example.com",
  phone: "+63 900 000 0000",
  website: "luntian.example",
  notes: "Capture ceremony and reception.",
  status: "CONTACTED" as const,
  committed_amount: 1500,
  committed_on: "2026-09-01",
  commitment_notes: "Includes delivery.",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};
const financeRow: SupplierFinanceRow = {
  supplier_id: "supplier-a",
  wedding_id: weddingId,
  committed_amount: 1500,
  scheduled_amount: 840,
  // The view supplies net actual paid: 300 PAYMENT minus 25 REVERSAL.
  actual_paid: 275,
  remaining_commitment: 1225,
  overdue_balance: 140,
  unscheduled_paid: 35,
};
const budgetItemRow = {
  id: "item-a",
  wedding_id: weddingId,
  category_id: "category-a",
  supplier_id: "supplier-a",
  name: "Photo and Film Coverage",
  estimated_amount: 1200,
  actual_amount: null,
  status: "CONFIRMED" as const,
};

function membership(role: WorkspaceRole = "OWNER", controller = false): WorkspaceMembership {
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
      origin: controller ? "COORDINATOR_CREATED" : "COUPLE_CREATED",
      ownership_mode: controller ? "COORDINATOR_MANAGED" : "COUPLE_OWNED",
    },
  };
}

const supplierDraft = {
  name: "  Luntian Studio  ",
  category: "  Photo & Film  ",
  contactName: " Mila Santos ",
  email: "  HELLO@EXAMPLE.COM ",
  phone: " +63 900 000 0000 ",
  website: " luntian.example ",
  notes: " Capture ceremony and reception. ",
  status: "PROSPECT" as const,
};

function responseFor(record: QueryRecord): DbResponse {
  if (settings.permissionTables.includes(record.table)) return { data: null, error: { code: "42501" } };
  if (record.table === "wedding_budget_totals") {
    return settings.missingWitness
      ? { data: null, error: null }
      : { data: { wedding_id: weddingId, currency_code: "PHP" }, error: null };
  }
  if (record.table === "suppliers") {
    const id = record.filters.find((filter) => filter.column === "id")?.value;
    const missing = typeof id === "string" && (id === settings.unavailableSupplierId || id !== "supplier-a");
    if (missing) return { data: null, error: null };
    return { data: record.singleResult ? supplierRow : [supplierRow], error: null };
  }
  if (record.table === "supplier_finance_totals") {
    return { data: record.singleResult ? financeRow : [financeRow], error: null };
  }
  if (record.table === "budget_items") {
    if (settings.crossWeddingBudgetItem) return { data: [{ ...budgetItemRow, wedding_id: "wedding-b" }], error: null };
    return { data: [settings.actualAmountViolation ? { ...budgetItemRow, actual_amount: 88 } : budgetItemRow], error: null };
  }
  if (record.table === "budget_categories") {
    return { data: [{ id: "category-a", wedding_id: weddingId, name: "Photo & Film" }], error: null };
  }
  if (record.table === "supplier_contract_attachments") {
    return { data: [{ wedding_id: weddingId, supplier_id: "supplier-a", attachment_id: "attachment-a", created_at: "2026-09-02T00:00:00Z" }], error: null };
  }
  if (record.table === "attachments") {
    if (settings.hideAttachment) return { data: [], error: null };
    return { data: [{
      id: "attachment-a",
      wedding_id: weddingId,
      original_filename: "Luntian-contract.pdf",
      content_type: "application/pdf",
      size_bytes: 2048,
      visibility: "FINANCIAL_PRIVATE",
      status: "AVAILABLE",
      updated_at: "2026-09-02T00:00:00Z",
    }], error: null };
  }
  throw new Error(`Unexpected table read: ${record.table}`);
}

function mockQueries() {
  records.splice(0, records.length);
  rpcCalls.splice(0, rpcCalls.length);
  Object.assign(settings, { missingWitness: false, unavailableSupplierId: null, actualAmountViolation: false, crossWeddingBudgetItem: false, hideAttachment: false, permissionTables: [] });
  from.mockReset();
  rpc.mockReset();
  rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args });
    return Promise.resolve({ data: name === "create_supplier" ? "supplier-created" : "supplier-a", error: null });
  });
  from.mockImplementation((table: string) => {
    const record: QueryRecord = { table, columns: "", filters: [], orders: [], operation: "select", write: null, singleResult: false };
    records.push(record);
    const query = {
      select(columns: string) { record.columns = columns; record.operation = "select"; return query; },
      insert(value: unknown) { record.operation = "insert"; record.write = value; return query; },
      update(value: unknown) { record.operation = "update"; record.write = value; return query; },
      delete() { record.operation = "delete"; return query; },
      eq(column: string, value: unknown) { record.filters.push({ operator: "eq", column, value }); return query; },
      neq(column: string, value: unknown) { record.filters.push({ operator: "neq", column, value }); return query; },
      in(column: string, value: unknown) { record.filters.push({ operator: "in", column, value }); return query; },
      order(column: string, options: { ascending?: boolean } = {}) { record.orders.push({ column, ascending: options.ascending ?? true }); return query; },
      maybeSingle() { record.singleResult = true; return Promise.resolve(responseFor(record)); },
      single() { record.singleResult = true; return Promise.resolve(responseFor(record)); },
      then(onfulfilled: (value: DbResponse) => unknown, onrejected?: (reason: unknown) => unknown) {
        return Promise.resolve(responseFor(record)).then(onfulfilled, onrejected);
      },
    };
    return query;
  });
}

describe("Supplier privacy and reads", () => {
  beforeEach(mockQueries);

  it("loads Owner and coordinator-managed Full Coordinator Supplier data with same-Wedding filters", async () => {
    const owner = await loadSupplierList(membership("OWNER"));
    expect(owner.kind).toBe("ready");
    mockQueries();
    const controller = await loadSupplierList(membership("FULL_COORDINATOR", true));
    expect(controller.kind).toBe("ready");
    for (const record of records.filter((item) => ["suppliers", "supplier_finance_totals"].includes(item.table))) {
      expect(record.filters).toContainEqual({ operator: "eq", column: "wedding_id", value: weddingId });
    }
  });

  it("does not query or display finance for Day-of or Guest Coordinators", async () => {
    expect(await loadSupplierList(membership("DAY_OF_COORDINATOR"))).toEqual({ kind: "private" });
    expect(from).not.toHaveBeenCalled();
    mockQueries();
    expect(await loadSupplierList(membership("GUEST_COORDINATOR"))).toEqual({ kind: "private" });
    expect(from).not.toHaveBeenCalled();
    mockQueries();
    expect(await loadSupplierDetails(membership("DAY_OF_COORDINATOR"), "supplier-a")).toEqual({ kind: "private" });
    expect(from).not.toHaveBeenCalled();
  });

  it("treats a missing finance witness or an RLS denial as private instead of an empty zero state", async () => {
    settings.missingWitness = true;
    expect(await loadSupplierList(membership())).toEqual({ kind: "private" });
    expect(records).toHaveLength(1);
    mockQueries();
    settings.permissionTables = ["suppliers"];
    expect(await loadSupplierList(membership())).toEqual({ kind: "private" });
  });

  it("maps Supplier finance totals from the canonical view and never reads legacy or transaction tables", async () => {
    const result = await loadSupplierList(membership());
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.data.suppliers[0]?.finance).toEqual({
      supplierId: "supplier-a",
      weddingId,
      committedAmount: 1500,
      scheduledAmount: 840,
      actualPaid: 275,
      remainingCommitment: 1225,
      overdueBalance: 140,
      unscheduledPaid: 35,
    });
    expect(records.map((record) => record.table)).toContain("supplier_finance_totals");
    expect(records.map((record) => record.table)).not.toEqual(expect.arrayContaining([
      "supplier_payments",
      "supplier_payment_transactions",
      "legacy_supplier_actual_amount",
      "legacy_supplier_payments",
    ]));
    expect(records.find((record) => record.table === "suppliers")?.columns).not.toContain("legacy_supplier_actual_amount");
  });
});

describe("Supplier details and cross-Wedding isolation", () => {
  beforeEach(mockQueries);

  it("loads scoped Budget Items and FINANCIAL_PRIVATE contract metadata without file locators", async () => {
    const result = await loadSupplierDetails(membership(), "supplier-a");
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.data.budgetItems).toEqual([{ ...budgetItemRow, categoryName: "Photo & Film" }]);
    expect(result.data.budgetItems[0]?.actual_amount).toBeNull();
    expect(result.data.finance.actualPaid).toBe(275);
    expect(result.data.contractDocuments[0]).toMatchObject({
      id: "attachment-a",
      original_filename: "Luntian-contract.pdf",
      content_type: "application/pdf",
      visibility: "FINANCIAL_PRIVATE",
    });
    expect(result.data.contractDocuments[0]).not.toHaveProperty("object_path");
    expect(records.find((record) => record.table === "budget_items")?.filters).toEqual(expect.arrayContaining([
      { operator: "eq", column: "wedding_id", value: weddingId },
      { operator: "eq", column: "supplier_id", value: "supplier-a" },
    ]));
    const attachmentQuery = records.find((record) => record.table === "attachments");
    expect(attachmentQuery?.filters).toEqual(expect.arrayContaining([
      { operator: "eq", column: "wedding_id", value: weddingId },
      { operator: "eq", column: "visibility", value: "FINANCIAL_PRIVATE" },
      { operator: "neq", column: "status", value: "DELETED" },
    ]));
  });

  it("rejects a Supplier ID outside the active Wedding before exposing detail or calling write RPCs", async () => {
    settings.unavailableSupplierId = "supplier-from-another-wedding";
    expect(await loadSupplierDetails(membership(), "supplier-from-another-wedding")).toEqual({ kind: "unavailable" });
    await expect(updateSupplier(membership(), "supplier-from-another-wedding", supplierDraft)).rejects.toMatchObject({ code: "22023" });
    await expect(setSupplierCommitment(membership(), "supplier-from-another-wedding", { amount: 10, committedOn: null, notes: null })).rejects.toMatchObject({ code: "22023" });
    expect(rpcCalls).toHaveLength(0);
    expect(records.filter((record) => record.table === "suppliers").every((record) => record.filters.some((filter) => filter.operator === "eq" && filter.column === "wedding_id" && filter.value === weddingId))).toBe(true);
  });

  it("does not present Supplier-linked Budget Items with a non-null manual actual", async () => {
    settings.actualAmountViolation = true;
    expect(await loadSupplierDetails(membership(), "supplier-a")).toEqual({ kind: "unavailable" });
  });

  it("rejects a linked Budget Item returned from another Wedding and hides an unavailable cross-Wedding attachment ID", async () => {
    settings.crossWeddingBudgetItem = true;
    expect(await loadSupplierDetails(membership(), "supplier-a")).toEqual({ kind: "unavailable" });
    mockQueries();
    settings.hideAttachment = true;
    const result = await loadSupplierDetails(membership(), "supplier-a");
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.data.contractDocuments).toEqual([]);
    const attachments = records.find((record) => record.table === "attachments");
    expect(attachments?.filters).toEqual(expect.arrayContaining([
      { operator: "eq", column: "wedding_id", value: weddingId },
      { operator: "in", column: "id", value: ["attachment-a"] },
    ]));
  });
});

describe("Supplier RPC mutations", () => {
  beforeEach(mockQueries);

  it("creates and edits Suppliers through the existing RPCs with normalized user input", async () => {
    await expect(createSupplier(membership(), supplierDraft)).resolves.toBe("supplier-created");
    expect(rpcCalls[0]?.name).toBe("create_supplier");
    expect(rpcCalls[0]?.args).toMatchObject({
      p_wedding_id: weddingId,
      p_name: "Luntian Studio",
      p_category: "Photo & Film",
      p_contact_name: "Mila Santos",
      p_email: "hello@example.com",
      p_phone: "+63 900 000 0000",
      p_website: "luntian.example",
      p_notes: "Capture ceremony and reception.",
      p_status: "PROSPECT",
    });

    await expect(updateSupplier(membership(), "supplier-a", supplierDraft)).resolves.toBe("supplier-a");
    expect(rpcCalls[1]?.name).toBe("update_supplier");
    expect(rpcCalls[1]?.args.p_supplier_id).toBe("supplier-a");
    expect(records.some((record) => record.operation !== "select")).toBe(false);
  });

  it("sends all five allowed lifecycle statuses to both create and update RPCs", async () => {
    for (const status of SUPPLIER_STATUSES) {
      await createSupplier(membership(), { ...supplierDraft, status });
      await updateSupplier(membership(), "supplier-a", { ...supplierDraft, status });
    }
    expect(rpcCalls.map((call) => call.args.p_status)).toEqual(SUPPLIER_STATUSES.flatMap((status) => [status, status]));
    expect(rpcCalls.map((call) => call.name)).toEqual(SUPPLIER_STATUSES.flatMap(() => ["create_supplier", "update_supplier"]));
  });

  it("validates required fields and email before any RPC submission", async () => {
    await expect(createSupplier(membership(), { ...supplierDraft, name: " " })).rejects.toMatchObject({ code: "SUPPLIER_VALIDATION" });
    await expect(createSupplier(membership(), { ...supplierDraft, category: " " })).rejects.toMatchObject({ code: "SUPPLIER_VALIDATION" });
    await expect(createSupplier(membership(), { ...supplierDraft, email: "bad-address" })).rejects.toMatchObject({ code: "SUPPLIER_VALIDATION" });
    await expect(createSupplier(membership(), { ...supplierDraft, status: "UNKNOWN" as never })).rejects.toMatchObject({ code: "SUPPLIER_VALIDATION" });
    expect(rpcCalls).toHaveLength(0);
  });

  it("sets, updates and clears a commitment through the nullable commitment RPC", async () => {
    await setSupplierCommitment(membership(), "supplier-a", { amount: 1200.5, committedOn: "2026-09-28", notes: "Initial" });
    await setSupplierCommitment(membership(), "supplier-a", { amount: 1400, committedOn: null, notes: "Revised contract" });
    await setSupplierCommitment(membership(), "supplier-a", { amount: null, committedOn: null, notes: null });

    expect(rpcCalls.map((call) => call.name)).toEqual([
      "set_supplier_commitment",
      "set_supplier_commitment",
      "set_supplier_commitment",
    ]);
    expect(rpcCalls.map((call) => call.args.p_amount)).toEqual([1200.5, 1400, null]);
    expect(rpcCalls[2]?.args).toEqual({ p_supplier_id: "supplier-a", p_amount: null, p_committed_on: null, p_notes: null });
    expect(records.some((record) => record.operation !== "select")).toBe(false);
  });

  it("rejects negative or invalid commitments before RPC and maps failures safely", async () => {
    await expect(setSupplierCommitment(membership(), "supplier-a", { amount: -1, committedOn: null, notes: null })).rejects.toMatchObject({ code: "SUPPLIER_VALIDATION" });
    await expect(setSupplierCommitment(membership(), "supplier-a", { amount: 10, committedOn: "2026-02-30", notes: null })).rejects.toMatchObject({ code: "SUPPLIER_VALIDATION" });
    expect(rpcCalls).toHaveLength(0);
    expect(safeSupplierError({ code: "SUPPLIER_VALIDATION", message: "Enter a valid commitment amount and date." })).toBe("Enter a valid commitment amount and date.");
  });
});
