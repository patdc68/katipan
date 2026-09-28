import { beforeEach, describe, expect, it, vi } from "vitest";
import { acceptCoordinatorInvitation, acceptInvitation, acceptWeddingInvitation } from "./api";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../auth/client", () => ({ supabase: { rpc } }));

describe("partner invitation acceptance boundary", () => {
  beforeEach(() => rpc.mockReset());

  it("accepts the existing Wedding and person through the existing RPC only", async () => {
    const token = "a".repeat(64);
    rpc.mockResolvedValue({ data: [{
      invitation_id: "invite-1",
      wedding_id: "wedding-1",
      person_id: "person-2",
      membership_id: "membership-2",
      ownership_transitioned: true,
      already_accepted: false,
    }], error: null });

    await expect(acceptWeddingInvitation(token)).resolves.toMatchObject({
      wedding_id: "wedding-1",
      person_id: "person-2",
      ownership_transitioned: true,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("accept_wedding_invitation", { p_raw_token: token });
    expect(rpc).not.toHaveBeenCalledWith("create_couple_wedding", expect.anything());
    expect(rpc).not.toHaveBeenCalledWith("create_coordinator_managed_wedding", expect.anything());
    expect(rpc).not.toHaveBeenCalledWith("create_guest", expect.anything());
  });

  it("returns idempotent acceptance from the backend without re-creating records", async () => {
    const token = "b".repeat(64);
    rpc.mockResolvedValue({ data: [{
      invitation_id: "invite-1", wedding_id: "wedding-1", person_id: "person-2",
      membership_id: "membership-2", ownership_transitioned: false, already_accepted: true,
    }], error: null });

    await expect(acceptWeddingInvitation(token)).resolves.toMatchObject({ already_accepted: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("accept_wedding_invitation", { p_raw_token: token });
  });

  it("rejects malformed raw tokens before any RPC and never writes them to client storage", async () => {
    await expect(acceptWeddingInvitation("not-a-token")).rejects.toThrow("Invalid invitation link.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not expose backend error details from the client API", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "private invitation detail" } });
    await expect(acceptWeddingInvitation("c".repeat(64))).rejects.toMatchObject({
      name: "WeddingInvitationAcceptanceError",
      code: "22023",
      message: "Invitation acceptance failed.",
    });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("dispatches a Coordinator invitation through the existing coordinator acceptance RPC", async () => {
    const token = "d".repeat(64);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "Invitation cannot be accepted." } });
    rpc.mockResolvedValueOnce({ data: [{
      invitation_id: "invite-coordinator",
      wedding_id: "wedding-2",
      membership_id: "membership-coordinator",
      membership_role: "DAY_OF_COORDINATOR",
    }], error: null });

    await expect(acceptInvitation(token)).resolves.toEqual({
      kind: "COORDINATOR",
      invitation: {
        invitation_id: "invite-coordinator",
        wedding_id: "wedding-2",
        membership_id: "membership-coordinator",
        membership_role: "DAY_OF_COORDINATOR",
      },
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "accept_wedding_invitation", { p_raw_token: token });
    expect(rpc).toHaveBeenNthCalledWith(2, "accept_coordinator_invitation", { p_raw_token: token });
  });

  it("stops dispatch after partner acceptance succeeds", async () => {
    const token = "e".repeat(64);
    rpc.mockResolvedValueOnce({ data: [{
      invitation_id: "invite-partner", wedding_id: "wedding-1", person_id: "partner-person",
      membership_id: "owner-membership", ownership_transitioned: true, already_accepted: false,
    }], error: null });

    await expect(acceptInvitation(token)).resolves.toMatchObject({
      kind: "PARTNER_OWNER",
      invitation: { ownership_transitioned: true, person_id: "partner-person" },
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).not.toHaveBeenCalledWith("accept_coordinator_invitation", expect.anything());
  });

  it("does not try the second acceptance RPC after authentication or transport errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Authentication is required." } });
    await expect(acceptInvitation("f".repeat(64))).rejects.toMatchObject({ code: "42501" });
    expect(rpc).toHaveBeenCalledOnce();

    rpc.mockReset();
    rpc.mockRejectedValueOnce(new TypeError("network unavailable"));
    await expect(acceptInvitation("0".repeat(64))).rejects.toThrow("network unavailable");
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("supports direct coordinator acceptance and keeps backend details out of errors", async () => {
    const token = "1".repeat(64);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "private token detail" } });
    await expect(acceptCoordinatorInvitation(token)).rejects.toMatchObject({
      name: "WeddingInvitationAcceptanceError",
      code: "22023",
      message: "Invitation acceptance failed.",
    });
    expect(rpc).toHaveBeenCalledWith("accept_coordinator_invitation", { p_raw_token: token });
  });
});
