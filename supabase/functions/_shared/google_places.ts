export type GooglePlacesOperation = "search" | "details";

export type GooglePlaceDto = {
  placeId: string;
  displayName: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  primaryType: string | null;
  googleMapsUri: string | null;
};

export type GooglePlacesDependencies = {
  fetch: typeof fetch;
  envGet: (name: string) => string | undefined;
};

const jsonHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json; charset=utf-8",
};

const searchFieldMask = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.googleMapsUri",
].join(",");

const detailsFieldMask = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "primaryType",
  "googleMapsUri",
].join(",");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function optionalCode(value: unknown, pattern: RegExp): string | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !pattern.test(value)) return null;
  return value;
}

function resolvePublicApiKey(envGet: GooglePlacesDependencies["envGet"]): string | undefined {
  const direct = envGet("SUPABASE_PUBLISHABLE_KEY") ?? envGet("SUPABASE_ANON_KEY");
  if (direct) return direct;

  const configured = envGet("SUPABASE_PUBLISHABLE_KEYS");
  if (!configured) return undefined;

  try {
    const parsed: unknown = JSON.parse(configured);
    if (!isRecord(parsed) || typeof parsed.default !== "string") return undefined;
    return parsed.default.startsWith("sb_")
      ? parsed.default
      : envGet(parsed.default);
  } catch {
    return undefined;
  }
}

function sanitizePlace(value: unknown): GooglePlaceDto | null {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) {
    return null;
  }

  const displayName = isRecord(value.displayName) && typeof value.displayName.text === "string"
    ? value.displayName.text
    : null;
  const location = isRecord(value.location) ? value.location : null;
  const latitude = typeof location?.latitude === "number" && Number.isFinite(location.latitude)
    ? location.latitude
    : null;
  const longitude = typeof location?.longitude === "number" && Number.isFinite(location.longitude)
    ? location.longitude
    : null;

  return {
    placeId: value.id,
    displayName,
    formattedAddress: typeof value.formattedAddress === "string" ? value.formattedAddress : null,
    latitude,
    longitude,
    primaryType: typeof value.primaryType === "string" ? value.primaryType : null,
    googleMapsUri: typeof value.googleMapsUri === "string" ? value.googleMapsUri : null,
  };
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function authorizeWeddingMembership(
  authorization: string,
  weddingId: string,
  deps: GooglePlacesDependencies,
): Promise<Response | null> {
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return errorResponse(401, "UNAUTHENTICATED", "A valid user access token is required.");
  }

  const supabaseUrl = deps.envGet("SUPABASE_URL")?.replace(/\/$/, "");
  const publicApiKey = resolvePublicApiKey(deps.envGet);
  if (!supabaseUrl || !publicApiKey) {
    return errorResponse(500, "SERVER_MISCONFIGURED", "The service is not configured.");
  }

  const supabaseHeaders = {
    Authorization: authorization,
    apikey: publicApiKey,
  };

  const userResponse = await deps.fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: supabaseHeaders,
  });
  if (!userResponse.ok) {
    return errorResponse(401, "UNAUTHENTICATED", "A valid user access token is required.");
  }

  const weddingUrl = new URL(`${supabaseUrl}/rest/v1/weddings`);
  weddingUrl.searchParams.set("id", `eq.${weddingId}`);
  weddingUrl.searchParams.set("select", "id");
  weddingUrl.searchParams.set("limit", "1");

  const membershipResponse = await deps.fetch(weddingUrl, {
    method: "GET",
    headers: supabaseHeaders,
  });
  if (!membershipResponse.ok) {
    return errorResponse(502, "MEMBERSHIP_CHECK_FAILED", "Wedding access could not be verified.");
  }

  const rows = await parseJson(membershipResponse);
  if (!Array.isArray(rows) || rows.length !== 1) {
    return errorResponse(403, "WEDDING_ACCESS_DENIED", "Active Wedding membership is required.");
  }

  return null;
}

async function callGoogleSearch(
  body: Record<string, unknown>,
  apiKey: string,
  deps: GooglePlacesDependencies,
): Promise<Response> {
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 2 || query.length > 200) {
    return errorResponse(400, "INVALID_QUERY", "Query must contain 2 to 200 characters.");
  }

  const languageCode = optionalCode(body.languageCode, /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);
  const regionCode = optionalCode(body.regionCode, /^[A-Za-z]{2}$/);
  if (languageCode === null || regionCode === null) {
    return errorResponse(400, "INVALID_LOCALE", "Language or region code is invalid.");
  }

  const googleBody: Record<string, unknown> = { textQuery: query, pageSize: 10 };
  if (languageCode) googleBody.languageCode = languageCode;
  if (regionCode) googleBody.regionCode = regionCode.toUpperCase();

  const response = await deps.fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": searchFieldMask,
    },
    body: JSON.stringify(googleBody),
  });

  if (!response.ok) {
    console.error(`Google Places Text Search failed with status ${response.status}.`);
    return errorResponse(502, "GOOGLE_PLACES_ERROR", "Google Places search failed.");
  }

  const payload = await parseJson(response);
  const places = isRecord(payload) && Array.isArray(payload.places)
    ? payload.places.map(sanitizePlace).filter((place): place is GooglePlaceDto => place !== null)
    : [];

  return jsonResponse({ places });
}

async function callGoogleDetails(
  body: Record<string, unknown>,
  apiKey: string,
  deps: GooglePlacesDependencies,
): Promise<Response> {
  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
  if (placeId.length === 0 || placeId.length > 512) {
    return errorResponse(400, "INVALID_PLACE_ID", "A valid Google Place ID is required.");
  }

  const languageCode = optionalCode(body.languageCode, /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);
  const regionCode = optionalCode(body.regionCode, /^[A-Za-z]{2}$/);
  if (languageCode === null || regionCode === null) {
    return errorResponse(400, "INVALID_LOCALE", "Language or region code is invalid.");
  }

  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  if (languageCode) url.searchParams.set("languageCode", languageCode);
  if (regionCode) url.searchParams.set("regionCode", regionCode.toUpperCase());

  const response = await deps.fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": detailsFieldMask,
    },
  });

  if (!response.ok) {
    console.error(`Google Place Details failed with status ${response.status}.`);
    return errorResponse(502, "GOOGLE_PLACES_ERROR", "Google Place details failed.");
  }

  const place = sanitizePlace(await parseJson(response));
  if (!place) {
    return errorResponse(502, "GOOGLE_PLACES_ERROR", "Google Place details were invalid.");
  }

  return jsonResponse(place);
}

export function createGooglePlacesHandler(
  operation: GooglePlacesOperation,
  dependencies: Partial<GooglePlacesDependencies> = {},
): (request: Request) => Promise<Response> {
  const deps: GooglePlacesDependencies = {
    fetch: dependencies.fetch ?? fetch,
    envGet: dependencies.envGet ?? ((name) => Deno.env.get(name)),
  };

  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: jsonHeaders });
    }
    if (request.method !== "POST") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "Use POST for this endpoint.");
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 4096) {
      return errorResponse(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    if (!isRecord(body) || !isUuid(body.weddingId)) {
      return errorResponse(400, "INVALID_WEDDING_ID", "A valid Wedding ID is required.");
    }

    const authorization = request.headers.get("Authorization") ?? "";
    const authorizationError = await authorizeWeddingMembership(
      authorization,
      body.weddingId,
      deps,
    );
    if (authorizationError) return authorizationError;

    const apiKey = deps.envGet("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      return errorResponse(500, "SERVER_MISCONFIGURED", "Google Places is not configured.");
    }

    return operation === "search"
      ? callGoogleSearch(body, apiKey, deps)
      : callGoogleDetails(body, apiKey, deps);
  };
}

export const googlePlacesFieldMasks = {
  details: detailsFieldMask,
  search: searchFieldMask,
} as const;
