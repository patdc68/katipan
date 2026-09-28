import GuestPassSwitcher from "./guest-pass-switcher";
import { isHouseholdInvitationToken, loadGuestPassGuide } from "../../../../lib/guest-pass-guide";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string | string[]; invitationToken?: string | string[] }>;
};

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function PassMessage({ title, message }: { title: string; message: string }) {
  return (
    <main className="guest-pass-page guest-pass-message-page">
      <section className="guest-pass-message" aria-labelledby="guest-pass-message-title">
        <p className="guest-pass-kicker">KATIPAN · WEDDING DAY</p>
        <h1 id="guest-pass-message-title">{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

export default async function GuestPassPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const invitationToken = first(query.token) ?? first(query.invitationToken);

  if (!isHouseholdInvitationToken(invitationToken)) {
    return <PassMessage title="Invitation access required" message="Open the latest Household invitation link to view a Guest Pass." />;
  }

  const result = await loadGuestPassGuide(slug, invitationToken);
  if (result.status === "invalid-invitation") {
    return <PassMessage title="Invitation link unavailable" message="This invitation link is invalid or has expired. Open the latest Household invitation link to continue." />;
  }
  if (result.status === "empty") {
    return <PassMessage title="No active Guest Pass" message="There is no active Guest Pass available for this Household yet. Contact the wedding planner if you expected to see one." />;
  }
  if (result.status !== "ready") {
    return <PassMessage title="Guest Pass unavailable" message="We couldn't load this Guest Pass right now. Try opening the invitation link again." />;
  }

  return (
    <GuestPassSwitcher
      weddingName={result.guide.weddingName}
      weddingDate={result.guide.weddingDate}
      websiteTitle={result.guide.websiteTitle}
      passes={result.guide.passes}
    />
  );
}
