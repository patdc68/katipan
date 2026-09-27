import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDraft } from "./model";
import { createCoupleWedding, issuePartnerInvitation, partnerInvitationLink } from "./api";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../auth/client", () => ({ supabase: { rpc } }));

describe("onboarding RPC boundaries", () => {
  beforeEach(() => rpc.mockReset());
  it("carries Wedding and existing Partner IDs from successful creation", async () => {
    rpc.mockResolvedValue({ data: [{ wedding_id: "w-1", current_person_id: "p-1", second_partner_person_id: "p-2", membership_id: "m-1" }], error: null });
    const created = await createCoupleWedding({ ...emptyDraft, weddingName: "Our Day", currentName: "Pat", partnerName: "Anna" });
    expect(created).toEqual({ weddingId: "w-1", currentPersonId: "p-1", secondPartnerPersonId: "p-2" });
    expect(rpc).toHaveBeenCalledWith("create_couple_wedding", expect.objectContaining({ p_second_partner_display_name: "Anna" }));
  });
  it("surfaces a creation error without creating local IDs", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("network") });
    await expect(createCoupleWedding({ ...emptyDraft, weddingName: "Our Day", currentName: "Pat" })).rejects.toThrow("network");
  });
  it("targets the existing second Partner and keeps the token transient", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const token = "a".repeat(64);
    rpc.mockResolvedValue({ data: [{ invitation_id: "i-1", raw_token: token, invitation_expires_at: "2026-10-04" }], error: null });
    const result = await issuePartnerInvitation({ weddingId: "w-1", currentPersonId: "p-1", secondPartnerPersonId: "p-2" }, " ANNA@example.com ");
    expect(rpc).toHaveBeenCalledWith("issue_partner_owner_invitation", { p_wedding_id: "w-1", p_target_person_id: "p-2", p_invited_email: "anna@example.com" });
    expect(partnerInvitationLink(result.raw_token)).toBe(`katipan:///accept-invitation?token=${token}`);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("does not issue when there is no second Partner", async () => {
    await expect(issuePartnerInvitation({ weddingId: "w-1", currentPersonId: "p-1", secondPartnerPersonId: null }, "a@example.com")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
