import type { Database } from "@katipan/database/types";
import { supabase } from "../auth/client";
import type { WorkspaceMembership } from "../workspace/model";
import {
  assertActiveSeatingMembership,
  assertSeatingManager,
  seatingSeatDraftSchema,
  seatingTableDraftSchema,
  seatingEventDraftSchema,
  type SeatingEvent,
  type SeatingSeat,
  type SeatingWorkspaceData,
  type SeatingTable,
  type SeatingVisibility,
  type SeatingTableShape,
  type SeatingEventDraft,
  type SeatingSeatDraft,
  type SeatingTableDraft,
} from "./model";

function unavailable(message: string): Error {
  return Object.assign(new Error(message), { code: "22023" });
}

async function assertReceptionEvent(weddingId: string, eventId: string): Promise<SeatingEvent> {
  const { data, error } = await supabase.from("seating_events").select("*")
    .eq("id", eventId).eq("wedding_id", weddingId).eq("event_kind", "RECEPTION").maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId || data.event_kind !== "RECEPTION") throw unavailable("Seating Event is unavailable.");
  return data;
}

async function assertTable(weddingId: string, tableId: string, eventId?: string): Promise<SeatingTable> {
  let query = supabase.from("seating_tables").select("*").eq("id", tableId).eq("wedding_id", weddingId);
  if (eventId) query = query.eq("event_id", eventId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId || (eventId && data.event_id !== eventId)) throw unavailable("Seating Table is unavailable.");
  return data;
}

async function assertSeat(weddingId: string, seatId: string, tableId?: string): Promise<SeatingSeat> {
  let query = supabase.from("seating_seats").select("*").eq("id", seatId).eq("wedding_id", weddingId);
  if (tableId) query = query.eq("table_id", tableId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId || (tableId && data.table_id !== tableId)) throw unavailable("Seat is unavailable.");
  return data;
}

async function assertGuest(weddingId: string, guestId: string): Promise<void> {
  const { data, error } = await supabase.from("guests").select("id,wedding_id")
    .eq("id", guestId).eq("wedding_id", weddingId).maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId) throw unavailable("Guest is unavailable.");
}

function assertLoadedWedding(data: SeatingWorkspaceData, membership: WorkspaceMembership): void {
  assertActiveSeatingMembership(membership);
  if (data.weddingId !== membership.weddingId) throw unavailable("Seating data is unavailable in the selected Wedding.");
}

export async function loadSeatingWorkspace(membership: WorkspaceMembership): Promise<SeatingWorkspaceData> {
  assertActiveSeatingMembership(membership);
  const weddingId = membership.weddingId;
  const [events, tables, seats, assignments, guests, people, households, rsvps] = await Promise.all([
    supabase.from("seating_events").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("seating_tables").select("*").eq("wedding_id", weddingId).order("sort_order").order("table_number"),
    supabase.from("seating_seats").select("*").eq("wedding_id", weddingId).order("sort_order").order("label"),
    supabase.from("seating_assignments").select("*").eq("wedding_id", weddingId),
    supabase.from("guests").select("id,wedding_id,household_id,person_id").eq("wedding_id", weddingId),
    supabase.from("wedding_people").select("id,wedding_id,display_name,first_name,last_name").eq("wedding_id", weddingId),
    supabase.from("guest_households").select("id,wedding_id,display_name").eq("wedding_id", weddingId),
    supabase.from("guest_rsvps").select("wedding_id,guest_id,status").eq("wedding_id", weddingId),
  ]);
  const failure = [events.error, tables.error, seats.error, assignments.error, guests.error, people.error, households.error, rsvps.error].find(Boolean);
  if (failure) throw failure;
  return {
    weddingId,
    events: (events.data ?? []).filter((row) => row.wedding_id === weddingId),
    tables: (tables.data ?? []).filter((row) => row.wedding_id === weddingId),
    seats: (seats.data ?? []).filter((row) => row.wedding_id === weddingId),
    assignments: (assignments.data ?? []).filter((row) => row.wedding_id === weddingId),
    guests: (guests.data ?? []).filter((row) => row.wedding_id === weddingId),
    people: (people.data ?? []).filter((row) => row.wedding_id === weddingId),
    households: (households.data ?? []).filter((row) => row.wedding_id === weddingId),
    rsvps: (rsvps.data ?? []).filter((row) => row.wedding_id === weddingId),
  };
}

export async function createReceptionEvent(membership: WorkspaceMembership, draft: SeatingEventDraft = { name: "Reception", sortOrder: 0 }): Promise<string> {
  assertSeatingManager(membership);
  const value = seatingEventDraftSchema.parse(draft);
  const { data, error } = await supabase.rpc("create_seating_event", {
    p_wedding_id: membership.weddingId,
    p_name: value.name,
    p_event_kind: "RECEPTION",
    p_sort_order: value.sortOrder,
  });
  if (error) throw error;
  if (!data) throw new Error("Reception Seating Event could not be created.");
  return data;
}

export async function updateReceptionEvent(membership: WorkspaceMembership, eventId: string, draft: SeatingEventDraft): Promise<void> {
  assertSeatingManager(membership);
  await assertReceptionEvent(membership.weddingId, eventId);
  const value = seatingEventDraftSchema.parse(draft);
  const { error } = await supabase.rpc("update_seating_event", {
    p_event_id: eventId, p_name: value.name, p_event_kind: "RECEPTION", p_sort_order: value.sortOrder,
  });
  if (error) throw error;
}

export async function setReceptionVisibility(membership: WorkspaceMembership, eventId: string, visibility: SeatingVisibility): Promise<void> {
  assertSeatingManager(membership);
  await assertReceptionEvent(membership.weddingId, eventId);
  const { error } = await supabase.rpc("set_seating_visibility", { p_event_id: eventId, p_visibility: visibility });
  if (error) throw error;
}

export async function createSeatingTable(membership: WorkspaceMembership, eventId: string, draft: SeatingTableDraft): Promise<string> {
  assertSeatingManager(membership);
  await assertReceptionEvent(membership.weddingId, eventId);
  const value = seatingTableDraftSchema.parse(draft);
  const { data, error } = await supabase.rpc("create_seating_table", {
    p_event_id: eventId,
    p_name: value.name,
    p_capacity: value.capacity,
    p_shape: value.shape as SeatingTableShape,
    p_table_number: value.tableNumber ?? undefined,
    p_zone: value.zone || undefined,
    p_notes: value.notes || undefined,
    p_sort_order: value.sortOrder,
  });
  if (error) throw error;
  if (!data) throw new Error("Seating Table could not be created.");
  return data;
}

export async function updateSeatingTable(membership: WorkspaceMembership, tableId: string, draft: SeatingTableDraft, data: SeatingWorkspaceData): Promise<void> {
  assertSeatingManager(membership);
  assertLoadedWedding(data, membership);
  const table = await assertTable(membership.weddingId, tableId);
  await assertReceptionEvent(membership.weddingId, table.event_id);
  const value = seatingTableDraftSchema.parse(draft);
  const occupancy = data.assignments.filter((assignment) => assignment.wedding_id === membership.weddingId
    && assignment.event_id === table.event_id && assignment.table_id === tableId).length;
  if (value.capacity < occupancy) throw Object.assign(new Error("Table capacity cannot be reduced below its current occupancy."), { code: "23514" });
  const { error } = await supabase.rpc("update_seating_table", {
    p_table_id: tableId,
    p_name: value.name,
    p_capacity: value.capacity,
    p_shape: value.shape as SeatingTableShape,
    p_table_number: value.tableNumber as number,
    p_zone: (value.zone || null) as unknown as string,
    p_notes: (value.notes || null) as unknown as string,
    p_sort_order: value.sortOrder,
  });
  if (error) throw error;
}

export async function deleteSeatingTable(membership: WorkspaceMembership, tableId: string): Promise<void> {
  assertSeatingManager(membership);
  const table = await assertTable(membership.weddingId, tableId);
  await assertReceptionEvent(membership.weddingId, table.event_id);
  const { error } = await supabase.rpc("delete_seating_table", { p_table_id: tableId });
  if (error) throw error;
}

export async function createSeatingSeat(membership: WorkspaceMembership, tableId: string, draft: SeatingSeatDraft): Promise<string> {
  assertSeatingManager(membership);
  const table = await assertTable(membership.weddingId, tableId);
  await assertReceptionEvent(membership.weddingId, table.event_id);
  const value = seatingSeatDraftSchema.parse(draft);
  const { data, error } = await supabase.rpc("create_seating_seat", { p_table_id: tableId, p_label: value.label, p_sort_order: value.sortOrder });
  if (error) throw error;
  if (!data) throw new Error("Seat could not be created.");
  return data;
}

export async function updateSeatingSeat(membership: WorkspaceMembership, seatId: string, draft: SeatingSeatDraft): Promise<void> {
  assertSeatingManager(membership);
  const seat = await assertSeat(membership.weddingId, seatId);
  const table = await assertTable(membership.weddingId, seat.table_id, seat.event_id);
  await assertReceptionEvent(membership.weddingId, table.event_id);
  const value = seatingSeatDraftSchema.parse(draft);
  const { error } = await supabase.rpc("update_seating_seat", { p_seat_id: seatId, p_label: value.label, p_sort_order: value.sortOrder });
  if (error) throw error;
}

export async function deleteSeatingSeat(membership: WorkspaceMembership, seatId: string): Promise<void> {
  assertSeatingManager(membership);
  const seat = await assertSeat(membership.weddingId, seatId);
  const table = await assertTable(membership.weddingId, seat.table_id, seat.event_id);
  await assertReceptionEvent(membership.weddingId, table.event_id);
  const { error } = await supabase.rpc("delete_seating_seat", { p_seat_id: seatId });
  if (error) throw error;
}

export async function seatGuest(
  membership: WorkspaceMembership,
  eventId: string,
  guestId: string,
  tableId: string,
  seatId: string | null,
): Promise<string> {
  assertSeatingManager(membership);
  await assertReceptionEvent(membership.weddingId, eventId);
  await assertTable(membership.weddingId, tableId, eventId);
  await assertGuest(membership.weddingId, guestId);
  if (seatId) {
    const seat = await assertSeat(membership.weddingId, seatId, tableId);
    if (seat.event_id !== eventId) throw unavailable("Seat is unavailable.");
  }
  const { data: rsvp, error: rsvpError } = await supabase.from("guest_rsvps").select("status")
    .eq("wedding_id", membership.weddingId).eq("guest_id", guestId).maybeSingle();
  if (rsvpError) throw rsvpError;
  if (rsvp?.status !== "ATTENDING") throw Object.assign(new Error("Only an ATTENDING Guest may be seated."), { code: "23514" });
  const { data, error } = await supabase.rpc("seat_guest", {
    p_event_id: eventId,
    p_guest_id: guestId,
    p_table_id: tableId,
    p_seat_id: seatId ?? undefined,
  });
  if (error) throw error;
  if (!data) throw new Error("Guest could not be assigned.");
  return data;
}

export async function unseatGuest(membership: WorkspaceMembership, eventId: string, guestId: string): Promise<void> {
  assertSeatingManager(membership);
  await assertReceptionEvent(membership.weddingId, eventId);
  await assertGuest(membership.weddingId, guestId);
  const { error } = await supabase.rpc("unseat_guest", { p_event_id: eventId, p_guest_id: guestId });
  if (error) throw error;
}

export type SeatingRpcName = keyof Pick<Database["public"]["Functions"],
  "create_seating_event" | "update_seating_event" | "set_seating_visibility" | "create_seating_table" | "update_seating_table" | "delete_seating_table"
  | "create_seating_seat" | "update_seating_seat" | "delete_seating_seat" | "seat_guest" | "unseat_guest">;
