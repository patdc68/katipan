import { beforeEach, describe, expect, it, vi } from "vitest";
import { acceptWeddingInvitation } from "./api";

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
});
