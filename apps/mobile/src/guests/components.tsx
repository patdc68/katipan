import { Pressable, StyleSheet, View } from "react-native";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { EditorialCard, KatipanText, StatusChip } from "../ui";
import { guestName, guestRsvpLabel, guestRsvpStatus, type GuestEntry, type GuestRsvpStatus } from "./model";

export function GuestStatusChip({ status }: { status: GuestRsvpStatus }) {
  const tone = status === "ATTENDING" ? "success" : status === "DECLINED" ? "error" : "warning";
  return <StatusChip label={guestRsvpLabel(status)} tone={tone} />;
}

export function GuestFilterChip({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.filterChip, selected && styles.filterChipSelected, disabled && styles.disabled]}
    >
      <KatipanText variant="labelLarge" color={selected ? "primary" : "textMuted"}>{label}</KatipanText>
    </Pressable>
  );
}

export function GuestRow({ entry, onPress }: { entry: GuestEntry; onPress: () => void }) {
  const status = guestRsvpStatus(entry.rsvp);
  return (
    <EditorialCard style={styles.guestCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open guest details for ${guestName(entry)}`}
        onPress={onPress}
        style={styles.guestPressable}
      >
        <View style={styles.avatar} accessible={false}>
          <KatipanText variant="title" color="primary">{guestName(entry).slice(0, 1).toUpperCase()}</KatipanText>
        </View>
        <View style={styles.guestCopy}>
          <View style={styles.guestHeading}>
            <KatipanText variant="title" style={styles.guestName}>{guestName(entry)}</KatipanText>
            <GuestStatusChip status={status} />
          </View>
          <KatipanText variant="bodySmall" color="textMuted">{entry.household.display_name}</KatipanText>
          {!!entry.groupNames.length && (
            <KatipanText variant="bodySmall" color="secondary">{entry.groupNames.join(" · ")}</KatipanText>
          )}
        </View>
        <KatipanText variant="headlineSmall" color="outline">›</KatipanText>
      </Pressable>
    </EditorialCard>
  );
}

export function SummaryCount({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "error" | "neutral";
}) {
  const color = tone === "success" ? "primary" : tone === "warning" ? "secondary" : tone === "error" ? "error" : "text";
  return (
    <View style={styles.summaryCount}>
      <KatipanText variant="headlineMedium" color={color}>{String(value)}</KatipanText>
      <KatipanText variant="labelCaps" color="textMuted">{label}</KatipanText>
    </View>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const width = `${Math.max(0, Math.min(100, value))}%` as `${number}%`;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }} style={styles.progressTrack}>
      <View style={[styles.progressFill, { width }]} />
    </View>
  );
}

export function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <KatipanText variant="bodySmall" color="textMuted">{label}</KatipanText>
      <KatipanText variant="bodySmall" style={styles.infoValue}>{value}</KatipanText>
    </View>
  );
}

const styles = StyleSheet.create({
  filterChip: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s.medium,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: c.stoneBorder,
    backgroundColor: c.pearlIvory,
  },
  filterChipSelected: { backgroundColor: c.warmAlabaster, borderColor: c.primaryContainer },
  disabled: { opacity: 0.5 },
  guestCard: { padding: s.medium },
  guestPressable: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: s.small },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: r.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.primaryFixed,
    borderWidth: 1,
    borderColor: c.stoneBorder,
  },
  guestCopy: { flex: 1, gap: s.micro },
  guestHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  guestName: { flex: 1 },
  summaryCount: { flex: 1, gap: s.micro },
  progressTrack: { height: 8, overflow: "hidden", borderRadius: r.pill, backgroundColor: c.softBeige },
  progressFill: { height: "100%", borderRadius: r.pill, backgroundColor: c.primaryContainer },
  infoLine: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s.medium },
  infoValue: { flex: 1, textAlign: "right" },
});
