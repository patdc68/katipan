import { fetchGuestGuide, type RawGuideResult } from "./guest-guide-transport";

export const GUEST_RSVP_CHOICES = ["ATTENDING", "DECLINED"] as const;
export type GuestRsvpChoice = (typeof GUEST_RSVP_CHOICES)[number];
export type GuestRsvpStatus = GuestRsvpChoice | "NO_RESPONSE";

export type GuestRsvpGuest = {
  guestId: string;
  name: string;
  status: GuestRsvpStatus;
  mealChoice: string | null;
  dietaryNotes: string | null;
  responseNotes: string | null;
};

export type GuestRsvpSummaryGuest = Pick<GuestRsvpGuest, "guestId" | "name" | "status">;

type GuestRsvpProjectionBase = {
  slug: string;
  title: string | null;
  template: string;
  weddingName: string | null;
  weddingDate: string | null;
  timezone: string | null;
  location: string | null;
  partners: string[];
  hasRsvpSection: boolean;
  hasGuestPass: boolean;
};

export type GuestRsvpProjection = GuestRsvpProjectionBase & { guests: GuestRsvpGuest[] };
export type GuestRsvpSummary = GuestRsvpProjectionBase & { guests: GuestRsvpSummaryGuest[] };

export type GuestRsvpLoadResult =
  | { status: "ready"; projection: GuestRsvpProjection }
  | Exclude<RawGuideResult, { status: "ready" }>;

export type GuestRsvpSummaryLoadResult =
  | { status: "ready"; summary: GuestRsvpSummary }
  | Exclude<RawGuideResult, { status: "ready" }>;

export type GuestRoute = "" | "/invitation" | "/rsvp" | "/rsvp/confirmation" | "/pass";

const tokenPattern = /^[0-9a-f]{64}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const guestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const templates = new Set(["SAMPAGUITA", "LUNTIAN", "FILIPINIANA", "MODERN_LOVE", "AFTER_DARK"]);
const statuses = new Set<GuestRsvpStatus>(["NO_RESPONSE", "ATTENDING", "DECLINED"]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nullableText(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "string" && value.length <= 2000 ? value : undefined;
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseGuest(value: unknown): GuestRsvpGuest | null {
  const row = record(value);
  const guestId = nonEmptyText(row?.guestId);
  const name = nonEmptyText(row?.name);
  const status = nonEmptyText(row?.status);
  if (!guestId || !guestIdPattern.test(guestId) || !name || name.length > 160
    || !status || !statuses.has(status as GuestRsvpStatus)) return null;

  const mealChoice = nullableText(row?.mealChoice);
  const dietaryNotes = nullableText(row?.dietaryNotes);
  const responseNotes = nullableText(row?.responseNotes);
  if (mealChoice === undefined || dietaryNotes === undefined || responseNotes === undefined) return null;

  return {
    guestId,
    name,
    status: status as GuestRsvpStatus,
    mealChoice,
    dietaryNotes,
    responseNotes,
  };
}

export function parseGuestRsvpProjection(value: unknown, expectedSlug: string): GuestRsvpProjection | null {
  const row = record(value);
  const wedding = record(row?.wedding);
  const slug = nonEmptyText(row?.slug);
  const template = nonEmptyText(row?.template);
  if (!row || !wedding || !slug || slug !== expectedSlug || !slugPattern.test(slug)
    || !template || !templates.has(template)) return null;

  const seenGuests = new Map<string, GuestRsvpGuest>();
  let hasRsvpSection = false;
  for (const item of list(row.sections)) {
    const section = record(item);
    if (section?.type !== "RSVP") continue;
    hasRsvpSection = true;
    for (const candidate of list(section.data)) {
      const guest = parseGuest(candidate);
      // The sanitized projection contains real Guests only. Malformed or unnamed
      // entries, including any future allowance-shaped row, are never rendered.
      if (!guest) continue;
      const previous = seenGuests.get(guest.guestId);
      if (previous && JSON.stringify(previous) !== JSON.stringify(guest)) return null;
      seenGuests.set(guest.guestId, guest);
    }
  }

  const weddingDate = nonEmptyText(wedding.date);
  const partners = list(wedding.partners).flatMap((item) => {
    const partner = nonEmptyText(item);
    return partner ? [partner] : [];
  });
  const guestPasses = row.guestPasses;

  return {
    slug,
    title: nonEmptyText(row.title),
    template,
    weddingName: nonEmptyText(wedding.name),
    weddingDate,
    timezone: nonEmptyText(wedding.timezone),
    location: nonEmptyText(wedding.location),
    partners,
    hasRsvpSection,
    hasGuestPass: Array.isArray(guestPasses) && guestPasses.length > 0,
    guests: [...seenGuests.values()],
  };
}

export function isHouseholdInvitationToken(value: unknown): value is string {
  return typeof value === "string" && tokenPattern.test(value);
}

export function guestRouteHref(slug: string, route: GuestRoute, token: string | null): string {
  const path = `/w/${encodeURIComponent(slug)}${route}`;
  return isHouseholdInvitationToken(token) ? `${path}?token=${encodeURIComponent(token)}` : path;
}

export function countResponded(guests: readonly Pick<GuestRsvpGuest, "status">[]): number {
  return guests.filter((guest) => guest.status !== "NO_RESPONSE").length;
}

export function formatGuestRsvpStatus(status: GuestRsvpStatus): string {
  if (status === "NO_RESPONSE") return "Not responded yet";
  return status === "ATTENDING" ? "Attending" : "Declined";
}

export function tryBeginGuestRsvpSubmit(inFlight: Set<string>, guestId: string): boolean {
  if (inFlight.has(guestId)) return false;
  inFlight.add(guestId);
  return true;
}

async function loadProjection(
  slug: string,
  token: string | null,
  dependencies: Parameters<typeof fetchGuestGuide>[2],
): Promise<GuestRsvpLoadResult> {
  if (!isHouseholdInvitationToken(token)) return { status: "invalid-invitation" };
  const result = await fetchGuestGuide(slug, token, dependencies);
  if (result.status !== "ready") return result;
  const projection = parseGuestRsvpProjection(result.value, slug);
  return projection ? { status: "ready", projection } : { status: "unavailable" };
}

export function loadGuestRsvpForm(
  slug: string,
  token: string | null,
  dependencies: Parameters<typeof fetchGuestGuide>[2] = {},
): Promise<GuestRsvpLoadResult> {
  return loadProjection(slug, token, dependencies);
}

export async function loadGuestRsvpSummary(
  slug: string,
  token: string | null,
  dependencies: Parameters<typeof fetchGuestGuide>[2] = {},
): Promise<GuestRsvpSummaryLoadResult> {
  const result = await loadProjection(slug, token, dependencies);
  if (result.status !== "ready") return result;
  const { guests, ...base } = result.projection;
  return {
    status: "ready",
    summary: {
      ...base,
      guests: guests.map(({ guestId, name, status }) => ({ guestId, name, status })),
    },
  };
}
