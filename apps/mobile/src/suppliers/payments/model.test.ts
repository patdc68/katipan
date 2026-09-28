import { describe, expect, it, vi } from "vitest";
import type { Database } from "@katipan/database/types";
import {
  INSTALLMENT_STATUSES,
  createPendingSupplierPayment,
  installmentStatusLabel,
  isDefinitivePaymentRejection,
  isPendingSupplierPayment,
  mapSupplierInstallment,
  pendingPaymentRpcArgs,
  safeSupplierPaymentError,
  validateInstallmentDraft,
  validatePaymentDraft,
} from "./model";

type ScheduleRow = Database["public"]["Views"]["supplier_installment_schedule"]["Row"];

const weddingId = "wedding-juan-maria";
const supplierId = "supplier-luntian";
const installmentId = "installment-1";
const itemId = "budget-item-1";

function scheduleRow(status: string): ScheduleRow {
  return {
    id: installmentId,
    wedding_id: weddingId,
    supplier_id: supplierId,
    budget_item_id: itemId,
    amount: 30_000,
    due_date: "2026-10-01",
    notes: "Second milestone",
    cancelled_at: status === "CANCELLED" ? "2026-09-28T00:00:00Z" : null,
    paid_amount: status === "PARTIALLY_PAID" ? 10_000 : status === "PAID" ? 30_000 : 0,
    unpaid_balance: status === "PARTIALLY_PAID" ? 20_000 : status === "PAID" || status === "CANCELLED" ? 0 : 30_000,
    status,
  } as ScheduleRow;
}

const activeInstallment = mapSupplierInstallment(scheduleRow("PARTIALLY_PAID"), weddingId, supplierId)!;
const paymentContext = {
  installments: [activeInstallment],
  budgetItems: [{ id: itemId }],
};

describe("supplier payment model", () => {
  it("maps all authoritative installment schedule statuses without deriving them on the client", () => {
    expect(INSTALLMENT_STATUSES).toEqual(["PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]);
    expect(INSTALLMENT_STATUSES.map((status) => mapSupplierInstallment(scheduleRow(status), weddingId, supplierId)?.status)).toEqual(INSTALLMENT_STATUSES);
    expect(installmentStatusLabel("PARTIALLY_PAID")).toBe("Partially paid");
    expect(mapSupplierInstallment(scheduleRow("SOMETHING_ELSE"), weddingId, supplierId)).toBeNull();
    expect(mapSupplierInstallment(scheduleRow("PAID"), "another-wedding", supplierId)).toBeNull();
  });

  it("validates a required positive installment amount/date and same-Supplier Budget Item choice", () => {
    expect(validateInstallmentDraft({ amount: "30000", dueDate: "2026-10-01", budgetItemId: itemId, notes: " milestone " }, [{ id: itemId }])).toEqual({
      ok: true,
      value: { amount: 30_000, dueDate: "2026-10-01", budgetItemId: itemId, notes: "milestone" },
    });
    expect(validateInstallmentDraft({ amount: "0", dueDate: "2026-10-01", budgetItemId: null, notes: "" }, [])).toMatchObject({ ok: false, field: "amount" });
    expect(validateInstallmentDraft({ amount: "10", dueDate: "", budgetItemId: null, notes: "" }, [])).toMatchObject({ ok: false, field: "dueDate" });
    expect(validateInstallmentDraft({ amount: "10", dueDate: "2026-10-01", budgetItemId: itemId, notes: "" }, [])).toMatchObject({ ok: false, field: "budgetItemId" });
  });

  it("requires an explicit schedule target and supports partial and truly unscheduled payments", () => {
    const base = { amount: "10000", paidAt: "2026-09-28T09:00:00+08:00", installmentId: null, budgetItemId: null, paymentMethod: " transfer ", referenceNumber: " 123 ", notes: " first " };
    expect(validatePaymentDraft({ ...base, targetChoice: "UNSELECTED" }, paymentContext)).toMatchObject({ ok: false, field: "targetChoice" });
    const partial = validatePaymentDraft({ ...base, targetChoice: "INSTALLMENT", installmentId, budgetItemId: itemId }, paymentContext);
    expect(partial).toEqual({ ok: true, value: {
      amount: 10_000,
      paidAt: "2026-09-28T01:00:00.000Z",
      installmentId,
      budgetItemId: itemId,
      paymentMethod: "transfer",
      referenceNumber: "123",
      notes: "first",
    } });
    const unscheduled = validatePaymentDraft({ ...base, targetChoice: "UNSCHEDULED" }, paymentContext);
    expect(unscheduled).toMatchObject({ ok: true, value: { amount: 10_000, installmentId: null } });
    expect(validatePaymentDraft({ ...base, targetChoice: "INSTALLMENT", installmentId: "other" }, paymentContext)).toMatchObject({ ok: false, field: "installmentId" });
    expect(validatePaymentDraft({ ...base, targetChoice: "INSTALLMENT", installmentId }, { ...paymentContext, installments: [mapSupplierInstallment(scheduleRow("CANCELLED"), weddingId, supplierId)!] })).toMatchObject({ ok: false, field: "installmentId" });
  });

  it("creates exactly one request UUID and one timestamp for one action, then freezes the complete retry facts", () => {
    const createUuid = vi.fn(() => "c4ec2a8a-12d7-40da-9e18-91f66b5ab627");
    const now = vi.fn(() => "2026-09-28T01:00:00.000Z");
    const facts = { amount: 10_000, paidAt: null, installmentId, budgetItemId: itemId, paymentMethod: "transfer", referenceNumber: "123", notes: "first" };
    const attempt = createPendingSupplierPayment(facts, { userId: "user-1", weddingId, supplierId }, createUuid, now);
    expect(createUuid).toHaveBeenCalledTimes(1);
    expect(now).toHaveBeenCalledTimes(1);
    const retry = attempt;
    expect(retry).toBe(attempt);
    expect(pendingPaymentRpcArgs(retry)).toEqual(pendingPaymentRpcArgs(attempt));
    expect(pendingPaymentRpcArgs(attempt)).toEqual({
      p_wedding_id: weddingId,
      p_supplier_id: supplierId,
      p_installment_id: installmentId,
      p_budget_item_id: itemId,
      p_amount: 10_000,
      p_paid_at: "2026-09-28T01:00:00.000Z",
      p_client_request_id: "c4ec2a8a-12d7-40da-9e18-91f66b5ab627",
      p_payment_method: "transfer",
      p_reference_number: "123",
      p_notes: "first",
    });
    expect(isPendingSupplierPayment(JSON.parse(JSON.stringify(attempt)))).toBe(true);
    expect(createPendingSupplierPayment({ ...facts, paidAt: "2026-09-28T02:00:00Z" }, { userId: "user-1", weddingId, supplierId }, createUuid, now).paidAt).toBe("2026-09-28T02:00:00Z");
    expect(now).toHaveBeenCalledTimes(1);
  });

  it("distinguishes ambiguous transport outcomes from definitive rejections and maps conflicts safely", () => {
    expect(isDefinitivePaymentRejection({ code: "08006" })).toBe(false);
    expect(isDefinitivePaymentRejection(new TypeError("network timeout"))).toBe(false);
    expect(isDefinitivePaymentRejection({ status: 503 })).toBe(false);
    expect(isDefinitivePaymentRejection({ status: 422 })).toBe(true);
    expect(isDefinitivePaymentRejection({ code: "23514" })).toBe(true);
    expect(safeSupplierPaymentError({ code: "22023", message: "request id has different facts" })).toContain("key conflicts");
  });
});
