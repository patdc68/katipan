import { z } from "zod";
import type { Database } from "@katipan/database/types";
import type { WorkspaceMembership } from "../workspace/model";

export type RunStatus = Database["public"]["Enums"]["wedding_day_item_status"];
export type RunItem = Pick<Database["public"]["Tables"]["wedding_day_items"]["Row"],
  "id" | "wedding_id" | "title" | "description" | "scheduled_start" | "scheduled_end" |
  "actual_start" | "actual_end" | "status" | "sort_order" | "place_id">;
export type GuestProgramLink = Pick<Database["public"]["Tables"]["guest_program_items"]["Row"],
  "id" | "wedding_id" | "operational_item_id" | "title" | "scheduled_start" | "scheduled_end" | "is_published" | "review_required">;
export type RunMember = { id: string; weddingId: string; name: string; role: WorkspaceMembership["role"] };
export type RunPlace = { id: string; weddingId: string; name: string };
export type RunData = { weddingId: string; items: RunItem[]; members: RunMember[]; places: RunPlace[]; assignments: { itemId: string; membershipId: string }[]; guestLinks: GuestProgramLink[] };

const timestamp = z.string().datetime({ offset: true });
export const runDraftSchema = z.object({
  title: z.string().trim().min(1, "Add an item title."),
  description: z.string().trim(),
  scheduledStart: timestamp,
  scheduledEnd: timestamp.nullable(),
  actualStart: timestamp.nullable(),
  actualEnd: timestamp.nullable(),
  sortOrder: z.number().int().nonnegative(),
  placeId: z.string().uuid().nullable(),
}).superRefine((draft, context) => {
  if (draft.scheduledEnd && Date.parse(draft.scheduledEnd) < Date.parse(draft.scheduledStart))
    context.addIssue({ code: "custom", path: ["scheduledEnd"], message: "End must be at or after start." });
  if (draft.actualEnd && (!draft.actualStart || Date.parse(draft.actualEnd) < Date.parse(draft.actualStart)))
    context.addIssue({ code: "custom", path: ["actualEnd"], message: "Actual end must be at or after actual start." });
});
export type RunDraft = z.input<typeof runDraftSchema>;

export function canManageRun(membership: WorkspaceMembership | null | undefined): boolean {
  return Boolean(membership && membership.status === "ACTIVE" && membership.wedding.status === "ACTIVE"
    && membership.weddingId === membership.wedding.id
    && ["OWNER", "FULL_COORDINATOR", "DAY_OF_COORDINATOR"].includes(membership.role));
}
export function canReviewGuestProgram(membership: WorkspaceMembership | null | undefined): boolean {
  return Boolean(membership && membership.status === "ACTIVE" && membership.weddingId === membership.wedding.id
    && ["OWNER", "FULL_COORDINATOR"].includes(membership.role));
}
export function orderedRunItems(items: readonly RunItem[]): RunItem[] {
  return [...items].sort((a, b) => Date.parse(a.scheduled_start) - Date.parse(b.scheduled_start)
    || a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}
export function runStatusLabel(status: string): string { return status.replaceAll("_", " "); }
export function safeRunError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the item details.";
  if (error instanceof Error && error.message.startsWith("This ")) return error.message;
  return "We couldn't save this Wedding-Day change. Refresh and try again.";
}
export class SubmitGate {
  private busy = false;
  async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (this.busy) return undefined;
    this.busy = true;
    try { return await operation(); } finally { this.busy = false; }
  }
}
