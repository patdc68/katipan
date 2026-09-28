import { describe, expect, it } from "vitest";
import { createGuestRsvpHandler } from "./guest-rsvp-handler";

const token = "c".repeat(64);
const guestId = "20000000-0000-4000-8000-000000000001";
const base = {
  slug: "juan-maria",
  token,
  guestId,
  status: "ATTENDING",
  mealChoice: "Vegetarian",
  dietaryNotes: "No peanuts",
  responseNotes: "Thank you",
};

function request(body: unknown, headers: Record<string, string> = { "Content-Type": "application/json" }) {
  return new Request("https://katipan.ph/api/w/juan-maria/rsvp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function setup(fetcher?: typeof fetch, env: Record<string, string | undefined> = {
  SUPABASE_URL: "https://project.test/",
  SUPABASE_SERVICE_ROLE_KEY: "server-only-test-secret",
}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch = fetcher ?? ((async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return Response.json({ guestId, status: "ATTENDING" });
  }) as typeof fetch);
  const handler = createGuestRsvpHandler({ fetcher: fakeFetch, envGet: (key) => env[key] });
  return { handler, calls };
}

describe("server-side Guest RSVP mutation boundary", () => {
  it("rejects missing, malformed, expired-style and unauthorized request shapes before the RPC", async () => {
    const { handler, calls } = setup();
    const invalidBodies = [
      { ...base, token: null },
      { ...base, token: "not-a-token" },
      { ...base, status: "NO_RESPONSE" },
      { ...base, status: "MAYBE" },
      { ...base, guestId: "household-id" },
      { ...base, slug: "another-wedding" },
      { ...base, householdId: "20000000-0000-4000-8000-000000000001" },
      { ...base, weddingId: "10000000-0000-4000-8000-000000000001" },
      {
        slug: base.slug,
        guestId: base.guestId,
        status: base.status,
        mealChoice: base.mealChoice,
        dietaryNotes: base.dietaryNotes,
        responseNotes: base.responseNotes,
      },
    ];
    for (const invalid of invalidBodies) {
      const response = await handler(request(invalid), "juan-maria");
      expect(response.status).toBe(400);
    }
    expect(calls).toHaveLength(0);
  });

  it("calls only the fixed service-role RSVP RPC with the seven requested values", async () => {
    const { handler, calls } = setup();
    const response = await handler(request(base), "juan-maria");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://project.test/rest/v1/rpc/guest_submit_rsvp");
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.cache).toBe("no-store");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      p_slug: "juan-maria",
      p_token: token,
      p_guest_id: guestId,
      p_status: "ATTENDING",
      p_meal_choice: "Vegetarian",
      p_dietary_notes: "No peanuts",
      p_response_notes: "Thank you",
    });
    expect(JSON.stringify(await response.json())).not.toMatch(/token|server-only-test-secret|guestId/);
  });

  it("submits Declined explicitly and lets repeated requests update the same Guest row", async () => {
    const { handler, calls } = setup();
    const declined = { ...base, status: "DECLINED", mealChoice: null, dietaryNotes: null, responseNotes: null };
    const first = await handler(request(declined), "juan-maria");
    const second = await handler(request(declined), "juan-maria");
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => JSON.parse(String(call.init.body)))).toEqual([
      expect.objectContaining({ p_guest_id: guestId, p_status: "DECLINED" }),
      expect.objectContaining({ p_guest_id: guestId, p_status: "DECLINED" }),
    ]);
    expect(calls.every((call) => call.url.endsWith("/rpc/guest_submit_rsvp"))).toBe(true);
  });

  it("maps Household, Wedding, expired and revoked access failures to a safe guest message", async () => {
    const hiddenDetail = `database detail ${token} server-only-test-secret`;
    const deniedFetch = (async () => Response.json({ code: "42501", message: hiddenDetail }, { status: 403 })) as typeof fetch;
    const { handler } = setup(deniedFetch);
    const response = await handler(request(base), "juan-maria");
    const body = await response.text();
    expect(response.status).toBe(403);
    expect(body).not.toContain(token);
    expect(body).not.toContain("database detail");
    expect(body).not.toContain("server-only-test-secret");
  });

  it("handles unpublished Weddings and network failures without exposing raw errors", async () => {
    const missingFetch = (async () => Response.json({ code: "P0002", message: "private database detail" }, { status: 404 })) as typeof fetch;
    const missing = await setup(missingFetch).handler(request(base), "juan-maria");
    expect(missing.status).toBe(404);
    expect(await missing.text()).not.toContain("private database detail");

    const failedFetch = (async () => { throw new Error(`private transport detail ${token}`); }) as typeof fetch;
    const failed = await setup(failedFetch).handler(request(base), "juan-maria");
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain(token);
  });

  it("rejects non-JSON, malformed, oversized, and misconfigured requests", async () => {
    const { handler, calls } = setup();
    const nonJson = await handler(request(base, { "Content-Type": "text/plain" }), "juan-maria");
    expect(nonJson.status).toBe(415);
    const malformed = new Request("https://katipan.ph/api/w/juan-maria/rsvp", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{",
    });
    expect((await handler(malformed, "juan-maria")).status).toBe(400);
    const oversized = await handler(request({ ...base, responseNotes: "x".repeat(9000) }), "juan-maria");
    expect(oversized.status).toBe(413);
    const unavailable = await setup(undefined, { SUPABASE_URL: "https://project.test" }).handler(request(base), "juan-maria");
    expect(unavailable.status).toBe(503);
    expect(calls).toHaveLength(0);
  });
});
