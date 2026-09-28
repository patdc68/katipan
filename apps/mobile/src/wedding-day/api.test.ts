import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import {
  checkInGuestManually,
  checkInGuestPass,
  createManualCheckInAction,
  isWeddingDayNetworkFailure,
  loadWeddingDayCheckInRoster,
  loadWeddingDayDashboard,
  reverseWeddingDayCheckIn,
  syncQueuedManualCheckIns,
} from "./api";
import type { ManualCheckInAction } from "./model";

type QueryFilter = { table: string; column: string; value: string };
type QuerySelection = { table: string; columns: string };
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  fetchNetwork: vi.fn(),
  filters: [] as QueryFilter[],
  selections: [] as QuerySelection[],
  store: {
    setWeddingDayContext: vi.fn(),
    saveCachedWeddingDayRoster: vi.fn(),
    loadCachedWeddingDayRoster: vi.fn(),
    hasCachedWeddingDayGuest: vi.fn(),
    queueManualWeddingDayAction: vi.fn(),
    listQueuedManualWeddingDayActions: vi.fn(),
    removeQueuedManualWeddingDayAction: vi.fn(),
  },
}));

vi.mock("../auth/client", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("@react-native-community/netinfo", () => ({ default: { fetch: mocks.fetchNetwork } }));
vi.mock("expo-crypto", () => ({ randomUUID: vi.fn(() => clientEventId) }));
vi.mock("./offline-store", () => mocks.store);

const weddingId = "10000000-0000-4000-8000-000000000001";
const otherWeddingId = "10000000-0000-4000-8000-000000000002";
const guestId = "30000000-0000-4000-8000-000000000001";
const secondGuestId = "30000000-0000-4000-8000-000000000002";
const foreignGuestId = "30000000-0000-4000-8000-000000000099";
const householdId = "20000000-0000-4000-8000-000000000001";
const clientEventId = "80000000-0000-4000-8000-000000000001";
const secondClientEventId = "80000000-0000-4000-8000-000000000002";
const eventId = "90000000-0000-4000-8000-000000000001";
const qrToken = "0123456789abcdef".repeat(4);

function membership(
  role: WorkspaceMembership["role"] = "OWNER",
  status: WorkspaceMembership["status"] = "ACTIVE",
  wedding = weddingId,
): WorkspaceMembership {
  return {
    membershipId: "60000000-0000-4000-8000-000000000001",
    weddingId: wedding,
    userId: "70000000-0000-4000-8000-000000000001",
    role,
    status,
    wedding: {
      id: wedding,
      display_name: "Juan & Maria",
      wedding_date: null,
      general_location: null,
      status: "ACTIVE",
      origin: "COUPLE_CREATED",
      ownership_mode: "COUPLE_OWNED",
    },
    partnerNames: ["Juan", "Maria"],
  };
}

function action(
  guest = guestId,
  id = clientEventId,
  wedding = weddingId,
  occurredAt = "2026-09-28T11:10:00.000Z",
): ManualCheckInAction {
  return { userId: membership().userId, weddingId: wedding, guestId: guest, clientEventId: id, occurredAt };
}

function rpcCheckIn(status: string, overrides: Record<string, unknown> = {}) {
  return {
    status,
    ...(status === "CHECKED_IN" || status === "ALREADY_CHECKED_IN"
      ? { guestId, name: "Alex Santos", reference: "K1234-ABCD", eventId, replayed: false }
      : {}),
    ...overrides,
  };
}

const liveRows: Record<string, unknown[]> = {};

function setupReadQueries() {
  mocks.filters.length = 0;
  mocks.selections.length = 0;
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: vi.fn((columns: string) => {
        mocks.selections.push({ table, columns });
        return query;
      }),
      eq: vi.fn((column: string, value: string) => {
        mocks.filters.push({ table, column, value });
        return query;
      }),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: liveRows[table] ?? [], error: null }).then(resolve, reject),
    };
    return query;
  });
}

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.from.mockReset();
  mocks.fetchNetwork.mockReset().mockResolvedValue({ isConnected: true, isInternetReachable: true });
  for (const mock of Object.values(mocks.store)) mock.mockReset();
  mocks.store.setWeddingDayContext.mockResolvedValue(undefined);
  mocks.store.saveCachedWeddingDayRoster.mockResolvedValue(true);
  mocks.store.loadCachedWeddingDayRoster.mockResolvedValue([]);
  mocks.store.hasCachedWeddingDayGuest.mockResolvedValue(true);
  mocks.store.queueManualWeddingDayAction.mockResolvedValue(undefined);
  mocks.store.listQueuedManualWeddingDayActions.mockResolvedValue([]);
  mocks.store.removeQueuedManualWeddingDayAction.mockResolvedValue(undefined);
  setupReadQueries();
  for (const key of Object.keys(liveRows)) delete liveRows[key];
});

afterEach(() => vi.unstubAllGlobals());

describe("Wedding-Day dashboard RPC", () => {
  it("maps server aggregates and timeline fields without recalculating the counts", async () => {
    const payload = {
      totalAttending: 48,
      checkedIn: 19,
      remaining: 29,
      currentItem: null,
      nextItem: null,
      delayedItems: [],
    };
    mocks.rpc.mockResolvedValue({ data: payload, error: null });

    await expect(loadWeddingDayDashboard(membership())).resolves.toEqual(payload);
    expect(mocks.rpc).toHaveBeenCalledWith("wedding_day_dashboard", { p_wedding_id: weddingId });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects inactive and cross-Wedding memberships before an RPC call", async () => {
    await expect(loadWeddingDayDashboard(membership("OWNER", "REMOVED"))).rejects.toMatchObject({ code: "42501" });
    const mismatched = membership();
    mismatched.wedding = { ...mismatched.wedding, id: otherWeddingId };
    await expect(loadWeddingDayDashboard(mismatched)).rejects.toMatchObject({ code: "42501" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("manual check-in", () => {
  it("uses the individual Guest RPC arguments and leaves RSVP, Seating, and Pass tables untouched", async () => {
    mocks.rpc.mockResolvedValue({ data: rpcCheckIn("CHECKED_IN"), error: null });
    const manualAction = action();

    const outcome = await checkInGuestManually(membership("GUEST_COORDINATOR"), manualAction);

    expect(outcome).toMatchObject({ kind: "RESULT", result: { status: "CHECKED_IN", name: "Alex Santos" } });
    expect(mocks.rpc).toHaveBeenCalledWith("wedding_day_check_in", {
      p_wedding_id: weddingId,
      p_guest_id: guestId,
      p_client_event_id: clientEventId,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("reuses the same client_event_id when an ambiguous action is retried", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: rpcCheckIn("CHECKED_IN"), error: null })
      .mockResolvedValueOnce({ data: rpcCheckIn("CHECKED_IN", { replayed: true }), error: null });
    const manualAction = action();

    await checkInGuestManually(membership(), manualAction);
    await checkInGuestManually(membership(), manualAction);

    expect(mocks.rpc.mock.calls[0]?.[1]).toMatchObject({ p_client_event_id: clientEventId });
    expect(mocks.rpc.mock.calls[1]?.[1]).toMatchObject({ p_client_event_id: clientEventId });
  });

  it("does not turn a manually supplied foreign Guest ID into a cross-Wedding read", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "NOT_RECOGNIZED" }, error: null });
    const foreignAction = action(foreignGuestId);

    const outcome = await checkInGuestManually(membership(), foreignAction);

    expect(outcome).toEqual({ kind: "RESULT", result: { status: "NOT_RECOGNIZED" } });
    expect(mocks.rpc).toHaveBeenCalledWith("wedding_day_check_in", expect.objectContaining({
      p_wedding_id: weddingId,
      p_guest_id: foreignGuestId,
    }));
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects a mismatched action Wedding before sending it", async () => {
    await expect(checkInGuestManually(membership(), action(guestId, clientEventId, otherWeddingId)))
      .rejects.toMatchObject({ code: "22023" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("creates two independent Guest operations for two selected people in one Household", async () => {
    mocks.rpc.mockResolvedValue({ data: rpcCheckIn("CHECKED_IN"), error: null });
    const first = action(guestId, clientEventId);
    const second = action(secondGuestId, secondClientEventId);

    await Promise.all([checkInGuestManually(membership(), first), checkInGuestManually(membership(), second)]);

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "wedding_day_check_in", {
      p_wedding_id: weddingId,
      p_guest_id: guestId,
      p_client_event_id: clientEventId,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "wedding_day_check_in", {
      p_wedding_id: weddingId,
      p_guest_id: secondGuestId,
      p_client_event_id: secondClientEventId,
    });
    expect(householdId).toBeTruthy(); // Household is display context; neither operation submits a Household ID.
    expect(mocks.rpc.mock.calls.every((call) => !("p_household_id" in (call[1] as object)))).toBe(true);
  });
});

describe("QR check-in", () => {
  it("sends the opaque QR payload unchanged to the check-in RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: rpcCheckIn("CHECKED_IN"), error: null });

    await expect(checkInGuestPass(membership("DAY_OF_COORDINATOR"), qrToken, clientEventId))
      .resolves.toMatchObject({ kind: "RESULT", result: { status: "CHECKED_IN" } });
    expect(mocks.rpc).toHaveBeenCalledWith("wedding_day_check_in", {
      p_wedding_id: weddingId,
      p_qr_token: qrToken,
      p_client_event_id: clientEventId,
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("guest_pass_lookup", expect.anything());
  });

  it.each([
    "CHECKED_IN",
    "ALREADY_CHECKED_IN",
    "NOT_RECOGNIZED",
    "DIFFERENT_WEDDING",
    "REVOKED_PASS",
    "DECLINED_REVIEW",
    "NO_RESPONSE_REVIEW",
  ])("returns the explicit %s state", async (status) => {
    mocks.rpc.mockResolvedValue({ data: rpcCheckIn(status, status === "DIFFERENT_WEDDING" ? { name: "Foreign Guest" } : {}), error: null });

    const outcome = await checkInGuestPass(membership(), qrToken, clientEventId);

    expect(outcome).toMatchObject({ kind: "RESULT", result: { status } });
    if (status === "DIFFERENT_WEDDING" && outcome.kind === "RESULT") {
      expect(outcome.result).toEqual({ status: "DIFFERENT_WEDDING" });
    }
  });

  it("does not queue or claim to validate a QR scan offline", async () => {
    mocks.fetchNetwork.mockResolvedValue({ isConnected: false, isInternetReachable: false });

    await expect(checkInGuestPass(membership(), qrToken, clientEventId)).resolves.toEqual({ kind: "OFFLINE_UNAVAILABLE" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.store.queueManualWeddingDayAction).not.toHaveBeenCalled();
  });

  it("never logs or persists the raw QR token", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.rpc.mockResolvedValue({ data: rpcCheckIn("NOT_RECOGNIZED"), error: null });

    await checkInGuestPass(membership(), qrToken, clientEventId);

    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(mocks.store.queueManualWeddingDayAction).not.toHaveBeenCalled();
  });
});

describe("offline manual queue", () => {
  it("stores only a cached Guest action and preserves its client_event_id and occurred_at", async () => {
    mocks.fetchNetwork.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    const manualAction = action(guestId, clientEventId, weddingId, "2026-09-28T11:10:00.000Z");

    await expect(checkInGuestManually(membership(), manualAction)).resolves.toEqual({ kind: "QUEUED", clientEventId });

    expect(mocks.store.hasCachedWeddingDayGuest).toHaveBeenCalledWith(membership().userId, weddingId, guestId);
    expect(mocks.store.queueManualWeddingDayAction).toHaveBeenCalledWith(manualAction);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not queue an arbitrary Guest ID that is absent from this Wedding's cached roster", async () => {
    mocks.fetchNetwork.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    mocks.store.hasCachedWeddingDayGuest.mockResolvedValue(false);

    await expect(checkInGuestManually(membership(), action(foreignGuestId))).rejects.toMatchObject({ code: "OFFLINE_ROSTER_MISSING" });
    expect(mocks.store.queueManualWeddingDayAction).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("syncs queued actions with the same ID and offline occurred_at, then removes only a resolved action", async () => {
    const queuedAction = action();
    mocks.store.listQueuedManualWeddingDayActions.mockResolvedValueOnce([queuedAction]).mockResolvedValueOnce([]);
    mocks.rpc.mockResolvedValue({ data: rpcCheckIn("CHECKED_IN"), error: null });

    const result = await syncQueuedManualCheckIns(membership());

    expect(result).toMatchObject({ remaining: 0, offline: false, outcomes: [{ clientEventId, guestId, result: { status: "CHECKED_IN" } }] });
    expect(mocks.rpc).toHaveBeenCalledWith("wedding_day_check_in", {
      p_wedding_id: weddingId,
      p_guest_id: guestId,
      p_client_event_id: clientEventId,
      p_occurred_at: queuedAction.occurredAt,
    });
    expect(mocks.store.removeQueuedManualWeddingDayAction).toHaveBeenCalledWith(queuedAction);
  });

  it("retains the same queued ID after a network retry failure", async () => {
    const queuedAction = action();
    mocks.store.listQueuedManualWeddingDayActions.mockResolvedValue([queuedAction]);
    mocks.rpc.mockResolvedValue({ data: null, error: new TypeError("Network request failed") });

    const result = await syncQueuedManualCheckIns(membership());

    expect(result).toMatchObject({ remaining: 1, offline: false, outcomes: [] });
    expect(mocks.rpc).toHaveBeenCalledWith("wedding_day_check_in", expect.objectContaining({
      p_wedding_id: weddingId,
      p_guest_id: guestId,
      p_client_event_id: clientEventId,
      p_occurred_at: queuedAction.occurredAt,
    }));
    expect(mocks.store.removeQueuedManualWeddingDayAction).not.toHaveBeenCalled();
  });

  it("uses a stable UUID and observation time for one client action", () => {
    const generated = createManualCheckInAction(membership(), guestId, clientEventId, "2026-09-28T11:10:00.000Z");
    expect(generated).toEqual(action());
    expect(isWeddingDayNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isWeddingDayNetworkFailure({ code: "42501", message: "network unavailable" })).toBe(false);
  });
});

describe("check-in reversal", () => {
  it("calls the reversal RPC and reuses the same event ID on retry", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { status: "REVERSED", guestId, eventId, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { status: "REVERSED", guestId, eventId, replayed: true }, error: null });

    await expect(reverseWeddingDayCheckIn(membership(), guestId, clientEventId, "Duplicate scan"))
      .resolves.toMatchObject({ status: "REVERSED" });
    await reverseWeddingDayCheckIn(membership(), guestId, clientEventId, "Duplicate scan");

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "wedding_day_reverse_check_in", {
      p_wedding_id: weddingId,
      p_guest_id: guestId,
      p_client_event_id: clientEventId,
      p_reason: "Duplicate scan",
    });
    expect(mocks.rpc.mock.calls[1]?.[1]).toEqual(mocks.rpc.mock.calls[0]?.[1]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("surfaces NOT_CHECKED_IN without inventing a reversal", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "NOT_CHECKED_IN", guestId }, error: null });
    await expect(reverseWeddingDayCheckIn(membership("GUEST_COORDINATOR"), guestId, clientEventId))
      .resolves.toEqual({ status: "NOT_CHECKED_IN", guestId });
    expect(mocks.rpc).toHaveBeenCalledWith("wedding_day_reverse_check_in", {
      p_wedding_id: weddingId,
      p_guest_id: guestId,
      p_client_event_id: clientEventId,
    });
  });

  it("keeps an offline reversal read-only and requires an online retry", async () => {
    mocks.fetchNetwork.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    await expect(reverseWeddingDayCheckIn(membership(), guestId, clientEventId)).rejects.toMatchObject({ code: "NETWORK_REQUIRED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("Wedding-scoped roster reads", () => {
  it("maps only the minimal Guest fields, current state, and safely available table/seat summaries", async () => {
    liveRows.guests = [
      { id: guestId, wedding_id: weddingId, person_id: "40000000-0000-4000-8000-000000000001", household_id: householdId },
    ];
    liveRows.wedding_people = [
      { id: "40000000-0000-4000-8000-000000000001", wedding_id: weddingId, display_name: "Alex Santos", first_name: "Alex", last_name: "Santos" },
    ];
    liveRows.guest_households = [{ id: householdId, wedding_id: weddingId, display_name: "Santos Household" }];
    liveRows.guest_rsvps = [{ wedding_id: weddingId, guest_id: guestId, status: "ATTENDING" }];
    liveRows.guest_check_in_state = [{ wedding_id: weddingId, guest_id: guestId, is_checked_in: true }];
    liveRows.seating_events = [{ id: "50000000-0000-4000-8000-000000000001", wedding_id: weddingId, name: "Reception" }];
    liveRows.seating_tables = [{ id: "50000000-0000-4000-8000-000000000002", wedding_id: weddingId, event_id: "50000000-0000-4000-8000-000000000001", name: "Table 4" }];
    liveRows.seating_seats = [{ id: "50000000-0000-4000-8000-000000000003", wedding_id: weddingId, table_id: "50000000-0000-4000-8000-000000000002", label: "Seat 2" }];
    liveRows.seating_assignments = [{ wedding_id: weddingId, event_id: "50000000-0000-4000-8000-000000000001", table_id: "50000000-0000-4000-8000-000000000002", seat_id: "50000000-0000-4000-8000-000000000003", guest_id: guestId }];

    const result = await loadWeddingDayCheckInRoster(membership());

    expect(result).toMatchObject({
      source: "LIVE",
      guests: [{
        guestId,
        displayName: "Alex Santos",
        householdName: "Santos Household",
        rsvpStatus: "ATTENDING",
        isCheckedIn: true,
        tableSeatSummaries: ["Reception · Table 4 · Seat 2"],
        seatingAvailable: true,
      }],
    });
    expect(mocks.store.setWeddingDayContext).toHaveBeenCalledWith(membership().userId, weddingId);
    expect(mocks.store.saveCachedWeddingDayRoster).toHaveBeenCalledWith(membership().userId, weddingId, result.guests);
    expect(mocks.selections.find((query) => query.table === "wedding_people")?.columns).toBe("id,wedding_id,display_name,first_name,last_name");
    expect(result.guests[0]).not.toHaveProperty("email");
    expect(result.guests[0]).not.toHaveProperty("phone");
    expect(result.guests[0]).not.toHaveProperty("internal_notes");
    expect(mocks.filters.every((filter) => filter.value === weddingId)).toBe(true);
  });

  it("drops rows belonging to another Wedding even if a query mock returns them", async () => {
    liveRows.guests = [
      { id: guestId, wedding_id: weddingId, person_id: "40000000-0000-4000-8000-000000000001", household_id: householdId },
      { id: foreignGuestId, wedding_id: otherWeddingId, person_id: "40000000-0000-4000-8000-000000000099", household_id: "20000000-0000-4000-8000-000000000099" },
    ];
    liveRows.wedding_people = [
      { id: "40000000-0000-4000-8000-000000000001", wedding_id: weddingId, display_name: "Alex Santos", first_name: "Alex", last_name: "Santos" },
      { id: "40000000-0000-4000-8000-000000000099", wedding_id: otherWeddingId, display_name: "Private Guest", first_name: "Private", last_name: "Guest" },
    ];
    liveRows.guest_households = [
      { id: householdId, wedding_id: weddingId, display_name: "Santos Household" },
      { id: "20000000-0000-4000-8000-000000000099", wedding_id: otherWeddingId, display_name: "Private Household" },
    ];

    const result = await loadWeddingDayCheckInRoster(membership());

    expect(result.guests.map((guest) => guest.guestId)).toEqual([guestId]);
    expect(JSON.stringify(result)).not.toContain("Private Guest");
    expect(JSON.stringify(result)).not.toContain("Private Household");
    expect(mocks.filters.every((filter) => filter.value === weddingId)).toBe(true);
  });
});
