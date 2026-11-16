import type { Database } from "@katipan/database/types";

export type WorkspaceRole = Database["public"]["Enums"]["wedding_membership_role"];
export type WeddingStatus = Database["public"]["Enums"]["wedding_status"];
export type WeddingOrigin = Database["public"]["Enums"]["wedding_origin"];
export type WeddingOwnershipMode = Database["public"]["Enums"]["wedding_ownership_mode"];

export type WorkspaceWedding = {
  id: string;
  created_by_user_id?: string | null;
  display_name: string | null;
  wedding_date: string | null;
  general_location: string | null;
  status: WeddingStatus;
  origin: WeddingOrigin;
  ownership_mode: WeddingOwnershipMode;
};

export type WorkspaceMembership = {
  membershipId: string;
  weddingId: string;
  userId: string;
  role: WorkspaceRole;
  status: Database["public"]["Enums"]["wedding_membership_status"];
  wedding: WorkspaceWedding;
  partnerNames: string[];
};

export type WorkspaceDestination = "welcome" | "home" | "weddings";

export const authenticatedRootRoute = "/";
export const noWeddingRoutes = {
  coupleCreation: "/(access)/create-wedding",
  coordinatorCreation: "/(coordinator)/onboarding",
  invitationAcceptance: "/accept-invitation",
} as const;

export type WorkspaceRestorationStatus =
  | "AUTH_LOADING"
  | "SIGNED_OUT"
  | "AUTHENTICATED_WORKSPACE_LOADING"
  | "AUTHENTICATED_NO_WEDDINGS"
  | "AUTHENTICATED_WEDDING_SELECTION_REQUIRED"
  | "AUTHENTICATED_WEDDING_READY"
  | "AUTHENTICATED_MEMBERSHIP_LOST"
  | "RECOVERABLE_ERROR";

export type WorkspaceSnapshotPhase = "loading" | "ready" | "error";

export type WorkspaceSnapshotView = {
  accountId: string | null;
  phase: WorkspaceSnapshotPhase;
  memberships: readonly WorkspaceMembership[];
  selectedWeddingId: string | null;
  membershipLost: boolean;
};

export function workspaceRestorationStatus(input: {
  accessLoading: boolean;
  accessError: string | null;
  accountId: string | null;
  snapshot: WorkspaceSnapshotView;
}): WorkspaceRestorationStatus {
  if (input.accessLoading) return "AUTH_LOADING";
  if (input.accessError) return "RECOVERABLE_ERROR";
  if (!input.accountId) return "SIGNED_OUT";
  if (input.snapshot.accountId !== input.accountId || input.snapshot.phase === "loading") {
    return "AUTHENTICATED_WORKSPACE_LOADING";
  }
  if (input.snapshot.phase === "error") return "RECOVERABLE_ERROR";
  if (input.snapshot.membershipLost && !input.snapshot.selectedWeddingId) {
    return "AUTHENTICATED_MEMBERSHIP_LOST";
  }
  if (input.snapshot.memberships.length === 0) return "AUTHENTICATED_NO_WEDDINGS";
  if (!input.snapshot.selectedWeddingId) return "AUTHENTICATED_WEDDING_SELECTION_REQUIRED";
  return "AUTHENTICATED_WEDDING_READY";
}

export function activeMemberships(memberships: readonly WorkspaceMembership[]): WorkspaceMembership[] {
  return memberships.filter((membership) => membership.status === "ACTIVE");
}

export function destinationAfterRestore(
  hasSession: boolean,
  memberships: readonly WorkspaceMembership[],
): WorkspaceDestination {
  if (!hasSession) return "welcome";
  const count = activeMemberships(memberships).length;
  if (count === 0) return "weddings";
  if (count === 1) return "home";
  return "weddings";
}

export function resolveRestoredSelection(
  savedWeddingId: string | null,
  memberships: readonly WorkspaceMembership[],
): string | null {
  const active = activeMemberships(memberships);
  if (savedWeddingId && active.some((membership) => membership.weddingId === savedWeddingId)) {
    return savedWeddingId;
  }
  return active.length === 1 ? active[0]?.weddingId ?? null : null;
}

export function workspaceMembershipsForAccount(
  snapshot: Pick<WorkspaceSnapshotView, "accountId" | "memberships">,
  accountId: string | null,
): readonly WorkspaceMembership[] {
  return accountId && snapshot.accountId === accountId ? snapshot.memberships : [];
}

export function workspaceSelectionForAccount(
  snapshot: Pick<WorkspaceSnapshotView, "accountId" | "selectedWeddingId">,
  accountId: string | null,
): string | null {
  return accountId && snapshot.accountId === accountId ? snapshot.selectedWeddingId : null;
}

export function planWorkspaceRestoration(input: {
  accountChanged: boolean;
  memberships: readonly WorkspaceMembership[];
  savedWeddingId: string | null;
  previousWeddingId: string | null;
}): { selectedWeddingId: string | null; membershipLost: boolean } {
  const activeIds = new Set(activeMemberships(input.memberships).map((membership) => membership.weddingId));
  const sameAccountPreviousIsActive = !input.accountChanged
    && input.previousWeddingId !== null
    && activeIds.has(input.previousWeddingId);
  const savedIsActive = input.savedWeddingId !== null && activeIds.has(input.savedWeddingId);
  return {
    selectedWeddingId: savedIsActive
      ? input.savedWeddingId
      : sameAccountPreviousIsActive
        ? input.previousWeddingId
        : resolveRestoredSelection(input.savedWeddingId, input.memberships),
    membershipLost: Boolean(
      (!input.accountChanged && input.previousWeddingId && !activeIds.has(input.previousWeddingId))
      || (input.savedWeddingId && !savedIsActive)
    ),
  };
}

export function findActiveMembership(
  memberships: readonly WorkspaceMembership[],
  weddingId: string,
): WorkspaceMembership | null {
  return memberships.find((membership) => membership.weddingId === weddingId && membership.status === "ACTIVE") ?? null;
}

export function isCurrentWeddingWorkspace(
  membership: WorkspaceMembership | null,
  selectedWeddingId: string | null,
  routeWeddingId: string,
): boolean {
  return Boolean(
    membership
    && membership.status === "ACTIVE"
    && membership.weddingId === routeWeddingId
    && selectedWeddingId === routeWeddingId,
  );
}

export function nextWorkspaceCacheRevision(current: number, previousWeddingId: string | null, nextWeddingId: string | null): number {
  return previousWeddingId === nextWeddingId ? current : current + 1;
}

export function selectedWeddingStorageKey(accountId: string): string {
  return `katipan.selected-wedding-id.${accountId}`;
}

export interface SelectedWeddingStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

/** Persist only an account-scoped preference; membership remains server-authoritative. */
export class AccountScopedWeddingSelection {
  private readonly storageTails = new Map<string, Promise<void>>();

  constructor(private readonly storage: SelectedWeddingStorageAdapter, private readonly legacyKey: string) {}

  async read(accountId: string): Promise<string | null> {
    return this.enqueue(selectedWeddingStorageKey(accountId), async () => {
      try { return await this.storage.getItem(selectedWeddingStorageKey(accountId)); } catch { return null; }
    });
  }

  async write(accountId: string, weddingId: string | null): Promise<void> {
    const key = selectedWeddingStorageKey(accountId);
    await this.enqueue(key, async () => {
      try {
        if (weddingId) await this.storage.setItem(key, weddingId);
        else await this.storage.removeItem(key);
      } catch {
        // Persisted selection is optional and never grants access.
      }
    });
  }

  async clear(accountId: string | null): Promise<void> {
    const removals: Promise<void>[] = [];
    if (accountId) {
      const key = selectedWeddingStorageKey(accountId);
      removals.push(this.enqueue(key, async () => {
        try { await this.storage.removeItem(key); } catch { /* Continue clearing legacy state. */ }
      }));
    }
    removals.push(this.enqueue(this.legacyKey, async () => {
      try { await this.storage.removeItem(this.legacyKey); } catch { /* No storage value can authorize a Wedding. */ }
    }));
    await Promise.all(removals);
  }

  private enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.storageTails.get(key) ?? Promise.resolve();
    const result = previous.then(operation, operation);
    const tail = result.then(() => undefined, () => undefined);
    this.storageTails.set(key, tail);
    void tail.then(() => {
      if (this.storageTails.get(key) === tail) this.storageTails.delete(key);
    });
    return result;
  }
}

/** Keep an invitation deep link alive through sign-in, then reset history on workspace entry. */
export function rootStackHistoryKey(sessionRevision: number, onInvitationAcceptanceRoute: boolean): string {
  return onInvitationAcceptanceRoute ? "pending-invitation" : `session-${sessionRevision}`;
}

export function isCoupleHomeRoot(segments: readonly string[]): boolean {
  return segments.length === 3
    && segments[0] === "(wedding)"
    && segments[1] === "[weddingId]"
    && segments[2] === "home";
}

export function roleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "OWNER": return "Owner";
    case "FULL_COORDINATOR": return "Full Coordinator";
    case "DAY_OF_COORDINATOR": return "Day-of Coordinator";
    case "GUEST_COORDINATOR": return "Guest Coordinator";
  }
}

export function ownershipModeLabel(wedding: Pick<WorkspaceWedding, "origin" | "ownership_mode">): string {
  if (wedding.origin === "COORDINATOR_CREATED") {
    return wedding.ownership_mode === "COORDINATOR_MANAGED"
      ? "Coordinator-managed"
      : "Couple-owned";
  }
  return "Couple-owned";
}

export function weddingStatusLabel(status: WeddingStatus): string {
  switch (status) {
    case "DRAFT": return "Draft";
    case "ACTIVE": return "Active";
    case "COMPLETED": return "Completed";
    case "ARCHIVED": return "Archived";
  }
}

export function safeInvitationFailure(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && error.code === "42501") {
    return "Sign in with the invited account, then reopen the invitation link.";
  }
  return "We couldn't accept this invitation. It may be invalid, expired, revoked, or already used. Ask the sender for a fresh link.";
}

export function weddingHomePath(weddingId: string): string {
  return `/(wedding)/${encodeURIComponent(weddingId)}/home`;
}
