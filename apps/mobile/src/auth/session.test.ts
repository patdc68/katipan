import { describe, expect, it } from "vitest";
import { AuthEventGeneration, RequestGeneration } from "./session";

describe("auth restoration generations", () => {
  it("rejects an initial session snapshot superseded by an auth event", () => {
    const events = new AuthEventGeneration();
    const snapshot = events.snapshot();
    events.noteEvent();
    expect(events.isCurrent(snapshot)).toBe(false);
  });

  it("allows the latest restore and rejects an older account restore", () => {
    const requests = new RequestGeneration();
    const accountA = requests.begin();
    const accountB = requests.begin();
    expect(requests.isCurrent(accountA)).toBe(false);
    expect(requests.isCurrent(accountB)).toBe(true);
  });

  it("invalidates pending restore work on logout", () => {
    const requests = new RequestGeneration();
    const restore = requests.begin();
    requests.invalidate();
    expect(requests.isCurrent(restore)).toBe(false);
  });

  it("rejects a session result that resolves after a newer auth request starts", async () => {
    const requests = new RequestGeneration();
    const signOutRecovery = requests.begin();
    let resolveSession!: (value: string) => void;
    const pendingSession = new Promise<string>((resolve) => { resolveSession = resolve; });
    const guardedSession = pendingSession.then((session) =>
      requests.isCurrent(signOutRecovery) ? session : null,
    );

    requests.begin();
    resolveSession("stale-account-session");
    await expect(guardedSession).resolves.toBe(null);
  });
});
