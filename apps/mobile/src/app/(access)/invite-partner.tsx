import { useEffect, useRef, useState } from "react";
import { Share, Platform, View, StyleSheet } from "react-native";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { z } from "zod";
import { KatipanButton, KatipanScreen, KatipanText, FormField, EditorialCard, LoadingState } from "../../ui";
import { artwork, EditorialImage, InfoRow, OnboardingHeader } from "../../onboarding/components";
import { useAccess } from "../../onboarding/provider";
import { issuePartnerInvitation, partnerInvitationLink } from "../../onboarding/api";
import { supabase } from "../../auth/client";
import { InvitationGate } from "../../onboarding/model";

type Pending = { email: string | null; expiresAt: string; id: string };

async function shareLink(link: string) {
  if (Platform.OS === "web") {
    if (typeof navigator !== "undefined" && navigator.share) await navigator.share({ title: "Join our Katipan wedding", url: link });
    else if (typeof navigator !== "undefined" && navigator.clipboard) await navigator.clipboard.writeText(link);
    else throw new Error("Sharing is unavailable.");
  } else await Share.share({ title: "Join our Katipan wedding", message: `Join our Katipan wedding workspace: ${link}` });
}

export default function InvitePartner() {
  const { wedding, draft, signOut } = useAccess();
  const [email, setEmail] = useState(""); const [partnerName, setPartnerName] = useState(draft.partnerName);
  const [pending, setPending] = useState<Pending | null>(null); const [loading, setLoading] = useState(Boolean(wedding?.secondPartnerPersonId));
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  const gate = useRef(new InvitationGate());
  function skip() { if (gate.current.skip()) setDone(true); }
  useEffect(() => {
    if (!wedding?.secondPartnerPersonId) return;
    let live = true;
    void Promise.all([
      supabase.from("wedding_people").select("display_name").eq("id", wedding.secondPartnerPersonId).single(),
      supabase.from("wedding_invitations").select("id,invited_email,expires_at").eq("wedding_id", wedding.weddingId).eq("target_person_id", wedding.secondPartnerPersonId).eq("status", "PENDING").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]).then(([person, invitation]) => {
      if (!live) return;
      if (person.data) setPartnerName(person.data.display_name);
      if (invitation.data) { setPending({ id: invitation.data.id, email: invitation.data.invited_email, expiresAt: invitation.data.expires_at }); setEmail(invitation.data.invited_email ?? ""); }
      if (person.error || invitation.error) setError("We couldn’t load the latest invitation state. You can retry.");
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [wedding?.weddingId, wedding?.secondPartnerPersonId]);

  async function send() {
    if (!gate.current.canStart || !wedding) return;
    const valid = z.email().safeParse(email.trim());
    if (!valid.success) { setError("Enter your partner’s valid email address."); return; }
    setBusy(true); setError("");
    try {
      await gate.current.run(async () => {
        const invitation = await issuePartnerInvitation(wedding, valid.data);
        const link = partnerInvitationLink(invitation.raw_token);
        setPending({ id: invitation.invitation_id, email: valid.data, expiresAt: invitation.invitation_expires_at });
        try { await shareLink(link); }
        catch { setError("Invitation created, but sharing was cancelled or unavailable. Send a new invitation to get a fresh link."); }
      });
    } catch { setError("We couldn’t create the invitation. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  if (loading) return <KatipanScreen><LoadingState label="Loading invitation…" /></KatipanScreen>;
  if (done) return <KatipanScreen contentContainerStyle={styles.content}><OnboardingHeader step={3} showBack={false} /><View style={styles.ready}><KatipanText variant="headlineMobile" accessibilityRole="header">Your wedding space is ready.</KatipanText><KatipanText color="textMuted" style={styles.center}>{pending ? "Your partner’s invitation is pending. You can keep planning while they join." : "You can invite your Katipan later from your wedding settings."}</KatipanText><KatipanText variant="bodySmall" color="textMuted">Your new wedding is safely saved. The planning dashboard is the next UI slice.</KatipanText><KatipanButton label="Sign Out" variant="secondary" onPress={() => void signOut()} /></View></KatipanScreen>;
  return <KatipanScreen contentContainerStyle={styles.content}>
    <OnboardingHeader step={3} showBack={false} end={<KatipanButton label="Skip" variant="text" disabled={busy} onPress={skip} />} />
    <View style={styles.intro}><KatipanText variant="headlineMobile" accessibilityRole="header">Invite My Katipan</KatipanText><KatipanText color="textMuted" style={styles.center}>Invite your partner so you can share tasks, guests, suppliers, budget planning, and live wedding updates in real time.</KatipanText></View>
    <EditorialImage source={artwork.invite} height={250} caption={`SHARED KATIPAN SPACE · ${partnerName || "YOUR PARTNER"}`} />
    <View style={styles.benefits}><InfoRow icon="↔" title="Live Co-Planning" description="Synchronized checklists, supplier notes, and aesthetic moodboards." /><InfoRow icon="₱" title="Shared Budget" description="Transparent tracking of supplier deposits and payment schedules. Katipan never holds funds." /><InfoRow icon="♧" title="Unified Guestlist" description="One register for family, tables, dietary notes, and RSVPs." /></View>
    {!wedding?.secondPartnerPersonId ? <EditorialCard><KatipanText variant="title">Your shared space is ready</KatipanText><KatipanText color="textMuted">There is no unjoined partner to invite for this Wedding. You can continue planning together.</KatipanText></EditorialCard> : <EditorialCard style={styles.form}><FormField label="Your Katipan’s Email Address" placeholder="e.g., anna.santos@gmail.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" hint={`${partnerName || "Your partner"} will receive a private invitation link when you share it.`} /><KatipanButton label={pending ? "Create New Link & Share" : "Create & Share Invitation"} loading={busy} onPress={() => void send()} /></EditorialCard>}
    {pending && <View style={styles.pending}><KatipanText variant="labelCaps" color="secondary">●  INVITATION PENDING</KatipanText><KatipanText variant="title">{partnerName || "Your partner"}</KatipanText><KatipanText variant="bodySmall" color="textMuted">{pending.email ?? "Email not attached"} · Expires {new Date(pending.expiresAt).toLocaleDateString()}</KatipanText><KatipanText variant="bodySmall" color="textMuted">The invite link is shown only when issued. Send a new invitation to share a fresh link.</KatipanText></View>}
    {!!error && <KatipanText color="error" accessibilityRole="alert">{error}</KatipanText>}
    <KatipanButton label="Invite Later" variant="text" disabled={busy} onPress={skip} />
    <KatipanText variant="bodySmall" color="textMuted" style={styles.center}>Your partner doesn’t need to accept before you can start planning.</KatipanText>
  </KatipanScreen>;
}
const styles = StyleSheet.create({ content: { gap: s.large }, intro: { alignItems: "center", gap: s.small }, center: { textAlign: "center" }, benefits: { gap: s.small, backgroundColor: c.surfaceLow, borderRadius: r.large, padding: s.medium }, form: { gap: s.medium }, pending: { gap: s.small, backgroundColor: c.surfaceLow, borderRadius: r.large, padding: s.medium }, ready: { alignItems: "center", gap: s.large, backgroundColor: c.surfaceLow, borderRadius: r.extraLarge, padding: s.large } });
