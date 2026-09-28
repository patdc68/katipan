import { supabase } from "../auth/client";
import type { WorkspaceMembership, WorkspaceRole, WorkspaceWedding } from "./model";

export async function loadActiveMemberships(userId: string): Promise<WorkspaceMembership[]> {
  const { data: membershipRows, error: membershipError } = await supabase
    .from("wedding_memberships")
    .select("id,user_id,wedding_id,role,status,joined_at")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .order("joined_at", { ascending: false });
  if (membershipError) throw membershipError;

  const rows = (membershipRows ?? []).filter((row) => row.user_id === userId && row.status === "ACTIVE");
  const weddingIds = [...new Set(rows.map((row) => row.wedding_id))];
  if (weddingIds.length === 0) return [];

  const [weddingResult, partnerResult] = await Promise.all([
    supabase.from("weddings")
      .select("id,created_by_user_id,display_name,wedding_date,general_location,status,origin,ownership_mode")
      .in("id", weddingIds),
    supabase.from("wedding_partners")
      .select("wedding_id,partner_order,wedding_people!wedding_partners_person_same_wedding_fkey(display_name)")
      .in("wedding_id", weddingIds)
      .order("partner_order", { ascending: true }),
  ]);
  if (weddingResult.error) throw weddingResult.error;
  if (partnerResult.error) throw partnerResult.error;

  const weddings = new Map<string, WorkspaceWedding>((weddingResult.data ?? []).map((wedding) => [wedding.id, wedding]));
  if (weddings.size !== weddingIds.length) throw new Error("A Wedding membership could not be revalidated.");

  const namesByWedding = new Map<string, string[]>();
  for (const partner of partnerResult.data ?? []) {
    const name = partner.wedding_people?.display_name?.trim();
    if (!name) continue;
    const names = namesByWedding.get(partner.wedding_id) ?? [];
    names.push(name);
    namesByWedding.set(partner.wedding_id, names);
  }

  return rows.flatMap((row) => {
    const wedding = weddings.get(row.wedding_id);
    if (!wedding) return [];
    return [{
      membershipId: row.id,
      weddingId: row.wedding_id,
      userId,
      role: row.role,
      status: row.status,
      wedding,
      partnerNames: namesByWedding.get(row.wedding_id) ?? [],
    }];
  });
}

export type AcceptedWeddingInvitation = {
  invitation_id: string;
  wedding_id: string;
  person_id: string;
  membership_id: string;
  ownership_transitioned: boolean;
  already_accepted: boolean;
};

export type AcceptedCoordinatorInvitation = {
  invitation_id: string;
  wedding_id: string;
  membership_id: string;
  membership_role: WorkspaceRole;
};

export type AcceptedInvitation =
  | { kind: "PARTNER_OWNER"; invitation: AcceptedWeddingInvitation }
  | { kind: "COORDINATOR"; invitation: AcceptedCoordinatorInvitation };

export class WeddingInvitationAcceptanceError extends Error {
  readonly code: string | undefined;
  constructor(code?: string) {
    super("Invitation acceptance failed.");
    this.name = "WeddingInvitationAcceptanceError";
    this.code = code;
  }
}

export async function acceptWeddingInvitation(rawToken: string): Promise<AcceptedWeddingInvitation> {
  if (!/^[0-9a-f]{64}$/.test(rawToken)) throw new Error("Invalid invitation link.");
  const { data, error } = await supabase.rpc("accept_wedding_invitation", { p_raw_token: rawToken });
  if (error) throw new WeddingInvitationAcceptanceError(error.code);
  const accepted = data?.[0];
  if (!accepted) throw new WeddingInvitationAcceptanceError();
  return accepted;
}

export async function acceptCoordinatorInvitation(rawToken: string): Promise<AcceptedCoordinatorInvitation> {
  if (!/^[0-9a-f]{64}$/.test(rawToken)) throw new Error("Invalid invitation link.");
  const { data, error } = await supabase.rpc("accept_coordinator_invitation", { p_raw_token: rawToken });
  if (error) throw new WeddingInvitationAcceptanceError(error.code);
  const accepted = data?.[0];
  if (!accepted) throw new WeddingInvitationAcceptanceError();
  return accepted;
}

/**
 * Uses the two transaction-safe acceptance RPCs as a private dispatch boundary.
 * Both reject tokens of the other invitation shape with SQLSTATE 22023 before
 * committing any writes; all other errors stop dispatch to avoid retrying an
 * operation whose server outcome may be uncertain.
 */
export async function acceptInvitation(rawToken: string): Promise<AcceptedInvitation> {
  try {
    return { kind: "PARTNER_OWNER", invitation: await acceptWeddingInvitation(rawToken) };
  } catch (error) {
    if (!(error instanceof WeddingInvitationAcceptanceError) || error.code !== "22023") throw error;
  }
  return { kind: "COORDINATOR", invitation: await acceptCoordinatorInvitation(rawToken) };
}
