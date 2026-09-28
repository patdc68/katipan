import { describe, expect, it, vi } from "vitest";
import { loadGuestGuide, parseGuestGuide } from "./guest-guide";

const token = "a".repeat(64);
const guestA = "10000000-0000-4000-8000-000000000001";
const guestB = "10000000-0000-4000-8000-000000000002";
function guide() {
  return { slug: "juan-maria", title: "Juan & Maria", template: "SAMPAGUITA",
    wedding: { name: "Juan & Maria", date: "2027-02-14", timezone: "Asia/Manila", location: "Manila", partners: ["Juan", "Maria"], privateNotes: "secret" },
    sections: [
      { key: "intro", type: "INTRO", audience: "PUBLIC", content: "Welcome", data: null },
      { key: "places", type: "PLACES", audience: "PUBLIC", content: null, data: [{ name: "Garden", purpose: "CEREMONY", address: "Manila", notes: "Guest entrance", privateNotes: "secret" }] },
      { key: "attire", type: "DRESS_CODE", audience: "PERSONALIZED", content: null, data: {
        title: "Garden formal", description: "Light attire", recommendedColors: [{ hex: "#AABBCC", name: "Sage" }],
        guestGuidance: [{ guestId: guestA, effectiveInstructions: "Wear sage", entourageRoles: [{ name: "Sponsor" }],
          attireGroups: [{ title: "Sponsors" }], effectiveRecommendedColors: [{ hex: "#AABBCC", name: "Sage" }], privateNotes: "secret" }],
      } },
      { key: "rsvp", type: "RSVP", audience: "INVITED", data: [{ name: "Guest A", status: "ATTENDING", dietaryNotes: "private diet", responseNotes: "private response" }] },
      { key: "hidden", type: "CUSTOM", audience: "HIDDEN", content: "secret" },
    ],
    guestProgram: [{ id: "program", title: "Ceremony", description: "Join us", scheduledStart: "2027-02-14T08:00:00Z", scheduledEnd: null, placeName: "Garden", internalDelay: "secret" }],
    seating: [{ guestId: guestA, eventName: "Reception", tableName: "Table 2", seatLabel: "Seat 3", privateNotes: "secret" },
      { guestId: guestB, eventName: "Reception", tableName: "Table 4" }],
    guestPasses: [{ guestId: guestA, name: "Guest A", qrPayload: "b".repeat(64), reference: "K1234-ABCD" }],
    privateFinance: "secret",
  };
}
describe("sanitized Guest Guide render model", () => {
  it("keeps the public guide limited to eligible sections, program and public wedding context", () => {
    const parsed = parseGuestGuide(guide(), false);
    expect(parsed?.sections.map(section => section.key)).toEqual(["intro", "places"]);
    expect(parsed?.sections[1]?.places[0]?.name).toBe("Garden");
    expect(parsed?.program[0]?.title).toBe("Ceremony");
    expect(parsed?.seating).toEqual([]);
    expect(parsed?.hasGuestPass).toBe(false);
    expect(JSON.stringify(parsed)).not.toMatch(/private|qrPayload|dietaryNotes|responseNotes|internalDelay/);
  });
  it("keeps invited Household attire, visible seating and a Pass link flag without raw QR", () => {
    const parsed = parseGuestGuide(guide(), true);
    expect(parsed?.sections.map(section => section.key)).toEqual(["intro", "places", "attire", "rsvp"]);
    expect(parsed?.sections[2]?.dressCode?.guestGuidance[0]).toMatchObject({ instructions: "Wear sage", roles: ["Sponsor"], groups: ["Sponsors"] });
    expect(parsed?.sections[3]?.rsvps).toEqual([{ name: "Guest A", status: "ATTENDING" }]);
    expect(parsed?.seating).toEqual([{ eventName: "Reception", tableName: "Table 2", seatLabel: "Seat 3", guestName: "Guest A" },
      { eventName: "Reception", tableName: "Table 4", seatLabel: null, guestName: null }]);
    expect(parsed?.hasGuestPass).toBe(true);
    expect(JSON.stringify(parsed)).not.toMatch(/private|qrPayload|dietaryNotes|responseNotes|internalDelay/);
  });
  it("rejects malformed guide and unknown template", () => {
    expect(parseGuestGuide({ ...guide(), template: "OTHER" }, true)).toBeNull();
    expect(parseGuestGuide({ ...guide(), sections: null }, true)).toBeNull();
  });
  it("uses the existing no-store Edge Function and maps public/private failures safely", async () => {
    const fetcher = vi.fn(async (...args: Parameters<typeof fetch>) => { void args; return Response.json(guide()); });
    const options = { fetcher, supabaseUrl: "https://project.test/", publishableKey: "publishable-key" };
    expect((await loadGuestGuide("juan-maria", null, options)).status).toBe("ready");
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ slug: "juan-maria" });
    expect((await loadGuestGuide("juan-maria", token, options)).status).toBe("ready");
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({ slug: "juan-maria", invitationToken: token });
    expect(fetcher.mock.calls[1]?.[1]?.cache).toBe("no-store");
    expect(await loadGuestGuide("juan-maria", "invalid", options)).toEqual({ status: "invalid-invitation" });
    expect(await loadGuestGuide("juan-maria", token, { ...options, fetcher: vi.fn(async () => new Response(null, { status: 403 })) })).toEqual({ status: "invalid-invitation" });
    expect(await loadGuestGuide("juan-maria", null, { ...options, fetcher: vi.fn(async () => new Response(null, { status: 404 })) })).toEqual({ status: "unavailable" });
  });
});
