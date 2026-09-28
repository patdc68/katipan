import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import { createProgramItem, deleteProgramItem, editProgramItem, loadProgram, setProgramPublication } from "./api";

const ids = { wedding: "10000000-0000-4000-8000-000000000001", other: "10000000-0000-4000-8000-000000000002",
  item: "20000000-0000-4000-8000-000000000001", operation: "30000000-0000-4000-8000-000000000001",
  place: "40000000-0000-4000-8000-000000000001" };
type Call = { table: string; operation: string; fields?: Record<string, unknown>; filters: [string, unknown][] };
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), calls: [] as Call[], rows: {} as Record<string, Record<string, unknown>[]> }));
vi.mock("../auth/client", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
function membership(role: WorkspaceMembership["role"] = "OWNER"): WorkspaceMembership {
  return { membershipId: ids.item, weddingId: ids.wedding, userId: ids.operation, role, status: "ACTIVE",
    partnerNames: ["Juan", "Maria"], wedding: { id: ids.wedding, display_name: "Juan & Maria",
      wedding_date: null, general_location: null, status: "ACTIVE", origin: "COUPLE_CREATED", ownership_mode: "COUPLE_OWNED" } };
}
const draft = { title: "Ceremony", description: "Welcome", scheduledStart: "2027-01-01T07:00:00Z",
  scheduledEnd: null, placeId: null, operationalItemId: null, sortOrder: 0 };
function setup() {
  mocks.calls.length = 0;
  mocks.rows = {
    guest_program_items: [{ id: ids.item, wedding_id: ids.wedding, operational_item_id: ids.operation,
      title: "Ceremony", description: null, scheduled_start: draft.scheduledStart, scheduled_end: null,
      place_id: ids.place, sort_order: 0, is_published: true, published_at: draft.scheduledStart,
      review_required: true, review_requested_at: draft.scheduledStart, review_confirmed_at: null, review_resolution: null }],
    wedding_day_items: [{ id: ids.operation, wedding_id: ids.wedding, title: "Processional", scheduled_start: draft.scheduledStart,
      scheduled_end: null, actual_start: null, actual_end: null, status: "UPCOMING" }],
    wedding_places: [{ id: ids.place, wedding_id: ids.wedding, user_label: "Garden", custom_name: null, archived_at: null }],
    wedding_websites: [{ wedding_id: ids.wedding, slug: "juan-maria", is_published: true }],
  };
  mocks.from.mockReset(); mocks.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  mocks.from.mockImplementation((table: string) => {
    const call: Call = { table, operation: "select", filters: [] }; mocks.calls.push(call);
    const query = {
      select(_columns: string) { return query; },
      eq(column: string, value: unknown) { call.filters.push([column, value]); return query; },
      is(column: string, value: unknown) { call.filters.push([column, value]); return query; },
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
describe("Guest Program scoped operations", () => {
  it("loads selected Wedding items, operational links, places, and website state", async () => {
    mocks.rows.guest_program_items.push({ ...mocks.rows.guest_program_items[0], id: ids.other, wedding_id: ids.other });
    mocks.rows.wedding_day_items.push({ ...mocks.rows.wedding_day_items[0], id: ids.other, wedding_id: ids.other });
    mocks.rows.wedding_places.push({ ...mocks.rows.wedding_places[0], id: ids.other, wedding_id: ids.other });
    const data = await loadProgram(membership("DAY_OF_COORDINATOR"));
    expect(data.items).toHaveLength(1); expect(data.operations[0]?.title).toBe("Processional");
    expect(data.places[0]?.name).toBe("Garden"); expect(data.website?.isPublished).toBe(true);
    for (const call of mocks.calls) expect(call.filters).toContainEqual(["wedding_id", ids.wedding]);
  });
  it("creates an unpublished standalone item with only allowed columns", async () => {
    expect(await createProgramItem(membership(), draft)).toBe(ids.item);
    expect(writes()[0]?.fields).toEqual({ wedding_id: ids.wedding, operational_item_id: null, title: "Ceremony",
      description: "Welcome", scheduled_start: draft.scheduledStart, scheduled_end: null, place_id: null, sort_order: 0 });
    expect(writes()[0]?.fields).not.toHaveProperty("is_published");
  });
  it("accepts a same-Wedding operational link and place, and rejects foreign ones", async () => {
    await createProgramItem(membership(), { ...draft, operationalItemId: ids.operation, placeId: ids.place });
    expect(writes()[0]?.fields).toMatchObject({ operational_item_id: ids.operation, place_id: ids.place });
    mocks.calls.length = 0;
    await expect(createProgramItem(membership(), { ...draft, operationalItemId: ids.other })).rejects.toThrow(/Run-of-Show/);
    await expect(createProgramItem(membership(), { ...draft, placeId: ids.other })).rejects.toThrow(/place/);
    expect(writes()).toHaveLength(0);
  });
  it("edits descriptive and linking fields only, then deletes within the Wedding", async () => {
    await editProgramItem(membership("FULL_COORDINATOR"), ids.item, { ...draft, operationalItemId: null });
    expect(writes()[0]?.fields).toEqual({ operational_item_id: null, title: "Ceremony", description: "Welcome", place_id: null, sort_order: 0 });
    expect(writes()[0]?.filters).toEqual(expect.arrayContaining([["wedding_id", ids.wedding], ["id", ids.item]]));
    mocks.calls.length = 0; await deleteProgramItem(membership(), ids.item);
    expect(writes()[0]?.operation).toBe("delete");
    mocks.calls.length = 0; await expect(deleteProgramItem(membership(), ids.other)).rejects.toThrow(/selected Wedding/);
    expect(writes()).toHaveLength(0);
  });
  it("uses UPDATE RPC for publish, unpublish, and guest schedule changes", async () => {
    await setProgramPublication(membership(), ids.item, "UPDATE", draft.scheduledStart, null, true);
    await setProgramPublication(membership(), ids.item, "UPDATE", draft.scheduledStart, null, false);
    await setProgramPublication(membership(), ids.item, "UPDATE", "2027-01-01T08:00:00Z", null);
    expect(mocks.rpc.mock.calls.map(([, args]) => args)).toEqual([
      expect.objectContaining({ p_action: "UPDATE", p_publish: true, p_scheduled_start: draft.scheduledStart }),
      expect.objectContaining({ p_action: "UPDATE", p_publish: false, p_scheduled_start: draft.scheduledStart }),
      expect.objectContaining({ p_action: "UPDATE", p_publish: undefined, p_scheduled_start: "2027-01-01T08:00:00Z" }),
    ]);
    expect(writes()).toHaveLength(0);
  });
  it("resolves KEEP without timing or publication and UPDATE explicitly", async () => {
    await setProgramPublication(membership(), ids.item, "KEEP");
    expect(mocks.rpc).toHaveBeenCalledWith("set_guest_program_publication", expect.objectContaining({ p_action: "KEEP",
      p_scheduled_start: undefined, p_publish: undefined }));
    await setProgramPublication(membership(), ids.item, "UPDATE", "2027-01-01T08:00:00Z", null);
    expect(mocks.rpc).toHaveBeenCalledWith("set_guest_program_publication", expect.objectContaining({ p_action: "UPDATE",
      p_scheduled_start: "2027-01-01T08:00:00Z", p_publish: undefined }));
  });
  it("keeps Day-of and Guest Coordinators read-only and guards cross-Wedding IDs", async () => {
    for (const role of ["DAY_OF_COORDINATOR", "GUEST_COORDINATOR"] as const) {
      await expect(createProgramItem(membership(role), draft)).rejects.toThrow();
      await expect(setProgramPublication(membership(role), ids.item, "KEEP")).rejects.toThrow();
      expect((await loadProgram(membership(role))).items).toHaveLength(1);
    }
    await expect(setProgramPublication(membership(), ids.other, "KEEP")).rejects.toThrow(/selected Wedding/);
    expect(writes()).toHaveLength(0); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
