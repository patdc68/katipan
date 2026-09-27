import { describe, expect, it } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import {
  availableWeddingPeople,
  buildGuestEntries,
  canManageGuestDomain,
  canViewGuestNotes,
  deriveGuestSummary,
  deriveHouseholdProgress,
  filterGuestEntries,
  guestAllowanceLabel,
  guestDraftSchema,
  guestRsvpStatus,
  householdDraftSchema,
  isGuestInWedding,
  isHouseholdInWedding,
  safeGuestError,
  SingleSubmitGate,
  type Guest,
  type GuestHousehold,
  type GuestPerson,
  type GuestRsvp,
  type GuestWorkspaceData,
} from "./model";

const weddingId = "10000000-0000-4000-8000-000000000001";
const otherWeddingId = "10000000-0000-4000-8000-000000000002";
const householdId = "20000000-0000-4000-8000-000000000001";
const secondHouseholdId = "20000000-0000-4000-8000-000000000002";

function household(overrides: Partial<GuestHousehold> = {}): GuestHousehold {
  return {
    id: householdId,
    wedding_id: weddingId,
    display_name: "Santos Family",
    delivery_status: "SENT",
    sent_at: "2026-09-01T12:00:00.000Z",
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function guest(id: string, personId: string, householdIdValue = householdId, overrides: Partial<Guest> = {}): Guest {
  return {
    id,
    wedding_id: weddingId,
    person_id: personId,
    household_id: householdIdValue,
    accessibility_assistance_note: null,
    internal_notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function person(id: string, displayName: string, overrides: Partial<GuestPerson> = {}): GuestPerson {
  return {
    id,
    wedding_id: weddingId,
    display_name: displayName,
    first_name: displayName.split(" ")[0] ?? null,
    last_name: displayName.split(" ")[1] ?? null,
    email: null,
    phone: null,
    linked_user_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function rsvp(guestId: string, status: GuestRsvp["status"]): GuestRsvp {
  return {
    guest_id: guestId,
    wedding_id: weddingId,
    status,
    meal_choice: null,
    dietary_notes: null,
    response_notes: null,
    responded_at: status === "NO_RESPONSE" ? null : "2026-09-02T10:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function workspaceData(): GuestWorkspaceData {
  const g1 = guest("30000000-0000-4000-8000-000000000001", "40000000-0000-4000-8000-000000000001");
  const g2 = guest("30000000-0000-4000-8000-000000000002", "40000000-0000-4000-8000-000000000002");
  const g3 = guest("30000000-0000-4000-8000-000000000003", "40000000-0000-4000-8000-000000000003", secondHouseholdId);
  return {
    weddingId,
    households: [household(), household({ id: secondHouseholdId, display_name: "Ana & Leo", delivery_status: "NOT_SENT", sent_at: null })],
    guests: [g1, g2, g3],
    people: [
      person(g1.person_id, "Maria Santos", { email: "maria@example.com" }),
      person(g2.person_id, "Ramon Santos"),
      person(g3.person_id, "Leo Cruz", { wedding_id: otherWeddingId }),
      person("40000000-0000-4000-8000-000000000004", "Ana Rivera"),
    ],
    rsvps: [rsvp(g1.id, "ATTENDING"), rsvp(g2.id, "DECLINED")],
    groups: [{
      id: "50000000-0000-4000-8000-000000000001",
      wedding_id: weddingId,
      name: "Family",
      sort_order: 0,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    }],
    groupMemberships: [{
      wedding_id: weddingId,
      guest_group_id: "50000000-0000-4000-8000-000000000001",
      guest_id: g1.id,
      created_at: "2026-01-01T00:00:00.000Z",
    }],
    allowances: [],
    allowanceClaims: [],
    householdProgress: [],
    entourage: [],
    seating: [],
  };
}

function membership(role: WorkspaceMembership["role"], status: WorkspaceMembership["status"] = "ACTIVE"): WorkspaceMembership {
  return {
    membershipId: "60000000-0000-4000-8000-000000000001",
    weddingId,
    userId: "70000000-0000-4000-8000-000000000001",
    role,
    status,
    partnerNames: [],
    wedding: {
      id: weddingId,
      display_name: "Garden Wedding",
      wedding_date: null,
      general_location: null,
      status: "ACTIVE",
      origin: "COUPLE_CREATED",
      ownership_mode: "COUPLE_OWNED",
    },
  };
}

describe("guest summaries and Household RSVP progress", () => {
  it("derives Guest counts and invitation delivery counts from individual records", () => {
    const data = workspaceData();
    expect(deriveGuestSummary(data.guests, data.rsvps, data.households)).toEqual({
      totalGuests: 3,
      attending: 1,
      declined: 1,
      noResponse: 1,
      responded: 2,
      rsvpProgressPercent: 67,
      sentHouseholds: 1,
      notSentHouseholds: 1,
    });
    expect(guestRsvpStatus(null)).toBe("NO_RESPONSE");
  });

  it("derives Household progress from named Guest RSVP states without an editable Household RSVP", () => {
    const data = workspaceData();
    expect(deriveHouseholdProgress(householdId, data.guests, data.rsvps)).toMatchObject({
      totalGuests: 2,
      respondedGuests: 2,
      attendingGuests: 1,
      declinedGuests: 1,
      noResponseGuests: 0,
      progress: "RESPONDED",
    });
    expect(deriveHouseholdProgress(secondHouseholdId, data.guests, data.rsvps)).toMatchObject({
      totalGuests: 1,
      respondedGuests: 0,
      progress: "NO_RESPONSE",
    });
    expect(deriveHouseholdProgress("empty-household", data.guests, data.rsvps)).toMatchObject({ totalGuests: 0, progress: "NO_RESPONSE" });
  });
});

describe("Guest list and cross-Wedding guards", () => {
  it("searches names, contact data, Household context and groups, then combines status and group filters", () => {
    const entries = buildGuestEntries(workspaceData());
    expect(filterGuestEntries(entries, { search: "maria@example.com", status: "ALL" }).map((entry) => entry.person.display_name)).toEqual(["Maria Santos"]);
    expect(filterGuestEntries(entries, { search: "Santos Family", status: "DECLINED" }).map((entry) => entry.person.display_name)).toEqual(["Ramon Santos"]);
    expect(filterGuestEntries(entries, { search: "Family", status: "ATTENDING", groupId: "50000000-0000-4000-8000-000000000001" }).map((entry) => entry.person.display_name)).toEqual(["Maria Santos"]);
    expect(filterGuestEntries(entries, { search: "", status: "NO_RESPONSE" }).map((entry) => entry.person.display_name)).toEqual([]);
  });

  it("never offers an existing Wedding Person twice and rejects foreign Household context", () => {
    const data = workspaceData();
    expect(availableWeddingPeople(data, householdId).map((person) => person.display_name)).toEqual(["Ana Rivera"]);
    expect(availableWeddingPeople(data, "foreign-household")).toEqual([]);
  });

  it("filters foreign Guest and Household IDs from detail lookups", () => {
    const data = workspaceData();
    const entries = buildGuestEntries(data);
    const foreignGuest = guest("30000000-0000-4000-8000-000000000099", "40000000-0000-4000-8000-000000000099", householdId, { wedding_id: otherWeddingId });
    const foreignHousehold = household({ id: "20000000-0000-4000-8000-000000000099", wedding_id: otherWeddingId });
    expect(entries.some((entry) => entry.guest.id === foreignGuest.id)).toBe(false);
    expect(isGuestInWedding(foreignGuest, weddingId)).toBe(false);
    expect(isHouseholdInWedding(foreignHousehold, weddingId)).toBe(false);
    expect(isGuestInWedding(data.guests[0], weddingId)).toBe(true);
    expect(isHouseholdInWedding(data.households[0], weddingId)).toBe(true);
  });
});

describe("guest permissions and form validation", () => {
  it("offers guest-domain actions to active Owners, Full Coordinators and Guest Coordinators only", () => {
    expect(canManageGuestDomain(membership("OWNER"))).toBe(true);
    expect(canManageGuestDomain(membership("FULL_COORDINATOR"))).toBe(true);
    expect(canManageGuestDomain(membership("GUEST_COORDINATOR"))).toBe(true);
    expect(canManageGuestDomain(membership("DAY_OF_COORDINATOR"))).toBe(false);
    expect(canViewGuestNotes(membership("DAY_OF_COORDINATOR"))).toBe(false);
    expect(canManageGuestDomain(membership("OWNER", "LEFT"))).toBe(false);
  });

  it("trims Household and Guest form values and validates email without turning an allowance into a Guest", () => {
    expect(householdDraftSchema.parse({ displayName: "  Santos Family ", notes: "  Note  " })).toEqual({ displayName: "Santos Family", notes: "Note" });
    expect(guestDraftSchema.safeParse({
      displayName: " Maria Santos ", firstName: " Maria ", lastName: " Santos ", email: "bad", phone: "", accessibilityAssistanceNote: "", internalNotes: "",
    }).success).toBe(false);
    expect(guestDraftSchema.parse({
      displayName: " Maria Santos ", firstName: " Maria ", lastName: " Santos ", email: " maria@example.com ", phone: "", accessibilityAssistanceNote: "", internalNotes: "",
    }).displayName).toBe("Maria Santos");
    expect(guestAllowanceLabel("PLUS_ONE")).toBe("Plus one");
    expect(guestAllowanceLabel("CHILD")).toBe("Child");
  });

  it("prevents duplicate submits and hides raw database errors", async () => {
    const gate = new SingleSubmitGate();
    let finish: (() => void) | undefined;
    let calls = 0;
    const first = gate.run(() => {
      calls += 1;
      return new Promise<string>((resolve) => { finish = () => resolve("saved"); });
    });
    await expect(gate.run(async () => { calls += 1; return "duplicate"; })).resolves.toBeUndefined();
    expect(calls).toBe(1);
    finish?.();
    await expect(first).resolves.toBe("saved");
    expect(safeGuestError({ code: "42501", message: "private database details" })).toContain("permission");
    expect(safeGuestError({ code: "XX000", message: "private database details" })).toBe("We couldn't save this guest change. Try again.");
  });
});
