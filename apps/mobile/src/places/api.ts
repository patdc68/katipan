import { z } from "zod";
import { supabase } from "../auth/client";
import type { WorkspaceMembership } from "../workspace/model";
import type { Database } from "@katipan/database/types";
import {
  canManagePlaces,
  canViewPlaces,
  contextRpcFields,
  normalizedPlaceQuery,
  placeContextDraftSchema,
  placePurposeDraftSchema,
  type GooglePlaceDetails,
  type PlaceContextDraft,
  type PlacePurpose,
  type PlacePurposeDraft,
  type WeddingPlace,
  type WeddingPlaceDetails,
  type WeddingPlacePurpose,
} from "./model";

const googlePlaceSchema = z.object({
  placeId: z.string().trim().min(1).max(512),
  displayName: z.string().trim().nullable(),
  formattedAddress: z.string().trim().nullable(),
  latitude: z.number().finite().nullable(),
  longitude: z.number().finite().nullable(),
  primaryType: z.string().trim().nullable(),
  googleMapsUri: z.string().url().refine((value) => {
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }).nullable(),
});
const googleSearchSchema = z.object({ places: z.array(googlePlaceSchema).max(10) });

function assertMember(membership: WorkspaceMembership): void {
  if (!canViewPlaces(membership)) throw new Error("This Wedding workspace is unavailable.");
}

function assertManager(membership: WorkspaceMembership): void {
  assertMember(membership);
  if (!canManagePlaces(membership)) {
    throw Object.assign(new Error("Place management is not permitted."), { code: "42501" });
  }
}

async function currentGoogleDetails(
  membership: WorkspaceMembership,
  googlePlaceId: string,
): Promise<GooglePlaceDetails> {
  const { data, error } = await supabase.functions.invoke("google-place-details", {
    body: { weddingId: membership.weddingId, placeId: googlePlaceId },
  });
  if (error) throw error;
  const place = googlePlaceSchema.parse(data);
  if (place.placeId !== googlePlaceId) throw new Error("Google Place details did not match the saved Place.");
  return place;
}

async function loadActivePlace(
  membership: WorkspaceMembership,
  placeId: string,
): Promise<WeddingPlace> {
  const { data, error } = await supabase.from("wedding_places")
    .select("*")
    .eq("wedding_id", membership.weddingId)
    .eq("id", placeId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== membership.weddingId || data.archived_at !== null) {
    throw Object.assign(new Error("Active Place not found in this Wedding."), { code: "22023" });
  }
  return data;
}

async function purposesForPlace(
  membership: WorkspaceMembership,
  placeId: string,
): Promise<WeddingPlacePurpose[]> {
  const { data, error } = await supabase.from("wedding_place_purposes")
    .select("*")
    .eq("wedding_id", membership.weddingId)
    .eq("place_id", placeId)
    .order("sort_order", { ascending: true })
    .order("purpose", { ascending: true });
  if (error) throw error;
  return (data ?? []).filter((row) => row.wedding_id === membership.weddingId && row.place_id === placeId);
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const pending = [...values];
  const output = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(limit, pending.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      const value = pending[index];
      if (value !== undefined) output[index] = await mapper(value);
    }
  }));
  return output;
}

export async function loadPlaces(membership: WorkspaceMembership): Promise<WeddingPlaceDetails[]> {
  assertMember(membership);
  const [placesResult, purposesResult] = await Promise.all([
    supabase.from("wedding_places").select("*")
      .eq("wedding_id", membership.weddingId)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase.from("wedding_place_purposes").select("*")
      .eq("wedding_id", membership.weddingId)
      .order("sort_order", { ascending: true })
      .order("purpose", { ascending: true }),
  ]);
  if (placesResult.error) throw placesResult.error;
  if (purposesResult.error) throw purposesResult.error;

  const places = (placesResult.data ?? []).filter((place) =>
    place.wedding_id === membership.weddingId && place.archived_at === null);
  const purposes = (purposesResult.data ?? []).filter((purpose) => purpose.wedding_id === membership.weddingId);
  return mapWithConcurrency(places, 3, async (place) => {
    let google: GooglePlaceDetails | null = null;
    let googleUnavailable = false;
    if (place.source === "GOOGLE_PLACES" && place.google_place_id) {
      try {
        google = await currentGoogleDetails(membership, place.google_place_id);
      } catch {
        googleUnavailable = true;
      }
    }
    return {
      place,
      purposes: purposes.filter((purpose) => purpose.place_id === place.id),
      google,
      googleUnavailable,
    };
  });
}

export async function loadPlaceDetails(
  membership: WorkspaceMembership,
  placeId: string,
): Promise<WeddingPlaceDetails> {
  assertMember(membership);
  const place = await loadActivePlace(membership, placeId);
  const purposes = await purposesForPlace(membership, placeId);
  let google: GooglePlaceDetails | null = null;
  let googleUnavailable = false;
  if (place.source === "GOOGLE_PLACES" && place.google_place_id) {
    try {
      google = await currentGoogleDetails(membership, place.google_place_id);
      if (canManagePlaces(membership)) {
        try { await supabase.rpc("mark_google_wedding_place_refreshed", { p_place_id: place.id }); } catch { /* The current Google response is still usable. */ }
      }
    } catch {
      googleUnavailable = true;
    }
  }
  return { place, purposes, google, googleUnavailable };
}

export async function searchGooglePlaces(
  membership: WorkspaceMembership,
  query: string,
): Promise<GooglePlaceDetails[]> {
  assertMember(membership);
  const normalized = normalizedPlaceQuery(query);
  if (!normalized) throw Object.assign(new Error("Enter at least two characters to search."), { code: "PLACE_QUERY" });
  const { data, error } = await supabase.functions.invoke("google-places-search", {
    body: { weddingId: membership.weddingId, query: normalized },
  });
  if (error) throw error;
  return googleSearchSchema.parse(data).places;
}

async function findSavedGooglePlace(
  membership: WorkspaceMembership,
  googlePlaceId: string,
): Promise<WeddingPlace | null> {
  const { data, error } = await supabase.from("wedding_places").select("*")
    .eq("wedding_id", membership.weddingId)
    .eq("source", "GOOGLE_PLACES")
    .eq("google_place_id", googlePlaceId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  return data?.wedding_id === membership.weddingId && data.archived_at === null ? data : null;
}

export async function saveGooglePlace(
  membership: WorkspaceMembership,
  googlePlaceId: string,
): Promise<{ placeId: string; alreadySaved: boolean }> {
  assertManager(membership);
  const placeId = z.string().trim().min(1).max(512).parse(googlePlaceId);
  const existing = await findSavedGooglePlace(membership, placeId);
  if (existing) return { placeId: existing.id, alreadySaved: true };

  const args: Database["public"]["Functions"]["create_google_wedding_place"]["Args"] = {
    p_wedding_id: membership.weddingId,
    p_google_place_id: placeId,
    p_place_type: "OTHER",
    p_user_label: null as unknown as string,
    p_private_notes: null as unknown as string,
    p_guest_notes: null as unknown as string,
  };
  const { data, error } = await supabase.rpc("create_google_wedding_place", args);
  if (!error && data) return { placeId: data, alreadySaved: false };
  if (error?.code === "23505") {
    const racedPlace = await findSavedGooglePlace(membership, placeId);
    if (racedPlace) return { placeId: racedPlace.id, alreadySaved: true };
  }
  if (error) throw error;
  throw new Error("Google Place could not be saved.");
}

export async function createCustomPlace(
  membership: WorkspaceMembership,
  draft: PlaceContextDraft,
): Promise<string> {
  assertManager(membership);
  const value = placeContextDraftSchema.parse({ ...draft, source: "CUSTOM" });
  const fields = contextRpcFields(value);
  const args = {
    p_wedding_id: membership.weddingId,
    p_custom_name: fields.p_custom_name ?? "",
    p_place_type: fields.p_place_type,
    p_custom_address: fields.p_custom_address,
    p_custom_latitude: fields.p_custom_latitude,
    p_custom_longitude: fields.p_custom_longitude,
    p_user_label: fields.p_user_label,
    p_private_notes: fields.p_private_notes,
    p_guest_notes: fields.p_guest_notes,
  };
  const { data, error } = await supabase.rpc(
    "create_custom_wedding_place",
    args as unknown as Database["public"]["Functions"]["create_custom_wedding_place"]["Args"],
  );
  if (error) throw error;
  if (!data) throw new Error("Custom Place could not be saved.");
  return data;
}

export async function updatePlaceContext(
  membership: WorkspaceMembership,
  placeId: string,
  draft: PlaceContextDraft,
): Promise<void> {
  assertManager(membership);
  const place = await loadActivePlace(membership, placeId);
  const value = placeContextDraftSchema.parse({ ...draft, source: place.source });
  const fields = contextRpcFields(value);
  const args = { p_place_id: place.id, ...fields };
  const { error } = await supabase.rpc(
    "update_wedding_place_context",
    args as unknown as Database["public"]["Functions"]["update_wedding_place_context"]["Args"],
  );
  if (error) throw error;
}

async function assertPurposePlace(membership: WorkspaceMembership, placeId: string): Promise<void> {
  assertManager(membership);
  await loadActivePlace(membership, placeId);
}

export async function savePlacePurpose(
  membership: WorkspaceMembership,
  placeId: string,
  purpose: PlacePurpose,
  draft: PlacePurposeDraft,
): Promise<void> {
  await assertPurposePlace(membership, placeId);
  const value = placePurposeDraftSchema.parse(draft);
  const args = {
    p_place_id: placeId,
    p_purpose: purpose,
    p_sort_order: value.sortOrder,
    p_guest_visible: value.guestVisible,
    p_purpose_label: value.purposeLabel || null,
    p_private_notes: value.privateNotes || null,
    p_guest_notes: value.guestNotes || null,
  };
  const { error } = await supabase.rpc(
    "set_wedding_place_purpose",
    args as unknown as Database["public"]["Functions"]["set_wedding_place_purpose"]["Args"],
  );
  if (error) throw error;
}

export async function removePlacePurpose(
  membership: WorkspaceMembership,
  placeId: string,
  purpose: PlacePurpose,
): Promise<void> {
  await assertPurposePlace(membership, placeId);
  const { error } = await supabase.rpc("remove_wedding_place_purpose", {
    p_place_id: placeId,
    p_purpose: purpose,
  });
  if (error) throw error;
}

export async function archivePlace(membership: WorkspaceMembership, placeId: string): Promise<void> {
  assertManager(membership);
  await loadActivePlace(membership, placeId);
  const { error } = await supabase.rpc("archive_wedding_place", { p_place_id: placeId });
  if (error) throw error;
}
