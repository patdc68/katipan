import { createGuestMediaHandler } from "../_shared/guest_media.ts";

const token = "a".repeat(64);
const attachmentId = "10000000-0000-0000-0000-000000000001";
const envGet = (key: string) => ({
  SUPABASE_URL: "https://project.test",
  SUPABASE_SERVICE_ROLE_KEY: "server-secret",
} as Record<string, string>)[key];
const request = (body: unknown) =>
  new Request("https://functions.test/guest-media", { method: "POST", body: JSON.stringify(body) });

Deno.test("guest-visible media is signed for one minute after locator authorization", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetcher = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    if (url.endsWith("/guest_media_locator")) {
      return Promise.resolve(Response.json({ bucket: "wedding-files", path: "weddings/test/image.png" }));
    }
    return Promise.resolve(Response.json({ signedURL: "/object/sign/wedding-files/weddings/test/image.png?token=short" }));
  }) as typeof fetch;
  const result = await createGuestMediaHandler({ fetch: fetcher, envGet })(
    request({ slug: "test-wedding", invitationToken: token, attachmentId }),
  );
  const body = await result.json();
  if (result.status !== 200 || body.expiresIn !== 60 ||
    !String(body.url).includes("token=short") ||
    calls.length !== 2 || calls[0].body.p_token !== token ||
    calls[1].body.expiresIn !== 60 ||
    JSON.stringify(body).includes("server-secret") ||
    result.headers.get("Cache-Control") !== "no-store") {
    throw new Error("Safe temporary signing failed");
  }
});

Deno.test("invalid token and attachment never reach the database", async () => {
  let calls = 0;
  const fetcher = (() => { calls++; return Promise.resolve(Response.json({})); }) as typeof fetch;
  const handler = createGuestMediaHandler({ fetch: fetcher, envGet });
  for (const bad of [
    { slug: "test-wedding", invitationToken: "surname", attachmentId },
    { slug: "test-wedding", invitationToken: token, attachmentId: "financial" },
  ]) {
    if ((await handler(request(bad))).status !== 400) throw new Error("Invalid request accepted");
  }
  if (calls !== 0) throw new Error("Invalid request reached database");
});

Deno.test("denied and revoked media never reaches Storage or leaks secrets", async () => {
  let calls = 0;
  const fetcher = (() => {
    calls++;
    return Promise.resolve(Response.json({ code: "42501", message: token }, { status: 403 }));
  }) as typeof fetch;
  const response = await createGuestMediaHandler({ fetch: fetcher, envGet })(
    request({ slug: "test-wedding", invitationToken: token, attachmentId }),
  );
  if (response.status !== 403 || calls !== 1 || (await response.text()).includes(token)) {
    throw new Error("Denied media was exposed");
  }
});
