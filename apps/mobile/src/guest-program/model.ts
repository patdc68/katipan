import { z } from "zod";
import type { Database } from "@katipan/database/types";
import type { WorkspaceMembership } from "../workspace/model";

export type ProgramItem = Pick<Database["public"]["Tables"]["guest_program_items"]["Row"],
  "id" | "wedding_id" | "operational_item_id" | "title" | "description" | "scheduled_start" |
  "scheduled_end" | "place_id" | "sort_order" | "is_published" | "published_at" |
  "review_required" | "review_requested_at" | "review_confirmed_at" | "review_resolution">;
export type OperationalItem = Pick<Database["public"]["Tables"]["wedding_day_items"]["Row"],
  "id" | "wedding_id" | "title" | "scheduled_start" | "scheduled_end" | "actual_start" | "actual_end" | "status">;
export type ProgramPlace = { id: string; weddingId: string; name: string };
export type ProgramData = { weddingId: string; items: ProgramItem[]; operations: OperationalItem[]; places: ProgramPlace[]; website: { slug: string; isPublished: boolean } | null };

const timestamp = z.string().datetime({ offset: true });
export const programDraftSchema = z.object({
  title: z.string().trim().min(1, "Add a Guest Program title."),
  description: z.string().trim(),
  scheduledStart: timestamp,
  scheduledEnd: timestamp.nullable(),
  placeId: z.string().uuid().nullable(),
  operationalItemId: z.string().uuid().nullable(),
  sortOrder: z.number().int().nonnegative(),
}).superRefine((draft, context) => {
  if (draft.scheduledEnd && Date.parse(draft.scheduledEnd) < Date.parse(draft.scheduledStart))
    context.addIssue({ code: "custom", path: ["scheduledEnd"], message: "End must be at or after start." });
});
export type ProgramDraft = z.input<typeof programDraftSchema>;

export function canManageProgram(membership: WorkspaceMembership | null | undefined): boolean {
  return Boolean(membership && membership.status === "ACTIVE" && membership.weddingId === membership.wedding.id
    && ["DRAFT", "ACTIVE"].includes(membership.wedding.status)
    && ["OWNER", "FULL_COORDINATOR"].includes(membership.role));
}
export function orderedProgram(items: readonly ProgramItem[]): ProgramItem[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order
    || Date.parse(a.scheduled_start) - Date.parse(b.scheduled_start) || a.id.localeCompare(b.id));
}
export function guestVisibleProgram(items: readonly ProgramItem[]): ProgramItem[] {
  return orderedProgram(items.filter(item => item.is_published));
}
export function draftFromItem(item: ProgramItem): ProgramDraft {
  return { title: item.title, description: item.description ?? "", scheduledStart: item.scheduled_start,
    scheduledEnd: item.scheduled_end, placeId: item.place_id, operationalItemId: item.operational_item_id,
    sortOrder: item.sort_order };
}
export function safeProgramError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the item details.";
  if (error instanceof Error && error.message.startsWith("This ")) return error.message;
  return "We couldn't save this Guest Program change. Refresh and try again.";
}
export class SubmitGate {
  private busy = false;
  async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (this.busy) return undefined;
    this.busy = true;
    try { return await operation(); } finally { this.busy = false; }
  }
}
