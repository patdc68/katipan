import { describe, expect, it } from "vitest";
import {
  AccountScopedWeddingSelection,
  authenticatedRootRoute,
  destinationAfterRestore,
  findActiveMembership,
  isCoupleHomeRoot,
  isCurrentWeddingWorkspace,
  nextWorkspaceCacheRevision,
  noWeddingRoutes,
  planWorkspaceRestoration,
  rootStackHistoryKey,
  resolveRestoredSelection,
  roleLabel,
  safeInvitationFailure,
  selectedWeddingStorageKey,
  workspaceMembershipsForAccount,
  workspaceRestorationStatus,
  workspaceSelectionForAccount,
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
    expect(destinationAfterRestore(true, [])).toBe("weddings");
    expect(destinationAfterRestore(true, [membership("w-1", "OWNER")])).toBe("home");
    expect(destinationAfterRestore(true, [
      membership("w-1", "OWNER"), membership("w-2", "FULL_COORDINATOR"),
    ])).toBe("weddings");
    expect(destinationAfterRestore(true, [membership("w-old", "OWNER", "LEFT")])).toBe("weddings");
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
    expect(nextWorkspaceCacheRevision(4, "w-1", null)).toBe(5);
  });
});

describe("R1 core workspace state transitions", () => {
  const owner = membership("w-a", "OWNER");

  it("1. resolves a signed-out launch without exposing cached Wedding state", () => {
    const snapshot = { accountId: null, phase: "ready" as const, memberships: [owner], selectedWeddingId: "w-a", membershipLost: false };
    expect(workspaceRestorationStatus({ accessLoading: false, accessError: null, accountId: null, snapshot })).toBe("SIGNED_OUT");
    expect(workspaceMembershipsForAccount(snapshot, null)).toEqual([]);
    expect(workspaceSelectionForAccount(snapshot, null)).toBe(null);
  });

  it("2. keeps an authenticated cold start loading until membership resolution", () => {
    const loading = { accountId: "user-1", phase: "loading" as const, memberships: [], selectedWeddingId: null, membershipLost: false };
    expect(workspaceRestorationStatus({ accessLoading: false, accessError: null, accountId: "user-1", snapshot: loading })).toBe("AUTHENTICATED_WORKSPACE_LOADING");
    const ready = { ...loading, phase: "ready" as const, memberships: [owner], selectedWeddingId: "w-a" };
    expect(workspaceRestorationStatus({ accessLoading: false, accessError: null, accountId: "user-1", snapshot: ready })).toBe("AUTHENTICATED_WEDDING_READY");
  });

  it("3. uses a loading state while an authenticated resume revalidates memberships", () => {
    const ready = { accountId: "user-1", phase: "ready" as const, memberships: [owner], selectedWeddingId: "w-a", membershipLost: false };
    const resuming = { ...ready, phase: "loading" as const };
    expect(workspaceRestorationStatus({ accessLoading: false, accessError: null, accountId: "user-1", snapshot: resuming })).toBe("AUTHENTICATED_WORKSPACE_LOADING");
    expect(workspaceRestorationStatus({ accessLoading: false, accessError: null, accountId: "user-1", snapshot: ready })).toBe("AUTHENTICATED_WEDDING_READY");
  });

  it("4. distinguishes an authenticated account with no Weddings from an error", () => {
    const empty = { accountId: "user-1", phase: "ready" as const, memberships: [], selectedWeddingId: null, membershipLost: false };
    expect(workspaceRestorationStatus({ accessLoading: false, accessError: null, accountId: "user-1", snapshot: empty })).toBe("AUTHENTICATED_NO_WEDDINGS");
    expect(destinationAfterRestore(true, [])).toBe("weddings");
    expect(noWeddingRoutes).toEqual({
      coupleCreation: "/(access)/create-wedding",
      coordinatorCreation: "/(coordinator)/onboarding",
      invitationAcceptance: "/accept-invitation",
    });
  });

  it("5. restores a saved Wedding only from the authoritative membership set", () => {
    expect(planWorkspaceRestoration({ accountChanged: false, memberships: [owner], savedWeddingId: "w-a", previousWeddingId: null })).toEqual({ selectedWeddingId: "w-a", membershipLost: false });
  });

  it("6. falls back deterministically when a saved Wedding is no longer accessible", () => {
    const remaining = membership("w-b", "DAY_OF_COORDINATOR");
    expect(planWorkspaceRestoration({ accountChanged: false, memberships: [remaining], savedWeddingId: "w-removed", previousWeddingId: "w-removed" })).toEqual({ selectedWeddingId: "w-b", membershipLost: true });
  });

  it("7. switches Wedding A to B and advances the Wedding cache revision", () => {
    const switched = nextWorkspaceCacheRevision(8, "w-a", "w-b");
    expect(switched).toBe(9);
    expect(planWorkspaceRestoration({ accountChanged: false, memberships: [membership("w-a", "OWNER"), membership("w-b", "FULL_COORDINATOR")], savedWeddingId: "w-b", previousWeddingId: "w-a" }).selectedWeddingId).toBe("w-b");
  });

  it("8. clears selected Wedding visibility on logout", () => {
    const prior = { accountId: "user-1", phase: "ready" as const, memberships: [owner], selectedWeddingId: "w-a", membershipLost: false };
    expect(workspaceMembershipsForAccount(prior, null)).toEqual([]);
    expect(workspaceSelectionForAccount(prior, null)).toBe(null);
    expect(nextWorkspaceCacheRevision(3, "w-a", null)).toBe(4);
  });

  it("9. isolates Account B from Account A selection and cached memberships", () => {
    const accountA = { accountId: "user-a", phase: "ready" as const, memberships: [owner], selectedWeddingId: "w-a", membershipLost: false };
    expect(workspaceMembershipsForAccount(accountA, "user-b")).toEqual([]);
    expect(workspaceSelectionForAccount(accountA, "user-b")).toBe(null);
    expect(selectedWeddingStorageKey("user-a")).not.toBe(selectedWeddingStorageKey("user-b"));
  });

  it("removes the logged-out account's saved selection while keeping another account isolated", async () => {
    const values = new Map<string, string>([["katipan.selected-wedding-id.legacy-user", "legacy-wedding"]]);
    const storage = {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => { values.set(key, value); },
      removeItem: async (key: string) => { values.delete(key); },
    };
    const selection = new AccountScopedWeddingSelection(storage, "katipan.selected-wedding-id");
    await selection.write("user-a", "w-a");
    await selection.write("user-b", "w-b");
    expect(await selection.read("user-a")).toBe("w-a");
    expect(await selection.read("user-b")).toBe("w-b");

    await selection.clear("user-a");
    expect(await selection.read("user-a")).toBe(null);
    expect(await selection.read("user-b")).toBe("w-b");
    expect(values.has("katipan.selected-wedding-id")).toBe(false);
  });

  it("serializes logout clearing after a pending selection write", async () => {
    const values = new Map<string, string>();
    let notifyWriteStarted!: () => void;
    let finishWrite!: () => void;
    const writeStarted = new Promise<void>((resolve) => { notifyWriteStarted = resolve; });
    const writeGate = new Promise<void>((resolve) => { finishWrite = resolve; });
    const storage = {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        notifyWriteStarted();
        await writeGate;
        values.set(key, value);
      },
      removeItem: async (key: string) => { values.delete(key); },
    };
    const selection = new AccountScopedWeddingSelection(storage, "katipan.selected-wedding-id");
    const pendingWrite = selection.write("user-a", "w-a");
    await writeStarted;
    const pendingLogoutClear = selection.clear("user-a");
    finishWrite();
    await Promise.all([pendingWrite, pendingLogoutClear]);
    expect(await selection.read("user-a")).toBe(null);
  });

  it("10. reports membership loss only after an authoritative empty result", () => {
    const lost = { accountId: "user-1", phase: "ready" as const, memberships: [], selectedWeddingId: null, membershipLost: true };
    expect(workspaceRestorationStatus({ accessLoading: false, accessError: null, accountId: "user-1", snapshot: lost })).toBe("AUTHENTICATED_MEMBERSHIP_LOST");
    expect(planWorkspaceRestoration({ accountChanged: false, memberships: [], savedWeddingId: null, previousWeddingId: "w-a" }).membershipLost).toBe(true);
  });

  it("11. reports a failed membership read as recoverable and retains same-account verified data", () => {
    const failedRefresh = { accountId: "user-1", phase: "error" as const, memberships: [owner], selectedWeddingId: "w-a", membershipLost: false };
    expect(workspaceRestorationStatus({ accessLoading: false, accessError: null, accountId: "user-1", snapshot: failedRefresh })).toBe("RECOVERABLE_ERROR");
    expect(workspaceMembershipsForAccount(failedRefresh, "user-1")).toEqual([owner]);
  });

  it("12. prevents a stale Wedding request from overwriting the current one", async () => {
    const { RequestGeneration } = await import("../auth/session");
    const requests = new RequestGeneration();
    const requestA = requests.begin();
    const requestB = requests.begin();
    expect(requests.isCurrent(requestA)).toBe(false);
    expect(requests.isCurrent(requestB)).toBe(true);
  });

  it("13. replaces the signed-out root after login and preserves an invitation while it is being accepted", () => {
    const signedOutStack = rootStackHistoryKey(3, false);
    const authenticatedStack = rootStackHistoryKey(4, false);
    expect(authenticatedRootRoute).toBe("/");
    expect(signedOutStack).toBe("session-3");
    expect(authenticatedStack).toBe("session-4");
    expect(authenticatedStack).not.toBe(signedOutStack);
    expect(rootStackHistoryKey(4, true)).toBe("pending-invitation");
  });

  it("15. recognizes only the authenticated Couple Home tab root for Android Back handling", () => {
    expect(isCoupleHomeRoot(["(wedding)", "[weddingId]", "home"])).toBe(true);
    expect(isCoupleHomeRoot(["(wedding)", "[weddingId]", "plan", "tasks", "new"])).toBe(false);
    expect(isCoupleHomeRoot(["(access)", "auth"])).toBe(false);
  });

  it("16. routes coordinators with multiple Weddings through the portfolio and restores their saved Wedding", () => {
    const coordinator = { ...membership("w-client", "FULL_COORDINATOR"), wedding: { ...membership("w-client", "FULL_COORDINATOR").wedding, origin: "COORDINATOR_CREATED" as const, ownership_mode: "COORDINATOR_MANAGED" as const } };
    const couple = membership("w-couple", "OWNER");
    expect(destinationAfterRestore(true, [coordinator, couple])).toBe("weddings");
    expect(planWorkspaceRestoration({ accountChanged: false, memberships: [coordinator, couple], savedWeddingId: "w-client", previousWeddingId: null }).selectedWeddingId).toBe("w-client");
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
