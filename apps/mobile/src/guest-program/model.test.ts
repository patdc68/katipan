import { describe, expect, it } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import { canManageProgram, guestVisibleProgram, orderedProgram, programDraftSchema, SubmitGate, type ProgramItem } from "./model";

const weddingId = "10000000-0000-4000-8000-000000000001";
function membership(role: WorkspaceMembership["role"]): WorkspaceMembership {
  return { membershipId: "20000000-0000-4000-8000-000000000001", userId: "30000000-0000-4000-8000-000000000001",
    weddingId, role, status: "ACTIVE", partnerNames: ["Juan", "Maria"], wedding: { id: weddingId,
      display_name: "Juan & Maria", wedding_date: null, general_location: null, status: "ACTIVE",
      origin: "COUPLE_CREATED", ownership_mode: "COUPLE_OWNED" } };
}
const draft = { title: "Ceremony", description: "", scheduledStart: "2027-01-01T15:00:00+08:00",
  scheduledEnd: null, placeId: null, operationalItemId: null, sortOrder: 0 };
describe("Guest Program domain", () => {
  it("permits Owner and Full Coordinator management and keeps other roles read-only", () => {
    expect(canManageProgram(membership("OWNER"))).toBe(true);
    expect(canManageProgram(membership("FULL_COORDINATOR"))).toBe(true);
    expect(canManageProgram(membership("DAY_OF_COORDINATOR"))).toBe(false);
    expect(canManageProgram(membership("GUEST_COORDINATOR"))).toBe(false);
    expect(canManageProgram({ ...membership("OWNER"), weddingId: "other" })).toBe(false);
  });
  it("requires title, start, ordered end, and nonnegative order", () => {
    expect(programDraftSchema.safeParse(draft).success).toBe(true);
    for (const value of [{ ...draft, title: " " }, { ...draft, scheduledStart: "" },
      { ...draft, scheduledEnd: "2027-01-01T06:00:00Z" }, { ...draft, sortOrder: -1 }])
      expect(programDraftSchema.safeParse(value).success).toBe(false);
  });
  it("orders list entries while the guest projection includes only published entries", () => {
    const published = { id: "b", sort_order: 1, scheduled_start: "2027-01-01T08:00:00Z", is_published: true } as ProgramItem;
    const draftItem = { id: "a", sort_order: 0, scheduled_start: "2027-01-01T07:00:00Z", is_published: false } as ProgramItem;
    const source = [published, draftItem];
    expect(orderedProgram(source)).toEqual([draftItem, published]);
    expect(guestVisibleProgram(source)).toEqual([published]);
    expect(source).toEqual([published, draftItem]);
  });
  it("prevents duplicate submissions", async () => {
    const gate = new SubmitGate(); let release: (() => void) | undefined; let count = 0;
    const first = gate.run(async () => { count++; await new Promise<void>(resolve => { release = resolve; }); return 1; });
    expect(await gate.run(async () => { count++; return 2; })).toBeUndefined();
    release?.(); expect(await first).toBe(1); expect(count).toBe(1);
  });
});
