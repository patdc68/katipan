import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadWeddingDashboard, canViewBudgetSummary } from "./home-api";
import type { WorkspaceMembership, WorkspaceRole } from "./model";

type QueryRecord = {
  table: string;
  columns: string;
  filters: { operator: string; column: string; value: unknown }[];
};

const { from, records } = vi.hoisted(() => ({
  from: vi.fn(),
  records: [] as QueryRecord[],
}));

vi.mock("../auth/client", () => ({ supabase: { from } }));

const weddingId = "wedding-1";

function responseFor(record: QueryRecord) {
  const equals = new Map(record.filters.filter((filter) => filter.operator === "eq").map((filter) => [filter.column, filter.value]));
  switch (record.table) {
    case "weddings":
      return { data: {
        id: weddingId,
        display_name: "Garden Wedding",
        wedding_date: "2027-06-12",
        general_location: "Manila",
        status: "ACTIVE",
        origin: "COUPLE_CREATED",
        ownership_mode: "COUPLE_OWNED",
        currency_code: "PHP",
      }, error: null };
    case "wedding_partners":
      return { data: [{ partner_order: 1, wedding_people: { display_name: "Ana" } }, { partner_order: 2, wedding_people: { display_name: "Bea" } }], error: null };
    case "planning_tasks":
      if (record.columns.includes("title")) {
        return { data: [{ id: "task-1", title: "Book the ceremony place", due_date: "2027-01-10", priority: "HIGH", status: "TODO" }], error: null };
      }
      return { data: null, count: equals.get("status") === "COMPLETED" ? 3 : 8, error: null };
    case "guests":
      return { data: null, count: 10, error: null };
    case "guest_rsvps":
      return { data: null, count: equals.get("status") === "ATTENDING" ? 6 : 1, error: null };
    case "wedding_places":
      return { data: [{ id: "place-1", source: "CUSTOM", user_label: null, custom_name: "The Garden", custom_address: "Manila" }], error: null };
    case "wedding_place_purposes":
      return { data: [{ place_id: "place-1", purpose: "CEREMONY", purpose_label: null }], error: null };
    case "wedding_budget_totals":
      return { data: { currency_code: "PHP", estimated_total: 150000, actual_total: 22500, active_item_count: 2 }, error: null };
    default:
      throw new Error(`Unexpected dashboard query: ${record.table}`);
  }
}

function membership(role: WorkspaceRole = "OWNER", status: WorkspaceMembership["status"] = "ACTIVE"): WorkspaceMembership {
  return {
    membershipId: "membership-1",
    weddingId,
    userId: "user-1",
    role,
    status,
    partnerNames: [],
    wedding: {
      id: weddingId,
      display_name: "Garden Wedding",
      wedding_date: "2027-06-12",
      general_location: "Manila",
      status: "ACTIVE",
      origin: "COUPLE_CREATED",
      ownership_mode: "COUPLE_OWNED",
    },
  };
}

function mockQueries() {
  records.splice(0, records.length);
  from.mockReset();
  from.mockImplementation((table: string) => {
    const record: QueryRecord = { table, columns: "", filters: [] };
    records.push(record);
    const query = {
      select(columns: string) { record.columns = columns; return query; },
      eq(column: string, value: unknown) { record.filters.push({ operator: "eq", column, value }); return query; },
      neq(column: string, value: unknown) { record.filters.push({ operator: "neq", column, value }); return query; },
      is(column: string, value: unknown) { record.filters.push({ operator: "is", column, value }); return query; },
      order() { return query; },
      limit() { return query; },
      maybeSingle() { return Promise.resolve(responseFor(record)); },
      then(onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) {
        return Promise.resolve(responseFor(record)).then(onfulfilled, onrejected);
      },
    };
    return query;
  });
}

function isScopedToWedding(query: QueryRecord): boolean {
  const boundaryColumn = query.table === "weddings" ? "id" : "wedding_id";
  return query.filters.some((filter) => filter.column === boundaryColumn && filter.value === weddingId);
}

describe("Wedding dashboard data boundary", () => {
  beforeEach(mockQueries);

  it("loads real summaries with every source query scoped to the active Wedding", async () => {
    const dashboard = await loadWeddingDashboard(membership());

    expect(dashboard).toMatchObject({
      wedding: { id: weddingId, display_name: "Garden Wedding" },
      coupleNames: ["Ana", "Bea"],
      planning: { completed: 3, total: 8 },
      guests: { total: 10, attending: 6, declined: 1, pending: 3 },
      places: [{ id: "place-1", name: "The Garden", purposes: ["ceremony"] }],
      budget: { estimate: 150000, actual: 22500, itemCount: 2 },
    });
    expect(records.length).toBeGreaterThan(1);
    expect(records.every(isScopedToWedding)).toBe(true);
  });

  it("limits budget totals to Owner and Full Coordinator memberships", async () => {
    expect(canViewBudgetSummary("OWNER")).toBe(true);
    expect(canViewBudgetSummary("FULL_COORDINATOR")).toBe(true);
    expect(canViewBudgetSummary("DAY_OF_COORDINATOR")).toBe(false);
    expect(canViewBudgetSummary("GUEST_COORDINATOR")).toBe(false);

    const dashboard = await loadWeddingDashboard(membership("DAY_OF_COORDINATOR"));

    expect(records.some((query) => query.table === "wedding_budget_totals")).toBe(false);
    expect(dashboard.budget).toBeNull();
    expect(records.every(isScopedToWedding)).toBe(true);
  });

  it("does not query a Wedding for an inactive membership", async () => {
    await expect(loadWeddingDashboard(membership("OWNER", "LEFT"))).rejects.toThrow("An active Wedding membership is required.");
    expect(from).not.toHaveBeenCalled();
  });
});
