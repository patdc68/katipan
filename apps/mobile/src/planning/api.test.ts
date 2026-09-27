import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import { emptyTaskDraft, type PlanningTask } from "./model";
import {
  addPlanningTaskDependency,
  assignPlanningTask,
  changePlanningTaskStatus,
  createPlanningTask,
  loadPlanningWorkspace,
  removePlanningTaskDependency,
  unassignPlanningTask,
  updatePlanningTask,
} from "./api";

type QueryRecord = {
  table: string;
  columns: string;
  filters: { operator: string; column: string; value: unknown }[];
  single: boolean;
};

const ids = {
  wedding: "10000000-0000-4000-8000-000000000001",
  otherWedding: "10000000-0000-4000-8000-000000000002",
  category: "20000000-0000-4000-8000-000000000001",
  task: "30000000-0000-4000-8000-000000000001",
  otherTask: "30000000-0000-4000-8000-000000000002",
  foreignTask: "30000000-0000-4000-8000-000000000004",
  newTask: "30000000-0000-4000-8000-000000000003",
  owner: "40000000-0000-4000-8000-000000000001",
  member: "40000000-0000-4000-8000-000000000002",
  user: "50000000-0000-4000-8000-000000000001",
  memberUser: "50000000-0000-4000-8000-000000000002",
};

const { from, rpc, records } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  records: [] as QueryRecord[],
}));

vi.mock("../auth/client", () => ({ supabase: { from, rpc } }));

function task(overrides: Partial<PlanningTask> = {}): PlanningTask {
  return {
    id: ids.task,
    wedding_id: ids.wedding,
    category_id: ids.category,
    title: "Book ceremony venue",
    description: null,
    status: "TODO",
    priority: "NORMAL",
    start_date: null,
    due_date: "2027-03-10",
    completed_at: null,
    completed_by_user_id: null,
    sort_order: 4,
    private_notes: null,
    created_by_user_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function responseFor(record: QueryRecord): { data: unknown; error: null } {
  const equals = new Map(record.filters.filter((filter) => filter.operator === "eq").map((filter) => [filter.column, filter.value]));
  const wedding = equals.get("wedding_id");
  switch (record.table) {
    case "planning_tasks": {
      if (wedding !== ids.wedding) return { data: record.single ? null : [], error: null };
      const selectedId = equals.get("id");
      if (selectedId && selectedId !== ids.task && selectedId !== ids.otherTask) return { data: null, error: null };
      return { data: record.single ? (selectedId === ids.otherTask ? task({ id: ids.otherTask }) : task()) : [task(), task({ id: ids.otherTask })], error: null };
    }
    case "task_categories": {
      if (wedding !== ids.wedding) return { data: record.single ? null : [], error: null };
      const selectedId = equals.get("id");
      if (selectedId && selectedId !== ids.category) return { data: null, error: null };
      const category = {
        id: ids.category,
        wedding_id: ids.wedding,
        name: "Venue",
        sort_order: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      };
      return { data: record.single ? category : [category], error: null };
    }
    case "wedding_memberships": {
      if (wedding !== ids.wedding) return { data: record.single ? null : [], error: null };
      const selectedId = equals.get("id");
      if (record.single) {
        if (selectedId !== ids.member) return { data: null, error: null };
        return { data: { id: ids.member, wedding_id: ids.wedding, user_id: ids.memberUser, role: "FULL_COORDINATOR", status: "ACTIVE" }, error: null };
      }
      return { data: [
        { id: ids.owner, wedding_id: ids.wedding, user_id: ids.user, role: "OWNER", status: "ACTIVE" },
        { id: ids.member, wedding_id: ids.wedding, user_id: ids.memberUser, role: "FULL_COORDINATOR", status: "ACTIVE" },
      ], error: null };
    }
    case "wedding_people":
      return { data: [{ linked_user_id: ids.user, display_name: "Ana Santos" }], error: null };
    case "planning_task_assignees": {
      if (wedding !== ids.wedding) return { data: record.single ? null : [], error: null };
      if (record.single && equals.get("task_id") === ids.task && equals.get("membership_id") === ids.member) {
        return { data: { membership_id: ids.member }, error: null };
      }
      return { data: [{ wedding_id: ids.wedding, task_id: ids.task, membership_id: ids.member }], error: null };
    }
    case "planning_task_dependencies":
      return { data: [{ wedding_id: ids.wedding, task_id: ids.task, depends_on_task_id: ids.otherTask }], error: null };
    default:
      throw new Error("Unexpected planning query: " + record.table);
  }
}

function mockQueries() {
  records.splice(0, records.length);
  from.mockReset();
  rpc.mockReset();
  from.mockImplementation((table: string) => {
    const record: QueryRecord = { table, columns: "", filters: [], single: false };
    records.push(record);
    const query = {
      select(columns: string) { record.columns = columns; return query; },
      eq(column: string, value: unknown) { record.filters.push({ operator: "eq", column, value }); return query; },
      not(column: string, operator: string, value: unknown) { record.filters.push({ operator: "not:" + operator, column, value }); return query; },
      order() { return query; },
      maybeSingle() { record.single = true; return Promise.resolve(responseFor(record)); },
      then(onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) {
        return Promise.resolve(responseFor(record)).then(onfulfilled, onrejected);
      },
    };
    return query;
  });
  rpc.mockImplementation(async (name: string) => ({
    data: name === "create_planning_task" ? ids.newTask : name === "assign_planning_task" || name === "unassign_planning_task" || name === "add_planning_task_dependency" || name === "remove_planning_task_dependency",
    error: null,
  }));
}

function membership(role: WorkspaceMembership["role"] = "OWNER"): WorkspaceMembership {
  return {
    membershipId: ids.owner,
    weddingId: ids.wedding,
    userId: ids.user,
    role,
    status: "ACTIVE",
    partnerNames: ["Ana Santos"],
    wedding: {
      id: ids.wedding,
      display_name: "Garden Wedding",
      wedding_date: "2027-06-12",
      general_location: "Manila",
      status: "ACTIVE",
      origin: "COUPLE_CREATED",
      ownership_mode: "COUPLE_OWNED",
    },
  };
}

describe("planning data scope and RPC contract", () => {
  beforeEach(mockQueries);

  it("loads tasks, categories, memberships, assignees, and dependencies within the selected Wedding", async () => {
    const data = await loadPlanningWorkspace(membership());

    expect(data.weddingId).toBe(ids.wedding);
    expect(data.tasks.map((item) => item.wedding_id)).toEqual([ids.wedding, ids.wedding]);
    expect(data.categories.map((item) => item.wedding_id)).toEqual([ids.wedding]);
    expect(data.members[0]?.displayName).toBe("Ana Santos");
    expect(data.assignees).toEqual([{ taskId: ids.task, membershipId: ids.member }]);
    expect(data.dependencies).toEqual([{ taskId: ids.task, dependsOnTaskId: ids.otherTask }]);
    expect(records).toHaveLength(6);
    expect(records.every((query) => query.filters.some((filter) => filter.column === "wedding_id" && filter.value === ids.wedding))).toBe(true);
  });

  it("maps create and update forms to the existing RPC argument names and nullable fields", async () => {
    const draft = {
      ...emptyTaskDraft,
      title: "  Confirm the ceremony place  ",
      description: "   ",
      categoryId: ids.category,
      priority: "HIGH" as const,
      startDate: "2027-01-10",
      dueDate: null,
      privateNotes: "  Call the venue lead  ",
    };

    await expect(createPlanningTask(membership(), draft)).resolves.toBe(ids.newTask);
    expect(rpc).toHaveBeenCalledWith("create_planning_task", {
      p_wedding_id: ids.wedding,
      p_category_id: ids.category,
      p_title: "Confirm the ceremony place",
      p_description: null,
      p_priority: "HIGH",
      p_start_date: "2027-01-10",
      p_due_date: null,
      p_sort_order: 0,
      p_private_notes: "Call the venue lead",
    });

    await updatePlanningTask(membership(), ids.task, draft, 4);
    expect(rpc).toHaveBeenLastCalledWith("update_planning_task", {
      p_task_id: ids.task,
      p_category_id: ids.category,
      p_title: "Confirm the ceremony place",
      p_description: null,
      p_priority: "HIGH",
      p_start_date: "2027-01-10",
      p_due_date: null,
      p_sort_order: 4,
      p_private_notes: "Call the venue lead",
    });
  });

  it("changes status through the status RPC so completion metadata remains backend-owned", async () => {
    await changePlanningTaskStatus(membership(), ids.task, "COMPLETED");

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("change_planning_task_status", {
      p_task_id: ids.task,
      p_status: "COMPLETED",
    });
  });

  it("assigns and unassigns a task through their RPCs after selected-Wedding guards", async () => {
    await expect(assignPlanningTask(membership(), ids.task, ids.member)).resolves.toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(1, "assign_planning_task", {
      p_task_id: ids.task,
      p_membership_id: ids.member,
    });

    await expect(unassignPlanningTask(membership(), ids.task, ids.member)).resolves.toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(2, "unassign_planning_task", {
      p_task_id: ids.task,
      p_membership_id: ids.member,
    });
    expect(records.every((query) => query.filters.some((filter) => filter.column === "wedding_id" && filter.value === ids.wedding))).toBe(true);
  });

  it("adds and removes same-Wedding dependencies through the existing RPCs", async () => {
    await expect(addPlanningTaskDependency(membership(), ids.task, ids.otherTask)).resolves.toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(1, "add_planning_task_dependency", {
      p_task_id: ids.task,
      p_depends_on_task_id: ids.otherTask,
    });

    await expect(removePlanningTaskDependency(membership(), ids.task, ids.otherTask)).resolves.toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(2, "remove_planning_task_dependency", {
      p_task_id: ids.task,
      p_depends_on_task_id: ids.otherTask,
    });
  });

  it("rejects task IDs from another Wedding before invoking a mutation RPC", async () => {
    await expect(changePlanningTaskStatus(membership(), ids.foreignTask, "COMPLETED")).rejects.toThrow("Planning Task is unavailable in this Wedding.");
    expect(rpc).not.toHaveBeenCalled();
    expect(records[0]?.filters).toEqual(expect.arrayContaining([
      { operator: "eq", column: "id", value: ids.foreignTask },
      { operator: "eq", column: "wedding_id", value: ids.wedding },
    ]));
  });

  it("blocks a Day-of Coordinator from task management before reads or RPC writes", async () => {
    await expect(createPlanningTask(membership("DAY_OF_COORDINATOR"), {
      ...emptyTaskDraft,
      title: "Unauthorized task",
    })).rejects.toMatchObject({ code: "42501" });
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
