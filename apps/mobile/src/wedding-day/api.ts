import NetInfo from "@react-native-community/netinfo";
import * as Crypto from "expo-crypto";
import type { Database } from "@katipan/database/types";
import { supabase } from "../auth/client";
import type { WorkspaceMembership } from "../workspace/model";
import {
  canAccessWeddingDayCheckIn,
  parseWeddingDayCheckInResult,
  parseWeddingDayDashboard,
  parseWeddingDayReversalResult,
  type ManualCheckInAction,
  type WeddingDayCheckInResult,
  type WeddingDayDashboard,
  type WeddingDayGuest,
  type WeddingDayReversalResult,
} from "./model";
import {
  hasCachedWeddingDayGuest,
  listQueuedManualWeddingDayActions,
  loadCachedWeddingDayRoster,
  queueManualWeddingDayAction,
  removeQueuedManualWeddingDayAction,
  saveCachedWeddingDayRoster,
  setWeddingDayContext,
} from "./offline-store";

type GuestRow = Pick<Database["public"]["Tables"]["guests"]["Row"], "id" | "wedding_id" | "household_id" | "person_id">;
type PersonRow = Pick<Database["public"]["Tables"]["wedding_people"]["Row"], "id" | "wedding_id" | "display_name" | "first_name" | "last_name">;
type HouseholdRow = Pick<Database["public"]["Tables"]["guest_households"]["Row"], "id" | "wedding_id" | "display_name">;
type RsvpRow = Pick<Database["public"]["Tables"]["guest_rsvps"]["Row"], "wedding_id" | "guest_id" | "status">;
type CheckInStateRow = Pick<Database["public"]["Views"]["guest_check_in_state"]["Row"], "wedding_id" | "guest_id" | "is_checked_in">;

export type CheckInRosterSnapshot = {
  guests: WeddingDayGuest[];
  source: "LIVE" | "OFFLINE_CACHE";
  queuedGuestIds: string[];
  pendingActionCount: number;
};

export type ManualCheckInOutcome =
  | { kind: "RESULT"; result: WeddingDayCheckInResult }
  | { kind: "QUEUED"; clientEventId: string };

export type QrCheckInOutcome =
  | { kind: "RESULT"; result: WeddingDayCheckInResult }
  | { kind: "OFFLINE_UNAVAILABLE" };

export type QueuedSyncResult = {
  outcomes: { clientEventId: string; guestId: string; result: WeddingDayCheckInResult }[];
  remaining: number;
  offline: boolean;
};

function denied(): Error {
  return Object.assign(new Error("Wedding-Day check-in isn't available for this Wedding membership."), { code: "42501" });
}

function invalidWeddingScope(): Error {
  return Object.assign(new Error("This action does not belong to the selected Wedding."), { code: "22023" });
}

export function assertCanAccessWeddingDayCheckIn(membership: WorkspaceMembership): void {
  if (!canAccessWeddingDayCheckIn(membership)) throw denied();
}

async function isOnline(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  try {
    const state = await NetInfo.fetch();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

export function isWeddingDayNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== "object") return false;
  const value = error as Record<string, unknown>;
  if (value.name === "AbortError") return true;
  if (typeof value.status === "number" || typeof value.statusCode === "number" || typeof value.code === "string") return false;
  const message = typeof value.message === "string" ? value.message : "";
  return /(network request failed|failed to fetch|fetch failed|networkerror|internet connection|offline|timed? ?out|connection lost)/i.test(message);
}

export function createManualCheckInAction(
  membership: WorkspaceMembership,
  guestId: string,
  clientEventId = Crypto.randomUUID(),
  occurredAt = new Date().toISOString(),
): ManualCheckInAction {
  return {
    userId: membership.userId,
    weddingId: membership.weddingId,
    guestId,
    clientEventId,
    occurredAt,
  };
}

async function callCheckIn(args: Database["public"]["Functions"]["wedding_day_check_in"]["Args"]): Promise<WeddingDayCheckInResult> {
  const { data, error } = await supabase.rpc("wedding_day_check_in", args);
  if (error) throw error;
  return parseWeddingDayCheckInResult(data);
}

async function requireCachedGuest(action: ManualCheckInAction): Promise<void> {
  const cached = await hasCachedWeddingDayGuest(action.userId, action.weddingId, action.guestId);
  if (!cached) {
    throw Object.assign(new Error("Refresh this Wedding's Guest list while online before using offline manual check-in."), { code: "OFFLINE_ROSTER_MISSING" });
  }
}

async function queueOfflineManualAction(action: ManualCheckInAction): Promise<ManualCheckInOutcome> {
  await requireCachedGuest(action);
  await queueManualWeddingDayAction(action);
  return { kind: "QUEUED", clientEventId: action.clientEventId };
}

export async function loadWeddingDayDashboard(membership: WorkspaceMembership): Promise<WeddingDayDashboard> {
  assertCanAccessWeddingDayCheckIn(membership);
  const { data, error } = await supabase.rpc("wedding_day_dashboard", { p_wedding_id: membership.weddingId });
  if (error) throw error;
  return parseWeddingDayDashboard(data);
}

async function loadLiveRoster(membership: WorkspaceMembership): Promise<WeddingDayGuest[]> {
  const weddingId = membership.weddingId;
  const [guestsResult, peopleResult, householdsResult, rsvpsResult, checkInResult] = await Promise.all([
    supabase.from("guests").select("id,wedding_id,household_id,person_id").eq("wedding_id", weddingId),
    supabase.from("wedding_people").select("id,wedding_id,display_name,first_name,last_name").eq("wedding_id", weddingId),
    supabase.from("guest_households").select("id,wedding_id,display_name").eq("wedding_id", weddingId),
    supabase.from("guest_rsvps").select("wedding_id,guest_id,status").eq("wedding_id", weddingId),
    supabase.from("guest_check_in_state").select("wedding_id,guest_id,is_checked_in").eq("wedding_id", weddingId),
  ]);
  const coreError = [guestsResult.error, peopleResult.error, householdsResult.error, rsvpsResult.error, checkInResult.error].find(Boolean);
  if (coreError) throw coreError;

  const guests = (guestsResult.data ?? []) as GuestRow[];
  const people = (peopleResult.data ?? []) as PersonRow[];
  const households = (householdsResult.data ?? []) as HouseholdRow[];
  const rsvps = (rsvpsResult.data ?? []) as RsvpRow[];
  const checkInStates = (checkInResult.data ?? []) as CheckInStateRow[];
  const peopleById = new Map(people.filter((row) => row.wedding_id === weddingId).map((row) => [row.id, row]));
  const householdsById = new Map(households.filter((row) => row.wedding_id === weddingId).map((row) => [row.id, row]));
  const rsvpByGuestId = new Map(rsvps.filter((row) => row.wedding_id === weddingId).map((row) => [row.guest_id, row.status]));
  const checkInByGuestId = new Map(checkInStates.filter((row) => row.wedding_id === weddingId).map((row) => [row.guest_id, row.is_checked_in]));

  const [eventsResult, tablesResult, seatsResult, assignmentsResult] = await Promise.all([
    supabase.from("seating_events").select("id,wedding_id,name").eq("wedding_id", weddingId),
    supabase.from("seating_tables").select("id,wedding_id,event_id,name").eq("wedding_id", weddingId),
    supabase.from("seating_seats").select("id,wedding_id,table_id,label").eq("wedding_id", weddingId),
    supabase.from("seating_assignments").select("wedding_id,event_id,table_id,seat_id,guest_id").eq("wedding_id", weddingId),
  ]);
  const seatingAvailable = ![eventsResult.error, tablesResult.error, seatsResult.error, assignmentsResult.error].some(Boolean);
  const eventsById = new Map((eventsResult.data ?? []).filter((row) => row.wedding_id === weddingId).map((row) => [row.id, row]));
  const tablesById = new Map((tablesResult.data ?? []).filter((row) => row.wedding_id === weddingId).map((row) => [row.id, row]));
  const seatsById = new Map((seatsResult.data ?? []).filter((row) => row.wedding_id === weddingId).map((row) => [row.id, row]));
  const seatingByGuestId = new Map<string, string[]>();
  if (seatingAvailable) {
    for (const assignment of assignmentsResult.data ?? []) {
      if (assignment.wedding_id !== weddingId) continue;
      const event = eventsById.get(assignment.event_id);
      const table = tablesById.get(assignment.table_id);
      const guest = guests.find((row) => row.id === assignment.guest_id && row.wedding_id === weddingId);
      if (!event || !table || !guest || table.event_id !== event.id) continue;
      const seat = assignment.seat_id ? seatsById.get(assignment.seat_id) : null;
      const seatLabel = seat?.table_id === table.id
        ? (/^seat\b/i.test(seat.label) ? seat.label : `Seat ${seat.label}`)
        : null;
      const summary = `${event.name} · ${table.name}${seatLabel ? ` · ${seatLabel}` : ""}`;
      seatingByGuestId.set(guest.id, [...(seatingByGuestId.get(guest.id) ?? []), summary]);
    }
  }

  return guests.flatMap((guest) => {
    if (guest.wedding_id !== weddingId) return [];
    const person = peopleById.get(guest.person_id);
    const household = householdsById.get(guest.household_id);
    if (!person || !household) return [];
    const displayName = person.display_name.trim() || [person.first_name, person.last_name].filter(Boolean).join(" ").trim() || "Guest";
    return [{
      guestId: guest.id,
      displayName,
      householdId: household.id,
      householdName: household.display_name,
      rsvpStatus: rsvpByGuestId.get(guest.id) ?? "NO_RESPONSE",
      isCheckedIn: checkInByGuestId.get(guest.id) ?? false,
      tableSeatSummaries: seatingByGuestId.get(guest.id) ?? [],
      seatingAvailable,
    }];
  }).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function withPendingGuestIds(membership: WorkspaceMembership, guests: WeddingDayGuest[], source: CheckInRosterSnapshot["source"]): Promise<CheckInRosterSnapshot> {
  const actions = await listQueuedManualWeddingDayActions(membership.userId, membership.weddingId);
  const knownGuests = new Set(guests.map((guest) => guest.guestId));
  return {
    guests,
    source,
    queuedGuestIds: [...new Set(actions.filter((action) => knownGuests.has(action.guestId)).map((action) => action.guestId))],
    pendingActionCount: actions.length,
  };
}

export async function loadWeddingDayCheckInRoster(membership: WorkspaceMembership): Promise<CheckInRosterSnapshot> {
  assertCanAccessWeddingDayCheckIn(membership);
  await setWeddingDayContext(membership.userId, membership.weddingId);
  if (await isOnline()) {
    try {
      const guests = await loadLiveRoster(membership);
      await saveCachedWeddingDayRoster(membership.userId, membership.weddingId, guests).catch(() => false);
      return await withPendingGuestIds(membership, guests, "LIVE");
    } catch (error) {
      if (!isWeddingDayNetworkFailure(error)) throw error;
    }
  }
  const cached = await loadCachedWeddingDayRoster(membership.userId, membership.weddingId);
  if (cached.length === 0) {
    throw Object.assign(new Error("This Wedding's Guest roster hasn't been cached on this device. Connect once to load the manual check-in list."), { code: "OFFLINE_ROSTER_MISSING" });
  }
  return withPendingGuestIds(membership, cached, "OFFLINE_CACHE");
}

export async function checkInGuestManually(
  membership: WorkspaceMembership,
  action: ManualCheckInAction,
): Promise<ManualCheckInOutcome> {
  assertCanAccessWeddingDayCheckIn(membership);
  if (action.userId !== membership.userId || action.weddingId !== membership.weddingId) throw invalidWeddingScope();
  if (!(await isOnline())) return queueOfflineManualAction(action);
  try {
    return {
      kind: "RESULT",
      result: await callCheckIn({
        p_wedding_id: membership.weddingId,
        p_guest_id: action.guestId,
        p_client_event_id: action.clientEventId,
      }),
    };
  } catch (error) {
    if (!isWeddingDayNetworkFailure(error)) throw error;
    return queueOfflineManualAction(action);
  }
}

export async function checkInGuestPass(
  membership: WorkspaceMembership,
  qrToken: string,
  clientEventId: string,
): Promise<QrCheckInOutcome> {
  assertCanAccessWeddingDayCheckIn(membership);
  if (!(await isOnline())) return { kind: "OFFLINE_UNAVAILABLE" };
  const result = await callCheckIn({
    p_wedding_id: membership.weddingId,
    p_qr_token: qrToken,
    p_client_event_id: clientEventId,
  });
  return { kind: "RESULT", result };
}

export async function syncQueuedManualCheckIns(membership: WorkspaceMembership): Promise<QueuedSyncResult> {
  assertCanAccessWeddingDayCheckIn(membership);
  const queued = await listQueuedManualWeddingDayActions(membership.userId, membership.weddingId);
  if (!(await isOnline())) return { outcomes: [], remaining: queued.length, offline: true };
  const outcomes: QueuedSyncResult["outcomes"] = [];
  for (const action of queued) {
    try {
      const result = await callCheckIn({
        p_wedding_id: membership.weddingId,
        p_guest_id: action.guestId,
        p_client_event_id: action.clientEventId,
        p_occurred_at: action.occurredAt,
      });
      await removeQueuedManualWeddingDayAction(action);
      outcomes.push({ clientEventId: action.clientEventId, guestId: action.guestId, result });
    } catch (error) {
      if (isWeddingDayNetworkFailure(error)) break;
      throw error;
    }
  }
  const remaining = await listQueuedManualWeddingDayActions(membership.userId, membership.weddingId);
  return { outcomes, remaining: remaining.length, offline: false };
}

export async function reverseWeddingDayCheckIn(
  membership: WorkspaceMembership,
  guestId: string,
  clientEventId: string,
  reason?: string,
): Promise<WeddingDayReversalResult> {
  assertCanAccessWeddingDayCheckIn(membership);
  const args: Database["public"]["Functions"]["wedding_day_reverse_check_in"]["Args"] = {
    p_wedding_id: membership.weddingId,
    p_guest_id: guestId,
    p_client_event_id: clientEventId,
  };
  const cleanReason = reason?.trim();
  if (cleanReason) args.p_reason = cleanReason;
  if (!(await isOnline())) throw Object.assign(new Error("A network connection is required to reverse a check-in."), { code: "NETWORK_REQUIRED" });
  const { data, error } = await supabase.rpc("wedding_day_reverse_check_in", args);
  if (error) throw error;
  return parseWeddingDayReversalResult(data);
}
