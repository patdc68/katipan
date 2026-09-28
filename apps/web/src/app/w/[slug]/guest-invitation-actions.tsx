import Link from "next/link";
import { guestRouteHref, isHouseholdInvitationToken } from "../../../lib/guest-rsvp";

export function GuestInvitationActions({
  slug,
  token,
  hasRsvpSection,
  hasGuestPass,
}: {
  slug: string;
  token: string | null;
  hasRsvpSection: boolean;
  hasGuestPass: boolean;
}) {
  const authorizedHousehold = isHouseholdInvitationToken(token);
  const canRespond = authorizedHousehold && hasRsvpSection;
  return (
    <section className="guide-card guest-invitation-actions" aria-labelledby="invitation-actions-title">
      <p className="guide-eyebrow">WE WOULD LOVE TO CELEBRATE WITH YOU</p>
      <h2 id="invitation-actions-title">Your invitation, your way</h2>
      <p>See the Wedding Guide for event details, places, attire, and other guest information.</p>
      <div className="guest-flow-actions">
        <Link className="guide-action" href={guestRouteHref(slug, "", token)}>View Wedding Guide</Link>
        {canRespond ? (
          <Link className="guest-secondary-action" href={guestRouteHref(slug, "/rsvp", token)}>RSVP</Link>
        ) : (
          <div className="guest-rsvp-access-note">
            <button className="guest-secondary-action" type="button" disabled aria-describedby="guest-invitation-rsvp-access">
              RSVP
            </button>
            <p id="guest-invitation-rsvp-access">
              {authorizedHousehold
                ? "RSVP details are not available for this Wedding yet."
                : "Open your Household invitation link to respond."}
            </p>
          </div>
        )}
        {hasGuestPass && authorizedHousehold && (
          <Link className="guest-text-action" href={guestRouteHref(slug, "/pass", token)}>View Guest Pass</Link>
        )}
      </div>
    </section>
  );
}
