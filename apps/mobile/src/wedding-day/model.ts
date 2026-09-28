import { z } from "zod";
import type { Database } from "@katipan/database/types";
import type { WorkspaceMembership } from "../workspace/model";

export type WeddingDayItemStatus = Database["public"]["Enums"]["wedding_day_item_status"];
export type WeddingDayRsvpStatus = Database["public"]["Enums"]["guest_rsvp_status"];

export type WeddingDayItem = {
  id: string;
  title: string;
  description: string | null;
  scheduledStart: string;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  status: WeddingDayItemStatus;
  sortOrder: number;
  placeId: string | null;
};

export type WeddingDayDashboard = {
  totalAttending: number;
  checkedIn: number;
  remaining: number;
  currentItem: WeddingDayItem | null;
  nextItem: WeddingDayItem | null;
  delayedItems: WeddingDayItem[];
};

export type WeddingDayGuest = {
  guestId: string;
  displayName: string;
  householdId: string;
  householdName: string;
  rsvpStatus: WeddingDayRsvpStatus;
  isCheckedIn: boolean;
  tableSeatSummaries: string[];
  seatingAvailable: boolean;
};

export type ManualCheckInAction = {
  userId: string;
  weddingId: string;
  guestId: string;
  clientEventId: string;
  occurredAt: string;
};

export const checkInStatuses = [
  "CHECKED_IN",
  "ALREADY_CHECKED_IN",
  "NOT_RECOGNIZED",
  "DIFFERENT_WEDDING",
  "REVOKED_PASS",
  "DECLINED_REVIEW",
  "NO_RESPONSE_REVIEW",
] as const;

export type WeddingDayCheckInStatus = typeof checkInStatuses[number];
export type WeddingDayCheckInResult = {
  status: WeddingDayCheckInStatus;
  guestId?: string;
  name?: string;
  reference?: string;
  eventId?: string;
  replayed?: boolean;
};

export type WeddingDayReversalResult = {
  status: "REVERSED" | "NOT_CHECKED_IN";
  guestId?: string;
  eventId?: string;
  replayed?: boolean;
};

export type CheckInFilter = "ALL" | "CHECKED_IN" | "NOT_CHECKED_IN";

const itemStatusSchema = z.enum(["UPCOMING", "IN_PROGRESS", "COMPLETED", "DELAYED", "SKIPPED", "CANCELLED"]);
const dateTimeSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)));

const dashboardItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  scheduled_start: dateTimeSchema,
  scheduled_end: dateTimeSchema.nullable(),
  actual_start: dateTimeSchema.nullable(),
  actual_end: dateTimeSchema.nullable(),
  status: itemStatusSchema,
  sort_order: z.number().int(),
  place_id: z.string().uuid().nullable(),
});

const dashboardPayloadSchema = z.object({
  totalAttending: z.number().int().nonnegative(),
  checkedIn: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  currentItem: dashboardItemSchema.nullable(),
  nextItem: dashboardItemSchema.nullable(),
  delayedItems: z.array(dashboardItemSchema),
});

const checkInPayloadSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("CHECKED_IN"),
    guestId: z.string().uuid(),
    name: z.string().min(1),
    reference: z.string().optional(),
    eventId: z.string().uuid().optional(),
    replayed: z.boolean().optional(),
  }),
  z.object({
    status: z.literal("ALREADY_CHECKED_IN"),
    guestId: z.string().uuid(),
    name: z.string().min(1),
    reference: z.string().optional(),
    eventId: z.string().uuid().optional(),
    replayed: z.boolean().optional(),
  }),
  ...checkInStatuses.slice(2).map((status) => z.object({ status: z.literal(status) })) as [
    z.ZodObject<{ status: z.ZodLiteral<"NOT_RECOGNIZED"> }>,
    z.ZodObject<{ status: z.ZodLiteral<"DIFFERENT_WEDDING"> }>,
    z.ZodObject<{ status: z.ZodLiteral<"REVOKED_PASS"> }>,
    z.ZodObject<{ status: z.ZodLiteral<"DECLINED_REVIEW"> }>,
    z.ZodObject<{ status: z.ZodLiteral<"NO_RESPONSE_REVIEW"> }>,
  ],
]);

const reversalPayloadSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("REVERSED"), guestId: z.string().uuid().optional(), eventId: z.string().uuid().optional(), replayed: z.boolean().optional() }),
  z.object({ status: z.literal("NOT_CHECKED_IN"), guestId: z.string().uuid().optional() }),
]);

export function canAccessWeddingDayCheckIn(membership: WorkspaceMembership | null | undefined): boolean {
  return Boolean(
    membership
    && membership.status === "ACTIVE"
    && membership.weddingId === membership.wedding.id
    && ["OWNER", "FULL_COORDINATOR", "DAY_OF_COORDINATOR", "GUEST_COORDINATOR"].includes(membership.role),
  );
}

export function parseWeddingDayDashboard(value: unknown): WeddingDayDashboard {
  const parsed = dashboardPayloadSchema.safeParse(value);
  if (!parsed.success) throw new Error("Wedding-Day dashboard data is unavailable.");
  const mapItem = (item: z.infer<typeof dashboardItemSchema> | null): WeddingDayItem | null => item ? ({
    id: item.id,
    title: item.title,
    description: item.description,
    scheduledStart: item.scheduled_start,
    scheduledEnd: item.scheduled_end,
    actualStart: item.actual_start,
    actualEnd: item.actual_end,
    status: item.status,
    sortOrder: item.sort_order,
    placeId: item.place_id,
  }) : null;
  return {
    totalAttending: parsed.data.totalAttending,
    checkedIn: parsed.data.checkedIn,
    remaining: parsed.data.remaining,
    currentItem: mapItem(parsed.data.currentItem),
    nextItem: mapItem(parsed.data.nextItem),
    delayedItems: parsed.data.delayedItems.map((item) => mapItem(item)!),
  };
}

export function parseWeddingDayCheckInResult(value: unknown): WeddingDayCheckInResult {
  const parsed = checkInPayloadSchema.safeParse(value);
  if (!parsed.success) throw new Error("Wedding-Day check-in result is unavailable.");
  return parsed.data;
}

export function parseWeddingDayReversalResult(value: unknown): WeddingDayReversalResult {
  const parsed = reversalPayloadSchema.safeParse(value);
  if (!parsed.success) throw new Error("Wedding-Day reversal result is unavailable.");
  return parsed.data;
}

export function filterWeddingDayGuests(
  guests: readonly WeddingDayGuest[],
  search: string,
  filter: CheckInFilter,
): WeddingDayGuest[] {
  const query = search.trim().toLocaleLowerCase();
  return guests.filter((guest) => {
    if (filter === "CHECKED_IN" && !guest.isCheckedIn) return false;
    if (filter === "NOT_CHECKED_IN" && guest.isCheckedIn) return false;
    if (!query) return true;
    return `${guest.displayName} ${guest.householdName}`.toLocaleLowerCase().includes(query);
  });
}

export function checkInResultPresentation(result: WeddingDayCheckInResult): { title: string; detail: string; tone: "success" | "warning" | "error" | "neutral" } {
  switch (result.status) {
    case "CHECKED_IN":
      return { title: "Checked In", detail: [result.name, result.reference].filter(Boolean).join(" · "), tone: "success" };
    case "ALREADY_CHECKED_IN":
      return { title: "Already Checked In", detail: [result.name, result.reference].filter(Boolean).join(" · "), tone: "neutral" };
    case "NOT_RECOGNIZED":
      return { title: "Not Recognized", detail: "This Guest Pass or Guest could not be matched to the selected Wedding.", tone: "error" };
    case "DIFFERENT_WEDDING":
      return { title: "Different Wedding", detail: "This Guest Pass belongs to a different Wedding.", tone: "warning" };
    case "REVOKED_PASS":
      return { title: "Revoked Pass", detail: "Review this Guest Pass with a coordinator. No check-in was recorded.", tone: "warning" };
    case "DECLINED_REVIEW":
      return { title: "Declined RSVP — Review Required", detail: "A person must review this arrival. RSVP was not changed.", tone: "warning" };
    case "NO_RESPONSE_REVIEW":
      return { title: "No Response — Review Required", detail: "A person must review this arrival. RSVP was not changed.", tone: "warning" };
  }
}

export function reversalResultPresentation(result: WeddingDayReversalResult): { title: string; detail: string } {
  return result.status === "REVERSED"
    ? { title: "Check-In Reversed", detail: "A reversal was added to the check-in history." }
    : { title: "Not Checked In", detail: "There is no active check-in to reverse." };
}
