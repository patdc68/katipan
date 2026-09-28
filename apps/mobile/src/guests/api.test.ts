import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import {
  addExistingPersonAsGuest,
  claimGuestAllowance,
  createGuest,
  createGuestHousehold,
  loadGuestWorkspace,
  markHouseholdInvitationSent,
  releaseGuestAllowanceClaim,
  resetHouseholdInvitationDelivery,
  setGuestRsvp,
  updateGuestHousehold,
  updateGuestPerson,
} from "./api";
import type { GuestDraft, HouseholdDraft } from "./model";

type QueryRecord = {
  table: string;
  columns: string;
  filters: { operator: string; column: string; value: unknown }[];
  single: boolean;
  update?: Record<string, unknown>;
};

const ids = {
  wedding: "10000000-0000-4000-8000-000000000001",
  foreignWedding: "10000000-0000-4000-8000-000000000002",
  household: "20000000-0000-4000-8000-000000000001",
  foreignHousehold: "20000000-0000-4000-8000-000000000002",
  newHousehold: "20000000-0000-4000-8000-000000000003",
  guest: "30000000-0000-4000-8000-000000000001",
  secondGuest: "30000000-0000-4000-8000-000000000002",
  foreignGuest: "30000000-0000-4000-8000-000000000003",
  newGuest: "30000000-0000-4000-8000-000000000004",
  person: "40000000-0000-4000-8000-000000000001",
  secondPerson: "40000000-0000-4000-8000-000000000002",
  newPerson: "40000000-0000-4000-8000-000000000003",
  allowance: "50000000-0000-4000-8000-000000000001",
  group: "60000000-0000-4000-8000-000000000001",
  event: "70000000-0000-4000-8000-000000000001",
  table: "80000000-0000-4000-8000-000000000001",
  owner: "90000000-0000-4000-8000-000000000001",
  user: "a0000000-0000-4000-8000-000000000001",
};

const { from, rpc, records } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  records: [] as QueryRecord[],
}));

vi.mock("../auth/client", () => ({ supabase: { from, rpc } }));

function household(id = ids.household) {
  return {
    id,
    wedding_id: ids.wedding,
    display_name: "Santos Family",
    delivery_status: "NOT_SENT",
    sent_at: null,
    notes: "Call after 5 PM",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function guest(id = ids.guest, personId = ids.person, householdId = ids.household, weddingId = ids.wedding) {
  return {
    id,
    wedding_id: weddingId,
    person_id: personId,
    household_id: householdId,
    accessibility_assistance_note: null,
    internal_notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function person(id = ids.person) {
  return {
    id,
    wedding_id: ids.wedding,
    display_name: id === ids.person ? "Maria Santos" : "Ramon Santos",
    first_name: "Maria",
    last_name: "Santos",
    email: "maria@example.com",
    phone: null,
    linked_user_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

const guestRows = [guest(), guest(ids.secondGuest, ids.secondPerson), guest(ids.foreignGuest, "40000000-0000-4000-8000-000000000099", ids.foreignHousehold, ids.foreignWedding)];
const householdRows = [household()];
const personRows = [person(), person(ids.secondPerson), person(ids.newPerson)];

function matches(row: Record<string, unknown>, record: QueryRecord): boolean {
  return record.filters.filter((filter) => filter.operator === "eq")
    .every((filter) => row[filter.column] === filter.value);
}

function responseFor(record: QueryRecord): { data: unknown; error: null } {
  if (record.update) return { data: record.single ? { id: ids.household } : [{ id: ids.household }], error: null };
  const weddingFilter = record.filters.find((filter) => filter.column === "wedding_id" && filter.operator === "eq");
  if (weddingFilter && weddingFilter.value !== ids.wedding) return { data: record.single ? null : [], error: null };
  let rows: Record<string, unknown>[];
  switch (record.table) {
    case "guest_households": rows = householdRows; break;
    case "guests": rows = guestRows; break;
    case "wedding_people": rows = personRows; break;
    case "guest_rsvps": rows = [{
      guest_id: ids.guest, wedding_id: ids.wedding, status: "NO_RESPONSE", meal_choice: null, dietary_notes: null,
      response_notes: null, responded_at: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    }]; break;
    case "guest_groups": rows = [{ id: ids.group, wedding_id: ids.wedding, name: "Family", sort_order: 0, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }]; break;
    case "guest_group_memberships": rows = [{ wedding_id: ids.wedding, guest_group_id: ids.group, guest_id: ids.guest, created_at: "2026-01-01T00:00:00.000Z" }]; break;
    case "guest_allowances": rows = [{ id: ids.allowance, wedding_id: ids.wedding, household_id: ids.household, sponsor_guest_id: null, allowance_type: "PLUS_ONE", max_count: 1, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }]; break;
    case "guest_allowance_claims": rows = []; break;
    case "guest_household_rsvp_progress": rows = [{ household_id: ids.household, wedding_id: ids.wedding, total_guests: 2, responded_guests: 0, attending_guests: 0, declined_guests: 0, progress: "NO_RESPONSE" }]; break;
    case "entourage_roles": rows = [{ id: ids.group, wedding_id: ids.wedding, name: "Maid of Honor", description: null, preset_key: null, sort_order: 0, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }]; break;
    case "entourage_assignments": rows = [{ id: "e0000000-0000-4000-8000-000000000001", wedding_id: ids.wedding, role_id: ids.group, guest_id: ids.guest, created_at: "2026-01-01T00:00:00.000Z" }]; break;
    case "seating_events": rows = [{ id: ids.event, wedding_id: ids.wedding, name: "Reception", event_kind: "RECEPTION", sort_order: 0, visibility: "TABLE_ONLY", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }]; break;
    case "seating_tables": rows = [{ id: ids.table, wedding_id: ids.wedding, event_id: ids.event, name: "Sampaguita", table_number: 1, capacity: 8, shape: "ROUND", sort_order: 0, zone: null, notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }]; break;
    case "seating_seats": rows = [{ id: "f1000000-0000-4000-8000-000000000001", wedding_id: ids.wedding, event_id: ids.event, table_id: ids.table, label: "A1", sort_order: 0, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }]; break;
    case "seating_assignments": rows = [{ id: "f0000000-0000-4000-8000-000000000001", wedding_id: ids.wedding, event_id: ids.event, table_id: ids.table, seat_id: "f1000000-0000-4000-8000-000000000001", guest_id: ids.guest, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }]; break;
    default: throw new Error("Unexpected guest query: " + record.table);
  }
  const selected = rows.filter((row) => matches(row, record));
  return { data: record.single ? selected[0] ?? null : selected, error: null };
}

function mockQueries() {
  records.splice(0, records.length);
  from.mockReset();
  rpc.mockReset();
  from.mockImplementation((table: string) => {
    const record: QueryRecord = { table, columns: "", filters: [], single: false };
    records.push(record);
    const query = {
      select(columns: string) { record.columns = columns; return query; },
      update(fields: Record<string, unknown>) { record.update = fields; return query; },
      eq(column: string, value: unknown) { record.filters.push({ operator: "eq", column, value }); return query; },
      order() { return query; },
      maybeSingle() { record.single = true; return Promise.resolve(responseFor(record)); },
      then(onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) {
        return Promise.resolve(responseFor(record)).then(onfulfilled, onrejected);
      },
    };
    return query;
  });
  rpc.mockImplementation(async (name: string) => ({
    data: name === "create_guest_household" ? ids.newHousehold
      : name === "create_guest" ? [{ person_id: ids.newPerson, guest_id: ids.newGuest }]
        : name === "add_existing_person_as_guest" ? ids.newGuest
          : name === "update_guest_person" ? ids.person
            : name === "mark_household_invitation_sent" ? "2026-09-01T12:00:00.000Z"
              : true,
    error: null,
  }));
}

function membership(role: WorkspaceMembership["role"] = "OWNER", weddingId = ids.wedding): WorkspaceMembership {
  return {
    membershipId: ids.owner,
    weddingId,
    userId: ids.user,
    role,
    status: "ACTIVE",
    partnerNames: ["Maria Santos"],
    wedding: {
      id: weddingId,
      display_name: "Garden Wedding",
      wedding_date: "2027-06-12",
      general_location: "Manila",
      status: "ACTIVE",
      origin: "COUPLE_CREATED",
      ownership_mode: "COUPLE_OWNED",
    },
  };
}

const householdDraft: HouseholdDraft = { displayName: "  Santos Family  ", notes: "   " };
const guestDraft: GuestDraft = {
  displayName: " Maria Santos ",
  firstName: " Maria ",
  lastName: " Santos ",
  email: " maria@example.com ",
  phone: " 09170000000 ",
  accessibilityAssistanceNote: "   ",
  internalNotes: " Call before arrival ",
};

describe("guest workspace data scope", () => {
  beforeEach(mockQueries);

  it("loads all guest-domain records and optional entourage/seating summaries inside the selected Wedding", async () => {
    const data = await loadGuestWorkspace(membership());
    expect(data.weddingId).toBe(ids.wedding);
    expect(data.households).toHaveLength(1);
    expect(data.guests.map((item) => item.wedding_id)).toEqual([ids.wedding, ids.wedding]);
    expect(data.householdProgress[0]?.progress).toBe("NO_RESPONSE");
    expect(data.entourage).toEqual([{ guestId: ids.guest, roleName: "Maid of Honor" }]);
    expect(data.seating).toEqual([{ guestId: ids.guest, eventName: "Reception", tableName: "Sampaguita", hasSeat: true, seatLabel: "A1" }]);
    expect(records).toHaveLength(15);
    expect(records.every((record) => record.filters.some((filter) => filter.column === "wedding_id" && filter.value === ids.wedding))).toBe(true);
  });
});

describe("guest Household and person RPC mapping", () => {
  beforeEach(mockQueries);

  it("maps Household creation to create_guest_household", async () => {
    await expect(createGuestHousehold(membership(), householdDraft)).resolves.toBe(ids.newHousehold);
    expect(rpc).toHaveBeenCalledWith("create_guest_household", {
      p_wedding_id: ids.wedding,
      p_display_name: "Santos Family",
      p_notes: null,
    });
  });

  it("maps a named Guest to create_guest and does not make a synthetic allowance person", async () => {
    await expect(createGuest(membership(), ids.household, guestDraft)).resolves.toBe(ids.newGuest);
    expect(rpc).toHaveBeenCalledWith("create_guest", {
      p_wedding_id: ids.wedding,
      p_household_id: ids.household,
      p_display_name: "Maria Santos",
      p_first_name: "Maria",
      p_last_name: "Santos",
      p_email: "maria@example.com",
      p_phone: "09170000000",
      p_accessibility_assistance_note: null,
      p_internal_notes: "Call before arrival",
    });
    expect(rpc).not.toHaveBeenCalledWith("claim_guest_allowance", expect.anything());
  });

  it("adds an unused Wedding Person through add_existing_person_as_guest without duplicating that person", async () => {
    await expect(addExistingPersonAsGuest(membership(), ids.household, ids.newPerson)).resolves.toBe(ids.newGuest);
    expect(records.some((record) => record.table === "wedding_people" && record.filters.some((filter) => filter.column === "id" && filter.value === ids.newPerson))).toBe(true);
    expect(rpc).toHaveBeenCalledWith("add_existing_person_as_guest", {
      p_wedding_id: ids.wedding,
      p_person_id: ids.newPerson,
      p_household_id: ids.household,
    });
    expect(rpc).not.toHaveBeenCalledWith("create_guest", expect.anything());
  });

  it("rejects a Wedding Person that already has a Guest row", async () => {
    await expect(addExistingPersonAsGuest(membership(), ids.household, ids.person)).rejects.toMatchObject({ code: "23505" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("edits Household name and notes with a same-Wedding RLS update", async () => {
    await updateGuestHousehold(membership(), ids.household, { displayName: " The Santos Family ", notes: " Updated note " });
    const update = records.find((record) => record.table === "guest_households" && record.update);
    expect(update?.update).toEqual({ display_name: "The Santos Family", notes: "Updated note" });
    expect(update?.filters).toEqual(expect.arrayContaining([
      { operator: "eq", column: "id", value: ids.household },
      { operator: "eq", column: "wedding_id", value: ids.wedding },
    ]));
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("Guest updates, RSVP, invitations and claims", () => {
  beforeEach(mockQueries);

  it("updates existing person fields through update_guest_person", async () => {
    await updateGuestPerson(membership(), ids.guest, guestDraft);
    expect(rpc).toHaveBeenCalledWith("update_guest_person", {
      p_wedding_id: ids.wedding,
      p_guest_id: ids.guest,
      p_display_name: "Maria Santos",
      p_first_name: "Maria",
      p_last_name: "Santos",
      p_email: "maria@example.com",
      p_phone: "09170000000",
    });
  });

  it("records one Guest's RSVP and meal fields through set_guest_rsvp", async () => {
    await setGuestRsvp(membership(), ids.guest, "ATTENDING", "Vegetarian", "No shellfish", "Arriving after 6");
    expect(rpc).toHaveBeenCalledWith("set_guest_rsvp", {
      p_guest_id: ids.guest,
      p_status: "ATTENDING",
      p_meal_choice: "Vegetarian",
      p_dietary_notes: "No shellfish",
      p_response_notes: "Arriving after 6",
    });
  });

  it("marks and resets Household delivery using separate delivery RPCs", async () => {
    await markHouseholdInvitationSent(membership(), ids.household);
    await resetHouseholdInvitationDelivery(membership(), ids.household);
    expect(rpc).toHaveBeenNthCalledWith(1, "mark_household_invitation_sent", { p_household_id: ids.household });
    expect(rpc).toHaveBeenNthCalledWith(2, "reset_household_invitation_delivery", { p_household_id: ids.household });
  });

  it("claims and releases an allowance against an existing Guest without creating a Guest", async () => {
    await claimGuestAllowance(membership(), ids.allowance, ids.guest);
    await releaseGuestAllowanceClaim(membership(), ids.allowance, ids.guest);
    expect(rpc).toHaveBeenNthCalledWith(1, "claim_guest_allowance", { p_allowance_id: ids.allowance, p_guest_id: ids.guest });
    expect(rpc).toHaveBeenNthCalledWith(2, "release_guest_allowance_claim", { p_allowance_id: ids.allowance, p_guest_id: ids.guest });
    expect(rpc).not.toHaveBeenCalledWith("create_guest", expect.anything());
    expect(records.filter((record) => record.table === "guests").every((record) => record.filters.some((filter) => filter.column === "wedding_id" && filter.value === ids.wedding))).toBe(true);
  });
});

describe("guest cross-Wedding and role guards", () => {
  beforeEach(mockQueries);

  it("rejects Guest and Household IDs from another Wedding before calling an RPC", async () => {
    await expect(updateGuestPerson(membership(), ids.foreignGuest, guestDraft)).rejects.toMatchObject({ code: "22023" });
    await expect(markHouseholdInvitationSent(membership(), ids.foreignHousehold)).rejects.toMatchObject({ code: "22023" });
    expect(records.slice(0, 2).every((record) => record.filters.some((filter) => filter.column === "wedding_id" && filter.value === ids.wedding))).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("blocks Day-of mutations before reading or invoking RPCs", async () => {
    await expect(createGuestHousehold(membership("DAY_OF_COORDINATOR"), householdDraft)).rejects.toMatchObject({ code: "42501" });
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not let a stale membership mutate a different selected Wedding", async () => {
    const staleMembership = membership();
    staleMembership.wedding = { ...staleMembership.wedding, id: ids.foreignWedding };
    await expect(createGuestHousehold(staleMembership, householdDraft)).rejects.toMatchObject({ code: "42501" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
