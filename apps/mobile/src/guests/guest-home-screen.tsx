import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { Brand } from "../onboarding/components";
import {
  EditorialCard,
  EmptyState,
  ErrorState,
  KatipanButton,
  KatipanScreen,
  KatipanText,
  LoadingState,
  SectionHeader,
  StatusChip,
} from "../ui";
import { weddingDisplayName } from "../workspace/presentation";
import { buildGuestEntries, canManageGuestDomain, deriveGuestSummary, householdProgressLabel } from "./model";
import { ProgressBar, SummaryCount } from "./components";
import { useGuestWorkspace } from "./use-guest-workspace";

export default function GuestHomeScreen() {
  const { weddingId, membership, isCurrent, loading, error, data, retry } = useGuestWorkspace();
  const router = useRouter();
  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading Wedding guests…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load guests for this Wedding." onRetry={retry} /></KatipanScreen>;

  const summary = deriveGuestSummary(data.guests, data.rsvps, data.households);
  const entries = buildGuestEntries(data);
  const canEdit = canManageGuestDomain(membership);
  const weddingName = weddingDisplayName(membership.partnerNames, membership.wedding.display_name);
  const openList = () => router.navigate({ pathname: "/(wedding)/[weddingId]/guests/list", params: { weddingId } });
  const openEntourage = () => router.navigate({ pathname: "/(wedding)/[weddingId]/guests/entourage", params: { weddingId } });
  const openSeating = () => router.navigate({ pathname: "/(wedding)/[weddingId]/seating", params: { weddingId } });
  const openHousehold = (householdId: string) => router.navigate({
    pathname: "/(wedding)/[weddingId]/guests/households/[householdId]",
    params: { weddingId, householdId },
  });

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.brandRow}>
        <View style={styles.brandCopy}><Brand compact /><KatipanText variant="labelCaps" color="secondary">GUESTS & INVITATIONS</KatipanText></View>
        <StatusChip label={membership.role.replaceAll("_", " ")} tone="success" />
      </View>
      <View style={styles.titleBlock}>
        <KatipanText variant="headlineLarge" accessibilityRole="header">Guest Invitations</KatipanText>
        <KatipanText color="textMuted">{weddingName}</KatipanText>
      </View>

      <EditorialCard style={styles.invitationCard}>
        <View style={styles.invitationHeading}>
          <View style={styles.invitationCopy}>
            <KatipanText variant="labelCaps" color="secondary">YOUR GUEST LIST</KatipanText>
            <KatipanText variant="headlineMedium">{summary.totalGuests} individual {summary.totalGuests === 1 ? "Guest" : "Guests"}</KatipanText>
            <KatipanText color="textMuted">RSVP progress is counted from individual Guest responses.</KatipanText>
          </View>
          <KatipanText variant="headlineLarge" color="primary">{summary.rsvpProgressPercent}%</KatipanText>
        </View>
        <ProgressBar value={summary.rsvpProgressPercent} label={`${summary.responded} of ${summary.totalGuests} Guests responded`} />
        <View style={styles.summaryRow}>
          <SummaryCount label="ATTENDING" value={summary.attending} tone="success" />
          <SummaryCount label="NO RESPONSE" value={summary.noResponse} tone="warning" />
          <SummaryCount label="DECLINED" value={summary.declined} tone="error" />
        </View>
        <KatipanButton label="Open Guest List" onPress={openList} />
        <KatipanButton label={canEdit ? "Manage Entourage Roles" : "View Entourage Roles"} variant="secondary" onPress={openEntourage} />
        <KatipanButton label={canEdit ? "Manage Reception Seating" : "View Reception Seating"} variant="secondary" onPress={openSeating} />
        {canEdit && <KatipanButton label="Create Household" variant="secondary" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/guests/households/new", params: { weddingId } })} />}
      </EditorialCard>

      <View style={styles.section}>
        <SectionHeader
          title="Invitation delivery"
          description="Household delivery status stays separate from each Guest&apos;s RSVP."
          action={<KatipanButton label="View households" variant="text" onPress={openList} />}
        />
        <EditorialCard style={styles.deliveryCard}>
          <View style={styles.deliveryLine}>
            <SummaryCount label="SENT" value={summary.sentHouseholds} tone="success" />
            <SummaryCount label="NOT SENT" value={summary.notSentHouseholds} tone="neutral" />
            <SummaryCount label="HOUSEHOLDS" value={data.households.length} tone="neutral" />
          </View>
          <KatipanText variant="bodySmall" color="textMuted">Marking an invitation sent never changes an individual Guest&apos;s RSVP.</KatipanText>
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Households"
          description="Invitation groupings with RSVP progress derived from their Guests."
          action={<KatipanButton label="Guest List" variant="text" onPress={openList} />}
        />
        {data.households.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState
              title="Your guest list starts with a Household"
              description="Create an invitation grouping, then add named Guests to it. Allowances stay separate from people."
              action={canEdit ? <KatipanButton label="Create Household" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/guests/households/new", params: { weddingId } })} /> : undefined}
            />
          </EditorialCard>
        ) : (
          <View style={styles.householdList}>
            {data.households.slice(0, 4).map((household) => {
              const progress = data.householdProgress.find((row) => row.household_id === household.id);
              const memberCount = entries.filter((entry) => entry.household.id === household.id).length;
              return (
                <Pressable
                  key={household.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open Household ${household.display_name}`}
                  onPress={() => openHousehold(household.id)}
                  style={styles.householdRow}
                >
                  <View style={styles.householdCopy}>
                    <KatipanText variant="title">{household.display_name}</KatipanText>
                    <KatipanText variant="bodySmall" color="textMuted">{memberCount} {memberCount === 1 ? "Guest" : "Guests"} · {householdProgressLabel(progress?.progress)}</KatipanText>
                  </View>
                  <StatusChip label={household.delivery_status === "SENT" ? "Sent" : "Not sent"} tone={household.delivery_status === "SENT" ? "success" : "neutral"} />
                  <KatipanText variant="headlineSmall" color="outline">›</KatipanText>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Guest list" description="Keep responses and invitation delivery clear." />
        <KatipanButton label="Browse all Guests" variant="secondary" onPress={openList} />
      </View>
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  brandRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  brandCopy: { flexDirection: "row", alignItems: "center", gap: s.medium },
  titleBlock: { gap: s.small },
  invitationCard: { gap: s.large, padding: s.cardLarge, backgroundColor: c.surfaceLow },
  invitationHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s.medium },
  invitationCopy: { flex: 1, gap: s.small },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: s.small },
  section: { gap: s.medium },
  deliveryCard: { gap: s.medium, padding: s.medium },
  deliveryLine: { flexDirection: "row", gap: s.medium },
  emptyCard: { padding: 0 },
  householdList: { gap: s.small },
  householdRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: s.small,
    padding: s.medium,
    borderRadius: r.large,
    borderWidth: 1,
    borderColor: c.stoneBorder,
    backgroundColor: c.cardIvory,
  },
  householdCopy: { flex: 1, gap: s.micro },
});
