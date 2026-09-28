import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuestInvitationActions } from "./guest-invitation-actions";
import { GuestRsvpSection } from "./guest-rsvp-section";

const token = "e".repeat(64);
const slug = "juan-maria";

describe("invitation and Wedding Guide RSVP actions", () => {
  it("keeps the public invitation RSVP action disabled without a Household token", () => {
    const html = renderToStaticMarkup(createElement(GuestInvitationActions, {
      slug, token: null, hasRsvpSection: false, hasGuestPass: false,
    }));
    expect(html).toContain("disabled");
    expect(html).toContain("Open your Household invitation link to respond.");
    expect(html).not.toContain("/w/juan-maria/rsvp");
  });

  it("requires a projected RSVP section as well as a token before enabling the invitation action", () => {
    const html = renderToStaticMarkup(createElement(GuestInvitationActions, {
      slug, token, hasRsvpSection: false, hasGuestPass: false,
    }));
    expect(html).toContain("disabled");
    expect(html).toContain("RSVP details are not available for this Wedding yet.");
    expect(html).not.toContain(`/w/juan-maria/rsvp?token=${token}`);
  });

  it("preserves the valid token on the invitation RSVP, Guide, and Pass actions", () => {
    const html = renderToStaticMarkup(createElement(GuestInvitationActions, {
      slug, token, hasRsvpSection: true, hasGuestPass: true,
    }));
    expect(html).toContain(`/w/juan-maria?token=${token}`);
    expect(html).toContain(`/w/juan-maria/rsvp?token=${token}`);
    expect(html).toContain(`/w/juan-maria/pass?token=${token}`);
    expect(html).not.toContain("disabled");
  });

  it("shows the Household’s individual RSVP progress and only links to RSVP for token-scoped Guests", () => {
    const section = {
      key: "responses",
      rsvps: [
        { name: "Juan Santos", status: "ATTENDING" },
        { name: "Maria Santos", status: "NO_RESPONSE" },
      ],
    };
    const invited = renderToStaticMarkup(createElement(GuestRsvpSection, { section, slug, token }));
    expect(invited).toContain("1 of 2 responded");
    expect(invited).toContain("Juan Santos");
    expect(invited).toContain("Maria Santos");
    expect(invited).toContain(`/w/juan-maria/rsvp?token=${token}`);

    const publicGuide = renderToStaticMarkup(createElement(GuestRsvpSection, { section: { key: "responses", rsvps: [] }, slug, token: null }));
    expect(publicGuide).toContain("Open your Household invitation link to respond.");
    expect(publicGuide).not.toContain("/w/juan-maria/rsvp");
  });
});
