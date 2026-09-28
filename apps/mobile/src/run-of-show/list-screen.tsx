import { useCallback, useState } from "react";
import { useFocusEffect, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";
import { colorTokens as c, spacingTokens as s } from "@katipan/ui";
import { EditorialCard, EmptyState, ErrorState, KatipanButton, KatipanScreen, KatipanText, LoadingState, SectionHeader, StatusChip } from "../ui";
import { FilterPill, formatTime, useWeddingDayRoute, WeddingDayHeader } from "../wedding-day/components";
import { loadRun } from "./api";
import { canManageRun, runStatusLabel, type RunData, type RunItem } from "./model";

type Filter = "ALL" | "IN_PROGRESS" | "DELAYED" | "UPCOMING";
export default function RunOfShowScreen() {
  const { weddingId, membership, isCurrent, workspace, router } = useWeddingDayRoute();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [load, setLoad] = useState<{ key: string; data: RunData | null; error: boolean } | null>(null);
  const [revision, setRevision] = useState(0);
  const key = `${weddingId}:${membership?.membershipId ?? "none"}:${workspace.cacheRevision}:${revision}`;
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (isCurrent && membership) void loadRun(membership)
      .then(data => { if (alive) setLoad({ key, data, error: false }); })
      .catch(() => { if (alive) setLoad({ key, data: null, error: true }); });
    return () => { alive = false; };
  }, [isCurrent, membership, key]));
  if (workspace.loading || (isCurrent && membership && load?.key !== key)) return <KatipanScreen><LoadingState label="Loading Run of Show…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (load?.error || !load?.data) return <KatipanScreen><ErrorState title="Run of Show unavailable" onRetry={() => setRevision(n => n + 1)} /></KatipanScreen>;
  const data = load.data;
  const shown = data.items.filter(item => filter === "ALL" || item.status === filter);
  const canEdit = canManageRun(membership);
  const current = data.items.find(item => item.status === "IN_PROGRESS");
  const next = data.items.find(item => item.status === "UPCOMING");
  const openItem = (itemId: string) => router.push({ pathname: "/(wedding)/[weddingId]/plan/run-of-show/[itemId]", params: { weddingId, itemId } } as unknown as Href);
  return <KatipanScreen contentContainerStyle={styles.page}>
    <KatipanButton label="Back to Wedding Day" variant="text" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/day", params: { weddingId } } as unknown as Href)} />
    <WeddingDayHeader membership={membership} title="Run of Show" description="Master operational timeline for the Wedding team." />
    <View style={styles.filters}>
      {(["ALL", "IN_PROGRESS", "DELAYED", "UPCOMING"] as const).map(value => <FilterPill key={value} label={value === "ALL" ? `All ${data.items.length}` : runStatusLabel(value)} selected={filter === value} onPress={() => setFilter(value)} />)}
    </View>
    {data.items.some(item => item.status === "DELAYED") && <EditorialCard style={styles.alert}>
      <KatipanText variant="labelCaps" color="secondary">SCHEDULE ATTENTION</KatipanText>
      <KatipanText variant="title">Delayed items need individual review</KatipanText>
      <KatipanText color="textMuted">Later operational items and the Guest Program keep their own times until someone changes them explicitly.</KatipanText>
    </EditorialCard>}
    {!!data.items.length && <EditorialCard style={styles.summary}>
      <View style={styles.summaryStat}><KatipanText variant="labelCaps" color="textMuted">CURRENT STATUS</KatipanText><KatipanText variant="title" color="primary">{current ? current.title : next ? "Next: " + next.title : "No active item"}</KatipanText></View>
      <View style={styles.summaryStat}><KatipanText variant="labelCaps" color="textMuted">NEEDS ATTENTION</KatipanText><KatipanText variant="title" color="secondary">{data.items.filter(item => item.status === "DELAYED").length} delayed</KatipanText></View>
    </EditorialCard>}
    <SectionHeader title="Timeline" description="Scheduled order · actual timing appears when recorded" action={canEdit ? <KatipanButton label="Add Item" variant="secondary" onPress={() => router.push({ pathname: "/(wedding)/[weddingId]/plan/run-of-show/new", params: { weddingId } } as unknown as Href)} /> : undefined} />
    {shown.length === 0 ? <EditorialCard><EmptyState title={data.items.length ? "No items in this filter" : "No Run of Show items yet"}
      description={data.items.length ? "Choose another status to see the timeline." : "Add the first operational cue for this Wedding."}
      action={canEdit && !data.items.length ? <KatipanButton label="Add Item" onPress={() => router.push({ pathname: "/(wedding)/[weddingId]/plan/run-of-show/new", params: { weddingId } } as unknown as Href)} /> : undefined} /></EditorialCard>
      : shown.map(item => <TimelineItem key={item.id} item={item} data={data} onOpen={() => openItem(item.id)} />)}
  </KatipanScreen>;
}
function TimelineItem({ item, data, onOpen }: { item: RunItem; data: RunData; onOpen: () => void }) {
  const place = data.places.find(p => p.id === item.place_id)?.name;
  const people = data.assignments.filter(a => a.itemId === item.id).map(a => data.members.find(m => m.id === a.membershipId)?.name).filter((name): name is string => Boolean(name));
  const links = data.guestLinks.filter(link => link.operational_item_id === item.id);
  return <View style={styles.timelineRow}><View style={styles.rail}><View style={[styles.dot, item.status === "IN_PROGRESS" && styles.currentDot, item.status === "DELAYED" && styles.delayedDot]} /><View style={styles.line} /></View><EditorialCard style={[styles.item, item.status === "IN_PROGRESS" && styles.current, item.status === "DELAYED" && styles.delayed]}>
    <View style={styles.top}><KatipanText variant="labelCaps" color="secondary">{formatTime(item.scheduled_start)}{item.scheduled_end ? ` – ${formatTime(item.scheduled_end)}` : ""}</KatipanText>
      <StatusChip label={runStatusLabel(item.status)} tone={item.status === "DELAYED" ? "warning" : item.status === "IN_PROGRESS" ? "success" : "neutral"} /></View>
    <KatipanText variant="headlineSmall" accessibilityRole="header">{item.title}</KatipanText>
    {!!place && <KatipanText color="textMuted">{place}</KatipanText>}
    {!!item.description?.trim() && <KatipanText variant="bodySmall" color="textMuted">{item.description}</KatipanText>}
    {item.actual_start && <KatipanText variant="bodySmall" color="textMuted">Actual {formatTime(item.actual_start)}{item.actual_end ? ` – ${formatTime(item.actual_end)}` : ""}</KatipanText>}
    {!!people.length && <KatipanText variant="bodySmall" color="textMuted">Responsible: {people.join(", ")}</KatipanText>}
    <KatipanText variant="bodySmall" color="secondary">{links.some(link => link.review_required) ? "Guest schedule review required" : links.length ? "Linked Guest Program item" : "Operational only"}</KatipanText>
    <KatipanButton label="View Item" variant="text" onPress={onOpen} />
  </EditorialCard></View>;
}
const styles = StyleSheet.create({
  page: { gap: s.large, paddingBottom: s.extraLarge },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  alert: { gap: s.small, backgroundColor: c.softBeige, borderColor: c.champagne },
  summary: { flexDirection: "row", gap: s.small, backgroundColor: c.surfaceLow },
  summaryStat: { flex: 1, gap: s.micro },
  timelineRow: { flexDirection: "row", alignItems: "stretch", gap: s.small },
  rail: { width: 20, alignItems: "center" },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: c.stoneBorder, marginTop: s.large },
  currentDot: { backgroundColor: c.primary }, delayedDot: { backgroundColor: c.champagne },
  line: { width: 2, flex: 1, backgroundColor: c.stoneBorder },
  item: { flex: 1, gap: s.small, backgroundColor: c.surfaceLowest },
  current: { borderColor: c.primaryContainer, borderWidth: 2 },
  delayed: { borderColor: c.champagne, borderWidth: 2 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: s.small },
});
