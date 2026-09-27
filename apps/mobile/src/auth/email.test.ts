import { beforeEach, describe, expect, it, vi } from "vitest";

const { signUp, exchangeCodeForSession, getSession, getAuthRedirectUrl } = vi.hoisted(() => ({
  signUp: vi.fn(), exchangeCodeForSession: vi.fn(), getSession: vi.fn(), getAuthRedirectUrl: vi.fn(),
}));
vi.mock("./client", () => ({ getAuthRedirectUrl, supabase: { auth: { signUp, exchangeCodeForSession, getSession } } }));

describe("mobile email confirmation", () => {
  beforeEach(() => { signUp.mockReset(); exchangeCodeForSession.mockReset(); getSession.mockReset(); getAuthRedirectUrl.mockReset().mockReturnValue("katipan://auth/callback"); });

  it("supplies the Katipan callback as the signup email redirect", async () => {
    signUp.mockResolvedValue({ data: {}, error: null });
    const { signUpWithEmail } = await import("./email");
    await signUpWithEmail("couple@example.com", "a-long-password");
    expect(signUp).toHaveBeenCalledWith({ email: "couple@example.com", password: "a-long-password", options: { emailRedirectTo: "katipan://auth/callback" } });
  });

  it("exchanges a confirmation code, restores the persisted session, and rejects an expired code", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "expired" } });
    getSession.mockResolvedValue({ data: { session: { user: { id: "owner" } } }, error: null });
    const { exchangeConfirmationCode } = await import("./email");
    await expect(exchangeConfirmationCode("valid-code_1234")).resolves.toBeUndefined();
    expect(exchangeCodeForSession).toHaveBeenCalledWith("valid-code_1234");
    expect(getSession).toHaveBeenCalledOnce();
    await expect(exchangeConfirmationCode("expired-code_1234")).rejects.toThrow();
  });

  it("rejects malformed callback data without calling Supabase", async () => {
    const { exchangeConfirmationCode } = await import("./email");
    await expect(exchangeConfirmationCode(["one", "two"])).rejects.toThrow("Invalid confirmation link.");
    await expect(exchangeConfirmationCode("a".repeat(700))).rejects.toThrow("Invalid confirmation link.");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("treats missing persisted session as an invalid confirmation result", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    const { exchangeConfirmationCode } = await import("./email");
    await expect(exchangeConfirmationCode("valid-code_1234")).rejects.toThrow("Confirmation session unavailable.");
  });
});
