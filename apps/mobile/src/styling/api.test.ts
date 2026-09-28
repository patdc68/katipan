import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import { saveStylingColor, setAttireGroupGuestTarget } from "./api";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    rpc: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

vi.mock("../auth/client", () => ({ supabase: supabaseMock }));
vi.mock("expo-file-system", () => ({ File: vi.fn() }));

type MockRow = Record<string, unknown> | null;
type QueryBuilder = {
  select: (...args: string[]) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, options?: unknown) => QueryBuilder;
  limit: (value: number) => QueryBuilder;
  maybeSingle: () => Promise<{ data: MockRow; error: null }>;
  upsert: (row: Record<string, unknown>, options?: Record<string, unknown>) => Promise<{ error: null }>;
  insert: (row: Record<string, unknown>) => QueryBuilder;
  update: (row: Record<string, unknown>) => QueryBuilder;
  delete: () => QueryBuilder;
};

const weddingId = "10000000-0000-4000-8000-000000000001";
const dressCodeId = "20000000-0000-4000-8000-000000000001";
const guestId = "30000000-0000-4000-8000-000000000001";
const groupOne = "40000000-0000-4000-8000-000000000001";
const groupTwo = "40000000-0000-4000-8000-000000000002";

function membership(role: WorkspaceMembership["role"]): WorkspaceMembership {
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
  };
}

function makeQuery(table: string, callNumber: number, options: { foreignGuest?: boolean } = {}) {
  const filters = new Map<string, unknown>();
  const writes: { method: string; row?: Record<string, unknown>; options?: Record<string, unknown> }[] = [];
  const builder = {} as QueryBuilder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((column: string, value: unknown) => { filters.set(column, value); return builder; });
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.insert = vi.fn((row: Record<string, unknown>) => { writes.push({ method: "insert", row }); return builder; });
  builder.update = vi.fn((row: Record<string, unknown>) => { writes.push({ method: "update", row }); return builder; });
  builder.delete = vi.fn(() => { writes.push({ method: "delete" }); return builder; });
  builder.upsert = vi.fn(async (row: Record<string, unknown>, upsertOptions?: Record<string, unknown>) => {
    writes.push({ method: "upsert", row, options: upsertOptions });
    return { error: null };
  });
  builder.maybeSingle = vi.fn(async () => {
    if (table === "attire_groups") return { data: { id: filters.get("id"), wedding_id: weddingId, dress_code_id: filters.get("dress_code_id") } as MockRow, error: null };
    if (table === "guests") return { data: options.foreignGuest ? { id: guestId, wedding_id: "another-wedding" } : { id: guestId, wedding_id: weddingId } as MockRow, error: null };
    if (table === "motif_colors" && callNumber === 1) return { data: { sort_order: 2 }, error: null };
    if (table === "motif_colors") return { data: { id: "motif-color", wedding_id: weddingId }, error: null };
    return { data: null, error: null };
  });
  return { builder, filters, writes };
}

describe("styling direct RLS writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks Day-of and Guest Coordinators before sending a write", async () => {
    const { saveWeddingMotif } = await import("./api");
    for (const role of ["DAY_OF_COORDINATOR", "GUEST_COORDINATOR"] as const) {
      await expect(saveWeddingMotif(membership(role), { title: "Garden", description: "", notes: "" }))
        .rejects.toMatchObject({ code: "42501" });
    }
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("adds a Guest to the selected group without replacing other group assignments", async () => {
    const queries: { table: string; builder: QueryBuilder; filters: Map<string, unknown>; writes: { method: string; row?: Record<string, unknown>; options?: Record<string, unknown> }[] }[] = [];
    supabaseMock.from.mockImplementation((table: string) => {
      const query = makeQuery(table, queries.filter((item) => item.table === table).length + 1);
      queries.push({ table, ...query });
      return query.builder;
    });

    await setAttireGroupGuestTarget(membership("OWNER"), dressCodeId, groupOne, guestId, true);
    await setAttireGroupGuestTarget(membership("FULL_COORDINATOR"), dressCodeId, groupTwo, guestId, true);

    const writes = queries.filter((item) => item.table === "attire_group_guest_targets").flatMap((item) => item.writes);
    expect(writes).toEqual([
      { method: "upsert", row: { wedding_id: weddingId, attire_group_id: groupOne, guest_id: guestId }, options: { onConflict: "wedding_id,attire_group_id,guest_id", ignoreDuplicates: true } },
      { method: "upsert", row: { wedding_id: weddingId, attire_group_id: groupTwo, guest_id: guestId }, options: { onConflict: "wedding_id,attire_group_id,guest_id", ignoreDuplicates: true } },
    ]);
    expect(queries.some((item) => item.writes.some((write) => write.method === "delete"))).toBe(false);
  });

  it("rejects a Guest outside the selected Wedding before inserting a target", async () => {
    const queries: { table: string; builder: QueryBuilder; filters: Map<string, unknown>; writes: { method: string; row?: Record<string, unknown>; options?: Record<string, unknown> }[] }[] = [];
    supabaseMock.from.mockImplementation((table: string) => {
      const query = makeQuery(table, queries.filter((item) => item.table === table).length + 1, { foreignGuest: true });
      queries.push({ table, ...query });
      return query.builder;
    });

    await expect(setAttireGroupGuestTarget(membership("OWNER"), dressCodeId, groupOne, guestId, true))
      .rejects.toThrow("This Guest is unavailable in the selected Wedding.");
    expect(queries.some((item) => item.table === "attire_group_guest_targets")).toBe(false);
  });

  it("normalizes motif colors and writes only to the Motif palette table", async () => {
    const queries: { table: string; builder: QueryBuilder; filters: Map<string, unknown>; writes: { method: string; row?: Record<string, unknown> }[] }[] = [];
    supabaseMock.from.mockImplementation((table: string) => {
      const query = makeQuery(table, queries.filter((item) => item.table === table).length + 1);
      queries.push({ table, ...query });
      return query.builder;
    });

    await saveStylingColor(membership("OWNER"), { kind: "motif", parentId: "motif-a" }, { colorHex: "60725a", name: " Sage " });

    const insert = queries.filter((item) => item.table === "motif_colors").flatMap((item) => item.writes).find((write) => write.method === "insert");
    expect(insert?.row).toMatchObject({
      wedding_id: weddingId,
      motif_id: "motif-a",
      color_hex: "#60725A",
      name: "Sage",
      sort_order: 3,
    });
    expect(queries.some((item) => item.table === "dress_code_recommended_colors")).toBe(false);
  });
});
