import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership, WorkspaceRole } from "../workspace/model";
import type { WeddingPlacePurpose } from "./model";
import {
  canManagePlaces,
  canViewPlaces,
  contextRpcFields,
  emptyCustomPlaceDraft,
  normalizedPlaceQuery,
  placeContextDraftSchema,
  placePurposes,
  placePurposeDraftSchema,
  placeTypes,
  placesRequestKey,
  purposeVisibilitySummary,
  safePlaceError,
  schedulePlaceSearch,
  PlaceSubmitGate,
} from "./model";

const weddingId = "wedding-a";
const customDraft = { ...emptyCustomPlaceDraft, customName: "Family garden" };

function membership(role: WorkspaceRole = "OWNER", options: { status?: WorkspaceMembership["status"]; weddingMismatch?: boolean } = {}): WorkspaceMembership {
  const coordinated = role === "FULL_COORDINATOR";
  const otherWeddingId = options.weddingMismatch ? "wedding-b" : weddingId;
  return {
    membershipId: `member-${role}`,
    weddingId,
    userId: "user-a",
    role,
    status: options.status ?? "ACTIVE",
    partnerNames: ["Juan", "Maria"],
    wedding: {
      id: otherWeddingId,
      display_name: "Juan & Maria",
      wedding_date: null,
      general_location: "Manila",
      status: "ACTIVE",
      origin: coordinated ? "COORDINATOR_CREATED" : "COUPLE_CREATED",
      ownership_mode: coordinated ? "COORDINATOR_MANAGED" : "COUPLE_OWNED",
    },
  };
}

describe("Places roles and Wedding isolation", () => {
  it("allows Owners, Full Coordinators, and the valid coordinator-managed controller role to manage", () => {
    expect(canManagePlaces(membership("OWNER"))).toBe(true);
    expect(canManagePlaces(membership("FULL_COORDINATOR"))).toBe(true);
  });

  it("keeps Day-of and Guest Coordinators read-only", () => {
    for (const role of ["DAY_OF_COORDINATOR", "GUEST_COORDINATOR"] as const) {
      expect(canViewPlaces(membership(role))).toBe(true);
      expect(canManagePlaces(membership(role))).toBe(false);
    }
  });

  it("rejects left memberships and a mismatch between the membership and Wedding", () => {
    expect(canViewPlaces(membership("OWNER", { status: "LEFT" }))).toBe(false);
    expect(canManagePlaces(membership("FULL_COORDINATOR", { weddingMismatch: true }))).toBe(false);
  });

  it("keys resource state by Wedding, membership, and workspace cache revision", () => {
    const original = placesRequestKey("wedding-a", "member-a", 4, 0);
    expect(placesRequestKey("wedding-b", "member-b", 5, 0)).not.toBe(original);
    expect(placesRequestKey("wedding-a", "member-a", 4, 1)).not.toBe(original);
  });
});

describe("Place types, purposes, and coordinate validation", () => {
  it("uses every locked Place type and Purpose exactly once", () => {
    expect(placeTypes).toEqual([
      "CHURCH_RELIGIOUS", "GARDEN", "BEACH", "RESORT", "HOTEL", "EVENT_SPACE",
      "RESTAURANT", "PRIVATE_ESTATE", "HOME", "CIVIL_VENUE", "DESTINATION", "OTHER",
    ]);
    expect(placePurposes).toEqual([
      "CEREMONY", "RECEPTION", "ACCOMMODATION", "PRENUP", "GETTING_READY", "REHEARSAL", "AFTER_PARTY", "TRANSPORT", "OTHER",
    ]);
  });

  it("accepts required Custom Place names and paired coordinates at the valid bounds", () => {
    for (const type of placeTypes) {
      expect(placeContextDraftSchema.safeParse({ ...customDraft, placeType: type }).success).toBe(true);
    }
    expect(placeContextDraftSchema.safeParse({ ...customDraft, latitude: "-90", longitude: "180" }).success).toBe(true);
    expect(placeContextDraftSchema.safeParse({ ...customDraft, latitude: "", longitude: "" }).success).toBe(true);
  });

  it("rejects missing names, incomplete coordinate pairs, invalid numbers, and out-of-range coordinates", () => {
    expect(placeContextDraftSchema.safeParse({ ...customDraft, customName: " " }).success).toBe(false);
    expect(placeContextDraftSchema.safeParse({ ...customDraft, latitude: "14.5" }).success).toBe(false);
    expect(placeContextDraftSchema.safeParse({ ...customDraft, latitude: "north", longitude: "120" }).success).toBe(false);
    expect(placeContextDraftSchema.safeParse({ ...customDraft, latitude: "90.01", longitude: "120" }).success).toBe(false);
    expect(placeContextDraftSchema.safeParse({ ...customDraft, latitude: "14", longitude: "180.01" }).success).toBe(false);
  });

  it("validates all purposes with a nonnegative order and independent visibility", () => {
    for (const purpose of placePurposes) {
      expect(placePurposeDraftSchema.safeParse({
        sortOrder: 2, guestVisible: purpose === "RECEPTION", purposeLabel: "", privateNotes: "Team", guestNotes: "Gate A",
      }).success).toBe(true);
    }
    expect(placePurposeDraftSchema.safeParse({ sortOrder: -1, guestVisible: false, purposeLabel: "", privateNotes: "", guestNotes: "" }).success).toBe(false);
  });

  it("keeps Google display data out of custom fields and preserves separate Wedding notes", () => {
    const fields = contextRpcFields({
      source: "GOOGLE_PLACES", customName: "must not persist", customAddress: "must not persist",
      latitude: "14.5", longitude: "120.9", placeType: "GARDEN", userLabel: "Garden ceremony",
      privateNotes: "Arrive early", guestNotes: "Use the side entrance",
    });
    expect(fields).toEqual({
      p_custom_name: null,
      p_custom_address: null,
      p_custom_latitude: null,
      p_custom_longitude: null,
      p_place_type: "GARDEN",
      p_user_label: "Garden ceremony",
      p_private_notes: "Arrive early",
      p_guest_notes: "Use the side entrance",
    });
    const custom = contextRpcFields({ ...customDraft, customAddress: "Manila", latitude: "14.5", longitude: "120.9" });
    expect(custom.p_custom_name).toBe("Family garden");
    expect(custom.p_custom_address).toBe("Manila");
    expect(custom.p_custom_latitude).toBe(14.5);
    expect(custom.p_custom_longitude).toBe(120.9);
  });

  it("treats each purpose visibility separately and never exposes private notes in summaries", () => {
    const purposes = [
      { id: "one", place_id: "p", wedding_id: "w", purpose: "CEREMONY", sort_order: 0, guest_visible: true,
        purpose_label: null, private_notes: "private", guest_notes: "Gate A", created_at: "", updated_at: "" },
      { id: "two", place_id: "p", wedding_id: "w", purpose: "RECEPTION", sort_order: 1, guest_visible: false,
        purpose_label: null, private_notes: "private", guest_notes: "", created_at: "", updated_at: "" },
    ] satisfies WeddingPlacePurpose[];
    expect(purposeVisibilitySummary(purposes)).toBe("1 purpose eligible for the Guest Guide");
    expect(purposeVisibilitySummary([{ ...purposes[1], guest_visible: false }])).toBe("No purpose is eligible for the Guest Guide");
    expect(purposeVisibilitySummary(purposes)).not.toContain("private");
  });
});

describe("Place search and safe interactions", () => {
  afterEach(() => vi.useRealTimers());

  it("requires two trimmed characters and cancels stale debounced searches", () => {
    vi.useFakeTimers();
    const search = vi.fn();
    expect(normalizedPlaceQuery("  ")).toBeNull();
    expect(normalizedPlaceQuery(" x ")).toBeNull();
    const cancelOld = schedulePlaceSearch("church", search, 350);
    const cancelCurrent = schedulePlaceSearch(" church ", search, 350);
    cancelOld();
    vi.advanceTimersByTime(349);
    expect(search).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith("church");
    cancelCurrent();
  });

  it("blocks duplicate submit calls while one mutation is pending", async () => {
    const gate = new PlaceSubmitGate();
    let release: (() => void) | undefined;
    const operation = vi.fn(() => new Promise<string>((resolve) => { release = () => resolve("saved"); }));
    const first = gate.run(operation);
    const duplicate = await gate.run(operation);
    expect(duplicate).toBeUndefined();
    expect(operation).toHaveBeenCalledTimes(1);
    release?.();
    await expect(first).resolves.toBe("saved");
  });

  it("maps backend failures to safe copy and never echoes raw errors", () => {
    expect(safePlaceError({ code: "42501", message: "secret wedding details" })).toContain("cannot change");
    expect(safePlaceError({ code: "23514", message: "secret" })).toContain("archived");
    expect(safePlaceError({ code: "OTHER", message: "api key value" })).not.toContain("api key value");
  });
});
