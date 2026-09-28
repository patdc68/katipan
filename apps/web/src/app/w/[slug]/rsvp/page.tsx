import Link from "next/link";
import { loadGuestRsvpForm, guestRouteHref, isHouseholdInvitationToken } from "../../../../lib/guest-rsvp";
import { GuestRouteNav } from "../guest-route-nav";
import GuestRsvpForm from "./guest-rsvp-form";
import "../guide.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string | string[]; invitationToken?: string | string[] }>;
};

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDay(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.valueOf())
    ? null
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(parsed);
}

function RsvpMessage({ title, message, slug, token }: {
  title: string;
  message: string;
  slug: string;
  token: string | null;
}) {
  return (
    <main className="guide-page">
      <div className="guide-shell">
        <section className="guide-card guide-message" aria-labelledby="rsvp-message-title">
          <p className="guide-eyebrow">KATIPAN · GUEST RSVP</p>
          <h1 id="rsvp-message-title">{title}</h1>
          <p>{message}</p>
          <div className="guest-flow-actions">
            <Link className="guide-action" href={guestRouteHref(slug, "/invitation", token)}>View Invitation</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default async function GuestRsvpPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const token = first(query.token) ?? first(query.invitationToken);

  if (!isHouseholdInvitationToken(token)) {
    return <RsvpMessage
      title="Household invitation required"
      message="Open the latest Household invitation link to respond for each Guest."
      slug={slug}
      token={null}
    />;
  }

  const result = await loadGuestRsvpForm(slug, token);
  if (result.status === "invalid-invitation") {
    return <RsvpMessage
      title="Invitation link unavailable"
      message="This invitation link is invalid, expired, or has been replaced. Open the latest Household invitation link to continue."
      slug={slug}
      token={null}
    />;
  }
  if (result.status !== "ready") {
    return <RsvpMessage
      title="RSVP unavailable"
      message="We couldn't load your Household RSVP details right now. Please try the invitation link again later."
      slug={slug}
      token={token}
    />;
  }

  const { projection } = result;
  if (!projection.hasRsvpSection || projection.guests.length === 0) {
    return <RsvpMessage
      title="RSVP details are not available yet"
      message="There are no named Guests available to respond for this invitation. Please contact the couple or wedding planner."
      slug={slug}
      token={token}
    />;
  }

  const title = projection.title || projection.partners.join(" & ") || projection.weddingName || "Our Wedding";
  return (
    <main className={`guide-page guide-template-${projection.template.toLowerCase().replaceAll("_", "-")}`}>
      <div className="guide-shell guest-rsvp-shell">
        <header className="guide-hero guest-rsvp-hero">
          <p className="guide-eyebrow">KATIPAN · GUEST RSVP</p>
          <p className="guide-ornament" aria-hidden="true">✦</p>
          <h1>Will you celebrate with us?</h1>
          <p className="guest-rsvp-wedding-title">{title}</p>
          {formatDay(projection.weddingDate) && <p className="guide-date">{formatDay(projection.weddingDate)}</p>}
          {projection.location && <p className="guide-muted">{projection.location}</p>}
          <div className="guide-rule" aria-hidden="true" />
          <p>Choose a response for each named Guest in your Household.</p>
        </header>

        <GuestRouteNav slug={projection.slug} token={token} current="/rsvp" routes={["", "/invitation"]} />
        <GuestRsvpForm slug={projection.slug} token={token} guests={projection.guests} />
      </div>
    </main>
  );
}
