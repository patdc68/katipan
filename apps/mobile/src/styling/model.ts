import { z } from "zod";
import type { Database } from "@katipan/database/types";
import type { WorkspaceMembership } from "../workspace/model";

export type WeddingMotif = Database["public"]["Tables"]["wedding_motifs"]["Row"];
export type MotifColor = Database["public"]["Tables"]["motif_colors"]["Row"];
export type WeddingDressCode = Database["public"]["Tables"]["wedding_dress_codes"]["Row"];
export type AttireGroup = Database["public"]["Tables"]["attire_groups"]["Row"];
export type GuestAttireGuidance = Database["public"]["Tables"]["guest_attire_guidance"]["Row"];
export type Attachment = Database["public"]["Tables"]["attachments"]["Row"];
export type StylingColor = Pick<MotifColor, "id" | "wedding_id" | "color_hex" | "name" | "sort_order">;
export type GuestStylingColor = Pick<Database["public"]["Tables"]["guest_attire_recommended_colors"]["Row"], "id" | "wedding_id" | "guest_attire_guidance_id" | "color_hex" | "name" | "sort_order">;
export type GuestTarget = Database["public"]["Tables"]["attire_group_guest_targets"]["Row"];
export type RoleTarget = Database["public"]["Tables"]["attire_group_entourage_role_targets"]["Row"];
export type EntourageRole = Pick<Database["public"]["Tables"]["entourage_roles"]["Row"], "id" | "wedding_id" | "name">;
export type EntourageAssignment = Pick<Database["public"]["Tables"]["entourage_assignments"]["Row"], "id" | "wedding_id" | "guest_id" | "role_id">;
export type StylingGuest = { id: string; wedding_id: string; display_name: string };

export type ColorCollectionRef =
  | { kind: "motif"; parentId: string }
  | { kind: "dress-recommended"; parentId: string }
  | { kind: "dress-avoid"; parentId: string }
  | { kind: "group-recommended"; parentId: string }
  | { kind: "group-avoid"; parentId: string }
  | { kind: "guest-recommended"; parentId: string }
  | { kind: "guest-avoid"; parentId: string };

export type StylingImage = {
  attachment: Attachment;
  signedUrl: string | null;
  sort_order: number;
};

export type AttireGroupData = {
  group: AttireGroup;
  recommendedColors: StylingColor[];
  avoidColors: StylingColor[];
  guestTargets: GuestTarget[];
  roleTargets: RoleTarget[];
  inspiration: StylingImage[];
};

export type WeddingStylingData = {
  weddingId: string;
  motif: WeddingMotif | null;
  motifColors: MotifColor[];
  motifInspiration: StylingImage[];
  dressCode: WeddingDressCode | null;
  dressRecommendedColors: StylingColor[];
  dressAvoidColors: StylingColor[];
  dressInspiration: StylingImage[];
  attireGroups: AttireGroupData[];
  guestGuidance: GuestAttireGuidance[];
  guestRecommendedColors: GuestStylingColor[];
  guestAvoidColors: GuestStylingColor[];
  guests: StylingGuest[];
  entourageRoles: EntourageRole[];
  entourageAssignments: EntourageAssignment[];
};

export const motifDraftSchema = z.object({
  title: z.string().trim().min(1, "Enter a motif title.").max(120),
  description: z.string().trim().max(2000),
  notes: z.string().trim().max(4000),
});
export type MotifDraft = z.input<typeof motifDraftSchema>;

export const dressCodeDraftSchema = z.object({
  title: z.string().trim().min(1, "Enter a dress code title.").max(120),
  description: z.string().trim().max(2000),
  venueAdvice: z.string().trim().max(2000),
  generalNotes: z.string().trim().max(4000),
});
export type DressCodeDraft = z.input<typeof dressCodeDraftSchema>;

export const attireGroupDraftSchema = z.object({
  title: z.string().trim().min(1, "Enter an attire group title.").max(120),
  description: z.string().trim().max(2000),
  instructions: z.string().trim().max(4000),
});
export type AttireGroupDraft = z.input<typeof attireGroupDraftSchema>;

export const guestGuidanceDraftSchema = z.object({
  title: z.string().trim().max(120),
  instructions: z.string().trim().min(1, "Enter guest-specific instructions.").max(4000),
  notes: z.string().trim().max(4000),
});
export type GuestGuidanceDraft = z.input<typeof guestGuidanceDraftSchema>;

export const stylingColorDraftSchema = z.object({
  colorHex: z.string().trim().min(1, "Enter a six-digit hex color."),
  name: z.string().trim().max(80),
});
export type StylingColorDraft = z.input<typeof stylingColorDraftSchema>;

export function canReadWeddingStyling(membership: WorkspaceMembership | null | undefined): boolean {
  return Boolean(
    membership
      && membership.status === "ACTIVE"
      && membership.weddingId === membership.wedding.id,
  );
}

export function canManageWeddingStyling(membership: WorkspaceMembership | null | undefined): boolean {
  return Boolean(
    canReadWeddingStyling(membership)
      && membership
      && (membership.role === "OWNER" || membership.role === "FULL_COORDINATOR"),
  );
}

/** Accepts six hexadecimal digits, with or without a leading #, and always returns #RRGGBB. */
export function normalizeHexColor(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(digits)) {
    throw new Error("Use six hexadecimal digits, for example #60725A.");
  }
  return `#${digits.toUpperCase()}`;
}

export function normalizeColorName(value: string): string | null {
  return value.trim() || null;
}

export function orderedColors<T extends StylingColor>(colors: readonly T[]): T[] {
  return [...colors].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}

export function moveId<T extends { id: string }>(items: readonly T[], id: string, direction: -1 | 1): string[] {
  const next = items.map((item) => item.id);
  const index = next.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.length) return next;
  const current = next[index];
  const other = next[target];
  if (current === undefined || other === undefined) return next;
  next[index] = other;
  next[target] = current;
  return next;
}

export function colorContradictions(recommended: readonly StylingColor[], avoid: readonly StylingColor[]): string[] {
  const avoidHex = new Set(avoid.map((color) => color.color_hex.toUpperCase()));
  return orderedColors(recommended)
    .filter((color) => avoidHex.has(color.color_hex.toUpperCase()))
    .map((color) => color.name?.trim() || color.color_hex);
}

export function safeStylingError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the styling details.";
  if (error && typeof error === "object" && "code" in error) {
    const code = error.code;
    if (code === "23505") return "That value is already in use. Review the existing color or group title.";
    if (code === "23514" || code === "22023") return "Check the color, image, or styling details and try again.";
    if (code === "42501") return "Your current Wedding access does not allow this change.";
  }
  if (error instanceof Error && error.message.startsWith("This ")) return error.message;
  return "We couldn't save this styling change. Refresh and try again.";
}

export class StylingSubmitGate {
  private busy = false;

  async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (this.busy) return undefined;
    this.busy = true;
    try {
      return await operation();
    } finally {
      this.busy = false;
    }
  }
}
