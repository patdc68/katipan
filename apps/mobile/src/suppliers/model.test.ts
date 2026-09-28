import { describe, expect, it } from "vitest";
import type { WorkspaceMembership, WorkspaceRole } from "../workspace/model";
import {
  filterSupplierList,
  isSupplierFinanceManager,
  mapSupplierFinanceTotals,
  safeSupplierError,
  SUPPLIER_STATUSES,
  supplierCategories,
  supplierEmailHref,
  supplierPhoneHref,
  supplierStatusLabel,
  supplierWebsiteHref,
  SupplierSubmitGate,
  validateSupplierCommitmentDraft,
  validateSupplierDraft,
  type SupplierFinanceRow,
  type SupplierListItem,
  type SupplierRecord,
} from "./model";

const weddingId = "wedding-a";

function membership(role: WorkspaceRole, mode: "COUPLE" | "CONTROLLER" = "COUPLE"): WorkspaceMembership {
  const coordinated = mode === "CONTROLLER";
  return {
    membershipId: `${role}-membership`,
    weddingId,
    userId: "user-a",
    role,
    status: "ACTIVE",
    partnerNames: ["Juan", "Maria"],
    wedding: {
      id: weddingId,
      display_name: "Juan & Maria",
      wedding_date: null,
      general_location: "Manila",
      status: "ACTIVE",
      origin: coordinated ? "COORDINATOR_CREATED" : "COUPLE_CREATED",
      ownership_mode: coordinated ? "COORDINATOR_MANAGED" : "COUPLE_OWNED",
    },
  };
}

function supplier(overrides: Partial<SupplierRecord> = {}): SupplierRecord {
  return {
    id: "supplier-a",
    wedding_id: weddingId,
    name: "Luntian Studio",
    category: "Photo & Film",
    contact_name: "Mila Santos",
    email: "mila@example.com",
    phone: "+63 900 000 0000",
    website: "luntian.example",
    notes: null,
    status: "CONTACTED",
    committed_amount: 1500,
    committed_on: "2026-09-01",
    commitment_notes: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function financeRow(overrides: Partial<SupplierFinanceRow> = {}): SupplierFinanceRow {
  return {
    supplier_id: "supplier-a",
    wedding_id: weddingId,
    committed_amount: 1500,
    scheduled_amount: 840,
    actual_paid: 275,
    remaining_commitment: 1225,
    overdue_balance: 140,
    unscheduled_paid: 35,
    ...overrides,
  };
}

function listItem(record: SupplierRecord, finance: SupplierListItem["finance"]): SupplierListItem {
  return { ...record, finance };
}

describe("Supplier finance access", () => {
  it("allows Owners and Full Coordinators, including the existing coordinator-managed controller path", () => {
    expect(isSupplierFinanceManager(membership("OWNER"))).toBe(true);
    expect(isSupplierFinanceManager(membership("FULL_COORDINATOR", "CONTROLLER"))).toBe(true);
    expect(isSupplierFinanceManager(membership("FULL_COORDINATOR"))).toBe(true);
  });

  it("denies Day-of and Guest Coordinators and inactive or mismatched memberships", () => {
    expect(isSupplierFinanceManager(membership("DAY_OF_COORDINATOR"))).toBe(false);
    expect(isSupplierFinanceManager(membership("GUEST_COORDINATOR"))).toBe(false);
    expect(isSupplierFinanceManager({ ...membership("OWNER"), status: "LEFT" })).toBe(false);
    expect(isSupplierFinanceManager({ ...membership("OWNER"), weddingId: "wedding-b" })).toBe(false);
  });
});

describe("Supplier lifecycle and contact validation", () => {
  it("uses exactly the five backend lifecycle statuses", () => {
    expect(SUPPLIER_STATUSES).toEqual(["PROSPECT", "CONTACTED", "BOOKED", "COMPLETED", "CANCELLED"]);
    expect(SUPPLIER_STATUSES.map(supplierStatusLabel)).toEqual(["Prospect", "Contacted", "Booked", "Completed", "Cancelled"]);
  });

  it("requires name and category before a Supplier write", () => {
    expect(validateSupplierDraft({ ...emptyDraft, name: " ", category: "Photo" })).toMatchObject({ ok: false, field: "name" });
    expect(validateSupplierDraft({ ...emptyDraft, name: "Luntian Studio", category: " " })).toMatchObject({ ok: false, field: "category" });
  });

  it("trims required fields, normalizes optional blanks and lowercases email", () => {
    expect(validateSupplierDraft({
      ...emptyDraft,
      name: " Luntian Studio ",
      category: " Photo & Film ",
      contactName: " Mila Santos ",
      email: "  HELLO@EXAMPLE.COM ",
      phone: "  +63 900 000 0000 ",
      website: " luntian.example ",
      notes: "  Contract call on Friday  ",
    })).toEqual({
      ok: true,
      value: {
        name: "Luntian Studio",
        category: "Photo & Film",
        contactName: "Mila Santos",
        email: "hello@example.com",
        phone: "+63 900 000 0000",
        website: "luntian.example",
        notes: "Contract call on Friday",
        status: "PROSPECT",
      },
    });
    expect(validateSupplierDraft({ ...emptyDraft, name: "Studio", category: "Photo", email: "not-an-email" })).toMatchObject({ ok: false, field: "email" });
  });
});

describe("Supplier list filters", () => {
  const photo = supplier();
  const florist = supplier({ id: "supplier-b", name: "Araw Floral", category: "Flowers", status: "BOOKED", contact_name: null, email: null });
  const rows = [
    listItem(photo, { supplierId: photo.id, weddingId, committedAmount: 1500, scheduledAmount: 840, actualPaid: 275, remainingCommitment: 1225, overdueBalance: 140, unscheduledPaid: 35 }),
    listItem(florist, { supplierId: florist.id, weddingId, committedAmount: null, scheduledAmount: 0, actualPaid: 0, remainingCommitment: null, overdueBalance: 0, unscheduledPaid: 0 }),
  ];

  it("searches Supplier name, category and contact details with status and category filters", () => {
    expect(filterSupplierList(rows, { search: "mila", status: "ALL" }).map((row) => row.id)).toEqual(["supplier-a"]);
    expect(filterSupplierList(rows, { search: "", status: "BOOKED" }).map((row) => row.id)).toEqual(["supplier-b"]);
    expect(filterSupplierList(rows, { search: "", status: "ALL", category: "flowers" }).map((row) => row.id)).toEqual(["supplier-b"]);
  });

  it("derives free-text category filters from saved Suppliers rather than an enum", () => {
    expect(supplierCategories([photo, florist])).toEqual(["Flowers", "Photo & Film"]);
    expect(supplierCategories([photo, supplier({ id: "supplier-c", category: "photo & film" })])).toHaveLength(1);
  });
});

describe("Supplier commitment and finance mapping", () => {
  it("validates create or edit amounts, dates and optional notes", () => {
    expect(validateSupplierCommitmentDraft({ amount: "1,200.50", committedOn: "2026-09-28", notes: " Signed " })).toEqual({
      ok: true,
      value: { amount: 1200.5, committedOn: "2026-09-28", notes: "Signed" },
    });
    expect(validateSupplierCommitmentDraft({ amount: "0", committedOn: "", notes: "" })).toEqual({
      ok: true,
      value: { amount: 0, committedOn: null, notes: null },
    });
    expect(validateSupplierCommitmentDraft({ amount: "-10", committedOn: "", notes: "" })).toMatchObject({ ok: false, field: "amount" });
    expect(validateSupplierCommitmentDraft({ amount: "10", committedOn: "2026-02-30", notes: "" })).toMatchObject({ ok: false, field: "committedOn" });
    expect(validateSupplierCommitmentDraft({ amount: "", committedOn: "", notes: "orphaned note" })).toMatchObject({ ok: false, field: "amount" });
  });

  it("maps the canonical aggregate fields independently without deriving one total from another", () => {
    const mapped = mapSupplierFinanceTotals(financeRow(), weddingId, "supplier-a");
    expect(mapped).toEqual({
      supplierId: "supplier-a",
      weddingId,
      committedAmount: 1500,
      scheduledAmount: 840,
      actualPaid: 275,
      remainingCommitment: 1225,
      overdueBalance: 140,
      unscheduledPaid: 35,
    });
    expect(mapped?.committedAmount).not.toBe(mapped?.scheduledAmount);
    expect(mapped?.actualPaid).not.toBe(mapped?.scheduledAmount);
    expect(mapped?.actualPaid).toBe(300 - 25);
  });

  it("keeps an absent commitment absent instead of converting it to zero", () => {
    const mapped = mapSupplierFinanceTotals(financeRow({ committed_amount: null, remaining_commitment: null }), weddingId, "supplier-a");
    expect(mapped?.committedAmount).toBeNull();
    expect(mapped?.remainingCommitment).toBeNull();
  });

  it("rejects aggregates attached to a different Wedding or Supplier", () => {
    expect(mapSupplierFinanceTotals(financeRow({ wedding_id: "wedding-b" }), weddingId, "supplier-a")).toBeNull();
    expect(mapSupplierFinanceTotals(financeRow({ supplier_id: "supplier-b" }), weddingId, "supplier-a")).toBeNull();
  });
});

describe("safe contact links and errors", () => {
  it("creates only safe mail, telephone and http(s) links", () => {
    expect(supplierEmailHref("HELLO@example.com")).toBe("mailto:hello@example.com");
    expect(supplierPhoneHref("+63 (900) 123-4567")).toBe("tel:+639001234567");
    expect(supplierPhoneHref("++63 (900) 123-4567")).toBeNull();
    expect(supplierWebsiteHref("example.com")).toBe("https://example.com/");
    expect(supplierWebsiteHref("javascript:alert(1)")).toBeNull();
    expect(supplierWebsiteHref("https://user:password@example.com")).toBeNull();
  });

  it("maps backend errors to safe messages without exposing raw database text", () => {
    expect(safeSupplierError({ code: "42501", message: "secret database policy detail" })).toContain("private");
    expect(safeSupplierError({ code: "23503", message: "internal FK name" })).toContain("Cross-Wedding");
    expect(safeSupplierError({ code: "22P02" })).toContain("available Supplier statuses");
    expect(safeSupplierError({ message: "socket details" })).not.toContain("socket details");
  });

  it("prevents a second action while a submission is pending", async () => {
    const gate = new SupplierSubmitGate();
    let release: () => void = () => {};
    let calls = 0;
    const first = gate.run(async () => {
      calls += 1;
      await new Promise<void>((resolve) => { release = resolve; });
      return "saved";
    });
    expect(await gate.run(async () => { calls += 1; return "duplicate"; })).toBeUndefined();
    expect(calls).toBe(1);
    release();
    await expect(first).resolves.toBe("saved");
  });
});

const emptyDraft = {
  name: "",
  category: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  notes: "",
  status: "PROSPECT" as const,
};
