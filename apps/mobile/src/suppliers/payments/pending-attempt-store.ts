import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { isPendingSupplierPayment, type PendingSupplierPayment } from "./model";

export type PendingAttemptRead =
  | { kind: "empty" }
  | { kind: "pending"; attempt: PendingSupplierPayment }
  | { kind: "unreadable" };

function keyForUser(userId: string): string {
  return `katipan.pending-supplier-payment.v1.${userId}`;
}

async function getValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function setValue(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof globalThis.localStorage === "undefined") throw new Error("Secure payment retry storage is unavailable.");
    globalThis.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeValue(key: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof globalThis.localStorage === "undefined") throw new Error("Secure payment retry storage is unavailable.");
    globalThis.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function readPendingSupplierPayment(userId: string): Promise<PendingAttemptRead> {
  let saved: string | null;
  try {
    saved = await getValue(keyForUser(userId));
  } catch {
    return { kind: "unreadable" };
  }
  if (saved === null) return { kind: "empty" };
  try {
    const parsed: unknown = JSON.parse(saved);
    return isPendingSupplierPayment(parsed) && parsed.userId === userId
      ? { kind: "pending", attempt: parsed }
      : { kind: "unreadable" };
  } catch {
    return { kind: "unreadable" };
  }
}

export async function savePendingSupplierPayment(attempt: PendingSupplierPayment): Promise<void> {
  if (!isPendingSupplierPayment(attempt)) throw new Error("Payment retry facts are incomplete.");
  const key = keyForUser(attempt.userId);
  const existing = await getValue(key);
  const serialized = JSON.stringify(attempt);
  if (existing !== null && existing !== serialized) {
    throw Object.assign(new Error("A different payment attempt still needs a safe retry."), { code: "PENDING_PAYMENT_EXISTS" });
  }
  await setValue(key, serialized);
}

export async function clearPendingSupplierPayment(attempt: PendingSupplierPayment): Promise<void> {
  const key = keyForUser(attempt.userId);
  const existing = await getValue(key);
  if (existing === null) return;
  try {
    const parsed: unknown = JSON.parse(existing);
    if (isPendingSupplierPayment(parsed) && parsed.clientRequestId === attempt.clientRequestId) {
      await removeValue(key);
    }
  } catch {
    // Keep unreadable state. A malformed or ambiguous request is never discarded silently.
  }
}
