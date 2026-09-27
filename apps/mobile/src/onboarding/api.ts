import { supabase } from "../auth/client";
import { weddingRpcArgs, type CreatedWedding, type WeddingDraft } from "./model";

export async function createCoupleWedding(draft: WeddingDraft): Promise<CreatedWedding> {
  const { data, error } = await supabase.rpc("create_couple_wedding", weddingRpcArgs(draft));
  if (error || !data?.[0]) throw error ?? new Error("Missing wedding result");
  const row = data[0];
  return { weddingId: row.wedding_id, currentPersonId: row.current_person_id, secondPartnerPersonId: row.second_partner_person_id };
}

export type MotifSaveStage = "load_motif" | "insert_motif" | "update_motif_title" | "remove_colors" | "insert_colors";
export class MotifPersistenceError extends Error {
  constructor(readonly stage: MotifSaveStage) { super("Motif persistence failed."); this.name = "MotifPersistenceError"; }
}

export async function saveMotif(weddingId: string, title: string, colors: readonly string[]) {
  const existing = await supabase.from("wedding_motifs").select("id").eq("wedding_id", weddingId).maybeSingle();
  if (existing.error) throw new MotifPersistenceError("load_motif");
  let motifId = existing.data?.id;
  if (motifId) {
    const updated = await supabase.from("wedding_motifs").update({ title }).eq("wedding_id", weddingId).select("id").single();
    if (updated.error || !updated.data) throw new MotifPersistenceError("update_motif_title");
    motifId = updated.data.id;
  } else {
    const inserted = await supabase.from("wedding_motifs").insert({ wedding_id: weddingId, title }).select("id").single();
    if (inserted.error || !inserted.data) throw new MotifPersistenceError("insert_motif");
    motifId = inserted.data.id;
  }
  const removed = await supabase.from("motif_colors").delete().eq("wedding_id", weddingId).eq("motif_id", motifId);
  if (removed.error) throw new MotifPersistenceError("remove_colors");
  const inserted = await supabase.from("motif_colors").insert(colors.map((color_hex, sort_order) => ({ wedding_id: weddingId, motif_id: motifId, color_hex, sort_order })));
  if (inserted.error) throw new MotifPersistenceError("insert_colors");
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
