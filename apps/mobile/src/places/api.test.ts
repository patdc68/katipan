import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership, WorkspaceRole } from "../workspace/model";
import type { WeddingPlace, WeddingPlacePurpose } from "./model";
import {
  archivePlace,
  createCustomPlace,
  loadPlaceDetails,
  loadPlaces,
  removePlacePurpose,
  saveGooglePlace,
  savePlacePurpose,
  searchGooglePlaces,
  updatePlaceContext,
} from "./api";
import { emptyCustomPlaceDraft, placePurposes } from "./model";

type QueryRecord = {
  table: string;
  columns: string;
  filters: { operator: "eq" | "is"; column: string; value: unknown }[];
  orders: string[];
};
type DbError = { code: string; message?: string };
type DbResult = { data: unknown; error: DbError | null };

const stubs = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
  records: [] as QueryRecord[],
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  invokeCalls: [] as { name: string; body: unknown }[],
  rows: { wedding_places: [] as unknown[], wedding_place_purposes: [] as unknown[] },
  rpcResponse: { data: "place-id", error: null as DbError | null },
  invokeResolver: null as ((name: string, body: unknown) => { data: unknown; error: DbError | null }) | null,
  rpcResolver: null as ((name: string, args: Record<string, unknown>) => { data: unknown; error: DbError | null }) | null,
}));

vi.mock("../auth/client", () => ({
  supabase: {
    from: stubs.from,
    rpc: stubs.rpc,
    functions: { invoke: stubs.invoke },
  },
}));

const weddingId = "11111111-1111-4111-8111-111111111111";
const foreignWeddingId = "22222222-2222-4222-8222-222222222222";
const placeId = "33333333-3333-4333-8333-333333333333";
const googleId = "google-place-123";

function membership(role: WorkspaceRole = "OWNER", id = weddingId): WorkspaceMembership {
  const coordinated = role === "FULL_COORDINATOR";
  return {
    membershipId: `member-${role}`,
    weddingId: id,
    userId: "user-a",
    role,
    status: "ACTIVE",
    partnerNames: ["Juan", "Maria"],
    wedding: {
      id,
      display_name: "Juan & Maria",
      wedding_date: null,
      general_location: "Manila",
      status: "ACTIVE",
      origin: coordinated ? "COORDINATOR_CREATED" : "COUPLE_CREATED",
      ownership_mode: coordinated ? "COORDINATOR_MANAGED" : "COUPLE_OWNED",
    },
  };
}

function weddingPlace(overrides: Partial<WeddingPlace> = {}): WeddingPlace {
  return {
    id: placeId,
    wedding_id: weddingId,
    source: "CUSTOM",
    place_type: "OTHER",
    google_place_id: null,
    google_place_id_refreshed_at: null,
    custom_name: "Family garden",
    custom_address: "Manila",
    custom_latitude: null,
    custom_longitude: null,
    user_label: null,
    private_notes: null,
    guest_notes: null,
    archived_at: null,
    created_by_user_id: "user-a",
    created_at: "2026-09-28T00:00:00.000Z",
    updated_at: "2026-09-28T00:00:00.000Z",
    ...overrides,
  };
}

function purposeRow(purpose: WeddingPlacePurpose["purpose"], overrides: Partial<WeddingPlacePurpose> = {}): WeddingPlacePurpose {
  return {
    id: `purpose-${purpose}`,
    wedding_id: weddingId,
    place_id: placeId,
    purpose,
    sort_order: 0,
    guest_visible: false,
    purpose_label: null,
    private_notes: null,
    guest_notes: null,
    created_at: "2026-09-28T00:00:00.000Z",
    updated_at: "2026-09-28T00:00:00.000Z",
    ...overrides,
  };
}

function googleDto(id = googleId) {
  return {
    placeId: id,
    displayName: "St. Andrew's Garden",
    formattedAddress: "Manila, Metro Manila",
    latitude: 14.6,
    longitude: 120.98,
    primaryType: "wedding_venue",
    googleMapsUri: "https://maps.google.com/?q=14.6,120.98",
  };
}

function matches(record: QueryRecord, row: Record<string, unknown>): boolean {
  return record.filters.every((filter) => filter.operator === "eq"
    ? row[filter.column] === filter.value
    : row[filter.column] === filter.value);
}

function responseFor(record: QueryRecord, single = false): DbResult {
  const rows = stubs.rows[record.table as keyof typeof stubs.rows] ?? [];
  const found = rows.filter((row) => matches(record, row as Record<string, unknown>));
  return { data: single ? found[0] ?? null : found, error: null };
}

function setupQueries() {
  stubs.records.splice(0);
  stubs.rpcCalls.splice(0);
  stubs.invokeCalls.splice(0);
  stubs.rows.wedding_places = [];
  stubs.rows.wedding_place_purposes = [];
  stubs.rpcResponse = { data: placeId, error: null };
  stubs.invokeResolver = null;
  stubs.rpcResolver = null;
  stubs.from.mockReset();
  stubs.rpc.mockReset();
  stubs.invoke.mockReset();
  stubs.rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
    stubs.rpcCalls.push({ name, args });
    return Promise.resolve(stubs.rpcResolver?.(name, args) ?? stubs.rpcResponse);
  });
  stubs.invoke.mockImplementation((name: string, options: { body: unknown }) => {
    stubs.invokeCalls.push({ name, body: options.body });
    return Promise.resolve(stubs.invokeResolver?.(name, options.body) ?? { data: { places: [] }, error: null });
  });
  stubs.from.mockImplementation((table: string) => {
    const record: QueryRecord = { table, columns: "", filters: [], orders: [] };
    stubs.records.push(record);
    const query = {
      select(columns: string) { record.columns = columns; return query; },
      eq(column: string, value: unknown) { record.filters.push({ operator: "eq", column, value }); return query; },
      is(column: string, value: unknown) { record.filters.push({ operator: "is", column, value }); return query; },
      order(column: string) { record.orders.push(column); return query; },
      maybeSingle() { return Promise.resolve(responseFor(record, true)); },
      then(onFulfilled: (value: DbResult) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(responseFor(record)).then(onFulfilled, onRejected);
      },
    };
    return query;
  });
}

beforeEach(setupQueries);

describe("Places read and Google transport", () => {
  it("allows Owner and Full Coordinator management while Day-of and Guest Coordinators stay read-only", async () => {
    stubs.rows.wedding_places = [weddingPlace()];
    for (const manager of [membership("OWNER"), membership("FULL_COORDINATOR")]) {
      await savePlacePurpose(manager, placeId, "CEREMONY", {
        sortOrder: 0, guestVisible: false, purposeLabel: "", privateNotes: "", guestNotes: "",
      });
      stubs.rpcCalls.splice(0);
      stubs.records.splice(0);
    }
    for (const role of ["DAY_OF_COORDINATOR", "GUEST_COORDINATOR"] as const) {
      await expect(savePlacePurpose(membership(role), placeId, "CEREMONY", {
        sortOrder: 0, guestVisible: false, purposeLabel: "", privateNotes: "", guestNotes: "",
      })).rejects.toMatchObject({ code: "42501" });
    }
    expect(stubs.rpcCalls).toHaveLength(0);
    expect(stubs.records).toHaveLength(0);
  });

  it("enforces the search minimum and sends Google search only through its Edge Function", async () => {
    stubs.invokeResolver = (name) => ({ data: name === "google-places-search" ? { places: [googleDto()] } : {}, error: null });
    await expect(searchGooglePlaces(membership(), " x ")).rejects.toMatchObject({ code: "PLACE_QUERY" });
    expect(stubs.invokeCalls).toHaveLength(0);
    const results = await searchGooglePlaces(membership("FULL_COORDINATOR"), "  St. Andrew  ");
    expect(results[0]?.displayName).toBe("St. Andrew's Garden");
    expect(stubs.invokeCalls).toEqual([{
      name: "google-places-search",
      body: { weddingId, query: "St. Andrew" },
    }]);
  });

  it("hydrates current Google details for a saved Place and records manager refresh", async () => {
    stubs.rows.wedding_places = [weddingPlace({
      source: "GOOGLE_PLACES", google_place_id: googleId, custom_name: null, custom_address: null,
    })];
    stubs.rows.wedding_place_purposes = [purposeRow("CEREMONY", { guest_visible: true, guest_notes: "Use gate A" })];
    stubs.invokeResolver = () => ({ data: googleDto(), error: null });
    const details = await loadPlaceDetails(membership(), placeId);
    expect(details.google?.displayName).toBe("St. Andrew's Garden");
    expect(details.google?.formattedAddress).toBe("Manila, Metro Manila");
    expect(details.purposes[0]?.guest_visible).toBe(true);
    expect(details.purposes[0]?.guest_notes).toBe("Use gate A");
    expect(stubs.invokeCalls).toEqual([{
      name: "google-place-details",
      body: { weddingId, placeId: googleId },
    }]);
    expect(stubs.rpcCalls).toEqual([{ name: "mark_google_wedding_place_refreshed", args: { p_place_id: placeId } }]);
  });

  it("does not require a manager refresh mutation for read-only Google details", async () => {
    stubs.rows.wedding_places = [weddingPlace({ source: "GOOGLE_PLACES", google_place_id: googleId, custom_name: null, custom_address: null })];
    stubs.invokeResolver = () => ({ data: googleDto(), error: null });
    await loadPlaceDetails(membership("DAY_OF_COORDINATOR"), placeId);
    expect(stubs.invokeCalls[0]?.name).toBe("google-place-details");
    expect(stubs.rpcCalls).toHaveLength(0);
  });

  it("excludes archived and cross-Wedding rows and hydrates only active Google Places", async () => {
    const activeGoogle = weddingPlace({ source: "GOOGLE_PLACES", google_place_id: googleId, custom_name: null, custom_address: null });
    const archived = weddingPlace({ id: "archived", archived_at: "2026-09-28T01:00:00Z" });
    const foreign = weddingPlace({ id: "foreign", wedding_id: foreignWeddingId });
    stubs.rows.wedding_places = [activeGoogle, archived, foreign];
    stubs.rows.wedding_place_purposes = [
      purposeRow("CEREMONY", { guest_visible: true }),
      purposeRow("RECEPTION", { id: "hidden-purpose", guest_visible: false }),
      purposeRow("OTHER", { id: "foreign-purpose", wedding_id: foreignWeddingId }),
    ];
    stubs.invokeResolver = () => ({ data: googleDto(), error: null });
    const results = await loadPlaces(membership());
    expect(results.map((item) => item.place.id)).toEqual([placeId]);
    expect(results[0]?.purposes.map((item) => item.guest_visible)).toEqual([true, false]);
    expect(results[0]?.google?.displayName).toBe("St. Andrew's Garden");
    const placeQuery = stubs.records.find((record) => record.table === "wedding_places");
    expect(placeQuery?.filters).toContainEqual({ operator: "eq", column: "wedding_id", value: weddingId });
    expect(placeQuery?.filters).toContainEqual({ operator: "is", column: "archived_at", value: null });
    expect(stubs.invokeCalls).toHaveLength(1);
  });
});

describe("Google and Custom Place mutations", () => {
  it("opens an active duplicate Google Place without creating another row", async () => {
    stubs.rows.wedding_places = [weddingPlace({ source: "GOOGLE_PLACES", google_place_id: googleId, custom_name: null, custom_address: null })];
    await expect(saveGooglePlace(membership(), googleId)).resolves.toEqual({ placeId, alreadySaved: true });
    expect(stubs.rpcCalls).toHaveLength(0);
    expect(stubs.records[0]?.filters).toContainEqual({ operator: "eq", column: "wedding_id", value: weddingId });
  });

  it("saves a Google Place ID through the canonical RPC and leaves custom fields absent", async () => {
    stubs.rpcResponse = { data: "new-google-place", error: null };
    await expect(saveGooglePlace(membership("FULL_COORDINATOR"), googleId)).resolves.toEqual({ placeId: "new-google-place", alreadySaved: false });
    expect(stubs.rpcCalls).toEqual([{
      name: "create_google_wedding_place",
      args: {
        p_wedding_id: weddingId,
        p_google_place_id: googleId,
        p_place_type: "OTHER",
        p_user_label: null,
        p_private_notes: null,
        p_guest_notes: null,
      },
    }]);
  });

  it("recovers an active duplicate when concurrent Google saves hit the unique constraint", async () => {
    stubs.rpcResolver = () => {
      stubs.rows.wedding_places = [weddingPlace({ source: "GOOGLE_PLACES", google_place_id: googleId, custom_name: null, custom_address: null })];
      return { data: null, error: { code: "23505" } };
    };
    await expect(saveGooglePlace(membership(), googleId)).resolves.toEqual({ placeId, alreadySaved: true });
    expect(stubs.rpcCalls).toHaveLength(1);
  });

  it("creates and edits Custom Places with validated optional coordinates", async () => {
    stubs.rpcResponse = { data: "custom-new", error: null };
    const draft = { ...emptyCustomPlaceDraft, customName: "Casa Juan", customAddress: "Makati", latitude: "14.55", longitude: "121.02", placeType: "HOME" as const };
    await expect(createCustomPlace(membership(), draft)).resolves.toBe("custom-new");
    expect(stubs.rpcCalls[0]?.name).toBe("create_custom_wedding_place");
    expect(stubs.rpcCalls[0]?.args).toMatchObject({
      p_wedding_id: weddingId,
      p_custom_name: "Casa Juan",
      p_custom_address: "Makati",
      p_custom_latitude: 14.55,
      p_custom_longitude: 121.02,
      p_place_type: "HOME",
    });
    stubs.rows.wedding_places = [weddingPlace()];
    await updatePlaceContext(membership(), placeId, { ...draft, userLabel: "Family home", privateNotes: "Private", guestNotes: "Entrance B" });
    expect(stubs.rpcCalls[1]?.name).toBe("update_wedding_place_context");
    expect(stubs.rpcCalls[1]?.args).toMatchObject({
      p_place_id: placeId,
      p_custom_name: "Casa Juan",
      p_custom_latitude: 14.55,
      p_user_label: "Family home",
      p_private_notes: "Private",
      p_guest_notes: "Entrance B",
    });
  });

  it("rejects invalid coordinates and cross-Wedding Place IDs before mutation", async () => {
    await expect(createCustomPlace(membership(), { ...emptyCustomPlaceDraft, customName: "Home", latitude: "14.5" }))
      .rejects.toThrow("Enter both coordinates or leave both blank.");
    stubs.rows.wedding_places = [weddingPlace({ wedding_id: foreignWeddingId })];
    await expect(updatePlaceContext(membership(), placeId, { ...emptyCustomPlaceDraft, customName: "Updated" }))
      .rejects.toMatchObject({ code: "22023" });
    expect(stubs.rpcCalls).toHaveLength(0);
  });

  it("never writes Google name, address, or coordinates into custom fields during context edits", async () => {
    stubs.rows.wedding_places = [weddingPlace({
      source: "GOOGLE_PLACES", google_place_id: googleId, custom_name: null, custom_address: null,
    })];
    await updatePlaceContext(membership(), placeId, {
      source: "CUSTOM", customName: "Google display name", customAddress: "Google address",
      latitude: "14.5", longitude: "120.9", placeType: "CHURCH_RELIGIOUS", userLabel: "Ceremony",
      privateNotes: "Private", guestNotes: "Guest",
    });
    expect(stubs.rpcCalls[0]?.name).toBe("update_wedding_place_context");
    expect(stubs.rpcCalls[0]?.args).toMatchObject({
      p_custom_name: null,
      p_custom_address: null,
      p_custom_latitude: null,
      p_custom_longitude: null,
      p_place_type: "CHURCH_RELIGIOUS",
      p_user_label: "Ceremony",
    });
  });
});

describe("Purpose, visibility, and archive mutations", () => {
  it("adds or updates every purpose independently and removes through the existing RPC", async () => {
    stubs.rows.wedding_places = [weddingPlace()];
    for (const [index, purpose] of placePurposes.entries()) {
      await savePlacePurpose(membership(), placeId, purpose, {
        sortOrder: index,
        guestVisible: purpose === "RECEPTION",
        purposeLabel: purpose === "RECEPTION" ? "Garden reception" : "",
        privateNotes: `Private ${purpose}`,
        guestNotes: `Guest ${purpose}`,
      });
      await removePlacePurpose(membership(), placeId, purpose);
    }
    const setCalls = stubs.rpcCalls.filter((call) => call.name === "set_wedding_place_purpose");
    const removeCalls = stubs.rpcCalls.filter((call) => call.name === "remove_wedding_place_purpose");
    expect(setCalls.map((call) => call.args.p_purpose)).toEqual(placePurposes);
    expect(setCalls.map((call) => call.args.p_sort_order)).toEqual(placePurposes.map((_, index) => index));
    expect(setCalls.map((call) => call.args.p_guest_visible)).toEqual(placePurposes.map((purpose) => purpose === "RECEPTION"));
    expect(setCalls[1]?.args.p_purpose_label).toBe("Garden reception");
    expect(setCalls[1]?.args.p_private_notes).toBe("Private RECEPTION");
    expect(setCalls[1]?.args.p_guest_notes).toBe("Guest RECEPTION");
    expect(removeCalls.map((call) => call.args.p_purpose)).toEqual(placePurposes);
  });

  it("archives a Place with the soft archive RPC and rejects inactive or foreign IDs", async () => {
    stubs.rows.wedding_places = [weddingPlace()];
    await archivePlace(membership("FULL_COORDINATOR"), placeId);
    expect(stubs.rpcCalls).toEqual([{ name: "archive_wedding_place", args: { p_place_id: placeId } }]);
    stubs.rpcCalls.splice(0);
    stubs.rows.wedding_places = [weddingPlace({ archived_at: "2026-09-28T01:00:00Z" })];
    await expect(archivePlace(membership(), placeId)).rejects.toMatchObject({ code: "22023" });
    await expect(archivePlace(membership("OWNER", foreignWeddingId), placeId)).rejects.toMatchObject({ code: "22023" });
    expect(stubs.rpcCalls).toHaveLength(0);
  });

  it("rejects purpose changes on an archived Place before calling the purpose RPC", async () => {
    stubs.rows.wedding_places = [weddingPlace({ archived_at: "2026-09-28T01:00:00Z" })];
    await expect(savePlacePurpose(membership(), placeId, "RECEPTION", {
      sortOrder: 1, guestVisible: true, purposeLabel: "", privateNotes: "", guestNotes: "",
    })).rejects.toMatchObject({ code: "22023" });
    expect(stubs.rpcCalls).toHaveLength(0);
  });
});
