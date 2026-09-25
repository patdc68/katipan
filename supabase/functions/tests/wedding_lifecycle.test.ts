import { createAccountDeletionHandler, createWeddingDeletionHandler } from "../_shared/wedding_lifecycle.ts";

const weddingId = "10000000-0000-0000-0000-000000000001";
const accountId = "00000000-0000-0000-0000-000000000001";
const nonce = "20000000-0000-0000-0000-000000000001";
const envGet = (key: string) => ({
  SUPABASE_URL: "https://project.test",
  SUPABASE_PUBLISHABLE_KEY: "public-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-secret",
} as Record<string, string>)[key];
const request = (body: unknown = {}) => new Request("https://functions.test/lifecycle", {
  method: "POST", headers: { Authorization: "Bearer user-jwt" }, body: JSON.stringify(body),
});

Deno.test("Wedding deletion validates the caller and confirms the exact Wedding", async () => {
  let calls = 0;
  const fetcher = (() => { calls++; return Promise.resolve(Response.json({})); }) as typeof fetch;
  const handler = createWeddingDeletionHandler({ fetch: fetcher, envGet });
  const unauthorized = await handler(new Request("https://functions.test/lifecycle", { method: "POST", body: "{}" }));
  const invalid = await handler(request({ weddingId, confirmName: "" }));
  if (unauthorized.status !== 401 || invalid.status !== 400 || calls !== 0) throw new Error("Invalid deletion reached server");
});

Deno.test("Wedding deletion removes Storage bytes before finalizing Wedding data", async () => {
  const calls: Array<{ url: string; authorization: string; body: unknown }> = [];
  let listCount = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const authorization = new Headers(init?.headers).get("Authorization") ?? "";
    const body = init?.body ? JSON.parse(String(init.body)) as unknown : null;
    calls.push({ url, authorization, body });
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: accountId });
    if (url.endsWith("/rpc/request_wedding_deletion")) return Response.json(nonce);
    if (url.endsWith("/rpc/list_wedding_deletion_objects")) {
      return Response.json(listCount++ === 0 ? [{ object_path: `weddings/${weddingId}/attachment/file` }] : []);
    }
    if (url.endsWith("/storage/v1/object/wedding-files")) return Response.json([]);
    if (url.endsWith("/rpc/finalize_wedding_deletion")) return Response.json(true);
    throw new Error("Unexpected call");
  }) as typeof fetch;
  const result = await createWeddingDeletionHandler({ fetch: fetcher, envGet })(request({ weddingId, confirmName: "Test" }));
  const responseBody = await result.json();
  if (result.status !== 200 || responseBody.deleted !== true) throw new Error("Wedding deletion failed");
  const storageIndex = calls.findIndex((call) => call.url.endsWith("/storage/v1/object/wedding-files"));
  const finalizeIndex = calls.findIndex((call) => call.url.endsWith("/rpc/finalize_wedding_deletion"));
  if (storageIndex < 0 || finalizeIndex <= storageIndex || calls[storageIndex].authorization !== "Bearer service-secret" ||
    calls.find((call) => call.url.endsWith("/rpc/request_wedding_deletion"))?.authorization !== "Bearer user-jwt" ||
    JSON.stringify(responseBody).includes("service-secret")) throw new Error("Unsafe deletion sequence");
});

Deno.test("Storage removal failure leaves Wedding deletion pending", async () => {
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: accountId });
    if (url.endsWith("/rpc/request_wedding_deletion")) return Response.json(nonce);
    if (url.endsWith("/rpc/list_wedding_deletion_objects")) return Response.json([{ object_path: `weddings/${weddingId}/file` }]);
    if (url.endsWith("/storage/v1/object/wedding-files")) return Response.json({}, { status: 500 });
    throw new Error("Finalization was reached");
  }) as typeof fetch;
  const result = await createWeddingDeletionHandler({ fetch: fetcher, envGet })(request({ weddingId, confirmName: "Test" }));
  if (result.status !== 503) throw new Error("Failed Storage cleanup was treated as success");
});

Deno.test("Account deletion derives user ID from Auth and requests soft deletion", async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) as unknown : null });
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: accountId });
    if (url.endsWith("/rpc/prepare_self_account_deletion")) return Response.json(true);
    if (url.endsWith(`/auth/v1/admin/users/${accountId}`)) return Response.json({});
    throw new Error("Unexpected call");
  }) as typeof fetch;
  const result = await createAccountDeletionHandler({ fetch: fetcher, envGet })(request({ userId: weddingId }));
  if (result.status !== 200 || calls[1].body && JSON.stringify(calls[1].body).includes(weddingId) ||
    calls[2].url !== `https://project.test/auth/v1/admin/users/${accountId}` ||
    JSON.stringify(calls[2].body) !== '{"should_soft_delete":true}') throw new Error("Unsafe account deletion");
});

Deno.test("Account deletion refuses to call Auth Admin when ownership is blocked", async () => {
  let adminCalled = false;
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: accountId });
    if (url.endsWith("/rpc/prepare_self_account_deletion")) return Response.json({ code: "23514" }, { status: 409 });
    adminCalled = true;
    return Response.json({});
  }) as typeof fetch;
  const result = await createAccountDeletionHandler({ fetch: fetcher, envGet })(request());
  if (result.status !== 409 || adminCalled) throw new Error("Blocked account deletion reached Auth Admin");
});
