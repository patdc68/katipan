import { useState } from "react";
import { useRouter, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";
import { colorTokens as c, spacingTokens as s } from "@katipan/ui";
import { Brand } from "../onboarding/components";
import { useAccess } from "../onboarding/provider";
import { ErrorState, EditorialCard, KatipanButton, KatipanScreen, KatipanText, SectionHeader, StatusChip } from "../ui";
import { useWorkspace } from "./context";
import { roleLabel, weddingStatusLabel } from "./model";

const descriptions = {
  plan: "Tasks and milestones for this Wedding will live here. The Home tab already shows the current checklist progress and next due tasks.",
  guests: "The Home tab shows the latest individual RSVP totals. Guest list editing, Household invitations, and seating tools are part of the next feature slice.",
  budget: "The Home tab shows the current finance summary when your Wedding role can access it. Budget editing tools are part of the next feature slice.",
};

export function FeaturePlaceholder({ feature }: { feature: keyof typeof descriptions }) {
  const router = useRouter();
  const workspace = useWorkspace();
  const membership = workspace.selectedMembership;
  const title = feature === "plan" ? "Plan" : feature === "guests" ? "Guests" : "Budget";
  const weddingId = membership?.weddingId ?? "";
  return (
    <KatipanScreen contentContainerStyle={styles.content}>
      <Brand compact />
      <SectionHeader title={title} eyebrow="Wedding workspace" description={membership?.wedding.display_name ?? "Shared Wedding planning"} />
      <EditorialCard style={styles.preview}>
        <StatusChip label="Feature preview" tone="neutral" />
        <KatipanText variant="headlineMedium" accessibilityRole="header">{title} tools are coming in a future slice</KatipanText>
        <KatipanText color="textMuted">{descriptions[feature]}</KatipanText>
        {membership && <View style={styles.workspaceMeta}>
          <KatipanText variant="labelCaps" color="secondary">CURRENT WEDDING</KatipanText>
          <KatipanText variant="title">{membership.partnerNames.join(" & ") || membership.wedding.display_name || "Wedding workspace"}</KatipanText>
          <KatipanText variant="bodySmall" color="textMuted">{roleLabel(membership.role)} · {weddingStatusLabel(membership.wedding.status)}</KatipanText>
        </View>}
        <KatipanButton label="Return to Home" variant="secondary" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/home", params: { weddingId } })} />
      </EditorialCard>
    </KatipanScreen>
  );
}

export function MoreScreen() {
  const router = useRouter();
  const { session, signOut } = useAccess();
  const workspace = useWorkspace();
  const membership = workspace.selectedMembership;
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError(false);
    try { await signOut(); }
    catch { setError(true); setSigningOut(false); }
  }

  return (
    <KatipanScreen contentContainerStyle={styles.content}>
      <Brand compact />
      <SectionHeader title="More" eyebrow="Account & settings" description="Manage your account and switch Wedding workspaces." />
      <EditorialCard style={styles.accountCard}>
        <KatipanText variant="labelCaps" color="secondary">ACCOUNT</KatipanText>
        <KatipanText variant="title">{session?.user.email ?? "Signed-in account"}</KatipanText>
        {membership && <>
          <View style={styles.roleRow}>
            <StatusChip label={roleLabel(membership.role)} tone="success" />
            <StatusChip label={weddingStatusLabel(membership.wedding.status)} tone="neutral" />
          </View>
          <KatipanText color="textMuted">{membership.partnerNames.join(" & ") || membership.wedding.display_name || "Wedding workspace"}</KatipanText>
        </>}
        <KatipanButton label="Switch Wedding" variant="secondary" onPress={() => router.push("/(workspace)/weddings")} />
      </EditorialCard>
      {membership && (
        <EditorialCard style={styles.settingsCard}>
          <KatipanText variant="labelCaps" color="secondary">WEDDING ACCESS</KatipanText>
          <KatipanText variant="title">Wedding Team & Coordinator Access</KatipanText>
          <KatipanText color="textMuted">See active Wedding members, pending invitations, and the actions available to your current Wedding role.</KatipanText>
          <KatipanButton label="Open Wedding Team" variant="secondary"
            onPress={() => router.push({ pathname: "/(wedding)/[weddingId]/team", params: { weddingId: membership.weddingId } } as unknown as Href)} />
        </EditorialCard>
      )}
      {membership && (
        <EditorialCard style={styles.settingsCard}>
          <KatipanText variant="labelCaps" color="secondary">WEDDING STYLING</KatipanText>
          <KatipanText variant="title">Wedding Motif & Dress Code</KatipanText>
          <KatipanText color="textMuted">Plan the Wedding aesthetic, Guest attire, group guidance, and individual exceptions in one styling workspace.</KatipanText>
          <KatipanButton label="Open Wedding Styling" variant="secondary"
            onPress={() => router.push({ pathname: "/(wedding)/[weddingId]/style", params: { weddingId: membership.weddingId } } as unknown as Href)} />
        </EditorialCard>
      )}
      {membership && (
        <EditorialCard style={styles.settingsCard}>
          <KatipanText variant="labelCaps" color="secondary">WEDDING PLANNING</KatipanText>
          <KatipanText variant="title">Our Places</KatipanText>
          <KatipanText color="textMuted">Save ceremony, reception, accommodation, and other Wedding Places with notes for your group.</KatipanText>
          <KatipanButton label="Manage Wedding Places" variant="secondary"
            onPress={() => router.push({ pathname: "/(wedding)/[weddingId]/places", params: { weddingId: membership.weddingId } } as unknown as Href)} />
        </EditorialCard>
      )}
      {membership && (
        <EditorialCard style={styles.settingsCard}>
          <KatipanText variant="labelCaps" color="secondary">WEDDING WEBSITE</KatipanText>
          <KatipanText variant="title">Guest Program</KatipanText>
          <KatipanText color="textMuted">Manage the schedule that guests see, separate from the operational Run of Show.</KatipanText>
          <KatipanButton label="Open Wedding Website" variant="secondary"
            onPress={() => router.push({ pathname: "/(wedding)/[weddingId]/website", params: { weddingId: membership.weddingId } } as unknown as Href)} />
          <KatipanButton label="Open Guest Program" variant="secondary"
            onPress={() => router.push({ pathname: "/(wedding)/[weddingId]/website/program", params: { weddingId: membership.weddingId } } as unknown as Href)} />
        </EditorialCard>
      )}
      {membership && (
        <EditorialCard style={styles.settingsCard}>
          <KatipanText variant="labelCaps" color="secondary">WEDDING-DAY OPERATIONS</KatipanText>
          <KatipanText variant="title">Guest arrivals and check-in</KatipanText>
          <KatipanText color="textMuted">Scan Guest Passes, look up a Guest, and review individual check-in state.</KatipanText>
          <KatipanButton
            label="Open Wedding Day"
            variant="secondary"
            onPress={() => router.push({ pathname: "/(wedding)/[weddingId]/day", params: { weddingId: membership.weddingId } } as unknown as Href)}
          />
        </EditorialCard>
      )}
      <EditorialCard style={styles.settingsCard}>
        <KatipanText variant="title">Account security</KatipanText>
        <KatipanText color="textMuted">Sign out of this Katipan account on this device.</KatipanText>
        {error && <ErrorState title="Couldn't sign out" description="Check your connection, then try again." />}
        <KatipanButton label="Sign Out" variant="secondary" loading={signingOut} onPress={() => void handleSignOut()} />
      </EditorialCard>
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  preview: { gap: s.medium, backgroundColor: c.surfaceLowest },
  workspaceMeta: { gap: s.small, padding: s.medium, borderRadius: 16, backgroundColor: c.surfaceLow },
  accountCard: { gap: s.medium },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  settingsCard: { gap: s.medium },
});
