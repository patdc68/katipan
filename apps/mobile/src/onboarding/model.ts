import { z } from "zod";
import type { Database } from "@katipan/database/types";

export type CeremonyStyle = Database["public"]["Enums"]["ceremony_style"];
export const ceremonyStyles = ["UNDECIDED", "RELIGIOUS", "CIVIL", "SYMBOLIC", "SECULAR", "DESTINATION", "OTHER"] as const satisfies readonly CeremonyStyle[];
export const weddingDraftSchema = z.object({
  currentName: z.string().trim().min(1, "Enter your name.").max(120),
  partnerName: z.string().trim().max(120),
  weddingName: z.string().trim().min(1, "Enter a name for your wedding.").max(160),
  date: z.string().refine(value => {
    if (!value) return true;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.toISOString().slice(0, 10) === value;
  }, "Use a valid YYYY-MM-DD date."),
  location: z.string().trim().max(200),
  guestCount: z.number().int().min(0).max(100000).nullable(),
  ceremonyStyle: z.enum(ceremonyStyles),
  targetBudget: z.string(), // Preview only. There is no wedding-wide target budget contract.
});
export type WeddingDraft = z.infer<typeof weddingDraftSchema>;
export const emptyDraft: WeddingDraft = { currentName: "", partnerName: "", weddingName: "", date: "", location: "", guestCount: null, ceremonyStyle: "UNDECIDED", targetBudget: "" };

export function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function calendarDateToIso(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatWeddingDate(value: string, locale?: string): string {
  const date = parseCalendarDate(value);
  if (!date) return "";
  const stableCalendarDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
  return new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(stableCalendarDate);
}

export function weddingDateForSubmit(date: string, noDateChosen: boolean): string {
  return noDateChosen ? "" : date;
}

export function weddingRpcArgs(draft: WeddingDraft) {
  const value = weddingDraftSchema.parse(draft);
  return {
    p_wedding_display_name: value.weddingName,
    p_current_partner_display_name: value.currentName,
    p_second_partner_display_name: value.partnerName || undefined,
    p_wedding_date: value.date || undefined,
    p_timezone: "Asia/Manila",
    p_general_location: value.location || undefined,
    p_estimated_guest_count: value.guestCount ?? undefined,
    p_ceremony_style: value.ceremonyStyle,
  };
}

export type CreatedWedding = { weddingId: string; currentPersonId: string; secondPartnerPersonId: string | null };
export type AccessRoute = "welcome" | "auth" | "create-wedding" | "wedding-details" | "motif-complete" | "invite-partner";
export function allowedRoute(requested: AccessRoute, authenticated: boolean, stage: "start" | "details" | "created", motifDone = false): AccessRoute {
  if (!authenticated) return requested === "auth" ? "auth" : "welcome";
  if (stage === "created") return motifDone ? "invite-partner" : "motif-complete";
  if (stage === "details") return requested === "wedding-details" ? requested : "wedding-details";
  return requested === "create-wedding" ? requested : "create-wedding";
}

export function friendlyError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error && error.code === "42501") return "Your session has expired or you do not have access. Please sign in again.";
  return fallback;
}

export class SingleFlight<T> {
  private pending: Promise<T> | null = null;
  run(action: () => Promise<T>): Promise<T> {
    if (this.pending) return this.pending;
    this.pending = action().finally(() => { this.pending = null; });
    return this.pending;
  }
}

/** Keeps Skip and invitation issuance mutually exclusive, even on rapid taps. */
export class InvitationGate {
  private skipped = false;
  private pending = false;
  get canStart() { return !this.skipped && !this.pending; }
  skip() {
    if (this.pending) return false;
    this.skipped = true;
    return true;
  }
  async run<T>(action: () => Promise<T>): Promise<T | null> {
    if (!this.canStart) return null;
    this.pending = true;
    try { return await action(); }
    finally { this.pending = false; }
  }
}
