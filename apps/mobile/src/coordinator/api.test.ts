import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClientWedding, issueCoordinatorInvitation, issuePartnerOwnerInvitation, changeCoordinatorRole, leaveWedding, promoteWeddingMemberToOwner, removeWeddingMember, revokeWeddingInvitation } from "./api";
import { emptyClientWeddingDraft, type WeddingRole } from "./model";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../auth/client", () => ({ supabase: { rpc } }));

describe("coordinator Wedding RPC boundaries", () => {
  beforeEach(() => rpc.mockReset());

  it("creates the existing coordinator-managed Wedding contract with two Partner Person names", async () => {
    const draft = {
      ...emptyClientWeddingDraft,
      weddingDisplayName: "Juan & Maria’s Wedding",
      partner1DisplayName: "Juan",
      partner2DisplayName: "Maria",
      ceremonyStyle: "CIVIL" as const,
    };
    rpc.mockResolvedValue({ data: [{
      wedding_id: "wedding-1",
      partner_1_person_id: "person-juan",
      partner_2_person_id: "person-maria",
    }], error: null });

    await expect(createClientWedding(draft)).resolves.toEqual({
      wedding_id: "wedding-1",
      partner_1_person_id: "person-juan",
      partner_2_person_id: "person-maria",
    });
    expect(rpc).toHaveBeenCalledWith("create_coordinator_managed_wedding", {
      p_wedding_display_name: "Juan & Maria’s Wedding",
      p_partner_1_display_name: "Juan",
      p_partner_2_display_name: "Maria",
      p_wedding_date: undefined,
      p_timezone: undefined,
      p_general_location: undefined,
      p_estimated_guest_count: undefined,
      p_ceremony_style: "CIVIL",
    });
    expect(rpc).not.toHaveBeenCalledWith("create_couple_wedding", expect.anything());
  });

  it("does not call the backend when required client Wedding names are missing", async () => {
    await expect(createClientWedding(emptyClientWeddingDraft)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("issues Partner invitations for a selected existing Partner Person only", async () => {
    const token = "2".repeat(64);
    rpc.mockResolvedValue({ data: [{ invitation_id: "invite-partner", raw_token: token, invitation_expires_at: "2026-10-05T00:00:00Z" }], error: null });
    await expect(issuePartnerOwnerInvitation("wedding-1", "existing-person-2", " maria@example.com ")).resolves.toMatchObject({ raw_token: token });
    expect(rpc).toHaveBeenCalledWith("issue_partner_owner_invitation", {
      p_wedding_id: "wedding-1",
      p_target_person_id: "existing-person-2",
      p_invited_email: "maria@example.com",
    });
    expect(rpc).not.toHaveBeenCalledWith("create_wedding_person", expect.anything());
  });

  it("issues each allowed Coordinator invitation role and rejects OWNER before RPC", async () => {
    rpc.mockResolvedValue({ data: [{ invitation_id: "invite-team", raw_token: "3".repeat(64), invitation_expires_at: "2026-10-05T00:00:00Z" }], error: null });
    for (const role of ["FULL_COORDINATOR", "DAY_OF_COORDINATOR", "GUEST_COORDINATOR"] as const) {
      await issueCoordinatorInvitation("wedding-1", role, " team@example.com ");
      expect(rpc).toHaveBeenLastCalledWith("issue_coordinator_invitation", {
        p_wedding_id: "wedding-1",
        p_intended_role: role,
        p_invited_email: "team@example.com",
      });
    }
    rpc.mockClear();
    await expect(issueCoordinatorInvitation("wedding-1", "OWNER" as WeddingRole, "")).rejects.toMatchObject({ code: "22023" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses distinct dedicated role, promotion, remove, leave, and revoke contracts", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await changeCoordinatorRole("wedding-1", "member-2", "DAY_OF_COORDINATOR");
    await promoteWeddingMemberToOwner("wedding-1", "member-3");
    await removeWeddingMember("wedding-1", "member-4");
    await leaveWedding("wedding-1");
    await revokeWeddingInvitation("invite-5");
    expect(rpc).toHaveBeenNthCalledWith(1, "change_coordinator_role", {
      p_wedding_id: "wedding-1", p_target_membership_id: "member-2", p_new_role: "DAY_OF_COORDINATOR",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "promote_wedding_member_to_owner", {
      p_wedding_id: "wedding-1", p_target_membership_id: "member-3",
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "remove_wedding_member", {
      p_wedding_id: "wedding-1", p_target_membership_id: "member-4",
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "leave_wedding", { p_wedding_id: "wedding-1" });
    expect(rpc).toHaveBeenNthCalledWith(5, "revoke_wedding_invitation", { p_invitation_id: "invite-5" });
  });

  it("does not use coordinator role change to promote or demote an Owner", async () => {
    await expect(changeCoordinatorRole("wedding-1", "owner-2", "OWNER" as WeddingRole)).rejects.toMatchObject({ code: "22023" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
