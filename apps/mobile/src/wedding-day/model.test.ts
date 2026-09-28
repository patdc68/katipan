import { describe, expect, it } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import {
  canAccessWeddingDayCheckIn,
  checkInResultPresentation,
  filterWeddingDayGuests,
  parseWeddingDayCheckInResult,
  parseWeddingDayDashboard,
  parseWeddingDayReversalResult,
  reversalResultPresentation,
  type WeddingDayCheckInStatus,
  type WeddingDayGuest,
} from "./model";

const weddingId = "10000000-0000-4000-8000-000000000001";
const guestId = "30000000-0000-4000-8000-000000000001";

function membership(
  role: WorkspaceMembership["role"] = "OWNER",
  status: WorkspaceMembership["status"] = "ACTIVE",
  workspaceWeddingId = weddingId,
): WorkspaceMembership {
  return {
    membershipId: "60000000-0000-4000-8000-000000000001",
    weddingId,
    userId: "70000000-0000-4000-8000-000000000001",
    role,
    status,
    wedding: {
      id: workspaceWeddingId,
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

function guest(overrides: Partial<WeddingDayGuest> = {}): WeddingDayGuest {
  return {
    guestId,
    displayName: "Alex Santos",
    householdId: "20000000-0000-4000-8000-000000000001",
    householdName: "Santos Household",
    rsvpStatus: "ATTENDING",
    isCheckedIn: false,
    tableSeatSummaries: [],
    seatingAvailable: true,
    ...overrides,
  };
}

describe("Wedding-Day permission boundaries", () => {
  it.each(["OWNER", "FULL_COORDINATOR", "DAY_OF_COORDINATOR", "GUEST_COORDINATOR"] as const)("allows %s to access check-in", (role) => {
    expect(canAccessWeddingDayCheckIn(membership(role))).toBe(true);
  });

  it("keeps Guest Coordinators within the check-in permission path", () => {
    expect(canAccessWeddingDayCheckIn(membership("GUEST_COORDINATOR"))).toBe(true);
  });

  it("rejects an inactive membership and a mismatched Wedding", () => {
    expect(canAccessWeddingDayCheckIn(membership("OWNER", "REMOVED"))).toBe(false);
    expect(canAccessWeddingDayCheckIn(membership("OWNER", "ACTIVE", "10000000-0000-4000-8000-000000000099"))).toBe(false);
  });
});

describe("wedding_day_dashboard payload mapping", () => {
  it("uses the aggregate values and current/next/delayed items returned by the RPC", () => {
    const item = {
      id: "90000000-0000-4000-8000-000000000001",
      title: "Ceremony",
      description: null,
      scheduled_start: "2026-10-15T09:00:00.000Z",
      scheduled_end: "2026-10-15T10:00:00.000Z",
      actual_start: null,
      actual_end: null,
      status: "UPCOMING",
      sort_order: 1,
      place_id: null,
      wedding_id: "should be dropped",
    };
    const dashboard = parseWeddingDayDashboard({
      totalAttending: 42,
      checkedIn: 17,
      remaining: 25,
      currentItem: { ...item, status: "IN_PROGRESS", actual_start: "2026-10-15T09:05:00.000Z" },
      nextItem: item,
      delayedItems: [{ ...item, id: "90000000-0000-4000-8000-000000000002", status: "DELAYED" }],
    });

    expect(dashboard).toEqual({
      totalAttending: 42,
      checkedIn: 17,
      remaining: 25,
      currentItem: expect.objectContaining({ title: "Ceremony", status: "IN_PROGRESS", sortOrder: 1 }),
      nextItem: expect.objectContaining({ title: "Ceremony", status: "UPCOMING" }),
      delayedItems: [expect.objectContaining({ status: "DELAYED" })],
    });
  });

  it("maps an empty Run of Show without inventing items", () => {
    expect(parseWeddingDayDashboard({
      totalAttending: 0,
      checkedIn: 0,
      remaining: 0,
      currentItem: null,
      nextItem: null,
      delayedItems: [],
    })).toEqual({ totalAttending: 0, checkedIn: 0, remaining: 0, currentItem: null, nextItem: null, delayedItems: [] });
  });

  it("rejects unknown operational statuses", () => {
    expect(() => parseWeddingDayDashboard({
      totalAttending: 0,
      checkedIn: 0,
      remaining: 0,
      currentItem: null,
      nextItem: null,
      delayedItems: [{
        id: "90000000-0000-4000-8000-000000000001",
        title: "Unexpected",
        description: null,
        scheduled_start: "2026-10-15T09:00:00.000Z",
        scheduled_end: null,
        actual_start: null,
        actual_end: null,
        status: "PAUSED",
        sort_order: 0,
        place_id: null,
      }],
    })).toThrow("Wedding-Day dashboard data is unavailable.");
  });
});

describe("check-in result handling", () => {
  const statusTitles: Record<WeddingDayCheckInStatus, string> = {
    CHECKED_IN: "Checked In",
    ALREADY_CHECKED_IN: "Already Checked In",
    NOT_RECOGNIZED: "Not Recognized",
    DIFFERENT_WEDDING: "Different Wedding",
    REVOKED_PASS: "Revoked Pass",
    DECLINED_REVIEW: "Declined RSVP — Review Required",
    NO_RESPONSE_REVIEW: "No Response — Review Required",
  };

  it.each(Object.entries(statusTitles) as [WeddingDayCheckInStatus, string][])("keeps %s distinct", (status, title) => {
    const payload = status === "CHECKED_IN" || status === "ALREADY_CHECKED_IN"
      ? { status, guestId, name: "Alex Santos", reference: "K1234-ABCD" }
      : { status };
    expect(checkInResultPresentation(parseWeddingDayCheckInResult(payload)).title).toBe(title);
  });

  it("does not expose identity fields included with a different-Wedding response", () => {
    const result = parseWeddingDayCheckInResult({ status: "DIFFERENT_WEDDING", name: "Private Guest", reference: "K1111-2222" });
    expect(result).toEqual({ status: "DIFFERENT_WEDDING" });
    expect(checkInResultPresentation(result).detail).not.toContain("Private Guest");
    expect(checkInResultPresentation(result).detail).not.toContain("K1111");
  });

  it("requires a Guest name on a successful check-in result", () => {
    expect(() => parseWeddingDayCheckInResult({ status: "CHECKED_IN", guestId })).toThrow("Wedding-Day check-in result is unavailable.");
  });
});

describe("check-in list filtering", () => {
  const guests = [
    guest({ guestId, displayName: "Alex Santos", rsvpStatus: "ATTENDING", isCheckedIn: true }),
    guest({ guestId: "30000000-0000-4000-8000-000000000002", displayName: "Bea Santos", rsvpStatus: "DECLINED" }),
    guest({ guestId: "30000000-0000-4000-8000-000000000003", displayName: "Chris Dela Cruz", householdName: "Dela Cruz Household", rsvpStatus: "NO_RESPONSE" }),
  ];

  it("filters by check-in and searches the Guest or Household without hiding RSVP review cases", () => {
    expect(filterWeddingDayGuests(guests, "santos", "ALL")).toHaveLength(2);
    expect(filterWeddingDayGuests(guests, "bea", "NOT_CHECKED_IN").map((item) => item.rsvpStatus)).toEqual(["DECLINED"]);
    expect(filterWeddingDayGuests(guests, "chris", "CHECKED_IN")).toEqual([]);
    expect(filterWeddingDayGuests(guests, "", "NOT_CHECKED_IN").map((item) => item.rsvpStatus)).toEqual(["DECLINED", "NO_RESPONSE"]);
  });
});

describe("check-in reversal result handling", () => {
  it("keeps REVERSED and NOT_CHECKED_IN explicit", () => {
    const reversed = parseWeddingDayReversalResult({ status: "REVERSED", guestId });
    const notCheckedIn = parseWeddingDayReversalResult({ status: "NOT_CHECKED_IN", guestId });
    expect(reversalResultPresentation(reversed).title).toBe("Check-In Reversed");
    expect(reversalResultPresentation(notCheckedIn).title).toBe("Not Checked In");
  });
});
