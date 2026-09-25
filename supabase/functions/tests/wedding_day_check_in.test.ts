import { createWeddingDayCheckInHandler } from "../_shared/wedding_day_check_in.ts";

const weddingId = "10000000-0000-0000-0000-000000000001";
const guestId = "40000000-0000-0000-0000-000000000001";
const key = "50000000-0000-0000-0000-000000000001";
const token = "a".repeat(64);
const calls: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
const envGet = (name: string) => ({
  SUPABASE_URL: "https://project.test", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
} as Record<string, string>)[name];
const fetcher = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({ url, headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : {} });
  return Promise.resolve(url.endsWith("/auth/v1/user")
    ? Response.json({ id: "verified-user" })
    : Response.json({ status: "CHECKED_IN", guestId, eventId: key }));
}) as typeof fetch;
const handler = createWeddingDayCheckInHandler({ fetch: fetcher, envGet });
const request = (body: unknown, auth = "Bearer user-jwt") => new Request("https://functions.test/wedding-day-check-in", {
  method: "POST", headers: { Authorization: auth }, body: JSON.stringify(body),
});

Deno.test("QR check-in verifies JWT and forwards only the caller's token through a public-key RPC", async () => {
  calls.length = 0;
  const result = await handler(request({ action: "qr", weddingId, token, clientEventId: key }));
  if (result.status !== 200 || (await result.json()).status !== "CHECKED_IN" || calls.length !== 2 ||
    !calls[1].url.endsWith("/rpc/wedding_day_check_in") || calls[1].body.p_qr_token !== token ||
    calls[1].body.p_client_event_id !== key || calls[1].headers.get("Authorization") !== "Bearer user-jwt" ||
    calls[1].headers.get("apikey") !== "sb_publishable_test") throw new Error("QR boundary failed");
});

Deno.test("manual batch and offline sync send one idempotent Guest operation per selected person", async () => {
  calls.length = 0;
  const batch = await handler(request({ action: "batchManual", weddingId, events: [
    { guestId, clientEventId: key },
    { guestId: "40000000-0000-0000-0000-000000000002", clientEventId: "50000000-0000-0000-0000-000000000002" },
  ] }));
  if (batch.status !== 200 || (await batch.json()).results.length !== 2 || calls.length !== 3 ||
    calls[1].body.p_guest_id === calls[2].body.p_guest_id) throw new Error("Batch did not create individual calls");
  calls.length = 0;
  const synced = await handler(request({ action: "offlineSync", weddingId, events: [
    { guestId, clientEventId: key, occurredAt: "2026-09-25T12:00:00Z" },
  ] }));
  if (synced.status !== 200 || calls[1].body.p_client_event_id !== key ||
    calls[1].body.p_occurred_at !== "2026-09-25T12:00:00Z") throw new Error("Offline key or time lost");
});

Deno.test("reversal uses a separate RPC and invalid or anonymous requests never reach the database", async () => {
  calls.length = 0;
  const reversed = await handler(request({ action: "reverse", weddingId, guestId, reason: "Wrong entry", clientEventId: key }));
  if (reversed.status !== 200 || !calls[1].url.endsWith("/rpc/wedding_day_reverse_check_in") ||
    calls[1].body.p_reason !== "Wrong entry") throw new Error("Reversal boundary failed");
  calls.length = 0;
  for (const bad of [
    { action: "manual", weddingId, guestId: "bad" },
    { action: "offlineSync", weddingId, events: [{ guestId }] },
    { action: "qr", weddingId, token: 123 },
  ]) if ((await handler(request(bad))).status !== 400) throw new Error("Invalid operation accepted");
  if ((await handler(request({ action: "manual", weddingId, guestId }, ""))).status !== 401 || calls.length !== 0) {
    throw new Error("Unauthenticated call reached the database");
  }
});

Deno.test("database denials and failures return no private Guest or QR details", async () => {
  const deniedFetch = ((input: RequestInfo | URL) => Promise.resolve(String(input).endsWith("/auth/v1/user")
    ? Response.json({ id: "user" })
    : Response.json({ code: "42501", message: token }, { status: 403 }))) as typeof fetch;
  const denied = await createWeddingDayCheckInHandler({ fetch: deniedFetch, envGet })(
    request({ action: "qr", weddingId, token }));
  if (denied.status !== 403 || (await denied.text()).includes(token)) throw new Error("Denied scan leaked private data");
});
