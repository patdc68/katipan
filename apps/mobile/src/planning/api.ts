import { supabase } from "../auth/client";
import { roleLabel, type WorkspaceMembership } from "../workspace/model";
import {
  taskDraftSchema,
  type PlanningMember,
  type PlanningTask,
  type PlanningTaskStatus,
  type PlanningWorkspaceData,
  type TaskDraft,
} from "./model";
import type { Database } from "@katipan/database/types";

type MutationFields = {
  p_category_id: string | null;
  p_title: string;
  p_description: string | null;
  p_priority: Database["public"]["Enums"]["planning_task_priority"];
  p_start_date: string | null;
  p_due_date: string | null;
  p_sort_order: number;
  p_private_notes: string | null;
};

function assertActiveMembership(membership: WorkspaceMembership): void {
  if (membership.status !== "ACTIVE" || membership.weddingId !== membership.wedding.id) {
    throw new Error("An active Wedding membership is required.");
  }
}

function assertPlanningManager(membership: WorkspaceMembership): void {
  assertActiveMembership(membership);
  if (membership.role !== "OWNER" && membership.role !== "FULL_COORDINATOR") {
    throw Object.assign(new Error("Planning changes are not permitted."), { code: "42501" });
  }
}

function taskMutationFields(draft: TaskDraft, sortOrder: number): MutationFields {
  const value = taskDraftSchema.parse(draft);
  return {
    p_category_id: value.categoryId,
    p_title: value.title,
    p_description: value.description || null,
    p_priority: value.priority,
    p_start_date: value.startDate,
    p_due_date: value.dueDate,
    p_sort_order: sortOrder,
    p_private_notes: value.privateNotes || null,
  };
}

async function assertCategoryInWedding(weddingId: string, categoryId: string | null): Promise<void> {
  if (!categoryId) return;
  const { data, error } = await supabase
    .from("task_categories")
    .select("id")
    .eq("wedding_id", weddingId)
    .eq("id", categoryId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Category is unavailable in this Wedding."), { code: "23503" });
}

async function assertTaskInWedding(weddingId: string, taskId: string): Promise<void> {
  const { data, error } = await supabase
    .from("planning_tasks")
    .select("id,wedding_id")
    .eq("id", taskId)
    .eq("wedding_id", weddingId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId) {
    throw Object.assign(new Error("Planning Task is unavailable in this Wedding."), { code: "22023" });
  }
}

async function assertActiveWeddingMember(weddingId: string, membershipId: string): Promise<void> {
  const { data, error } = await supabase
    .from("wedding_memberships")
    .select("id,user_id,status")
    .eq("wedding_id", weddingId)
    .eq("id", membershipId)
    .eq("status", "ACTIVE")
    .not("user_id", "is", null)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== "ACTIVE" || !data.user_id) {
    throw Object.assign(new Error("Assignee is unavailable in this Wedding."), { code: "23503" });
  }
}

export async function loadPlanningWorkspace(membership: WorkspaceMembership): Promise<PlanningWorkspaceData> {
  assertActiveMembership(membership);
  const weddingId = membership.weddingId;
  const [taskResult, categoryResult, memberResult, personResult, assigneeResult, dependencyResult] = await Promise.all([
    supabase.from("planning_tasks")
      .select("id,wedding_id,category_id,title,description,status,priority,start_date,due_date,completed_at,completed_by_user_id,sort_order,private_notes,created_by_user_id,created_at,updated_at")
      .eq("wedding_id", weddingId)
      .order("sort_order", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("task_categories")
      .select("id,wedding_id,name,sort_order,created_at,updated_at")
      .eq("wedding_id", weddingId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("wedding_memberships")
      .select("id,wedding_id,user_id,role,status")
      .eq("wedding_id", weddingId),
    supabase.from("wedding_people")
      .select("linked_user_id,display_name")
      .eq("wedding_id", weddingId)
      .not("linked_user_id", "is", null),
    supabase.from("planning_task_assignees")
      .select("wedding_id,task_id,membership_id")
      .eq("wedding_id", weddingId),
    supabase.from("planning_task_dependencies")
      .select("wedding_id,task_id,depends_on_task_id")
      .eq("wedding_id", weddingId),
  ]);
  const error = [
    taskResult.error,
    categoryResult.error,
    memberResult.error,
    personResult.error,
    assigneeResult.error,
    dependencyResult.error,
  ].find(Boolean);
  if (error) throw error;

  const peopleByUserId = new Map<string, string>();
  for (const person of personResult.data ?? []) {
    const name = person.display_name.trim();
    if (person.linked_user_id && name) peopleByUserId.set(person.linked_user_id, name);
  }
  const members: PlanningMember[] = (memberResult.data ?? []).map((member) => ({
    id: member.id,
    userId: member.user_id,
    role: member.role,
    status: member.status,
    displayName: (member.user_id && peopleByUserId.get(member.user_id)) || roleLabel(member.role),
  }));

  return {
    weddingId,
    tasks: taskResult.data ?? [],
    categories: categoryResult.data ?? [],
    members,
    assignees: (assigneeResult.data ?? []).map((assignment) => ({
      taskId: assignment.task_id,
      membershipId: assignment.membership_id,
    })),
    dependencies: (dependencyResult.data ?? []).map((dependency) => ({
      taskId: dependency.task_id,
      dependsOnTaskId: dependency.depends_on_task_id,
    })),
  };
}

export async function createPlanningTask(
  membership: WorkspaceMembership,
  draft: TaskDraft,
): Promise<string> {
  assertPlanningManager(membership);
  const fields = taskMutationFields(draft, 0);
  await assertCategoryInWedding(membership.weddingId, fields.p_category_id);
  const args = {
    p_wedding_id: membership.weddingId,
    ...fields,
  };
  // Generated RPC types model nullable PostgreSQL arguments as strings.
  // Keep explicit nulls in the JSON payload to match the live function signature.
  const { data, error } = await supabase.rpc(
    "create_planning_task",
    args as unknown as Database["public"]["Functions"]["create_planning_task"]["Args"],
  );
  if (error) throw error;
  if (!data) throw new Error("Planning Task could not be created.");
  return data;
}

export async function updatePlanningTask(
  membership: WorkspaceMembership,
  taskId: string,
  draft: TaskDraft,
  sortOrder: number,
): Promise<void> {
  assertPlanningManager(membership);
  await assertTaskInWedding(membership.weddingId, taskId);
  const fields = taskMutationFields(draft, sortOrder);
  await assertCategoryInWedding(membership.weddingId, fields.p_category_id);
  const args = { p_task_id: taskId, ...fields };
  const { error } = await supabase.rpc(
    "update_planning_task",
    args as unknown as Database["public"]["Functions"]["update_planning_task"]["Args"],
  );
  if (error) throw error;
}

export async function changePlanningTaskStatus(
  membership: WorkspaceMembership,
  taskId: string,
  status: PlanningTaskStatus,
): Promise<void> {
  assertPlanningManager(membership);
  await assertTaskInWedding(membership.weddingId, taskId);
  const { error } = await supabase.rpc("change_planning_task_status", {
    p_task_id: taskId,
    p_status: status,
  });
  if (error) throw error;
}

export async function assignPlanningTask(
  membership: WorkspaceMembership,
  taskId: string,
  assigneeMembershipId: string,
): Promise<boolean> {
  assertPlanningManager(membership);
  await assertTaskInWedding(membership.weddingId, taskId);
  await assertActiveWeddingMember(membership.weddingId, assigneeMembershipId);
  const { data, error } = await supabase.rpc("assign_planning_task", {
    p_task_id: taskId,
    p_membership_id: assigneeMembershipId,
  });
  if (error) throw error;
  return data;
}

export async function unassignPlanningTask(
  membership: WorkspaceMembership,
  taskId: string,
  assigneeMembershipId: string,
): Promise<boolean> {
  assertPlanningManager(membership);
  await assertTaskInWedding(membership.weddingId, taskId);
  const { data, error } = await supabase
    .from("planning_task_assignees")
    .select("membership_id")
    .eq("wedding_id", membership.weddingId)
    .eq("task_id", taskId)
    .eq("membership_id", assigneeMembershipId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  const result = await supabase.rpc("unassign_planning_task", {
    p_task_id: taskId,
    p_membership_id: assigneeMembershipId,
  });
  if (result.error) throw result.error;
  return result.data;
}

async function assertDependencyTasksInWedding(
  weddingId: string,
  taskId: string,
  dependsOnTaskId: string,
): Promise<void> {
  await assertTaskInWedding(weddingId, taskId);
  await assertTaskInWedding(weddingId, dependsOnTaskId);
  if (taskId === dependsOnTaskId) {
    throw Object.assign(new Error("A task cannot depend on itself."), { code: "23514" });
  }
}

export async function addPlanningTaskDependency(
  membership: WorkspaceMembership,
  taskId: string,
  dependsOnTaskId: string,
): Promise<boolean> {
  assertPlanningManager(membership);
  await assertDependencyTasksInWedding(membership.weddingId, taskId, dependsOnTaskId);
  const { data, error } = await supabase.rpc("add_planning_task_dependency", {
    p_task_id: taskId,
    p_depends_on_task_id: dependsOnTaskId,
  });
  if (error) throw error;
  return data;
}

export async function removePlanningTaskDependency(
  membership: WorkspaceMembership,
  taskId: string,
  dependsOnTaskId: string,
): Promise<boolean> {
  assertPlanningManager(membership);
  await assertDependencyTasksInWedding(membership.weddingId, taskId, dependsOnTaskId);
  const { data, error } = await supabase.rpc("remove_planning_task_dependency", {
    p_task_id: taskId,
    p_depends_on_task_id: dependsOnTaskId,
  });
  if (error) throw error;
  return data;
}

export function isAssignableMember(member: PlanningMember): boolean {
  return member.status === "ACTIVE" && member.userId !== null;
}

export function isTaskInWorkspace(task: PlanningTask | null | undefined, weddingId: string): task is PlanningTask {
  return Boolean(task && task.wedding_id === weddingId);
}
