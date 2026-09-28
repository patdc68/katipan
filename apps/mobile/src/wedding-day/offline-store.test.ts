import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManualCheckInAction, WeddingDayGuest } from "./model";
import {
  hasCachedWeddingDayGuest,
  listQueuedManualWeddingDayActions,
  loadCachedWeddingDayRoster,
  queueManualWeddingDayAction,
  removeQueuedManualWeddingDayAction,
  saveCachedWeddingDayRoster,
  setWeddingDayContext,
} from "./offline-store";

type CachedRow = {
  user_id: string;
  wedding_id: string;
  guest_id: string;
  display_name: string;
  household_id: string;
  household_name: string;
  rsvp_status: WeddingDayGuest["rsvpStatus"];
  is_checked_in: number;
};
type QueueRow = {
  user_id: string;
  wedding_id: string;
  guest_id: string;
  client_event_id: string;
  occurred_at: string;
};

const dbState = vi.hoisted(() => ({
  context: null as { user_id: string; wedding_id: string } | null,
  roster: [] as CachedRow[],
  queue: [] as QueueRow[],
  database: {} as Record<string, unknown>,
}));

dbState.database = {
  execAsync: vi.fn(async () => undefined),
  withExclusiveTransactionAsync: vi.fn(async (task: (transaction: Record<string, unknown>) => Promise<void>) => task(dbState.database)),
  getAllAsync: vi.fn(async (sql: string, ...values: unknown[]) => {
    if (sql.includes("FROM wedding_day_active_context")) return dbState.context ? [{ ...dbState.context }] : [];
    if (sql.includes("FROM wedding_day_cached_guests")) {
      const [userId, weddingId, guestId] = values;
      const rows = dbState.roster.filter((row) => row.user_id === userId && row.wedding_id === weddingId
        && (typeof guestId !== "string" || row.guest_id === guestId));
      return sql.includes("LIMIT 1") ? rows.slice(0, 1).map((row) => ({ guest_id: row.guest_id })) : rows.map((row) => ({ ...row }));
    }
    if (sql.includes("FROM wedding_day_manual_queue")) {
      const [userId, weddingId] = values;
      return dbState.queue.filter((row) => row.user_id === userId && row.wedding_id === weddingId)
        .map((row) => ({ ...row }));
    }
    return [];
  }),
  runAsync: vi.fn(async (sql: string, ...values: unknown[]) => {
    if (sql === "DELETE FROM wedding_day_cached_guests") dbState.roster = [];
    else if (sql.includes("DELETE FROM wedding_day_cached_guests WHERE")) {
      const [userId, weddingId] = values;
      dbState.roster = dbState.roster.filter((row) => row.user_id !== userId || row.wedding_id !== weddingId);
    } else if (sql.includes("INSERT OR REPLACE INTO wedding_day_active_context")) {
      const [userId, weddingId] = values;
      dbState.context = { user_id: String(userId), wedding_id: String(weddingId) };
    } else if (sql.includes("INSERT INTO wedding_day_cached_guests")) {
      const [userId, weddingId, guestId, displayName, householdId, householdName, rsvpStatus, isCheckedIn] = values;
      dbState.roster.push({
        user_id: String(userId), wedding_id: String(weddingId), guest_id: String(guestId),
        display_name: String(displayName), household_id: String(householdId), household_name: String(householdName),
        rsvp_status: rsvpStatus as WeddingDayGuest["rsvpStatus"], is_checked_in: Number(isCheckedIn),
      });
    } else if (sql.includes("INSERT OR IGNORE INTO wedding_day_manual_queue")) {
      const [userId, weddingId, guestId, clientEventId, occurredAt] = values;
      const duplicate = dbState.queue.some((row) => row.user_id === userId && row.wedding_id === weddingId && row.client_event_id === clientEventId);
      if (!duplicate) dbState.queue.push({
        user_id: String(userId), wedding_id: String(weddingId), guest_id: String(guestId),
        client_event_id: String(clientEventId), occurred_at: String(occurredAt),
      });
    } else if (sql.includes("DELETE FROM wedding_day_manual_queue")) {
      const [userId, weddingId, clientEventId] = values;
      dbState.queue = dbState.queue.filter((row) => row.user_id !== userId || row.wedding_id !== weddingId || row.client_event_id !== clientEventId);
    }
    return { changes: 1, lastInsertRowId: 1 };
  }),
};

vi.mock("expo-sqlite", () => ({ openDatabaseAsync: vi.fn(async () => dbState.database) }));

const userId = "70000000-0000-4000-8000-000000000001";
const otherUserId = "70000000-0000-4000-8000-000000000002";
const weddingId = "10000000-0000-4000-8000-000000000001";
const otherWeddingId = "10000000-0000-4000-8000-000000000002";
const guestId = "30000000-0000-4000-8000-000000000001";
const clientEventId = "80000000-0000-4000-8000-000000000001";

function rosterGuest(): WeddingDayGuest {
  return {
    guestId,
    displayName: "Alex Santos",
    householdId: "20000000-0000-4000-8000-000000000001",
    householdName: "Santos Household",
    rsvpStatus: "ATTENDING",
    isCheckedIn: false,
    tableSeatSummaries: ["Reception · Table 4 · Seat 2"],
    seatingAvailable: true,
  };
}

function pendingAction(occurredAt = "2026-09-28T11:10:00.000Z"): ManualCheckInAction {
  return { userId, weddingId, guestId, clientEventId, occurredAt };
}

beforeEach(() => {
  dbState.context = null;
  dbState.roster = [];
  dbState.queue = [];
});

describe("native Wedding-Day offline cache", () => {
  it("caches only the minimal manual Guest roster and excludes seating/contact fields", async () => {
    await setWeddingDayContext(userId, weddingId);
    await expect(saveCachedWeddingDayRoster(userId, weddingId, [rosterGuest()])).resolves.toBe(true);
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
    expect(dbState.roster[0]).not.toHaveProperty("tableSeatSummaries");
    expect(dbState.roster[0]).not.toHaveProperty("email");
    expect(dbState.roster[0]).not.toHaveProperty("phone");
  });

  it("invalidates the prior Wedding roster when account or Wedding context changes", async () => {
    await setWeddingDayContext(userId, weddingId);
    await saveCachedWeddingDayRoster(userId, weddingId, [rosterGuest()]);
    await setWeddingDayContext(userId, otherWeddingId);

    await expect(loadCachedWeddingDayRoster(userId, weddingId)).resolves.toEqual([]);
    await expect(loadCachedWeddingDayRoster(userId, otherWeddingId)).resolves.toEqual([]);
    await expect(saveCachedWeddingDayRoster(userId, weddingId, [rosterGuest()])).resolves.toBe(false);
    expect(dbState.context).toEqual({ user_id: userId, wedding_id: otherWeddingId });
  });

  it("preserves pending action IDs across context changes and suppresses duplicate local retries", async () => {
    const first = pendingAction();
    await queueManualWeddingDayAction(first);
    await queueManualWeddingDayAction({ ...first, occurredAt: "2026-09-28T11:20:00.000Z" });
    await setWeddingDayContext(userId, weddingId);
    await setWeddingDayContext(userId, otherWeddingId);

    await expect(listQueuedManualWeddingDayActions(userId, weddingId)).resolves.toEqual([first]);
    await expect(listQueuedManualWeddingDayActions(userId, otherWeddingId)).resolves.toEqual([]);
    await removeQueuedManualWeddingDayAction(first);
    await expect(listQueuedManualWeddingDayActions(userId, weddingId)).resolves.toEqual([]);
  });

  it("isolates roster and queue reads by both account and Wedding", async () => {
    await setWeddingDayContext(userId, weddingId);
    await saveCachedWeddingDayRoster(userId, weddingId, [rosterGuest()]);
    await queueManualWeddingDayAction(pendingAction());

    await expect(hasCachedWeddingDayGuest(otherUserId, weddingId, guestId)).resolves.toBe(false);
    await expect(loadCachedWeddingDayRoster(otherUserId, weddingId)).resolves.toEqual([]);
    await expect(listQueuedManualWeddingDayActions(otherUserId, weddingId)).resolves.toEqual([]);
  });
});
