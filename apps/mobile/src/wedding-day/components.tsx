import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { useWorkspace } from "../workspace/context";
import { isCurrentWeddingWorkspace, type WorkspaceMembership } from "../workspace/model";
import { setWeddingDayContext } from "./offline-store";
import {
  checkInResultPresentation,
  type WeddingDayCheckInResult,
  type WeddingDayItem,
  type WeddingDayReversalResult,
  reversalResultPresentation,
  type WeddingDayGuest,
} from "./model";
import { EditorialCard, KatipanButton, KatipanText, SectionHeader, StatusChip } from "../ui";

export function useWeddingDayRoute() {
  const params = useLocalSearchParams<{ weddingId?: string | string[] }>();
  const weddingId = Array.isArray(params.weddingId) ? params.weddingId[0] ?? "" : params.weddingId ?? "";
  const router = useRouter();
  const workspace = useWorkspace();
  const membership = weddingId ? workspace.membershipFor(weddingId) : null;
  const selectedMembership = workspace.selectedWeddingId ? workspace.membershipFor(workspace.selectedWeddingId) : null;
  const selectedUserId = selectedMembership?.userId;
  const selectedWeddingId = selectedMembership?.weddingId;
  const isCurrent = isCurrentWeddingWorkspace(membership, workspace.selectedWeddingId, weddingId);
  useEffect(() => {
    if (selectedUserId && selectedWeddingId) {
      void setWeddingDayContext(selectedUserId, selectedWeddingId).catch(() => undefined);
    }
  }, [selectedUserId, selectedWeddingId]);
  return { weddingId, router, workspace, membership, isCurrent };
}

export function WeddingDayHeader({
  membership,
  title = "Wedding Day",
  description,
}: {
  membership: WorkspaceMembership;
  title?: string;
  description?: string;
}) {
  const couple = membership.partnerNames.filter(Boolean).join(" & ") || membership.wedding.display_name || "Wedding workspace";
  return (
    <View style={styles.header}>
      <View style={styles.eyebrowRow}>
        <KatipanText variant="labelCaps" color="secondary">WEDDING DAY</KatipanText>
        <StatusChip label={membership.role.replaceAll("_", " ")} tone="neutral" />
      </View>
      <KatipanText variant="headlineLarge" accessibilityRole="header">{title}</KatipanText>
      <KatipanText variant="title" color="textMuted">{couple}</KatipanText>
      {!!description && <KatipanText color="textMuted">{description}</KatipanText>}
    </View>
  );
}

export function CheckInResultCard({
  result,
  queued = false,
}: {
  result?: WeddingDayCheckInResult | null;
  queued?: boolean;
}) {
  if (queued) {
    return (
      <EditorialCard style={styles.notice} accessibilityRole="summary">
        <StatusChip label="Queued for sync" tone="warning" />
        <KatipanText variant="title">Not confirmed yet</KatipanText>
        <KatipanText color="textMuted">This manual check-in is saved on this device. The server must confirm it before the Guest is counted as checked in.</KatipanText>
      </EditorialCard>
    );
  }
  if (!result) return null;
  const presentation = checkInResultPresentation(result);
  return (
    <EditorialCard style={styles.notice} accessibilityRole="summary">
      <StatusChip label={presentation.title} tone={presentation.tone} />
      {!!presentation.detail && (
        <KatipanText
          variant={result.status === "CHECKED_IN" || result.status === "ALREADY_CHECKED_IN" ? "title" : "body"}
          color={result.status === "CHECKED_IN" || result.status === "ALREADY_CHECKED_IN" ? undefined : "textMuted"}
        >
          {presentation.detail}
        </KatipanText>
      )}
    </EditorialCard>
  );
}

export function ReversalResultCard({ result }: { result?: WeddingDayReversalResult | null }) {
  if (!result) return null;
  const presentation = reversalResultPresentation(result);
  return (
    <EditorialCard style={styles.notice} accessibilityRole="summary">
      <StatusChip label={presentation.title} tone={result.status === "REVERSED" ? "success" : "neutral"} />
      <KatipanText color="textMuted">{presentation.detail}</KatipanText>
    </EditorialCard>
  );
}

export function WeddingDayItemCard({ item, label }: { item: WeddingDayItem; label: string }) {
  const start = useMemo(() => formatTime(item.scheduledStart), [item.scheduledStart]);
  const end = useMemo(() => item.scheduledEnd ? formatTime(item.scheduledEnd) : null, [item.scheduledEnd]);
  const actual = useMemo(() => item.actualStart ? formatTime(item.actualStart) : null, [item.actualStart]);
  return (
    <EditorialCard style={styles.itemCard}>
      <View style={styles.itemTop}>
        <KatipanText variant="labelCaps" color="secondary">{label}</KatipanText>
        <StatusChip label={item.status.replaceAll("_", " ")} tone={item.status === "DELAYED" ? "warning" : item.status === "IN_PROGRESS" ? "success" : "neutral"} />
      </View>
      <KatipanText variant="headlineSmall" accessibilityRole="header">{item.title}</KatipanText>
      <KatipanText color="textMuted">Scheduled {start}{end ? ` – ${end}` : ""}{actual ? ` · Started ${actual}` : ""}</KatipanText>
      {!!item.description?.trim() && <KatipanText color="textMuted">{item.description}</KatipanText>}
    </EditorialCard>
  );
}

export function CheckInGuestRow({
  guest,
  pending = false,
  disabled = false,
  onCheckIn,
  onReverse,
}: {
  guest: WeddingDayGuest;
  pending?: boolean;
  disabled?: boolean;
  onCheckIn: () => void;
  onReverse: () => void;
}) {
  const status = guest.isCheckedIn ? "Checked In" : "Not Checked In";
  return (
    <EditorialCard style={[styles.guestCard, guest.rsvpStatus === "ATTENDING" && styles.attendingCard]}>
      <View style={styles.guestTitleRow}>
        <View style={styles.guestCopy}>
          <KatipanText variant="title" accessibilityRole="header">{guest.displayName}</KatipanText>
          <KatipanText variant="bodySmall" color="textMuted">{guest.householdName}</KatipanText>
        </View>
        {guest.rsvpStatus === "ATTENDING" && <StatusChip label="Attending" tone="success" />}
      </View>
      <View style={styles.chipRow}>
        <StatusChip label={rsvpLabel(guest.rsvpStatus)} tone={guest.rsvpStatus === "DECLINED" ? "warning" : guest.rsvpStatus === "ATTENDING" ? "success" : "neutral"} />
        <StatusChip label={status} tone={guest.isCheckedIn ? "success" : "neutral"} />
        {pending && <StatusChip label="Pending Sync" tone="warning" />}
      </View>
      {guest.seatingAvailable ? (
        guest.tableSeatSummaries.length
          ? guest.tableSeatSummaries.map((summary) => <KatipanText key={summary} variant="bodySmall" color="textMuted">{summary}</KatipanText>)
          : <KatipanText variant="bodySmall" color="textMuted">No table assigned</KatipanText>
      ) : (
        <KatipanText variant="bodySmall" color="textMuted">{guest.tableSeatSummaries.length ? guest.tableSeatSummaries.join(" · ") : "Seating details unavailable"}</KatipanText>
      )}
      {pending ? (
        <KatipanText variant="bodySmall" color="textMuted">This Guest is waiting for server confirmation.</KatipanText>
      ) : guest.isCheckedIn ? (
        <KatipanButton label="Reverse Check-In" variant="secondary" disabled={disabled} onPress={onReverse} />
      ) : (
        <KatipanButton label="Manual Check-In" disabled={disabled} onPress={onCheckIn} />
      )}
    </EditorialCard>
  );
}

export function FilterPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filter, selected && styles.filterSelected]}
    >
      <KatipanText variant="labelLarge" color={selected ? "onPrimary" : "text"}>{label}</KatipanText>
    </Pressable>
  );
}

export function WeddingDayScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.screenHeader}>
      <KatipanButton label="Back to Wedding Day" variant="text" onPress={onBack} />
      <SectionHeader title={title} eyebrow="WEDDING DAY" />
    </View>
  );
}

export function formatTime(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(parsed);
}

function rsvpLabel(status: WeddingDayGuest["rsvpStatus"]): string {
  if (status === "ATTENDING") return "Attending";
  if (status === "DECLINED") return "Declined";
  return "No Response";
}

const styles = StyleSheet.create({
  header: { gap: s.small },
  eyebrowRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  notice: { gap: s.small, backgroundColor: c.surfaceLow },
  itemCard: { gap: s.small, backgroundColor: c.surfaceLowest },
  itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  guestCard: { gap: s.medium, padding: s.medium, backgroundColor: c.surfaceLowest },
  attendingCard: { borderColor: c.primaryContainer, borderWidth: 1.5 },
  guestTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: s.small },
  guestCopy: { flex: 1, gap: s.micro },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  filter: { minHeight: 40, paddingHorizontal: s.medium, paddingVertical: s.small, alignItems: "center", justifyContent: "center", borderRadius: r.pill, borderWidth: 1, borderColor: c.stoneBorder, backgroundColor: c.surfaceLowest },
  filterSelected: { backgroundColor: c.primaryContainer, borderColor: c.primaryContainer },
  screenHeader: { gap: s.medium },
});
