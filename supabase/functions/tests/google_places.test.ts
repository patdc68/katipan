import {
  createGooglePlacesHandler,
  googlePlacesFieldMasks,
} from "../_shared/google_places.ts";

const weddingId = "10000000-0000-0000-0000-000000000401";
const googleKey = "test-google-key-never-return";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nexpected: ${expectedJson}\nactual:   ${actualJson}`);
  }
}

function envGet(name: string): string | undefined {
  const values: Record<string, string> = {
    GOOGLE_PLACES_API_KEY: googleKey,
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_URL: "https://project.test",
  };
  return values[name];
}

function makeRequest(token: string | null, body: Record<string, unknown>): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return new Request("https://functions.test/function", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function responseJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.test("search permits every active Wedding role and returns only the sanitized DTO", async () => {
  for (const role of ["OWNER", "FULL_COORDINATOR", "DAY_OF_COORDINATOR", "GUEST_COORDINATOR"]) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      calls.push({ url, init });
      if (url.endsWith("/auth/v1/user")) return responseJson({ id: role });
      if (url.startsWith("https://project.test/rest/v1/weddings")) {
        return responseJson([{ id: weddingId }]);
      }
      if (url === "https://places.googleapis.com/v1/places:searchText") {
        return responseJson({
          places: [{
            id: "google-place-1",
            displayName: { text: "Manila Cathedral", languageCode: "en" },
            formattedAddress: "Cabildo, Intramuros, Manila",
            location: { latitude: 14.5915, longitude: 120.9736 },
            primaryType: "church",
            googleMapsUri: "https://maps.google.com/example",
            rating: 4.9,
            reviews: [{ text: "must not escape" }],
            websiteUri: "https://example.test",
          }],
          nextPageToken: "must-not-escape",
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    const handler = createGooglePlacesHandler("search", { fetch: fakeFetch, envGet });
    const response = await handler(makeRequest(role, { weddingId, query: "Manila Cathedral" }));
    const payload = await response.json();

    assertEquals(response.status, 200, `${role} should be authorized`);
    assertEquals(payload, {
      places: [{
        placeId: "google-place-1",
        displayName: "Manila Cathedral",
        formattedAddress: "Cabildo, Intramuros, Manila",
        latitude: 14.5915,
        longitude: 120.9736,
        primaryType: "church",
        googleMapsUri: "https://maps.google.com/example",
      }],
    }, `${role} should receive the transient sanitized DTO`);
    assertEquals(calls.length, 3, `${role} should be authenticated and authorized before Google is called`);
    assert(calls[0].url.endsWith("/auth/v1/user"), "User authentication must happen first");
    assert(calls[1].url.startsWith("https://project.test/rest/v1/weddings"), "RLS membership check must happen second");
    assertEquals(calls[1].init?.method, "GET", "Membership validation must be read-only");
    assertEquals(calls[2].init?.method, "POST", "Text Search must use POST");
    const googleHeaders = new Headers(calls[2].init?.headers);
    assertEquals(googleHeaders.get("X-Goog-FieldMask"), googlePlacesFieldMasks.search, "Search uses the exact field mask");
    assert(!googlePlacesFieldMasks.search.includes("*"), "Search must never use a wildcard field mask");
    assert(!(JSON.stringify(payload)).includes(googleKey), "The Google key must never be returned");
    assert(calls.every((call) => !call.url.includes(googleKey)), "The Google key must never be put in a URL");
  }
});

Deno.test("search denies anonymous callers before any upstream request", async () => {
  let calls = 0;
  const fakeFetch = (async () => {
    calls += 1;
    throw new Error("fetch should not be called");
  }) as typeof fetch;
  const handler = createGooglePlacesHandler("search", { fetch: fakeFetch, envGet });
  const response = await handler(makeRequest(null, { weddingId, query: "Manila Cathedral" }));

  assertEquals(response.status, 401, "Anonymous caller must be denied");
  assertEquals(calls, 0, "Anonymous denial must happen before Supabase or Google calls");
});

Deno.test("search denies an unrelated or inactive user before calling Google", async () => {
  const calls: string[] = [];
  const fakeFetch = (async (input: RequestInfo | URL) => {
    const url = input.toString();
    calls.push(url);
    if (url.endsWith("/auth/v1/user")) return responseJson({ id: "unrelated" });
    if (url.startsWith("https://project.test/rest/v1/weddings")) return responseJson([]);
    throw new Error("Google must not be called");
  }) as typeof fetch;
  const handler = createGooglePlacesHandler("search", { fetch: fakeFetch, envGet });
  const response = await handler(makeRequest("unrelated", { weddingId, query: "Manila Cathedral" }));

  assertEquals(response.status, 403, "Unrelated user must be denied");
  assertEquals(calls.length, 2, "Only authentication and membership checks are allowed");
});

Deno.test("details validates membership, uses Places API (New), and sanitizes the response", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    calls.push({ url, init });
    if (url.endsWith("/auth/v1/user")) return responseJson({ id: "owner" });
    if (url.startsWith("https://project.test/rest/v1/weddings")) return responseJson([{ id: weddingId }]);
    if (url.startsWith("https://places.googleapis.com/v1/places/")) {
      return responseJson({
        id: "place/id-needing-encoding",
        displayName: { text: "Validated Place" },
        formattedAddress: "Transient address",
        location: { latitude: 14.5, longitude: 121 },
        primaryType: "event_venue",
        googleMapsUri: "https://maps.google.com/validated",
        nationalPhoneNumber: "must-not-escape",
        photos: [{ name: "must-not-escape" }],
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const handler = createGooglePlacesHandler("details", { fetch: fakeFetch, envGet });
  const response = await handler(makeRequest("owner", {
    weddingId,
    placeId: "place/id-needing-encoding",
    languageCode: "en",
    regionCode: "ph",
  }));
  const payload = await response.json();

  assertEquals(response.status, 200, "Place Details should succeed");
  assertEquals(payload, {
    placeId: "place/id-needing-encoding",
    displayName: "Validated Place",
    formattedAddress: "Transient address",
    latitude: 14.5,
    longitude: 121,
    primaryType: "event_venue",
    googleMapsUri: "https://maps.google.com/validated",
  }, "Place Details must return only the approved DTO");
  assert(calls[2].url.includes("place%2Fid-needing-encoding"), "Place ID must be path encoded");
  assert(calls[2].url.includes("regionCode=PH"), "Region code should be normalized");
  const googleHeaders = new Headers(calls[2].init?.headers);
  assertEquals(googleHeaders.get("X-Goog-FieldMask"), googlePlacesFieldMasks.details, "Details uses the exact field mask");
  assert(!googlePlacesFieldMasks.details.includes("*"), "Details must never use a wildcard field mask");
  assert(calls.slice(0, 2).every((call) => call.init?.method === "GET"), "Authorization checks must be read-only");
});

Deno.test("Google failures are sanitized and never expose the key", async () => {
  const fakeFetch = (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.endsWith("/auth/v1/user")) return responseJson({ id: "owner" });
    if (url.startsWith("https://project.test/rest/v1/weddings")) return responseJson([{ id: weddingId }]);
    return responseJson({ error: { message: `upstream mentioned ${googleKey}` } }, 403);
  }) as typeof fetch;
  const handler = createGooglePlacesHandler("details", { fetch: fakeFetch, envGet });
  const response = await handler(makeRequest("owner", { weddingId, placeId: "place-1" }));
  const text = await response.text();

  assertEquals(response.status, 502, "Upstream failures should be mapped to a sanitized gateway error");
  assert(!text.includes(googleKey), "The Google key must not be exposed in error responses");
});
