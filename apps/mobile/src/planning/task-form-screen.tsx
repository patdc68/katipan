import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colorTokens as c, spacingTokens as s } from "@katipan/ui";
import {
  EditorialCard,
  ErrorState,
  FormField,
  KatipanButton,
  KatipanScreen,
  KatipanText,
  LoadingState,
  SectionHeader,
} from "../ui";
import type { WorkspaceMembership } from "../workspace/model";
import {
  canManagePlanning,
  emptyTaskDraft,
  planningTaskPriorities,
  safePlanningError,
  SingleSubmitGate,
  taskDraftFromTask,
  taskDraftSchema,
  taskPriorityLabel,
  type PlanningTask,
  type TaskCategory,
  type TaskDraft,
} from "./model";
import { createPlanningTask, updatePlanningTask } from "./api";
import { ChoiceChips, FilterChip, TaskDateField } from "./components";
import { usePlanningWorkspace } from "./use-planning-workspace";

export function NewTaskScreen() {
  return <TaskFormScreen mode="create" />;
}

export function EditTaskScreen() {
  return <TaskFormScreen mode="edit" />;
}

function TaskFormScreen({ mode }: { mode: "create" | "edit" }) {
  const params = useLocalSearchParams<{ taskId?: string | string[] }>();
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] ?? "" : params.taskId ?? "";
  const { weddingId, membership, isCurrent, loading, error, data, retry } = usePlanningWorkspace();
  const router = useRouter();
  const task = data?.tasks.find((item) => item.id === taskId && item.wedding_id === weddingId) ?? null;

  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label={mode === "create" ? "Preparing a new task…" : "Loading task to edit…"} /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load planning for this Wedding." onRetry={retry} /></KatipanScreen>;
  if (!canManagePlanning(membership)) return <KatipanScreen><ErrorState title="Planning changes aren't available" description="Only Wedding Owners and Full Coordinators can edit planning tasks." onRetry={() => router.back()} /></KatipanScreen>;
  if (mode === "edit" && !task) return <KatipanScreen><ErrorState title="Task unavailable" description="This task isn't available in the selected Wedding." onRetry={retry} /></KatipanScreen>;

  return (
    <TaskEditor
      key={mode === "edit" ? task?.id : "new-task"}
      mode={mode}
      weddingId={weddingId}
      membership={membership}
      categories={data.categories}
      task={task}
    />
  );
}

function TaskEditor({
  mode,
  weddingId,
  membership,
  categories,
  task,
}: {
  mode: "create" | "edit";
  weddingId: string;
  membership: WorkspaceMembership;
  categories: TaskCategory[];
  task: PlanningTask | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<TaskDraft>(() => task ? taskDraftFromTask(task) : emptyTaskDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const gate = useRef(new SingleSubmitGate());
  const setField = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setFormError(null);
  };

  const save = async () => {
    await gate.current.run(async () => {
      if (saving) return;
      const parsed = taskDraftSchema.safeParse(draft);
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Review the task details and try again.");
        return;
      }
      setSaving(true);
      setFormError(null);
      try {
        let savedTaskId = task?.id ?? "";
        if (mode === "create") savedTaskId = await createPlanningTask(membership, parsed.data);
        else if (task) await updatePlanningTask(membership, task.id, parsed.data, task.sort_order);
        router.replace({
          pathname: "/(wedding)/[weddingId]/plan/tasks/[taskId]",
          params: { weddingId, taskId: savedTaskId },
        });
      } catch (cause) {
        setFormError(safePlanningError(cause, "We couldn't save this task. Review the details and try again."));
      } finally {
        setSaving(false);
      }
    });
  };

  const title = mode === "create" ? "Create task" : "Edit task";
  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="Cancel" variant="text" onPress={() => router.back()} style={styles.backButton} />
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">WEDDING CHECKLIST</KatipanText>
        <KatipanText variant="headlineLarge">{title}</KatipanText>
        <KatipanText color="textMuted">{mode === "create" ? "Add a task to this Wedding plan." : "Update this task's planning details."}</KatipanText>
      </View>
      <EditorialCard style={styles.formCard}>
        <FormField label="Task title" value={draft.title} onChangeText={(value) => setField("title", value)} placeholder="Enter a task title" maxLength={160} returnKeyType="done" editable={!saving} />
        <FormField label="Description" value={draft.description} onChangeText={(value) => setField("description", value)} placeholder="Add useful details for your Wedding team" multiline maxLength={4000} editable={!saving} style={styles.multiline} />
        <View style={styles.fieldSection}>
          <SectionHeader title="Category" description="Choose a category saved for this Wedding." />
          <View style={styles.chipList}>
            <FilterChip label="Uncategorized" selected={draft.categoryId === null} onPress={() => setField("categoryId", null)} disabled={saving} />
            {categories.map((category) => <FilterChip key={category.id} label={category.name} selected={draft.categoryId === category.id} onPress={() => setField("categoryId", category.id)} disabled={saving} />)}
          </View>
          {categories.length === 0 && <KatipanText variant="bodySmall" color="textMuted">No categories are set up yet. You can add a category later.</KatipanText>}
        </View>
        <View style={styles.fieldSection}>
          <SectionHeader title="Priority" />
          <ChoiceChips values={planningTaskPriorities} selected={draft.priority} labelFor={taskPriorityLabel} onSelect={(priority) => setField("priority", priority)} disabled={saving} />
        </View>
        <View style={styles.fieldSection}>
          <SectionHeader title="Planning dates" description="Dates stay on the Wedding calendar day." />
          <TaskDateField label="Start date" date={draft.startDate ?? ""} onChange={(value) => setField("startDate", value || null)} disabled={saving} />
          <TaskDateField label="Due date" date={draft.dueDate ?? ""} onChange={(value) => setField("dueDate", value || null)} disabled={saving} />
        </View>
        <FormField label="Private notes" hint="Visible to active Wedding members who can access planning tasks." value={draft.privateNotes} onChangeText={(value) => setField("privateNotes", value)} placeholder="Add planning notes for this Wedding" multiline maxLength={4000} editable={!saving} style={styles.multiline} />
      </EditorialCard>
      {!!formError && <KatipanText accessibilityRole="alert" color="error">{formError}</KatipanText>}
      <KatipanButton label={saving ? "Saving…" : mode === "create" ? "Create task" : "Save changes"} loading={saving} onPress={() => void save()} />
      <View style={styles.bottomSpace} />
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.large, paddingBottom: s.extraLarge },
  backButton: { alignSelf: "flex-start", paddingLeft: 0 },
  titleBlock: { gap: s.small },
  formCard: { gap: s.large, padding: s.cardLarge, backgroundColor: c.cardIvory },
  fieldSection: { gap: s.medium },
  chipList: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  multiline: { minHeight: 112, textAlignVertical: "top" },
  bottomSpace: { height: s.large },
});
