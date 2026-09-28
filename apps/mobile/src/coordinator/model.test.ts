import { describe, expect, it } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import {
  canChangeCoordinatorRole,
  canLeaveWedding,
  canManageOwnerMemberships,
  canManageWeddingTeam,
  canPromoteMemberToOwner,
  canRemoveWeddingMember,
  ceremonyStyleOptions,
  clientWeddingDraftSchema,
  clientWeddingRpcArgs,
  emptyClientWeddingDraft,
  ownershipModeLabel,
  safeCoordinatorFailure,
} from "./model";

function membership(
  role: WorkspaceMembership["role"],
  ownershipMode: WorkspaceMembership["wedding"]["ownership_mode"],
  overrides: Partial<WorkspaceMembership["wedding"]> = {},
): WorkspaceMembership {
  return {
    membershipId: "membership-current",
    weddingId: "wedding-current",
    userId: "user-current",
    role,
    status: "ACTIVE",
    partnerNames: ["Juan", "Maria"],
    wedding: {
      id: "wedding-current",
      created_by_user_id: ownershipMode === "COORDINATOR_MANAGED" ? "user-current" : "user-other",
      display_name: "Juan & Maria’s Wedding",
      wedding_date: null,
      general_location: null,
      status: "DRAFT",
      origin: ownershipMode === "COORDINATOR_MANAGED" ? "COORDINATOR_CREATED" : "COUPLE_CREATED",
      ownership_mode: ownershipMode,
      ...overrides,
    },
  };
}

describe("coordinator client Wedding workflow", () => {
  it("requires both existing Partner display names and maps optional details to exact RPC arguments", () => {
    expect(clientWeddingDraftSchema.safeParse(emptyClientWeddingDraft).success).toBe(false);
    const draft = {
      ...emptyClientWeddingDraft,
      weddingDisplayName: " Juan & Maria’s Wedding ",
      partner1DisplayName: " Juan ",
      partner2DisplayName: " Maria ",
      weddingDate: "2027-06-19",
      timezone: "Asia/Manila",
      generalLocation: "Antipolo, Rizal",
      estimatedGuestCount: "120",
      ceremonyStyle: "CIVIL" as const,
    };
    expect(clientWeddingRpcArgs(draft)).toEqual({
      p_wedding_display_name: "Juan & Maria’s Wedding",
      p_partner_1_display_name: "Juan",
      p_partner_2_display_name: "Maria",
      p_wedding_date: "2027-06-19",
      p_timezone: "Asia/Manila",
      p_general_location: "Antipolo, Rizal",
      p_estimated_guest_count: 120,
      p_ceremony_style: "CIVIL",
    });
    expect(clientWeddingRpcArgs({
      ...emptyClientWeddingDraft,
      weddingDisplayName: "Juan & Maria’s Wedding",
      partner1DisplayName: "Juan",
      partner2DisplayName: "Maria",
    })).toEqual({
      p_wedding_display_name: "Juan & Maria’s Wedding",
      p_partner_1_display_name: "Juan",
      p_partner_2_display_name: "Maria",
      p_wedding_date: undefined,
      p_timezone: undefined,
      p_general_location: undefined,
      p_estimated_guest_count: undefined,
      p_ceremony_style: "UNDECIDED",
    });
  });

  it("rejects invalid date and guest count while retaining backend ceremony values", () => {
    const base = {
      ...emptyClientWeddingDraft,
      weddingDisplayName: "Wedding",
      partner1DisplayName: "Juan",
      partner2DisplayName: "Maria",
    };
    expect(clientWeddingDraftSchema.safeParse({ ...base, weddingDate: "2027-02-31" }).success).toBe(false);
    expect(clientWeddingDraftSchema.safeParse({ ...base, estimatedGuestCount: "4.5" }).success).toBe(false);
    expect(clientWeddingDraftSchema.safeParse({ ...base, estimatedGuestCount: "100001" }).success).toBe(false);
    expect(ceremonyStyleOptions.map((item) => item.value)).toEqual([
      "UNDECIDED", "RELIGIOUS", "CIVIL", "SYMBOLIC", "SECULAR", "DESTINATION", "OTHER",
    ]);
  });
});

describe("per-Wedding team and ownership permissions", () => {
  it("supports one account as Owner of one Wedding and Full Coordinator of another", () => {
    const ownerMembership = membership("OWNER", "COUPLE_OWNED", { origin: "COUPLE_CREATED", created_by_user_id: "user-current" });
    const coordinatorMembership = {
      ...membership("FULL_COORDINATOR", "COORDINATOR_MANAGED"),
      weddingId: "wedding-client",
      wedding: { ...membership("FULL_COORDINATOR", "COORDINATOR_MANAGED").wedding, id: "wedding-client" },
    };
    expect(ownerMembership.userId).toBe(coordinatorMembership.userId);
    expect(canManageOwnerMemberships(ownerMembership)).toBe(true);
    expect(canManageWeddingTeam(coordinatorMembership)).toBe(true);
    expect(Object.keys(ownerMembership)).not.toContain("account_type");
  });

  it("limits Full Coordinator team capabilities to the coordinator-managed controller", () => {
    const controller = membership("FULL_COORDINATOR", "COORDINATOR_MANAGED");
    const retainedCoordinator = membership("FULL_COORDINATOR", "COUPLE_OWNED", {
      origin: "COORDINATOR_CREATED",
      created_by_user_id: "user-current",
    });
    const dayCoordinator = membership("DAY_OF_COORDINATOR", "COUPLE_OWNED", { origin: "COUPLE_CREATED" });
    expect(canManageWeddingTeam(controller)).toBe(true);
    expect(canManageOwnerMemberships(controller)).toBe(false);
    expect(canManageWeddingTeam(retainedCoordinator)).toBe(false);
    expect(canManageWeddingTeam(dayCoordinator)).toBe(false);
  });

  it("keeps coordinator role changes separate from owner promotion", () => {
    const owner = membership("OWNER", "COUPLE_OWNED", { origin: "COUPLE_CREATED" });
    const controller = membership("FULL_COORDINATOR", "COORDINATOR_MANAGED");
    const otherFullCoordinator = { userId: "user-other", role: "FULL_COORDINATOR" as const, status: "ACTIVE" };
    const otherOwner = { userId: "user-other", role: "OWNER" as const, status: "ACTIVE" };
    expect(canChangeCoordinatorRole(owner, otherFullCoordinator)).toBe(true);
    expect(canChangeCoordinatorRole(owner, { ...otherFullCoordinator, userId: "user-current" })).toBe(false);
    expect(canChangeCoordinatorRole(owner, otherOwner)).toBe(false);
    expect(canPromoteMemberToOwner(owner, { ...otherFullCoordinator, status: "ACTIVE" })).toBe(true);
    expect(canPromoteMemberToOwner(controller, otherFullCoordinator)).toBe(false);
    expect(canPromoteMemberToOwner(owner, { ...otherFullCoordinator, userId: null })).toBe(false);
  });

  it("protects the final Owner and coordinator controller when leaving or removing", () => {
    const owner = membership("OWNER", "COUPLE_OWNED", { origin: "COUPLE_CREATED" });
    const otherOwner = { userId: "user-other", role: "OWNER" as const, status: "ACTIVE" };
    const coordinator = { userId: "user-other", role: "FULL_COORDINATOR" as const, status: "ACTIVE" };
    expect(canRemoveWeddingMember(owner, otherOwner, 1)).toBe(false);
    expect(canRemoveWeddingMember(owner, otherOwner, 2)).toBe(true);
    expect(canRemoveWeddingMember(owner, { ...coordinator, userId: "user-current" }, 1)).toBe(false);
    expect(canLeaveWedding(owner, 1)).toBe(false);
    expect(canLeaveWedding(owner, 2)).toBe(true);
    expect(canLeaveWedding(membership("FULL_COORDINATOR", "COORDINATOR_MANAGED"), 0)).toBe(false);
    expect(canLeaveWedding(membership("FULL_COORDINATOR", "COUPLE_OWNED", {
      origin: "COORDINATOR_CREATED",
      created_by_user_id: "user-current",
    }), 1)).toBe(true);
  });

  it("describes the client ownership mode and maps server failures without details", () => {
    expect(ownershipModeLabel(membership("FULL_COORDINATOR", "COORDINATOR_MANAGED"))).toContain("coordinator-managed");
    expect(ownershipModeLabel(membership("OWNER", "COUPLE_OWNED", { origin: "COORDINATOR_CREATED" }))).toContain("couple-owned");
    expect(safeCoordinatorFailure({ code: "23514", message: "secret backend detail" })).not.toContain("secret backend detail");
    expect(safeCoordinatorFailure({ code: "23514" })).toContain("ownership rules");
  });
});
