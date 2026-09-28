import * as SQLite from "expo-sqlite";
import type { ManualCheckInAction, WeddingDayGuest } from "./model";

type ActiveContextRow = { user_id: string; wedding_id: string };
type CachedGuestRow = {
  guest_id: string;
  display_name: string;
  household_id: string;
  household_name: string;
  rsvp_status: WeddingDayGuest["rsvpStatus"];
  is_checked_in: number;
};
type PendingActionRow = {
  user_id: string;
  wedding_id: string;
  guest_id: string;
  client_event_id: string;
  occurred_at: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync("katipan-wedding-day.db").then(async (database) => {
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS wedding_day_active_context (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        user_id TEXT NOT NULL,
        wedding_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS wedding_day_cached_guests (
        user_id TEXT NOT NULL,
        wedding_id TEXT NOT NULL,
        guest_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        household_id TEXT NOT NULL,
        household_name TEXT NOT NULL,
        rsvp_status TEXT NOT NULL CHECK (rsvp_status IN ('NO_RESPONSE', 'ATTENDING', 'DECLINED')),
        is_checked_in INTEGER NOT NULL CHECK (is_checked_in IN (0, 1)),
        PRIMARY KEY (user_id, wedding_id, guest_id)
      );
      CREATE TABLE IF NOT EXISTS wedding_day_manual_queue (
        user_id TEXT NOT NULL,
        wedding_id TEXT NOT NULL,
        guest_id TEXT NOT NULL,
        client_event_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        PRIMARY KEY (user_id, wedding_id, client_event_id)
      );
    `);
    return database;
  }).catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

/** Keep only one account/Wedding roster on device; queued events remain Wedding-scoped for later sync. */
export async function setWeddingDayContext(userId: string, weddingId: string): Promise<void> {
  const database = await getDatabase();
  const context = await database.getAllAsync<ActiveContextRow>(
    "SELECT user_id, wedding_id FROM wedding_day_active_context WHERE singleton = 1",
  );
  if (context[0]?.user_id === userId && context[0]?.wedding_id === weddingId) return;

  await database.withExclusiveTransactionAsync(async (transaction) => {
    const latest = await transaction.getAllAsync<ActiveContextRow>(
      "SELECT user_id, wedding_id FROM wedding_day_active_context WHERE singleton = 1",
    );
    if (latest[0]?.user_id === userId && latest[0]?.wedding_id === weddingId) return;
    await transaction.runAsync("DELETE FROM wedding_day_cached_guests");
    await transaction.runAsync(
      "INSERT OR REPLACE INTO wedding_day_active_context (singleton, user_id, wedding_id) VALUES (1, ?, ?)",
      userId,
      weddingId,
    );
  });
}

export async function saveCachedWeddingDayRoster(
  userId: string,
  weddingId: string,
  guests: readonly WeddingDayGuest[],
): Promise<boolean> {
  const database = await getDatabase();
  let saved = false;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const context = await transaction.getAllAsync<ActiveContextRow>(
      "SELECT user_id, wedding_id FROM wedding_day_active_context WHERE singleton = 1",
    );
    if (context[0]?.user_id !== userId || context[0]?.wedding_id !== weddingId) return;
    await transaction.runAsync(
      "DELETE FROM wedding_day_cached_guests WHERE user_id = ? AND wedding_id = ?",
      userId,
      weddingId,
    );
    for (const guest of guests) {
      await transaction.runAsync(
        `INSERT INTO wedding_day_cached_guests
          (user_id, wedding_id, guest_id, display_name, household_id, household_name, rsvp_status, is_checked_in)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        userId,
        weddingId,
        guest.guestId,
        guest.displayName,
        guest.householdId,
        guest.householdName,
        guest.rsvpStatus,
        guest.isCheckedIn ? 1 : 0,
      );
    }
    saved = true;
  });
  return saved;
}

export async function loadCachedWeddingDayRoster(userId: string, weddingId: string): Promise<WeddingDayGuest[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<CachedGuestRow>(
    `SELECT guest_id, display_name, household_id, household_name, rsvp_status, is_checked_in
     FROM wedding_day_cached_guests WHERE user_id = ? AND wedding_id = ?
     ORDER BY display_name COLLATE NOCASE, guest_id`,
    userId,
    weddingId,
  );
  return rows.map((row) => ({
    guestId: row.guest_id,
    displayName: row.display_name,
    householdId: row.household_id,
    householdName: row.household_name,
    rsvpStatus: row.rsvp_status,
    isCheckedIn: row.is_checked_in === 1,
    tableSeatSummaries: [],
    seatingAvailable: false,
  }));
}

export async function hasCachedWeddingDayGuest(userId: string, weddingId: string, guestId: string): Promise<boolean> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ guest_id: string }>(
    `SELECT guest_id FROM wedding_day_cached_guests
     WHERE user_id = ? AND wedding_id = ? AND guest_id = ? LIMIT 1`,
    userId,
    weddingId,
    guestId,
  );
  return rows.length > 0;
}

export async function queueManualWeddingDayAction(action: ManualCheckInAction): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR IGNORE INTO wedding_day_manual_queue
      (user_id, wedding_id, guest_id, client_event_id, occurred_at)
     VALUES (?, ?, ?, ?, ?)`,
    action.userId,
    action.weddingId,
    action.guestId,
    action.clientEventId,
    action.occurredAt,
  );
}

export async function listQueuedManualWeddingDayActions(
  userId: string,
  weddingId: string,
): Promise<ManualCheckInAction[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<PendingActionRow>(
    `SELECT user_id, wedding_id, guest_id, client_event_id, occurred_at
     FROM wedding_day_manual_queue WHERE user_id = ? AND wedding_id = ?
     ORDER BY occurred_at, client_event_id`,
    userId,
    weddingId,
  );
  return rows.map((row) => ({
    userId: row.user_id,
    weddingId: row.wedding_id,
    guestId: row.guest_id,
    clientEventId: row.client_event_id,
    occurredAt: row.occurred_at,
  }));
}

export async function removeQueuedManualWeddingDayAction(action: ManualCheckInAction): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `DELETE FROM wedding_day_manual_queue
     WHERE user_id = ? AND wedding_id = ? AND client_event_id = ?`,
    action.userId,
    action.weddingId,
    action.clientEventId,
  );
}
