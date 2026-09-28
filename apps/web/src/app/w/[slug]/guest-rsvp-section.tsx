import Link from "next/link";
import { guestRouteHref, isHouseholdInvitationToken } from "../../../lib/guest-rsvp";
import type { GuideSection } from "../../../lib/guest-guide";

export function GuestRsvpSection({ section, slug, token }: {
  section: Pick<GuideSection, "key" | "rsvps">;
  slug: string;
  token: string | null;
}) {
  const authorizedHousehold = isHouseholdInvitationToken(token);
  return (
    <section className="guide-card" id={section.key}>
      <p className="guide-eyebrow">YOUR INVITATION</p>
      <h2>RSVP</h2>
      {section.rsvps.length ? (
        <ul className="guide-plain-list">
          {section.rsvps.map((guest, index) => (
            <li key={`${guest.name}-${index}`}>
              {guest.name} · {guest.status.replaceAll("_", " ").toLowerCase()}
            </li>
          ))}
        </ul>
      ) : (
        <p>RSVP details will appear here when available.</p>
      )}
      {authorizedHousehold ? (
        <>
          <p className="guide-muted">
            {section.rsvps.filter((guest) => guest.status !== "NO_RESPONSE").length} of {section.rsvps.length} responded. Each Guest responds separately.
          </p>
          <Link className="guide-action" href={guestRouteHref(slug, "/rsvp", token)}>Update RSVP</Link>
        </>
      ) : (
        <p className="guide-muted">Open your Household invitation link to respond.</p>
      )}
    </section>
  );
}
