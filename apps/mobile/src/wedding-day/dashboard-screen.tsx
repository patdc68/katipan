import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, type Href } from "expo-router";
import { colorTokens as c, spacingTokens as s } from "@katipan/ui";
import { EditorialCard, EmptyState, ErrorState, KatipanButton, KatipanScreen, KatipanText, LoadingState, SectionHeader } from "../ui";
import { WeddingDayItemCard, WeddingDayHeader, useWeddingDayRoute } from "./components";
import { loadWeddingDayDashboard } from "./api";
import type { WeddingDayDashboard } from "./model";

type DashboardLoad = { requestId: string; data: WeddingDayDashboard | null; failed: boolean };

export function WeddingDayDashboardScreen() {
  const { weddingId, router, workspace, membership, isCurrent } = useWeddingDayRoute();
  const [retryCount, setRetryCount] = useState(0);
  const [load, setLoad] = useState<DashboardLoad | null>(null);
  const requestId = `${weddingId}:${membership?.membershipId ?? "none"}:${workspace.cacheRevision}:${retryCount}`;

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!isCurrent || !membership) return () => { active = false; };
    void loadWeddingDayDashboard(membership)
      .then((data) => { if (active) setLoad({ requestId, data, failed: false }); })
      .catch(() => { if (active) setLoad({ requestId, data: null, failed: true }); });
    return () => { active = false; };
  }, [isCurrent, membership, requestId]));

  const currentLoad = load?.requestId === requestId ? load : null;
  if (workspace.loading || (isCurrent && membership && !currentLoad)) {
    return <KatipanScreen><LoadingState label="Loading Wedding-Day operations…" /></KatipanScreen>;
  }
  if (!isCurrent || !membership) {
    return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  }
  if (currentLoad?.failed || !currentLoad?.data) {
    return <KatipanScreen><ErrorState title="Wedding-Day dashboard unavailable" description="We couldn't load this Wedding's current check-in and timeline data." onRetry={() => setRetryCount((value) => value + 1)} /></KatipanScreen>;
  }

  const dashboard = currentLoad.data;
  const hasTimelineItems = Boolean(dashboard.currentItem || dashboard.nextItem || dashboard.delayedItems.length);
  const goToCheckIn = () => router.push({ pathname: "/(wedding)/[weddingId]/day/check-in", params: { weddingId } } as unknown as Href);
  const goToScanner = () => router.push({ pathname: "/(wedding)/[weddingId]/day/scan", params: { weddingId } } as unknown as Href);
  const goToRun = () => router.push({ pathname: "/(wedding)/[weddingId]/plan/run-of-show", params: { weddingId } } as unknown as Href);

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <WeddingDayHeader membership={membership} description="Guest arrivals and the operational timeline for this Wedding." />

      <EditorialCard style={styles.arrivalCard}>
        <KatipanText variant="labelCaps" color="onPrimary">GUEST ARRIVAL & CHECK-IN</KatipanText>
        <KatipanText variant="headlineMedium" color="onPrimary">Guest Check-In</KatipanText>
        <View style={styles.statsRow}>
          <ArrivalStat value={dashboard.totalAttending} label="ATTENDING" />
          <ArrivalStat value={dashboard.checkedIn} label="CHECKED IN" />
          <ArrivalStat value={dashboard.remaining} label="REMAINING" />
        </View>
        <View style={styles.arrivalActions}>
          <KatipanButton label="Scan Guest Pass" onPress={goToScanner} style={styles.primaryAction} />
          <KatipanButton label="Manual Check-In" variant="secondary" onPress={goToCheckIn} style={styles.secondaryAction} />
        </View>
      </EditorialCard>

      <View style={styles.section}>
        <SectionHeader
          title="Run of Show"
          description="Operational Wedding-Day items"
          action={<KatipanButton label="Open Run of Show" variant="text" onPress={goToRun} />}
        />
        {!hasTimelineItems ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState title="No Run of Show items yet" description="The operational timeline is empty for this Wedding." action={<KatipanButton label="Open Run of Show" variant="secondary" onPress={goToRun} />} />
          </EditorialCard>
        ) : (
          <>
            {dashboard.currentItem
              ? <WeddingDayItemCard item={dashboard.currentItem} label="CURRENT ITEM" />
              : <EditorialCard style={styles.timelineNote}><KatipanText color="textMuted">No item is currently in progress.</KatipanText></EditorialCard>}
            {dashboard.nextItem
              ? <WeddingDayItemCard item={dashboard.nextItem} label="NEXT ITEM" />
              : <EditorialCard style={styles.timelineNote}><KatipanText color="textMuted">There is no upcoming item.</KatipanText></EditorialCard>}
          </>
        )}
      </View>

      {!!dashboard.delayedItems.length && (
        <View style={styles.section}>
          <SectionHeader title="Delayed Items" description="These times need coordinator review; later items are not moved automatically." />
          {dashboard.delayedItems.map((item) => <WeddingDayItemCard key={item.id} item={item} label="DELAYED" />)}
        </View>
      )}
      <KatipanButton label="View Full Run of Show" variant="secondary" onPress={goToRun} />

      <EditorialCard style={styles.browseCard}>
        <SectionHeader title="Guest Check-In" description="Browse individual RSVP and current check-in states." />
        <KatipanButton label="Browse Guest Check-In" variant="secondary" onPress={goToCheckIn} />
      </EditorialCard>
      <View style={styles.bottomSpace} />
    </KatipanScreen>
  );
}

function ArrivalStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <KatipanText variant="headlineMedium" color="onPrimary">{value}</KatipanText>
      <KatipanText variant="labelCaps" color="onPrimary">{label}</KatipanText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  arrivalCard: { gap: s.large, backgroundColor: c.primary, borderColor: c.champagne, padding: s.cardLarge },
  statsRow: { flexDirection: "row", gap: s.small },
  stat: { flex: 1, minWidth: 0, gap: s.micro, padding: s.medium, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.10)" },
  arrivalActions: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  primaryAction: { flexGrow: 1, backgroundColor: c.primaryContainer },
  secondaryAction: { flexGrow: 1 },
  section: { gap: s.medium },
  emptyCard: { padding: 0, backgroundColor: c.surfaceLowest },
  timelineNote: { padding: s.medium, backgroundColor: c.surfaceLow },
  browseCard: { gap: s.medium, backgroundColor: c.surfaceLowest },
  bottomSpace: { height: s.large },
});
