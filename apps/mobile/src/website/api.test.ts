import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import { chooseTemplate, createCustomSection, deleteCustomSection, ensureStandardSection, issueHouseholdAccess,
  loadWebsite, moveSection, revokeHouseholdAccess, saveSection, saveWebsite, setWebsitePublication } from "./api";
import type { WebsiteSection } from "./model";

const weddingId = "10000000-0000-4000-8000-000000000001";
const otherId = "10000000-0000-4000-8000-000000000002";
const sectionId = "20000000-0000-4000-8000-000000000001";
const householdId = "30000000-0000-4000-8000-000000000001";
type Call = { table: string; operation: string; fields?: Record<string, unknown>; filters: [string, unknown][] };
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), calls: [] as Call[], rows: {} as Record<string, Record<string, unknown>[]> }));
vi.mock("../auth/client", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
function member(role: WorkspaceMembership["role"] = "OWNER"): WorkspaceMembership {
  return { membershipId: sectionId, weddingId, userId: householdId, role, status: "ACTIVE", partnerNames: ["Juan", "Maria"],
    wedding: { id: weddingId, display_name: "Juan & Maria", wedding_date: null, general_location: null,
      status: "ACTIVE", origin: "COUPLE_CREATED", ownership_mode: "COUPLE_OWNED" } };
}
const draft = { slug: "juan-maria", template_key: "SAMPAGUITA" as const, access_mode: "INVITED_GUESTS_ONLY" as const,
  title: "Juan & Maria", introduction: "Welcome" };
function setup() {
  mocks.calls.length = 0;
  mocks.rows = { wedding_websites: [{ wedding_id: weddingId, ...draft, is_published: false }],
    wedding_website_sections: [{ id: sectionId, wedding_id: weddingId, section_key: "intro", section_type: "INTRO",
      sort_order: 0, audience: "PUBLIC", enabled: true, content: "Welcome" }],
    guest_households: [{ id: householdId, wedding_id: weddingId }] };
  mocks.rpc.mockReset().mockResolvedValue({ data: "a".repeat(64), error: null });
  mocks.from.mockReset().mockImplementation((table: string) => {
    const call: Call = { table, operation: "select", filters: [] }; mocks.calls.push(call);
    const query = {
      select(_columns: string) { return query; },
      eq(column: string, value: unknown) { call.filters.push([column, value]); return query; },
      order(_column: string) { return query; },
      insert(fields: Record<string, unknown>) { call.operation = "insert"; call.fields = fields; return query; },
      update(fields: Record<string, unknown>) { call.operation = "update"; call.fields = fields; return query; },
      delete() { call.operation = "delete"; return query; },
      result(single = false) {
        const rows = (mocks.rows[table] ?? []).filter(row => call.filters.every(([key, value]) => row[key] === value));
        if (call.operation !== "select") return { data: single ? { id: sectionId, wedding_id: weddingId } : null, error: null };
        return { data: single ? rows[0] ?? null : rows, error: null };
      },
      maybeSingle() { return Promise.resolve(query.result(true)); },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) { return Promise.resolve(query.result()).then(resolve, reject); },
    }; return query;
  });
}
beforeEach(setup);
const writes = () => mocks.calls.filter(call => call.operation !== "select");
describe("Wedding website scoped API", () => {
  it("creates and updates configuration with editable fields only", async () => {
    await saveWebsite(member(), draft, false);
    expect(writes()[0]?.fields).toEqual({ wedding_id: weddingId, ...draft });
    expect(writes()[0]?.fields).not.toHaveProperty("is_published");
    mocks.calls.length = 0; await saveWebsite(member("FULL_COORDINATOR"), { ...draft, title: "Our Day" }, true);
    expect(writes()[0]?.fields).toMatchObject({ title: "Our Day", slug: "juan-maria" });
    expect(writes()[0]?.filters).toContainEqual(["wedding_id", weddingId]);
  });
  it("loads only the selected Wedding and guards foreign IDs", async () => {
    mocks.rows.wedding_website_sections.push({ ...mocks.rows.wedding_website_sections[0], id: otherId, wedding_id: otherId });
    expect((await loadWebsite(member("DAY_OF_COORDINATOR"))).sections).toHaveLength(1);
    for (const call of mocks.calls) expect(call.filters).toContainEqual(["wedding_id", weddingId]);
    await expect(saveSection(member(), otherId, { audience: "PUBLIC", enabled: true, content: "" })).rejects.toThrow(/unavailable/);
    expect(writes()).toHaveLength(0);
  });
  it("supports five template keys and never updates domain data", async () => {
    for (const key of ["SAMPAGUITA", "LUNTIAN", "FILIPINIANA", "MODERN_LOVE", "AFTER_DARK"] as const)
      await chooseTemplate(member(), key);
    expect(writes().map(call => call.fields)).toEqual(["SAMPAGUITA", "LUNTIAN", "FILIPINIANA", "MODERN_LOVE", "AFTER_DARK"].map(template_key => ({ template_key })));
    expect(writes().every(call => call.table === "wedding_websites")).toBe(true);
  });
  it("creates, edits, orders and deletes sections without writing forbidden content", async () => {
    await ensureStandardSection(member(), "places", "PLACES", 1);
    expect(writes()[0]?.fields).toMatchObject({ section_type: "PLACES", audience: "HIDDEN", enabled: false });
    await saveSection(member(), sectionId, { audience: "PERSONALIZED", enabled: false, content: "Welcome guests" });
    expect(writes()[1]?.fields).toEqual({ audience: "PERSONALIZED", enabled: false, content: "Welcome guests" });
    mocks.rows.wedding_website_sections[0].section_type = "PLACES";
    await saveSection(member(), sectionId, { audience: "PUBLIC", enabled: true, content: "must not write" });
    expect(writes()[2]?.fields).toEqual({ audience: "PUBLIC", enabled: true });
    await createCustomSection(member(), "travel_tips", "Bring water", 2);
    expect(writes()[3]?.fields).toMatchObject({ section_type: "CUSTOM", audience: "HIDDEN", enabled: false });
    mocks.rows.wedding_website_sections[0].section_type = "CUSTOM";
    await deleteCustomSection(member(), sectionId);
    expect(writes()[4]?.operation).toBe("delete");
    mocks.calls.length = 0;
    const sections = [{ id: sectionId, wedding_id: weddingId, sort_order: 0 }, { id: otherId, wedding_id: weddingId, sort_order: 1 }] as WebsiteSection[];
    await moveSection(member(), sections, sectionId, 1);
    expect(writes().map(call => call.fields?.sort_order)).toEqual([0, 1]);
  });
  it("publishes separately from invitation delivery and issues/revokes one Household token", async () => {
    await setWebsitePublication(member(), true); await setWebsitePublication(member(), false);
    expect(mocks.rpc.mock.calls.slice(0, 2)).toEqual([
      ["publish_wedding_website", { p_wedding_id: weddingId, p_publish: true }],
      ["publish_wedding_website", { p_wedding_id: weddingId, p_publish: false }],
    ]);
    expect(await issueHouseholdAccess(member(), householdId)).toBe("a".repeat(64));
    await revokeHouseholdAccess(member(), householdId);
    expect(mocks.rpc.mock.calls.slice(2).map(([name]) => name)).toEqual(["issue_household_website_token", "revoke_household_website_token"]);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).not.toContain("mark_household_invitation_sent");
    expect(writes()).toHaveLength(0);
  });
  it("keeps read-only roles and cross-Wedding Household IDs away from writes", async () => {
    for (const role of ["DAY_OF_COORDINATOR", "GUEST_COORDINATOR"] as const) {
      await expect(saveWebsite(member(role), draft, false)).rejects.toThrow();
      await expect(setWebsitePublication(member(role), true)).rejects.toThrow();
      await expect(issueHouseholdAccess(member(role), householdId)).rejects.toThrow();
      await expect(revokeHouseholdAccess(member(role), householdId)).rejects.toThrow();
    }
    await expect(issueHouseholdAccess(member(), otherId)).rejects.toThrow(/selected Wedding/);
    expect(writes()).toHaveLength(0); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
