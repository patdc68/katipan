type Dependencies = { fetch?: typeof fetch; envGet?: (key: string) => string | undefined };
type JsonObject = Record<string, unknown>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const token = /^[0-9a-f]{64}$/;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(value) && Number.isFinite(Date.parse(value));
}

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
    if (!isObject(configured) || typeof configured.default !== "string") return undefined;
    return configured.default.startsWith("sb_") ? configured.default : envGet(configured.default);
  } catch {
    return undefined;
  }
}

type Operation = { rpc: string; args: JsonObject };

function checkIn(body: JsonObject, weddingId: string, offline: boolean): Operation | null {
  if (!isUuid(body.guestId) || (body.clientEventId !== undefined && !isUuid(body.clientEventId)) ||
    (body.householdId !== undefined && !isUuid(body.householdId)) ||
    (body.occurredAt !== undefined && (!offline || !isTime(body.occurredAt))) ||
    (offline && (!isUuid(body.clientEventId) || !isTime(body.occurredAt)))) return null;
  return { rpc: "wedding_day_check_in", args: {
    p_wedding_id: weddingId, p_guest_id: body.guestId,
    p_client_event_id: body.clientEventId ?? crypto.randomUUID(),
    p_occurred_at: body.occurredAt ?? null,
    p_household_id: body.householdId ?? null,
  } };
}

function operation(body: JsonObject, weddingId: string): Operation | null {
  if (body.action === "qr") {
    if (typeof body.token !== "string" || body.clientEventId !== undefined && !isUuid(body.clientEventId)) return null;
    return { rpc: "wedding_day_check_in", args: {
      p_wedding_id: weddingId, p_qr_token: token.test(body.token) ? body.token : "",
      p_client_event_id: body.clientEventId ?? crypto.randomUUID(),
    } };
  }
  if (body.action === "manual") return checkIn(body, weddingId, false);
  if (body.action === "reverse") {
    if (!isUuid(body.guestId) || body.clientEventId !== undefined && !isUuid(body.clientEventId) ||
      body.reason !== undefined && (typeof body.reason !== "string" || body.reason.length > 500) ||
      body.occurredAt !== undefined && !isTime(body.occurredAt)) return null;
    return { rpc: "wedding_day_reverse_check_in", args: {
      p_wedding_id: weddingId, p_guest_id: body.guestId,
      p_client_event_id: body.clientEventId ?? crypto.randomUUID(),
      p_reason: body.reason ?? null, p_occurred_at: body.occurredAt ?? null,
    } };
  }
  return null;
}

export function createWeddingDayCheckInHandler(deps: Dependencies = {}): (request: Request) => Promise<Response> {
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
    let body: unknown;
    try {
      const raw = await request.text();
      if (raw.length > 16384) throw new Error("Too large");
      body = JSON.parse(raw);
    } catch {
      return response({ error: "Invalid request" }, 400, origin);
    }
    if (!isObject(body) || !isUuid(body.weddingId)) return response({ error: "Invalid request" }, 400, origin);
    const weddingId = body.weddingId;
    let operations: Operation[];
    const batch = body.action === "batchManual" || body.action === "offlineSync";
    if (batch) {
      if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > 50 ||
        body.events.some((event) => !isObject(event))) return response({ error: "Invalid request" }, 400, origin);
      operations = body.events.map((event: JsonObject) => checkIn(event, weddingId, body.action === "offlineSync"))
        .filter((item): item is Operation => item !== null);
      if (operations.length !== body.events.length) return response({ error: "Invalid request" }, 400, origin);
    } else {
      const one = operation(body, weddingId);
      if (!one) return response({ error: "Invalid request" }, 400, origin);
      operations = [one];
    }
    const url = envGet("SUPABASE_URL")?.replace(/\/$/, "");
    const key = publicKey(envGet);
    if (!url || !key) return response({ error: "Service unavailable" }, 503, origin);
    const headers = { apikey: key, Authorization: authorization, "Content-Type": "application/json" };
    try {
      const user = await fetcher(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization } });
      if (!user.ok) return response({ error: "Unauthorized" }, 401, origin);
      const results: unknown[] = [];
      for (const item of operations) {
        const result = await fetcher(`${url}/rest/v1/rpc/${item.rpc}`, {
          method: "POST", headers, body: JSON.stringify(item.args),
        });
        if (!result.ok) {
          const error = await result.json().catch(() => ({})) as { code?: string };
          const denied = error.code === "42501";
          const conflict = error.code === "23505";
          return response({ error: denied ? "Wedding access denied" : conflict ? "Idempotency conflict" : "Service unavailable" },
            denied ? 403 : conflict ? 409 : 503, origin);
        }
        results.push(await result.json());
      }
      return response(batch ? { results } : results[0], 200, origin);
    } catch {
      return response({ error: "Service unavailable" }, 503, origin);
    }
  };
}
