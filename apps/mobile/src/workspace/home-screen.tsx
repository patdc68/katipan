import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import {
  EditorialCard, EmptyState, ErrorState, KatipanButton, KatipanScreen,
  KatipanText, LoadingState, SectionHeader, StatusChip,
} from "../ui";
import { Brand } from "../onboarding/components";
import { useWorkspace } from "./context";
import { canViewBudgetSummary, loadWeddingDashboard, type WeddingDashboard } from "./home-api";
import { daysUntilWedding, formatWeddingDate, localCalendarDate, weddingDisplayName } from "./presentation";
import { isCurrentWeddingWorkspace, roleLabel, weddingStatusLabel } from "./model";

export default function HomeScreen() {
  const params = useLocalSearchParams<{ weddingId?: string | string[] }>();
  const weddingId = Array.isArray(params.weddingId) ? params.weddingId[0] ?? "" : params.weddingId ?? "";
  const router = useRouter();
  const workspace = useWorkspace();
  const membership = weddingId ? workspace.membershipFor(weddingId) : null;
  const isCurrentWorkspace = isCurrentWeddingWorkspace(membership, workspace.selectedWeddingId, weddingId);
  const [retryCount, setRetryCount] = useState(0);
  const [requestResult, setRequestResult] = useState<{
    requestId: string;
    data: WeddingDashboard | null;
    error: boolean;
  } | null>(null);
  const requestId = `${weddingId}:${membership?.membershipId ?? "none"}:${workspace.cacheRevision}:${retryCount}`;

  useEffect(() => {
    let current = true;
    if (!isCurrentWorkspace || !membership) {
      return () => { current = false; };
    }
    void loadWeddingDashboard(membership)
      .then((data) => { if (current) setRequestResult({ requestId, data, error: false }); })
      .catch(() => { if (current) setRequestResult({ requestId, data: null, error: true }); });
    return () => { current = false; };
  }, [isCurrentWorkspace, membership, requestId]);

  const resultIsCurrent = requestResult?.requestId === requestId;
  const data = resultIsCurrent ? requestResult.data : null;
  const error = resultIsCurrent && requestResult.error;
  const loading = isCurrentWorkspace && !resultIsCurrent;
  const retry = () => setRetryCount((count) => count + 1);

  if (workspace.loading || loading) return <KatipanScreen><LoadingState label="Loading your Wedding…" /></KatipanScreen>;
  if (!isCurrentWorkspace || !membership) {
    return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  }
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load this Wedding dashboard. Your workspace data is still protected." onRetry={retry} /></KatipanScreen>;

  const displayName = weddingDisplayName(data.coupleNames, data.wedding.display_name);
  const date = formatWeddingDate(data.wedding.wedding_date);
  const daysRemaining = daysUntilWedding(data.wedding.wedding_date);
  const completedPercent = data.planning.total > 0 ? Math.round(data.planning.completed / data.planning.total * 100) : 0;
  const canSeeBudget = canViewBudgetSummary(membership.role);

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View style={styles.brandBlock}><Brand compact /><KatipanText variant="labelCaps" color="secondary">WEDDING WORKSPACE</KatipanText></View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account and settings"
          testID="home-account-action"
          onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/more", params: { weddingId } })}
          style={styles.accountAction}
        ><KatipanText variant="title" color="primary">○</KatipanText></Pressable>
      </View>

      <EditorialCard style={styles.hero}>
        <View style={styles.heroTop}>
          <KatipanText variant="labelCaps" color="onPrimary">YOUR CELEBRATION</KatipanText>
          <StatusChip label={roleLabel(membership.role)} tone="success" />
        </View>
        <KatipanText variant="headlineMobile" color="onPrimary" style={styles.heroTitle}>{displayName}</KatipanText>
        {!!data.wedding.display_name && data.wedding.display_name !== displayName && (
          <KatipanText color="onPrimary">{data.wedding.display_name}</KatipanText>
        )}
        <View style={styles.heroMeta}>
          <KatipanText variant="body" color="onPrimary">
            {daysRemaining !== null && daysRemaining >= 0 && data.wedding.status !== "COMPLETED" && data.wedding.status !== "ARCHIVED"
              ? `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} to go`
              : date ?? "Wedding date not set"}
          </KatipanText>
          {date && daysRemaining !== null && daysRemaining >= 0 && <KatipanText variant="bodySmall" color="onPrimary">{date}</KatipanText>}
          {data.wedding.general_location && <KatipanText variant="bodySmall" color="onPrimary">{data.wedding.general_location}</KatipanText>}
        </View>
        {!date && <KatipanButton label="Add your wedding date" variant="secondary" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/plan", params: { weddingId } })} />}
      </EditorialCard>

      <EditorialCard style={styles.progressCard}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleCopy}>
            <KatipanText variant="headlineMedium" accessibilityRole="header">Planning Progress</KatipanText>
            <KatipanText color="textMuted">
              {data.planning.total > 0
                ? `${completedPercent}% planned · ${data.planning.completed} of ${data.planning.total} tasks complete`
                : "Your checklist is ready when you are."}
            </KatipanText>
          </View>
          <StatusChip label={weddingStatusLabel(data.wedding.status)} tone={data.wedding.status === "ACTIVE" ? "success" : "neutral"} />
        </View>
        <View accessibilityRole="progressbar" accessibilityLabel={`${completedPercent}% of planning tasks complete`} style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completedPercent}%` }]} />
        </View>
        <View style={styles.summaryChips}>
          <StatusChip label={`${data.planning.completed} completed`} tone="success" />
          <StatusChip label={`${Math.max(0, data.planning.total - data.planning.completed)} remaining`} tone="neutral" />
          <StatusChip label={`${data.places.length} saved places`} tone="neutral" />
        </View>
      </EditorialCard>

      <View style={styles.section}>
        <SectionHeader
          title="Up Next"
          description="Planning tasks and dates from this Wedding"
          action={<KatipanButton label="View all" variant="text" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/plan", params: { weddingId } })} />}
        />
        {data.upcomingTasks.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState
              title="No upcoming tasks"
              description={data.planning.total === 0 ? "Start with a task to build your planning checklist." : "New tasks will appear here when they have a due date."}
              action={<KatipanButton label="Open Plan" variant="secondary" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/plan", params: { weddingId } })} />}
            />
          </EditorialCard>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.taskList}>
            {data.upcomingTasks.map((task) => <TaskCard key={task.id} task={task} />)}
          </ScrollView>
        )}
      </View>

      <EditorialCard style={styles.contentCard}>
        <SectionHeader
          title="Guestlist & Seating"
          description="Individual guest responses"
          action={<KatipanText variant="headlineSmall" color="primary">♧</KatipanText>}
        />
        <View style={styles.statsRow}>
          <StatTile value={String(data.guests.total)} label="GUESTS" detail="on the list" />
          <StatTile value={String(data.guests.attending)} label="ATTENDING" detail="confirmed" />
          <StatTile value={String(data.guests.pending)} label="PENDING" detail="a response" />
        </View>
        <KatipanButton label={data.guests.total ? "Open Guests" : "Start your guest list"} variant="secondary" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/guests", params: { weddingId } })} />
      </EditorialCard>

      {canSeeBudget ? (
        <EditorialCard style={styles.contentCard}>
          <SectionHeader
            title="Budget at a glance"
            description="Planning estimates and actual costs recorded"
            action={<KatipanText variant="headlineSmall" color="secondary">₱</KatipanText>}
          />
          {data.budget ? <>
            <View style={styles.budgetRow}>
              <BudgetAmount label="ESTIMATED" value={data.budget.estimate} currency={data.budget.currencyCode} />
              <BudgetAmount label="ACTUAL RECORDED" value={data.budget.actual} currency={data.budget.currencyCode} />
            </View>
            {data.budget.itemCount === 0 && <KatipanText variant="bodySmall" color="textMuted">No budget items have been added yet.</KatipanText>}
          </> : <KatipanText color="textMuted">Budget totals are not available right now.</KatipanText>}
          <KatipanButton label="Open Budget" variant="secondary" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/budget", params: { weddingId } })} />
        </EditorialCard>
      ) : (
        <EditorialCard style={styles.restrictedCard}>
          <SectionHeader title="Budget summary" description="Financial details are available to Owners and Full Coordinators." />
        </EditorialCard>
      )}

      <View style={styles.section}>
        <SectionHeader title="Our Places" description={data.wedding.general_location ?? "Wedding locations from the shared workspace"} />
        {data.places.length ? data.places.slice(0, 3).map((place) => (
          <EditorialCard key={place.id} style={styles.placeCard}>
            <View style={styles.placeTitleRow}>
              <KatipanText variant="headlineSmall" style={styles.placeName}>{place.name}</KatipanText>
              {!!place.purposes.length && <StatusChip label={place.purposes.join(" · ")} tone="neutral" />}
            </View>
            {!!place.address && <KatipanText color="textMuted">{place.address}</KatipanText>}
          </EditorialCard>
        )) : data.wedding.general_location ? (
          <EditorialCard style={styles.placeCard}>
            <KatipanText variant="labelCaps" color="secondary">GENERAL LOCATION</KatipanText>
            <KatipanText variant="headlineSmall">{data.wedding.general_location}</KatipanText>
            <KatipanText color="textMuted">Ceremony and reception places can be added separately.</KatipanText>
          </EditorialCard>
        ) : (
          <EditorialCard style={styles.emptyPlaceCard}>
            <EmptyState title="No places added yet" description="Save ceremony, reception, and other Wedding places when you are ready." action={<KatipanButton label="Open Plan" variant="secondary" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/plan", params: { weddingId } })} />} />
          </EditorialCard>
        )}
      </View>

      <View style={styles.footerNote}>
        <KatipanText variant="headlineSmall" color="primary">♡</KatipanText>
        <View style={styles.footerCopy}>
          <KatipanText variant="labelCaps" color="secondary">ONE SHARED WORKSPACE</KatipanText>
          <KatipanText color="textMuted">Your wedding details, people, and plans stay connected to this Wedding.</KatipanText>
        </View>
      </View>
      <View style={styles.bottomSpace} />
    </KatipanScreen>
  );
}

function TaskCard({ task }: { task: WeddingDashboard["upcomingTasks"][number] }) {
  const date = formatWeddingDate(task.dueDate);
  const today = localCalendarDate();
  const overdue = Boolean(task.dueDate && task.dueDate < today);
  return (
    <EditorialCard style={styles.taskCard}>
      <StatusChip label={overdue ? "Overdue" : date ? `Due ${date}` : "No due date"} tone={overdue ? "warning" : "success"} />
      <KatipanText variant="title">{task.title}</KatipanText>
      <KatipanText color="textMuted">{task.status === "IN_PROGRESS" ? "In progress" : "To do"} · {task.priority.toLowerCase()} priority</KatipanText>
    </EditorialCard>
  );
}

function StatTile({ value, label, detail }: { value: string; label: string; detail: string }) {
  return <View style={styles.statTile}>
    <KatipanText variant="headlineMedium" color="primary">{value}</KatipanText>
    <KatipanText variant="labelCaps" color="textMuted">{label}</KatipanText>
    <KatipanText variant="bodySmall" color="textMuted">{detail}</KatipanText>
  </View>;
}

function BudgetAmount({ label, value, currency }: { label: string; value: number; currency: string }) {
  let formatted = String(value);
  try { formatted = new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value); } catch { /* ISO currency is validated by the Wedding contract. */ }
  return <View style={styles.budgetAmount}>
    <KatipanText variant="headlineSmall" color="primary">{formatted}</KatipanText>
    <KatipanText variant="labelCaps" color="textMuted">{label}</KatipanText>
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandBlock: { flexDirection: "row", alignItems: "center", gap: s.medium },
  accountAction: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: r.pill, backgroundColor: c.surfaceLow, borderWidth: 1, borderColor: c.stoneBorder },
  hero: { minHeight: 260, justifyContent: "flex-end", gap: s.medium, backgroundColor: c.primary, borderColor: c.champagne, padding: s.cardLarge },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  heroTitle: { color: c.onPrimary, fontSize: 32, lineHeight: 40 },
  heroMeta: { gap: s.micro },
  progressCard: { gap: s.medium, padding: s.cardLarge },
  sectionTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: s.medium },
  sectionTitleCopy: { flex: 1, gap: s.small },
  progressTrack: { width: "100%", height: 10, overflow: "hidden", borderRadius: r.pill, backgroundColor: c.surfaceHighest },
  progressFill: { height: "100%", borderRadius: r.pill, backgroundColor: c.primaryContainer },
  summaryChips: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  section: { gap: s.medium },
  taskList: { gap: s.medium, paddingRight: s.medium },
  taskCard: { width: 282, minHeight: 188, justifyContent: "space-between", gap: s.medium, backgroundColor: c.surfaceLowest },
  emptyCard: { padding: 0 },
  contentCard: { gap: s.large, padding: s.cardLarge, backgroundColor: c.surfaceLowest },
  statsRow: { flexDirection: "row", gap: s.small },
  statTile: { flex: 1, minWidth: 0, minHeight: 128, alignItems: "flex-start", justifyContent: "center", gap: s.small, backgroundColor: c.surfaceLow, borderRadius: r.large, padding: s.medium },
  budgetRow: { flexDirection: "row", gap: s.medium },
  budgetAmount: { flex: 1, gap: s.small },
  restrictedCard: { backgroundColor: c.surfaceLow },
  placeCard: { gap: s.small, backgroundColor: c.surfaceLowest },
  placeTitleRow: { gap: s.small, alignItems: "flex-start" },
  placeName: { flexShrink: 1 },
  emptyPlaceCard: { padding: 0 },
  footerNote: { flexDirection: "row", alignItems: "flex-start", gap: s.medium, backgroundColor: c.surfaceLow, borderRadius: r.extraLarge, padding: s.cardLarge },
  footerCopy: { flex: 1, gap: s.small },
  bottomSpace: { height: s.large },
});
