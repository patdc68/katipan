import { useEffect, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { Brand } from "../onboarding/components";
import { ErrorState, EditorialCard, KatipanButton, KatipanScreen, KatipanText, LoadingState, StatusChip } from "../ui";
import { useAccess } from "../onboarding/provider";
import { useWorkspace } from "../workspace/context";
import { roleLabel, weddingStatusLabel } from "../workspace/model";
import { canManageWeddingTeam } from "./model";
import { loadCoordinatorWeddingOverview, type CoordinatorWeddingOverview } from "./api";

export function CoordinatorOverviewScreen() {
  const params = useLocalSearchParams<{ weddingId?: string | string[] }>();
  const weddingId = Array.isArray(params.weddingId) ? params.weddingId[0] ?? "" : params.weddingId ?? "";
  const router = useRouter();
  const access = useAccess();
  const workspace = useWorkspace();
  const membership = workspace.membershipFor(weddingId);
  const [overview, setOverview] = useState<CoordinatorWeddingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let active = true;
    if (!weddingId || !membership?.membershipId) return () => { active = false; };
    void loadCoordinatorWeddingOverview(weddingId).then((result) => {
      if (active) { setOverview(result); setError(""); }
    }).catch(() => {
      if (active) setError("We could not load this Wedding overview. Check your membership and try again.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [membership?.membershipId, refreshVersion, weddingId]);

  if (access.loading || (access.session && workspace.loading)) return <KatipanScreen><LoadingState label="Opening the Wedding overview…" /></KatipanScreen>;
  if (!access.session) return <Redirect href="/(access)/welcome" />;
  if (!membership) return <Redirect href="/(workspace)/weddings" />;
  if (loading) return <KatipanScreen><LoadingState label="Loading client context…" /></KatipanScreen>;
  if (error || !overview) return <KatipanScreen><ErrorState description={error || "This Wedding overview is unavailable."} onRetry={() => { setLoading(true); setRefreshVersion((value) => value + 1); }} /></KatipanScreen>;

  const wedding = overview.wedding;
  const coupleName = overview.partners.map((partner) => partner.displayName).join(" & ") || wedding.display_name || "Client Wedding";
  const canManage = canManageWeddingTeam(membership);
  const unjoinedPartner = overview.partners.some((partner) => !partner.linkedUserId);
  const ownership = wedding.ownership_mode === "COORDINATOR_MANAGED"
    ? "Coordinator-managed"
    : "Couple-owned";

  return (
    <KatipanScreen contentContainerStyle={styles.screen}>
      <View style={styles.topline}><Brand /><KatipanText variant="labelCaps" color="secondary">CLIENT WEDDING</KatipanText></View>
      <View style={styles.intro}>
        <KatipanText variant="headlineMobile" accessibilityRole="header">{coupleName}</KatipanText>
        {wedding.display_name && wedding.display_name !== coupleName ? <KatipanText color="textMuted">{wedding.display_name}</KatipanText> : null}
        <KatipanText color="textMuted">A shared Wedding workspace with one current record for the couple, their people, and their planning.</KatipanText>
      </View>

      <EditorialCard style={styles.contextCard}>
        <View style={styles.chips}>
          <StatusChip label={roleLabel(membership.role)} tone={membership.role === "FULL_COORDINATOR" ? "success" : "neutral"} />
          <StatusChip label={ownership} tone="neutral" />
          <StatusChip label={weddingStatusLabel(wedding.status)} tone={wedding.status === "ACTIVE" ? "success" : "neutral"} />
        </View>
        <KatipanText variant="labelCaps" color="secondary">CLIENT CONTEXT</KatipanText>
        <Fact label="Wedding date" value={wedding.wedding_date ?? "Not added yet"} />
        <Fact label="General location" value={wedding.general_location ?? "Not added yet"} />
        <Fact label="Estimated guests" value={wedding.estimated_guest_count == null ? "Not added yet" : String(wedding.estimated_guest_count)} />
        <Fact label="Ceremony style" value={wedding.ceremony_style} />
      </EditorialCard>

      <EditorialCard style={styles.contextCard}>
        <KatipanText variant="labelCaps" color="secondary">PARTNERS</KatipanText>
        {overview.partners.map((partner) => (
          <View key={partner.personId} style={styles.partnerRow}>
            <View style={styles.partnerCopy}>
              <KatipanText variant="title">{partner.displayName}</KatipanText>
              <KatipanText variant="bodySmall" color="textMuted">{partner.linkedUserId ? "Joined Katipan" : "Has not joined yet"}</KatipanText>
            </View>
            <StatusChip label={partner.linkedUserId ? "Joined" : "Partner record"} tone={partner.linkedUserId ? "success" : "neutral"} />
          </View>
        ))}
        {wedding.ownership_mode === "COORDINATOR_MANAGED" ? (
          <KatipanText variant="bodySmall" color="textMuted">The Wedding stays on this same ID when a partner accepts. Each partner joins separately, and the coordinator remains a Full Coordinator after ownership transfers.</KatipanText>
        ) : (
          <KatipanText variant="bodySmall" color="textMuted">The couple now owns this Wedding. Your coordinator membership remains tied to this Wedding only.</KatipanText>
        )}
      </EditorialCard>

      <View style={styles.actions}>
        <KatipanButton label="Open Wedding Workspace" onPress={() => router.push({ pathname: "/(wedding)/[weddingId]/home", params: { weddingId } } as unknown as Href)} />
        {canManage && unjoinedPartner ? <KatipanButton label="Invite a Partner" variant="secondary" onPress={() => router.push({ pathname: "/(coordinator)/[weddingId]/invite-couple", params: { weddingId } } as unknown as Href)} /> : null}
        <KatipanButton label="Wedding Team & Coordinator Access" variant="secondary" onPress={() => router.push({ pathname: "/(wedding)/[weddingId]/team", params: { weddingId } } as unknown as Href)} />
        <KatipanButton label="Switch Wedding" variant="text" onPress={() => router.replace("/(workspace)/weddings")} />
      </View>
    </KatipanScreen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><KatipanText variant="bodySmall" color="textMuted">{label}</KatipanText><KatipanText variant="labelLarge">{value}</KatipanText></View>;
}

const styles = StyleSheet.create({
  screen: { gap: s.large, paddingBottom: s.extraLarge },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  intro: { gap: s.small },
  contextCard: { gap: s.medium, backgroundColor: c.surfaceLowest, borderRadius: r.extraLarge, padding: s.cardLarge },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  fact: { gap: s.micro, paddingVertical: s.small, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.stoneBorder },
  partnerRow: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  partnerCopy: { flex: 1, gap: s.micro },
  actions: { gap: s.small },
});
