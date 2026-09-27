import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import {
  claimGuestAllowance,
  markHouseholdInvitationSent,
  releaseGuestAllowanceClaim,
  resetHouseholdInvitationDelivery,
} from "./api";
import { GuestFilterChip, GuestRow, ProgressBar } from "./components";
import {
  buildGuestEntries,
  canManageGuestDomain,
  canViewGuestNotes,
  deriveHouseholdProgress,
  guestAllowanceLabel,
  householdProgressLabel,
  safeGuestError,
  SingleSubmitGate,
} from "./model";
import { useGuestWorkspace } from "./use-guest-workspace";
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

export default function HouseholdDetailsScreen() {
  const params = useLocalSearchParams<{ householdId?: string | string[] }>();
  const householdId = Array.isArray(params.householdId) ? params.householdId[0] ?? "" : params.householdId ?? "";
  const { weddingId, membership, isCurrent, loading, error, data, retry } = useGuestWorkspace();
  const router = useRouter();
  const gate = useRef(new SingleSubmitGate());
  const [saving, setSaving] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [claimingAllowanceId, setClaimingAllowanceId] = useState<string | null>(null);

  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading Household details…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load this Household." onRetry={retry} /></KatipanScreen>;

  const household = data.households.find((item) => item.id === householdId && item.wedding_id === weddingId);
  if (!household) return <KatipanScreen><ErrorState title="Household unavailable" description="This Household isn't part of the selected Wedding." onRetry={() => router.replace({ pathname: "/(wedding)/[weddingId]/guests/list", params: { weddingId } })} /></KatipanScreen>;

  const canEdit = canManageGuestDomain(membership);
  const canReadNotes = canViewGuestNotes(membership);
  const entries = buildGuestEntries(data);
  const members = entries.filter((entry) => entry.household.id === household.id);
  const derived = deriveHouseholdProgress(household.id, data.guests, data.rsvps);
  const viewProgress = data.householdProgress.find((row) => row.household_id === household.id);
  const totalGuests = viewProgress?.total_guests ?? derived.totalGuests;
  const respondedGuests = viewProgress?.responded_guests ?? derived.respondedGuests;
  const progressStatus = viewProgress?.progress ?? derived.progress;
  const progressPercent = totalGuests === 0 ? 0 : Math.round((respondedGuests / totalGuests) * 100);
  const allowances = data.allowances.filter((item) => item.wedding_id === weddingId && item.household_id === household.id);

  const runMutation = async (action: () => Promise<void>, allowanceId?: string) => {
    await gate.current.run(async () => {
      if (saving) return;
      setSaving(true);
      setSavingError(null);
      setClaimingAllowanceId(allowanceId ?? null);
      try {
        await action();
        retry();
      } catch (cause) {
        setSavingError(safeGuestError(cause));
      } finally {
        setSaving(false);
        setClaimingAllowanceId(null);
      }
    });
  };
  const openGuest = (guestId: string) => router.navigate({
    pathname: "/(wedding)/[weddingId]/guests/[guestId]",
    params: { weddingId, guestId },
  });
  const addGuest = () => router.navigate({ pathname: "/(wedding)/[weddingId]/guests/add", params: { weddingId, householdId } });
  const editHousehold = () => router.navigate({
    pathname: "/(wedding)/[weddingId]/guests/households/[householdId]/edit",
    params: { weddingId, householdId },
  });

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">GUESTS / HOUSEHOLD</KatipanText>
        <KatipanText variant="headlineLarge" accessibilityRole="header">{household.display_name}</KatipanText>
        <View style={styles.badgeRow}>
          <StatusChip label={household.delivery_status === "SENT" ? "Invitation sent" : "Not sent"} tone={household.delivery_status === "SENT" ? "success" : "neutral"} />
          <StatusChip label={householdProgressLabel(progressStatus)} tone={progressStatus === "RESPONDED" ? "success" : progressStatus === "PARTIALLY_RESPONDED" ? "warning" : "neutral"} />
        </View>
      </View>

      {canEdit && <View style={styles.actionRow}>
        <KatipanButton label="Edit Household" variant="secondary" onPress={editHousehold} />
        <KatipanButton label="Add Guest" onPress={addGuest} />
      </View>}

      <View style={styles.section}>
        <SectionHeader title="Household invitation" description="Invitation delivery is separate from individual RSVP responses." />
        <EditorialCard style={styles.deliveryCard}>
          <View style={styles.deliveryHeading}>
            <View style={styles.deliveryCopy}>
              <KatipanText variant="labelCaps" color="secondary">DELIVERY STATUS</KatipanText>
              <KatipanText variant="headlineSmall">{household.delivery_status === "SENT" ? "Sent" : "Not sent"}</KatipanText>
              {!!household.sent_at && <KatipanText variant="bodySmall" color="textMuted">Recorded {new Date(household.sent_at).toLocaleDateString()}</KatipanText>}
            </View>
            <StatusChip label="Household" tone="neutral" />
          </View>
          {canEdit && (household.delivery_status === "SENT"
            ? <KatipanButton label="Reset to Not Sent" variant="secondary" loading={saving && !claimingAllowanceId} onPress={() => void runMutation(() => resetHouseholdInvitationDelivery(membership, household.id))} />
            : <KatipanButton label="Mark Invitation Sent" loading={saving && !claimingAllowanceId} onPress={() => void runMutation(() => markHouseholdInvitationSent(membership, household.id))} />)}
          <KatipanText variant="bodySmall" color="textMuted">This records delivery tracking only. It doesn&apos;t send an invitation or change any Guest&apos;s RSVP.</KatipanText>
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title="RSVP progress" description="Derived from the responses of named Guests in this Household." />
        <EditorialCard style={styles.progressCard}>
          <View style={styles.progressHeading}>
            <View style={styles.progressCopy}>
              <KatipanText variant="headlineSmall">{respondedGuests} of {totalGuests} responded</KatipanText>
              <KatipanText variant="bodySmall" color="textMuted">{derived.attendingGuests} attending · {derived.declinedGuests} declined · {derived.noResponseGuests} no response</KatipanText>
            </View>
            <KatipanText variant="headlineMedium" color="primary">{progressPercent}%</KatipanText>
          </View>
          <ProgressBar value={progressPercent} label={`${respondedGuests} of ${totalGuests} Household Guests responded`} />
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Household members" description={`${members.length} named ${members.length === 1 ? "Guest" : "Guests"}`} />
        {members.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState title="No named Guests yet" description="An allowance doesn&apos;t create a Guest. Add an individual Guest when you know who is invited." action={canEdit ? <KatipanButton label="Add Guest" onPress={addGuest} /> : undefined} />
          </EditorialCard>
        ) : members.map((entry) => <GuestRow key={entry.guest.id} entry={entry} onPress={() => openGuest(entry.guest.id)} />)}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Guest allowances" description="An unused plus one or child allowance is not a named Guest." />
        {allowances.length === 0 ? (
          <EditorialCard style={styles.compactCard}><KatipanText color="textMuted">No allowances are recorded for this Household.</KatipanText></EditorialCard>
        ) : allowances.map((allowance) => {
          const claims = data.allowanceClaims.filter((claim) => claim.allowance_id === allowance.id && claim.wedding_id === weddingId);
          const claimGuestIds = new Set(claims.map((claim) => claim.guest_id));
          const candidates = members.filter((entry) => !claimGuestIds.has(entry.guest.id));
          const canClaim = canEdit && claims.length < allowance.max_count;
          return (
            <EditorialCard key={allowance.id} style={styles.allowanceCard}>
              <View style={styles.allowanceHeading}>
                <View style={styles.allowanceCopy}>
                  <KatipanText variant="title">{guestAllowanceLabel(allowance.allowance_type)}</KatipanText>
                  <KatipanText variant="bodySmall" color="textMuted">{claims.length} of {allowance.max_count} claimed</KatipanText>
                </View>
                <StatusChip label={claims.length >= allowance.max_count ? "Claimed" : "Available"} tone={claims.length >= allowance.max_count ? "success" : "neutral"} />
              </View>
              {claims.map((claim) => {
                const entry = members.find((item) => item.guest.id === claim.guest_id);
                return (
                  <View key={claim.guest_id} style={styles.claimRow}>
                    <KatipanText variant="bodySmall" style={styles.claimName}>{entry?.person.display_name ?? "Guest"}</KatipanText>
                    {canEdit && <GuestFilterChip label="Release" selected={false} disabled={saving} onPress={() => void runMutation(() => releaseGuestAllowanceClaim(membership, allowance.id, claim.guest_id), allowance.id)} />}
                  </View>
                );
              })}
              {canClaim && (candidates.length > 0 ? (
                <View style={styles.claimChoices}>
                  <KatipanText variant="labelCaps" color="secondary">LINK TO A NAMED GUEST</KatipanText>
                  {candidates.map((entry) => (
                    <Pressable
                      key={entry.guest.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Claim ${guestAllowanceLabel(allowance.allowance_type)} allowance for ${entry.person.display_name}`}
                      disabled={saving}
                      onPress={() => void runMutation(() => claimGuestAllowance(membership, allowance.id, entry.guest.id), allowance.id)}
                      style={styles.claimChoice}
                    >
                      <KatipanText variant="labelLarge" color="primary">{entry.person.display_name}</KatipanText>
                      <KatipanText variant="bodySmall" color="textMuted">{claimingAllowanceId === allowance.id ? "Saving…" : "Claim allowance"}</KatipanText>
                    </Pressable>
                  ))}
                </View>
              ) : <KatipanText variant="bodySmall" color="textMuted">Add a named Guest before claiming this allowance.</KatipanText>)}
            </EditorialCard>
          );
        })}
      </View>

      {canReadNotes && !!household.notes?.trim() && (
        <View style={styles.section}>
          <SectionHeader title="Household notes" description="Private planning context" />
          <EditorialCard style={styles.notesCard}><KatipanText>{household.notes}</KatipanText></EditorialCard>
        </View>
      )}

      {!!savingError && <KatipanText accessibilityRole="alert" color="error">{savingError}</KatipanText>}
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  titleBlock: { gap: s.small },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  section: { gap: s.medium },
  deliveryCard: { gap: s.medium, padding: s.medium },
  deliveryHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  deliveryCopy: { flex: 1, gap: s.micro },
  progressCard: { gap: s.medium },
  progressHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s.medium },
  progressCopy: { flex: 1, gap: s.small },
  emptyCard: { padding: 0 },
  compactCard: { padding: s.medium },
  allowanceCard: { gap: s.medium, padding: s.medium },
  allowanceHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  allowanceCopy: { flex: 1, gap: s.micro },
  claimRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small, paddingVertical: s.small, borderTopWidth: 1, borderTopColor: c.stoneBorder },
  claimName: { flex: 1 },
  claimChoices: { gap: s.small, paddingTop: s.small, borderTopWidth: 1, borderTopColor: c.stoneBorder },
  claimChoice: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small, padding: s.small, borderRadius: r.medium, backgroundColor: c.surfaceLow },
  notesCard: { padding: s.medium, backgroundColor: c.warmAlabaster },
});
