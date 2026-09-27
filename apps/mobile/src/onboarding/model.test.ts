import { describe, expect, it, vi } from "vitest";
import { allowedRoute, calendarDateToIso, emptyDraft, formatWeddingDate, InvitationGate, parseCalendarDate, SingleFlight, weddingDateForSubmit, weddingDraftSchema, weddingRpcArgs } from "./model";

describe("couple onboarding", () => {
  it("protects unauthenticated routes and redirects existing owners away from creation", () => {
    expect(allowedRoute("wedding-details", false, "details")).toBe("welcome");
    expect(allowedRoute("auth", false, "start")).toBe("auth");
    expect(allowedRoute("welcome", true, "start")).toBe("create-wedding");
    expect(allowedRoute("invite-partner", true, "created", false)).toBe("motif-complete");
    expect(allowedRoute("create-wedding", true, "created", true)).toBe("invite-partner");
  });

  it("validates required input and maps only the approved RPC arguments", () => {
    expect(weddingDraftSchema.safeParse(emptyDraft).success).toBe(false);
    const draft = { ...emptyDraft, currentName: "  Pat  ", partnerName: "  Anna ", weddingName: " Our Day ", date: "2027-12-18", location: " Antipolo ", guestCount: 125, ceremonyStyle: "CIVIL" as const, targetBudget: "600000" };
    expect(weddingRpcArgs(draft)).toEqual({
      p_wedding_display_name: "Our Day", p_current_partner_display_name: "Pat", p_second_partner_display_name: "Anna",
      p_wedding_date: "2027-12-18", p_timezone: "Asia/Manila", p_general_location: "Antipolo",
      p_estimated_guest_count: 125, p_ceremony_style: "CIVIL",
    });
    expect(weddingDraftSchema.safeParse({ ...draft, date: "tomorrow" }).success).toBe(false);
    expect(weddingDraftSchema.safeParse({ ...draft, date: "2027-02-31" }).success).toBe(false);
    expect(weddingDraftSchema.safeParse({ ...draft, guestCount: -1 }).success).toBe(false);
  });

  it("stores a native calendar selection as canonical YYYY-MM-DD", () => {
    expect(calendarDateToIso(new Date(2027, 4, 16, 23, 45))).toBe("2027-05-16");
    expect(parseCalendarDate("2027-05-16")?.getDate()).toBe(16);
    expect(parseCalendarDate("2027-02-31")).toBeNull();
  });

  it("formats a friendly date without shifting the selected calendar day", () => {
    expect(formatWeddingDate("2027-05-16", "en-US")).toBe("May 16, 2027");
    expect(calendarDateToIso(parseCalendarDate("2027-05-16")!)).toBe("2027-05-16");
  });

  it("clears and ignores the date when the couple has not chosen one", () => {
    expect(weddingDateForSubmit("2027-05-16", true)).toBe("");
    expect(weddingRpcArgs({ ...emptyDraft, weddingName: "Our Day", currentName: "Pat", date: weddingDateForSubmit("2027-05-16", true) }).p_wedding_date).toBeUndefined();
    expect(weddingDateForSubmit("2027-05-16", false)).toBe("2027-05-16");
  });

  it("coalesces double submits and permits a retry after an error", async () => {
    const action = vi.fn().mockResolvedValueOnce("created").mockRejectedValueOnce(new Error("offline"));
    const flight = new SingleFlight<string>();
    const first = flight.run(action); const second = flight.run(action);
    expect(first).toBe(second);
    expect(await first).toBe("created");
    await expect(flight.run(action)).rejects.toThrow("offline");
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("Skip partner invitation completes without issuing and blocks later taps", async () => {
    const issue = vi.fn().mockResolvedValue("issued");
    const gate = new InvitationGate();
    expect(gate.skip()).toBe(true);
    expect(await gate.run(issue)).toBeNull();
    expect(issue).not.toHaveBeenCalled();
  });

  it("does not allow Skip while an invitation is being issued", async () => {
    let finish!: (value: string) => void;
    const gate = new InvitationGate();
    const pending = gate.run(() => new Promise<string>(resolve => { finish = resolve; }));
    expect(gate.skip()).toBe(false);
    finish("issued");
    expect(await pending).toBe("issued");
    expect(gate.skip()).toBe(true);
  });
});
