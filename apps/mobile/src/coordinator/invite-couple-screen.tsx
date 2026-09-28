import { useEffect, useRef, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Share, StyleSheet, View } from "react-native";
import { z } from "zod";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { useAccess } from "../onboarding/provider";
import { partnerInvitationLink } from "../onboarding/api";
import { Brand, ChoiceChip } from "../onboarding/components";
import { ErrorState, EditorialCard, FormField, KatipanButton, KatipanScreen, KatipanText, LoadingState } from "../ui";
import { useWorkspace } from "../workspace/context";
import { canManageWeddingTeam, safeCoordinatorFailure } from "./model";
import { issuePartnerOwnerInvitation, loadPartnerInvitationTargets, type PartnerInvitationTarget } from "./api";

export function InviteCoupleScreen() {
  const params = useLocalSearchParams<{ weddingId?: string | string[] }>();
  const weddingId = Array.isArray(params.weddingId) ? params.weddingId[0] ?? "" : params.weddingId ?? "";
  const router = useRouter();
  const access = useAccess();
  const workspace = useWorkspace();
  const membership = workspace.membershipFor(weddingId);
  const [targets, setTargets] = useState<PartnerInvitationTarget[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busyRef = useRef(false);
  const mayInvite = membership ? canManageWeddingTeam(membership) : false;

  useEffect(() => {
    let active = true;
    if (!weddingId || !membership || !mayInvite) return () => { active = false; };
    void loadPartnerInvitationTargets(weddingId).then((items) => {
      if (!active) return;
      setTargets(items);
      setSelectedPersonId((current) => items.some((item) => item.personId === current) ? current : items[0]?.personId ?? "");
    }).catch(() => {
      if (active) setError("We could not load the existing Partner records for this Wedding.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mayInvite, membership, weddingId]);

  async function sendInvitation() {
    if (busyRef.current || !mayInvite) return;
    const target = targets.find((item) => item.personId === selectedPersonId);
    if (!target) { setError("Choose one of this Wedding's existing Partner records."); return; }
    const normalizedEmail = email.trim();
    if (normalizedEmail && !z.email().safeParse(normalizedEmail).success) { setError("Enter a valid email address or leave it blank."); return; }
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const issued = await issuePartnerOwnerInvitation(weddingId, target.personId, normalizedEmail);
      const link = partnerInvitationLink(issued.raw_token);
      try {
        await Share.share({ title: "Join the Wedding on Katipan", message: link });
        setNotice("The single-use invitation link was opened in your share sheet. The Partner keeps their existing Person record when they join.");
      } catch {
        setError("The invitation was created, but the share sheet could not open. The link is not saved in the app; revoke it and create a fresh invitation before sharing.");
      }
    } catch (caught) {
      setError(safeCoordinatorFailure(caught));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (access.loading || (access.session && workspace.loading)) return <KatipanScreen><LoadingState label="Checking Wedding access…" /></KatipanScreen>;
  if (!access.session) return <Redirect href="/(access)/welcome" />;
  if (!membership) return <Redirect href="/(workspace)/weddings" />;
  if (!mayInvite) return <KatipanScreen><ErrorState title="Invitation access is unavailable" description="The active Owner or coordinator controller can manage Partner invitations for this Wedding." onRetry={() => router.replace("/(coordinator)/[weddingId]/overview" as unknown as Href)} /></KatipanScreen>;
  if (loading) return <KatipanScreen><LoadingState label="Loading Partner records…" /></KatipanScreen>;

  return (
    <KatipanScreen contentContainerStyle={styles.screen}>
      <View style={styles.topline}><Brand /><KatipanText variant="labelCaps" color="secondary">PARTNER INVITATION</KatipanText></View>
      <View style={styles.intro}>
        <KatipanText variant="headlineMobile" accessibilityRole="header">Invite a Partner to Katipan</KatipanText>
        <KatipanText color="textMuted">Choose one of the existing Partner records in this Wedding. An invitation never creates a second Person or Wedding.</KatipanText>
      </View>
      <EditorialCard style={styles.card}>
        <KatipanText variant="labelCaps" color="secondary">EXISTING PARTNER RECORDS</KatipanText>
        {targets.length ? <View style={styles.choices}>{targets.map((target) => (
          <ChoiceChip key={target.personId} label={target.displayName} selected={selectedPersonId === target.personId} onPress={() => setSelectedPersonId(target.personId)} />
        ))}</View> : <KatipanText color="textMuted">Both Partner records are already linked to Katipan accounts.</KatipanText>}
        <FormField label="Invited email (optional)" placeholder="partner@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" />
      </EditorialCard>
      <EditorialCard style={styles.infoCard}>
        <KatipanText variant="title">One Partner at a time</KatipanText>
        <KatipanText color="textMuted">The first invited Partner joins the existing Wedding as an equal Owner. The coordinator keeps their Full Coordinator membership. The other Partner can accept a separate invitation later and also becomes an equal Owner.</KatipanText>
      </EditorialCard>
      {error ? <KatipanText color="error" accessibilityRole="alert">{error}</KatipanText> : null}
      {notice ? <KatipanText color="primary" accessibilityRole="alert">{notice}</KatipanText> : null}
      <KatipanButton label="Create & Share Invitation" loading={busy} disabled={!targets.length || !selectedPersonId} onPress={() => void sendInvitation()} />
      <KatipanButton label="Back to Client Wedding" variant="text" onPress={() => router.replace({ pathname: "/(coordinator)/[weddingId]/overview", params: { weddingId } } as unknown as Href)} />
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: s.large, paddingBottom: s.extraLarge },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  intro: { gap: s.small },
  card: { gap: s.medium, backgroundColor: c.surfaceLowest, borderRadius: r.extraLarge, padding: s.cardLarge },
  infoCard: { gap: s.small, backgroundColor: c.surfaceLow, borderRadius: r.large, padding: s.cardLarge },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
});
