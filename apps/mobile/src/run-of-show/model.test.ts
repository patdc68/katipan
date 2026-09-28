import { describe, expect, it } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import { canManageRun, canReviewGuestProgram, orderedRunItems, runDraftSchema, SubmitGate, type RunItem } from "./model";

const weddingId = "10000000-0000-4000-8000-000000000001";
function membership(role: WorkspaceMembership["role"]): WorkspaceMembership {
  return { membershipId: "20000000-0000-4000-8000-000000000001", userId: "30000000-0000-4000-8000-000000000001",
    weddingId, role, status: "ACTIVE", partnerNames: ["Juan", "Maria"], wedding: { id: weddingId,
      display_name: "Juan & Maria", wedding_date: null, general_location: null, status: "ACTIVE",
      origin: "COUPLE_CREATED", ownership_mode: "COUPLE_OWNED" } };
}
const draft = { title: "Ceremony", description: "", scheduledStart: "2027-01-01T15:00:00+08:00",
  scheduledEnd: "2027-01-01T16:00:00+08:00", actualStart: null, actualEnd: null, sortOrder: 0, placeId: null };
describe("Run of Show domain", () => {
  it("limits operational and publication controls to their respective roles", () => {
    for (const role of ["OWNER", "FULL_COORDINATOR", "DAY_OF_COORDINATOR"] as const) expect(canManageRun(membership(role))).toBe(true);
    expect(canManageRun(membership("GUEST_COORDINATOR"))).toBe(false);
    for (const role of ["OWNER", "FULL_COORDINATOR"] as const) expect(canReviewGuestProgram(membership(role))).toBe(true);
    expect(canReviewGuestProgram(membership("DAY_OF_COORDINATOR"))).toBe(false);
    expect(canReviewGuestProgram(membership("GUEST_COORDINATOR"))).toBe(false);
  });
  it("validates title, timestamps, order, and actual timing", () => {
    expect(runDraftSchema.safeParse(draft).success).toBe(true);
    expect(runDraftSchema.safeParse({ ...draft, title: "  " }).success).toBe(false);
    expect(runDraftSchema.safeParse({ ...draft, scheduledStart: "" }).success).toBe(false);
    expect(runDraftSchema.safeParse({ ...draft, scheduledEnd: "2027-01-01T14:00:00+08:00" }).success).toBe(false);
    expect(runDraftSchema.safeParse({ ...draft, actualEnd: draft.scheduledEnd }).success).toBe(false);
    expect(runDraftSchema.safeParse({ ...draft, actualStart: draft.scheduledEnd, actualEnd: draft.scheduledStart }).success).toBe(false);
    expect(runDraftSchema.safeParse({ ...draft, sortOrder: -1 }).success).toBe(false);
  });
  it("orders operational items by time without changing source records", () => {
    const later = { id: "b", scheduled_start: "2027-01-01T11:00:00Z", sort_order: 0 } as RunItem;
    const earlier = { id: "a", scheduled_start: "2027-01-01T10:00:00Z", sort_order: 0 } as RunItem;
    const source = [later, earlier];
    expect(orderedRunItems(source)).toEqual([earlier, later]);
    expect(source).toEqual([later, earlier]);
  });
  it("prevents duplicate submits until the first finishes", async () => {
    const gate = new SubmitGate(); let release: (() => void) | undefined; let count = 0;
    const first = gate.run(async () => { count++; await new Promise<void>(resolve => { release = resolve; }); return 1; });
    expect(await gate.run(async () => { count++; return 2; })).toBeUndefined();
    release?.(); expect(await first).toBe(1); expect(count).toBe(1);
  });
});
