import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManualCheckInAction, WeddingDayGuest } from "./model";
import {
  listQueuedManualWeddingDayActions,
  loadCachedWeddingDayRoster,
  queueManualWeddingDayAction,
  saveCachedWeddingDayRoster,
  setWeddingDayContext,
} from "./offline-store.web";

const userId = "70000000-0000-4000-8000-000000000001";
const weddingId = "10000000-0000-4000-8000-000000000001";
const otherWeddingId = "10000000-0000-4000-8000-000000000002";
const guestId = "30000000-0000-4000-8000-000000000001";
const clientEventId = "80000000-0000-4000-8000-000000000001";

function guest(overrides: Partial<WeddingDayGuest> = {}): WeddingDayGuest {
  return {
    guestId,
    displayName: "Alex Santos",
    householdId: "20000000-0000-4000-8000-000000000001",
    householdName: "Santos Household",
    rsvpStatus: "ATTENDING",
    isCheckedIn: false,
    tableSeatSummaries: ["Reception · Table 4 · Seat 2"],
    seatingAvailable: true,
    ...overrides,
  };
}

function action(): ManualCheckInAction {
  return {
    userId,
    weddingId,
    guestId,
    clientEventId,
    occurredAt: "2026-09-28T11:10:00.000Z",
  };
}

const entries = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => entries.get(key) ?? null,
  setItem: (key: string, value: string) => { entries.set(key, value); },
  removeItem: (key: string) => { entries.delete(key); },
  clear: () => entries.clear(),
  key: (index: number) => [...entries.keys()][index] ?? null,
  get length() { return entries.size; },
};

beforeEach(() => {
  entries.clear();
  vi.stubGlobal("localStorage", localStorageMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("web Wedding-Day offline store", () => {
  it("stores only the minimum roster fields", async () => {
    await setWeddingDayContext(userId, weddingId);
    await expect(saveCachedWeddingDayRoster(userId, weddingId, [guest()])).resolves.toBe(true);

    await expect(loadCachedWeddingDayRoster(userId, weddingId)).resolves.toEqual([{
      guestId,
      displayName: "Alex Santos",
      householdId: "20000000-0000-4000-8000-000000000001",
      householdName: "Santos Household",
      rsvpStatus: "ATTENDING",
      isCheckedIn: false,
      tableSeatSummaries: [],
      seatingAvailable: false,
    }]);
    const stored = [...entries.entries()].map(([key, value]) => `${key}:${value}`).join("\n");
    expect(stored).not.toContain("tableSeatSummaries");
    expect(stored).not.toContain("email");
    expect(stored).not.toContain("phone");
  });

  it("invalidates the prior Wedding roster and preserves an idempotent queue", async () => {
    await setWeddingDayContext(userId, weddingId);
    await saveCachedWeddingDayRoster(userId, weddingId, [guest()]);
    await queueManualWeddingDayAction(action());
    await queueManualWeddingDayAction(action());

    await setWeddingDayContext(userId, otherWeddingId);

    await expect(loadCachedWeddingDayRoster(userId, weddingId)).resolves.toEqual([]);
    await expect(listQueuedManualWeddingDayActions(userId, weddingId)).resolves.toEqual([action()]);
  });
});
