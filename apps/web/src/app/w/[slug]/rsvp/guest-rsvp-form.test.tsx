import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { GuestRsvpGuest } from "../../../../lib/guest-rsvp";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import GuestRsvpForm from "./guest-rsvp-form";

const token = "d".repeat(64);
const guests: GuestRsvpGuest[] = [
  {
    guestId: "30000000-0000-4000-8000-000000000001",
    name: "Juan Santos",
    status: "ATTENDING",
    mealChoice: "Fish",
    dietaryNotes: "No peanuts",
    responseNotes: "Thank you",
  },
  {
    guestId: "30000000-0000-4000-8000-000000000002",
    name: "Maria Santos",
    status: "DECLINED",
    mealChoice: null,
    dietaryNotes: null,
    responseNotes: null,
  },
  {
    guestId: "30000000-0000-4000-8000-000000000003",
    name: "Lia Santos",
    status: "NO_RESPONSE",
    mealChoice: null,
    dietaryNotes: null,
    responseNotes: null,
  },
];

describe("individual Guest RSVP form", () => {
  it("renders separate accessible choices and fields for each real Guest", () => {
    const html = renderToStaticMarkup(createElement(GuestRsvpForm, { slug: "juan-maria", token, guests }));
    expect(html).toContain("2 of 3 responded");
    expect(html).toContain("Juan Santos");
    expect(html).toContain("Maria Santos");
    expect(html).toContain("Lia Santos");
    expect((html.match(/type="radio"/g) ?? []).length).toBe(6);
    expect((html.match(/value="ATTENDING"/g) ?? []).length).toBe(3);
    expect((html.match(/value="DECLINED"/g) ?? []).length).toBe(3);
    expect(html).not.toContain("value=\"NO_RESPONSE\"");
    expect(html).toContain("Choose a response for Juan Santos");
    expect(html).toContain("Meal choice");
    expect(html).toContain("Dietary notes");
    expect(html).toContain("A note for the couple");
    expect(html).toContain("No peanuts");
    expect(html).toContain("Thank you");
    expect(html.match(new RegExp(token, "g")) ?? []).toHaveLength(1);
    expect(html).toContain(`/w/juan-maria/rsvp/confirmation?token=${token}`);
  });

  it("does not show private response fields on a Declined Guest card", () => {
    const source = [{
      ...guests[1]!,
      mealChoice: "Previously selected meal",
      dietaryNotes: "Private dietary information",
      responseNotes: "Private response note",
    }];
    const html = renderToStaticMarkup(createElement(GuestRsvpForm, { slug: "juan-maria", token, guests: source }));
    expect(html).not.toContain("Previously selected meal");
    expect(html).not.toContain("Private dietary information");
    expect(html).not.toContain("Private response note");
  });
});
