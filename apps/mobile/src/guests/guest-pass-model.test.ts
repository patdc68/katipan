import { describe, expect, it } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import {
  canManageGuestPass,
  guestPassActionState,
  isRevokedGuestPassError,
  parseGuestPassPayload,
  safeGuestPassError,
  type GuestPass,
} from "./model";

const guestId = "30000000-0000-4000-8000-000000000001";
const pass: GuestPass = {
  id: "50000000-0000-4000-8000-000000000001",
  guestId,
  reference: "K1234-ABCD",
  qrPayload: "a".repeat(64),
  issuedAt: "2026-09-28T08:30:00.000Z",
  revokedAt: null,
};

function membership(role: WorkspaceMembership["role"], status: WorkspaceMembership["status"] = "ACTIVE"): WorkspaceMembership {
  return {
    membershipId: "60000000-0000-4000-8000-000000000001",
    weddingId: "10000000-0000-4000-8000-000000000001",
    userId: "70000000-0000-4000-8000-000000000001",
    role,
    status,
    wedding: {
      id: "10000000-0000-4000-8000-000000000001",
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

describe("Guest Pass permissions and safe presentation state", () => {
  it("allows only active Owners and Full Coordinators to see management actions", () => {
    expect(canManageGuestPass(membership("OWNER"))).toBe(true);
    expect(canManageGuestPass(membership("FULL_COORDINATOR"))).toBe(true);
    expect(canManageGuestPass(membership("GUEST_COORDINATOR"))).toBe(false);
    expect(canManageGuestPass(membership("DAY_OF_COORDINATOR"))).toBe(false);
    expect(canManageGuestPass(membership("OWNER", "LEFT"))).toBe(false);
    const mismatched = { ...membership("OWNER"), weddingId: "10000000-0000-4000-8000-000000000002" };
    expect(canManageGuestPass(mismatched)).toBe(false);
  });

  it.each(["NO_RESPONSE", "DECLINED"] as const)("keeps %s separate from Guest Pass issue and rotation", (status) => {
    expect(guestPassActionState(status, null, false)).toEqual({
      primaryAction: null,
      canPreview: false,
      canRevoke: false,
      canReplace: false,
    });
    expect(guestPassActionState(status, pass, true)).toEqual({
      primaryAction: null,
      canPreview: false,
      canRevoke: true,
      canReplace: false,
    });
  });

  it("offers Issue for an attending Guest without a pass and explicit Rotate after a revoked pass", () => {
    expect(guestPassActionState("ATTENDING", null, false).primaryAction).toBe("ISSUE");
    expect(guestPassActionState("ATTENDING", null, true).primaryAction).toBe("ROTATE");
  });

  it("offers preview, revoke, and explicit replacement for an active attending pass", () => {
    expect(guestPassActionState("ATTENDING", pass, false)).toEqual({
      primaryAction: null,
      canPreview: true,
      canRevoke: true,
      canReplace: true,
    });
  });

  it("accepts only the pass contract for the expected Guest and never returns a raw error", () => {
    expect(parseGuestPassPayload(pass, guestId)).toEqual(pass);
    expect(() => parseGuestPassPayload({ ...pass, guestId: "30000000-0000-4000-8000-000000000002" }, guestId))
      .toThrow("Guest Pass response unavailable.");
    expect(() => parseGuestPassPayload({ ...pass, qrPayload: "personal data" }, guestId))
      .toThrow("Guest Pass response unavailable.");
  });

  it("maps permission, eligibility, revoked, and missing-history errors without exposing backend text", () => {
    const revoked = { code: "23514", message: "A revoked Pass requires explicit rotation" };
    expect(isRevokedGuestPassError(revoked)).toBe(true);
    expect(safeGuestPassError(revoked)).toContain("Rotate it explicitly");
    expect(safeGuestPassError({ code: "42501", message: "private database detail" })).toContain("isn't available");
    expect(safeGuestPassError({ code: "23514", message: "Only an ATTENDING Guest may receive a Pass" })).toContain("RSVP remains unchanged");
    expect(safeGuestPassError({ code: "23514", message: "No prior Pass exists to rotate" })).toContain("Issue a new Guest Pass");
    expect(safeGuestPassError({ code: "XX000", message: "secret backend detail" })).not.toContain("secret backend detail");
  });
});
