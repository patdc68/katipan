import { z } from "zod";
import type { Database } from "@katipan/database/types";
import type { WorkspaceMembership } from "../workspace/model";

export type WeddingPlace = Database["public"]["Tables"]["wedding_places"]["Row"];
export type WeddingPlacePurpose = Database["public"]["Tables"]["wedding_place_purposes"]["Row"];
export type PlaceType = Database["public"]["Enums"]["wedding_place_type"];
export type PlacePurpose = Database["public"]["Enums"]["wedding_place_purpose"];
export type PlaceSource = Database["public"]["Enums"]["wedding_place_source"];

export type GooglePlaceDetails = {
  placeId: string;
  displayName: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  primaryType: string | null;
  googleMapsUri: string | null;
};

export type WeddingPlaceDetails = {
  place: WeddingPlace;
  purposes: WeddingPlacePurpose[];
  google: GooglePlaceDetails | null;
  googleUnavailable: boolean;
};

export const placeTypes = [
  "CHURCH_RELIGIOUS",
  "GARDEN",
  "BEACH",
  "RESORT",
  "HOTEL",
  "EVENT_SPACE",
  "RESTAURANT",
  "PRIVATE_ESTATE",
  "HOME",
  "CIVIL_VENUE",
  "DESTINATION",
  "OTHER",
] as const satisfies readonly PlaceType[];

export const placePurposes = [
  "CEREMONY",
  "RECEPTION",
  "ACCOMMODATION",
  "PRENUP",
  "GETTING_READY",
  "REHEARSAL",
  "AFTER_PARTY",
  "TRANSPORT",
  "OTHER",
] as const satisfies readonly PlacePurpose[];

export const placeTypeLabels: Record<PlaceType, string> = {
  CHURCH_RELIGIOUS: "Church or religious venue",
  GARDEN: "Garden",
  BEACH: "Beach",
  RESORT: "Resort",
  HOTEL: "Hotel",
  EVENT_SPACE: "Event space",
  RESTAURANT: "Restaurant",
  PRIVATE_ESTATE: "Private estate",
  HOME: "Home",
  CIVIL_VENUE: "Civil venue",
  DESTINATION: "Destination",
  OTHER: "Other",
};

export const purposeLabels: Record<PlacePurpose, string> = {
  CEREMONY: "Ceremony",
  RECEPTION: "Reception",
  ACCOMMODATION: "Accommodation",
  PRENUP: "Prenup",
  GETTING_READY: "Getting ready",
  REHEARSAL: "Rehearsal",
  AFTER_PARTY: "After party",
  TRANSPORT: "Transport",
  OTHER: "Other",
};

const coordinate = z.string().trim().max(40, "Enter a valid coordinate.").refine(
  (value) => value === "" || (value.length > 0 && Number.isFinite(Number(value))),
  "Enter a valid coordinate.",
);

export const placeContextDraftSchema = z.object({
  source: z.enum(["GOOGLE_PLACES", "CUSTOM"]),
  customName: z.string().trim().max(200, "Use 200 characters or fewer."),
  customAddress: z.string().trim().max(500, "Use 500 characters or fewer."),
  latitude: coordinate,
  longitude: coordinate,
  placeType: z.enum(placeTypes),
  userLabel: z.string().trim().max(120, "Use 120 characters or fewer."),
  privateNotes: z.string().trim().max(4000, "Use 4,000 characters or fewer."),
  guestNotes: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
}).superRefine((draft, context) => {
  if (draft.source === "CUSTOM" && draft.customName.length === 0) {
    context.addIssue({ code: "custom", path: ["customName"], message: "Enter a Place name." });
  }
  const hasLatitude = draft.latitude.length > 0;
  const hasLongitude = draft.longitude.length > 0;
  if (hasLatitude !== hasLongitude) {
    context.addIssue({ code: "custom", path: [hasLatitude ? "longitude" : "latitude"], message: "Enter both coordinates or leave both blank." });
  }
  if (hasLatitude && Number(draft.latitude) < -90 || hasLatitude && Number(draft.latitude) > 90) {
    context.addIssue({ code: "custom", path: ["latitude"], message: "Latitude must be between -90 and 90." });
  }
  if (hasLongitude && Number(draft.longitude) < -180 || hasLongitude && Number(draft.longitude) > 180) {
    context.addIssue({ code: "custom", path: ["longitude"], message: "Longitude must be between -180 and 180." });
  }
});

export type PlaceContextDraft = z.input<typeof placeContextDraftSchema>;

export const emptyCustomPlaceDraft: PlaceContextDraft = {
  source: "CUSTOM",
  customName: "",
  customAddress: "",
  latitude: "",
  longitude: "",
  placeType: "OTHER",
  userLabel: "",
  privateNotes: "",
  guestNotes: "",
};

export function contextDraftFromPlace(place: WeddingPlace): PlaceContextDraft {
  return {
    source: place.source,
    customName: place.source === "CUSTOM" ? place.custom_name ?? "" : "",
    customAddress: place.source === "CUSTOM" ? place.custom_address ?? "" : "",
    latitude: place.source === "CUSTOM" && place.custom_latitude !== null ? String(place.custom_latitude) : "",
    longitude: place.source === "CUSTOM" && place.custom_longitude !== null ? String(place.custom_longitude) : "",
    placeType: place.place_type,
    userLabel: place.user_label ?? "",
    privateNotes: place.private_notes ?? "",
    guestNotes: place.guest_notes ?? "",
  };
}

export type PlaceContextRpcFields = {
  p_custom_name: string | null;
  p_custom_address: string | null;
  p_custom_latitude: number | null;
  p_custom_longitude: number | null;
  p_place_type: PlaceType;
  p_user_label: string | null;
  p_private_notes: string | null;
  p_guest_notes: string | null;
};

export function contextRpcFields(draft: PlaceContextDraft): PlaceContextRpcFields {
  const value = placeContextDraftSchema.parse(draft);
  const custom = value.source === "CUSTOM";
  return {
    p_custom_name: custom ? value.customName : null,
    p_custom_address: custom && value.customAddress ? value.customAddress : null,
    p_custom_latitude: custom && value.latitude ? Number(value.latitude) : null,
    p_custom_longitude: custom && value.longitude ? Number(value.longitude) : null,
    p_place_type: value.placeType,
    p_user_label: value.userLabel || null,
    p_private_notes: value.privateNotes || null,
    p_guest_notes: value.guestNotes || null,
  };
}

export const placePurposeDraftSchema = z.object({
  sortOrder: z.number().int().nonnegative("Choose a valid order."),
  guestVisible: z.boolean(),
  purposeLabel: z.string().trim().max(120, "Use 120 characters or fewer."),
  privateNotes: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
  guestNotes: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
});
export type PlacePurposeDraft = z.infer<typeof placePurposeDraftSchema>;

export function purposeDraftFromRow(row: WeddingPlacePurpose): PlacePurposeDraft {
  return {
    sortOrder: row.sort_order,
    guestVisible: row.guest_visible,
    purposeLabel: row.purpose_label ?? "",
    privateNotes: row.private_notes ?? "",
    guestNotes: row.guest_notes ?? "",
  };
}

export function canViewPlaces(membership: WorkspaceMembership | null | undefined): boolean {
  return Boolean(membership
    && membership.status === "ACTIVE"
    && membership.weddingId === membership.wedding.id);
}

export function canManagePlaces(membership: WorkspaceMembership | null | undefined): boolean {
  return Boolean(canViewPlaces(membership)
    && membership
    && (membership.role === "OWNER" || membership.role === "FULL_COORDINATOR"));
}

export function normalizedPlaceQuery(query: string): string | null {
  const value = query.trim();
  return value.length >= 2 && value.length <= 200 ? value : null;
}

export const placeSearchDebounceMs = 350;

export function schedulePlaceSearch(
  query: string,
  search: (normalizedQuery: string) => void,
  delay = placeSearchDebounceMs,
): () => void {
  const normalized = normalizedPlaceQuery(query);
  if (!normalized) return () => undefined;
  const timer = setTimeout(() => search(normalized), delay);
  return () => clearTimeout(timer);
}

export function placesRequestKey(
  weddingId: string,
  membershipId: string | null | undefined,
  cacheRevision: number,
  attempt: number,
): string {
  return [weddingId, membershipId ?? "none", cacheRevision, attempt].join(":");
}

/** Stops fast repeated taps from issuing duplicate Place mutations. */
export class PlaceSubmitGate {
  private pending = false;

  async run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (this.pending) return undefined;
    this.pending = true;
    try {
      return await action();
    } finally {
      this.pending = false;
    }
  }
}

export function safePlaceError(error: unknown, fallback = "We couldn't save this Place change. Try again."): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the Place details.";
  if (!error || typeof error !== "object" || !("code" in error)) return fallback;
  switch (error.code) {
    case "42501": return "Your Wedding role can view Places but cannot change them.";
    case "23514": return "This Place is archived and cannot be changed.";
    case "23505": return "This Google Place is already saved in this Wedding.";
    case "22023": return "This Place is no longer active in this Wedding.";
    default: return fallback;
  }
}

export function purposeVisibilitySummary(purposes: readonly WeddingPlacePurpose[]): string {
  const visible = purposes.filter((purpose) => purpose.guest_visible).length;
  if (visible === 0) return "No purpose is eligible for the Guest Guide";
  return `${visible} ${visible === 1 ? "purpose" : "purposes"} eligible for the Guest Guide`;
}

export function placeTitle(place: WeddingPlace, google: GooglePlaceDetails | null): string {
  if (place.source === "CUSTOM") return place.custom_name ?? "Custom Place";
  return google?.displayName ?? place.user_label ?? "Saved Google Place";
}

export function placeAddress(place: WeddingPlace, google: GooglePlaceDetails | null): string | null {
  if (place.source === "CUSTOM") return place.custom_address;
  return google?.formattedAddress ?? null;
}
