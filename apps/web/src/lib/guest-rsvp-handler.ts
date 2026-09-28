import { GUEST_RSVP_CHOICES, type GuestRsvpChoice } from "./guest-rsvp";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const tokenPattern = /^[0-9a-f]{64}$/;
const guestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = ["slug", "token", "guestId", "status", "mealChoice", "dietaryNotes", "responseNotes"] as const;

type SubmissionBody = {
  slug: string;
  token: string;
  guestId: string;
  status: GuestRsvpChoice;
  mealChoice: string | null;
  dietaryNotes: string | null;
  responseNotes: string | null;
};

type HandlerDependencies = {
  fetcher?: typeof fetch;
  envGet?: (key: string) => string | undefined;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNullableText(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.length <= 2000);
}

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
  });
}

function parseSubmission(value: unknown, routeSlug: string): SubmissionBody | null {
  if (!isRecord(value) || Object.keys(value).length !== fields.length
    || fields.some((field) => !Object.prototype.hasOwnProperty.call(value, field))) return null;

  const { slug, token, guestId, status, mealChoice, dietaryNotes, responseNotes } = value;
  if (typeof slug !== "string" || slug !== routeSlug || slug.length > 80 || !slugPattern.test(slug)
    || typeof token !== "string" || !tokenPattern.test(token)
    || typeof guestId !== "string" || !guestIdPattern.test(guestId)
    || typeof status !== "string" || !GUEST_RSVP_CHOICES.includes(status as GuestRsvpChoice)
    || !isNullableText(mealChoice) || !isNullableText(dietaryNotes) || !isNullableText(responseNotes)) return null;

  return {
    slug,
    token,
    guestId,
    status: status as GuestRsvpChoice,
    mealChoice,
    dietaryNotes,
    responseNotes,
  };
}

export function createGuestRsvpHandler(dependencies: HandlerDependencies = {}) {
  const fetcher = dependencies.fetcher ?? fetch;
  const envGet = dependencies.envGet ?? ((key: string) => process.env[key]);

  return async (request: Request, routeSlug: string): Promise<Response> => {
    if (request.method !== "POST") return json({ error: "This response could not be saved." }, 405);
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
      return json({ error: "Please try submitting your response again." }, 415);
    }
    if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > 8192) {
      return json({ error: "Please try submitting your response again." }, 413);
    }

    let body: unknown;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 8192) {
        return json({ error: "Please try submitting your response again." }, 413);
      }
      body = JSON.parse(raw) as unknown;
    } catch {
      return json({ error: "Please try submitting your response again." }, 400);
    }

    const submission = parseSubmission(body, routeSlug);
    if (!submission) return json({ error: "Please choose Attend or Decline using your Household invitation link." }, 400);

    const supabaseUrl = envGet("SUPABASE_URL") ?? envGet("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = envGet("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Your response could not be saved right now. Please try again later." }, 503);
    }

    try {
      const response = await fetcher(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/guest_submit_rsvp`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          p_slug: submission.slug,
          p_token: submission.token,
          p_guest_id: submission.guestId,
          p_status: submission.status,
          p_meal_choice: submission.mealChoice,
          p_dietary_notes: submission.dietaryNotes,
          p_response_notes: submission.responseNotes,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null) as { code?: string } | null;
        if (error?.code === "42501") {
          return json({ error: "This invitation link is no longer available. Open the latest Household invitation link." }, 403);
        }
        if (error?.code === "P0002") {
          return json({ error: "This Wedding RSVP is not available right now." }, 404);
        }
        return json({ error: "Your response could not be saved right now. Please try again later." }, 503);
      }

      return json({ status: "saved" }, 200);
    } catch {
      return json({ error: "Your response could not be saved right now. Please try again later." }, 503);
    }
  };
}
