export type GuestPassSeating = {
  eventName: string;
  tableName: string;
  seatLabel?: string;
};

export type GuestPassProjection = {
  guestId: string;
  name: string;
  reference: string;
  qrPayload: string;
  seating: GuestPassSeating[];
};

export type GuestPassGuide = {
  weddingName: string | null;
  weddingDate: string | null;
  websiteTitle: string | null;
  passes: GuestPassProjection[];
};

export type GuestPassGuideResult =
  | { status: "ready"; guide: GuestPassGuide }
  | { status: "empty" }
  | { status: "invalid-invitation" }
  | { status: "unavailable" };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const tokenPattern = /^[0-9a-f]{64}$/;
const guestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const referencePattern = /^K[0-9A-F]{4}-[0-9A-F]{4}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseSeating(value: unknown): GuestPassSeating[] | null {
  if (!Array.isArray(value)) return null;
  const seating: GuestPassSeating[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.eventName !== "string" || typeof item.tableName !== "string") return null;
    if (item.seatLabel !== undefined && typeof item.seatLabel !== "string") return null;
    seating.push({
      eventName: item.eventName,
      tableName: item.tableName,
      ...(typeof item.seatLabel === "string" ? { seatLabel: item.seatLabel } : {}),
    });
  }
  return seating;
}

function parsePass(value: unknown): GuestPassProjection | null {
  if (!isRecord(value)
    || typeof value.guestId !== "string" || !guestIdPattern.test(value.guestId)
    || typeof value.name !== "string" || value.name.trim().length === 0 || value.name.length > 160
    || typeof value.reference !== "string" || !referencePattern.test(value.reference)
    || typeof value.qrPayload !== "string" || !tokenPattern.test(value.qrPayload)) return null;
  const seating = parseSeating(value.seating);
  if (!seating) return null;
  return {
    guestId: value.guestId,
    name: value.name,
    reference: value.reference,
    qrPayload: value.qrPayload,
    seating,
  };
}

export function parseGuestPassGuide(value: unknown): GuestPassGuide | null {
  if (!isRecord(value) || !Array.isArray(value.guestPasses) || !isRecord(value.wedding)) return null;
  const wedding = value.wedding;
  const passes: GuestPassProjection[] = [];
  const guestIds = new Set<string>();
  for (const candidate of value.guestPasses) {
    const pass = parsePass(candidate);
    if (!pass || guestIds.has(pass.guestId)) return null;
    guestIds.add(pass.guestId);
    passes.push(pass);
  }
  return {
    weddingName: nullableString(wedding.name),
    weddingDate: nullableString(wedding.date),
    websiteTitle: nullableString(value.title),
    passes,
  };
}

export function isHouseholdInvitationToken(value: unknown): value is string {
  return typeof value === "string" && tokenPattern.test(value);
}

export function selectGuestPass(passes: readonly GuestPassProjection[], guestId: string): GuestPassProjection | null {
  return passes.find((pass) => pass.guestId === guestId) ?? passes[0] ?? null;
}

export async function loadGuestPassGuide(
  slug: string,
  invitationToken: string,
  dependencies: {
    fetcher?: typeof fetch;
    supabaseUrl?: string;
    publishableKey?: string;
  } = {},
): Promise<GuestPassGuideResult> {
  if (!slugPattern.test(slug) || !isHouseholdInvitationToken(invitationToken)) {
    return { status: "invalid-invitation" };
  }
  const supabaseUrl = dependencies.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = dependencies.publishableKey ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return { status: "unavailable" };
  const fetcher = dependencies.fetcher ?? fetch;
  try {
    const response = await fetcher(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/guest-wedding-guide`, {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ slug, invitationToken }),
      cache: "no-store",
    });
    if (response.status === 403) return { status: "invalid-invitation" };
    if (!response.ok) return { status: "unavailable" };
    const guide = parseGuestPassGuide(await response.json());
    if (!guide) return { status: "unavailable" };
    return guide.passes.length ? { status: "ready", guide } : { status: "empty" };
  } catch {
    return { status: "unavailable" };
  }
}
