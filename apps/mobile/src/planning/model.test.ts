import { describe, expect, it } from "vitest";
import type { Database } from "@katipan/database/types";
import type { WorkspaceMembership } from "../workspace/model";
import {
  calendarDateToTaskValue,
  canManagePlanning,
  derivePlanningSummary,
  filterPlanningTasks,
  groupTasksByCategory,
  safePlanningError,
  SingleSubmitGate,
  taskDueState,
  taskDraftSchema,
  validTaskCalendarDate,
  type PlanningTask,
} from "./model";

const weddingId = "10000000-0000-4000-8000-000000000001";
const categoryId = "20000000-0000-4000-8000-000000000001";

function task(overrides: Partial<PlanningTask> = {}): PlanningTask {
  return {
    id: "30000000-0000-4000-8000-000000000001",
    wedding_id: weddingId,
    category_id: categoryId,
    title: "Book ceremony venue",
    description: null,
    status: "TODO",
    priority: "NORMAL",
    start_date: null,
    due_date: "2027-03-10",
    completed_at: null,
    completed_by_user_id: null,
    sort_order: 0,
    private_notes: null,
    created_by_user_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function category(overrides: Partial<Database["public"]["Tables"]["task_categories"]["Row"]> = {}) {
  return {
    id: categoryId,
    wedding_id: weddingId,
    name: "Venue",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function membership(
  role: WorkspaceMembership["role"],
  status: WorkspaceMembership["status"] = "ACTIVE",
): WorkspaceMembership {
  return {
    membershipId: "40000000-0000-4000-8000-000000000001",
    weddingId,
    userId: "50000000-0000-4000-8000-000000000001",
    role,
    status,
    partnerNames: [],
    wedding: {
      id: weddingId,
      display_name: "Garden Wedding",
      wedding_date: null,
      general_location: null,
      status: "ACTIVE",
      origin: "COUPLE_CREATED",
      ownership_mode: "COUPLE_OWNED",
    },
  };
}

describe("planning summary and filters", () => {
  it("derives progress, categories, overdue, upcoming, and completed from task rows", () => {
    const tasks = [
      task({ id: "todo", due_date: "2027-03-01" }),
      task({ id: "in-progress", status: "IN_PROGRESS", due_date: "2027-04-01", category_id: null }),
      task({ id: "completed", status: "COMPLETED", due_date: "2027-02-01", updated_at: "2026-03-01T00:00:00.000Z" }),
      task({ id: "cancelled", status: "CANCELLED", due_date: "2027-02-01" }),
    ];

    const summary = derivePlanningSummary(tasks, [category(), category({
      id: "20000000-0000-4000-8000-000000000002",
      name: "Attire",
      sort_order: 1,
    })], "2027-03-15");

    expect(summary).toMatchObject({
      total: 3,
      completed: 1,
      remaining: 2,
      progressPercent: 33,
      overdue: [{ id: "todo" }],
      upcoming: [{ id: "in-progress" }],
      completedTasks: [{ id: "completed" }],
      categories: [
        { id: categoryId, name: "Venue", total: 2, completed: 1 },
        { id: "20000000-0000-4000-8000-000000000002", name: "Attire", total: 0, completed: 0 },
        { id: null, name: "Uncategorized", total: 1, completed: 0 },
      ],
    });
  });

  it("treats completed and cancelled tasks as not overdue", () => {
    expect(taskDueState(task({ due_date: "2027-03-09" }), "2027-03-10")).toBe("OVERDUE");
    expect(taskDueState(task({ due_date: "2027-03-10" }), "2027-03-10")).toBe("TODAY");
    expect(taskDueState(task({ due_date: null }), "2027-03-10")).toBe("NO_DATE");
    expect(taskDueState(task({ status: "COMPLETED", due_date: "2027-03-09" }), "2027-03-10")).toBe("COMPLETED");
    expect(taskDueState(task({ status: "CANCELLED", due_date: "2027-03-09" }), "2027-03-10")).toBe("CANCELLED");
  });

  it("filters by backend status, priority, category, and due state, then groups by Wedding category", () => {
    const tasks = [
      task({ id: "late", due_date: "2027-03-09", priority: "URGENT" }),
      task({ id: "future", due_date: "2027-03-11", status: "IN_PROGRESS", priority: "HIGH" }),
      task({ id: "unassigned-category", category_id: null, due_date: null }),
      task({ id: "done", status: "COMPLETED", due_date: "2027-03-01" }),
    ];
    const filtered = filterPlanningTasks(tasks, {
      categoryId: categoryId,
      status: "TODO",
      priority: "URGENT",
      due: "OVERDUE",
    }, "2027-03-10");

    expect(filtered.map((item) => item.id)).toEqual(["late"]);
    expect(groupTasksByCategory(tasks, [category()]).map((group) => ({
      name: group.name,
      ids: group.tasks.map((item) => item.id),
    }))).toEqual([
      { name: "Venue", ids: ["late", "future", "done"] },
      { name: "Uncategorized", ids: ["unassigned-category"] },
    ]);
    expect(filterPlanningTasks(tasks, { categoryId: "uncategorized", status: "ALL", priority: "ALL", due: "NO_DATE" }, "2027-03-10").map((item) => item.id)).toEqual(["unassigned-category"]);
  });
});

describe("planning permissions and dates", () => {
  it("offers planning actions only to active Owners and Full Coordinators", () => {
    expect(canManagePlanning(membership("OWNER"))).toBe(true);
    expect(canManagePlanning(membership("FULL_COORDINATOR"))).toBe(true);
    expect(canManagePlanning(membership("DAY_OF_COORDINATOR"))).toBe(false);
    expect(canManagePlanning(membership("GUEST_COORDINATOR"))).toBe(false);
    expect(canManagePlanning(membership("OWNER", "LEFT"))).toBe(false);
  });

  it("keeps picker dates as Wedding calendar days without UTC date shifting", () => {
    const selected = new Date(2027, 0, 9, 0, 30);
    expect(calendarDateToTaskValue(selected)).toBe("2027-01-09");
    expect(validTaskCalendarDate("2027-01-09")).toBe(true);
    expect(validTaskCalendarDate("2027-02-29")).toBe(false);
    expect(taskDraftSchema.safeParse({
      title: " Task ",
      description: "",
      categoryId: null,
      priority: "NORMAL",
      startDate: "2027-01-10",
      dueDate: "2027-01-09",
      privateNotes: "",
    }).success).toBe(false);
  });

  it("runs only one action when a user taps repeatedly before the first action resolves", async () => {
    const gate = new SingleSubmitGate();
    let resolveAction: (() => void) | undefined;
    let calls = 0;
    const action = () => {
      calls += 1;
      return new Promise<string>((resolve) => { resolveAction = () => resolve("saved"); });
    };
    const first = gate.run(action);
    const duplicate = await gate.run(action);
    expect(duplicate).toBeUndefined();
    expect(calls).toBe(1);
    resolveAction?.();
    await expect(first).resolves.toBe("saved");
  });

  it("does not expose raw backend error text to users", () => {
    expect(safePlanningError({ code: "23514", message: "private postgres details" })).toContain("cycle");
    expect(safePlanningError({ code: "XX000", message: "private postgres details" })).toBe("We couldn't save this planning change. Try again.");
  });
});
