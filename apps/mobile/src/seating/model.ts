import { z } from "zod";
import type { Database } from "@katipan/database/types";
import type { WorkspaceMembership } from "../workspace/model";

export type SeatingEvent = Database["public"]["Tables"]["seating_events"]["Row"];
export type SeatingTable = Database["public"]["Tables"]["seating_tables"]["Row"];
export type SeatingSeat = Database["public"]["Tables"]["seating_seats"]["Row"];
export type SeatingAssignment = Database["public"]["Tables"]["seating_assignments"]["Row"];
export type SeatingVisibility = Database["public"]["Enums"]["seating_visibility"];
export type SeatingTableShape = Database["public"]["Enums"]["seating_table_shape"];
export type SeatingRsvpStatus = Database["public"]["Enums"]["guest_rsvp_status"];

export type SeatingGuest = Pick<Database["public"]["Tables"]["guests"]["Row"], "id" | "wedding_id" | "household_id" | "person_id">;
export type SeatingPerson = Pick<Database["public"]["Tables"]["wedding_people"]["Row"], "id" | "wedding_id" | "display_name" | "first_name" | "last_name">;
export type SeatingHousehold = Pick<Database["public"]["Tables"]["guest_households"]["Row"], "id" | "wedding_id" | "display_name">;
export type SeatingRsvp = Pick<Database["public"]["Tables"]["guest_rsvps"]["Row"], "wedding_id" | "guest_id" | "status">;

export type SeatingWorkspaceData = {
  weddingId: string;
  events: SeatingEvent[];
  tables: SeatingTable[];
  seats: SeatingSeat[];
  assignments: SeatingAssignment[];
  guests: SeatingGuest[];
  people: SeatingPerson[];
  households: SeatingHousehold[];
  rsvps: SeatingRsvp[];
};

export type SeatingGuestEntry = {
  guest: SeatingGuest;
  name: string;
  household: SeatingHousehold;
  status: SeatingRsvpStatus;
  assignment: SeatingAssignment | null;
  table: SeatingTable | null;
  seat: SeatingSeat | null;
};

export type SeatingTableSummary = {
  table: SeatingTable;
  occupancy: number;
  remaining: number;
  guests: SeatingGuestEntry[];
};

export type SeatingOverview = {
  event: SeatingEvent;
  seatedCount: number;
  unseatedAttendingCount: number;
  attendingCount: number;
  capacity: number;
  tableCount: number;
  tables: SeatingTableSummary[];
};

const optionalLine = (max: number) => z.string().trim().max(max).or(z.literal(""));
export const seatingTableDraftSchema = z.object({
  name: z.string().trim().min(1, "Enter a Table name.").max(120),
  tableNumber: z.preprocess((value) => value === "" ? null : value,
    z.coerce.number().int("Table number must be a whole number.").min(1, "Table number must be greater than zero.").max(32767).nullable()),
  capacity: z.coerce.number().int("Capacity must be a whole number.").min(1, "Capacity must be greater than zero.").max(32767),
  shape: z.enum(["ROUND", "RECTANGULAR", "SQUARE", "OVAL", "OTHER"]),
  zone: optionalLine(120),
  notes: optionalLine(2000),
  sortOrder: z.coerce.number().int().min(0).max(32767),
});

export const seatingEventDraftSchema = z.object({
  name: z.string().trim().min(1, "Enter a Seating Event name.").max(120),
  sortOrder: z.coerce.number().int().min(0).max(32767),
});

export const seatingSeatDraftSchema = z.object({
  label: z.string().trim().min(1, "Enter a Seat label.").max(80),
  sortOrder: z.coerce.number().int().min(0).max(32767),
});

export type SeatingTableDraft = z.input<typeof seatingTableDraftSchema>;
export type SeatingEventDraft = z.input<typeof seatingEventDraftSchema>;
export type SeatingSeatDraft = z.input<typeof seatingSeatDraftSchema>;

export function canManageSeating(membership: WorkspaceMembership | null | undefined): boolean {
  return Boolean(membership && membership.status === "ACTIVE" && membership.weddingId === membership.wedding.id
    && (membership.role === "OWNER" || membership.role === "FULL_COORDINATOR" || membership.role === "GUEST_COORDINATOR"));
}

export function assertActiveSeatingMembership(membership: WorkspaceMembership): void {
  if (membership.status !== "ACTIVE" || membership.weddingId !== membership.wedding.id) {
    throw Object.assign(new Error("An active Wedding membership is required."), { code: "42501" });
  }
}

export function assertSeatingManager(membership: WorkspaceMembership): void {
  assertActiveSeatingMembership(membership);
  if (!canManageSeating(membership)) {
    throw Object.assign(new Error("Seating changes are not permitted."), { code: "42501" });
  }
}

export function seatingRsvpStatus(rsvps: readonly SeatingRsvp[], guestId: string, weddingId: string): SeatingRsvpStatus {
  return rsvps.find((rsvp) => rsvp.guest_id === guestId && rsvp.wedding_id === weddingId)?.status ?? "NO_RESPONSE";
}

export function seatingRsvpLabel(status: SeatingRsvpStatus): string {
  return status === "NO_RESPONSE" ? "No response" : status === "ATTENDING" ? "Attending" : "Declined";
}

export function buildSeatingGuestEntries(data: SeatingWorkspaceData, eventId?: string): SeatingGuestEntry[] {
  const eventIds = new Set(data.events.filter((event) => event.wedding_id === data.weddingId
    && event.event_kind === "RECEPTION" && (!eventId || event.id === eventId)).map((event) => event.id));
  const peopleById = new Map(data.people.filter((person) => person.wedding_id === data.weddingId).map((person) => [person.id, person]));
  const householdsById = new Map(data.households.filter((household) => household.wedding_id === data.weddingId).map((household) => [household.id, household]));
  const guests = data.guests.filter((guest) => guest.wedding_id === data.weddingId && householdsById.has(guest.household_id) && peopleById.has(guest.person_id));
  const tablesById = new Map(data.tables.filter((table) => table.wedding_id === data.weddingId && eventIds.has(table.event_id)).map((table) => [table.id, table]));
  const seatsById = new Map(data.seats.filter((seat) => seat.wedding_id === data.weddingId && eventIds.has(seat.event_id) && tablesById.has(seat.table_id)).map((seat) => [seat.id, seat]));
  const guestById = new Map(guests.map((guest) => [guest.id, guest]));
  const personFor = (guest: SeatingGuest) => peopleById.get(guest.person_id)!;
  const householdFor = (guest: SeatingGuest) => householdsById.get(guest.household_id)!;
  const assignmentByGuestId = new Map<string, SeatingAssignment>();
  for (const assignment of data.assignments) {
    if (assignment.wedding_id === data.weddingId && eventIds.has(assignment.event_id) && guestById.has(assignment.guest_id)
      && tablesById.get(assignment.table_id)?.event_id === assignment.event_id) assignmentByGuestId.set(assignment.guest_id, assignment);
  }
  return guests.map((guest) => {
    const person = personFor(guest);
    const assignment = assignmentByGuestId.get(guest.id) ?? null;
    const table = assignment ? tablesById.get(assignment.table_id) ?? null : null;
    const seat = assignment?.seat_id ? seatsById.get(assignment.seat_id) ?? null : null;
    return {
      guest,
      name: person.display_name || [person.first_name, person.last_name].filter(Boolean).join(" ") || "Guest",
      household: householdFor(guest),
      status: seatingRsvpStatus(data.rsvps, guest.id, data.weddingId),
      assignment,
      table,
      seat,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function buildSeatingOverview(data: SeatingWorkspaceData, event?: SeatingEvent | null): SeatingOverview | null {
  const reception = event ?? data.events.find((item) => item.wedding_id === data.weddingId && item.event_kind === "RECEPTION");
  if (!reception || reception.wedding_id !== data.weddingId || reception.event_kind !== "RECEPTION") return null;
  const guestEntries = buildSeatingGuestEntries(data, reception.id);
  const attending = guestEntries.filter((entry) => entry.status === "ATTENDING");
  const tableSummaries = data.tables.filter((table) => table.wedding_id === data.weddingId && table.event_id === reception.id)
    .map((table) => {
      const assigned = guestEntries.filter((entry) => entry.assignment?.event_id === reception.id && entry.table?.id === table.id);
      return { table, occupancy: assigned.length, remaining: Math.max(0, table.capacity - assigned.length), guests: assigned };
    }).sort((a, b) => a.table.sort_order - b.table.sort_order || (a.table.table_number ?? Number.MAX_SAFE_INTEGER) - (b.table.table_number ?? Number.MAX_SAFE_INTEGER) || a.table.name.localeCompare(b.table.name));
  const seatedCount = attending.filter((entry) => entry.assignment !== null).length;
  return {
    event: reception,
    seatedCount,
    unseatedAttendingCount: attending.length - seatedCount,
    attendingCount: attending.length,
    capacity: tableSummaries.reduce((total, summary) => total + summary.table.capacity, 0),
    tableCount: tableSummaries.length,
    tables: tableSummaries,
  };
}

export function deriveHouseholdSplitWarning(
  data: SeatingWorkspaceData,
  eventId: string,
  guestId: string,
  targetTableId: string,
): boolean {
  const entries = buildSeatingGuestEntries(data, eventId);
  const target = entries.find((entry) => entry.guest.id === guestId);
  if (!target) return false;
  const tableIds = new Set(entries.filter((entry) => entry.household.id === target.household.id && entry.guest.id !== guestId && entry.table)
    .map((entry) => entry.table!.id));
  tableIds.add(targetTableId);
  return tableIds.size > 1;
}

export function safeSeatingError(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  if (code === "42501") return "This action is read-only for your Wedding role.";
  if (code === "23514" && /ATTENDING/i.test(message)) return "Only a Guest with an Attending RSVP can be seated.";
  if (code === "23514" && /below the number|cannot be reduced/i.test(message)) return "Table capacity cannot be reduced below its current occupancy.";
  if (code === "23514" && /capacity/i.test(message)) return "The Table has reached its capacity.";
  if (code === "23514") return "This change conflicts with a seating rule. Refresh the Wedding and try again.";
  if (code === "23505" && /seating_events/i.test(message)) return "A Reception Seating Event already exists for this Wedding.";
  if (code === "23505" && /table_number|seating_tables_number_event_idx/i.test(message)) return "That Table number is already in use.";
  if (code === "23505" && /seat/i.test(message)) return "That Seat label is already in use, or the Seat is occupied.";
  if (code === "23503" || code === "22023") return "That seating record is unavailable in the selected Wedding.";
  if (/capacity/i.test(message)) return "Table capacity cannot be reduced below its current occupancy.";
  if (/unique|duplicate/i.test(message)) return "That number or label is already in use.";
  return fallback;
}

export class SeatingSubmitGate {
  private active = false;
  async run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (this.active) return undefined;
    this.active = true;
    try { return await action(); } finally { this.active = false; }
  }
}
