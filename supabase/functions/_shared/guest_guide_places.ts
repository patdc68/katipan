import { fetchGooglePlaceDetails, type GooglePlaceDto } from "./google_places.ts";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// The input is the successful, access-checked service-only Guide projection.
// Request fields are never used as Google identifiers.
export async function hydrateGuestGuidePlaces(
  projection: unknown,
  apiKey: string | undefined,
  fetcher: typeof fetch,
): Promise<unknown> {
  const guide = record(projection);
  if (!guide || !apiKey) return projection;

  const sections = Array.isArray(guide.sections) ? guide.sections : [];
  const program = Array.isArray(guide.guestProgram) ? guide.guestProgram : [];
  const ids = new Set<string>();
  for (const value of sections) {
    const section = record(value);
    if (section?.type !== "PLACES" || !Array.isArray(section.data)) continue;
    for (const item of section.data) {
      const id = nonEmpty(record(item)?.googlePlaceId);
      if (id) ids.add(id);
    }
  }
  for (const item of program) {
    const id = nonEmpty(record(item)?.googlePlaceId);
    if (id) ids.add(id);
  }

  const details = new Map<string, GooglePlaceDto>();
  const pending = [...ids];
  // Three workers bound the number of simultaneous upstream calls per request.
  await Promise.all(Array.from({ length: Math.min(3, pending.length) }, async () => {
    while (pending.length) {
      const id = pending.shift()!;
      try {
        const result = await fetchGooglePlaceDetails(
          id, apiKey, fetcher, undefined, undefined, AbortSignal.timeout(5000),
        );
        if (result.place) details.set(id, result.place);
      } catch {
        // Keep the already-sanitized database projection when Google is unavailable.
      }
    }
  }));

  return {
    ...guide,
    sections: sections.map((value) => {
      const section = record(value);
      if (section?.type !== "PLACES" || !Array.isArray(section.data)) return value;
      return { ...section, data: section.data.map((item) => {
        const place = record(item);
        const id = nonEmpty(place?.googlePlaceId);
        const google = id ? details.get(id) : null;
        if (!place || !google) return item;
        return {
          ...place,
          name: nonEmpty(place.name) ?? google.displayName,
          address: google.formattedAddress,
        };
      }) };
    }),
    guestProgram: program.map((item) => {
      const entry = record(item);
      const id = nonEmpty(entry?.googlePlaceId);
      const google = id ? details.get(id) : null;
      if (!entry || !google) return item;
      return { ...entry, placeName: nonEmpty(entry.placeName) ?? google.displayName };
    }),
  };
}
