import { supabase } from "../auth/client";
import type { WorkspaceMembership } from "../workspace/model";
import { canManageGuestPass, parseGuestPassPayload, type GuestPass } from "./model";

function assertGuestPassManager(membership: WorkspaceMembership): void {
  if (!canManageGuestPass(membership)) {
    throw Object.assign(new Error("Guest Pass management is not permitted."), { code: "42501" });
  }
}

async function assertGuestInWedding(weddingId: string, guestId: string): Promise<void> {
  const { data, error } = await supabase.from("guests")
    .select("id,wedding_id")
    .eq("id", guestId)
    .eq("wedding_id", weddingId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.id !== guestId || data.wedding_id !== weddingId) {
    throw Object.assign(new Error("Guest is unavailable in this Wedding."), { code: "22023" });
  }
}

async function assertCanManageGuestPass(membership: WorkspaceMembership, guestId: string): Promise<void> {
  assertGuestPassManager(membership);
  await assertGuestInWedding(membership.weddingId, guestId);
}

export async function getGuestPass(membership: WorkspaceMembership, guestId: string): Promise<GuestPass | null> {
  await assertCanManageGuestPass(membership, guestId);
  const { data, error } = await supabase.rpc("get_guest_pass", { p_guest_id: guestId });
  if (error) throw error;
  return data === null ? null : parseGuestPassPayload(data, guestId);
}

export async function issueGuestPass(membership: WorkspaceMembership, guestId: string): Promise<GuestPass> {
  await assertCanManageGuestPass(membership, guestId);
  const { data, error } = await supabase.rpc("issue_guest_pass", { p_guest_id: guestId });
  if (error) throw error;
  return parseGuestPassPayload(data, guestId);
}

export async function revokeGuestPass(membership: WorkspaceMembership, guestId: string): Promise<boolean> {
  await assertCanManageGuestPass(membership, guestId);
  const { data, error } = await supabase.rpc("revoke_guest_pass", { p_guest_id: guestId });
  if (error) throw error;
  return data === true;
}

export async function rotateGuestPass(membership: WorkspaceMembership, guestId: string): Promise<GuestPass> {
  await assertCanManageGuestPass(membership, guestId);
  const { data, error } = await supabase.rpc("rotate_guest_pass", { p_guest_id: guestId });
  if (error) throw error;
  return parseGuestPassPayload(data, guestId);
}
