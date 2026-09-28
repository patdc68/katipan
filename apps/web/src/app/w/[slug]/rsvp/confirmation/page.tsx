import Link from "next/link";
import {
  countResponded,
  formatGuestRsvpStatus,
  guestRouteHref,
  isHouseholdInvitationToken,
  loadGuestRsvpSummary,
} from "../../../../../lib/guest-rsvp";
import { GuestRouteNav } from "../../guest-route-nav";
import "../../guide.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string | string[]; invitationToken?: string | string[] }>;
};

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function ConfirmationMessage({ title, message, slug, token }: {
  title: string;
  message: string;
  slug: string;
  token: string | null;
}) {
  return (
    <main className="guide-page">
      <div className="guide-shell">
        <section className="guide-card guide-message" aria-labelledby="confirmation-message-title">
          <p className="guide-eyebrow">KATIPAN · RSVP CONFIRMATION</p>
          <h1 id="confirmation-message-title">{title}</h1>
          <p>{message}</p>
          <div className="guest-flow-actions">
            <Link className="guide-action" href={guestRouteHref(slug, "/rsvp", token)}>Return to RSVP</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default async function GuestRsvpConfirmationPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const token = first(query.token) ?? first(query.invitationToken);

  if (!isHouseholdInvitationToken(token)) {
    return <ConfirmationMessage
      title="Household invitation required"
      message="Open the latest Household invitation link to review its RSVP responses."
      slug={slug}
      token={null}
    />;
  }

  const result = await loadGuestRsvpSummary(slug, token);
  if (result.status === "invalid-invitation") {
    return <ConfirmationMessage
      title="Invitation link unavailable"
      message="This invitation link is invalid, expired, or has been replaced. Open the latest Household invitation link to continue."
      slug={slug}
      token={null}
    />;
  }
  if (result.status !== "ready") {
    return <ConfirmationMessage
      title="Responses unavailable"
      message="We couldn't load this Household's RSVP responses right now. Please try again later."
      slug={slug}
      token={token}
    />;
  }

  const { summary } = result;
  if (!summary.hasRsvpSection || summary.guests.length === 0) {
    return <ConfirmationMessage
      title="No RSVP responses to show"
      message="There are no named Guests available for this Household invitation."
      slug={slug}
      token={token}
    />;
  }

  const title = summary.title || summary.partners.join(" & ") || summary.weddingName || "Our Wedding";
  const responded = countResponded(summary.guests);

  return (
    <main className={`guide-page guide-template-${summary.template.toLowerCase().replaceAll("_", "-")}`}>
      <div className="guide-shell guest-rsvp-shell">
        <header className="guide-hero guest-confirmation-hero">
          <p className="guide-eyebrow">KATIPAN · RSVP CONFIRMATION</p>
          <p className="guest-confirmation-mark" aria-hidden="true">✓</p>
          <h1>We can’t wait to celebrate with you!</h1>
          <p className="guest-rsvp-wedding-title">{title}</p>
          <p>Your Household responses are up to date.</p>
        </header>

        <GuestRouteNav
          slug={summary.slug}
          token={token}
          current="/rsvp/confirmation"
          routes={["", "/invitation", "/rsvp", "/rsvp/confirmation", ...(summary.hasGuestPass ? ["/pass" as const] : [])]}
        />

        <section className="guide-card guest-rsvp-summary" aria-labelledby="confirmation-summary-title" aria-live="polite">
          <p className="guide-eyebrow">YOUR HOUSEHOLD</p>
          <h2 id="confirmation-summary-title">{responded} of {summary.guests.length} responded</h2>
          <ul className="guest-confirmation-list">
            {summary.guests.map((guest) => (
              <li key={guest.guestId}>
                <span>{guest.name}</span>
                <strong>{formatGuestRsvpStatus(guest.status)}</strong>
              </li>
            ))}
          </ul>
          <p className="guide-muted">You can update a Guest’s response while this Household invitation link is active.</p>
        </section>

        <div className="guest-flow-actions guest-confirmation-actions">
          <Link className="guide-action" href={guestRouteHref(summary.slug, "", token)}>View Wedding Guide</Link>
          <Link className="guest-secondary-action" href={guestRouteHref(summary.slug, "/rsvp", token)}>Update RSVP</Link>
        </div>
        <footer className="guide-footer">KATIPAN · ONE WEDDING, SHARED WITH CARE</footer>
      </div>
    </main>
  );
}
