import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingSupplierPayment } from "./model";
import {
  clearPendingSupplierPayment,
  readPendingSupplierPayment,
  savePendingSupplierPayment,
} from "./pending-attempt-store";

const { secureStore, values } = vi.hoisted(() => ({
  secureStore: {
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
  },
  values: new Map<string, string>(),
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => secureStore);

const attempt: PendingSupplierPayment = {
  version: 1,
  userId: "user-a",
  weddingId: "wedding-a",
  supplierId: "supplier-a",
  clientRequestId: "c4ec2a8a-12d7-40da-9e18-91f66b5ab627",
  amount: 10_000,
  paidAt: "2026-09-28T01:00:00.000Z",
  installmentId: "installment-a",
  budgetItemId: "item-a",
  paymentMethod: "transfer",
  referenceNumber: "ref-1",
  notes: "deposit",
};

describe("pending supplier payment persistence", () => {
  beforeEach(() => {
    values.clear();
    secureStore.getItemAsync.mockReset().mockImplementation(async (key: string) => values.get(key) ?? null);
    secureStore.setItemAsync.mockReset().mockImplementation(async (key: string, value: string) => { values.set(key, value); });
    secureStore.deleteItemAsync.mockReset().mockImplementation(async (key: string) => { values.delete(key); });
  });

  it("persists exact retry facts for recovery after the screen or app restarts", async () => {
    await savePendingSupplierPayment(attempt);
    const recovered = await readPendingSupplierPayment(attempt.userId);
    expect(recovered).toEqual({ kind: "pending", attempt });
    expect(secureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(secureStore.setItemAsync.mock.calls[0]?.[1]).toBe(JSON.stringify(attempt));
  });

  it("refuses to replace a different unresolved attempt and preserves unreadable data", async () => {
    await savePendingSupplierPayment(attempt);
    await expect(savePendingSupplierPayment({ ...attempt, notes: "changed" })).rejects.toMatchObject({ code: "PENDING_PAYMENT_EXISTS" });
    values.set("katipan.pending-supplier-payment.v1.user-a", "not valid JSON");
    expect(await readPendingSupplierPayment(attempt.userId)).toEqual({ kind: "unreadable" });
    await clearPendingSupplierPayment(attempt);
    expect(values.get("katipan.pending-supplier-payment.v1.user-a")).toBe("not valid JSON");
  });

  it("clears only the matching request key after a definitive outcome", async () => {
    await savePendingSupplierPayment(attempt);
    await clearPendingSupplierPayment({ ...attempt, clientRequestId: "e4ec2a8a-12d7-40da-9e18-91f66b5ab627" });
    expect(await readPendingSupplierPayment(attempt.userId)).toEqual({ kind: "pending", attempt });
    await clearPendingSupplierPayment(attempt);
    expect(await readPendingSupplierPayment(attempt.userId)).toEqual({ kind: "empty" });
  });
});
