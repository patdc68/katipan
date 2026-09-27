import type { Database } from "@katipan/database/types";
import { supabase } from "../auth/client";
import type { WorkspaceMembership } from "../workspace/model";
import {
  entourageRoleDraftSchema,
  guestAllowanceDraftSchema,
  guestDraftSchema,
  guestGroupDraftSchema,
  householdDraftSchema,
  type GuestDraft,
  type GuestAllowance,
  type GuestAllowanceDraft,
  type GuestEntourageRole,
  type GuestEntourageSummary,
  type GuestGroup,
  type GuestGroupDraft,
  type GuestHousehold,
  type EntourageRoleDraft,
  type GuestSeatingSummary,
  type GuestWorkspaceData,
  type HouseholdDraft,
} from "./model";

function assertActiveMembership(membership: WorkspaceMembership): void {
  if (membership.status !== "ACTIVE" || membership.weddingId !== membership.wedding.id) {
    throw Object.assign(new Error("An active Wedding membership is required."), { code: "42501" });
  }
}

function assertGuestManager(membership: WorkspaceMembership): void {
  assertActiveMembership(membership);
  if (membership.role !== "OWNER" && membership.role !== "FULL_COORDINATOR" && membership.role !== "GUEST_COORDINATOR") {
    throw Object.assign(new Error("Guest changes are not permitted."), { code: "42501" });
  }
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

async function assertHouseholdInWedding(weddingId: string, householdId: string): Promise<GuestHousehold> {
  const { data, error } = await supabase.from("guest_households")
    .select("*")
    .eq("id", householdId)
    .eq("wedding_id", weddingId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId) {
    throw Object.assign(new Error("Household is unavailable in this Wedding."), { code: "22023" });
  }
  return data;
}

async function assertGuestInWedding(weddingId: string, guestId: string) {
  const { data, error } = await supabase.from("guests")
    .select("*")
    .eq("id", guestId)
    .eq("wedding_id", weddingId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId) {
    throw Object.assign(new Error("Guest is unavailable in this Wedding."), { code: "22023" });
  }
  return data;
}

async function assertGroupInWedding(weddingId: string, groupId: string): Promise<GuestGroup> {
  const { data, error } = await supabase.from("guest_groups")
    .select("*")
    .eq("id", groupId)
    .eq("wedding_id", weddingId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId) {
    throw Object.assign(new Error("Group is unavailable in this Wedding."), { code: "22023" });
  }
  return data;
}

async function assertEntourageRoleInWedding(weddingId: string, roleId: string): Promise<GuestEntourageRole> {
  const { data, error } = await supabase.from("entourage_roles")
    .select("*")
    .eq("id", roleId)
    .eq("wedding_id", weddingId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId) {
    throw Object.assign(new Error("Entourage role is unavailable in this Wedding."), { code: "22023" });
  }
  return data;
}

async function assertAllowanceInWedding(weddingId: string, allowanceId: string): Promise<GuestAllowance> {
  const { data, error } = await supabase.from("guest_allowances")
    .select("*")
    .eq("id", allowanceId)
    .eq("wedding_id", weddingId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId) {
    throw Object.assign(new Error("Allowance is unavailable in this Wedding."), { code: "22023" });
  }
  return data;
}

export async function loadGuestWorkspace(membership: WorkspaceMembership): Promise<GuestWorkspaceData> {
  assertActiveMembership(membership);
  const weddingId = membership.weddingId;
  const [householdsResult, guestsResult, peopleResult, rsvpsResult, groupsResult, groupMembershipsResult,
    allowancesResult, allowanceClaimsResult, householdProgressResult, entourageRolesResult,
    entourageAssignmentsResult, seatingEventsResult, seatingTablesResult, seatingAssignmentsResult] = await Promise.all([
    supabase.from("guest_households").select("*").eq("wedding_id", weddingId).order("display_name"),
    supabase.from("guests").select("*").eq("wedding_id", weddingId).order("created_at"),
    supabase.from("wedding_people").select("*").eq("wedding_id", weddingId).order("display_name"),
    supabase.from("guest_rsvps").select("*").eq("wedding_id", weddingId),
    supabase.from("guest_groups").select("*").eq("wedding_id", weddingId).order("sort_order").order("name"),
    supabase.from("guest_group_memberships").select("*").eq("wedding_id", weddingId),
    supabase.from("guest_allowances").select("*").eq("wedding_id", weddingId),
    supabase.from("guest_allowance_claims").select("*").eq("wedding_id", weddingId),
    supabase.from("guest_household_rsvp_progress").select("*").eq("wedding_id", weddingId),
    supabase.from("entourage_roles").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("entourage_assignments").select("*").eq("wedding_id", weddingId),
    supabase.from("seating_events").select("*").eq("wedding_id", weddingId),
    supabase.from("seating_tables").select("*").eq("wedding_id", weddingId),
    supabase.from("seating_assignments").select("*").eq("wedding_id", weddingId),
  ]);
  const requiredError = [
    householdsResult.error,
    guestsResult.error,
    peopleResult.error,
    rsvpsResult.error,
    groupsResult.error,
    groupMembershipsResult.error,
    allowancesResult.error,
    allowanceClaimsResult.error,
    householdProgressResult.error,
  ].find(Boolean);
  if (requiredError) throw requiredError;

  let entourage: GuestEntourageSummary[] | null = null;
  if (!entourageRolesResult.error && !entourageAssignmentsResult.error) {
    const roleNames = new Map((entourageRolesResult.data ?? []).map((role) => [role.id, role]));
    const guestIds = new Set((guestsResult.data ?? []).map((guest) => guest.id));
    entourage = (entourageAssignmentsResult.data ?? []).flatMap((assignment) => {
      const role = roleNames.get(assignment.role_id);
      return assignment.wedding_id === weddingId && guestIds.has(assignment.guest_id) && role?.wedding_id === weddingId
        ? [{ guestId: assignment.guest_id, roleName: role.name }]
        : [];
    });
  }

  let seating: GuestSeatingSummary[] | null = null;
  if (!seatingEventsResult.error && !seatingTablesResult.error && !seatingAssignmentsResult.error) {
    const events = new Map((seatingEventsResult.data ?? []).map((event) => [event.id, event]));
    const tables = new Map((seatingTablesResult.data ?? []).map((table) => [table.id, table]));
    const guestIds = new Set((guestsResult.data ?? []).map((guest) => guest.id));
    seating = (seatingAssignmentsResult.data ?? []).flatMap((assignment) => {
      const event = events.get(assignment.event_id);
      const table = tables.get(assignment.table_id);
      if (assignment.wedding_id !== weddingId || !guestIds.has(assignment.guest_id)
        || !event || event.wedding_id !== weddingId || !table || table.wedding_id !== weddingId
        || table.event_id !== event.id) return [];
      return [{
        guestId: assignment.guest_id,
        eventName: event.name,
        tableName: table.name,
        hasSeat: assignment.seat_id !== null,
      }];
    });
  }

  return {
    weddingId,
    households: householdsResult.data ?? [],
    guests: guestsResult.data ?? [],
    people: peopleResult.data ?? [],
    rsvps: rsvpsResult.data ?? [],
    groups: groupsResult.data ?? [],
    groupMemberships: groupMembershipsResult.data ?? [],
    allowances: allowancesResult.data ?? [],
    allowanceClaims: allowanceClaimsResult.data ?? [],
    householdProgress: householdProgressResult.data ?? [],
    entourage,
    entourageRoles: entourageRolesResult.error
      ? null
      : (entourageRolesResult.data ?? []).filter((role) => role.wedding_id === weddingId),
    entourageAssignments: entourageRolesResult.error || entourageAssignmentsResult.error
      ? null
      : (entourageAssignmentsResult.data ?? []).filter((assignment) => assignment.wedding_id === weddingId),
    seating,
  };
}

export async function createGuestGroup(membership: WorkspaceMembership, draft: GuestGroupDraft): Promise<string> {
  assertGuestManager(membership);
  const value = guestGroupDraftSchema.parse(draft);
  const { data, error } = await supabase.from("guest_groups")
    .insert({ wedding_id: membership.weddingId, name: value.name })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Guest group could not be created.");
  return data.id;
}

export async function updateGuestGroup(
  membership: WorkspaceMembership,
  groupId: string,
  draft: GuestGroupDraft,
): Promise<void> {
  assertGuestManager(membership);
  await assertGroupInWedding(membership.weddingId, groupId);
  const value = guestGroupDraftSchema.parse(draft);
  const { data, error } = await supabase.from("guest_groups")
    .update({ name: value.name })
    .eq("id", groupId)
    .eq("wedding_id", membership.weddingId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Group is unavailable in this Wedding."), { code: "22023" });
}

export async function deleteGuestGroup(membership: WorkspaceMembership, groupId: string): Promise<void> {
  assertGuestManager(membership);
  await assertGroupInWedding(membership.weddingId, groupId);
  const { data, error } = await supabase.from("guest_groups")
    .delete()
    .eq("id", groupId)
    .eq("wedding_id", membership.weddingId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Group is unavailable in this Wedding."), { code: "22023" });
}

export async function addGuestToGroup(membership: WorkspaceMembership, groupId: string, guestId: string): Promise<void> {
  assertGuestManager(membership);
  await Promise.all([
    assertGroupInWedding(membership.weddingId, groupId),
    assertGuestInWedding(membership.weddingId, guestId),
  ]);
  const { error } = await supabase.from("guest_group_memberships")
    .insert({ wedding_id: membership.weddingId, guest_group_id: groupId, guest_id: guestId });
  if (error) throw error;
}

export async function removeGuestFromGroup(membership: WorkspaceMembership, groupId: string, guestId: string): Promise<void> {
  assertGuestManager(membership);
  await Promise.all([
    assertGroupInWedding(membership.weddingId, groupId),
    assertGuestInWedding(membership.weddingId, guestId),
  ]);
  const { data, error } = await supabase.from("guest_group_memberships")
    .delete()
    .eq("wedding_id", membership.weddingId)
    .eq("guest_group_id", groupId)
    .eq("guest_id", guestId)
    .select("guest_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Group membership is unavailable in this Wedding."), { code: "22023" });
}

export async function createEntourageRole(membership: WorkspaceMembership, draft: EntourageRoleDraft): Promise<string> {
  assertGuestManager(membership);
  const value = entourageRoleDraftSchema.parse(draft);
  const { data, error } = await supabase.from("entourage_roles")
    .insert({ wedding_id: membership.weddingId, name: value.name, description: textOrNull(value.description) })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Entourage role could not be created.");
  return data.id;
}

export async function updateEntourageRole(
  membership: WorkspaceMembership,
  roleId: string,
  draft: EntourageRoleDraft,
): Promise<void> {
  assertGuestManager(membership);
  await assertEntourageRoleInWedding(membership.weddingId, roleId);
  const value = entourageRoleDraftSchema.parse(draft);
  const { data, error } = await supabase.from("entourage_roles")
    .update({ name: value.name, description: textOrNull(value.description) })
    .eq("id", roleId)
    .eq("wedding_id", membership.weddingId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Entourage role is unavailable in this Wedding."), { code: "22023" });
}

export async function deleteEntourageRole(membership: WorkspaceMembership, roleId: string): Promise<void> {
  assertGuestManager(membership);
  await assertEntourageRoleInWedding(membership.weddingId, roleId);
  const { data, error } = await supabase.from("entourage_roles")
    .delete()
    .eq("id", roleId)
    .eq("wedding_id", membership.weddingId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Entourage role is unavailable in this Wedding."), { code: "22023" });
}

export async function assignGuestToEntourageRole(
  membership: WorkspaceMembership,
  roleId: string,
  guestId: string,
): Promise<void> {
  assertGuestManager(membership);
  await Promise.all([
    assertEntourageRoleInWedding(membership.weddingId, roleId),
    assertGuestInWedding(membership.weddingId, guestId),
  ]);
  const { error } = await supabase.from("entourage_assignments")
    .insert({ wedding_id: membership.weddingId, role_id: roleId, guest_id: guestId });
  if (error) throw error;
}

export async function removeGuestFromEntourageRole(
  membership: WorkspaceMembership,
  roleId: string,
  guestId: string,
): Promise<void> {
  assertGuestManager(membership);
  await Promise.all([
    assertEntourageRoleInWedding(membership.weddingId, roleId),
    assertGuestInWedding(membership.weddingId, guestId),
  ]);
  const { data, error } = await supabase.from("entourage_assignments")
    .delete()
    .eq("wedding_id", membership.weddingId)
    .eq("role_id", roleId)
    .eq("guest_id", guestId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Entourage assignment is unavailable in this Wedding."), { code: "22023" });
}

function allowanceValues(draft: GuestAllowanceDraft) {
  const value = guestAllowanceDraftSchema.parse(draft);
  return {
    household_id: value.householdId,
    allowance_type: value.allowanceType,
    sponsor_guest_id: value.sponsorGuestId,
    max_count: value.maxCount,
  };
}

async function assertAllowanceConfiguration(
  weddingId: string,
  householdId: string,
  allowanceType: "PLUS_ONE" | "CHILD",
  sponsorGuestId: string | null,
): Promise<void> {
  await assertHouseholdInWedding(weddingId, householdId);
  if (allowanceType === "CHILD") {
    if (sponsorGuestId !== null) throw Object.assign(new Error("A Child allowance has no Guest sponsor."), { code: "22023" });
    return;
  }
  if (!sponsorGuestId) throw Object.assign(new Error("Choose a Guest to sponsor this Plus-One allowance."), { code: "22023" });
  const sponsor = await assertGuestInWedding(weddingId, sponsorGuestId);
  if (sponsor.household_id !== householdId) {
    throw Object.assign(new Error("The Plus-One sponsor must belong to this Household."), { code: "23514", constraint: "guest_allowances_sponsor_same_household_check" });
  }
}

export async function createGuestAllowance(membership: WorkspaceMembership, draft: GuestAllowanceDraft): Promise<string> {
  assertGuestManager(membership);
  const values = allowanceValues(draft);
  await assertAllowanceConfiguration(membership.weddingId, values.household_id, values.allowance_type, values.sponsor_guest_id);
  const { data, error } = await supabase.from("guest_allowances")
    .insert({ wedding_id: membership.weddingId, ...values })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Allowance could not be created.");
  return data.id;
}

export async function updateGuestAllowance(
  membership: WorkspaceMembership,
  allowanceId: string,
  draft: GuestAllowanceDraft,
): Promise<void> {
  assertGuestManager(membership);
  await assertAllowanceInWedding(membership.weddingId, allowanceId);
  const values = allowanceValues(draft);
  await assertAllowanceConfiguration(membership.weddingId, values.household_id, values.allowance_type, values.sponsor_guest_id);
  const { data, error } = await supabase.from("guest_allowances")
    .update(values)
    .eq("id", allowanceId)
    .eq("wedding_id", membership.weddingId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Allowance is unavailable in this Wedding."), { code: "22023" });
}

export async function deleteGuestAllowance(membership: WorkspaceMembership, allowanceId: string): Promise<void> {
  assertGuestManager(membership);
  await assertAllowanceInWedding(membership.weddingId, allowanceId);
  const { data, error } = await supabase.from("guest_allowances")
    .delete()
    .eq("id", allowanceId)
    .eq("wedding_id", membership.weddingId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Allowance is unavailable in this Wedding."), { code: "22023" });
}

export async function createGuestHousehold(
  membership: WorkspaceMembership,
  draft: HouseholdDraft,
): Promise<string> {
  assertGuestManager(membership);
  const value = householdDraftSchema.parse(draft);
  const args = {
    p_wedding_id: membership.weddingId,
    p_display_name: value.displayName,
    p_notes: textOrNull(value.notes),
  };
  const { data, error } = await supabase.rpc(
    "create_guest_household",
    args as unknown as Database["public"]["Functions"]["create_guest_household"]["Args"],
  );
  if (error) throw error;
  if (!data) throw new Error("Household could not be created.");
  return data;
}

export async function updateGuestHousehold(
  membership: WorkspaceMembership,
  householdId: string,
  draft: HouseholdDraft,
): Promise<void> {
  assertGuestManager(membership);
  await assertHouseholdInWedding(membership.weddingId, householdId);
  const value = householdDraftSchema.parse(draft);
  const { data, error } = await supabase.from("guest_households")
    .update({ display_name: value.displayName, notes: textOrNull(value.notes) })
    .eq("id", householdId)
    .eq("wedding_id", membership.weddingId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Household is unavailable in this Wedding."), { code: "22023" });
}

export async function createGuest(
  membership: WorkspaceMembership,
  householdId: string,
  draft: GuestDraft,
): Promise<string> {
  assertGuestManager(membership);
  await assertHouseholdInWedding(membership.weddingId, householdId);
  const value = guestDraftSchema.parse(draft);
  const args = {
    p_wedding_id: membership.weddingId,
    p_household_id: householdId,
    p_display_name: value.displayName,
    p_first_name: textOrNull(value.firstName),
    p_last_name: textOrNull(value.lastName),
    p_email: textOrNull(value.email),
    p_phone: textOrNull(value.phone),
    p_accessibility_assistance_note: textOrNull(value.accessibilityAssistanceNote),
    p_internal_notes: textOrNull(value.internalNotes),
  };
  const { data, error } = await supabase.rpc(
    "create_guest",
    args as unknown as Database["public"]["Functions"]["create_guest"]["Args"],
  );
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.guest_id) throw new Error("Guest could not be created.");
  return result.guest_id;
}

export async function addExistingPersonAsGuest(
  membership: WorkspaceMembership,
  householdId: string,
  personId: string,
): Promise<string> {
  assertGuestManager(membership);
  await assertHouseholdInWedding(membership.weddingId, householdId);
  const { data: person, error: personError } = await supabase.from("wedding_people")
    .select("id,wedding_id")
    .eq("id", personId)
    .eq("wedding_id", membership.weddingId)
    .maybeSingle();
  if (personError) throw personError;
  if (!person || person.wedding_id !== membership.weddingId) {
    throw Object.assign(new Error("Person is unavailable in this Wedding."), { code: "22023" });
  }
  const { data: existingGuest, error: guestError } = await supabase.from("guests")
    .select("id")
    .eq("wedding_id", membership.weddingId)
    .eq("person_id", personId)
    .maybeSingle();
  if (guestError) throw guestError;
  if (existingGuest) {
    throw Object.assign(new Error("This person is already a Guest in this Wedding."), { code: "23505" });
  }
  const { data, error } = await supabase.rpc("add_existing_person_as_guest", {
    p_wedding_id: membership.weddingId,
    p_person_id: personId,
    p_household_id: householdId,
  });
  if (error) throw error;
  if (!data) throw new Error("Existing person could not be added as a Guest.");
  return data;
}

export async function updateGuestPerson(
  membership: WorkspaceMembership,
  guestId: string,
  draft: GuestDraft,
): Promise<void> {
  assertGuestManager(membership);
  await assertGuestInWedding(membership.weddingId, guestId);
  const value = guestDraftSchema.parse(draft);
  const args = {
    p_wedding_id: membership.weddingId,
    p_guest_id: guestId,
    p_display_name: value.displayName,
    p_first_name: textOrNull(value.firstName),
    p_last_name: textOrNull(value.lastName),
    p_email: textOrNull(value.email),
    p_phone: textOrNull(value.phone),
  };
  const { error } = await supabase.rpc(
    "update_guest_person",
    args as unknown as Database["public"]["Functions"]["update_guest_person"]["Args"],
  );
  if (error) throw error;
}

export async function markHouseholdInvitationSent(membership: WorkspaceMembership, householdId: string): Promise<void> {
  assertGuestManager(membership);
  await assertHouseholdInWedding(membership.weddingId, householdId);
  const { error } = await supabase.rpc("mark_household_invitation_sent", { p_household_id: householdId });
  if (error) throw error;
}

export async function resetHouseholdInvitationDelivery(membership: WorkspaceMembership, householdId: string): Promise<void> {
  assertGuestManager(membership);
  await assertHouseholdInWedding(membership.weddingId, householdId);
  const { error } = await supabase.rpc("reset_household_invitation_delivery", { p_household_id: householdId });
  if (error) throw error;
}

export async function setGuestRsvp(
  membership: WorkspaceMembership,
  guestId: string,
  status: Database["public"]["Enums"]["guest_rsvp_status"],
  mealChoice: string,
  dietaryNotes: string,
  responseNotes: string,
): Promise<void> {
  assertGuestManager(membership);
  await assertGuestInWedding(membership.weddingId, guestId);
  const args = {
    p_guest_id: guestId,
    p_status: status,
    p_meal_choice: textOrNull(mealChoice),
    p_dietary_notes: textOrNull(dietaryNotes),
    p_response_notes: textOrNull(responseNotes),
  };
  const { error } = await supabase.rpc(
    "set_guest_rsvp",
    args as unknown as Database["public"]["Functions"]["set_guest_rsvp"]["Args"],
  );
  if (error) throw error;
}

async function assertAllowanceAndGuestInHousehold(weddingId: string, allowanceId: string, guestId: string): Promise<void> {
  const [allowanceResult, guestResult] = await Promise.all([
    supabase.from("guest_allowances").select("id,wedding_id,household_id").eq("id", allowanceId).eq("wedding_id", weddingId).maybeSingle(),
    supabase.from("guests").select("id,wedding_id,household_id").eq("id", guestId).eq("wedding_id", weddingId).maybeSingle(),
  ]);
  if (allowanceResult.error) throw allowanceResult.error;
  if (guestResult.error) throw guestResult.error;
  if (!allowanceResult.data || allowanceResult.data.wedding_id !== weddingId
    || !guestResult.data || guestResult.data.wedding_id !== weddingId
    || allowanceResult.data.household_id !== guestResult.data.household_id) {
    throw Object.assign(new Error("Choose an existing Guest from the allowance's Household."), { code: "23503" });
  }
}

export async function claimGuestAllowance(membership: WorkspaceMembership, allowanceId: string, guestId: string): Promise<void> {
  assertGuestManager(membership);
  await assertAllowanceAndGuestInHousehold(membership.weddingId, allowanceId, guestId);
  const { error } = await supabase.rpc("claim_guest_allowance", {
    p_allowance_id: allowanceId,
    p_guest_id: guestId,
  });
  if (error) throw error;
}

export async function releaseGuestAllowanceClaim(membership: WorkspaceMembership, allowanceId: string, guestId: string): Promise<void> {
  assertGuestManager(membership);
  await assertAllowanceAndGuestInHousehold(membership.weddingId, allowanceId, guestId);
  const { error } = await supabase.rpc("release_guest_allowance_claim", {
    p_allowance_id: allowanceId,
    p_guest_id: guestId,
  });
  if (error) throw error;
}
