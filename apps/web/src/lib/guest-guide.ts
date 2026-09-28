import { fetchGuestGuide, type RawGuideResult } from "./guest-guide-transport";

export type GuideColor = { hex: string; name: string | null };
export type GuidePlace = { purpose: string; label: string | null; name: string; address: string | null; notes: string | null };
export type GuideAttire = { instructions: string | null; roles: string[]; groups: string[]; colors: GuideColor[] };
export type GuideSection = { key: string; type: "INTRO" | "PLACES" | "DRESS_CODE" | "RSVP" | "CUSTOM";
  audience: "PUBLIC" | "INVITED" | "PERSONALIZED"; content: string | null;
  places: GuidePlace[]; dressCode: { title: string | null; description: string | null; venueAdvice: string | null;
    generalNotes: string | null; recommendedColors: GuideColor[]; avoidColors: GuideColor[]; guestGuidance: GuideAttire[] } | null;
  rsvps: { name: string; status: string }[] };
export type GuestGuide = { slug: string; title: string | null; template: string;
  wedding: { name: string | null; date: string | null; timezone: string | null; location: string | null; partners: string[] };
  sections: GuideSection[]; program: { title: string; description: string | null; scheduledStart: string;
    scheduledEnd: string | null; placeName: string | null }[];
  seating: { eventName: string; tableName: string; seatLabel: string | null; guestName: string | null }[];
  hasGuestPass: boolean };
export type GuestGuideResult = { status: "ready"; guide: GuestGuide } | Exclude<RawGuideResult, { status: "ready" }>;
const templates = new Set(["SAMPAGUITA", "LUNTIAN", "FILIPINIANA", "MODERN_LOVE", "AFTER_DARK"]);
const audiences = new Set(["PUBLIC", "INVITED", "PERSONALIZED"]);
const sectionTypes = new Set(["INTRO", "PLACES", "DRESS_CODE", "RSVP", "CUSTOM"]);
function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function str(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function colors(value: unknown): GuideColor[] { return array(value).flatMap(item => {
  const row = record(item); const hex = str(row?.hex);
  return hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? [{ hex, name: str(row?.name) }] : [];
}); }
function parseAttire(value: unknown): GuideAttire[] { return array(value).flatMap(item => {
  const row = record(item); const guestId = str(row?.guestId);
  if (!guestId) return [];
  return [{ instructions: str(row?.effectiveInstructions),
    roles: array(row?.entourageRoles).flatMap(role => { const name = str(record(role)?.name); return name ? [name] : []; }),
    groups: array(row?.attireGroups).flatMap(group => { const title = str(record(group)?.title); return title ? [title] : []; }),
    colors: colors(row?.effectiveRecommendedColors) }];
}); }
function parseSection(value: unknown, personalized: boolean): GuideSection | null {
  const row = record(value); const type = str(row?.type); const audience = str(row?.audience); const key = str(row?.key);
  if (!type || !sectionTypes.has(type) || !audience || !audiences.has(audience) || !key || (!personalized && audience !== "PUBLIC")) return null;
  const data = record(row?.data);
  return { key, type: type as GuideSection["type"], audience: audience as GuideSection["audience"], content: str(row?.content),
    places: type === "PLACES" ? array(row?.data).flatMap(item => {
      const place = record(item); const name = str(place?.name);
      return name ? [{ purpose: str(place?.purpose) ?? "Place", label: str(place?.label), name,
        address: str(place?.address), notes: str(place?.notes) }] : [];
    }) : [],
    dressCode: type === "DRESS_CODE" && data ? { title: str(data.title), description: str(data.description),
      venueAdvice: str(data.venueAdvice), generalNotes: str(data.generalNotes), recommendedColors: colors(data.recommendedColors),
      avoidColors: colors(data.avoidColors), guestGuidance: personalized ? parseAttire(data.guestGuidance) : [] } : null,
    rsvps: type === "RSVP" && personalized ? array(row?.data).flatMap(item => {
      const guest = record(item); const name = str(guest?.name); const status = str(guest?.status);
      return name && status && ["NO_RESPONSE", "ATTENDING", "DECLINED"].includes(status) ? [{ name, status }] : [];
    }) : [],
  };
}
export function parseGuestGuide(value: unknown, personalized: boolean): GuestGuide | null {
  const row = record(value); const wedding = record(row?.wedding); const slug = str(row?.slug); const template = str(row?.template);
  if (!row || !wedding || !slug || !template || !templates.has(template) || !Array.isArray(row.sections) || !Array.isArray(row.guestProgram)) return null;
  const passNames = new Map<string, string>();
  if (personalized) for (const item of array(row.guestPasses)) { const pass = record(item); const id = str(pass?.guestId); const name = str(pass?.name); if (id && name) passNames.set(id, name); }
  return { slug, template, title: str(row.title),
    wedding: { name: str(wedding.name), date: str(wedding.date), timezone: str(wedding.timezone),
      location: str(wedding.location), partners: array(wedding.partners).flatMap(item => { const name = str(item); return name ? [name] : []; }) },
    sections: row.sections.flatMap(item => { const section = parseSection(item, personalized); return section ? [section] : []; }),
    program: row.guestProgram.flatMap(item => { const program = record(item); const id = str(program?.id); const title = str(program?.title);
      const scheduledStart = str(program?.scheduledStart); return id && title && scheduledStart
        ? [{ title, scheduledStart, scheduledEnd: str(program?.scheduledEnd), description: str(program?.description), placeName: str(program?.placeName) }] : []; }),
    seating: personalized ? array(row.seating).flatMap(item => { const seat = record(item); const eventName = str(seat?.eventName);
      const tableName = str(seat?.tableName); return eventName && tableName ? [{ eventName, tableName,
        seatLabel: str(seat?.seatLabel), guestName: passNames.get(str(seat?.guestId) ?? "") ?? null }] : []; }) : [],
    hasGuestPass: personalized && passNames.size > 0,
  };
}
export async function loadGuestGuide(slug: string, token: string | null,
  dependencies: Parameters<typeof fetchGuestGuide>[2] = {}): Promise<GuestGuideResult> {
  const result = await fetchGuestGuide(slug, token, dependencies);
  if (result.status !== "ready") return result;
  const guide = parseGuestGuide(result.value, token !== null);
  return guide ? { status: "ready", guide } : { status: "unavailable" };
}
