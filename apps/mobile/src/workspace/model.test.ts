import { describe, expect, it } from "vitest";
import {
  destinationAfterRestore,
  findActiveMembership,
  isCurrentWeddingWorkspace,
  nextWorkspaceCacheRevision,
  resolveRestoredSelection,
  roleLabel,
  safeInvitationFailure,
  weddingHomePath,
  type WorkspaceMembership,
} from "./model";

function membership(weddingId: string, role: WorkspaceMembership["role"], status: WorkspaceMembership["status"] = "ACTIVE"): WorkspaceMembership {
  return {
      membershipId: `m-${weddingId}`,
    weddingId,
    userId: "user-1",
    role,
    status,
    partnerNames: [],
      wedding: {
        id: weddingId,
        created_by_user_id: role === "FULL_COORDINATOR" ? "user-1" : "user-2",
      display_name: null,
      wedding_date: null,
      general_location: null,
      status: "DRAFT",
      origin: "COUPLE_CREATED",
      ownership_mode: "COUPLE_OWNED",
    },
  };
}

describe("workspace restoration and membership scope", () => {
  it("routes zero, one, and multiple active Wedding memberships", () => {
    expect(destinationAfterRestore(false, [])).toBe("welcome");
    expect(destinationAfterRestore(true, [])).toBe("create-wedding");
    expect(destinationAfterRestore(true, [membership("w-1", "OWNER")])).toBe("home");
    expect(destinationAfterRestore(true, [
      membership("w-1", "OWNER"), membership("w-2", "FULL_COORDINATOR"),
    ])).toBe("weddings");
    expect(destinationAfterRestore(true, [membership("w-old", "OWNER", "LEFT")])).toBe("create-wedding");
    expect(destinationAfterRestore(false, [membership("w-cached", "OWNER")])).toBe("welcome");
  });

  it("includes Owner and every coordinator role without making an account type", () => {
    const roles: WorkspaceMembership["role"][] = ["OWNER", "FULL_COORDINATOR", "DAY_OF_COORDINATOR", "GUEST_COORDINATOR"];
    const memberships = roles.map((role, index) => membership(`w-${index}`, role));
    expect(destinationAfterRestore(true, memberships)).toBe("weddings");
    expect(memberships.map((item) => roleLabel(item.role))).toEqual([
      "Owner", "Full Coordinator", "Day-of Coordinator", "Guest Coordinator",
    ]);
  });

  it("restores only a Wedding that is still in the active membership set", () => {
    const active = membership("w-active", "DAY_OF_COORDINATOR");
    const ended = membership("w-ended", "OWNER", "REMOVED");
    expect(resolveRestoredSelection("w-active", [active, ended])).toBe("w-active");
    expect(resolveRestoredSelection("w-ended", [active, ended])).toBe("w-active");
    expect(findActiveMembership([active, ended], "w-ended")).toBe(null);
    expect(resolveRestoredSelection(null, [active])).toBe("w-active");
  });

  it("requires an explicit choice when multiple memberships remain", () => {
    const memberships = [membership("w-1", "OWNER"), membership("w-2", "GUEST_COORDINATOR")];
    expect(resolveRestoredSelection("w-removed", memberships)).toBe(null);
    expect(resolveRestoredSelection("w-2", memberships)).toBe("w-2");
    expect(findActiveMembership(memberships, "w-unrelated")).toBe(null);
  });

  it("prevents a Wedding route from using a different selected or active membership", () => {
    const owner = membership("w-1", "OWNER");
    expect(isCurrentWeddingWorkspace(owner, "w-1", "w-1")).toBe(true);
    expect(isCurrentWeddingWorkspace(owner, "w-2", "w-1")).toBe(false);
    expect(isCurrentWeddingWorkspace(owner, "w-2", "w-2")).toBe(false);
    expect(isCurrentWeddingWorkspace(null, "w-1", "w-1")).toBe(false);
  });

  it("clears Wedding-specific cache state when switching contexts", () => {
    expect(nextWorkspaceCacheRevision(4, "w-1", "w-2")).toBe(5);
    expect(nextWorkspaceCacheRevision(4, "w-1", "w-1")).toBe(4);
  });
});

describe("invitation and post-onboarding routes", () => {
  it("uses one safe error for invalid, revoked, expired, and already-used links", () => {
    const failures = ["invalid", "revoked", "expired", "already used"];
    const safeMessages = failures.map((reason) => safeInvitationFailure({ code: "22023", message: reason }));
    expect(new Set(safeMessages).size).toBe(1);
    expect(safeMessages[0]).toContain("invalid, expired, revoked, or already used");
    expect(safeInvitationFailure({ code: "42501" })).toContain("reopen the invitation link");
  });

  it("opens the existing Wedding workspace after invitation or onboarding", () => {
    expect(weddingHomePath("wedding-1")).toBe("/(wedding)/wedding-1/home");
  });
});
