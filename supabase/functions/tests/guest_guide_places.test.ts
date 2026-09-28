import { hydrateGuestGuidePlaces } from "../_shared/guest_guide_places.ts";
import { createGuestWebsiteHandler } from "../_shared/guest_website.ts";

const googleKey = "google-key-must-stay-private";
const serviceKey = "service-key-must-stay-private";
const token = "a".repeat(64);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function guide() {
  return {
    sections: [{ type: "PLACES", data: [
      { name: "Custom Chapel", address: "Custom address", googlePlaceId: null, notes: "Use gate A", purpose: "CEREMONY" },
      { name: "Wedding Garden", address: null, googlePlaceId: "labeled", purpose: "RECEPTION", placeType: "GARDEN" },
      { name: null, address: null, googlePlaceId: "unlabeled", purpose: "ACCOMMODATION" },
      { name: null, address: null, googlePlaceId: "unlabeled", purpose: "OTHER" },
    ] }],
    guestProgram: [
      { title: "Reception", placeName: "Wedding Garden", googlePlaceId: "labeled" },
      { title: "Stay", placeName: null, googlePlaceId: "unlabeled" },
      { title: "Ceremony", placeName: "Custom Chapel", googlePlaceId: null },
    ],
  };
}

function googleResponse(id: string): Response {
  return Response.json({
    id, displayName: { text: `Google ${id}` }, formattedAddress: `Address ${id}`,
    privateField: "must-not-escape",
  });
}

Deno.test("Guide hydration shares one sanitized lookup per Google ID and preserves Wedding labels", async () => {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert(init?.signal instanceof AbortSignal, "Guest Google lookup lacks a timeout signal");
    const id = decodeURIComponent(String(input).split("/").pop()!);
    calls.push(id);
    return googleResponse(id);
  }) as typeof fetch;
  const original = guide();
  const hydrated = await hydrateGuestGuidePlaces(original, googleKey, fetcher) as ReturnType<typeof guide>;
  const places = hydrated.sections[0].data;
  assert(JSON.stringify(calls.sort()) === JSON.stringify(["labeled", "unlabeled"]), "Duplicate IDs caused extra Google calls");
  assert(JSON.stringify(places[0]) === JSON.stringify(original.sections[0].data[0]), "CUSTOM Place changed");
  assert(places[1].name === "Wedding Garden" && places[1].address === "Address labeled", "Wedding label or Google address lost");
  assert(places[2].name === "Google unlabeled" && places[2].address === "Address unlabeled", "Unlabeled Google Place did not hydrate");
  assert(places[2].purpose === "ACCOMMODATION" && places[1].placeType === "GARDEN", "Wedding context changed");
  assert(hydrated.guestProgram[0].placeName === "Wedding Garden", "Program label was overwritten");
  assert(hydrated.guestProgram[1].placeName === "Google unlabeled", "Program name did not hydrate");
  assert(hydrated.guestProgram[2].placeName === "Custom Chapel", "CUSTOM Program Place changed");
  assert(!JSON.stringify(hydrated).includes("must-not-escape"), "Raw Google fields escaped");
  assert(!JSON.stringify(hydrated).includes(googleKey), "Google API key escaped on success");
});

Deno.test("Google failure retains sanitized fallback and does not invent a name", async () => {
  const fetcher = (async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/labeled")) throw new Error(`upstream ${googleKey} ${serviceKey}`);
    return Response.json({ error: `upstream ${googleKey}` }, { status: 500 });
  }) as typeof fetch;
  const hydrated = await hydrateGuestGuidePlaces(guide(), googleKey, fetcher) as ReturnType<typeof guide>;
  const text = JSON.stringify(hydrated);
  assert(hydrated.sections[0].data[1].name === "Wedding Garden", "Explicit label was lost");
  assert(hydrated.sections[0].data[2].name === null, "A fake name was introduced");
  assert(hydrated.guestProgram[1].placeName === null, "A fake Program name was introduced");
  assert(!text.includes(googleKey) && !text.includes(serviceKey), "A secret escaped on Google failure");
});

Deno.test("Guide access denial precedes Google lookup, and caller Place IDs are ignored", async () => {
  for (const invitationToken of [token, undefined]) {
    const calls: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return Response.json({ code: "42501", message: `denied ${serviceKey}` }, { status: 403 });
    }) as typeof fetch;
    const handler = createGuestWebsiteHandler("guide", {
      fetch: fetcher,
      envGet: (name) => ({ SUPABASE_URL: "https://project.test", SUPABASE_SERVICE_ROLE_KEY: serviceKey,
        GOOGLE_PLACES_API_KEY: googleKey } as Record<string, string>)[name],
    });
    const response = await handler(new Request("https://functions.test/guide", {
      method: "POST", body: JSON.stringify({ slug: "invited-wedding", invitationToken, googlePlaceId: "caller-supplied" }),
    }));
    const body = await response.text();
    assert(response.status === 403 && calls.length === 1, "Access denial reached Google");
    assert(!body.includes(googleKey) && !body.includes(serviceKey), "Access error leaked a key");
  }

  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return url.includes("/rpc/") ? Response.json({ sections: [], guestProgram: [] }) : googleResponse("caller-supplied");
  }) as typeof fetch;
  const handler = createGuestWebsiteHandler("guide", {
    fetch: fetcher,
    envGet: (name) => ({ SUPABASE_URL: "https://project.test", SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      GOOGLE_PLACES_API_KEY: googleKey } as Record<string, string>)[name],
  });
  const response = await handler(new Request("https://functions.test/guide", {
    method: "POST", body: JSON.stringify({ slug: "public-wedding", googlePlaceId: "caller-supplied" }),
  }));
  assert(response.status === 200 && calls.length === 1, "Caller Place ID reached Google");
});

Deno.test("Guide hydration limits concurrent Google requests", async () => {
  let active = 0;
  let peak = 0;
  const fetcher = (async (input: RequestInfo | URL) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    return googleResponse(decodeURIComponent(String(input).split("/").pop()!));
  }) as typeof fetch;
  const projection = { sections: [{ type: "PLACES", data: Array.from({ length: 7 }, (_, n) =>
    ({ name: null, googlePlaceId: `place-${n}` })) }], guestProgram: [] };
  await hydrateGuestGuidePlaces(projection, googleKey, fetcher);
  assert(peak <= 3 && peak > 1, "Google request concurrency was not bounded");
});
