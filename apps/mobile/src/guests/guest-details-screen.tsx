import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { setGuestRsvp } from "./api";
import { GuestFilterChip } from "./components";
import {
  buildGuestEntries,
  canManageGuestDomain,
  canViewGuestNotes,
  guestAllowanceLabel,
  guestName,
  guestRsvpLabel,
  guestRsvpStatus,
  guestRsvpStatuses,
  safeGuestError,
  SingleSubmitGate,
  type GuestEntry,
  type GuestWorkspaceData,
} from "./model";
import { useGuestWorkspace } from "./use-guest-workspace";
import type { WorkspaceMembership } from "../workspace/model";
import {
  EditorialCard,
  ErrorState,
  FormField,
  KatipanButton,
  KatipanScreen,
  KatipanText,
  LoadingState,
  SectionHeader,
  StatusChip,
} from "../ui";

export default function GuestDetailsScreen() {
  const params = useLocalSearchParams<{ guestId?: string | string[] }>();
  const guestId = Array.isArray(params.guestId) ? params.guestId[0] ?? "" : params.guestId ?? "";
  const { weddingId, membership, isCurrent, loading, error, data, retry } = useGuestWorkspace();
  const router = useRouter();
  const entries = data ? buildGuestEntries(data) : [];
  const entry = entries.find((item) => item.guest.id === guestId && item.guest.wedding_id === weddingId);

  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading Guest details…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load this Guest." onRetry={retry} /></KatipanScreen>;
  if (!entry) return <KatipanScreen><ErrorState title="Guest unavailable" description="This Guest isn't part of the selected Wedding." onRetry={() => router.replace({ pathname: "/(wedding)/[weddingId]/guests/list", params: { weddingId } })} /></KatipanScreen>;

  return <GuestDetailsContent key={`${entry.guest.id}:${entry.guest.updated_at}:${entry.rsvp?.updated_at ?? "none"}`} weddingId={weddingId} membership={membership} data={data} entry={entry} retry={retry} />;
}

function GuestDetailsContent({
  weddingId,
  membership,
  data,
  entry,
  retry,
}: {
  weddingId: string;
  membership: WorkspaceMembership;
  data: GuestWorkspaceData;
  entry: GuestEntry;
  retry: () => void;
}) {
  const router = useRouter();
  const gate = useRef(new SingleSubmitGate());
  const [selectedStatus, setSelectedStatus] = useState<(typeof guestRsvpStatuses)[number]>(() => guestRsvpStatus(entry.rsvp));
  const [mealChoice, setMealChoice] = useState(() => entry.rsvp?.meal_choice ?? "");
  const [dietaryNotes, setDietaryNotes] = useState(() => entry.rsvp?.dietary_notes ?? "");
  const [responseNotes, setResponseNotes] = useState(() => entry.rsvp?.response_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const canEdit = canManageGuestDomain(membership);
  const canReadNotes = canViewGuestNotes(membership);
  const rsvpStatus = guestRsvpStatus(entry.rsvp);
  const allowanceById = new Map(data.allowances.filter((item) => item.wedding_id === weddingId).map((item) => [item.id, item]));
  const saveRsvp = async () => {
    await gate.current.run(async () => {
      if (saving) return;
      setSaving(true);
      setSavingError(null);
      try {
        await setGuestRsvp(membership, entry.guest.id, selectedStatus, mealChoice, dietaryNotes, responseNotes);
        retry();
      } catch (cause) {
        setSavingError(safeGuestError(cause, "We couldn't update this Guest's RSVP."));
      } finally { setSaving(false); }
    });
  };
  const editGuest = () => router.navigate({
    pathname: "/(wedding)/[weddingId]/guests/[guestId]/edit",
    params: { weddingId, guestId: entry.guest.id },
  });
  const openHousehold = () => router.navigate({
    pathname: "/(wedding)/[weddingId]/guests/households/[householdId]",
    params: { weddingId, householdId: entry.household.id },
  });

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">GUEST / INDIVIDUAL DETAILS</KatipanText>
        <View style={styles.personHeading}>
          <View style={styles.avatar}><KatipanText variant="headlineMedium" color="primary">{guestName(entry).slice(0, 1).toUpperCase()}</KatipanText></View>
          <View style={styles.titleCopy}>
            <KatipanText variant="headlineLarge" accessibilityRole="header">{guestName(entry)}</KatipanText>
            <GuestFilterChip label={entry.household.display_name} selected={false} onPress={openHousehold} />
          </View>
        </View>
        <GuestRsvpHeader status={rsvpStatus} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Contact & personal details" description="Wedding Person data linked to this individual Guest" />
        <EditorialCard style={styles.detailsCard}>
          {!!entry.person.email && <DetailLine label="Email" value={entry.person.email} />}
          {!!entry.person.phone && <DetailLine label="Phone" value={entry.person.phone} />}
          {!!entry.person.first_name && <DetailLine label="First name" value={entry.person.first_name} />}
          {!!entry.person.last_name && <DetailLine label="Last name" value={entry.person.last_name} />}
          {!entry.person.email && !entry.person.phone && !entry.person.first_name && !entry.person.last_name && <KatipanText color="textMuted">No contact details are recorded.</KatipanText>}
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Individual RSVP" description="This response belongs to this Guest, not the Household." />
        <EditorialCard style={styles.rsvpCard}>
          <View style={styles.statusRow}>
            {guestRsvpStatuses.map((status) => (
              <GuestFilterChip
                key={status}
                label={guestRsvpLabel(status)}
                selected={selectedStatus === status}
                disabled={!canEdit || saving}
                onPress={() => setSelectedStatus(status)}
              />
            ))}
          </View>
          <FormField label="Meal choice" value={mealChoice} onChangeText={setMealChoice} editable={canEdit && !saving} placeholder="No meal choice recorded" maxLength={160} />
          <FormField label="Dietary notes" value={dietaryNotes} onChangeText={setDietaryNotes} editable={canEdit && !saving} placeholder="No dietary notes recorded" multiline numberOfLines={3} maxLength={2000} />
          <FormField label="Response notes" value={responseNotes} onChangeText={setResponseNotes} editable={canEdit && !saving} placeholder="Optional RSVP context" multiline numberOfLines={3} maxLength={2000} />
          {entry.rsvp?.responded_at && <KatipanText variant="bodySmall" color="textMuted">Response recorded {new Date(entry.rsvp.responded_at).toLocaleDateString()}</KatipanText>}
          {canEdit && <KatipanButton label="Save RSVP details" loading={saving} onPress={() => void saveRsvp()} />}
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Guest groups" description="Groups are labels for named Guests." />
        <EditorialCard style={styles.detailsCard}>
          {entry.groupNames.length
            ? <View style={styles.chipRow}>{entry.groupNames.map((name) => <StatusChip key={name} label={name} tone="neutral" />)}</View>
            : <KatipanText color="textMuted">No guest groups are assigned.</KatipanText>}
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Allowances & claims" description="Allowance claims link to real Guests; an unused allowance has no person record." />
        <EditorialCard style={styles.detailsCard}>
          {entry.allowanceClaims.length ? entry.allowanceClaims.map((claim) => {
            const allowance = allowanceById.get(claim.allowance_id);
            return <DetailLine key={claim.allowance_id} label={allowance ? guestAllowanceLabel(allowance.allowance_type) : "Allowance"} value="Claimed by this Guest" />;
          }) : <KatipanText color="textMuted">No allowance is claimed for this Guest.</KatipanText>}
        </EditorialCard>
      </View>

      {entry.entourageRoles !== null && (
        <View style={styles.section}>
          <SectionHeader title="Wedding roles" description="Existing entourage assignments" />
          <EditorialCard style={styles.detailsCard}>
            {entry.entourageRoles.length
              ? <View style={styles.chipRow}>{entry.entourageRoles.map((role) => <StatusChip key={role} label={role} tone="success" />)}</View>
              : <KatipanText color="textMuted">No entourage role is recorded.</KatipanText>}
            <KatipanText variant="bodySmall" color="textMuted">Role management is available in a later slice.</KatipanText>
          </EditorialCard>
        </View>
      )}

      {entry.seating !== null && (
        <View style={styles.section}>
          <SectionHeader title="Seating assignment" description="Seating is tracked separately from RSVP and event check-in." />
          <EditorialCard style={styles.detailsCard}>
            {entry.seating.length ? entry.seating.map((item) => (
              <DetailLine key={`${item.eventName}:${item.tableName}`} label={item.eventName} value={`${item.tableName}${item.hasSeat ? " · Seat assigned" : " · Table only"}`} />
            )) : <KatipanText color="textMuted">No seating assignment is recorded.</KatipanText>}
          </EditorialCard>
        </View>
      )}

      {canReadNotes && (!!entry.guest.accessibility_assistance_note?.trim() || !!entry.guest.internal_notes?.trim()) && (
        <View style={styles.section}>
          <SectionHeader title="Private planner notes" description="Available to guest-domain managers" />
          <EditorialCard style={styles.notesCard}>
            {!!entry.guest.accessibility_assistance_note?.trim() && <DetailLine label="Accessibility assistance" value={entry.guest.accessibility_assistance_note} />}
            {!!entry.guest.internal_notes?.trim() && <DetailLine label="Internal note" value={entry.guest.internal_notes} />}
          </EditorialCard>
        </View>
      )}

      <EditorialCard style={styles.separationCard}>
        <KatipanText variant="labelCaps" color="secondary">SEPARATE GUEST-DAY STATES</KatipanText>
        <KatipanText variant="bodySmall" color="textMuted">Invitation delivery, RSVP, seating, Guest Pass and check-in are tracked independently. This RSVP does not confirm seating, a Guest Pass or check-in.</KatipanText>
      </EditorialCard>

      {!!savingError && <KatipanText accessibilityRole="alert" color="error">{savingError}</KatipanText>}
      {canEdit && <KatipanButton label="Edit Guest Details" variant="secondary" onPress={editGuest} />}
    </KatipanScreen>
  );
}

function GuestRsvpHeader({ status }: { status: (typeof guestRsvpStatuses)[number] }) {
  const tone = status === "ATTENDING" ? "success" : status === "DECLINED" ? "error" : "warning";
  return <StatusChip label={guestRsvpLabel(status)} tone={tone} />;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <KatipanText variant="bodySmall" color="textMuted">{label}</KatipanText>
      <KatipanText variant="bodySmall" style={styles.detailValue}>{value}</KatipanText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  titleBlock: { gap: s.medium },
  personHeading: { flexDirection: "row", alignItems: "center", gap: s.medium },
  avatar: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: r.pill, backgroundColor: c.primaryFixed, borderWidth: 1, borderColor: c.stoneBorder },
  titleCopy: { flex: 1, gap: s.small },
  section: { gap: s.medium },
  detailsCard: { gap: s.medium },
  rsvpCard: { gap: s.medium, padding: s.medium },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  detailLine: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s.medium },
  detailValue: { flex: 1, textAlign: "right" },
  notesCard: { gap: s.medium, padding: s.medium, backgroundColor: c.warmAlabaster },
  separationCard: { gap: s.small, padding: s.medium, backgroundColor: c.surfaceLow },
});
