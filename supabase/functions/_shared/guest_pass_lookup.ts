type Dependencies = { fetch?: typeof fetch; envGet?: (key: string) => string | undefined };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenPattern = /^[0-9a-f]{64}$/;

function response(body: unknown, status: number, origin: string | null): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  if (origin && (/^https:\/\/(?:www\.)?katipan\.ph$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin))) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return Response.json(body, { status, headers });
}

function publicKey(envGet: (key: string) => string | undefined): string | undefined {
  const direct = envGet("SUPABASE_PUBLISHABLE_KEY") ?? envGet("SUPABASE_ANON_KEY");
  if (direct) return direct;
  try {
    const configured: unknown = JSON.parse(envGet("SUPABASE_PUBLISHABLE_KEYS") ?? "null");
    if (!configured || typeof configured !== "object" || !("default" in configured) ||
      typeof configured.default !== "string") return undefined;
    return configured.default.startsWith("sb_") ? configured.default : envGet(configured.default);
  } catch {
    return undefined;
  }
}

export function createGuestPassLookupHandler(deps: Dependencies = {}): (request: Request) => Promise<Response> {
  const fetcher = deps.fetch ?? fetch;
  const envGet = deps.envGet ?? ((key: string) => Deno.env.get(key));
  return async (request) => {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      const preflight = response({}, 200, origin);
      return new Response(null, { status: 204, headers: preflight.headers });
    }
    if (request.method !== "POST") return response({ error: "Method not allowed" }, 405, origin);
    const authorization = request.headers.get("Authorization") ?? "";
    if (!/^Bearer\s+\S+$/i.test(authorization)) return response({ error: "Unauthorized" }, 401, origin);
    const raw = await request.text();
    if (raw.length > 1024) return response({ error: "Invalid request" }, 400, origin);
    let weddingId: unknown;
    let token: unknown;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      weddingId = (parsed as Record<string, unknown>).weddingId;
      token = (parsed as Record<string, unknown>).token;
    } catch {
      return response({ error: "Invalid request" }, 400, origin);
    }
    if (typeof weddingId !== "string" || !uuidPattern.test(weddingId) || typeof token !== "string") {
      return response({ error: "Invalid request" }, 400, origin);
    }
    // Invalid token shapes have the same result as an unknown secret. The DB
    // authorizes the selected Wedding before it examines any token value.
    if (!tokenPattern.test(token)) token = "";
    const url = envGet("SUPABASE_URL")?.replace(/\/$/, "");
    const key = publicKey(envGet);
    if (!url || !key) return response({ error: "Service unavailable" }, 503, origin);
    try {
      const headers = { apikey: key, Authorization: authorization, "Content-Type": "application/json" };
      const user = await fetcher(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization } });
      if (!user.ok) return response({ error: "Unauthorized" }, 401, origin);
      const result = await fetcher(`${url}/rest/v1/rpc/guest_pass_lookup`, {
        method: "POST", headers, body: JSON.stringify({ p_wedding_id: weddingId, p_token: token }),
      });
      if (!result.ok) {
        const error = await result.json().catch(() => ({})) as { code?: string };
        return response({ error: error.code === "42501" ? "Wedding access denied" : "Service unavailable" },
          error.code === "42501" ? 403 : 503, origin);
      }
      return response(await result.json(), 200, origin);
    } catch {
      return response({ error: "Service unavailable" }, 503, origin);
    }
  };
}
