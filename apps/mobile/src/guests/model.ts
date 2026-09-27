import { z } from "zod";
import type { Database } from "@katipan/database/types";
import type { WorkspaceMembership } from "../workspace/model";

export type Guest = Database["public"]["Tables"]["guests"]["Row"];
export type GuestHousehold = Database["public"]["Tables"]["guest_households"]["Row"];
export type GuestPerson = Database["public"]["Tables"]["wedding_people"]["Row"];
export type GuestRsvp = Database["public"]["Tables"]["guest_rsvps"]["Row"];
export type GuestGroup = Database["public"]["Tables"]["guest_groups"]["Row"];
export type GuestGroupMembership = Database["public"]["Tables"]["guest_group_memberships"]["Row"];
export type GuestAllowance = Database["public"]["Tables"]["guest_allowances"]["Row"];
export type GuestAllowanceClaim = Database["public"]["Tables"]["guest_allowance_claims"]["Row"];
export type GuestHouseholdProgress = Database["public"]["Views"]["guest_household_rsvp_progress"]["Row"];
export type GuestRsvpStatus = Database["public"]["Enums"]["guest_rsvp_status"];
export type GuestAllowanceType = Database["public"]["Enums"]["guest_allowance_type"];
export type HouseholdProgressStatus = Database["public"]["Enums"]["household_rsvp_progress"];

export type GuestSeatingSummary = { guestId: string; eventName: string; tableName: string; hasSeat: boolean };
export type GuestEntourageSummary = { guestId: string; roleName: string };

export type GuestWorkspaceData = {
  weddingId: string;
  households: GuestHousehold[];
  guests: Guest[];
  people: GuestPerson[];
  rsvps: GuestRsvp[];
  groups: GuestGroup[];
  groupMemberships: GuestGroupMembership[];
  allowances: GuestAllowance[];
  allowanceClaims: GuestAllowanceClaim[];
  householdProgress: GuestHouseholdProgress[];
  entourage: GuestEntourageSummary[] | null;
  seating: GuestSeatingSummary[] | null;
};

export type GuestEntry = {
  guest: Guest;
  person: GuestPerson;
  household: GuestHousehold;
  rsvp: GuestRsvp | null;
  groupIds: string[];
  groupNames: string[];
  allowanceClaims: GuestAllowanceClaim[];
  entourageRoles: string[] | null;
  seating: GuestSeatingSummary[] | null;
};

export type GuestSummary = {
  totalGuests: number;
  attending: number;
  declined: number;
  noResponse: number;
  responded: number;
  rsvpProgressPercent: number;
  sentHouseholds: number;
  notSentHouseholds: number;
};

export type GuestListFilters = {
  search: string;
  status: "ALL" | GuestRsvpStatus;
  householdId?: string;
  groupId?: string;
};

export type GuestDraft = z.infer<typeof guestDraftSchema>;
export type HouseholdDraft = z.infer<typeof householdDraftSchema>;

const nullableText = (max: number) => z.string().trim().max(max).or(z.literal(""));
const nullableEmail = z.string().trim().max(254).refine(
  (value) => value === "" || z.string().email().safeParse(value).success,
  "Enter a valid email address.",
);

export const guestDraftSchema = z.object({
  displayName: z.string().trim().min(1, "Enter the guest's name.").max(160),
  firstName: nullableText(100),
  lastName: nullableText(100),
  email: nullableEmail,
  phone: nullableText(40),
  accessibilityAssistanceNote: nullableText(2000),
  internalNotes: nullableText(4000),
});

export const householdDraftSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a Household name.").max(160),
  notes: nullableText(4000),
});

export const guestRsvpStatuses = ["NO_RESPONSE", "ATTENDING", "DECLINED"] as const satisfies readonly GuestRsvpStatus[];
export const guestListStatusFilters = ["ALL", ...guestRsvpStatuses] as const;

export function canManageGuestDomain(membership: WorkspaceMembership | null | undefined): boolean {
  return Boolean(
    membership
    && membership.status === "ACTIVE"
    && membership.weddingId === membership.wedding.id
    && (membership.role === "OWNER" || membership.role === "FULL_COORDINATOR" || membership.role === "GUEST_COORDINATOR"),
  );
}

export function canViewGuestNotes(membership: WorkspaceMembership | null | undefined): boolean {
  return canManageGuestDomain(membership);
}

export function guestRsvpStatus(rsvp: GuestRsvp | null | undefined): GuestRsvpStatus {
  return rsvp?.status ?? "NO_RESPONSE";
}

export function deriveGuestSummary(
  guests: readonly Guest[],
  rsvps: readonly GuestRsvp[],
  households: readonly GuestHousehold[],
): GuestSummary {
  const rsvpByGuestId = new Map(rsvps.map((rsvp) => [rsvp.guest_id, rsvp]));
  let attending = 0;
  let declined = 0;
  let noResponse = 0;
  for (const guest of guests) {
    const status = guestRsvpStatus(rsvpByGuestId.get(guest.id));
    if (status === "ATTENDING") attending += 1;
    else if (status === "DECLINED") declined += 1;
    else noResponse += 1;
  }
  const responded = attending + declined;
  return {
    totalGuests: guests.length,
    attending,
    declined,
    noResponse,
    responded,
    rsvpProgressPercent: guests.length === 0 ? 0 : Math.round((responded / guests.length) * 100),
    sentHouseholds: households.filter((household) => household.delivery_status === "SENT").length,
    notSentHouseholds: households.filter((household) => household.delivery_status === "NOT_SENT").length,
  };
}

export function deriveHouseholdProgress(
  householdId: string,
  guests: readonly Guest[],
  rsvps: readonly GuestRsvp[],
): {
  householdId: string;
  totalGuests: number;
  respondedGuests: number;
  attendingGuests: number;
  declinedGuests: number;
  noResponseGuests: number;
  progress: HouseholdProgressStatus;
} {
  const members = guests.filter((guest) => guest.household_id === householdId);
  const rsvpByGuestId = new Map(rsvps.map((rsvp) => [rsvp.guest_id, rsvp]));
  const statuses = members.map((guest) => guestRsvpStatus(rsvpByGuestId.get(guest.id)));
  const attendingGuests = statuses.filter((status) => status === "ATTENDING").length;
  const declinedGuests = statuses.filter((status) => status === "DECLINED").length;
  const respondedGuests = attendingGuests + declinedGuests;
  return {
    householdId,
    totalGuests: members.length,
    respondedGuests,
    attendingGuests,
    declinedGuests,
    noResponseGuests: members.length - respondedGuests,
    progress: respondedGuests === 0
      ? "NO_RESPONSE"
      : respondedGuests < members.length
        ? "PARTIALLY_RESPONDED"
        : "RESPONDED",
  };
}

export function buildGuestEntries(data: GuestWorkspaceData): GuestEntry[] {
  const peopleById = new Map(data.people.map((person) => [person.id, person]));
  const householdsById = new Map(data.households.map((household) => [household.id, household]));
  const rsvpsByGuestId = new Map(data.rsvps.map((rsvp) => [rsvp.guest_id, rsvp]));
  const groupsById = new Map(data.groups.map((group) => [group.id, group]));
  const groupIdsByGuestId = new Map<string, string[]>();
  for (const item of data.groupMemberships) {
    groupIdsByGuestId.set(item.guest_id, [...(groupIdsByGuestId.get(item.guest_id) ?? []), item.guest_group_id]);
  }
  const claimsByGuestId = new Map<string, GuestAllowanceClaim[]>();
  for (const item of data.allowanceClaims) {
    claimsByGuestId.set(item.guest_id, [...(claimsByGuestId.get(item.guest_id) ?? []), item]);
  }
  const entourageByGuestId = new Map<string, string[]>();
  for (const item of data.entourage ?? []) {
    entourageByGuestId.set(item.guestId, [...(entourageByGuestId.get(item.guestId) ?? []), item.roleName]);
  }
  const seatingByGuestId = new Map<string, GuestSeatingSummary[]>();
  for (const item of data.seating ?? []) {
    seatingByGuestId.set(item.guestId, [...(seatingByGuestId.get(item.guestId) ?? []), item]);
  }

  return data.guests.flatMap((guest) => {
    if (guest.wedding_id !== data.weddingId) return [];
    const person = peopleById.get(guest.person_id);
    const household = householdsById.get(guest.household_id);
    if (!person || person.wedding_id !== data.weddingId || !household || household.wedding_id !== data.weddingId) return [];
    const groupIds = groupIdsByGuestId.get(guest.id) ?? [];
    return [{
      guest,
      person,
      household,
      rsvp: rsvpsByGuestId.get(guest.id) ?? null,
      groupIds,
      groupNames: groupIds.flatMap((id) => {
        const group = groupsById.get(id);
        return group?.wedding_id === data.weddingId ? [group.name] : [];
      }),
      allowanceClaims: claimsByGuestId.get(guest.id) ?? [],
      entourageRoles: data.entourage === null ? null : entourageByGuestId.get(guest.id) ?? [],
      seating: data.seating === null ? null : seatingByGuestId.get(guest.id) ?? [],
    }];
  });
}

export function filterGuestEntries(entries: readonly GuestEntry[], filters: GuestListFilters): GuestEntry[] {
  const search = filters.search.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    if (filters.householdId && entry.household.id !== filters.householdId) return false;
    if (filters.groupId && !entry.groupIds.includes(filters.groupId)) return false;
    if (filters.status !== "ALL" && guestRsvpStatus(entry.rsvp) !== filters.status) return false;
    if (!search) return true;
    const haystack = [
      entry.person.display_name,
      entry.person.first_name,
      entry.person.last_name,
      entry.person.email,
      entry.person.phone,
      entry.household.display_name,
      ...entry.groupNames,
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return haystack.includes(search);
  });
}

export function availableWeddingPeople(data: GuestWorkspaceData, householdId: string): GuestPerson[] {
  if (!data.households.some((household) => household.id === householdId && household.wedding_id === data.weddingId)) return [];
  const usedPersonIds = new Set(data.guests
    .filter((guest) => guest.wedding_id === data.weddingId)
    .map((guest) => guest.person_id));
  return data.people.filter((person) => person.wedding_id === data.weddingId && !usedPersonIds.has(person.id));
}

export function isGuestInWedding(guest: Guest | null | undefined, weddingId: string): guest is Guest {
  return Boolean(guest && guest.wedding_id === weddingId);
}

export function isHouseholdInWedding(household: GuestHousehold | null | undefined, weddingId: string): household is GuestHousehold {
  return Boolean(household && household.wedding_id === weddingId);
}

export function guestName(entry: Pick<GuestEntry, "person">): string {
  return entry.person.display_name.trim() || [entry.person.first_name, entry.person.last_name].filter(Boolean).join(" ") || "Guest";
}

export function guestRsvpLabel(status: GuestRsvpStatus): string {
  switch (status) {
    case "NO_RESPONSE": return "No response";
    case "ATTENDING": return "Attending";
    case "DECLINED": return "Declined";
  }
}

export function householdProgressLabel(status: HouseholdProgressStatus | null | undefined): string {
  switch (status) {
    case "RESPONDED": return "All guests responded";
    case "PARTIALLY_RESPONDED": return "Partially responded";
    case "NO_RESPONSE": return "Awaiting responses";
    default: return "No guests yet";
  }
}

export function guestAllowanceLabel(type: GuestAllowanceType): string {
  switch (type) {
    case "PLUS_ONE": return "Plus one";
    case "CHILD": return "Child";
  }
}

export function safeGuestError(error: unknown, fallback = "We couldn't save this guest change. Try again."): string {
  if (!error || typeof error !== "object" || !("code" in error)) return fallback;
  switch (error.code) {
    case "42501": return "You don't have permission to make this guest change.";
    case "23503": return "Choose a Guest or Household from this Wedding.";
    case "23505": return "This person is already a Guest in this Wedding.";
    case "22023": return "This record is unavailable in the selected Wedding.";
    default: return fallback;
  }
}

/** Prevents rapid repeat taps from issuing duplicate guest-domain actions. */
export class SingleSubmitGate {
  private pending = false;

  async run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (this.pending) return undefined;
    this.pending = true;
    try {
      return await action();
    } finally {
      this.pending = false;
    }
  }
}
