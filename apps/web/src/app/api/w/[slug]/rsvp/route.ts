import "server-only";
import { createGuestRsvpHandler } from "../../../../../lib/guest-rsvp-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const submitGuestRsvp = createGuestRsvpHandler();

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params;
  return submitGuestRsvp(request, slug);
}
