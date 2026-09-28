import { StyleSheet, View } from "react-native";
import { colorTokens as c, spacingTokens as s } from "@katipan/ui";
import { EditorialCard, KatipanButton, KatipanText, SectionHeader, StatusChip } from "../ui";
import { formatTime } from "../wedding-day/components";
import type { ProgramData, ProgramItem } from "./model";

export function ProgramHeader({ title, description }: { title: string; description: string }) {
  return <View style={styles.header}><KatipanText variant="labelCaps" color="secondary">WEDDING WEBSITE</KatipanText>
    <KatipanText variant="headlineLarge" accessibilityRole="header">{title}</KatipanText>
    <KatipanText color="textMuted">{description}</KatipanText></View>;
}
export function ProgramCard({ item, data, onOpen }: { item: ProgramItem; data: ProgramData; onOpen?: () => void }) {
  const operation = data.operations.find(row => row.id === item.operational_item_id);
  const place = data.places.find(row => row.id === item.place_id);
  return <EditorialCard style={[styles.card, item.review_required && styles.review]}>
    <View style={styles.row}><KatipanText variant="labelCaps" color="secondary">{formatTime(item.scheduled_start)}{item.scheduled_end ? ` – ${formatTime(item.scheduled_end)}` : ""}</KatipanText>
      <StatusChip label={item.is_published ? "Published" : "Draft"} tone={item.is_published ? "success" : "neutral"} /></View>
    <KatipanText variant="headlineSmall" accessibilityRole="header">{item.title}</KatipanText>
    {!!item.description && <KatipanText color="textMuted">{item.description}</KatipanText>}
    {!!place && <KatipanText color="textMuted">{place.name}</KatipanText>}
    <KatipanText variant="bodySmall" color="textMuted">Order {item.sort_order} · {operation ? `Linked to ${operation.title}` : "Standalone guest item"}</KatipanText>
    {item.review_required && <StatusChip label="Review Required" tone="warning" />}
    {onOpen && <KatipanButton label="Open Guest Program Item" variant="text" onPress={onOpen} />}
  </EditorialCard>;
}
export function ProgramSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <EditorialCard style={styles.card}><SectionHeader title={title} description={description} />{children}</EditorialCard>;
}
export const programStyles = StyleSheet.create({
  page: { gap: s.large, paddingBottom: s.extraLarge },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  notice: { gap: s.small, backgroundColor: c.softBeige, borderColor: c.champagne },
});
const styles = StyleSheet.create({
  header: { gap: s.small }, card: { gap: s.medium, backgroundColor: c.surfaceLowest },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  review: { borderColor: c.champagne, borderWidth: 2 },
});
