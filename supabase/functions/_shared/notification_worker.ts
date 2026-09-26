type Fetcher = typeof fetch;
type EnvGet = (name: string) => string | undefined;

type Claim = {
  outbox_id: string;
  claim_token: string;
  channel: "EMAIL" | "PUSH";
  title: string;
  body: string;
};
type Device = {
  id: string;
  token: string;
  delivery_status: "RESERVED" | "ACCEPTED" | "RETRYABLE" | "REJECTED" | "UNKNOWN" | null;
};
type Destinations = { email: string | null; devices: Device[]; defer_until?: string } | null;
type Receipt = { outbox_id: string; device_id: string; ticket_id: string };

export function createNotificationWorkerHandler(deps: {
  fetch?: Fetcher;
  envGet?: EnvGet;
} = {}) {
  const fetcher = deps.fetch ?? fetch;
  const envGet = deps.envGet ?? ((name: string) => Deno.env.get(name));

  return async (request: Request): Promise<Response> => {
    const serviceKey = envGet("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = envGet("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) return Response.json({ error: "Worker unavailable" }, { status: 503 });
    if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    if (request.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rpc = async <T>(name: string, body: Record<string, unknown>): Promise<T> => {
      const response = await fetcher(`${supabaseUrl}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`RPC ${name} returned ${response.status}`);
      return await response.json() as T;
    };
    const finish = (claim: Claim, sent: boolean, error: string | null = null) =>
      rpc<boolean>("finish_notification_delivery", {
        p_outbox_id: claim.outbox_id, p_claim_token: claim.claim_token,
        p_sent: sent, p_error_code: error,
      });
    const defer = (claim: Claim, next: string) =>
      rpc<boolean>("defer_notification_delivery", {
        p_outbox_id: claim.outbox_id, p_claim_token: claim.claim_token,
        p_next_attempt_at: next,
      });

    let completed = 0;
    let deferred = 0;
    try {
      await rpc<number>("produce_payment_due_notifications", {});
      const claims = await rpc<Claim[]>("claim_notification_deliveries", { p_limit: 25 });
      for (const claim of claims) {
        const destination = await rpc<Destinations>("notification_delivery_destinations", {
          p_outbox_id: claim.outbox_id, p_claim_token: claim.claim_token,
        });
        if (!destination) {
          await finish(claim, false, claim.channel === "EMAIL" ? "ADDRESS_UNAVAILABLE" : "DEVICE_UNAVAILABLE");
          completed++;
          continue;
        }
        if (destination.defer_until) {
          await defer(claim, destination.defer_until);
          deferred++;
          continue;
        }
        if (claim.channel === "EMAIL") {
          const apiKey = envGet("RESEND_API_KEY");
          const from = envGet("NOTIFICATION_FROM_EMAIL");
          if (!apiKey || !from) {
            await defer(claim, new Date(Date.now() + 60 * 60 * 1000).toISOString());
            deferred++;
            continue;
          }
          if (!destination.email) {
            await finish(claim, false, "ADDRESS_UNAVAILABLE");
            completed++;
            continue;
          }
          let response: Response;
          try {
            response = await fetcher("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "Idempotency-Key": claim.outbox_id,
              },
              body: JSON.stringify({ from, to: [destination.email], subject: claim.title, text: claim.body }),
            });
          } catch {
            // An unknown outcome may have been accepted by the provider.
            // Do not replay it after Resend's idempotency window expires.
            await finish(claim, false, "PROVIDER_REJECTED");
            completed++;
            continue;
          }
          await finish(claim, response.ok, response.ok ? null :
            (response.status === 429 ? "PROVIDER_RETRY" : "PROVIDER_REJECTED"));
          completed++;
          continue;
        }

        if (destination.devices.length === 0) {
          await finish(claim, false, "DEVICE_UNAVAILABLE");
          completed++;
          continue;
        }
        let retry = false;
        let accepted = destination.devices.some((device) => device.delivery_status === "ACCEPTED");
        for (const device of destination.devices) {
          if (device.delivery_status && device.delivery_status !== "RETRYABLE") continue;
          const reserved = await rpc<boolean>("reserve_notification_push_delivery", {
            p_outbox_id: claim.outbox_id, p_claim_token: claim.claim_token,
            p_device_id: device.id,
          });
          if (!reserved) continue;
          let status: "ACCEPTED" | "RETRYABLE" | "REJECTED" | "UNKNOWN" = "UNKNOWN";
          let ticket: string | null = null;
          try {
            const response = await fetcher("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ to: device.token, title: claim.title, body: claim.body,
                sound: "default", data: {} }),
            });
            if (response.status === 429) status = "RETRYABLE";
            else if (response.ok) {
              const payload = await response.json() as { data?: { status?: string; id?: string } };
              if (payload.data?.status === "ok" && payload.data.id) {
                status = "ACCEPTED";
                ticket = payload.data.id;
              } else status = "REJECTED";
            }
            // Any other HTTP failure can have accepted the request. Never replay it.
          } catch {
            // An uncertain network outcome remains UNKNOWN and is never resent.
          }
          await rpc<boolean>("finish_notification_push_delivery", {
            p_outbox_id: claim.outbox_id, p_claim_token: claim.claim_token,
            p_device_id: device.id, p_status: status, p_ticket_id: ticket,
          });
          retry ||= status === "RETRYABLE";
          accepted ||= status === "ACCEPTED";
        }
        await finish(claim, !retry && accepted, retry ? "PROVIDER_RETRY" :
          (accepted ? null : "DEVICE_UNAVAILABLE"));
        completed++;
      }

      // Expo tickets report enqueueing, not final handoff. Check receipts on
      // later worker runs and revoke devices that Expo says are unregistered.
      const receipts = await rpc<Receipt[]>("pending_notification_push_receipts", { p_limit: 25 });
      if (receipts.length) {
        const response = await fetcher("https://exp.host/--/api/v2/push/getReceipts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: receipts.map((item) => item.ticket_id) }),
        });
        if (response.ok) {
          const payload = await response.json() as { data?: Record<string, {
            status?: string; details?: { error?: string } }> };
          for (const item of receipts) {
            const result = payload.data?.[item.ticket_id];
            if (result?.status === "ok" || result?.details?.error === "DeviceNotRegistered") {
              await rpc<boolean>("finish_notification_push_receipt", {
                p_outbox_id: item.outbox_id, p_device_id: item.device_id,
                p_ticket_id: item.ticket_id, p_registered: result.status === "ok",
              });
            }
          }
        }
      }
      return Response.json({ completed, deferred });
    } catch {
      return Response.json({ error: "Worker run failed" }, { status: 503 });
    }
  };
}
