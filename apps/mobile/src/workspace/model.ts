import type { Database } from "@katipan/database/types";

export type WorkspaceRole = Database["public"]["Enums"]["wedding_membership_role"];
export type WeddingStatus = Database["public"]["Enums"]["wedding_status"];
export type WeddingOrigin = Database["public"]["Enums"]["wedding_origin"];
export type WeddingOwnershipMode = Database["public"]["Enums"]["wedding_ownership_mode"];

export type WorkspaceWedding = {
  id: string;
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

export type WorkspaceDestination = "welcome" | "create-wedding" | "home" | "weddings";

export function activeMemberships(memberships: readonly WorkspaceMembership[]): WorkspaceMembership[] {
  return memberships.filter((membership) => membership.status === "ACTIVE");
}

export function destinationAfterRestore(
  hasSession: boolean,
  memberships: readonly WorkspaceMembership[],
): WorkspaceDestination {
  if (!hasSession) return "welcome";
  const count = activeMemberships(memberships).length;
  if (count === 0) return "create-wedding";
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

export function nextWorkspaceCacheRevision(current: number, previousWeddingId: string | null, nextWeddingId: string): number {
  return previousWeddingId === nextWeddingId ? current : current + 1;
}

export function roleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "OWNER": return "Owner";
    case "FULL_COORDINATOR": return "Full Coordinator";
    case "DAY_OF_COORDINATOR": return "Day-of Coordinator";
    case "GUEST_COORDINATOR": return "Guest Coordinator";
  }
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
