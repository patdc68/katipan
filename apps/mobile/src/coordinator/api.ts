import { supabase } from "../auth/client";
import type { Database } from "@katipan/database/types";
import { clientWeddingRpcArgs, isCoordinatorRole, type ClientWeddingDraft, type WeddingRole } from "./model";

export type CreatedClientWedding = {
  wedding_id: string;
  partner_1_person_id: string;
  partner_2_person_id: string;
};

export type CoordinatorWeddingOverview = {
  wedding: Pick<Database["public"]["Tables"]["weddings"]["Row"],
    "id" | "display_name" | "wedding_date" | "timezone" | "general_location" | "estimated_guest_count"
    | "ceremony_style" | "status" | "origin" | "ownership_mode" | "created_by_user_id">;
  partners: { personId: string; displayName: string; linkedUserId: string | null; partnerOrder: number }[];
};

export type TeamMember = {
  membershipId: string;
  userId: string;
  role: WeddingRole;
  status: Database["public"]["Enums"]["wedding_membership_status"];
  displayName: string;
  joinedAt: string;
};

export type PendingWeddingInvitation = {
  invitationId: string;
  targetPersonId: string | null;
  targetDisplayName: string | null;
  role: WeddingRole;
  invitedEmail: string | null;
  expiresAt: string;
};

export type WeddingTeamSnapshot = {
  members: TeamMember[];
  pendingInvitations: PendingWeddingInvitation[];
};

export type PartnerInvitationTarget = {
  personId: string;
  displayName: string;
  partnerOrder: number;
  linkedUserId: string | null;
};

export class CoordinatorOperationError extends Error {
  readonly code: string | undefined;
  constructor(code?: string) {
    super("Wedding operation failed.");
    this.name = "CoordinatorOperationError";
    this.code = code;
  }
}

export async function createClientWedding(draft: ClientWeddingDraft): Promise<CreatedClientWedding> {
  const args = clientWeddingRpcArgs(draft);
  const { data, error } = await supabase.rpc("create_coordinator_managed_wedding", args);
  if (error) throw new CoordinatorOperationError(error.code);
  const created = data?.[0];
  if (!created) throw new CoordinatorOperationError();
  return created;
}

export async function loadCoordinatorWeddingOverview(weddingId: string): Promise<CoordinatorWeddingOverview> {
  const [weddingResult, partnerResult] = await Promise.all([
    supabase.from("weddings")
      .select("id,display_name,wedding_date,timezone,general_location,estimated_guest_count,ceremony_style,status,origin,ownership_mode,created_by_user_id")
      .eq("id", weddingId)
      .maybeSingle(),
    supabase.from("wedding_partners")
      .select("person_id,partner_order,wedding_people!wedding_partners_person_same_wedding_fkey(id,display_name,linked_user_id)")
      .eq("wedding_id", weddingId)
      .order("partner_order", { ascending: true }),
  ]);
  if (weddingResult.error || partnerResult.error || !weddingResult.data) {
    throw new CoordinatorOperationError(weddingResult.error?.code ?? partnerResult.error?.code);
  }
  return {
    wedding: weddingResult.data,
    partners: (partnerResult.data ?? []).flatMap((partner) => {
      const person = partner.wedding_people;
      return person ? [{
        personId: person.id,
        displayName: person.display_name,
        linkedUserId: person.linked_user_id,
        partnerOrder: partner.partner_order,
      }] : [];
    }),
  };
}

export async function loadPartnerInvitationTargets(weddingId: string): Promise<PartnerInvitationTarget[]> {
  const { data, error } = await supabase.from("wedding_partners")
    .select("person_id,partner_order,wedding_people!wedding_partners_person_same_wedding_fkey(id,display_name,linked_user_id)")
    .eq("wedding_id", weddingId)
    .order("partner_order", { ascending: true });
  if (error) throw new CoordinatorOperationError(error.code);
  return (data ?? []).flatMap((partner) => {
    const person = partner.wedding_people;
    return person && !person.linked_user_id ? [{
      personId: person.id,
      displayName: person.display_name,
      partnerOrder: partner.partner_order,
      linkedUserId: person.linked_user_id,
    }] : [];
  });
}

export async function issuePartnerOwnerInvitation(weddingId: string, targetPersonId: string, email: string) {
  const { data, error } = await supabase.rpc("issue_partner_owner_invitation", {
    p_wedding_id: weddingId,
    p_target_person_id: targetPersonId,
    p_invited_email: email.trim() || undefined,
  });
  if (error) throw new CoordinatorOperationError(error.code);
  const issued = data?.[0];
  if (!issued) throw new CoordinatorOperationError();
  return issued;
}

export async function issueCoordinatorInvitation(weddingId: string, role: WeddingRole, email: string) {
  if (!isCoordinatorRole(role)) throw new CoordinatorOperationError("22023");
  const { data, error } = await supabase.rpc("issue_coordinator_invitation", {
    p_wedding_id: weddingId,
    p_intended_role: role,
    p_invited_email: email.trim() || undefined,
  });
  if (error) throw new CoordinatorOperationError(error.code);
  const issued = data?.[0];
  if (!issued) throw new CoordinatorOperationError();
  return issued;
}

export async function loadWeddingTeam(weddingId: string): Promise<WeddingTeamSnapshot> {
  const [membershipResult, partnerResult, invitationResult] = await Promise.all([
    supabase.from("wedding_memberships")
      .select("id,user_id,role,status,joined_at")
      .eq("wedding_id", weddingId)
      .eq("status", "ACTIVE")
      .order("joined_at", { ascending: true }),
    supabase.from("wedding_partners")
      .select("person_id,wedding_people!wedding_partners_person_same_wedding_fkey(id,display_name,linked_user_id)")
      .eq("wedding_id", weddingId),
    supabase.from("wedding_invitations")
      .select("id,wedding_id,target_person_id,intended_role,invited_email,status,expires_at")
      .eq("wedding_id", weddingId)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false }),
  ]);
  if (membershipResult.error || partnerResult.error || invitationResult.error) {
    throw new CoordinatorOperationError(membershipResult.error?.code ?? partnerResult.error?.code ?? invitationResult.error?.code);
  }

  const memberships = membershipResult.data ?? [];
  const userIds = [...new Set(memberships.flatMap((row) => row.user_id ? [row.user_id] : []))];
  const profileResult = userIds.length
    ? await supabase.from("profiles").select("id,display_name").in("id", userIds)
    : { data: [], error: null };
  if (profileResult.error) throw new CoordinatorOperationError(profileResult.error.code);

  const profileNames = new Map((profileResult.data ?? []).map((profile) => [profile.id, profile.display_name?.trim() || ""]));
  const partnerPeople = (partnerResult.data ?? []).flatMap((row) => row.wedding_people ? [row.wedding_people] : []);
  const partnerNames = new Map(partnerPeople.flatMap((person) => person.linked_user_id
    ? [[person.linked_user_id, person.display_name] as const]
    : []));
  const personNames = new Map(partnerPeople.map((person) => [person.id, person.display_name]));

  return {
    members: memberships.flatMap((row) => row.user_id ? [{
      membershipId: row.id,
      userId: row.user_id,
      role: row.role,
      status: row.status,
      displayName: profileNames.get(row.user_id) || partnerNames.get(row.user_id) || "Wedding member",
      joinedAt: row.joined_at,
    }] : []),
    pendingInvitations: (invitationResult.data ?? []).map((row) => ({
      invitationId: row.id,
      targetPersonId: row.target_person_id,
      targetDisplayName: row.target_person_id ? personNames.get(row.target_person_id) ?? null : null,
      role: row.intended_role,
      invitedEmail: row.invited_email,
      expiresAt: row.expires_at,
    })),
  };
}

export async function changeCoordinatorRole(weddingId: string, targetMembershipId: string, newRole: WeddingRole): Promise<void> {
  if (!isCoordinatorRole(newRole)) throw new CoordinatorOperationError("22023");
  const { error } = await supabase.rpc("change_coordinator_role", {
    p_wedding_id: weddingId,
    p_target_membership_id: targetMembershipId,
    p_new_role: newRole,
  });
  if (error) throw new CoordinatorOperationError(error.code);
}

export async function promoteWeddingMemberToOwner(weddingId: string, targetMembershipId: string): Promise<void> {
  const { error } = await supabase.rpc("promote_wedding_member_to_owner", {
    p_wedding_id: weddingId,
    p_target_membership_id: targetMembershipId,
  });
  if (error) throw new CoordinatorOperationError(error.code);
}

export async function removeWeddingMember(weddingId: string, targetMembershipId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_wedding_member", {
    p_wedding_id: weddingId,
    p_target_membership_id: targetMembershipId,
  });
  if (error) throw new CoordinatorOperationError(error.code);
}

export async function leaveWedding(weddingId: string): Promise<void> {
  const { error } = await supabase.rpc("leave_wedding", { p_wedding_id: weddingId });
  if (error) throw new CoordinatorOperationError(error.code);
}

export async function revokeWeddingInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_wedding_invitation", { p_invitation_id: invitationId });
  if (error) throw new CoordinatorOperationError(error.code);
}
