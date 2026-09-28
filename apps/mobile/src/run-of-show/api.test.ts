import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import { changeRunStatus, deleteRunItem, loadRun, resolveGuestReview, saveRunItem, setResponsibleMember } from "./api";

const ids = { wedding: "10000000-0000-4000-8000-000000000001", other: "10000000-0000-4000-8000-000000000002",
  item: "20000000-0000-4000-8000-000000000001", member: "30000000-0000-4000-8000-000000000001",
  place: "40000000-0000-4000-8000-000000000001", link: "50000000-0000-4000-8000-000000000001" };
type Call = { table: string; operation: string; fields?: Record<string, unknown>; filters: [string, unknown][] };
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), calls: [] as Call[], rows: {} as Record<string, Record<string, unknown>[]> }));
vi.mock("../auth/client", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
function membership(role: WorkspaceMembership["role"] = "OWNER"): WorkspaceMembership {
  return { membershipId: ids.member, weddingId: ids.wedding, userId: "60000000-0000-4000-8000-000000000001", role,
    status: "ACTIVE", partnerNames: ["Juan", "Maria"], wedding: { id: ids.wedding, display_name: "Juan & Maria",
      wedding_date: null, general_location: null, status: "ACTIVE", origin: "COUPLE_CREATED", ownership_mode: "COUPLE_OWNED" } };
}
const draft = { title: "Ceremony", description: "", scheduledStart: "2027-01-01T15:00:00+08:00", scheduledEnd: null,
  actualStart: null, actualEnd: null, sortOrder: 0, placeId: null };
function setup() {
  mocks.calls.length = 0;
  mocks.rows = {
    wedding_day_items: [{ id: ids.item, wedding_id: ids.wedding, title: "Ceremony", description: null,
      scheduled_start: "2027-01-01T07:00:00Z", scheduled_end: null, actual_start: null, actual_end: null,
      status: "UPCOMING", sort_order: 0, place_id: null }],
    wedding_day_item_memberships: [],
    wedding_memberships: [{ id: ids.member, wedding_id: ids.wedding, user_id: membership().userId, status: "ACTIVE", role: "OWNER" }],
    wedding_people: [{ wedding_id: ids.wedding, linked_user_id: membership().userId, display_name: "Juan" }],
    wedding_places: [{ id: ids.place, wedding_id: ids.wedding, user_label: "Garden", custom_name: null, archived_at: null }],
    guest_program_items: [{ id: ids.link, wedding_id: ids.wedding, operational_item_id: ids.item, title: "Ceremony",
      scheduled_start: "2027-01-01T07:00:00Z", scheduled_end: null, is_published: false, review_required: true }],
  };
  mocks.from.mockReset(); mocks.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  mocks.from.mockImplementation((table: string) => {
    const call: Call = { table, operation: "select", filters: [] }; mocks.calls.push(call);
    const query = {
      select(_columns: string) { return query; },
      eq(column: string, value: unknown) { call.filters.push([column, value]); return query; },
      is(column: string, value: unknown) { call.filters.push([column, value]); return query; },
      not() { return query; },
      insert(fields: Record<string, unknown>) { call.operation = "insert"; call.fields = fields; return query; },
      update(fields: Record<string, unknown>) { call.operation = "update"; call.fields = fields; return query; },
      delete() { call.operation = "delete"; return query; },
      result(single = false) {
        const selected = (mocks.rows[table] ?? []).filter(row => call.filters.every(([column, value]) => row[column] === value));
        if (call.operation !== "select") return { data: single ? { id: ids.item } : null, error: null };
        return { data: single ? selected[0] ?? null : selected, error: null };
      },
      maybeSingle() { return Promise.resolve(query.result(true)); },
      single() { return Promise.resolve(query.result(true)); },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) { return Promise.resolve(query.result()).then(resolve, reject); },
    };
    return query;
  });
}
beforeEach(setup);
const writes = () => mocks.calls.filter(call => call.operation !== "select");
describe("Run of Show scoped table operations", () => {
  it("reads the operational, assignment, place, and linked review data for one Wedding", async () => {
    const data = await loadRun(membership());
    expect(data.items).toHaveLength(1); expect(data.members[0]?.name).toBe("Juan"); expect(data.places[0]?.name).toBe("Garden");
    expect(data.guestLinks[0]?.review_required).toBe(true);
    for (const call of mocks.calls) expect(call.filters).toContainEqual(["wedding_id", ids.wedding]);
  });
  it("creates, edits, and deletes only the selected Wedding item", async () => {
    expect(await saveRunItem(membership(), draft)).toBe(ids.item);
    expect(writes()[0]).toMatchObject({ table: "wedding_day_items", operation: "insert", fields: { wedding_id: ids.wedding, title: "Ceremony" } });
    mocks.calls.length = 0;
    await saveRunItem(membership(), { ...draft, title: "Rehearsal" }, ids.item);
    expect(writes()[0]?.filters).toEqual(expect.arrayContaining([["wedding_id", ids.wedding], ["id", ids.item]]));
    mocks.calls.length = 0; await deleteRunItem(membership(), ids.item);
    expect(writes()[0]?.filters).toEqual(expect.arrayContaining([["wedding_id", ids.wedding], ["id", ids.item]]));
    mocks.calls.length = 0; await expect(deleteRunItem(membership(), ids.other)).rejects.toThrow(/selected Wedding/);
    expect(writes()).toHaveLength(0);
  });
  it("rejects foreign places and invalid timing before a write", async () => {
    await expect(saveRunItem(membership(), { ...draft, placeId: ids.other })).rejects.toThrow(/place/);
    await expect(saveRunItem(membership(), { ...draft, scheduledEnd: "2027-01-01T06:00:00Z" })).rejects.toThrow();
    expect(writes()).toHaveLength(0);
  });
  it("records actual timing only for explicit start or complete and never shifts downstream items", async () => {
    await changeRunStatus(membership("DAY_OF_COORDINATOR"), ids.item, "DELAYED", false);
    expect(writes()[0]?.fields).toEqual({ status: "DELAYED" });
    expect(writes()[0]?.filters).toContainEqual(["status", "UPCOMING"]);
    mocks.calls.length = 0; await changeRunStatus(membership(), ids.item, "IN_PROGRESS", true);
    expect(writes()[0]?.fields).toMatchObject({ status: "IN_PROGRESS", actual_start: expect.any(String) });
    expect(writes()[0]?.fields).not.toHaveProperty("scheduled_start");
    mocks.calls.length = 0; await changeRunStatus(membership(), ids.item, "COMPLETED", true);
    expect(writes()[0]?.fields?.actual_end).toBe(writes()[0]?.fields?.actual_start);
    expect(writes()).toHaveLength(1);
  });
  it("assigns and removes active same-Wedding memberships", async () => {
    await setResponsibleMember(membership(), ids.item, ids.member, true);
    expect(writes()[0]).toMatchObject({ table: "wedding_day_item_memberships", operation: "insert",
      fields: { wedding_id: ids.wedding, item_id: ids.item, membership_id: ids.member } });
    mocks.calls.length = 0; await setResponsibleMember(membership(), ids.item, ids.member, false);
    expect(writes()[0]?.filters).toEqual(expect.arrayContaining([["wedding_id", ids.wedding], ["item_id", ids.item], ["membership_id", ids.member]]));
    mocks.calls.length = 0; await expect(setResponsibleMember(membership(), ids.item, ids.other, true)).rejects.toThrow(/team member/);
    expect(writes()).toHaveLength(0);
  });
  it("blocks Guest Coordinator writes and Day-of guest publication", async () => {
    await expect(saveRunItem(membership("GUEST_COORDINATOR"), draft)).rejects.toThrow();
    await expect(resolveGuestReview(membership("DAY_OF_COORDINATOR"), ids.link, "KEEP")).rejects.toThrow();
    expect(writes()).toHaveLength(0); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("resolves KEEP without time/publication changes and UPDATE only with explicit values", async () => {
    await resolveGuestReview(membership("FULL_COORDINATOR"), ids.link, "KEEP");
    expect(mocks.rpc).toHaveBeenCalledWith("set_guest_program_publication", expect.objectContaining({ p_item_id: ids.link, p_action: "KEEP", p_publish: undefined, p_scheduled_start: undefined }));
    mocks.rpc.mockClear();
    await expect(resolveGuestReview(membership(), ids.link, "UPDATE")).rejects.toThrow();
    await resolveGuestReview(membership(), ids.link, "UPDATE", "2027-01-01T08:00:00Z", null);
    expect(mocks.rpc).toHaveBeenCalledWith("set_guest_program_publication", expect.objectContaining({ p_action: "UPDATE", p_publish: undefined, p_scheduled_start: "2027-01-01T08:00:00Z" }));
    mocks.rpc.mockClear(); await resolveGuestReview(membership(), ids.link, "UPDATE", "2027-01-01T08:00:00Z", null, true);
    expect(mocks.rpc).toHaveBeenCalledWith("set_guest_program_publication", expect.objectContaining({ p_publish: true }));
    await expect(resolveGuestReview(membership(), ids.other, "KEEP")).rejects.toThrow(/selected Wedding/);
  });
});
