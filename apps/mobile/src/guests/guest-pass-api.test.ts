import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import { getGuestPass, issueGuestPass, revokeGuestPass, rotateGuestPass } from "./guest-pass-api";

type Filter = { column: string; value: string };
const { from, rpc, filters } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  filters: [] as Filter[],
}));

vi.mock("../auth/client", () => ({ supabase: { from, rpc } }));

const weddingId = "10000000-0000-4000-8000-000000000001";
const foreignWeddingId = "10000000-0000-4000-8000-000000000002";
const guestId = "30000000-0000-4000-8000-000000000001";
const foreignGuestId = "30000000-0000-4000-8000-000000000002";
const pass = {
  id: "50000000-0000-4000-8000-000000000001",
  guestId,
  reference: "K1234-ABCD",
  qrPayload: "a".repeat(64),
  issuedAt: "2026-09-28T08:30:00.000Z",
  revokedAt: null,
};

function membership(role: WorkspaceMembership["role"] = "OWNER", wedding = weddingId): WorkspaceMembership {
  return {
    membershipId: "60000000-0000-4000-8000-000000000001",
    weddingId: wedding,
    userId: "70000000-0000-4000-8000-000000000001",
    role,
    status: "ACTIVE",
    wedding: {
      id: wedding,
      display_name: "Juan & Maria",
      wedding_date: null,
      general_location: null,
      status: "ACTIVE",
      origin: "COUPLE_CREATED",
      ownership_mode: "COUPLE_OWNED",
    },
    partnerNames: [],
  };
}

beforeEach(() => {
  filters.length = 0;
  from.mockClear();
  from.mockImplementation(() => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: string) => {
        filters.push({ column, value });
        return query;
      }),
      maybeSingle: vi.fn(async () => ({
        data: filters.some((filter) => filter.value === foreignGuestId || filter.value === foreignWeddingId)
          ? null
          : { id: guestId, wedding_id: weddingId },
        error: null,
      })),
    };
    return query;
  });
  rpc.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe("Guest Pass management RPC boundary", () => {
  it("reads an active Pass through get_guest_pass and returns the same QR payload in memory", async () => {
    rpc.mockResolvedValue({ data: pass, error: null });
    await expect(getGuestPass(membership(), guestId)).resolves.toEqual(pass);
    expect(from).toHaveBeenCalledWith("guests");
    expect(filters).toContainEqual({ column: "wedding_id", value: weddingId });
    expect(rpc).toHaveBeenCalledWith("get_guest_pass", { p_guest_id: guestId });
  });

  it("issues an eligible Guest Pass and repeated issue calls return the same active record", async () => {
    rpc.mockResolvedValue({ data: pass, error: null });
    const first = await issueGuestPass(membership(), guestId);
    const second = await issueGuestPass(membership(), guestId);
    expect(first).toEqual(second);
    expect(rpc).toHaveBeenNthCalledWith(1, "issue_guest_pass", { p_guest_id: guestId });
    expect(rpc).toHaveBeenNthCalledWith(2, "issue_guest_pass", { p_guest_id: guestId });
  });

  it("uses the dedicated revoke and rotate RPCs", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: pass, error: null });
    await expect(revokeGuestPass(membership(), guestId)).resolves.toBe(true);
    await expect(rotateGuestPass(membership(), guestId)).resolves.toEqual(pass);
    expect(rpc).toHaveBeenNthCalledWith(1, "revoke_guest_pass", { p_guest_id: guestId });
    expect(rpc).toHaveBeenNthCalledWith(2, "rotate_guest_pass", { p_guest_id: guestId });
  });

  it.each(["GUEST_COORDINATOR", "DAY_OF_COORDINATOR"] as const)("blocks %s before any pass RPC", async (role) => {
    await expect(getGuestPass(membership(role), guestId)).rejects.toMatchObject({ code: "42501" });
    await expect(issueGuestPass(membership(role), guestId)).rejects.toMatchObject({ code: "42501" });
    await expect(revokeGuestPass(membership(role), guestId)).rejects.toMatchObject({ code: "42501" });
    await expect(rotateGuestPass(membership(role), guestId)).rejects.toMatchObject({ code: "42501" });
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a Guest from another Wedding before querying a Pass RPC", async () => {
    await expect(getGuestPass(membership(), foreignGuestId)).rejects.toMatchObject({ code: "22023" });
    expect(filters).toContainEqual({ column: "id", value: foreignGuestId });
    expect(filters).toContainEqual({ column: "wedding_id", value: weddingId });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not log or persist the opaque payload during pass management calls", async () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    rpc.mockResolvedValue({ data: pass, error: null });

    await getGuestPass(membership(), guestId);
    await issueGuestPass(membership(), guestId);
    await rotateGuestPass(membership(), guestId);

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
  });
});
