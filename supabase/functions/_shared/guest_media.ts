const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const tokenPattern = /^[0-9a-f]{64}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ttlSeconds = 60;

function response(body: unknown, status: number, origin: string | null): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  if (origin && (/^https:\/\/(?:www\.)?katipan\.ph$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin))) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "content-type, apikey");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return Response.json(body, { status, headers });
}

type Locator = { bucket?: unknown; path?: unknown };

export function createGuestMediaHandler(
  deps: { fetch?: typeof fetch; envGet?: (key: string) => string | undefined } = {},
): (req: Request) => Promise<Response> {
  const fetcher = deps.fetch ?? fetch;
  const envGet = deps.envGet ?? ((key: string) => Deno.env.get(key));
  return async (req: Request) => {
    const origin = req.headers.get("Origin");
    if (req.method === "OPTIONS") {
      const preflight = response({}, 200, origin);
      return new Response(null, { status: 204, headers: preflight.headers });
    }
    if (req.method !== "POST") return response({ error: "Method not allowed" }, 405, origin);
    const raw = await req.text();
    if (raw.length > 8192) return response({ error: "Invalid request" }, 400, origin);
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      body = parsed as Record<string, unknown>;
    } catch {
      return response({ error: "Invalid request" }, 400, origin);
    }
    const { slug, invitationToken, attachmentId } = body;
    if (typeof slug !== "string" || slug.length > 80 || !slugPattern.test(slug) ||
      typeof attachmentId !== "string" || !uuidPattern.test(attachmentId) ||
      (invitationToken !== undefined && (typeof invitationToken !== "string" ||
        !tokenPattern.test(invitationToken)))) {
      return response({ error: "Invalid request" }, 400, origin);
    }
    const base = envGet("SUPABASE_URL");
    const key = envGet("SUPABASE_SERVICE_ROLE_KEY");
    if (!base || !key) return response({ error: "Service unavailable" }, 503, origin);
    const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    try {
      const lookup = await fetcher(`${base}/rest/v1/rpc/guest_media_locator`, {
        method: "POST", headers,
        body: JSON.stringify({
          p_slug: slug, p_token: invitationToken ?? null, p_attachment_id: attachmentId,
        }),
      });
      if (!lookup.ok) {
        const error = await lookup.json().catch(() => ({})) as { code?: string };
        const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 503;
        return response({ error: status === 503 ? "Service unavailable" : "Media unavailable" }, status, origin);
      }
      const locator = await lookup.json() as Locator;
      if (locator.bucket !== "wedding-files" || typeof locator.path !== "string" ||
        !locator.path.startsWith("weddings/")) {
        return response({ error: "Service unavailable" }, 503, origin);
      }
      const encodedPath = locator.path.split("/").map(encodeURIComponent).join("/");
      const signed = await fetcher(
        `${base}/storage/v1/object/sign/wedding-files/${encodedPath}`,
        { method: "POST", headers, body: JSON.stringify({ expiresIn: ttlSeconds }) },
      );
      if (!signed.ok) return response({ error: "Media unavailable" }, 404, origin);
      const result = await signed.json() as { signedURL?: unknown };
      if (typeof result.signedURL !== "string" ||
        !result.signedURL.startsWith("/object/sign/wedding-files/")) {
        return response({ error: "Service unavailable" }, 503, origin);
      }
      return response({ url: `${base}/storage/v1${result.signedURL}`, expiresIn: ttlSeconds }, 200, origin);
    } catch {
      return response({ error: "Service unavailable" }, 503, origin);
    }
  };
}
