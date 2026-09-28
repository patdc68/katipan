import { describe, expect, it } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import {
  canManageWeddingStyling,
  canReadWeddingStyling,
  colorContradictions,
  guestGuidanceDraftSchema,
  normalizeColorName,
  normalizeHexColor,
  StylingSubmitGate,
  type StylingColor,
} from "./model";

function member(role: WorkspaceMembership["role"], options: Partial<WorkspaceMembership> = {}): WorkspaceMembership {
  const weddingId = options.weddingId ?? "wedding-a";
  return {
    membershipId: "membership-a",
    weddingId,
    userId: "user-a",
    role,
    status: "ACTIVE",
    wedding: {
      id: weddingId,
      display_name: "Juan & Maria",
      wedding_date: null,
      general_location: null,
      status: "ACTIVE",
      origin: "COUPLE_CREATED",
      ownership_mode: "COUPLE_OWNED",
    },
    partnerNames: ["Juan", "Maria"],
    ...options,
  };
}

describe("Wedding styling permissions and color input", () => {
  it("lets Owners and Full Coordinators manage and keeps Day-of and Guest Coordinators read-only", () => {
    expect(canManageWeddingStyling(member("OWNER"))).toBe(true);
    expect(canManageWeddingStyling(member("FULL_COORDINATOR"))).toBe(true);
    expect(canManageWeddingStyling(member("DAY_OF_COORDINATOR"))).toBe(false);
    expect(canManageWeddingStyling(member("GUEST_COORDINATOR"))).toBe(false);
    expect(canReadWeddingStyling(member("DAY_OF_COORDINATOR"))).toBe(true);
    expect(canReadWeddingStyling(member("GUEST_COORDINATOR"))).toBe(true);
  });

  it("keeps the coordinator-managed controller path within the Full Coordinator role", () => {
    const controller = member("FULL_COORDINATOR", {
      wedding: {
        ...member("FULL_COORDINATOR").wedding,
        origin: "COORDINATOR_CREATED",
        ownership_mode: "COORDINATOR_MANAGED",
      },
    });
    expect(canManageWeddingStyling(controller)).toBe(true);
  });

  it("rejects inactive or mismatched membership data", () => {
    expect(canReadWeddingStyling(member("OWNER", { status: "LEFT" }))).toBe(false);
    expect(canManageWeddingStyling(member("OWNER", {
      weddingId: "wedding-b",
      wedding: { ...member("OWNER").wedding, id: "wedding-a" },
    }))).toBe(false);
  });

  it("normalizes six-digit hexadecimal input to uppercase and rejects shorthand", () => {
    expect(normalizeHexColor("60725a")).toBe("#60725A");
    expect(normalizeHexColor("#AabbCC")).toBe("#AABBCC");
    expect(() => normalizeHexColor("#ABC")).toThrow("six hexadecimal digits");
    expect(() => normalizeHexColor("#GGGGGG")).toThrow("six hexadecimal digits");
    expect(normalizeColorName(" Sage ")).toBe("Sage");
    expect(normalizeColorName("   ")).toBeNull();
  });

  it("requires non-empty Guest-specific instructions", () => {
    expect(guestGuidanceDraftSchema.safeParse({ title: "", instructions: "  ", notes: "" }).success).toBe(false);
    expect(guestGuidanceDraftSchema.parse({ title: " Best man ", instructions: "Wear a dark suit.", notes: "" })).toEqual({
      title: "Best man", instructions: "Wear a dark suit.", notes: "",
    });
  });

  it("warns about contradictory colors while keeping the two lists separate", () => {
    const recommended: StylingColor[] = [
      { id: "a", wedding_id: "wedding-a", color_hex: "#60725A", name: "Sage", sort_order: 0 },
    ];
    const avoid: StylingColor[] = [
      { id: "b", wedding_id: "wedding-a", color_hex: "#60725A", name: null, sort_order: 0 },
    ];
    expect(colorContradictions(recommended, avoid)).toEqual(["Sage"]);
    expect(recommended).toHaveLength(1);
    expect(avoid).toHaveLength(1);
  });

  it("prevents duplicate submit while the first action is in flight", async () => {
    const gate = new StylingSubmitGate();
    let finish: (() => void) | undefined;
    let count = 0;
    const first = gate.run(() => new Promise<void>((resolve) => { count += 1; finish = resolve; }));
    const duplicate = await gate.run(async () => { count += 1; });
    expect(duplicate).toBeUndefined();
    expect(count).toBe(1);
    finish?.();
    await first;
  });
});
