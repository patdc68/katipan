import { createNotificationWorkerHandler } from "../_shared/notification_worker.ts";

const env = (name: string) => ({
  SUPABASE_URL: "https://project.test",
  SUPABASE_SERVICE_ROLE_KEY: "server-secret",
  RESEND_API_KEY: "email-secret",
  NOTIFICATION_FROM_EMAIL: "KATIPAN <notice@example.test>",
} as Record<string, string>)[name];
const authorized = () => new Request("https://project.test/functions/v1/notification-worker", {
  method: "POST", headers: { Authorization: "Bearer server-secret" },
});
const claim = (channel: "EMAIL" | "PUSH") => ({
  outbox_id: "00000000-0000-0000-0000-000000000001",
  claim_token: "00000000-0000-0000-0000-000000000002",
  channel, title: "Guest list updated", body: "An important update was made.",
});

Deno.test("worker rejects callers without the service credential", async () => {
  let calls = 0;
  const handler = createNotificationWorkerHandler({ envGet: env, fetch: (() => {
    calls++; return Promise.resolve(Response.json([]));
  }) as typeof fetch });
  const response = await handler(new Request("https://project.test", { method: "POST" }));
  if (response.status !== 401 || calls !== 0) throw new Error("Unauthorized worker invocation");
});

Deno.test("email send uses stable provider idempotency key and marks success", async () => {
  const calls: Array<{ url: string; body: unknown; headers: Headers }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as unknown : null;
    calls.push({ url, body, headers: new Headers(init?.headers) });
    if (url.endsWith("/rpc/claim_notification_deliveries")) return Response.json([claim("EMAIL")]);
    if (url.endsWith("/rpc/notification_delivery_destinations")) {
      return Response.json({ email: "member@example.test", devices: [] });
    }
    if (url.endsWith("/rpc/pending_notification_push_receipts")) return Response.json([]);
    if (url.includes("api.resend.com")) return Response.json({ id: "provider-id" });
    return Response.json(true);
  }) as typeof fetch;
  const result = await createNotificationWorkerHandler({ envGet: env, fetch: fetcher })(authorized());
  const provider = calls.find((item) => item.url.includes("api.resend.com"));
  const finish = calls.find((item) => item.url.endsWith("/rpc/finish_notification_delivery"));
  if (result.status !== 200 || !provider || !finish ||
    provider.headers.get("Idempotency-Key") !== claim("EMAIL").outbox_id ||
    (finish.body as { p_sent: boolean }).p_sent !== true ||
    JSON.stringify(await result.json()).includes("secret")) throw new Error("Email dispatch failed");
});

Deno.test("quiet hours defer the same outbox row", async () => {
  const names: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const name = String(input).split("/").at(-1) ?? "";
    names.push(name);
    if (name === "claim_notification_deliveries") return Response.json([claim("PUSH")]);
    if (name === "notification_delivery_destinations") {
      return Response.json({ defer_until: "2026-09-27T00:00:00Z" });
    }
    if (name === "pending_notification_push_receipts") return Response.json([]);
    return Response.json(true);
  }) as typeof fetch;
  await createNotificationWorkerHandler({ envGet: env, fetch: fetcher })(authorized());
  if (!names.includes("defer_notification_delivery") || names.includes("finish_notification_delivery") ||
    names.includes("send")) throw new Error("Quiet hours discarded a notification");
});

Deno.test("ambiguous email response is terminal so retries cannot duplicate it", async () => {
  let resultCode = "";
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/rpc/claim_notification_deliveries")) return Response.json([claim("EMAIL")]);
    if (url.endsWith("/rpc/notification_delivery_destinations")) {
      return Response.json({ email: "member@example.test", devices: [] });
    }
    if (url.endsWith("/rpc/pending_notification_push_receipts")) return Response.json([]);
    if (url.endsWith("/rpc/finish_notification_delivery")) {
      resultCode = (JSON.parse(String(init?.body)) as { p_error_code: string }).p_error_code;
      return Response.json(true);
    }
    if (url.includes("api.resend.com")) throw new Error("Network timeout");
    return Response.json(true);
  }) as typeof fetch;
  await createNotificationWorkerHandler({ envGet: env, fetch: fetcher })(authorized());
  if (resultCode !== "PROVIDER_REJECTED") throw new Error("Ambiguous email would retry");
});

Deno.test("push reserves each device; already accepted devices are not resent", async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as unknown : null;
    calls.push({ url, body });
    if (url.endsWith("/rpc/claim_notification_deliveries")) return Response.json([claim("PUSH")]);
    if (url.endsWith("/rpc/notification_delivery_destinations")) return Response.json({
      email: null, devices: [
        { id: "device-1", token: "ExpoPushToken[device111]", delivery_status: null },
        { id: "device-2", token: "ExpoPushToken[device222]", delivery_status: "ACCEPTED" },
      ],
    });
    if (url.endsWith("/rpc/pending_notification_push_receipts")) return Response.json([]);
    if (url.endsWith("/rpc/reserve_notification_push_delivery")) return Response.json(true);
    if (url.includes("/push/send")) return Response.json({ data: { status: "ok", id: "expo-ticket" } });
    return Response.json(true);
  }) as typeof fetch;
  const result = await createNotificationWorkerHandler({ envGet: env, fetch: fetcher })(authorized());
  const sends = calls.filter((item) => item.url.includes("/push/send"));
  const reservations = calls.filter((item) => item.url.endsWith("/rpc/reserve_notification_push_delivery"));
  if (result.status !== 200 || sends.length !== 1 || reservations.length !== 1 ||
    (sends[0].body as { to: string }).to !== "ExpoPushToken[device111]" ||
    !calls.some((item) => item.url.endsWith("/rpc/finish_notification_push_delivery"))) {
    throw new Error("Duplicate or missing per-device push dispatch");
  }
});

Deno.test("ambiguous push response is recorded without retrying the device", async () => {
  let pushCalls = 0;
  let deviceStatus = "";
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/rpc/claim_notification_deliveries")) return Response.json([claim("PUSH")]);
    if (url.endsWith("/rpc/notification_delivery_destinations")) return Response.json({
      email: null, devices: [{ id: "device-1", token: "ExpoPushToken[device111]", delivery_status: null }],
    });
    if (url.endsWith("/rpc/pending_notification_push_receipts")) return Response.json([]);
    if (url.endsWith("/rpc/reserve_notification_push_delivery")) return Response.json(true);
    if (url.endsWith("/rpc/finish_notification_push_delivery")) {
      deviceStatus = (JSON.parse(String(init?.body)) as { p_status: string }).p_status;
      return Response.json(true);
    }
    if (url.includes("/push/send")) { pushCalls++; throw new Error("Network timeout"); }
    return Response.json(true);
  }) as typeof fetch;
  await createNotificationWorkerHandler({ envGet: env, fetch: fetcher })(authorized());
  if (pushCalls !== 1 || deviceStatus !== "UNKNOWN") throw new Error("Ambiguous push was retried");
});
