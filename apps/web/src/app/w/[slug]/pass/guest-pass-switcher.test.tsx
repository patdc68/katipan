import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GuestPassSwitcher from "./guest-pass-switcher";

const firstQr = "a".repeat(64);
const secondQr = "b".repeat(64);

describe("Guest Pass presentation", () => {
  it("renders one individual QR, keeps the opaque payload out of visible text, and shows visible seating", () => {
    const html = renderToStaticMarkup(createElement(GuestPassSwitcher, {
      weddingName: "Juan & Maria",
      weddingDate: "2027-02-14",
      websiteTitle: "Juan & Maria",
      passes: [
        {
          guestId: "30000000-0000-4000-8000-000000000001",
          name: "Maria Santos",
          reference: "K1234-ABCD",
          qrPayload: firstQr,
          seating: [{ eventName: "Reception", tableName: "Table 3", seatLabel: "Seat 1" }],
        },
        {
          guestId: "30000000-0000-4000-8000-000000000002",
          name: "Luis Santos",
          reference: "K5678-EFAB",
          qrPayload: secondQr,
          seating: [{ eventName: "Reception", tableName: "Table 5", seatLabel: "Seat 2" }],
        },
      ],
    }));
    expect((html.match(/<svg/g) ?? []).length).toBe(1);
    expect(html).toContain("Maria Santos");
    expect(html).toContain("K1234-ABCD");
    expect(html).toContain("Table 3 / Seat 1");
    expect(html).not.toContain("Table 5");
    expect(html).not.toContain(firstQr);
    expect(html).not.toContain(secondQr);
    expect(html).toContain("Luis Santos");
    expect(html).toContain("Choose a Guest Pass");
  });
});
