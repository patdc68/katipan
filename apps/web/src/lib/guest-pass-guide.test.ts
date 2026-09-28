import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isHouseholdInvitationToken,
  loadGuestPassGuide,
  parseGuestPassGuide,
  selectGuestPass,
} from "./guest-pass-guide";

const token = "c".repeat(64);
const qrA = "a".repeat(64);
const qrB = "b".repeat(64);
const guestA = "30000000-0000-4000-8000-000000000001";
const guestB = "30000000-0000-4000-8000-000000000002";

function pass(guestId: string, name: string, qrPayload: string, seating: unknown[] = []) {
  return {
    guestId,
    name,
    reference: guestId === guestA ? "K1234-ABCD" : "K5678-EFAB",
    qrPayload,
    seating,
    email: "private@example.test",
    phone: "+639170000000",
    internalNotes: "private planner notes",
  };
}

function guide(guestPasses: unknown[]) {
  return {
    slug: "juan-maria",
    title: "Juan & Maria",
    wedding: { name: "Juan & Maria", date: "2027-02-14", location: "Manila", partners: ["Juan", "Maria"] },
    guestPasses,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("sanitized Guest Pass Guide projection", () => {
  it("keeps two named individual passes, their separate payloads, references, and current seating", () => {
    const projected = parseGuestPassGuide(guide([
      pass(guestA, "Maria Santos", qrA, [{ eventName: "Reception", tableName: "Table 3" }]),
      pass(guestB, "Luis Santos", qrB, [{ eventName: "Reception", tableName: "Table 5", seatLabel: "Seat 2" }]),
    ]));
    expect(projected).toMatchObject({
      weddingName: "Juan & Maria",
      passes: [
        { guestId: guestA, name: "Maria Santos", reference: "K1234-ABCD", qrPayload: qrA, seating: [{ eventName: "Reception", tableName: "Table 3" }] },
        { guestId: guestB, name: "Luis Santos", reference: "K5678-EFAB", qrPayload: qrB, seating: [{ eventName: "Reception", tableName: "Table 5", seatLabel: "Seat 2" }] },
      ],
    });
    expect(projected).not.toHaveProperty("passes.0.email");
    expect(projected).not.toHaveProperty("passes.0.phone");
    expect(projected).not.toHaveProperty("passes.0.internalNotes");
    expect(projected).not.toHaveProperty("wedding.location");
    expect(projected).not.toHaveProperty("wedding.partners");
  });

  it("rejects missing or duplicate Guest identities instead of inventing names or combining Passes", () => {
    expect(parseGuestPassGuide(guide([{
      guestId: guestA,
      reference: "K1234-ABCD",
      qrPayload: qrA,
      seating: [],
    }]))).toBeNull();
    expect(parseGuestPassGuide(guide([
      pass(guestA, "Maria Santos", qrA),
      pass(guestA, "Second identity", qrB),
    ]))).toBeNull();
  });

  it("preserves HIDDEN, TABLE_ONLY, and TABLE_AND_SEAT projection shapes", () => {
    const projected = parseGuestPassGuide(guide([
      pass(guestA, "Maria Santos", qrA, []),
      pass(guestB, "Luis Santos", qrB, [{ eventName: "Reception", tableName: "Table 5" }]),
      pass("30000000-0000-4000-8000-000000000003", "Ana Santos", "d".repeat(64), [
        { eventName: "Reception", tableName: "Table 8", seatLabel: "Seat 4" },
      ]),
    ]));
    expect(projected?.passes[0]?.seating).toEqual([]);
    expect(projected?.passes[1]?.seating[0]).not.toHaveProperty("seatLabel");
    expect(projected?.passes[2]?.seating[0]?.seatLabel).toBe("Seat 4");
  });

  it("selects exactly one individual Pass at a time", () => {
    const parsed = parseGuestPassGuide(guide([pass(guestA, "Maria Santos", qrA), pass(guestB, "Luis Santos", qrB)]));
    expect(parsed).not.toBeNull();
    expect(selectGuestPass(parsed?.passes ?? [], guestB)?.qrPayload).toBe(qrB);
    expect(selectGuestPass(parsed?.passes ?? [], "unknown")?.guestId).toBe(guestA);
  });

  it("requires a valid invitation token and calls only the existing no-store Guest Guide endpoint", async () => {
    expect(isHouseholdInvitationToken(token)).toBe(true);
    expect(isHouseholdInvitationToken("too-short")).toBe(false);
    const fetcher = vi.fn((...args: Parameters<typeof fetch>) => {
      void args;
      return Promise.resolve(Response.json(guide([pass(guestA, "Maria Santos", qrA)])));
    });
    const result = await loadGuestPassGuide("juan-maria", token, {
      fetcher,
      supabaseUrl: "https://project.test/",
      publishableKey: "publishable-test-key",
    });
    expect(result.status).toBe("ready");
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, request] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://project.test/functions/v1/guest-wedding-guide");
    expect(request?.method).toBe("POST");
    expect(request?.cache).toBe("no-store");
    expect(new Headers(request?.headers).get("apikey")).toBe("publishable-test-key");
    expect(JSON.parse(String(request?.body))).toEqual({ slug: "juan-maria", invitationToken: token });
  });

  it("does not call the server for a missing invitation and maps invalid or failed access safely", async () => {
    const fetcher = vi.fn();
    await expect(loadGuestPassGuide("juan-maria", "", { fetcher })).resolves.toEqual({ status: "invalid-invitation" });
    expect(fetcher).not.toHaveBeenCalled();
    await expect(loadGuestPassGuide("juan-maria", token, {
      fetcher: vi.fn(async () => new Response(null, { status: 403 })),
      supabaseUrl: "https://project.test",
      publishableKey: "publishable-test-key",
    })).resolves.toEqual({ status: "invalid-invitation" });
    await expect(loadGuestPassGuide("juan-maria", token, {
      fetcher: vi.fn(async () => { throw new Error("private transport details"); }),
      supabaseUrl: "https://project.test",
      publishableKey: "publishable-test-key",
    })).resolves.toEqual({ status: "unavailable" });
  });

  it("does not log or persist the Guest Pass QR payload", async () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi.fn(async () => Response.json(guide([pass(guestA, "Maria Santos", qrA)])));
    await loadGuestPassGuide("juan-maria", token, {
      fetcher,
      supabaseUrl: "https://project.test",
      publishableKey: "publishable-test-key",
    });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
