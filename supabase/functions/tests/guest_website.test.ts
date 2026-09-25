import { createGuestWebsiteHandler } from "../_shared/guest_website.ts";

const token = "a".repeat(64);
const guestId = "10000000-0000-0000-0000-000000000001";
const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
const envGet = (key: string) => ({
  SUPABASE_URL: "https://project.test",
  SUPABASE_SERVICE_ROLE_KEY: "server-secret",
} as Record<string, string>)[key];
const fakeFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
  return Promise.resolve(Response.json({ sections: [], wedding: { name: "Test Wedding" } }));
}) as typeof fetch;

function request(body: unknown): Request {
  return new Request("https://functions.test/guest", { method: "POST", body: JSON.stringify(body) });
}

Deno.test("public guide omits token and sends only slug to server projection", async () => {
  calls.length = 0;
  const response = await createGuestWebsiteHandler("guide", { fetch: fakeFetch, envGet })(request({ slug: "test-wedding" }));
  if (response.status !== 200 || calls.length !== 1 || calls[0].body.p_token !== null ||
    calls[0].url !== "https://project.test/rest/v1/rpc/guest_wedding_guide") throw new Error("Guide projection call failed");
  const body = await response.json();
  if (body.wedding.name !== "Test Wedding" || JSON.stringify(body).includes("server-secret")) throw new Error("Unsafe guide response");
});

Deno.test("RSVP requires opaque token and individual Guest ID", async () => {
  calls.length = 0;
  const handler = createGuestWebsiteHandler("rsvp", { fetch: fakeFetch, envGet });
  for (const bad of [
    { slug: "test-wedding", guestId, status: "ATTENDING" },
    { slug: "test-wedding", invitationToken: "surname", guestId, status: "ATTENDING" },
    { slug: "test-wedding", invitationToken: token, guestId: "household", status: "ATTENDING" },
  ]) {
    if ((await handler(request(bad))).status !== 400) throw new Error("Invalid RSVP accepted");
  }
  if (calls.length !== 0) throw new Error("Invalid requests reached database");
  const response = await handler(request({ slug: "test-wedding", invitationToken: token, guestId, status: "DECLINED" }));
  if (response.status !== 200 || calls[0].body.p_guest_id !== guestId || calls[0].body.p_token !== token) {
    throw new Error("Individual RSVP projection call failed");
  }
});

Deno.test("database authorization failures are sanitized", async () => {
  const deniedFetch = (() => Promise.resolve(Response.json({ code: "42501", message: `secret ${token}` }, { status: 403 }))) as typeof fetch;
  const response = await createGuestWebsiteHandler("guide", { fetch: deniedFetch, envGet })(request({ slug: "test-wedding", invitationToken: token }));
  if (response.status !== 403 || (await response.text()).includes(token)) throw new Error("Invitation secret leaked");
});
