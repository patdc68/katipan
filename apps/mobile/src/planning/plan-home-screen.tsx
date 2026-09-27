import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
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
import { localCalendarDate, weddingDisplayName } from "../workspace/presentation";
import {
  canManagePlanning,
  derivePlanningSummary,
  safePlanningError,
  SingleSubmitGate,
} from "./model";
import { changePlanningTaskStatus } from "./api";
import { PlanningTaskRow } from "./components";
import { usePlanningWorkspace } from "./use-planning-workspace";

export default function PlanHomeScreen() {
  const { weddingId, membership, isCurrent, loading, error, data, retry } = usePlanningWorkspace();
  const router = useRouter();
  const today = localCalendarDate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const gate = useRef(new SingleSubmitGate());

  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading Wedding planning…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load planning for this Wedding." onRetry={retry} /></KatipanScreen>;

  const summary = derivePlanningSummary(data.tasks, data.categories, today);
  const canEdit = canManagePlanning(membership);
  const categoryNames = new Map(data.categories.map((category) => [category.id, category.name]));
  const membersById = new Map(data.members.map((member) => [member.id, member]));
  const assigneeNames = (taskId: string) => data.assignees
    .filter((assignment) => assignment.taskId === taskId)
    .map((assignment) => membersById.get(assignment.membershipId)?.displayName)
    .filter((name): name is string => Boolean(name));
  const weddingName = weddingDisplayName(membership.partnerNames, membership.wedding.display_name);
  const openChecklist = (params: { status?: string; categoryId?: string; due?: string } = {}) => router.navigate({
    pathname: "/(wedding)/[weddingId]/plan/checklist",
    params: { weddingId, ...params },
  });
  const openTask = (taskId: string) => router.navigate({
    pathname: "/(wedding)/[weddingId]/plan/tasks/[taskId]",
    params: { weddingId, taskId },
  });
  const quickComplete = async (taskId: string) => {
    await gate.current.run(async () => {
      if (saving) return;
      setSaving(true);
      setActionError(null);
      try {
        await changePlanningTaskStatus(membership, taskId, "COMPLETED");
        retry();
      } catch (cause) {
        setActionError(safePlanningError(cause));
      } finally {
        setSaving(false);
      }
    });
  };

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.brandRow}>
        <View style={styles.brandCopy}><Brand compact /><KatipanText variant="labelCaps" color="secondary">WEDDING PLANNING</KatipanText></View>
        <StatusChip label={membership.role.replaceAll("_", " ")} tone="success" />
      </View>
      <View style={styles.titleBlock}>
        <KatipanText variant="headlineLarge">Planning Hub</KatipanText>
        <KatipanText color="textMuted">{weddingName}</KatipanText>
      </View>

      <EditorialCard style={styles.progressCard}>
        <View style={styles.progressHeading}>
          <View style={styles.progressCopy}>
            <KatipanText variant="labelCaps" color="secondary">YOUR CHECKLIST</KatipanText>
            <KatipanText variant="headlineMedium">{summary.progressPercent}% complete</KatipanText>
            <KatipanText color="textMuted">{summary.completed} of {summary.total} active tasks complete</KatipanText>
          </View>
          <KatipanText variant="headlineLarge" color="primary">{summary.completed}</KatipanText>
        </View>
        <View accessibilityRole="progressbar" accessibilityLabel={summary.progressPercent + "% of planning tasks complete"} style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: (summary.progressPercent + "%") as `${number}%` }]} />
        </View>
        <View style={styles.summaryRow}>
          <SummaryCount label="OVERDUE" value={String(summary.overdue.length)} tone={summary.overdue.length ? "error" : "neutral"} />
          <SummaryCount label="UP NEXT" value={String(summary.upcoming.length)} tone="neutral" />
          <SummaryCount label="COMPLETED" value={String(summary.completed)} tone="success" />
        </View>
        <KatipanButton label="Open Wedding Checklist" variant="secondary" onPress={() => openChecklist()} />
      </EditorialCard>

      <View style={styles.section}>
        <SectionHeader
          title="Categories"
          description="Task categories saved for this Wedding"
          action={<KatipanButton label="Checklist" variant="text" onPress={() => openChecklist()} />}
        />
        {data.categories.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState title="No task categories yet" description="Tasks can stay uncategorized until a category is set up." />
          </EditorialCard>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
            {data.categories.map((category) => {
              const categorySummary = summary.categories.find((item) => item.id === category.id);
              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  accessibilityLabel={"Show " + category.name + " tasks"}
                  onPress={() => openChecklist({ categoryId: category.id })}
                  style={styles.categoryCard}
                >
                  <KatipanText variant="headlineSmall">{category.name}</KatipanText>
                  <KatipanText variant="bodySmall" color="textMuted">
                    {(categorySummary?.completed ?? 0) + " of " + (categorySummary?.total ?? 0) + " complete"}
                  </KatipanText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Overdue"
          description="Tasks past their due date"
          action={summary.overdue.length ? <KatipanButton label="View overdue" variant="text" onPress={() => openChecklist({ due: "OVERDUE" })} /> : undefined}
        />
        {summary.overdue.length === 0 ? (
          <EditorialCard style={styles.compactCard}><KatipanText color="textMuted">No overdue planning tasks.</KatipanText></EditorialCard>
        ) : summary.overdue.slice(0, 3).map((task) => (
          <PlanningTaskRow
            key={task.id}
            task={task}
            categoryName={task.category_id ? categoryNames.get(task.category_id) : undefined}
            assigneeNames={assigneeNames(task.id)}
            today={today}
            onPress={() => openTask(task.id)}
            quickComplete={canEdit && !saving ? () => void quickComplete(task.id) : undefined}
          />
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Coming up"
          description="Upcoming tasks from this Wedding"
          action={summary.upcoming.length ? <KatipanButton label="View checklist" variant="text" onPress={() => openChecklist({ due: "UPCOMING" })} /> : undefined}
        />
        {summary.upcoming.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState
              title="Nothing scheduled next"
              description="Tasks with a future due date will appear here."
              action={canEdit ? <KatipanButton label="Create a task" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/plan/tasks/new", params: { weddingId } })} /> : undefined}
            />
          </EditorialCard>
        ) : summary.upcoming.slice(0, 4).map((task) => (
          <PlanningTaskRow
            key={task.id}
            task={task}
            categoryName={task.category_id ? categoryNames.get(task.category_id) : undefined}
            assigneeNames={assigneeNames(task.id)}
            today={today}
            onPress={() => openTask(task.id)}
            quickComplete={canEdit && !saving ? () => void quickComplete(task.id) : undefined}
          />
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Completed"
          description="Recently completed tasks"
          action={summary.completed ? <KatipanButton label="View completed" variant="text" onPress={() => openChecklist({ status: "COMPLETED" })} /> : undefined}
        />
        {summary.completedTasks.length === 0 ? (
          <EditorialCard style={styles.compactCard}><KatipanText color="textMuted">Completed tasks will appear here.</KatipanText></EditorialCard>
        ) : summary.completedTasks.slice(0, 3).map((task) => (
          <PlanningTaskRow
            key={task.id}
            task={task}
            categoryName={task.category_id ? categoryNames.get(task.category_id) : undefined}
            assigneeNames={assigneeNames(task.id)}
            today={today}
            onPress={() => openTask(task.id)}
          />
        ))}
      </View>

      {!!actionError && <KatipanText accessibilityRole="alert" color="error">{actionError}</KatipanText>}
      {canEdit && <KatipanButton label="Create task" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/plan/tasks/new", params: { weddingId } })} />}
      <View style={styles.bottomSpace} />
    </KatipanScreen>
  );
}

function SummaryCount({ label, value, tone }: { label: string; value: string; tone: "success" | "error" | "neutral" }) {
  return (
    <View style={styles.count}>
      <KatipanText variant="headlineSmall" color={tone === "error" ? "error" : tone === "success" ? "primary" : "text"}>{value}</KatipanText>
      <KatipanText variant="labelCaps" color="textMuted">{label}</KatipanText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  brandRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  brandCopy: { flexDirection: "row", alignItems: "center", gap: s.medium },
  titleBlock: { gap: s.small },
  progressCard: { gap: s.large, padding: s.cardLarge, backgroundColor: c.surfaceLow },
  progressHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s.medium },
  progressCopy: { flex: 1, gap: s.small },
  progressTrack: { height: 8, overflow: "hidden", borderRadius: r.pill, backgroundColor: c.softBeige },
  progressFill: { height: "100%", borderRadius: r.pill, backgroundColor: c.primaryContainer },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: s.small },
  count: { flex: 1, gap: s.micro },
  section: { gap: s.medium },
  categoryList: { gap: s.medium, paddingRight: s.medium },
  categoryCard: { width: 184, minHeight: 100, justifyContent: "space-between", gap: s.small, padding: s.medium, borderRadius: r.large, borderWidth: 1, borderColor: c.stoneBorder, backgroundColor: c.cardIvory },
  emptyCard: { padding: 0 },
  compactCard: { padding: s.medium },
  bottomSpace: { height: s.large },
});
