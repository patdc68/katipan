import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colorTokens as c, spacingTokens as s } from "@katipan/ui";
import {
  EditorialCard,
  EmptyState,
  ErrorState,
  KatipanButton,
  KatipanScreen,
  KatipanText,
  LoadingState,
  SectionHeader,
} from "../ui";
import { localCalendarDate, weddingDisplayName } from "../workspace/presentation";
import {
  canManagePlanning,
  defaultPlanningTaskFilters,
  filterPlanningTasks,
  groupTasksByCategory,
  planningTaskPriorities,
  planningTaskStatuses,
  safePlanningError,
  SingleSubmitGate,
  taskPriorityLabel,
  taskStatusLabel,
  type PlanningTaskFilters,
  type PlanningTaskPriority,
  type PlanningTaskStatus,
} from "./model";
import { changePlanningTaskStatus } from "./api";
import { ChoiceChips, FilterChip, PlanningTaskRow } from "./components";
import { usePlanningWorkspace } from "./use-planning-workspace";

type DueFilter = PlanningTaskFilters["due"];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function validStatus(value: string | undefined): PlanningTaskStatus | "ALL" {
  return value && planningTaskStatuses.includes(value as PlanningTaskStatus)
    ? value as PlanningTaskStatus
    : "ALL";
}

function validPriority(value: string | undefined): PlanningTaskPriority | "ALL" {
  return value && planningTaskPriorities.includes(value as PlanningTaskPriority)
    ? value as PlanningTaskPriority
    : "ALL";
}

function validDue(value: string | undefined): DueFilter {
  return value === "OVERDUE" || value === "UPCOMING" || value === "NO_DATE" ? value : "ALL";
}

export default function ChecklistScreen() {
  const routeParams = useLocalSearchParams<{
    status?: string | string[];
    categoryId?: string | string[];
    due?: string | string[];
    priority?: string | string[];
  }>();
  const routeKey = [
    firstParam(routeParams.status) ?? "",
    firstParam(routeParams.categoryId) ?? "",
    firstParam(routeParams.due) ?? "",
    firstParam(routeParams.priority) ?? "",
  ].join(":");
  return <ChecklistContent key={routeKey} routeParams={routeParams} />;
}

function ChecklistContent({ routeParams }: {
  routeParams: {
    status?: string | string[];
    categoryId?: string | string[];
    due?: string | string[];
    priority?: string | string[];
  };
}) {
  const { weddingId, membership, isCurrent, loading, error, data, retry } = usePlanningWorkspace();
  const router = useRouter();
  const [filters, setFilters] = useState<PlanningTaskFilters>({
    ...defaultPlanningTaskFilters,
    status: validStatus(firstParam(routeParams.status)),
    categoryId: firstParam(routeParams.categoryId) ?? null,
    due: validDue(firstParam(routeParams.due)),
    priority: validPriority(firstParam(routeParams.priority)),
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const gate = useRef(new SingleSubmitGate());
  const today = localCalendarDate();

  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading the Wedding checklist…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load the Wedding checklist." onRetry={retry} /></KatipanScreen>;

  const canEdit = canManagePlanning(membership);
  const filteredTasks = filterPlanningTasks(data.tasks, filters, today);
  const groups = groupTasksByCategory(filteredTasks, data.categories);
  const categoryNames = new Map(data.categories.map((category) => [category.id, category.name]));
  const membersById = new Map(data.members.map((member) => [member.id, member]));
  const assigneeNames = (taskId: string) => data.assignees
    .filter((assignment) => assignment.taskId === taskId)
    .map((assignment) => membersById.get(assignment.membershipId)?.displayName)
    .filter((name): name is string => Boolean(name));
  const openTask = (taskId: string) => router.navigate({
    pathname: "/(wedding)/[weddingId]/plan/tasks/[taskId]",
    params: { weddingId, taskId },
  });
  const changeStatus = async (taskId: string) => {
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
  const weddingName = weddingDisplayName(membership.partnerNames, membership.wedding.display_name);
  const statusValues = ["ALL", ...planningTaskStatuses] as const;
  const priorityValues = ["ALL", ...planningTaskPriorities] as const;
  const dueValues: readonly DueFilter[] = ["ALL", "OVERDUE", "UPCOMING", "NO_DATE"];

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="Back to Plan Home" variant="text" onPress={() => router.back()} style={styles.backButton} />
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">WEDDING PLANNING</KatipanText>
        <KatipanText variant="headlineLarge">Wedding Checklist</KatipanText>
        <KatipanText color="textMuted">{weddingName}</KatipanText>
      </View>

      <EditorialCard style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCopy}>
            <KatipanText variant="headlineMedium">{filteredTasks.length} tasks</KatipanText>
            <KatipanText color="textMuted">Filtered from this Wedding checklist</KatipanText>
          </View>
          {canEdit && <KatipanButton label="Add task" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/plan/tasks/new", params: { weddingId } })} />}
        </View>
      </EditorialCard>

      <View style={styles.filterSection}>
        <SectionHeader title="Status" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
          {statusValues.map((status) => (
            <FilterChip
              key={status}
              label={status === "ALL" ? "All statuses" : taskStatusLabel(status)}
              selected={filters.status === status}
              onPress={() => setFilters((previous) => ({ ...previous, status }))}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.filterSection}>
        <SectionHeader title="Category" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
          <FilterChip label="All categories" selected={filters.categoryId === null} onPress={() => setFilters((previous) => ({ ...previous, categoryId: null }))} />
          {data.categories.map((category) => (
            <FilterChip
              key={category.id}
              label={category.name}
              selected={filters.categoryId === category.id}
              onPress={() => setFilters((previous) => ({ ...previous, categoryId: category.id }))}
            />
          ))}
          {data.tasks.some((task) => task.category_id === null) && (
            <FilterChip label="Uncategorized" selected={filters.categoryId === "uncategorized"} onPress={() => setFilters((previous) => ({ ...previous, categoryId: "uncategorized" }))} />
          )}
        </ScrollView>
      </View>

      <View style={styles.filterSection}>
        <SectionHeader title="Priority" />
        <ChoiceChips
          values={priorityValues}
          selected={filters.priority}
          labelFor={(priority) => priority === "ALL" ? "All priorities" : taskPriorityLabel(priority)}
          onSelect={(priority) => setFilters((previous) => ({ ...previous, priority }))}
        />
      </View>

      <View style={styles.filterSection}>
        <SectionHeader title="Due date" />
        <ChoiceChips
          values={dueValues}
          selected={filters.due}
          labelFor={(due) => due === "ALL" ? "All dates" : due === "OVERDUE" ? "Overdue" : due === "UPCOMING" ? "Upcoming" : "No due date"}
          onSelect={(due) => setFilters((previous) => ({ ...previous, due }))}
        />
      </View>

      {!!actionError && <KatipanText accessibilityRole="alert" color="error">{actionError}</KatipanText>}
      {groups.length === 0 ? (
        <EditorialCard style={styles.emptyCard}>
          <EmptyState
            title={data.tasks.length === 0 ? "Your checklist is ready" : "No tasks match these filters"}
              description={data.tasks.length === 0 ? "Add a task to begin planning this Wedding." : "Try another status, category, priority, or due date."}
            action={canEdit && data.tasks.length === 0
              ? <KatipanButton label="Create first task" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/plan/tasks/new", params: { weddingId } })} />
              : undefined}
          />
        </EditorialCard>
      ) : groups.map((group) => (
        <View key={group.id ?? "uncategorized"} style={styles.group}>
          <SectionHeader title={group.name} description={group.tasks.length + (group.tasks.length === 1 ? " task" : " tasks")} />
          {group.tasks.map((task) => (
            <PlanningTaskRow
              key={task.id}
              task={task}
              categoryName={task.category_id ? categoryNames.get(task.category_id) : undefined}
              assigneeNames={assigneeNames(task.id)}
              today={today}
              onPress={() => openTask(task.id)}
              quickComplete={canEdit && !saving ? () => void changeStatus(task.id) : undefined}
            />
          ))}
        </View>
      ))}
      <View style={styles.footer}>
        <KatipanText variant="bodySmall" color="textMuted">Task status and completion records are saved by the Wedding workspace.</KatipanText>
        <KatipanButton label="Reset filters" variant="secondary" onPress={() => setFilters(defaultPlanningTaskFilters)} />
      </View>
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.large, paddingBottom: s.extraLarge },
  backButton: { alignSelf: "flex-start", paddingLeft: 0 },
  titleBlock: { gap: s.small },
  summaryCard: { backgroundColor: c.surfaceLow, gap: s.medium },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  summaryCopy: { flex: 1, gap: s.small },
  filterSection: { gap: s.small },
  filterList: { gap: s.small, paddingRight: s.medium },
  group: { gap: s.medium },
  emptyCard: { padding: 0 },
  footer: { gap: s.medium, alignItems: "flex-start" },
});
