import { createGuestPassLookupHandler } from "../_shared/guest_pass_lookup.ts";

const weddingId = "10000000-0000-0000-0000-000000000001";
const token = "a".repeat(64);
const calls: Array<{ url: string; headers: Headers; body: string }> = [];
const envGet = (key: string) => ({
  SUPABASE_URL: "https://project.test",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
} as Record<string, string>)[key];
const fakeFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({ url, headers: new Headers(init?.headers), body: String(init?.body ?? "") });
  return Promise.resolve(url.endsWith("/auth/v1/user")
    ? Response.json({ id: "user" })
    : Response.json({ status: "VALID", guestId: "opaque-operational-id", reference: "KABCD-1234" }));
}) as typeof fetch;
const request = (body: unknown, bearer = "Bearer user-jwt") => new Request("https://functions.test/guest-pass-lookup", {
  method: "POST", headers: { Authorization: bearer }, body: JSON.stringify(body),
});

Deno.test("scanner forwards the user's JWT and public key to read-only lookup", async () => {
  calls.length = 0;
  const result = await createGuestPassLookupHandler({ fetch: fakeFetch, envGet })(request({ weddingId, token }));
  if (result.status !== 200 || (await result.json()).status !== "VALID" || calls.length !== 2 ||
    !calls[1].url.endsWith("/rpc/guest_pass_lookup") || calls[1].headers.get("Authorization") !== "Bearer user-jwt" ||
    calls[1].headers.get("apikey") !== "sb_publishable_test" ||
    JSON.parse(calls[1].body).p_token !== token) throw new Error("Scanner lookup boundary failed");
  if (calls.some((call) => call.url.includes("service_role") || call.body.includes("check_in"))) {
    throw new Error("Scanner used a privileged or mutating path");
  }
});

Deno.test("invalid requests never reach the database", async () => {
  calls.length = 0;
  const handler = createGuestPassLookupHandler({ fetch: fakeFetch, envGet });
  for (const bad of [{ token }, { weddingId, token: 5 }, { weddingId: "other", token }]) {
    if ((await handler(request(bad))).status !== 400) throw new Error("Invalid request accepted");
  }
  if ((await handler(request({ weddingId, token }, ""))).status !== 401 || calls.length !== 0) {
    throw new Error("Unauthenticated request reached the database");
  }
});

Deno.test("denied and unknown scans expose no token or private guest data", async () => {
  const denied = ((input: RequestInfo | URL) => Promise.resolve(String(input).endsWith("/auth/v1/user")
    ? Response.json({ id: "user" })
    : Response.json({ code: "42501", message: token }, { status: 403 }))) as typeof fetch;
  const result = await createGuestPassLookupHandler({ fetch: denied, envGet })(request({ weddingId, token }));
  if (result.status !== 403 || (await result.text()).includes(token)) throw new Error("Token leaked in denial");
  calls.length = 0;
  const handler = createGuestPassLookupHandler({ fetch: fakeFetch, envGet });
  await handler(request({ weddingId, token: "invalid" }));
  if (JSON.parse(calls[1].body).p_token !== "") throw new Error("Malformed QR reached the lookup");
});
