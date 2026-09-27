import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, hasSupabaseConfig } from "../auth/client";
import { emptyDraft, type CreatedWedding, type WeddingDraft } from "./model";

type Stage = "start" | "details" | "created";
type AccessContextValue = {
  loading: boolean; session: Session | null; draft: WeddingDraft; stage: Stage;
  wedding: CreatedWedding | null; motifDone: boolean; error: string | null;
  updateDraft: (patch: Partial<WeddingDraft>) => void; beginDetails: () => void; returnToCreate: () => void;
  setWedding: (wedding: CreatedWedding) => void; finishMotif: () => void;
  refresh: () => Promise<void>; signOut: () => Promise<void>;
};
const AccessContext = createContext<AccessContextValue | null>(null);

export async function findExistingWedding(userId: string): Promise<{ wedding: CreatedWedding; motifDone: boolean; draft: WeddingDraft } | null> {
  const { data: memberships, error } = await supabase.from("wedding_memberships")
    .select("wedding_id").eq("user_id", userId).eq("role", "OWNER").eq("status", "ACTIVE").order("joined_at", { ascending: false });
  if (error) throw error;
  for (const member of memberships ?? []) {
    const { data: wedding, error: weddingError } = await supabase.from("weddings")
      .select("id,origin,display_name,wedding_date,general_location,estimated_guest_count,ceremony_style").eq("id", member.wedding_id).single();
    if (weddingError) throw weddingError;
    if (wedding.origin !== "COUPLE_CREATED") continue;
    const { data: partners, error: partnersError } = await supabase.from("wedding_partners")
      .select("person_id,partner_order").eq("wedding_id", wedding.id);
    if (partnersError) throw partnersError;
    const { data: people, error: peopleError } = await supabase.from("wedding_people")
      .select("id,linked_user_id,display_name").eq("wedding_id", wedding.id);
    if (peopleError) throw peopleError;
    const { data: motif, error: motifError } = await supabase.from("wedding_motifs").select("id").eq("wedding_id", wedding.id).maybeSingle();
    if (motifError) throw motifError;
    const { count: motifColorCount, error: colorError } = motif
      ? await supabase.from("motif_colors").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("motif_id", motif.id)
      : { count: 0, error: null };
    if (colorError) throw colorError;
    const currentPersonId = people?.find(p => p.linked_user_id === userId)?.id;
    if (!currentPersonId) throw new Error("Wedding partner record is unavailable.");
    const unjoinedPartner = partners?.find(p => p.person_id !== currentPersonId && people?.some(person => person.id === p.person_id && !person.linked_user_id));
    return { wedding: { weddingId: wedding.id, currentPersonId, secondPartnerPersonId: unjoinedPartner?.person_id ?? null }, motifDone: Boolean(motif && motifColorCount && motifColorCount >= 3), draft: {
      currentName: people?.find(p => p.id === currentPersonId)?.display_name ?? "",
      partnerName: people?.find(p => p.id !== currentPersonId && partners?.some(partner => partner.person_id === p.id))?.display_name ?? "",
      weddingName: wedding.display_name ?? "",
      date: wedding.wedding_date ?? "",
      location: wedding.general_location ?? "",
      guestCount: wedding.estimated_guest_count,
      ceremonyStyle: wedding.ceremony_style,
      targetBudget: "",
    } };
  }
  return null;
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [session, setSession] = useState<Session | null>(null);
  const [draft, setDraft] = useState<WeddingDraft>(emptyDraft);
  const [stage, setStage] = useState<Stage>("start");
  const [wedding, saveWedding] = useState<CreatedWedding | null>(null);
  const [motifDone, setMotifDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restore = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession) { saveWedding(null); setStage("start"); setMotifDone(false); setDraft(emptyDraft); setLoading(false); return; }
    setLoading(true);
    try {
      const existing = await findExistingWedding(nextSession.user.id);
      if (existing) { saveWedding(existing.wedding); setDraft(existing.draft); setStage("created"); setMotifDone(existing.motifDone); }
      else { saveWedding(null); setStage("start"); setMotifDone(false); }
      setError(null);
    } catch {
      setError("We couldn't restore your wedding. Check your connection and try again.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    void supabase.auth.getSession().then(({ data }) => restore(data.session)).catch(() => { setError("We couldn't restore your session."); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void restore(nextSession);
      else setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, [restore]);

  const value = useMemo<AccessContextValue>(() => ({
    loading, session, draft, stage, wedding, motifDone, error,
    updateDraft: patch => setDraft(current => ({ ...current, ...patch })),
    beginDetails: () => setStage("details"),
    returnToCreate: () => setStage("start"),
    setWedding: created => { saveWedding(created); setStage("created"); setMotifDone(false); },
    finishMotif: () => setMotifDone(true),
    refresh: async () => { setError(null); const { data } = await supabase.auth.getSession(); await restore(data.session); },
    signOut: async () => { const { error: signOutError } = await supabase.auth.signOut(); if (signOutError) throw signOutError; },
  }), [loading, session, draft, stage, wedding, motifDone, error, restore]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const value = useContext(AccessContext);
  if (!value) throw new Error("AccessProvider is missing.");
  return value;
}
