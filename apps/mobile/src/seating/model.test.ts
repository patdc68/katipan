import { describe, expect, it } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import {
  buildSeatingGuestEntries,
  buildSeatingOverview,
  canManageSeating,
  deriveHouseholdSplitWarning,
  safeSeatingError,
  seatingTableDraftSchema,
  SeatingSubmitGate,
  type SeatingWorkspaceData,
} from "./model";

const weddingId = "10000000-0000-4000-8000-000000000001";
const foreignWeddingId = "10000000-0000-4000-8000-000000000002";
const receptionId = "20000000-0000-4000-8000-000000000001";
const tableOneId = "30000000-0000-4000-8000-000000000001";
const tableTwoId = "30000000-0000-4000-8000-000000000002";
const guestOneId = "40000000-0000-4000-8000-000000000001";
const guestTwoId = "40000000-0000-4000-8000-000000000002";
const guestThreeId = "40000000-0000-4000-8000-000000000003";
const guestFourId = "40000000-0000-4000-8000-000000000004";
const guestFiveId = "40000000-0000-4000-8000-000000000005";

function workspace(): SeatingWorkspaceData {
  const timestamp = "2026-01-01T00:00:00.000Z";
  return {
    weddingId,
    events: [
      { id: receptionId, wedding_id: weddingId, event_kind: "RECEPTION", name: "Reception", sort_order: 0, visibility: "TABLE_ONLY", created_at: timestamp, updated_at: timestamp },
      { id: "foreign-event", wedding_id: foreignWeddingId, event_kind: "RECEPTION", name: "Private", sort_order: 0, visibility: "HIDDEN", created_at: timestamp, updated_at: timestamp },
    ],
    tables: [
      { id: tableOneId, wedding_id: weddingId, event_id: receptionId, name: "Sampaguita", capacity: 2, shape: "ROUND", table_number: 1, zone: "Garden", notes: null, sort_order: 0, created_at: timestamp, updated_at: timestamp },
      { id: tableTwoId, wedding_id: weddingId, event_id: receptionId, name: "Acacia", capacity: 3, shape: "RECTANGULAR", table_number: 2, zone: null, notes: null, sort_order: 1, created_at: timestamp, updated_at: timestamp },
      { id: "foreign-table", wedding_id: foreignWeddingId, event_id: "foreign-event", name: "Private", capacity: 9, shape: "SQUARE", table_number: 1, zone: null, notes: null, sort_order: 0, created_at: timestamp, updated_at: timestamp },
    ],
    seats: [{ id: "seat-1", wedding_id: weddingId, event_id: receptionId, table_id: tableOneId, label: "A1", sort_order: 0, created_at: timestamp, updated_at: timestamp }],
    assignments: [
      { id: "assignment-1", wedding_id: weddingId, event_id: receptionId, guest_id: guestOneId, table_id: tableOneId, seat_id: "seat-1", created_at: timestamp, updated_at: timestamp },
      { id: "assignment-2", wedding_id: weddingId, event_id: receptionId, guest_id: guestTwoId, table_id: tableTwoId, seat_id: null, created_at: timestamp, updated_at: timestamp },
      { id: "foreign-assignment", wedding_id: foreignWeddingId, event_id: "foreign-event", guest_id: "foreign-guest", table_id: "foreign-table", seat_id: null, created_at: timestamp, updated_at: timestamp },
    ],
    guests: [
      { id: guestOneId, wedding_id: weddingId, household_id: "household-1", person_id: "person-1" },
      { id: guestTwoId, wedding_id: weddingId, household_id: "household-1", person_id: "person-2" },
      { id: guestThreeId, wedding_id: weddingId, household_id: "household-2", person_id: "person-3" },
      { id: guestFourId, wedding_id: weddingId, household_id: "household-2", person_id: "person-4" },
      { id: guestFiveId, wedding_id: weddingId, household_id: "household-2", person_id: "person-5" },
      { id: "foreign-guest", wedding_id: foreignWeddingId, household_id: "foreign-household", person_id: "foreign-person" },
    ],
    people: [
      { id: "person-1", wedding_id: weddingId, display_name: "Juan", first_name: "Juan", last_name: "Reyes" },
      { id: "person-2", wedding_id: weddingId, display_name: "Maria", first_name: "Maria", last_name: "Reyes" },
      { id: "person-3", wedding_id: weddingId, display_name: "Lia", first_name: "Lia", last_name: "Cruz" },
      { id: "person-4", wedding_id: weddingId, display_name: "Nico", first_name: "Nico", last_name: "Cruz" },
      { id: "person-5", wedding_id: weddingId, display_name: "Mika", first_name: "Mika", last_name: "Cruz" },
      { id: "foreign-person", wedding_id: foreignWeddingId, display_name: "Private", first_name: "", last_name: "" },
    ],
    households: [
      { id: "household-1", wedding_id: weddingId, display_name: "Reyes Family" },
      { id: "household-2", wedding_id: weddingId, display_name: "Cruz Family" },
      { id: "foreign-household", wedding_id: foreignWeddingId, display_name: "Private" },
    ],
    rsvps: [
      { wedding_id: weddingId, guest_id: guestOneId, status: "ATTENDING" },
      { wedding_id: weddingId, guest_id: guestTwoId, status: "ATTENDING" },
      { wedding_id: weddingId, guest_id: guestThreeId, status: "DECLINED" },
      { wedding_id: weddingId, guest_id: guestFourId, status: "ATTENDING" },
    ],
  };
}

function membership(role: WorkspaceMembership["role"], wedding = weddingId): WorkspaceMembership {
  return {
    membershipId: "membership-1", weddingId: wedding, userId: "user-1", role, status: "ACTIVE",
    wedding: { id: wedding, display_name: null, wedding_date: null, general_location: null, status: "ACTIVE", origin: "COUPLE_CREATED", ownership_mode: "COUPLE_OWNED" },
    partnerNames: [],
  };
}

describe("seating domain model", () => {
  it("derives Reception table counts, occupancy, capacity and unseated Attending Guests", () => {
    const overview = buildSeatingOverview(workspace());
    expect(overview).toMatchObject({ seatedCount: 2, unseatedAttendingCount: 1, attendingCount: 3, capacity: 5, tableCount: 2 });
    expect(overview?.tables.map((summary) => [summary.occupancy, summary.remaining])).toEqual([[1, 1], [1, 2]]);
  });

  it("keeps only selected Wedding assignments and displays RSVP states without making them seatable", () => {
    const entries = buildSeatingGuestEntries(workspace());
    expect(entries.map((entry) => entry.name)).toEqual(["Juan", "Lia", "Maria", "Mika", "Nico"]);
    expect(entries.find((entry) => entry.guest.id === guestThreeId)?.status).toBe("DECLINED");
    expect(entries.find((entry) => entry.guest.id === guestFiveId)?.status).toBe("NO_RESPONSE");
    expect(entries.some((entry) => entry.name === "Private")).toBe(false);
  });

  it("warns when one Guest's assignment leaves their Household on multiple Tables", () => {
    const splitData = workspace();
    splitData.assignments = splitData.assignments.filter((assignment) => assignment.guest_id !== guestOneId);
    expect(deriveHouseholdSplitWarning(splitData, receptionId, guestOneId, tableOneId)).toBe(true);
    expect(deriveHouseholdSplitWarning(workspace(), receptionId, guestOneId, tableTwoId)).toBe(false);
    expect(deriveHouseholdSplitWarning(workspace(), receptionId, guestFourId, tableOneId)).toBe(false);
  });

  it("validates positive capacity and optional positive table numbers", () => {
    expect(seatingTableDraftSchema.safeParse({ name: "Table", tableNumber: "", capacity: "1", shape: "ROUND", zone: "", notes: "", sortOrder: 0 }).success).toBe(true);
    expect(seatingTableDraftSchema.safeParse({ name: "Table", tableNumber: "0", capacity: "1", shape: "ROUND", zone: "", notes: "", sortOrder: 0 }).success).toBe(false);
    expect(seatingTableDraftSchema.safeParse({ name: "Table", tableNumber: "1", capacity: "0", shape: "ROUND", zone: "", notes: "", sortOrder: 0 }).success).toBe(false);
    expect(seatingTableDraftSchema.parse({ name: "Table", tableNumber: "", capacity: "1", shape: "ROUND", zone: "", notes: "", sortOrder: 0 }).tableNumber).toBeNull();
  });

  it("shows actions only for active manager roles and keeps DAY_OF read-only", () => {
    for (const role of ["OWNER", "FULL_COORDINATOR", "GUEST_COORDINATOR"] as const) expect(canManageSeating(membership(role))).toBe(true);
    expect(canManageSeating(membership("DAY_OF_COORDINATOR"))).toBe(false);
    expect(canManageSeating({ ...membership("OWNER"), status: "LEFT" })).toBe(false);
    expect(canManageSeating({ ...membership("OWNER"), weddingId: foreignWeddingId })).toBe(false);
  });

  it("maps capacity, duplicate Reception and authorization errors into safe UI messages", () => {
    expect(safeSeatingError({ code: "23514", message: "seating table capacity exceeded" }, "fallback")).toMatch(/capacity/i);
    expect(safeSeatingError({ code: "23505", message: "seating_events_one_reception_idx" }, "fallback")).toMatch(/already exists/i);
    expect(safeSeatingError({ code: "42501", message: "private" }, "fallback")).toMatch(/read-only/i);
  });

  it("blocks overlapping submits while a mutation is pending", async () => {
    const gate = new SeatingSubmitGate();
    let finish: (() => void) | undefined;
    let calls = 0;
    const first = gate.run(() => new Promise<void>((resolve) => { calls += 1; finish = resolve; }));
    const second = await gate.run(async () => { calls += 1; });
    expect(second).toBeUndefined();
    finish?.();
    await first;
    expect(calls).toBe(1);
  });
});
