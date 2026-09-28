import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import {
  createReceptionEvent,
  createSeatingSeat,
  createSeatingTable,
  deleteSeatingSeat,
  deleteSeatingTable,
  seatGuest,
  setReceptionVisibility,
  unseatGuest,
  updateReceptionEvent,
  updateSeatingSeat,
  updateSeatingTable,
} from "./api";
import { safeSeatingError, type SeatingWorkspaceData } from "./model";

const weddingId = "10000000-0000-4000-8000-000000000001";
const otherWeddingId = "10000000-0000-4000-8000-000000000002";
const eventId = "20000000-0000-4000-8000-000000000001";
const tableId = "30000000-0000-4000-8000-000000000001";
const seatId = "40000000-0000-4000-8000-000000000001";
const guestId = "50000000-0000-4000-8000-000000000001";

const state = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  tables: {} as Record<string, Record<string, unknown>[]>,
}));

vi.mock("../auth/client", () => ({ supabase: { from: state.from, rpc: state.rpc } }));

function rowsFor(table: string, filters: [string, unknown][]) {
  return (state.tables[table] ?? []).filter((row) => filters.every(([key, value]) => row[key] === value));
}

function makeQuery(table: string) {
  const filters: [string, unknown][] = [];
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; });
  query.order = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({ data: rowsFor(table, filters)[0] ?? null, error: null }));
  query.then = (resolve: (value: unknown) => unknown, reject: (cause: unknown) => unknown) => Promise.resolve({ data: rowsFor(table, filters), error: null }).then(resolve, reject);
  return query;
}

function membership(role: WorkspaceMembership["role"] = "OWNER", wedding = weddingId): WorkspaceMembership {
  return {
    membershipId: "membership-1", weddingId: wedding, userId: "user-1", role, status: "ACTIVE",
    wedding: { id: wedding, display_name: null, wedding_date: null, general_location: null, status: "ACTIVE", origin: "COUPLE_CREATED", ownership_mode: "COUPLE_OWNED" },
    partnerNames: [],
  };
}

function baseRows() {
  const time = "2026-01-01T00:00:00.000Z";
  return {
    seating_events: [{ id: eventId, wedding_id: weddingId, name: "Reception", event_kind: "RECEPTION", sort_order: 0, visibility: "HIDDEN", created_at: time, updated_at: time }],
    seating_tables: [{ id: tableId, wedding_id: weddingId, event_id: eventId, name: "Sampaguita", capacity: 8, shape: "ROUND", table_number: 1, zone: null, notes: null, sort_order: 0, created_at: time, updated_at: time }],
    seating_seats: [{ id: seatId, wedding_id: weddingId, event_id: eventId, table_id: tableId, label: "A1", sort_order: 0, created_at: time, updated_at: time }],
    guests: [{ id: guestId, wedding_id: weddingId }],
    guest_rsvps: [{ wedding_id: weddingId, guest_id: guestId, status: "ATTENDING" }],
  };
}

function data(assignments: SeatingWorkspaceData["assignments"] = []): SeatingWorkspaceData {
  return {
    weddingId,
    events: [], tables: [], seats: [], assignments, guests: [], people: [], households: [], rsvps: [],
  };
}

const tableDraft = { name: "Sampaguita", tableNumber: 1, capacity: 8, shape: "ROUND" as const, zone: "Garden", notes: "Near the aisle", sortOrder: 0 };
const seatDraft = { label: "A2", sortOrder: 1 };

beforeEach(() => {
  state.tables = baseRows();
  state.from.mockImplementation((table: string) => makeQuery(table));
  state.rpc.mockReset().mockResolvedValue({ data: "mutation-id", error: null });
});

describe("seating RPC workflows", () => {
  it("creates only the Reception event and maps a duplicate Reception safely", async () => {
    await createReceptionEvent(membership(), { name: "Reception", sortOrder: 0 });
    expect(state.rpc).toHaveBeenCalledWith("create_seating_event", {
      p_wedding_id: weddingId, p_name: "Reception", p_event_kind: "RECEPTION", p_sort_order: 0,
    });
    state.rpc.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "seating_events_one_reception_idx" } });
    await expect(createReceptionEvent(membership())).rejects.toMatchObject({ code: "23505" });
    expect(safeSeatingError({ code: "23505", message: "seating_events_one_reception_idx" }, "fallback")).toMatch(/already exists/i);
  });

  it("updates the Reception name and visibility through their RPCs", async () => {
    await updateReceptionEvent(membership(), eventId, { name: "The Reception", sortOrder: 0 });
    await setReceptionVisibility(membership(), eventId, "TABLE_AND_SEAT");
    expect(state.rpc).toHaveBeenNthCalledWith(1, "update_seating_event", {
      p_event_id: eventId, p_name: "The Reception", p_event_kind: "RECEPTION", p_sort_order: 0,
    });
    expect(state.rpc).toHaveBeenNthCalledWith(2, "set_seating_visibility", { p_event_id: eventId, p_visibility: "TABLE_AND_SEAT" });
  });

  it("maps create, update and delete Table actions to RPCs and blocks capacity below occupancy", async () => {
    await createSeatingTable(membership(), eventId, tableDraft);
    expect(state.rpc).toHaveBeenCalledWith("create_seating_table", expect.objectContaining({ p_event_id: eventId, p_capacity: 8, p_table_number: 1 }));
    const assignments = [guestId, "50000000-0000-4000-8000-000000000002"].map((id, index) => ({
      id: `assignment-${index}`, wedding_id: weddingId, event_id: eventId, table_id: tableId, guest_id: id, seat_id: null,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    }));
    await expect(updateSeatingTable(membership(), tableId, { ...tableDraft, capacity: 1 }, data(assignments)))
      .rejects.toMatchObject({ code: "23514" });
    expect(state.rpc).toHaveBeenCalledTimes(1);
    await updateSeatingTable(membership(), tableId, { ...tableDraft, capacity: 8 }, data(assignments));
    await deleteSeatingTable(membership(), tableId);
    expect(state.rpc).toHaveBeenNthCalledWith(2, "update_seating_table", expect.objectContaining({ p_table_id: tableId, p_capacity: 8 }));
    expect(state.rpc).toHaveBeenNthCalledWith(3, "delete_seating_table", { p_table_id: tableId });
  });

  it("creates, updates and deletes exact Seats through their RPCs", async () => {
    await createSeatingSeat(membership(), tableId, seatDraft);
    await updateSeatingSeat(membership(), seatId, { label: "A2 revised", sortOrder: 2 });
    await deleteSeatingSeat(membership(), seatId);
    expect(state.rpc).toHaveBeenNthCalledWith(1, "create_seating_seat", { p_table_id: tableId, p_label: "A2", p_sort_order: 1 });
    expect(state.rpc).toHaveBeenNthCalledWith(2, "update_seating_seat", { p_seat_id: seatId, p_label: "A2 revised", p_sort_order: 2 });
    expect(state.rpc).toHaveBeenNthCalledWith(3, "delete_seating_seat", { p_seat_id: seatId });
  });

  it("uses seat_guest for both first assignment and atomic move, including optional exact Seat", async () => {
    await seatGuest(membership(), eventId, guestId, tableId, seatId);
    expect(state.rpc).toHaveBeenCalledWith("seat_guest", { p_event_id: eventId, p_guest_id: guestId, p_table_id: tableId, p_seat_id: seatId });
    await seatGuest(membership(), eventId, guestId, tableId, null);
    expect(state.rpc).toHaveBeenLastCalledWith("seat_guest", { p_event_id: eventId, p_guest_id: guestId, p_table_id: tableId, p_seat_id: undefined });
  });

  it("rejects Declined and No Response Guests before calling the assignment RPC", async () => {
    state.tables.guest_rsvps = [{ wedding_id: weddingId, guest_id: guestId, status: "DECLINED" }];
    await expect(seatGuest(membership(), eventId, guestId, tableId, null)).rejects.toMatchObject({ code: "23514" });
    expect(state.rpc).not.toHaveBeenCalled();
    state.tables.guest_rsvps = [];
    await expect(seatGuest(membership(), eventId, guestId, tableId, null)).rejects.toMatchObject({ code: "23514" });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("maps Table capacity and occupied exact Seat conflicts without changing RSVP", async () => {
    state.rpc.mockResolvedValueOnce({ data: null, error: { code: "23514", message: "Seating Table is at capacity" } });
    await expect(seatGuest(membership(), eventId, guestId, tableId, null)).rejects.toMatchObject({ code: "23514" });
    expect(safeSeatingError({ code: "23514", message: "Seating Table is at capacity" }, "fallback")).toMatch(/capacity/i);
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc.mock.calls[0]?.[0]).toBe("seat_guest");
    state.rpc.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "seating_assignments_seat_key" } });
    await expect(seatGuest(membership(), eventId, guestId, tableId, seatId)).rejects.toMatchObject({ code: "23505" });
    expect(safeSeatingError({ code: "23505", message: "seating_assignments_seat_key" }, "fallback")).toMatch(/Seat/i);
  });

  it("does not reveal or mutate a Guest, Event, Table or Seat from another Wedding", async () => {
    await expect(seatGuest(membership(), "foreign-event", guestId, tableId, null)).rejects.toMatchObject({ code: "22023" });
    await expect(seatGuest(membership(), eventId, guestId, "foreign-table", null)).rejects.toMatchObject({ code: "22023" });
    state.tables.guests = [{ id: guestId, wedding_id: otherWeddingId }];
    await expect(seatGuest(membership(), eventId, guestId, tableId, null)).rejects.toMatchObject({ code: "22023" });
    state.tables.guests = baseRows().guests;
    await expect(seatGuest(membership(), eventId, guestId, tableId, "foreign-seat")).rejects.toMatchObject({ code: "22023" });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("unseats through the dedicated RPC and keeps DAY_OF_COORDINATOR read-only", async () => {
    await unseatGuest(membership(), eventId, guestId);
    expect(state.rpc).toHaveBeenCalledWith("unseat_guest", { p_event_id: eventId, p_guest_id: guestId });
    state.rpc.mockClear();
    await expect(createReceptionEvent(membership("DAY_OF_COORDINATOR"))).rejects.toMatchObject({ code: "42501" });
    await expect(unseatGuest(membership("DAY_OF_COORDINATOR"), eventId, guestId)).rejects.toMatchObject({ code: "42501" });
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
