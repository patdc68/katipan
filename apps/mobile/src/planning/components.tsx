import { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { EditorialCard, KatipanText, StatusChip } from "../ui";
import WeddingDateField from "../onboarding/WeddingDateField";
import { formatWeddingDate } from "../workspace/presentation";
import {
  taskDueLabel,
  taskDueState,
  taskPriorityLabel,
  taskStatusLabel,
  type PlanningTask,
  type PlanningTaskStatus,
} from "./model";

export function FilterChip({
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

export function ChoiceChips<T extends string>({
  values,
  selected,
  labelFor,
  onSelect,
  disabled = false,
}: {
  values: readonly T[];
  selected: T;
  labelFor: (value: T) => string;
  onSelect: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.choiceList}>
      {values.map((value) => (
        <FilterChip
          key={value}
          label={labelFor(value)}
          selected={value === selected}
          disabled={disabled}
          onPress={() => onSelect(value)}
        />
      ))}
    </View>
  );
}

export function PlanningTaskRow({
  task,
  categoryName,
  assigneeNames = [],
  today,
  onPress,
  quickComplete,
  trailing,
}: {
  task: PlanningTask;
  categoryName?: string;
  assigneeNames?: string[];
  today: string;
  onPress: () => void;
  quickComplete?: () => void;
  trailing?: ReactNode;
}) {
  const dueState = taskDueState(task, today);
  const dueDate = formatWeddingDate(task.due_date);
  const dueTone = dueState === "OVERDUE" ? "error" : dueState === "TODAY" ? "warning" : dueState === "COMPLETED" ? "success" : "neutral";
  const statusTone = task.status === "COMPLETED" ? "success" : task.status === "IN_PROGRESS" ? "warning" : task.status === "CANCELLED" ? "neutral" : "neutral";
  return (
    <EditorialCard style={styles.taskCard}>
      <View style={styles.taskMainRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={"Open task: " + task.title} onPress={onPress} style={styles.taskPressable}>
          <View style={styles.taskTopLine}>
            <View style={[styles.completionMark, task.status === "COMPLETED" && styles.completionMarkDone]}>
              {task.status === "COMPLETED" && <KatipanText variant="label" color="onPrimary">✓</KatipanText>}
            </View>
            <KatipanText
              variant="title"
              style={[styles.taskTitle, task.status === "COMPLETED" && styles.taskCompleted]}
            >
              {task.title}
            </KatipanText>
          </View>
          <View style={styles.taskMeta}>
            <StatusChip label={taskStatusLabel(task.status)} tone={statusTone} />
            <StatusChip label={taskPriorityLabel(task.priority) + " priority"} tone={task.priority === "URGENT" ? "error" : task.priority === "HIGH" ? "warning" : "neutral"} />
            <StatusChip label={dueDate ? taskDueLabel(dueState) + " · " + dueDate : taskDueLabel(dueState)} tone={dueTone} />
          </View>
          <View style={styles.taskDetailLine}>
            {!!categoryName && <KatipanText variant="bodySmall" color="secondary">{categoryName}</KatipanText>}
            {!!assigneeNames.length && <KatipanText variant="bodySmall" color="textMuted">{assigneeNames.join(", ")}</KatipanText>}
          </View>
        </Pressable>
        {quickComplete && task.status !== "COMPLETED" && task.status !== "CANCELLED" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={"Mark " + task.title + " complete"}
            onPress={quickComplete}
            style={styles.quickComplete}
          >
            <KatipanText variant="headlineSmall" color="primary">✓</KatipanText>
          </Pressable>
        ) : trailing}
      </View>
    </EditorialCard>
  );
}

export function TaskDateField({
  label,
  date,
  onChange,
  disabled,
}: {
  label: string;
  date: string;
  onChange: (date: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.dateRow}>
      <View style={styles.dateField}>
        <WeddingDateField label={label} date={date} disabled={disabled} onChange={onChange} />
      </View>
      {!!date && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Clear " + label.toLowerCase()}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => onChange("")}
          style={[styles.clearDate, disabled && styles.disabled]}
        >
          <KatipanText variant="labelLarge" color="textMuted">Clear</KatipanText>
        </Pressable>
      )}
    </View>
  );
}

export function statusTone(status: PlanningTaskStatus): "success" | "warning" | "neutral" {
  if (status === "COMPLETED") return "success";
  if (status === "IN_PROGRESS") return "warning";
  return "neutral";
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
  choiceList: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  disabled: { opacity: 0.5 },
  taskCard: { backgroundColor: c.cardIvory, padding: s.medium },
  taskMainRow: { flexDirection: "row", alignItems: "center", gap: s.small },
  taskPressable: { flex: 1, gap: s.small },
  taskTopLine: { flexDirection: "row", alignItems: "center", gap: s.small },
  completionMark: {
    width: 24,
    height: 24,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: c.outlineSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  completionMarkDone: { backgroundColor: c.sageRomance, borderColor: c.sageRomance },
  taskTitle: { flex: 1 },
  taskCompleted: { color: c.textMuted, textDecorationLine: "line-through" },
  taskMeta: { flexDirection: "row", flexWrap: "wrap", gap: s.small, paddingLeft: 32 },
  taskDetailLine: { gap: s.micro, paddingLeft: 32 },
  quickComplete: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: r.pill,
    backgroundColor: c.primaryFixed,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: s.small },
  dateField: { flex: 1 },
  clearDate: {
    minHeight: 48,
    paddingHorizontal: s.medium,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: r.pill,
    backgroundColor: c.surfaceLow,
  },
});
