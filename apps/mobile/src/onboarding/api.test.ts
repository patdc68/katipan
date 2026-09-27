import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDraft } from "./model";
import { createCoupleWedding, issuePartnerInvitation, partnerInvitationLink } from "./api";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("../auth/client", () => ({ supabase: { rpc, from } }));

describe("onboarding RPC boundaries", () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset(); });
  it("carries Wedding and existing Partner IDs from successful creation", async () => {
    rpc.mockResolvedValue({ data: [{ wedding_id: "w-1", current_person_id: "p-1", second_partner_person_id: "p-2", membership_id: "m-1" }], error: null });
    const created = await createCoupleWedding({ ...emptyDraft, weddingName: "Our Day", currentName: "Pat", partnerName: "Anna" });
    expect(created).toEqual({ weddingId: "w-1", currentPersonId: "p-1", secondPartnerPersonId: "p-2" });
    expect(rpc).toHaveBeenCalledWith("create_couple_wedding", expect.objectContaining({ p_second_partner_display_name: "Anna" }));
  });
  it("surfaces a creation error without creating local IDs", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("network") });
    await expect(createCoupleWedding({ ...emptyDraft, weddingName: "Our Day", currentName: "Pat" })).rejects.toThrow("network");
  });
  it("targets the existing second Partner and keeps the token transient", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const token = "a".repeat(64);
    rpc.mockResolvedValue({ data: [{ invitation_id: "i-1", raw_token: token, invitation_expires_at: "2026-10-04" }], error: null });
    const result = await issuePartnerInvitation({ weddingId: "w-1", currentPersonId: "p-1", secondPartnerPersonId: "p-2" }, " ANNA@example.com ");
    expect(rpc).toHaveBeenCalledWith("issue_partner_owner_invitation", { p_wedding_id: "w-1", p_target_person_id: "p-2", p_invited_email: "anna@example.com" });
    expect(partnerInvitationLink(result.raw_token)).toBe(`katipan:///accept-invitation?token=${token}`);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("does not issue when there is no second Partner", async () => {
    await expect(issuePartnerInvitation({ weddingId: "w-1", currentPersonId: "p-1", secondPartnerPersonId: null }, "a@example.com")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});

function query(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq"]) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  return builder;
}

describe("motif persistence", () => {
  const colors = ["#60725A", "#C5A059", "#D9D0C3", "#FAF8F5"];
  it("inserts a motif, saves 3–5 colors, and updates the title without upsert", async () => {
    const lookup = query({ data: null }); const motifInsert = query({ data: { id: "motif-1" } });
    const colorDelete = query({ error: null }); const colorInsert = query({ error: null });
    from.mockImplementation((table: string) => table === "wedding_motifs" ? from.mock.calls.filter(([name]) => name === table).length === 1 ? lookup : motifInsert : from.mock.calls.filter(([name]) => name === table).length === 1 ? colorDelete : colorInsert);
    const { saveMotif } = await import("./api");
    await expect(saveMotif("wedding-1", "Sage Romance", colors)).resolves.toBeUndefined();
    expect(motifInsert.insert).toHaveBeenCalledWith({ wedding_id: "wedding-1", title: "Sage Romance" });
    expect(motifInsert).not.toHaveProperty("upsert");
    expect(colorInsert.insert).toHaveBeenCalledWith(colors.map((color_hex, sort_order) => ({ wedding_id: "wedding-1", motif_id: "motif-1", color_hex, sort_order })));
  });

  it("reports a safe failing stage when the motif title update is denied", async () => {
    const lookup = query({ data: { id: "motif-1" } }); const titleUpdate = query({ error: { code: "42501", message: "database detail must not reach user" } });
    from.mockImplementation(() => from.mock.calls.length === 1 ? lookup : titleUpdate);
    const { saveMotif } = await import("./api");
    await expect(saveMotif("wedding-1", "Sage Romance", colors)).rejects.toMatchObject({ name: "MotifPersistenceError", stage: "update_motif_title", message: "Motif persistence failed." });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["wedding_motifs", "wedding_motifs"]);
  });

  it("updates only the motif title when one already exists, then replaces its colors", async () => {
    const lookup = query({ data: { id: "motif-1" } }); const titleUpdate = query({ data: { id: "motif-1" } });
    const colorDelete = query({ error: null }); const colorInsert = query({ error: null });
    from.mockImplementation((table: string) => {
      const tableCalls = from.mock.calls.filter(([name]) => name === table).length;
      if (table === "wedding_motifs") return tableCalls === 1 ? lookup : titleUpdate;
      return tableCalls === 1 ? colorDelete : colorInsert;
    });
    const { saveMotif } = await import("./api");
    await expect(saveMotif("wedding-1", "Sage Romance", colors)).resolves.toBeUndefined();
    expect(titleUpdate.update).toHaveBeenCalledWith({ title: "Sage Romance" });
    expect(colorDelete.delete).toHaveBeenCalledOnce();
    expect(colorInsert.insert).toHaveBeenCalledOnce();
  });
});
