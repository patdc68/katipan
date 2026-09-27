import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMembership } from "../workspace/model";
import {
  addGuestToGroup,
  assignGuestToEntourageRole,
  claimGuestAllowance,
  createEntourageRole,
  createGuestAllowance,
  createGuestGroup,
  deleteEntourageRole,
  deleteGuestAllowance,
  deleteGuestGroup,
  releaseGuestAllowanceClaim,
  removeGuestFromEntourageRole,
  removeGuestFromGroup,
  updateEntourageRole,
  updateGuestAllowance,
  updateGuestGroup,
} from "./api";
import { safeGuestError, type EntourageRoleDraft, type GuestAllowanceDraft } from "./model";

const ids = {
  wedding: "10000000-0000-4000-8000-000000000001",
  otherWedding: "10000000-0000-4000-8000-000000000002",
  household: "20000000-0000-4000-8000-000000000001",
  otherHousehold: "20000000-0000-4000-8000-000000000002",
  guest: "30000000-0000-4000-8000-000000000001",
  secondGuest: "30000000-0000-4000-8000-000000000002",
  otherHouseholdGuest: "30000000-0000-4000-8000-000000000003",
  foreignGuest: "30000000-0000-4000-8000-000000000004",
  group: "40000000-0000-4000-8000-000000000001",
  secondGroup: "40000000-0000-4000-8000-000000000002",
  foreignGroup: "40000000-0000-4000-8000-000000000003",
  newGroup: "40000000-0000-4000-8000-000000000004",
  role: "50000000-0000-4000-8000-000000000001",
  foreignRole: "50000000-0000-4000-8000-000000000002",
  newRole: "50000000-0000-4000-8000-000000000003",
  allowance: "60000000-0000-4000-8000-000000000001",
  foreignAllowance: "60000000-0000-4000-8000-000000000002",
  newAllowance: "60000000-0000-4000-8000-000000000003",
  membership: "70000000-0000-4000-8000-000000000001",
  user: "80000000-0000-4000-8000-000000000001",
};

type QueryRecord = {
  table: string;
  columns: string;
  filters: { column: string; value: unknown }[];
  single: boolean;
  operation: "select" | "insert" | "update" | "delete";
  values?: Record<string, unknown>;
};

const { from, rpc, records } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  records: [] as QueryRecord[],
}));

vi.mock("../auth/client", () => ({ supabase: { from, rpc } }));

const households: Record<string, unknown>[] = [
  { id: ids.household, wedding_id: ids.wedding, display_name: "Santos Family" },
  { id: ids.otherHousehold, wedding_id: ids.wedding, display_name: "Cruz Family" },
];
const guests: Record<string, unknown>[] = [
  { id: ids.guest, wedding_id: ids.wedding, household_id: ids.household },
  { id: ids.secondGuest, wedding_id: ids.wedding, household_id: ids.household },
  { id: ids.otherHouseholdGuest, wedding_id: ids.wedding, household_id: ids.otherHousehold },
  { id: ids.foreignGuest, wedding_id: ids.otherWedding, household_id: ids.household },
];
const groups: Record<string, unknown>[] = [
  { id: ids.group, wedding_id: ids.wedding, name: "Family", sort_order: 0 },
  { id: ids.secondGroup, wedding_id: ids.wedding, name: "Friends", sort_order: 1 },
  { id: ids.foreignGroup, wedding_id: ids.otherWedding, name: "Foreign group", sort_order: 0 },
];
const groupMemberships: Record<string, unknown>[] = [
  { wedding_id: ids.wedding, guest_group_id: ids.group, guest_id: ids.guest },
];
const roles: Record<string, unknown>[] = [
  { id: ids.role, wedding_id: ids.wedding, name: "Ceremony Reader", description: null, sort_order: 0, preset_key: null },
  { id: ids.foreignRole, wedding_id: ids.otherWedding, name: "Foreign role", description: null, sort_order: 0, preset_key: null },
];
const assignments: Record<string, unknown>[] = [
  { id: "51000000-0000-4000-8000-000000000001", wedding_id: ids.wedding, role_id: ids.role, guest_id: ids.guest },
];
const allowances: Record<string, unknown>[] = [
  { id: ids.allowance, wedding_id: ids.wedding, household_id: ids.household, sponsor_guest_id: ids.guest, allowance_type: "PLUS_ONE", max_count: 1 },
  { id: ids.foreignAllowance, wedding_id: ids.otherWedding, household_id: ids.household, sponsor_guest_id: ids.foreignGuest, allowance_type: "PLUS_ONE", max_count: 1 },
];

const tableRows: Record<string, Record<string, unknown>[]> = {
  guest_households: households,
  guests,
  guest_groups: groups,
  guest_group_memberships: groupMemberships,
  entourage_roles: roles,
  entourage_assignments: assignments,
  guest_allowances: allowances,
  guest_allowance_claims: [],
};

function matches(row: Record<string, unknown>, record: QueryRecord): boolean {
  return record.filters.every((filter) => row[filter.column] === filter.value);
}

function responseFor(record: QueryRecord): { data: unknown; error: null } {
  if (record.operation === "insert") {
    if (record.table === "guest_groups") return { data: record.single ? { id: ids.newGroup } : null, error: null };
    if (record.table === "entourage_roles") return { data: record.single ? { id: ids.newRole } : null, error: null };
    if (record.table === "guest_allowances") return { data: record.single ? { id: ids.newAllowance } : null, error: null };
    return { data: null, error: null };
  }
  if (record.operation === "update" || record.operation === "delete") {
    const found = (tableRows[record.table] ?? []).filter((row) => matches(row, record));
    const data = record.single ? (found[0] ? { id: found[0].id ?? found[0].guest_id } : null) : found;
    return { data, error: null };
  }
  const rows = (tableRows[record.table] ?? []).filter((row) => matches(row, record));
  return { data: record.single ? rows[0] ?? null : rows, error: null };
}

function setupMocks() {
  records.splice(0, records.length);
  from.mockReset();
  rpc.mockReset();
  from.mockImplementation((table: string) => {
    const record: QueryRecord = { table, columns: "", filters: [], single: false, operation: "select" };
    records.push(record);
    const query = {
      select(columns: string) { record.columns = columns; return query; },
      insert(values: Record<string, unknown>) { record.operation = "insert"; record.values = values; return query; },
      update(values: Record<string, unknown>) { record.operation = "update"; record.values = values; return query; },
      delete() { record.operation = "delete"; return query; },
      eq(column: string, value: unknown) { record.filters.push({ column, value }); return query; },
      maybeSingle() { record.single = true; return Promise.resolve(responseFor(record)); },
      then(onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) {
        return Promise.resolve(responseFor(record)).then(onfulfilled, onrejected);
      },
    };
    return query;
  });
  rpc.mockResolvedValue({ data: null, error: null });
}

function membership(role: WorkspaceMembership["role"] = "OWNER", weddingId = ids.wedding): WorkspaceMembership {
  return {
    membershipId: ids.membership,
    weddingId,
    userId: ids.user,
    role,
    status: "ACTIVE",
    partnerNames: [],
    wedding: {
      id: weddingId,
      display_name: "Garden Wedding",
      wedding_date: null,
      general_location: null,
      status: "ACTIVE",
      origin: "COUPLE_CREATED",
      ownership_mode: "COUPLE_OWNED",
    },
  };
}

const roleDraft: EntourageRoleDraft = { name: "  Ceremony Reader  ", description: "  Reads the ceremony  " };
const plusOneDraft: GuestAllowanceDraft = { householdId: ids.household, allowanceType: "PLUS_ONE", sponsorGuestId: ids.guest, maxCount: 2 };
const childDraft: GuestAllowanceDraft = { householdId: ids.household, allowanceType: "CHILD", sponsorGuestId: null, maxCount: 2 };

describe("Guest Group direct table writes", () => {
  beforeEach(setupMocks);

  it("creates, renames, and removes Wedding-scoped Groups through RLS tables", async () => {
    await expect(createGuestGroup(membership(), { name: "  Friends  " })).resolves.toBe(ids.newGroup);
    expect(records[0]).toMatchObject({ table: "guest_groups", operation: "insert", values: { wedding_id: ids.wedding, name: "Friends" } });

    await updateGuestGroup(membership(), ids.group, { name: "Close family" });
    expect(records.at(-1)).toMatchObject({ table: "guest_groups", operation: "update", values: { name: "Close family" } });
    expect(records.at(-1)?.filters).toEqual(expect.arrayContaining([
      { column: "id", value: ids.group },
      { column: "wedding_id", value: ids.wedding },
    ]));

    await deleteGuestGroup(membership(), ids.group);
    expect(records.at(-1)).toMatchObject({ table: "guest_groups", operation: "delete" });
  });

  it("adds and removes memberships by Wedding, Group, and Guest while allowing other group memberships", async () => {
    await addGuestToGroup(membership(), ids.secondGroup, ids.guest);
    expect(records.at(-1)).toMatchObject({
      table: "guest_group_memberships",
      operation: "insert",
      values: { wedding_id: ids.wedding, guest_group_id: ids.secondGroup, guest_id: ids.guest },
    });
    await removeGuestFromGroup(membership(), ids.group, ids.guest);
    expect(records.at(-1)).toMatchObject({ table: "guest_group_memberships", operation: "delete" });
    expect(records.at(-1)?.filters).toEqual(expect.arrayContaining([
      { column: "wedding_id", value: ids.wedding },
      { column: "guest_group_id", value: ids.group },
      { column: "guest_id", value: ids.guest },
    ]));
  });
});

describe("Entourage role and assignment direct table writes", () => {
  beforeEach(setupMocks);

  it("creates, edits, and deletes roles without an RPC and preserves optional descriptions", async () => {
    await expect(createEntourageRole(membership(), roleDraft)).resolves.toBe(ids.newRole);
    expect(records[0]).toMatchObject({ table: "entourage_roles", operation: "insert", values: { wedding_id: ids.wedding, name: "Ceremony Reader", description: "Reads the ceremony" } });
    await updateEntourageRole(membership(), ids.role, roleDraft);
    expect(records.at(-1)).toMatchObject({ table: "entourage_roles", operation: "update", values: { name: "Ceremony Reader", description: "Reads the ceremony" } });
    await deleteEntourageRole(membership(), ids.role);
    expect(records.at(-1)).toMatchObject({ table: "entourage_roles", operation: "delete" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("assigns and removes a Guest from one role while allowing that Guest to have other roles", async () => {
    await assignGuestToEntourageRole(membership(), ids.role, ids.secondGuest);
    expect(records.at(-1)).toMatchObject({
      table: "entourage_assignments",
      operation: "insert",
      values: { wedding_id: ids.wedding, role_id: ids.role, guest_id: ids.secondGuest },
    });
    await removeGuestFromEntourageRole(membership(), ids.role, ids.guest);
    expect(records.at(-1)).toMatchObject({ table: "entourage_assignments", operation: "delete" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("Allowance definition writes and claim RPC boundaries", () => {
  beforeEach(setupMocks);

  it("requires a same-Household PLUS_ONE sponsor and writes CHILD with a null sponsor", async () => {
    await expect(createGuestAllowance(membership(), { ...plusOneDraft, sponsorGuestId: null })).rejects.toThrow();
    expect(records).toHaveLength(0);

    await createGuestAllowance(membership(), plusOneDraft);
    expect(records.at(-1)).toMatchObject({
      table: "guest_allowances",
      operation: "insert",
      values: {
        wedding_id: ids.wedding,
        household_id: ids.household,
        sponsor_guest_id: ids.guest,
        allowance_type: "PLUS_ONE",
        max_count: 2,
      },
    });

    await createGuestAllowance(membership(), childDraft);
    expect(records.at(-1)).toMatchObject({
      table: "guest_allowances",
      operation: "insert",
      values: {
        wedding_id: ids.wedding,
        household_id: ids.household,
        sponsor_guest_id: null,
        allowance_type: "CHILD",
        max_count: 2,
      },
    });
  });

  it("edits and removes unclaimed definitions with direct RLS table writes", async () => {
    await updateGuestAllowance(membership(), ids.allowance, plusOneDraft);
    expect(records.at(-1)).toMatchObject({ table: "guest_allowances", operation: "update", values: { max_count: 2, sponsor_guest_id: ids.guest } });
    await deleteGuestAllowance(membership(), ids.allowance);
    expect(records.at(-1)).toMatchObject({ table: "guest_allowances", operation: "delete" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps claim and release to the existing RPCs and reports capacity errors safely", async () => {
    await claimGuestAllowance(membership(), ids.allowance, ids.secondGuest);
    expect(rpc).toHaveBeenLastCalledWith("claim_guest_allowance", { p_allowance_id: ids.allowance, p_guest_id: ids.secondGuest });
    await releaseGuestAllowanceClaim(membership(), ids.allowance, ids.secondGuest);
    expect(rpc).toHaveBeenLastCalledWith("release_guest_allowance_claim", { p_allowance_id: ids.allowance, p_guest_id: ids.secondGuest });

    rpc.mockResolvedValueOnce({ data: null, error: { code: "23514", constraint: "guest_allowance_claims_capacity_check" } });
    await expect(claimGuestAllowance(membership(), ids.allowance, ids.secondGuest)).rejects.toMatchObject({ code: "23514" });
    expect(safeGuestError({ code: "23514", constraint: "guest_allowance_claims_capacity_check" })).toContain("full");
  });
});

describe("Selected Wedding and manager guards", () => {
  beforeEach(setupMocks);

  it("rejects foreign Group, Role, sponsor Guest, and Allowance IDs without mutating", async () => {
    await expect(updateGuestGroup(membership(), ids.foreignGroup, { name: "Hidden" })).rejects.toMatchObject({ code: "22023" });
    await expect(assignGuestToEntourageRole(membership(), ids.foreignRole, ids.guest)).rejects.toMatchObject({ code: "22023" });
    await expect(createGuestAllowance(membership(), { ...plusOneDraft, sponsorGuestId: ids.foreignGuest })).rejects.toMatchObject({ code: "22023" });
    await expect(claimGuestAllowance(membership(), ids.foreignAllowance, ids.foreignGuest)).rejects.toMatchObject({ code: "23503" });
    expect(records.every((record) => record.operation === "select")).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a PLUS_ONE sponsor from another same-Wedding Household", async () => {
    await expect(createGuestAllowance(membership(), { ...plusOneDraft, sponsorGuestId: ids.otherHouseholdGuest })).rejects.toMatchObject({
      code: "23514",
      constraint: "guest_allowances_sponsor_same_household_check",
    });
    expect(records.every((record) => record.operation === "select")).toBe(true);
  });

  it("keeps Day-of Coordinators read-only before any guest-domain query", async () => {
    await expect(createGuestGroup(membership("DAY_OF_COORDINATOR"), { name: "Family" })).rejects.toMatchObject({ code: "42501" });
    await expect(createEntourageRole(membership("DAY_OF_COORDINATOR"), roleDraft)).rejects.toMatchObject({ code: "42501" });
    await expect(createGuestAllowance(membership("DAY_OF_COORDINATOR"), childDraft)).rejects.toMatchObject({ code: "42501" });
    expect(records).toHaveLength(0);
    expect(rpc).not.toHaveBeenCalled();
  });
});
