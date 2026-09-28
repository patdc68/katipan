import { loadGuestGuide, type GuestGuide } from "../../../../lib/guest-guide";
import { isHouseholdInvitationToken } from "../../../../lib/guest-rsvp";
import { GuestInvitationActions } from "../guest-invitation-actions";
import { GuestRouteNav } from "../guest-route-nav";
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

function weddingTitle(guide: GuestGuide): string {
  return guide.title || guide.wedding.partners.join(" & ") || guide.wedding.name || "Our Wedding";
}

function formatDay(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.valueOf())
    ? null
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(parsed);
}

function InvitationMessage({ title, message }: { title: string; message: string }) {
  return (
    <main className="guide-page">
      <div className="guide-shell">
        <section className="guide-card guide-message" aria-labelledby="invitation-message-title">
          <p className="guide-eyebrow">KATIPAN · WEDDING INVITATION</p>
          <h1 id="invitation-message-title">{title}</h1>
          <p>{message}</p>
        </section>
      </div>
    </main>
  );
}

function Invitation({ guide, token }: { guide: GuestGuide; token: string | null }) {
  const authorizedHousehold = isHouseholdInvitationToken(token);
  const rsvpSection = guide.sections.find((section) => section.type === "RSVP");
  const guests = rsvpSection?.rsvps ?? [];
  const canRespond = authorizedHousehold && rsvpSection !== undefined;
  const intro = guide.sections.find((section) => section.type === "INTRO")?.content;
  const date = formatDay(guide.wedding.date);

  return (
    <main className={`guide-page guide-template-${guide.template.toLowerCase().replaceAll("_", "-")}`}>
      <div className="guide-shell guest-invitation-shell">
        <header className="guide-hero guest-invitation-hero">
          <p className="guide-eyebrow">KATIPAN · WEDDING CELEBRATION</p>
          <p className="guide-ornament" aria-hidden="true">✦</p>
          <h1>{weddingTitle(guide)}</h1>
          {date && <p className="guide-date">{date}</p>}
          {guide.wedding.location && <p className="guide-muted">{guide.wedding.location}</p>}
          <div className="guide-rule" aria-hidden="true" />
          <p className="guest-invitation-copy">{intro || "You are warmly invited to celebrate with us."}</p>
        </header>

        <GuestRouteNav
          slug={guide.slug}
          token={token}
          current="/invitation"
          routes={["", ...(canRespond ? ["/rsvp" as const] : []), ...(guide.hasGuestPass && authorizedHousehold ? ["/pass" as const] : [])]}
        />

        <div className="guide-content">
          {authorizedHousehold && guests.length > 0 && (
            <section className="guide-card guest-invitation-household" aria-labelledby="invitation-household-title">
              <p className="guide-eyebrow">YOUR HOUSEHOLD INVITATION</p>
              <h2 id="invitation-household-title">We have you on our guest list</h2>
              <p className="guide-muted">Each Guest can respond separately.</p>
              <ul className="guest-invitation-guest-list">
                {guests.map((guest, index) => (
                  <li key={`${guest.name}-${index}`}>
                    <span>{guest.name}</span>
                    <span className="guest-invitation-status">{guest.status.replaceAll("_", " ").toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <GuestInvitationActions
            slug={guide.slug}
            token={token}
            hasRsvpSection={rsvpSection !== undefined}
            hasGuestPass={guide.hasGuestPass}
          />
        </div>

        <footer className="guide-footer">KATIPAN · ONE WEDDING, SHARED WITH CARE</footer>
      </div>
    </main>
  );
}

export default async function GuestInvitationPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const token = first(query.token) ?? first(query.invitationToken);
  const result = await loadGuestGuide(slug, token);
  if (result.status === "invalid-invitation") {
    return <InvitationMessage title="Invitation access required" message="Open the latest Household invitation link to view this Wedding invitation." />;
  }
  if (result.status !== "ready") {
    return <InvitationMessage title="Invitation unavailable" message="This Wedding invitation is not available right now. Check the address or try again later." />;
  }
  return <Invitation guide={result.guide} token={token} />;
}
