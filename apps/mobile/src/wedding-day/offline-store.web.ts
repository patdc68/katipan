import type { ManualCheckInAction, WeddingDayGuest } from "./model";

const CONTEXT_KEY = "katipan.wedding-day.context";
const ROSTER_KEY = "katipan.wedding-day.roster";
const QUEUE_KEY = "katipan.wedding-day.manual-queue";

type ActiveContext = { userId: string; weddingId: string };

function readArray<T>(key: string): T[] {
  try {
    const value: unknown = JSON.parse(globalThis.localStorage?.getItem(key) ?? "[]");
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
}

function readContext(): ActiveContext | null {
  try {
    const value: unknown = JSON.parse(globalThis.localStorage?.getItem(CONTEXT_KEY) ?? "null");
    if (!value || typeof value !== "object" || !("userId" in value) || !("weddingId" in value)) return null;
    return typeof value.userId === "string" && typeof value.weddingId === "string"
      ? { userId: value.userId, weddingId: value.weddingId }
      : null;
  } catch {
    return null;
  }
}

export async function setWeddingDayContext(userId: string, weddingId: string): Promise<void> {
  const current = readContext();
  if (current?.userId === userId && current.weddingId === weddingId) return;
  globalThis.localStorage?.setItem(ROSTER_KEY, "[]");
  globalThis.localStorage?.setItem(CONTEXT_KEY, JSON.stringify({ userId, weddingId } satisfies ActiveContext));
}

export async function saveCachedWeddingDayRoster(
  userId: string,
  weddingId: string,
  guests: readonly WeddingDayGuest[],
): Promise<boolean> {
  const current = readContext();
  if (current?.userId !== userId || current.weddingId !== weddingId) return false;
  const minimal = guests.map((guest) => ({
    userId,
    weddingId,
    guestId: guest.guestId,
    displayName: guest.displayName,
    householdId: guest.householdId,
    householdName: guest.householdName,
    rsvpStatus: guest.rsvpStatus,
    isCheckedIn: guest.isCheckedIn,
  }));
  globalThis.localStorage?.setItem(ROSTER_KEY, JSON.stringify(minimal));
  return true;
}

export async function loadCachedWeddingDayRoster(userId: string, weddingId: string): Promise<WeddingDayGuest[]> {
  return readArray<WeddingDayGuest & { userId?: string; weddingId?: string }>(ROSTER_KEY)
    .filter((guest) => guest.userId === userId && guest.weddingId === weddingId
      && typeof guest.guestId === "string" && typeof guest.displayName === "string"
      && typeof guest.householdId === "string" && typeof guest.householdName === "string"
      && ["ATTENDING", "DECLINED", "NO_RESPONSE"].includes(guest.rsvpStatus)
      && typeof guest.isCheckedIn === "boolean")
    .map((guest) => ({
      guestId: guest.guestId,
      displayName: guest.displayName,
      householdId: guest.householdId,
      householdName: guest.householdName,
      rsvpStatus: guest.rsvpStatus,
      isCheckedIn: guest.isCheckedIn,
      tableSeatSummaries: [],
      seatingAvailable: false,
    }));
}

export async function hasCachedWeddingDayGuest(userId: string, weddingId: string, guestId: string): Promise<boolean> {
  const guests = await loadCachedWeddingDayRoster(userId, weddingId);
  return guests.some((guest) => guest.guestId === guestId);
}

export async function queueManualWeddingDayAction(action: ManualCheckInAction): Promise<void> {
  const actions = readArray<ManualCheckInAction>(QUEUE_KEY);
  if (actions.some((item) => item.userId === action.userId && item.weddingId === action.weddingId && item.clientEventId === action.clientEventId)) return;
  actions.push(action);
  globalThis.localStorage?.setItem(QUEUE_KEY, JSON.stringify(actions));
}

export async function listQueuedManualWeddingDayActions(userId: string, weddingId: string): Promise<ManualCheckInAction[]> {
  return readArray<ManualCheckInAction>(QUEUE_KEY)
    .filter((action) => action.userId === userId && action.weddingId === weddingId
      && typeof action.guestId === "string" && typeof action.clientEventId === "string"
      && typeof action.occurredAt === "string");
}

export async function removeQueuedManualWeddingDayAction(action: ManualCheckInAction): Promise<void> {
  const remaining = readArray<ManualCheckInAction>(QUEUE_KEY)
    .filter((item) => !(item.userId === action.userId && item.weddingId === action.weddingId && item.clientEventId === action.clientEventId));
  globalThis.localStorage?.setItem(QUEUE_KEY, JSON.stringify(remaining));
}
