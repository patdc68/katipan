import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership, WorkspaceRole } from "../../workspace/model";
import {
  cancelSupplierInstallment,
  createSupplierInstallment,
  deleteSupplierPaymentReceipt,
  loadSupplierPaymentDetails,
  loadSupplierPaymentSchedule,
  openSupplierPaymentReceipt,
  recordSupplierPayment,
  refreshSupplierFinanceAggregates,
  reverseSupplierPayment,
  updateSupplierInstallment,
  uploadSupplierPaymentReceipt,
} from "./api";
import { createPendingSupplierPayment } from "./model";

type QueryRecord = {
  table: string;
  filters: { operator: string; column: string; value: unknown }[];
  operation: "select" | "insert" | "update" | "delete";
  write: unknown;
  singleResult: boolean;
};

const { from, rpc, upload, createSignedUrl, records, rpcCalls, settings } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  records: [] as QueryRecord[],
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  settings: {
    permissionTables: [] as string[],
    missingWitness: false,
    crossWeddingSupplier: false,
    crossWeddingBudgetItem: false,
    crossWeddingInstallment: false,
    crossWeddingPayment: false,
    crossWeddingAttachment: false,
    rpcFailure: null as { code?: string; status?: number; message?: string } | null,
    reversalPresent: true,
  },
}));

vi.mock("../../auth/client", () => ({
  supabase: {
    from,
    rpc,
    storage: { from: vi.fn(() => ({ upload, createSignedUrl })) },
  },
}));

const weddingId = "wedding-a";
const supplierId = "supplier-a";
const installmentId = "installment-a";
const budgetItemId = "item-a";
const paymentId = "payment-a";
const receiptId = "receipt-a";

const supplierRow = {
  id: supplierId, wedding_id: weddingId, name: "Luntian Studio", category: "Photography",
  contact_name: null, email: null, phone: null, website: null, notes: null, status: "BOOKED",
  committed_amount: 50_000, committed_on: null, commitment_notes: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};
const financeRow = {
  supplier_id: supplierId, wedding_id: weddingId, committed_amount: 50_000, scheduled_amount: 30_000,
  actual_paid: 10_000, remaining_commitment: 40_000, overdue_balance: 0, unscheduled_paid: 0,
};
const budgetItemRow = { id: budgetItemId, wedding_id: weddingId, supplier_id: supplierId, name: "Photography" };
const scheduleRow = {
  id: installmentId, wedding_id: weddingId, supplier_id: supplierId, budget_item_id: budgetItemId,
  amount: 30_000, due_date: "2026-10-01", notes: "Milestone", cancelled_at: null,
  paid_amount: 10_000, unpaid_balance: 20_000, status: "PARTIALLY_PAID",
};
const paymentRow = {
  id: paymentId, wedding_id: weddingId, supplier_id: supplierId, installment_id: installmentId,
  budget_item_id: budgetItemId, kind: "PAYMENT", source: "MANUAL", amount: 10_000,
  paid_at: "2026-09-28T01:00:00Z", payment_method: "Bank transfer", reference_number: "REF-1",
  notes: "Deposit", recorded_by_user_id: "user-a", reverses_transaction_id: null, created_at: "2026-09-28T01:00:00Z",
};
const reversalRow = {
  ...paymentRow, id: "reversal-a", installment_id: null, budget_item_id: null,
  kind: "REVERSAL", amount: 10_000, payment_method: null, reference_number: null,
  notes: "Duplicate", reverses_transaction_id: paymentId,
};
const receiptLinkRow = { wedding_id: weddingId, payment_id: paymentId, attachment_id: receiptId, created_at: "2026-09-28T02:00:00Z" };
const receiptRow = {
  id: receiptId, wedding_id: weddingId, original_filename: "receipt.pdf", content_type: "application/pdf",
  size_bytes: 1024, visibility: "FINANCIAL_PRIVATE", status: "AVAILABLE", bucket_id: "wedding-files",
  object_path: "wedding-a/receipt/opaque.pdf", updated_at: "2026-09-28T02:00:00Z",
};

function membership(role: WorkspaceRole = "OWNER", coordinatorManaged = false): WorkspaceMembership {
  return {
    membershipId: `membership-${role}`, weddingId, userId: "user-a", role, status: "ACTIVE",
    partnerNames: ["Juan", "Maria"],
    wedding: {
      id: weddingId, display_name: "Juan & Maria", wedding_date: null, general_location: "Manila",
      status: "ACTIVE", origin: coordinatorManaged ? "COORDINATOR_CREATED" : "COUPLE_CREATED",
      ownership_mode: coordinatorManaged ? "COORDINATOR_MANAGED" : "COUPLE_OWNED",
    },
  };
}

function matches(row: Record<string, unknown>, filters: QueryRecord["filters"]): boolean {
  return filters.every((filter) => {
    if (filter.operator === "limit") return true;
    if (filter.operator === "in") return (filter.value as unknown[]).includes(row[filter.column]);
    if (filter.operator === "is") return row[filter.column] === filter.value;
    if (filter.operator === "neq") return row[filter.column] !== filter.value;
    return row[filter.column] === filter.value;
  });
}

function baseRows(table: string): Record<string, unknown>[] {
  switch (table) {
    case "wedding_budget_totals": return settings.missingWitness ? [] : [{ wedding_id: weddingId, currency_code: "PHP", actual_total: 10_000, supplier_actual_total: 10_000 }];
    case "wedding_payment_totals": return [{ wedding_id: weddingId, paid_total: 10_000, scheduled_total: 30_000 }];
    case "suppliers": return [settings.crossWeddingSupplier ? { ...supplierRow, wedding_id: "wedding-b" } : supplierRow];
    case "supplier_finance_totals": return [financeRow];
    case "supplier_installment_schedule": return [settings.crossWeddingInstallment ? { ...scheduleRow, wedding_id: "wedding-b" } : scheduleRow];
    case "supplier_installments": return [{ ...scheduleRow }];
    case "budget_items": return [settings.crossWeddingBudgetItem ? { ...budgetItemRow, wedding_id: "wedding-b" } : budgetItemRow];
    case "supplier_payment_transactions": return [
      ...(settings.crossWeddingPayment ? [{ ...paymentRow, wedding_id: "wedding-b" }] : [paymentRow]),
      ...(settings.reversalPresent && !settings.crossWeddingPayment ? [reversalRow] : []),
    ];
    case "payment_receipt_attachments": return [receiptLinkRow];
    case "attachments": return [settings.crossWeddingAttachment ? { ...receiptRow, wedding_id: "wedding-b" } : receiptRow];
    default: return [];
  }
}

function responseFor(record: QueryRecord) {
  if (settings.permissionTables.includes(record.table)) return { data: null, error: { code: "42501", message: "denied" } };
  if (record.operation === "update") {
    const target = baseRows(record.table).find((row) => matches(row, record.filters));
    return target
      ? { data: { ...target, ...(record.write as Record<string, unknown>) }, error: null }
      : { data: null, error: null };
  }
  const rows = baseRows(record.table).filter((row) => matches(row, record.filters));
  return { data: record.singleResult ? rows[0] ?? null : rows, error: null };
}

function resetMocks() {
  records.splice(0);
  rpcCalls.splice(0);
  Object.assign(settings, {
    permissionTables: [], missingWitness: false, crossWeddingSupplier: false, crossWeddingBudgetItem: false,
    crossWeddingInstallment: false, crossWeddingPayment: false, crossWeddingAttachment: false,
    rpcFailure: null, reversalPresent: true,
  });
  from.mockReset();
  rpc.mockReset();
  upload.mockReset();
  createSignedUrl.mockReset();
  upload.mockResolvedValue({ data: {}, error: null });
  createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/receipt" }, error: null });
  rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args });
    if (settings.rpcFailure) return Promise.resolve({ data: null, error: settings.rpcFailure });
    if (name === "reserve_attachment") return Promise.resolve({ data: [{ attachment_id: receiptId, bucket_id: "wedding-files", object_path: receiptRow.object_path }], error: null });
    const ids: Record<string, string> = {
      create_supplier_installment: "installment-created",
      record_supplier_payment: paymentId,
      reverse_supplier_payment: "reversal-created",
    };
    return Promise.resolve({ data: ids[name] ?? null, error: null });
  });
  from.mockImplementation((table: string) => {
    const record: QueryRecord = { table, filters: [], operation: "select", write: null, singleResult: false };
    records.push(record);
    const query = {
      select() { return query; },
      insert(value: unknown) { record.operation = "insert"; record.write = value; return query; },
      update(value: unknown) { record.operation = "update"; record.write = value; return query; },
      delete() { record.operation = "delete"; return query; },
      eq(column: string, value: unknown) { record.filters.push({ operator: "eq", column, value }); return query; },
      neq(column: string, value: unknown) { record.filters.push({ operator: "neq", column, value }); return query; },
      in(column: string, value: unknown) { record.filters.push({ operator: "in", column, value }); return query; },
      is(column: string, value: unknown) { record.filters.push({ operator: "is", column, value }); return query; },
      order() { return query; },
      limit(value: number) { record.filters.push({ operator: "limit", column: "", value }); return query; },
      maybeSingle() { record.singleResult = true; return Promise.resolve(responseFor(record)); },
      single() { record.singleResult = true; return Promise.resolve(responseFor(record)); },
      then(onfulfilled: (value: ReturnType<typeof responseFor>) => unknown, onrejected?: (reason: unknown) => unknown) {
        return Promise.resolve(responseFor(record)).then(onfulfilled, onrejected);
      },
    };
    return query;
  });
}

function paymentAttempt(role: WorkspaceRole = "OWNER") {
  return createPendingSupplierPayment(
    { amount: 10_000, paidAt: "2026-09-28T01:00:00.000Z", installmentId, budgetItemId, paymentMethod: "transfer", referenceNumber: "ref-1", notes: "deposit" },
    { userId: "user-a", weddingId, supplierId },
    () => "c4ec2a8a-12d7-40da-9e18-91f66b5ab627",
    () => "2026-09-28T01:00:00.000Z",
  );
}

describe("supplier finance API and authorization", () => {
  beforeEach(resetMocks);

  it("allows Owner and Full Coordinator reads and rejects Day-of and Guest Coordinator without fake zero totals", async () => {
    expect((await loadSupplierPaymentSchedule(membership("OWNER"), supplierId)).kind).toBe("ready");
    resetMocks();
    expect((await loadSupplierPaymentSchedule(membership("FULL_COORDINATOR", true), supplierId)).kind).toBe("ready");
    resetMocks();
    expect(await loadSupplierPaymentSchedule(membership("DAY_OF_COORDINATOR"), supplierId)).toEqual({ kind: "private" });
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    resetMocks();
    expect(await loadSupplierPaymentSchedule(membership("GUEST_COORDINATOR"), supplierId)).toEqual({ kind: "private" });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns private if the canonical finance witness is absent or denied", async () => {
    settings.missingWitness = true;
    expect(await loadSupplierPaymentSchedule(membership(), supplierId)).toEqual({ kind: "private" });
    resetMocks();
    settings.permissionTables = ["wedding_budget_totals"];
    expect(await loadSupplierPaymentSchedule(membership(), supplierId)).toEqual({ kind: "private" });
  });

  it("loads server-derived schedule states, partial balances, recent payments and same-Wedding filters", async () => {
    const result = await loadSupplierPaymentSchedule(membership(), supplierId);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.data.installments[0]).toMatchObject({ amount: 30_000, paidAmount: 10_000, unpaidBalance: 20_000, status: "PARTIALLY_PAID", budgetItemName: "Photography" });
    expect(result.data.recentPayments[0]).toMatchObject({ id: paymentId, amount: 10_000, reversed: true });
    expect(records.filter((row) => ["supplier_installment_schedule", "supplier_payment_transactions", "supplier_finance_totals"].includes(row.table))
      .every((row) => row.filters.some((filter) => filter.column === "wedding_id" && filter.value === weddingId))
    ).toBe(true);
    expect(records.map((row) => row.table)).not.toEqual(expect.arrayContaining(["supplier_payments", "legacy_supplier_actual_amount"]));
  });

  it("creates installments through the canonical RPC and only edits/cancels allowed fields", async () => {
    const draft = { amount: "30000", dueDate: "2026-10-01", budgetItemId, notes: "Milestone" };
    await expect(createSupplierInstallment(membership(), supplierId, draft)).resolves.toBe("installment-created");
    expect(rpcCalls[0]).toEqual({ name: "create_supplier_installment", args: {
      p_wedding_id: weddingId, p_supplier_id: supplierId, p_budget_item_id: budgetItemId,
      p_amount: 30_000, p_due_date: "2026-10-01", p_notes: "Milestone",
    } });
    resetMocks();
    await updateSupplierInstallment(membership(), supplierId, installmentId, draft, [{ ...budgetItemRow }]);
    const edit = records.find((row) => row.table === "supplier_installments");
    expect(edit?.operation).toBe("update");
    expect(edit?.write).toEqual({ budget_item_id: budgetItemId, amount: 30_000, due_date: "2026-10-01", notes: "Milestone" });
    expect(Object.keys(edit?.write as object).sort()).toEqual(["amount", "budget_item_id", "due_date", "notes"]);
    expect(records.some((row) => row.operation === "delete")).toBe(false);
    resetMocks();
    await cancelSupplierInstallment(membership(), supplierId, installmentId, () => "2026-09-28T03:00:00.000Z");
    expect(records.find((row) => row.table === "supplier_installments")?.write).toEqual({ cancelled_at: "2026-09-28T03:00:00.000Z" });
    expect(records.some((row) => row.operation === "delete")).toBe(false);
  });

  it("refuses cross-Wedding Supplier and role writes before any mutation", async () => {
    settings.crossWeddingSupplier = true;
    await expect(createSupplierInstallment(membership(), supplierId, { amount: "100", dueDate: "2026-10-01", budgetItemId: null, notes: "" })).rejects.toMatchObject({ code: "22023" });
    expect(rpcCalls).toHaveLength(0);
    resetMocks();
    for (const role of ["DAY_OF_COORDINATOR", "GUEST_COORDINATOR"] as const) {
      await expect(createSupplierInstallment(membership(role), supplierId, { amount: "100", dueDate: "2026-10-01", budgetItemId: null, notes: "" })).rejects.toMatchObject({ code: "42501" });
    }
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects cross-Wedding Budget Items, installments and payments without exposing their records", async () => {
    settings.crossWeddingBudgetItem = true;
    await expect(createSupplierInstallment(membership(), supplierId, { amount: "100", dueDate: "2026-10-01", budgetItemId, notes: "" })).rejects.toMatchObject({ code: "23503" });
    expect(rpcCalls).toHaveLength(0);
    resetMocks();
    settings.crossWeddingInstallment = true;
    expect(await loadSupplierPaymentDetails(membership(), supplierId, paymentId)).toEqual({ kind: "unavailable" });
    expect(records.find((row) => row.table === "supplier_installment_schedule")?.filters).toEqual(expect.arrayContaining([
      { operator: "eq", column: "wedding_id", value: weddingId },
      { operator: "eq", column: "supplier_id", value: supplierId },
      { operator: "eq", column: "id", value: installmentId },
    ]));
    resetMocks();
    settings.crossWeddingPayment = true;
    expect(await loadSupplierPaymentDetails(membership(), supplierId, paymentId)).toEqual({ kind: "unavailable" });
    expect(records.find((row) => row.table === "supplier_payment_transactions")?.filters).toEqual(expect.arrayContaining([
      { operator: "eq", column: "wedding_id", value: weddingId },
      { operator: "eq", column: "supplier_id", value: supplierId },
      { operator: "eq", column: "id", value: paymentId },
    ]));
  });

  it("does not return another Wedding's receipt metadata", async () => {
    settings.crossWeddingAttachment = true;
    const result = await loadSupplierPaymentDetails(membership(), supplierId, paymentId);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.data.receipts).toEqual([]);
    expect(records.find((row) => row.table === "attachments")?.filters).toContainEqual({ operator: "eq", column: "wedding_id", value: weddingId });
  });

  it("creates new actual payments only through the idempotent RPC and exactly replays the same attempt facts", async () => {
    const attempt = paymentAttempt();
    await expect(recordSupplierPayment(membership(), attempt)).resolves.toBe(paymentId);
    const exactArgs = rpcCalls[0]?.args;
    await expect(recordSupplierPayment(membership(), attempt)).resolves.toBe(paymentId);
    expect(rpcCalls.map((call) => call.name)).toEqual(["record_supplier_payment", "record_supplier_payment"]);
    expect(rpcCalls[1]?.args).toEqual(exactArgs);
    expect(exactArgs).toMatchObject({
      p_wedding_id: weddingId, p_supplier_id: supplierId, p_installment_id: installmentId,
      p_budget_item_id: budgetItemId, p_amount: 10_000,
      p_client_request_id: "c4ec2a8a-12d7-40da-9e18-91f66b5ab627",
      p_paid_at: "2026-09-28T01:00:00.000Z",
    });
    expect(records.some((row) => row.table === "supplier_payment_transactions" && row.operation !== "select")).toBe(false);
    resetMocks();
    await expect(recordSupplierPayment(membership(), { ...attempt, weddingId: "wedding-b" })).rejects.toMatchObject({ code: "42501" });
    expect(rpcCalls).toHaveLength(0);
  });

  it("allows an explicit unscheduled payment and does not invent an installment", async () => {
    const attempt = createPendingSupplierPayment(
      { amount: 500, paidAt: "2026-09-28T01:00:00.000Z", installmentId: null, budgetItemId: null, paymentMethod: null, referenceNumber: null, notes: null },
      { userId: "user-a", weddingId, supplierId },
      () => "c4ec2a8a-12d7-40da-9e18-91f66b5ab627",
      () => "2026-09-28T01:00:00.000Z",
    );
    await recordSupplierPayment(membership(), attempt);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.args.p_installment_id).toBeNull();
    expect(records.some((row) => row.table === "supplier_installments" && row.operation !== "select")).toBe(false);
  });

  it("confines reversed-payment details and receipt metadata to the active Wedding PAYMENT", async () => {
    const result = await loadSupplierPaymentDetails(membership(), supplierId, paymentId);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.data.payment).toMatchObject({ kind: "PAYMENT", reversed: true, amount: 10_000, payment_method: "Bank transfer" });
    expect(result.data.reversal).toMatchObject({ kind: "REVERSAL", reverses_transaction_id: paymentId, notes: "Duplicate" });
    expect(result.data.installment).toMatchObject({ id: installmentId, status: "PARTIALLY_PAID" });
    expect(result.data.budgetItem).toMatchObject({ id: budgetItemId, name: "Photography" });
    expect(result.data.receipts).toEqual([receiptRow]);
    expect(records.find((row) => row.table === "attachments")?.filters).toEqual(expect.arrayContaining([
      { operator: "eq", column: "wedding_id", value: weddingId },
      { operator: "eq", column: "visibility", value: "FINANCIAL_PRIVATE" },
      { operator: "eq", column: "status", value: "AVAILABLE" },
    ]));
  });

  it("creates one explicit reversal RPC with a non-empty reason and never updates or deletes the ledger", async () => {
    await expect(reverseSupplierPayment(membership(), supplierId, paymentId, "  Duplicate entry  ")).resolves.toBe("reversal-created");
    expect(rpcCalls).toEqual([{ name: "reverse_supplier_payment", args: { p_payment_id: paymentId, p_reason: "Duplicate entry" } }]);
    expect(records.some((row) => row.table === "supplier_payment_transactions" && row.operation !== "select")).toBe(false);
    resetMocks();
    await expect(reverseSupplierPayment(membership(), supplierId, paymentId, "  ")).rejects.toMatchObject({ code: "23514" });
    expect(rpcCalls).toHaveLength(0);
  });

  it("uses authoritative Supplier, Wedding payment and Budget aggregates after mutations", async () => {
    await refreshSupplierFinanceAggregates(membership(), supplierId);
    expect(records.map((row) => row.table)).toEqual(expect.arrayContaining([
      "supplier_installment_schedule", "supplier_finance_totals", "wedding_payment_totals", "wedding_budget_totals",
    ]));
    expect(records.filter((row) => ["supplier_installment_schedule", "supplier_finance_totals", "wedding_payment_totals", "wedding_budget_totals"].includes(row.table))
      .every((row) => row.filters.some((filter) => filter.column === "wedding_id" && filter.value === weddingId))
    ).toBe(true);
  });

  it("reserves, uploads the exact private object, confirms, then links a receipt only to PAYMENT", async () => {
    const id = await uploadSupplierPaymentReceipt(membership(), supplierId, paymentId, {
      name: "receipt.pdf", contentType: "application/pdf", bytes: new Uint8Array([1, 2, 3]).buffer,
    });
    expect(id).toBe(receiptId);
    expect(rpcCalls.map((call) => call.name)).toEqual(["reserve_attachment", "confirm_attachment_uploaded", "link_payment_receipt_attachment"]);
    expect(rpcCalls[0]?.args).toEqual({ p_wedding_id: weddingId, p_original_filename: "receipt.pdf", p_content_type: "application/pdf", p_visibility: "FINANCIAL_PRIVATE" });
    expect(upload).toHaveBeenCalledWith(receiptRow.object_path, expect.any(ArrayBuffer), { contentType: "application/pdf", upsert: false });
    expect(rpcCalls[1]?.args).toEqual({ p_attachment_id: receiptId, p_size_bytes: 3 });
    expect(rpcCalls[2]?.args).toEqual({ p_payment_id: paymentId, p_attachment_id: receiptId });
    resetMocks();
    await expect(uploadSupplierPaymentReceipt(membership(), supplierId, "reversal-a", {
      name: "receipt.pdf", contentType: "application/pdf", bytes: new Uint8Array([1]).buffer,
    })).rejects.toMatchObject({ code: "22023" });
    expect(rpcCalls).toHaveLength(0);
  });

  it("opens a short-lived private signed URL and logically deletes evidence", async () => {
    await expect(openSupplierPaymentReceipt(membership(), supplierId, paymentId, receiptId)).resolves.toBe("https://signed.example/receipt");
    expect(createSignedUrl).toHaveBeenCalledWith(receiptRow.object_path, 60);
    await deleteSupplierPaymentReceipt(membership(), supplierId, paymentId, receiptId);
    expect(rpcCalls.at(-1)).toEqual({ name: "mark_attachment_deleted", args: { p_attachment_id: receiptId } });
  });
});
