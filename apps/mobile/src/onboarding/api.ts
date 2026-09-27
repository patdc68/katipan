import { supabase } from "../auth/client";
import { weddingRpcArgs, type CreatedWedding, type WeddingDraft } from "./model";

export async function createCoupleWedding(draft: WeddingDraft): Promise<CreatedWedding> {
  const { data, error } = await supabase.rpc("create_couple_wedding", weddingRpcArgs(draft));
  if (error || !data?.[0]) throw error ?? new Error("Missing wedding result");
  const row = data[0];
  return { weddingId: row.wedding_id, currentPersonId: row.current_person_id, secondPartnerPersonId: row.second_partner_person_id };
}

export async function saveMotif(weddingId: string, title: string, colors: readonly string[]) {
  const { data: motif, error } = await supabase.from("wedding_motifs").upsert({ wedding_id: weddingId, title }, { onConflict: "wedding_id" }).select("id").single();
  if (error || !motif) throw error ?? new Error("Missing motif result");
  const { error: removeError } = await supabase.from("motif_colors").delete().eq("wedding_id", weddingId).eq("motif_id", motif.id);
  if (removeError) throw removeError;
  const { error: addError } = await supabase.from("motif_colors").insert(colors.map((color_hex, sort_order) => ({ wedding_id: weddingId, motif_id: motif.id, color_hex, sort_order })));
  if (addError) throw addError;
}

export async function issuePartnerInvitation(wedding: CreatedWedding, email: string) {
  if (!wedding.secondPartnerPersonId) throw new Error("There is no second partner to invite.");
  const { data, error } = await supabase.rpc("issue_partner_owner_invitation", {
    p_wedding_id: wedding.weddingId,
    p_target_person_id: wedding.secondPartnerPersonId,
    p_invited_email: email.trim().toLowerCase(),
  });
  if (error || !data?.[0]) throw error ?? new Error("Missing invitation result");
  return data[0];
}

export function partnerInvitationLink(rawToken: string) {
  if (!/^[0-9a-f]{64}$/.test(rawToken)) throw new Error("Invalid invitation token");
  return `katipan:///accept-invitation?token=${encodeURIComponent(rawToken)}`;
}
