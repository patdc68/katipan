type Mode = "guide" | "rsvp";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const tokenPattern = /^[0-9a-f]{64}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number, origin: string | null): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  if (origin && (/^https:\/\/(?:www\.)?katipan\.ph$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin))) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "content-type, apikey");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return Response.json(body, { status, headers });
}

export function createGuestWebsiteHandler(
  mode: Mode,
  deps: { fetch?: typeof fetch; envGet?: (key: string) => string | undefined } = {},
): (req: Request) => Promise<Response> {
  const fetcher = deps.fetch ?? fetch;
  const envGet = deps.envGet ?? ((key: string) => Deno.env.get(key));
  return async (req: Request) => {
    const origin = req.headers.get("Origin");
    if (req.method === "OPTIONS") {
      const response = json({}, 200, origin);
      return new Response(null, { status: 204, headers: response.headers });
    }
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
    const raw = await req.text();
    if (raw.length > 8192) return json({ error: "Invalid request" }, 400, origin);
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid request" }, 400, origin);
    }
    const slug = body.slug;
    const token = body.invitationToken;
    if (typeof slug !== "string" || slug.length > 80 || !slugPattern.test(slug) ||
      (token !== undefined && (typeof token !== "string" || !tokenPattern.test(token)))) {
      return json({ error: "Invalid request" }, 400, origin);
    }
    if (mode === "rsvp" &&
      (typeof token !== "string" || typeof body.guestId !== "string" || !uuidPattern.test(body.guestId) ||
        !["ATTENDING", "DECLINED", "NO_RESPONSE"].includes(String(body.status)) ||
        [body.mealChoice, body.dietaryNotes, body.responseNotes].some((v) => v !== undefined && (typeof v !== "string" || v.length > 2000)))) {
      return json({ error: "Invalid request" }, 400, origin);
    }
    const url = envGet("SUPABASE_URL");
    const key = envGet("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Service unavailable" }, 503, origin);
    const rpc = mode === "guide" ? "guest_wedding_guide" : "guest_submit_rsvp";
    const payload = mode === "guide"
      ? { p_slug: slug, p_token: token ?? null }
      : {
        p_slug: slug, p_token: token, p_guest_id: body.guestId, p_status: body.status,
        p_meal_choice: body.mealChoice ?? null, p_dietary_notes: body.dietaryNotes ?? null,
        p_response_notes: body.responseNotes ?? null,
      };
    try {
      const result = await fetcher(`${url}/rest/v1/rpc/${rpc}`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!result.ok) {
        const error = await result.json().catch(() => ({})) as { code?: string };
        const status = error.code === "P0002" ? 404 : error.code === "42501" ? 403 : 500;
        return json({ error: status === 500 ? "Service unavailable" : "Guide or invitation unavailable" }, status, origin);
      }
      return json(await result.json(), 200, origin);
    } catch {
      return json({ error: "Service unavailable" }, 503, origin);
    }
  };
}
