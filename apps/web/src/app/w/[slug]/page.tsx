import Link from "next/link";
import { loadGuestGuide, type GuestGuide, type GuideColor, type GuideSection } from "../../../lib/guest-guide";
import { guestRouteHref, isHouseholdInvitationToken } from "../../../lib/guest-rsvp";
import { GuestRsvpSection } from "./guest-rsvp-section";
import { GuestRouteNav } from "./guest-route-nav";
import "./guide.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ token?: string | string[]; invitationToken?: string | string[] }> };
function first(value: string | string[] | undefined): string | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function formatDay(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.valueOf()) ? null : new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(parsed);
}
function formatTime(value: string, timezone: string | null): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "";
  try { return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: timezone ?? "Asia/Manila" }).format(parsed); }
  catch { return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(parsed); }
}
function Swatches({ title, colors }: { title: string; colors: GuideColor[] }) {
  if (!colors.length) return null;
  return <div className="guide-swatches"><p className="guide-eyebrow">{title}</p><div className="guide-swatch-list">{colors.map((color, index) => <span className="guide-swatch" key={`${color.hex}-${index}`}>
    <span className="guide-swatch-dot" style={{ backgroundColor: color.hex }} aria-hidden="true" />{color.name || color.hex}
  </span>)}</div></div>;
}
function Section({ section, slug, token }: { section: GuideSection; slug: string; token: string | null }) {
  if (section.type === "RSVP") return <GuestRsvpSection section={section} slug={slug} token={token} />;
  if (section.type === "PLACES") return <section className="guide-card" id={section.key}>
    <p className="guide-eyebrow">FIND YOUR WAY</p><h2>Wedding Places</h2>
    {section.places.length ? <div className="guide-place-list">{section.places.map((place, index) => <article className="guide-place" key={`${place.name}-${index}`}>
      <p className="guide-eyebrow">{place.label || place.purpose.replaceAll("_", " ")}</p><h3>{place.name}</h3>
      {place.address && <p>{place.address}</p>}{place.notes && <p className="guide-muted">{place.notes}</p>}
    </article>)}</div> : <p className="guide-muted">Place details will be shared here when ready.</p>}
  </section>;
  if (section.type === "DRESS_CODE") { const dress = section.dressCode; return <section className="guide-card" id={section.key}>
    <p className="guide-eyebrow">THE CELEBRATION LOOK</p><h2>{dress?.title || "Dress Code"}</h2>
    {dress?.description && <p>{dress.description}</p>}{dress?.venueAdvice && <p>{dress.venueAdvice}</p>}
    {dress?.generalNotes && <p className="guide-muted">{dress.generalNotes}</p>}
    <Swatches title="Recommended colors" colors={dress?.recommendedColors ?? []} />
    <Swatches title="Colors to avoid" colors={dress?.avoidColors ?? []} />
    {dress?.guestGuidance.map((attire, index) => <div className="guide-attire" key={index}>
      <p className="guide-eyebrow">PERSONALIZED ATTIRE</p>
      {attire.roles.length > 0 && <p><strong>Entourage:</strong> {attire.roles.join(", ")}</p>}
      {attire.groups.length > 0 && <p><strong>Attire group:</strong> {attire.groups.join(", ")}</p>}
      {attire.instructions && <p>{attire.instructions}</p>}
      <Swatches title="Your recommended colors" colors={attire.colors} />
    </div>)}
  </section>; }
  return <section className="guide-card" id={section.key}>
    <p className="guide-eyebrow">{section.type === "INTRO" ? "A NOTE FROM US" : "WEDDING DETAILS"}</p>
    <h2>{section.type === "INTRO" ? "Welcome" : section.key.replaceAll("_", " ")}</h2>
    {section.content && <p className="guide-preserve">{section.content}</p>}
  </section>;
}
function Message({ title, description }: { title: string; description: string }) {
  return <main className="guide-page"><div className="guide-shell"><section className="guide-card guide-message">
    <p className="guide-eyebrow">KATIPAN · WEDDING GUIDE</p><h1>{title}</h1><p>{description}</p>
  </section></div></main>;
}
function Guide({ guide, token }: { guide: GuestGuide; token: string | null }) {
  const authorizedHousehold = isHouseholdInvitationToken(token);
  const passHref = authorizedHousehold ? guestRouteHref(guide.slug, "/pass", token) : null;
  const hasRsvpSection = guide.sections.some(section => section.type === "RSVP");
  return <main className={`guide-page guide-template-${guide.template.toLowerCase().replaceAll("_", "-")}`}>
    <div className="guide-shell">
      <header className="guide-hero">
        <p className="guide-eyebrow">KATIPAN · WEDDING CELEBRATION</p>
        <p className="guide-ornament" aria-hidden="true">✦</p>
        <h1>{guide.title || guide.wedding.partners.join(" & ") || guide.wedding.name || "Our Wedding"}</h1>
        {guide.wedding.date && <p className="guide-date">{formatDay(guide.wedding.date)}</p>}
        {guide.wedding.location && <p className="guide-muted">{guide.wedding.location}</p>}
        <div className="guide-rule" aria-hidden="true" />
        <p className="guide-hero-note">We are so glad you are here.</p>
      </header>
      <GuestRouteNav
        slug={guide.slug}
        token={token}
        routes={["", "/invitation", ...(authorizedHousehold && hasRsvpSection ? ["/rsvp" as const, "/rsvp/confirmation" as const] : []), ...(guide.hasGuestPass && authorizedHousehold ? ["/pass" as const] : [])]}
      />
      <nav className="guide-nav" aria-label="Guide sections">
        {guide.sections.map(section => <a key={section.key} href={`#${section.key}`}>{section.type === "INTRO" ? "Welcome" : section.type === "DRESS_CODE" ? "Dress Code" : section.type === "CUSTOM" ? section.key.replaceAll("_", " ") : section.type === "RSVP" ? "RSVP" : "Places"}</a>)}
        {guide.program.length > 0 && <a href="#program">Program</a>}
        {guide.seating.length > 0 && <a href="#seating">Seating</a>}
      </nav>
      <div className="guide-content">
        {guide.sections.map(section => <Section key={section.key} section={section} slug={guide.slug} token={token} />)}
        {guide.program.length > 0 && <section className="guide-card" id="program">
          <p className="guide-eyebrow">THE CELEBRATION</p><h2>Guest Program</h2>
          <div className="guide-program">{guide.program.map((item, index) => <article key={`${item.scheduledStart}-${index}`} className="guide-program-item">
            <p className="guide-program-time">{formatTime(item.scheduledStart, guide.wedding.timezone)}{item.scheduledEnd ? ` – ${formatTime(item.scheduledEnd, guide.wedding.timezone)}` : ""}</p>
            <div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}{item.placeName && <p className="guide-muted">{item.placeName}</p>}</div>
          </article>)}</div>
        </section>}
        {guide.seating.length > 0 && <section className="guide-card guide-seating" id="seating">
          <p className="guide-eyebrow">YOUR PLACE</p><h2>Seating</h2>
          {guide.seating.map((seat, index) => <p key={`${seat.eventName}-${index}`}>
            {seat.guestName && <strong>{seat.guestName} · </strong>}{seat.eventName}: {seat.tableName}{seat.seatLabel && ` · ${seat.seatLabel}`}
          </p>)}
        </section>}
        {guide.hasGuestPass && passHref && <section className="guide-card guide-pass-link">
          <p className="guide-eyebrow">WEDDING DAY</p><h2>Your Guest Pass</h2>
          <p>Open your individual Guest Pass for entry. Seating updates will appear on the Pass page.</p>
          <Link href={passHref} prefetch={false} className="guide-action">View Guest Pass</Link>
        </section>}
      </div>
      <footer className="guide-footer">KATIPAN · ONE WEDDING, SHARED WITH CARE</footer>
    </div>
  </main>;
}
export default async function GuestGuidePage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const token = first(query.token) ?? first(query.invitationToken);
  const result = await loadGuestGuide(slug, token);
  if (result.status === "invalid-invitation") return <Message title="Invitation access required" description="Open the latest Household invitation link to view this Wedding Guide." />;
  if (result.status !== "ready") return <Message title="Guide unavailable" description="This Wedding Guide is not available right now. Check the address or try again later." />;
  return <Guide guide={result.guide} token={token} />;
}
