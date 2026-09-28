import { describe, expect, it } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import { audiences, canManageWebsite, orderedSections, safeWebsiteError, sectionDraftSchema, siteDraftSchema,
  slugSchema, standardSections, SubmitGate, templates, type WebsiteSection } from "./model";

const weddingId = "10000000-0000-4000-8000-000000000001";
function member(role: WorkspaceMembership["role"]): WorkspaceMembership {
  return { membershipId: "20000000-0000-4000-8000-000000000001", userId: "30000000-0000-4000-8000-000000000001",
    weddingId, role, status: "ACTIVE", partnerNames: ["Juan", "Maria"], wedding: { id: weddingId,
      display_name: "Juan & Maria", wedding_date: null, general_location: null, status: "ACTIVE", origin: "COUPLE_CREATED", ownership_mode: "COUPLE_OWNED" } };
}
describe("Wedding website model", () => {
  it("keeps Owner and Full Coordinator management distinct from read-only roles", () => {
    expect(canManageWebsite(member("OWNER"))).toBe(true);
    expect(canManageWebsite(member("FULL_COORDINATOR"))).toBe(true);
    expect(canManageWebsite(member("DAY_OF_COORDINATOR"))).toBe(false);
    expect(canManageWebsite(member("GUEST_COORDINATOR"))).toBe(false);
    expect(canManageWebsite({ ...member("OWNER"), weddingId: "other" })).toBe(false);
  });
  it("accepts exactly five persisted templates and both access modes", () => {
    expect(templates.map(value => value.key)).toEqual(["SAMPAGUITA", "LUNTIAN", "FILIPINIANA", "MODERN_LOVE", "AFTER_DARK"]);
    for (const template of templates) for (const access_mode of ["ANYONE_WITH_LINK", "INVITED_GUESTS_ONLY"])
      expect(siteDraftSchema.safeParse({ slug: "juan-maria", title: "Juan & Maria", introduction: "Welcome", template_key: template.key, access_mode }).success).toBe(true);
    expect(siteDraftSchema.safeParse({ slug: "juan-maria", title: "", introduction: "", template_key: "NEW_TEMPLATE", access_mode: "ANYONE_WITH_LINK" }).success).toBe(false);
  });
  it("enforces the backend slug shape and maps collisions without exposing database details", () => {
    for (const slug of ["abc", "juan-maria", "a".repeat(80), "123"]) expect(slugSchema.safeParse(slug).success).toBe(true);
    for (const slug of ["ab", "Aaa", "a--b", "-abc", "abc-", "a_b", "a".repeat(81)]) expect(slugSchema.safeParse(slug).success).toBe(false);
    expect(safeWebsiteError({ code: "23505", details: "private database detail" })).toMatch(/already in use/);
  });
  it("keeps section types, audiences, enabled state and sort ordering explicit", () => {
    expect(standardSections.map(value => value.type)).toEqual(["INTRO", "PLACES", "DRESS_CODE", "RSVP"]);
    expect(audiences).toEqual(["PUBLIC", "INVITED", "PERSONALIZED", "HIDDEN"]);
    for (const audience of audiences) expect(sectionDraftSchema.safeParse({ audience, enabled: false, content: "" }).success).toBe(true);
    const first = { id: "a", sort_order: 2 } as WebsiteSection;
    const second = { id: "b", sort_order: 0 } as WebsiteSection;
    expect(orderedSections([first, second])).toEqual([second, first]);
  });
  it("prevents duplicate submits", async () => {
    const gate = new SubmitGate(); let finish: (() => void) | undefined; let count = 0;
    const first = gate.run(async () => { count++; await new Promise<void>(resolve => { finish = resolve; }); });
    expect(await gate.run(async () => { count++; })).toBeUndefined();
    finish?.(); await first; expect(count).toBe(1);
  });
});
