import { z } from "zod";
import type { Database } from "@katipan/database/types";
import { ceremonyStyles } from "../onboarding/model";
import type { WorkspaceMembership } from "../workspace/model";

export type CeremonyStyle = Database["public"]["Enums"]["ceremony_style"];
export type WeddingRole = Database["public"]["Enums"]["wedding_membership_role"];
export type CoordinatorRole = Exclude<WeddingRole, "OWNER">;

export const coordinatorRoles: readonly CoordinatorRole[] = [
  "FULL_COORDINATOR",
  "DAY_OF_COORDINATOR",
  "GUEST_COORDINATOR",
];

export const ceremonyStyleOptions: readonly { value: CeremonyStyle; label: string }[] = [
  { value: "UNDECIDED", label: "Not decided" },
  { value: "RELIGIOUS", label: "Religious" },
  { value: "CIVIL", label: "Civil" },
  { value: "SYMBOLIC", label: "Symbolic" },
  { value: "SECULAR", label: "Secular" },
  { value: "DESTINATION", label: "Destination" },
  { value: "OTHER", label: "Other" },
];

export type ClientWeddingDraft = {
  weddingDisplayName: string;
  partner1DisplayName: string;
  partner2DisplayName: string;
  weddingDate: string;
  timezone: string;
  generalLocation: string;
  estimatedGuestCount: string;
  ceremonyStyle: CeremonyStyle;
};

export const emptyClientWeddingDraft: ClientWeddingDraft = {
  weddingDisplayName: "",
  partner1DisplayName: "",
  partner2DisplayName: "",
  weddingDate: "",
  timezone: "",
  generalLocation: "",
  estimatedGuestCount: "",
  ceremonyStyle: "UNDECIDED",
};

function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const clientWeddingDraftSchema = z.object({
  weddingDisplayName: z.string().trim().min(1, "Enter a Wedding name.").max(160),
  partner1DisplayName: z.string().trim().min(1, "Enter Partner 1's name.").max(120),
  partner2DisplayName: z.string().trim().min(1, "Enter Partner 2's name.").max(120),
  weddingDate: z.string().trim().refine((value) => value === "" || isValidCalendarDate(value), "Choose a valid Wedding date."),
  timezone: z.string().trim().max(100, "Timezone must be 100 characters or fewer."),
  generalLocation: z.string().trim().max(200, "Location must be 200 characters or fewer."),
  estimatedGuestCount: z.string().trim().refine((value) => {
    if (value === "") return true;
    if (!/^\d+$/.test(value)) return false;
    const count = Number(value);
    return Number.isSafeInteger(count) && count >= 0 && count <= 100000;
  }, "Enter a whole guest count from 0 to 100,000."),
  ceremonyStyle: z.enum(ceremonyStyles),
});

export function clientWeddingRpcArgs(draft: ClientWeddingDraft) {
  const value = clientWeddingDraftSchema.parse(draft);
  return {
    p_wedding_display_name: value.weddingDisplayName,
    p_partner_1_display_name: value.partner1DisplayName,
    p_partner_2_display_name: value.partner2DisplayName,
    p_wedding_date: value.weddingDate || undefined,
    p_timezone: value.timezone || undefined,
    p_general_location: value.generalLocation || undefined,
    p_estimated_guest_count: value.estimatedGuestCount === "" ? undefined : Number(value.estimatedGuestCount),
    p_ceremony_style: value.ceremonyStyle,
  };
}

export function isCoordinatorRole(role: WeddingRole): role is CoordinatorRole {
  return coordinatorRoles.includes(role as CoordinatorRole);
}

export function ownershipModeLabel(membership: WorkspaceMembership): string {
  if (membership.wedding.origin === "COORDINATOR_CREATED") {
    return membership.wedding.ownership_mode === "COORDINATOR_MANAGED"
      ? "Client Wedding · coordinator-managed"
      : "Client Wedding · couple-owned";
  }
  return "Couple-owned Wedding";
}

/** Mirrors the backend's Owner-or-current-controller invitation capability for display only. */
export function canManageWeddingTeam(membership: WorkspaceMembership): boolean {
  return (membership.role === "OWNER" && membership.wedding.ownership_mode === "COUPLE_OWNED")
    || (membership.role === "FULL_COORDINATOR"
      && membership.wedding.origin === "COORDINATOR_CREATED"
      && membership.wedding.ownership_mode === "COORDINATOR_MANAGED"
      && membership.wedding.created_by_user_id === membership.userId);
}

export function canManageOwnerMemberships(membership: WorkspaceMembership): boolean {
  return membership.role === "OWNER" && membership.wedding.ownership_mode === "COUPLE_OWNED";
}

export function canChangeCoordinatorRole(
  membership: WorkspaceMembership,
  target: { userId: string | null; role: WeddingRole; status: string },
): boolean {
  return canManageWeddingTeam(membership)
    && target.status === "ACTIVE"
    && isCoordinatorRole(target.role)
    && target.userId !== membership.userId;
}

export function canPromoteMemberToOwner(
  membership: WorkspaceMembership,
  target: { userId: string | null; role: WeddingRole; status: string },
): boolean {
  return canManageOwnerMemberships(membership)
    && target.status === "ACTIVE"
    && target.userId !== null
    && target.role !== "OWNER";
}

export function canRemoveWeddingMember(
  membership: WorkspaceMembership,
  target: { userId: string | null; role: WeddingRole; status: string },
  activeOwnerCount: number,
): boolean {
  if (!canManageOwnerMemberships(membership) || target.status !== "ACTIVE" || target.userId === membership.userId) return false;
  return target.role !== "OWNER" || activeOwnerCount > 1;
}

export function canLeaveWedding(membership: WorkspaceMembership, activeOwnerCount: number): boolean {
  if (membership.status !== "ACTIVE") return false;
  if (membership.role === "OWNER" && activeOwnerCount <= 1) return false;
  const isController = membership.wedding.origin === "COORDINATOR_CREATED"
    && membership.wedding.ownership_mode === "COORDINATOR_MANAGED"
    && membership.wedding.created_by_user_id === membership.userId;
  return !isController;
}

export function safeCoordinatorFailure(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "42501") return "You do not have access to make this change. Refresh your Wedding memberships and try again.";
  if (code === "23514") return "This action is protected by the Wedding ownership rules. Review the active Owners and try again.";
  if (code === "22023") return "This Wedding or team record changed. Refresh the team and try again.";
  return "We could not complete that Wedding team action. Check your connection and try again.";
}

export function safeClientWeddingFailure(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "42501") return "Your session does not have access to create a client Wedding. Sign in again and retry.";
  if (code === "22023") return "Review the required Wedding details and try again.";
  return "We could not create the client Wedding. Check your connection and try again.";
}
