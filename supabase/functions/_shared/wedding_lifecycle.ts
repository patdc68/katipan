type Dependencies = {
  fetch?: typeof fetch;
  envGet?: (name: string) => string | undefined;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedOrigin = /^https:\/\/(?:www\.)?katipan\.ph$|^http:\/\/localhost:\d+$/;

function reply(body: unknown, status: number, origin: string | null): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  if (origin && allowedOrigin.test(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return Response.json(body, { status, headers });
}

function publishableKey(envGet: (name: string) => string | undefined): string | undefined {
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

async function rpc(
  fetcher: typeof fetch, url: string, key: string, authorization: string,
  name: string, body: Record<string, unknown>,
): Promise<Response> {
  return await fetcher(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function createWeddingDeletionHandler(deps: Dependencies = {}): (request: Request) => Promise<Response> {
  const fetcher = deps.fetch ?? fetch;
  const envGet = deps.envGet ?? ((name: string) => Deno.env.get(name));
  return async (request) => {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: reply({}, 200, origin).headers });
    if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405, origin);
    const authorization = request.headers.get("Authorization") ?? "";
    if (!/^Bearer\s+\S+$/i.test(authorization)) return reply({ error: "Unauthorized" }, 401, origin);
    const raw = await request.text();
    if (raw.length > 1024) return reply({ error: "Invalid request" }, 400, origin);
    let weddingId: unknown;
    let confirmName: unknown;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      weddingId = (parsed as Record<string, unknown>).weddingId;
      confirmName = (parsed as Record<string, unknown>).confirmName;
    } catch {
      return reply({ error: "Invalid request" }, 400, origin);
    }
    if (typeof weddingId !== "string" || !uuidPattern.test(weddingId) ||
      typeof confirmName !== "string" || confirmName.length < 1 || confirmName.length > 200) {
      return reply({ error: "Invalid request" }, 400, origin);
    }
    weddingId = weddingId.toLowerCase();
    const url = envGet("SUPABASE_URL")?.replace(/\/$/, "");
    const publicKey = publishableKey(envGet);
    const serviceKey = envGet("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !publicKey || !serviceKey) return reply({ error: "Service unavailable" }, 503, origin);
    try {
      const user = await fetcher(`${url}/auth/v1/user`, {
        headers: { apikey: publicKey, Authorization: authorization },
      });
      if (!user.ok) return reply({ error: "Unauthorized" }, 401, origin);
      const requestResult = await rpc(fetcher, url, publicKey, authorization,
        "request_wedding_deletion", { p_wedding_id: weddingId, p_confirm_name: confirmName });
      if (!requestResult.ok) {
        const error = await requestResult.json().catch(() => ({})) as { code?: string };
        const status = error.code === "42501" ? 403 : error.code === "22023" ? 400 : 503;
        return reply({ error: status === 403 ? "Wedding access denied" : status === 400 ? "Confirmation does not match" : "Service unavailable" }, status, origin);
      }
      const nonce: unknown = await requestResult.json();
      if (typeof nonce !== "string" || !uuidPattern.test(nonce)) return reply({ error: "Service unavailable" }, 503, origin);
      const serviceAuthorization = `Bearer ${serviceKey}`;
      for (let batch = 0; batch < 100; batch++) {
        const listed = await rpc(fetcher, url, serviceKey, serviceAuthorization,
          "list_wedding_deletion_objects", { p_wedding_id: weddingId, p_nonce: nonce });
        if (!listed.ok) return reply({ error: "Storage cleanup pending; retry deletion" }, 503, origin);
        const rows: unknown = await listed.json();
        if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" ||
          typeof (row as Record<string, unknown>).object_path !== "string" ||
          (row as { object_path: string }).object_path.length === 0 ||
          (row as { object_path: string }).object_path.length > 1000)) {
          return reply({ error: "Storage cleanup pending; retry deletion" }, 503, origin);
        }
        if (rows.length === 0) {
          const finalized = await rpc(fetcher, url, serviceKey, serviceAuthorization,
            "finalize_wedding_deletion", { p_wedding_id: weddingId, p_nonce: nonce });
          if (!finalized.ok) return reply({ error: "Storage cleanup pending; retry deletion" }, 503, origin);
          return reply({ deleted: true }, 200, origin);
        }
        const prefixes = rows.map((row) => (row as { object_path: string }).object_path);
        const removed = await fetcher(`${url}/storage/v1/object/wedding-files`, {
          method: "DELETE",
          headers: { apikey: serviceKey, Authorization: serviceAuthorization, "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes }),
        });
        if (!removed.ok) return reply({ error: "Storage cleanup pending; retry deletion" }, 503, origin);
      }
      return reply({ error: "Storage cleanup pending; retry deletion" }, 503, origin);
    } catch {
      return reply({ error: "Service unavailable" }, 503, origin);
    }
  };
}

export function createAccountDeletionHandler(deps: Dependencies = {}): (request: Request) => Promise<Response> {
  const fetcher = deps.fetch ?? fetch;
  const envGet = deps.envGet ?? ((name: string) => Deno.env.get(name));
  return async (request) => {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: reply({}, 200, origin).headers });
    if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405, origin);
    const authorization = request.headers.get("Authorization") ?? "";
    if (!/^Bearer\s+\S+$/i.test(authorization)) return reply({ error: "Unauthorized" }, 401, origin);
    const url = envGet("SUPABASE_URL")?.replace(/\/$/, "");
    const publicKey = publishableKey(envGet);
    const serviceKey = envGet("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !publicKey || !serviceKey) return reply({ error: "Service unavailable" }, 503, origin);
    try {
      const userResult = await fetcher(`${url}/auth/v1/user`, {
        headers: { apikey: publicKey, Authorization: authorization },
      });
      if (!userResult.ok) return reply({ error: "Unauthorized" }, 401, origin);
      const user: unknown = await userResult.json();
      const userId = user && typeof user === "object" && "id" in user ? user.id : null;
      if (typeof userId !== "string" || !uuidPattern.test(userId)) return reply({ error: "Service unavailable" }, 503, origin);
      const prepared = await rpc(fetcher, url, publicKey, authorization, "prepare_self_account_deletion", {});
      if (!prepared.ok) {
        const error = await prepared.json().catch(() => ({})) as { code?: string };
        return reply({ error: error.code === "23514" ? "Transfer Wedding ownership or control first" : "Service unavailable" },
          error.code === "23514" ? 409 : 503, origin);
      }
      const deleted = await fetcher(`${url}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ should_soft_delete: true }),
      });
      if (!deleted.ok) return reply({ error: "Account deletion pending; retry" }, 503, origin);
      return reply({ deleted: true }, 200, origin);
    } catch {
      return reply({ error: "Service unavailable" }, 503, origin);
    }
  };
}
