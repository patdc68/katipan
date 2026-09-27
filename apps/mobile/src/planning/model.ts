import { z } from "zod";
import type { Database } from "@katipan/database/types";
import type { WorkspaceMembership } from "../workspace/model";
import { calendarDateToIso, parseCalendarDate } from "../onboarding/model";

export type PlanningTask = Database["public"]["Tables"]["planning_tasks"]["Row"];
export type TaskCategory = Database["public"]["Tables"]["task_categories"]["Row"];
export type PlanningTaskStatus = Database["public"]["Enums"]["planning_task_status"];
export type PlanningTaskPriority = Database["public"]["Enums"]["planning_task_priority"];
export type WeddingMembershipRole = Database["public"]["Enums"]["wedding_membership_role"];
export type WeddingMembershipStatus = Database["public"]["Enums"]["wedding_membership_status"];

export const planningTaskStatuses = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const satisfies readonly PlanningTaskStatus[];
export const planningTaskPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const satisfies readonly PlanningTaskPriority[];

export type PlanningMember = {
  id: string;
  userId: string | null;
  role: WeddingMembershipRole;
  status: WeddingMembershipStatus;
  displayName: string;
};

export type PlanningTaskAssignee = {
  taskId: string;
  membershipId: string;
};

export type PlanningTaskDependency = {
  taskId: string;
  dependsOnTaskId: string;
};

export type PlanningWorkspaceData = {
  weddingId: string;
  tasks: PlanningTask[];
  categories: TaskCategory[];
  members: PlanningMember[];
  assignees: PlanningTaskAssignee[];
  dependencies: PlanningTaskDependency[];
};

export const taskDraftSchema = z.object({
  title: z.string().trim().min(1, "Enter a task title.").max(160, "Use 160 characters or fewer."),
  description: z.string().trim().max(4000, "Use 4,000 characters or fewer."),
  categoryId: z.string().uuid().nullable(),
  priority: z.enum(planningTaskPriorities),
  startDate: z.string().nullable().refine(
    (value) => value === null || parseCalendarDate(value) !== null,
    "Choose a valid start date.",
  ),
  dueDate: z.string().nullable().refine(
    (value) => value === null || parseCalendarDate(value) !== null,
    "Choose a valid due date.",
  ),
  privateNotes: z.string().trim().max(4000, "Use 4,000 characters or fewer."),
}).superRefine((draft, context) => {
  if (draft.startDate && draft.dueDate && draft.startDate > draft.dueDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dueDate"],
      message: "Due date must be on or after the start date.",
    });
  }
});

export type TaskDraft = z.infer<typeof taskDraftSchema>;

export const emptyTaskDraft: TaskDraft = {
  title: "",
  description: "",
  categoryId: null,
  priority: "NORMAL",
  startDate: null,
  dueDate: null,
  privateNotes: "",
};

export type PlanningTaskFilters = {
  categoryId: string | null;
  status: PlanningTaskStatus | "ALL";
  priority: PlanningTaskPriority | "ALL";
  due: "ALL" | "OVERDUE" | "UPCOMING" | "NO_DATE";
};

export const defaultPlanningTaskFilters: PlanningTaskFilters = {
  categoryId: null,
  status: "ALL",
  priority: "ALL",
  due: "ALL",
};

export type TaskDueState = "COMPLETED" | "CANCELLED" | "OVERDUE" | "TODAY" | "UPCOMING" | "NO_DATE";

export function taskDueState(task: Pick<PlanningTask, "status" | "due_date">, today: string): TaskDueState {
  if (task.status === "COMPLETED") return "COMPLETED";
  if (task.status === "CANCELLED") return "CANCELLED";
  if (!task.due_date) return "NO_DATE";
  if (task.due_date < today) return "OVERDUE";
  if (task.due_date === today) return "TODAY";
  return "UPCOMING";
}

export function taskDueLabel(state: TaskDueState): string {
  switch (state) {
    case "COMPLETED": return "Completed";
    case "CANCELLED": return "Cancelled";
    case "OVERDUE": return "Overdue";
    case "TODAY": return "Due today";
    case "UPCOMING": return "Upcoming";
    case "NO_DATE": return "No due date";
  }
}

export function taskStatusLabel(status: PlanningTaskStatus): string {
  switch (status) {
    case "TODO": return "To do";
    case "IN_PROGRESS": return "In progress";
    case "COMPLETED": return "Completed";
    case "CANCELLED": return "Cancelled";
  }
}

export function taskPriorityLabel(priority: PlanningTaskPriority): string {
  switch (priority) {
    case "LOW": return "Low";
    case "NORMAL": return "Normal";
    case "HIGH": return "High";
    case "URGENT": return "Urgent";
  }
}

export function canManagePlanning(membership: WorkspaceMembership | null | undefined): boolean {
  return Boolean(
    membership
    && membership.status === "ACTIVE"
    && (membership.role === "OWNER" || membership.role === "FULL_COORDINATOR"),
  );
}

export function filterPlanningTasks(
  tasks: readonly PlanningTask[],
  filters: PlanningTaskFilters,
  today: string,
): PlanningTask[] {
  return tasks.filter((task) => {
    if (filters.categoryId === "uncategorized" && task.category_id !== null) return false;
    if (filters.categoryId && filters.categoryId !== "uncategorized" && task.category_id !== filters.categoryId) return false;
    if (filters.status !== "ALL" && task.status !== filters.status) return false;
    if (filters.priority !== "ALL" && task.priority !== filters.priority) return false;
    if (filters.due === "OVERDUE" && taskDueState(task, today) !== "OVERDUE") return false;
    if (filters.due === "UPCOMING") {
      const state = taskDueState(task, today);
      if (state !== "TODAY" && state !== "UPCOMING") return false;
    }
    if (filters.due === "NO_DATE" && taskDueState(task, today) !== "NO_DATE") return false;
    return true;
  }).sort(compareTaskDates);
}

export type TaskCategoryGroup = {
  id: string | null;
  name: string;
  tasks: PlanningTask[];
};

export function groupTasksByCategory(
  tasks: readonly PlanningTask[],
  categories: readonly TaskCategory[],
): TaskCategoryGroup[] {
  const groups: TaskCategoryGroup[] = [];
  for (const category of [...categories].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))) {
    const categoryTasks = tasks.filter((task) => task.category_id === category.id);
    if (categoryTasks.length) groups.push({ id: category.id, name: category.name, tasks: categoryTasks });
  }
  const uncategorized = tasks.filter((task) => task.category_id === null);
  if (uncategorized.length) groups.push({ id: null, name: "Uncategorized", tasks: uncategorized });
  return groups;
}

export function compareTaskDates(left: PlanningTask, right: PlanningTask): number {
  if (left.due_date !== right.due_date) {
    if (left.due_date === null) return 1;
    if (right.due_date === null) return -1;
    return left.due_date.localeCompare(right.due_date);
  }
  return left.sort_order - right.sort_order || left.title.localeCompare(right.title);
}

export type PlanningSummary = {
  total: number;
  completed: number;
  remaining: number;
  progressPercent: number;
  overdue: PlanningTask[];
  upcoming: PlanningTask[];
  completedTasks: PlanningTask[];
  categories: {
    id: string | null;
    name: string;
    total: number;
    completed: number;
  }[];
};

export function derivePlanningSummary(
  tasks: readonly PlanningTask[],
  categories: readonly TaskCategory[],
  today: string,
): PlanningSummary {
  const countedTasks = tasks.filter((task) => task.status !== "CANCELLED");
  const completedTasks = countedTasks.filter((task) => task.status === "COMPLETED")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const overdue = countedTasks.filter((task) => taskDueState(task, today) === "OVERDUE").sort(compareTaskDates);
  const upcoming = countedTasks.filter((task) => {
    const state = taskDueState(task, today);
    return state === "TODAY" || state === "UPCOMING";
  }).sort(compareTaskDates);
  const categoryStats: PlanningSummary["categories"] = [...categories]
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((category) => {
      const activeTasks = tasks.filter((task) => task.category_id === category.id && task.status !== "CANCELLED");
      return {
        id: category.id,
        name: category.name,
        total: activeTasks.length,
        completed: activeTasks.filter((task) => task.status === "COMPLETED").length,
      };
    });
  const uncategorizedTasks = tasks.filter((task) => task.category_id === null && task.status !== "CANCELLED");
  if (uncategorizedTasks.length) categoryStats.push({
    id: null,
    name: "Uncategorized",
    total: uncategorizedTasks.length,
    completed: uncategorizedTasks.filter((task) => task.status === "COMPLETED").length,
  });
  const total = countedTasks.length;
  const completed = completedTasks.length;
  return {
    total,
    completed,
    remaining: total - completed,
    progressPercent: total === 0 ? 0 : Math.round(completed / total * 100),
    overdue,
    upcoming,
    completedTasks,
    categories: categoryStats,
  };
}

export function taskDraftFromTask(task: PlanningTask): TaskDraft {
  return {
    title: task.title,
    description: task.description ?? "",
    categoryId: task.category_id,
    priority: task.priority,
    startDate: task.start_date,
    dueDate: task.due_date,
    privateNotes: task.private_notes ?? "",
  };
}

export function calendarDateToTaskValue(date: Date): string {
  return calendarDateToIso(date);
}

export function validTaskCalendarDate(value: string): boolean {
  return parseCalendarDate(value) !== null;
}

/** Prevents two rapid taps from issuing the same task action twice. */
export class SingleSubmitGate {
  private pending = false;

  async run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (this.pending) return undefined;
    this.pending = true;
    try {
      return await action();
    } finally {
      this.pending = false;
    }
  }
}

export function safePlanningError(error: unknown, fallback = "We couldn't save this planning change. Try again."): string {
  if (!error || typeof error !== "object" || !("code" in error)) return fallback;
  switch (error.code) {
    case "42501": return "You don't have permission to make this planning change.";
    case "23514": return "That dependency would create a cycle. Choose another task.";
    case "23503": return "Choose an active member or task from this Wedding.";
    case "23505": return "That dependency is already in place.";
    default: return fallback;
  }
}
