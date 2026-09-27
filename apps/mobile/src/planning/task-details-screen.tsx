import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import {
  EditorialCard,
  ErrorState,
  KatipanButton,
  KatipanScreen,
  KatipanText,
  LoadingState,
  SectionHeader,
  StatusChip,
} from "../ui";
import { formatWeddingDate, localCalendarDate } from "../workspace/presentation";
import {
  canManagePlanning,
  planningTaskStatuses,
  safePlanningError,
  SingleSubmitGate,
  taskDueLabel,
  taskDueState,
  taskPriorityLabel,
  taskStatusLabel,
} from "./model";
import {
  addPlanningTaskDependency,
  assignPlanningTask,
  isAssignableMember,
  removePlanningTaskDependency,
  unassignPlanningTask,
  changePlanningTaskStatus,
} from "./api";
import { ChoiceChips } from "./components";
import { usePlanningWorkspace } from "./use-planning-workspace";

export default function TaskDetailsScreen() {
  const params = useLocalSearchParams<{ taskId?: string | string[] }>();
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] ?? "" : params.taskId ?? "";
  const { weddingId, membership, isCurrent, loading, error, data, retry } = usePlanningWorkspace();
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showDependencyPicker, setShowDependencyPicker] = useState(false);
  const gate = useRef(new SingleSubmitGate());
  const today = localCalendarDate();

  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading task details…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load this Wedding task." onRetry={retry} /></KatipanScreen>;
  const task = data.tasks.find((item) => item.id === taskId && item.wedding_id === weddingId);
  if (!task) {
    return <KatipanScreen><ErrorState title="Task unavailable" description="This task isn't available in the selected Wedding." onRetry={retry} /></KatipanScreen>;
  }

  const canEdit = canManagePlanning(membership);
  const categoryName = data.categories.find((category) => category.id === task.category_id)?.name ?? "Uncategorized";
  const membersById = new Map(data.members.map((member) => [member.id, member]));
  const assignments = data.assignees.filter((assignment) => assignment.taskId === task.id);
  const assignedIds = new Set(assignments.map((assignment) => assignment.membershipId));
  const activeMembers = data.members.filter(isAssignableMember);
  const availableMembers = activeMembers.filter((member) => !assignedIds.has(member.id));
  const dependencies = data.dependencies.filter((dependency) => dependency.taskId === task.id);
  const dependencyIds = new Set(dependencies.map((dependency) => dependency.dependsOnTaskId));
  const dependencyCandidates = data.tasks.filter((candidate) => candidate.id !== task.id && !dependencyIds.has(candidate.id));
  const dueState = taskDueState(task, today);
  const startDate = formatWeddingDate(task.start_date);
  const dueDate = formatWeddingDate(task.due_date);

  const performAction = async (action: () => Promise<unknown>) => {
    await gate.current.run(async () => {
      if (saving) return;
      setSaving(true);
      setActionError(null);
      try {
        await action();
        setShowAssigneePicker(false);
        setShowDependencyPicker(false);
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
      <KatipanButton label="Back to Wedding Checklist" variant="text" onPress={() => router.back()} style={styles.backButton} />
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">WEDDING CHECKLIST</KatipanText>
        <KatipanText variant="headlineLarge">Task Details</KatipanText>
      </View>

      <EditorialCard style={styles.taskHero}>
        <View style={styles.taskHeroTop}>
          <StatusChip label={taskStatusLabel(task.status)} tone={task.status === "COMPLETED" ? "success" : task.status === "IN_PROGRESS" ? "warning" : "neutral"} />
          <StatusChip label={taskPriorityLabel(task.priority) + " priority"} tone={task.priority === "URGENT" ? "error" : task.priority === "HIGH" ? "warning" : "neutral"} />
        </View>
        <KatipanText variant="headlineLarge">{task.title}</KatipanText>
        <KatipanText color="textMuted">{categoryName}</KatipanText>
        {task.description ? <KatipanText variant="bodyLarge">{task.description}</KatipanText> : <KatipanText color="textMuted">No description has been added.</KatipanText>}
        <View style={styles.datesRow}>
          <DateSummary label="START DATE" value={startDate ?? "Not set"} />
          <DateSummary label={task.due_date ? taskDueLabel(dueState).toUpperCase() : "DUE DATE"} value={dueDate ?? "Not set"} />
        </View>
        {canEdit && (
          <KatipanButton
            label="Edit task"
            variant="secondary"
            onPress={() => router.navigate({
              pathname: "/(wedding)/[weddingId]/plan/tasks/[taskId]/edit",
              params: { weddingId, taskId },
            })}
          />
        )}
      </EditorialCard>

      {canEdit && (
        <View style={styles.section}>
          <SectionHeader title="Task status" description="Completion metadata is recorded by the Wedding workspace." />
          <ChoiceChips
            values={planningTaskStatuses}
            selected={task.status}
            labelFor={taskStatusLabel}
            onSelect={(status) => void performAction(() => changePlanningTaskStatus(membership, task.id, status))}
            disabled={saving}
          />
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader title="Assigned to" description="Wedding members responsible for this task" action={canEdit ? <KatipanButton label={showAssigneePicker ? "Done" : "Assign member"} variant="text" onPress={() => setShowAssigneePicker((show) => !show)} /> : undefined} />
        {assignments.length === 0 ? (
          <EditorialCard style={styles.compactCard}><KatipanText color="textMuted">No assignees yet.</KatipanText></EditorialCard>
        ) : assignments.map((assignment) => {
          const member = membersById.get(assignment.membershipId);
          return (
            <EditorialCard key={assignment.membershipId} style={styles.memberCard}>
              <View style={styles.memberLine}>
                <View style={styles.memberCopy}>
                  <KatipanText variant="title">{member?.displayName ?? "Wedding member"}</KatipanText>
                  {member && <KatipanText variant="bodySmall" color="textMuted">{member.role.replaceAll("_", " ")} · {member.status.toLowerCase()}</KatipanText>}
                </View>
                {canEdit && <KatipanButton label="Unassign" variant="text" disabled={saving} onPress={() => void performAction(() => unassignPlanningTask(membership, task.id, assignment.membershipId))} />}
              </View>
            </EditorialCard>
          );
        })}
        {showAssigneePicker && canEdit && (
          <View style={styles.optionList}>
            {availableMembers.length === 0 ? (
              <KatipanText color="textMuted">All active Wedding members are already assigned.</KatipanText>
            ) : availableMembers.map((member) => (
              <Pressable
                key={member.id}
                accessibilityRole="button"
                accessibilityLabel={"Assign " + member.displayName}
                disabled={saving}
                onPress={() => void performAction(() => assignPlanningTask(membership, task.id, member.id))}
                style={[styles.optionRow, saving && styles.disabled]}
              >
                <View style={styles.memberCopy}>
                  <KatipanText variant="title">{member.displayName}</KatipanText>
                  <KatipanText variant="bodySmall" color="textMuted">{member.role.replaceAll("_", " ")}</KatipanText>
                </View>
                <KatipanText variant="headlineSmall" color="primary">+</KatipanText>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Dependencies" description="Tasks that need to be completed first" action={canEdit ? <KatipanButton label={showDependencyPicker ? "Done" : "Add dependency"} variant="text" onPress={() => setShowDependencyPicker((show) => !show)} /> : undefined} />
        {dependencies.length === 0 ? (
          <EditorialCard style={styles.compactCard}><KatipanText color="textMuted">No dependencies.</KatipanText></EditorialCard>
        ) : dependencies.map((dependency) => {
          const prerequisite = data.tasks.find((candidate) => candidate.id === dependency.dependsOnTaskId && candidate.wedding_id === weddingId);
          return (
            <EditorialCard key={dependency.dependsOnTaskId} style={styles.dependencyCard}>
              <View style={styles.memberLine}>
                <Pressable accessibilityRole="button" accessibilityLabel={"Open prerequisite: " + (prerequisite?.title ?? "Planning task")} onPress={() => prerequisite && router.navigate({
                  pathname: "/(wedding)/[weddingId]/plan/tasks/[taskId]",
                  params: { weddingId, taskId: prerequisite.id },
                })} style={styles.memberCopy}>
                  <KatipanText variant="title">{prerequisite?.title ?? "Planning task"}</KatipanText>
                  {prerequisite && <KatipanText variant="bodySmall" color="textMuted">{taskStatusLabel(prerequisite.status)}</KatipanText>}
                </Pressable>
                {canEdit && <KatipanButton label="Remove" variant="text" disabled={saving} onPress={() => void performAction(() => removePlanningTaskDependency(membership, task.id, dependency.dependsOnTaskId))} />}
              </View>
            </EditorialCard>
          );
        })}
        {showDependencyPicker && canEdit && (
          <View style={styles.optionList}>
            {dependencyCandidates.length === 0 ? (
              <KatipanText color="textMuted">There are no other tasks to add.</KatipanText>
            ) : dependencyCandidates.map((candidate) => (
              <Pressable
                key={candidate.id}
                accessibilityRole="button"
                accessibilityLabel={"Make " + candidate.title + " a prerequisite"}
                disabled={saving}
                onPress={() => void performAction(() => addPlanningTaskDependency(membership, task.id, candidate.id))}
                style={[styles.optionRow, saving && styles.disabled]}
              >
                <View style={styles.memberCopy}>
                  <KatipanText variant="title">{candidate.title}</KatipanText>
                  <KatipanText variant="bodySmall" color="textMuted">{taskStatusLabel(candidate.status)} · {candidate.category_id ? data.categories.find((category) => category.id === candidate.category_id)?.name ?? "Category" : "Uncategorized"}</KatipanText>
                </View>
                <KatipanText variant="headlineSmall" color="primary">+</KatipanText>
              </Pressable>
            ))}
          </View>
        )}
        {canEdit && <KatipanText variant="bodySmall" color="textMuted">Adding a prerequisite does not change or reschedule other tasks.</KatipanText>}
      </View>

      {!!task.private_notes && (
        <EditorialCard style={styles.notesCard}>
          <SectionHeader title="Private notes" />
          <KatipanText>{task.private_notes}</KatipanText>
          <KatipanText variant="bodySmall" color="textMuted">Visible to active Wedding members with access to planning tasks.</KatipanText>
        </EditorialCard>
      )}

      {!!actionError && <KatipanText accessibilityRole="alert" color="error">{actionError}</KatipanText>}
      {canEdit && task.status !== "COMPLETED" && task.status !== "CANCELLED" && (
        <KatipanButton label={saving ? "Saving…" : "Mark task complete"} loading={saving} onPress={() => void performAction(() => changePlanningTaskStatus(membership, task.id, "COMPLETED"))} />
      )}
      <View style={styles.bottomSpace} />
    </KatipanScreen>
  );
}

function DateSummary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dateSummary}>
      <KatipanText variant="labelCaps" color="secondary">{label}</KatipanText>
      <KatipanText variant="title">{value}</KatipanText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  backButton: { alignSelf: "flex-start", paddingLeft: 0 },
  titleBlock: { gap: s.small },
  taskHero: { gap: s.medium, padding: s.cardLarge, backgroundColor: c.surfaceLow },
  taskHeroTop: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  datesRow: { flexDirection: "row", flexWrap: "wrap", gap: s.large },
  dateSummary: { minWidth: 128, gap: s.small },
  section: { gap: s.medium },
  compactCard: { padding: s.medium },
  memberCard: { padding: s.medium },
  memberLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  memberCopy: { flex: 1, gap: s.micro },
  optionList: { gap: s.small },
  optionRow: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium, paddingHorizontal: s.medium, paddingVertical: s.small, borderRadius: r.large, borderWidth: 1, borderColor: c.stoneBorder, backgroundColor: c.cardIvory },
  disabled: { opacity: 0.5 },
  dependencyCard: { padding: s.medium, backgroundColor: c.cardIvory },
  notesCard: { gap: s.medium, backgroundColor: c.surfaceLow },
  bottomSpace: { height: s.large },
});
