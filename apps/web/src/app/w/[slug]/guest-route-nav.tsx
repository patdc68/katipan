import Link from "next/link";
import { guestRouteHref, type GuestRoute } from "../../../lib/guest-rsvp";

const routeLabels: Record<GuestRoute, string> = {
  "": "Wedding Guide",
  "/invitation": "Invitation",
  "/rsvp": "RSVP",
  "/rsvp/confirmation": "Confirmation",
  "/pass": "Guest Pass",
};

export function GuestRouteNav({
  slug,
  token,
  routes,
  current,
}: {
  slug: string;
  token: string | null;
  routes: GuestRoute[];
  current?: GuestRoute;
}) {
  return (
    <nav className="guest-route-nav" aria-label="Wedding guest pages">
      {routes.map((route) => (
        <Link
          key={route || "guide"}
          href={guestRouteHref(slug, route, token)}
          aria-current={route === current ? "page" : undefined}
        >
          {routeLabels[route]}
        </Link>
      ))}
    </nav>
  );
}
