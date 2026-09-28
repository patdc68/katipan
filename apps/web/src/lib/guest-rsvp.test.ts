import { afterEach, describe, expect, it, vi } from "vitest";
import {
  countResponded,
  guestRouteHref,
  GUEST_RSVP_CHOICES,
  isHouseholdInvitationToken,
  loadGuestRsvpForm,
  loadGuestRsvpSummary,
  parseGuestRsvpProjection,
  tryBeginGuestRsvpSubmit,
} from "./guest-rsvp";

const token = "a".repeat(64);
const juan = "10000000-0000-4000-8000-000000000001";
const maria = "10000000-0000-4000-8000-000000000002";
const child = "10000000-0000-4000-8000-000000000003";

function guest(guestId: string, name: string, status: string, extra: Record<string, unknown> = {}) {
  return { guestId, name, status, mealChoice: null, dietaryNotes: null, responseNotes: null, ...extra };
}

function guide() {
  return {
    slug: "juan-maria",
    title: "Juan & Maria",
    template: "SAMPAGUITA",
    wedding: { name: "Juan & Maria", date: "2027-02-14", timezone: "Asia/Manila", location: "Manila", partners: ["Juan", "Maria"] },
    sections: [{
      key: "responses",
      type: "RSVP",
      audience: "PERSONALIZED",
      data: [
        guest(juan, "Juan Santos", "ATTENDING", { mealChoice: "Fish", dietaryNotes: "No peanuts", responseNotes: "Thank you", privatePhone: "+639170000000" }),
        guest(maria, "Maria Santos", "DECLINED"),
        guest(child, "Lia Santos", "NO_RESPONSE"),
        { allowanceType: "CHILD", remaining: 1 },
      ],
    }],
    guestPasses: [],
    privateHouseholdName: "Santos Family",
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("token-scoped Guest RSVP projection", () => {
  it("parses named individual Guests and all editable response values only", () => {
    const parsed = parseGuestRsvpProjection(guide(), "juan-maria");
    expect(parsed?.guests).toEqual([
      { guestId: juan, name: "Juan Santos", status: "ATTENDING", mealChoice: "Fish", dietaryNotes: "No peanuts", responseNotes: "Thank you" },
      { guestId: maria, name: "Maria Santos", status: "DECLINED", mealChoice: null, dietaryNotes: null, responseNotes: null },
      { guestId: child, name: "Lia Santos", status: "NO_RESPONSE", mealChoice: null, dietaryNotes: null, responseNotes: null },
    ]);
    expect(parsed?.hasRsvpSection).toBe(true);
    expect(JSON.stringify(parsed)).not.toMatch(/privatePhone|privateHouseholdName|allowanceType/);
  });

  it("does not render unused allowances as named Guests and deduplicates the same Guest", () => {
    const source = guide();
    source.sections[0].data.push(guest(juan, "Juan Santos", "ATTENDING", {
      mealChoice: "Fish", dietaryNotes: "No peanuts", responseNotes: "Thank you",
    }));
    expect(parseGuestRsvpProjection(source, "juan-maria")?.guests).toHaveLength(3);
  });

  it("fails closed for a foreign slug or conflicting duplicate Guest projection", () => {
    expect(parseGuestRsvpProjection(guide(), "other-wedding")).toBeNull();
    const source = guide();
    source.sections[0].data.push(guest(juan, "Juan Santos", "DECLINED"));
    expect(parseGuestRsvpProjection(source, "juan-maria")).toBeNull();
  });

  it("derives Household progress from individual responses and offers no NO_RESPONSE choice", () => {
    const parsed = parseGuestRsvpProjection(guide(), "juan-maria");
    expect(countResponded(parsed?.guests ?? [])).toBe(2);
    expect(GUEST_RSVP_CHOICES).toEqual(["ATTENDING", "DECLINED"]);
    expect(GUEST_RSVP_CHOICES).not.toContain("NO_RESPONSE");
  });

  it("requires a valid invitation token before requesting the RSVP projection", async () => {
    const fetcher = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return Response.json(guide());
    });
    expect(isHouseholdInvitationToken(token)).toBe(true);
    expect(isHouseholdInvitationToken("malformed")).toBe(false);
    await expect(loadGuestRsvpForm("juan-maria", null, { fetcher })).resolves.toEqual({ status: "invalid-invitation" });
    await expect(loadGuestRsvpForm("juan-maria", "malformed", { fetcher })).resolves.toEqual({ status: "invalid-invitation" });
    expect(fetcher).not.toHaveBeenCalled();

  });

  it("uses the no-store Guest Guide endpoint and never logs or persists the Household token", async () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return Response.json(guide());
    });
    const result = await loadGuestRsvpForm("juan-maria", token, {
      fetcher,
      supabaseUrl: "https://project.test",
      publishableKey: "publishable-test-key",
    });
    expect(result.status).toBe("ready");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1]?.cache).toBe("no-store");
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ slug: "juan-maria", invitationToken: token });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("treats expired, revoked, and foreign-Household token responses as invalid invitation access", async () => {
    const denied = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return Response.json({ error: `private detail ${token}` }, { status: 403 });
    });
    const result = await loadGuestRsvpForm("juan-maria", token, {
      fetcher: denied,
      supabaseUrl: "https://project.test",
      publishableKey: "publishable-test-key",
    });
    expect(result).toEqual({ status: "invalid-invitation" });
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("keeps private fields out of the confirmation summary", async () => {
    const result = await loadGuestRsvpSummary("juan-maria", token, {
      fetcher: vi.fn(async () => Response.json(guide())),
      supabaseUrl: "https://project.test",
      publishableKey: "publishable-test-key",
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.summary.guests).toHaveLength(3);
    expect(JSON.stringify(result.summary)).not.toMatch(/dietaryNotes|responseNotes|No peanuts|Thank you/);
  });

  it("keeps the token only on the intended Wedding guest routes", () => {
    expect(guestRouteHref("juan-maria", "", token)).toBe(`/w/juan-maria?token=${token}`);
    expect(guestRouteHref("juan-maria", "/invitation", token)).toBe(`/w/juan-maria/invitation?token=${token}`);
    expect(guestRouteHref("juan-maria", "/rsvp", token)).toBe(`/w/juan-maria/rsvp?token=${token}`);
    expect(guestRouteHref("juan-maria", "/rsvp/confirmation", token)).toBe(`/w/juan-maria/rsvp/confirmation?token=${token}`);
    expect(guestRouteHref("juan-maria", "/pass", token)).toBe(`/w/juan-maria/pass?token=${token}`);
    expect(guestRouteHref("juan-maria", "/rsvp", null)).toBe("/w/juan-maria/rsvp");
  });

  it("blocks a repeated in-flight submission for the same individual Guest", () => {
    const inFlight = new Set<string>();
    expect(tryBeginGuestRsvpSubmit(inFlight, juan)).toBe(true);
    expect(tryBeginGuestRsvpSubmit(inFlight, juan)).toBe(false);
    expect(tryBeginGuestRsvpSubmit(inFlight, maria)).toBe(true);
    inFlight.delete(juan);
    expect(tryBeginGuestRsvpSubmit(inFlight, juan)).toBe(true);
  });
});
