import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { RequestGeneration } from "../auth/session";
import { useAccess } from "../onboarding/provider";
import { loadActiveMemberships } from "./api";
import {
  AccountScopedWeddingSelection,
  findActiveMembership,
  nextWorkspaceCacheRevision,
  planWorkspaceRestoration,
  workspaceMembershipsForAccount,
  workspaceRestorationStatus,
  workspaceSelectionForAccount,
  type WorkspaceMembership,
  type WorkspaceRestorationStatus,
} from "./model";

const LEGACY_SELECTED_WEDDING_KEY = "katipan.selected-wedding-id";

const selectedWeddingStorage = new AccountScopedWeddingSelection({
  getItem: (key) => Platform.OS === "web"
    ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null)
    : SecureStore.getItemAsync(key),
  setItem: (key, value) => Platform.OS === "web"
    ? Promise.resolve(globalThis.localStorage?.setItem(key, value))
    : SecureStore.setItemAsync(key, value),
  removeItem: (key) => Platform.OS === "web"
    ? Promise.resolve(globalThis.localStorage?.removeItem(key))
    : SecureStore.deleteItemAsync(key),
}, LEGACY_SELECTED_WEDDING_KEY);

const readSelectedWeddingId = (accountId: string) => selectedWeddingStorage.read(accountId);
const storeSelectedWeddingId = (accountId: string, weddingId: string | null) => selectedWeddingStorage.write(accountId, weddingId);
const clearStoredSelection = (accountId: string | null) => selectedWeddingStorage.clear(accountId);

type WorkspaceSnapshot = {
  accountId: string | null;
  phase: "loading" | "ready" | "error";
  memberships: WorkspaceMembership[];
  selectedWeddingId: string | null;
  membershipLost: boolean;
  error: string | null;
  cacheRevision: number;
};

const initialSnapshot: WorkspaceSnapshot = {
  accountId: null,
  phase: "loading",
  memberships: [],
  selectedWeddingId: null,
  membershipLost: false,
  error: null,
  cacheRevision: 0,
};

export class WorkspaceMembershipLostError extends Error {
  constructor() {
    super("Wedding membership is no longer active.");
    this.name = "WorkspaceMembershipLostError";
  }
}

export class WorkspaceRefreshError extends Error {
  constructor() {
    super("Wedding memberships could not be verified.");
    this.name = "WorkspaceRefreshError";
  }
}

type WorkspaceContextValue = {
  status: WorkspaceRestorationStatus;
  loading: boolean;
  error: string | null;
  memberships: readonly WorkspaceMembership[];
  selectedWeddingId: string | null;
  selectedMembership: WorkspaceMembership | null;
  membershipLost: boolean;
  sessionRevision: number;
  cacheRevision: number;
  membershipFor: (weddingId: string) => WorkspaceMembership | null;
  setSelectedWedding: (weddingId: string) => WorkspaceMembership;
  activateWedding: (weddingId: string) => Promise<WorkspaceMembership>;
  refreshMemberships: (preferredWeddingId?: string) => Promise<WorkspaceMembership[]>;
  clearForLogout: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { session, sessionRevision, loading: accessLoading, error: accessError } = useAccess();
  const accountId = session?.user.id ?? null;
  const accountIdRef = useRef(accountId);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(initialSnapshot);
  const snapshotRef = useRef(snapshot);
  const requests = useRef(new RequestGeneration());

  useLayoutEffect(() => {
    accountIdRef.current = accountId;
  }, [accountId]);

  const commit = useCallback((next: WorkspaceSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const refreshMemberships = useCallback(async (preferredWeddingId?: string) => {
    if (!accountId || accountIdRef.current !== accountId) throw new WorkspaceRefreshError();
    const request = requests.current.begin();
    const previous = snapshotRef.current;
    const sameAccount = previous.accountId === accountId;
    const starting: WorkspaceSnapshot = sameAccount
      ? { ...previous, phase: "loading", error: null }
      : {
        accountId,
        phase: "loading",
        memberships: [],
        selectedWeddingId: null,
        membershipLost: false,
        error: null,
        cacheRevision: previous.cacheRevision + 1,
      };

    if (!sameAccount && previous.accountId) void clearStoredSelection(previous.accountId);
    commit(starting);

    let memberships: WorkspaceMembership[];
    let savedWeddingId: string | null;
    try {
      [memberships, savedWeddingId] = await Promise.all([
        loadActiveMemberships(accountId),
        readSelectedWeddingId(accountId),
      ]);
    } catch {
      if (!requests.current.isCurrent(request) || accountIdRef.current !== accountId) {
        throw new WorkspaceRefreshError();
      }
      const latest = snapshotRef.current;
      const retainVerifiedAccount = latest.accountId === accountId;
      commit({
        accountId,
        phase: "error",
        memberships: retainVerifiedAccount ? latest.memberships : [],
        selectedWeddingId: retainVerifiedAccount ? latest.selectedWeddingId : null,
        membershipLost: retainVerifiedAccount ? latest.membershipLost : false,
        error: "We couldn't load your Wedding workspaces. Check your connection and try again.",
        cacheRevision: latest.cacheRevision,
      });
      throw new WorkspaceRefreshError();
    }

    if (!requests.current.isCurrent(request) || accountIdRef.current !== accountId) {
      throw new WorkspaceRefreshError();
    }

    const activeMembership = preferredWeddingId
      ? findActiveMembership(memberships, preferredWeddingId)
      : null;
    const previousSelectedId = sameAccount ? previous.selectedWeddingId : null;
    const restorePlan = planWorkspaceRestoration({
      accountChanged: !sameAccount,
      memberships,
      savedWeddingId,
      previousWeddingId: previousSelectedId,
    });
    const selectedWeddingId = activeMembership?.weddingId ?? restorePlan.selectedWeddingId;
    const membershipLost = restorePlan.membershipLost;
    const cacheRevision = sameAccount
      ? nextWorkspaceCacheRevision(previous.cacheRevision, previousSelectedId, selectedWeddingId)
      : starting.cacheRevision;

    commit({
      accountId,
      phase: "ready",
      memberships,
      selectedWeddingId,
      membershipLost,
      error: null,
      cacheRevision,
    });
    await storeSelectedWeddingId(accountId, selectedWeddingId);

    if (!requests.current.isCurrent(request) || accountIdRef.current !== accountId) {
      throw new WorkspaceRefreshError();
    }
    if (preferredWeddingId && !activeMembership) throw new WorkspaceMembershipLostError();
    return memberships;
  }, [accountId, commit]);

  useEffect(() => {
    if (!accountId) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && accountIdRef.current === accountId) {
        void refreshMemberships().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [accountId, refreshMemberships]);

  useEffect(() => {
    if (accessLoading || accessError) return;
    if (!accountId) {
      const previous = snapshotRef.current;
      requests.current.invalidate();
      commit({
        ...initialSnapshot,
        phase: "ready",
        cacheRevision: previous.cacheRevision + (previous.accountId || previous.selectedWeddingId ? 1 : 0),
      });
      void clearStoredSelection(previous.accountId);
      return;
    }

    let active = true;
    const request = requests.current.begin();
    const previous = snapshotRef.current;
    if (previous.accountId !== accountId && previous.accountId) void clearStoredSelection(previous.accountId);
    const starting: WorkspaceSnapshot = previous.accountId === accountId
      ? { ...previous, phase: "loading", error: null }
      : {
        accountId,
        phase: "loading",
        memberships: [],
        selectedWeddingId: null,
        membershipLost: false,
        error: null,
        cacheRevision: previous.cacheRevision + 1,
      };
    commit(starting);

    void (async () => {
      let memberships: WorkspaceMembership[];
      let savedWeddingId: string | null;
      try {
        [memberships, savedWeddingId] = await Promise.all([
          loadActiveMemberships(accountId),
          readSelectedWeddingId(accountId),
        ]);
      } catch {
        if (!active || !requests.current.isCurrent(request) || accountIdRef.current !== accountId) return;
        const latest = snapshotRef.current;
        const retainVerifiedAccount = latest.accountId === accountId;
        commit({
          accountId,
          phase: "error",
          memberships: retainVerifiedAccount ? latest.memberships : [],
          selectedWeddingId: retainVerifiedAccount ? latest.selectedWeddingId : null,
          membershipLost: retainVerifiedAccount ? latest.membershipLost : false,
          error: "We couldn't load your Wedding workspaces. Check your connection and try again.",
          cacheRevision: latest.cacheRevision,
        });
        return;
      }

      if (!active || !requests.current.isCurrent(request) || accountIdRef.current !== accountId) return;
      const previousSelectedId = previous.accountId === accountId ? previous.selectedWeddingId : null;
      const restorePlan = planWorkspaceRestoration({
        accountChanged: previous.accountId !== accountId,
        memberships,
        savedWeddingId,
        previousWeddingId: previousSelectedId,
      });
      const selectedWeddingId = restorePlan.selectedWeddingId;
      const membershipLost = restorePlan.membershipLost;
      const cacheRevision = previous.accountId === accountId
        ? nextWorkspaceCacheRevision(previous.cacheRevision, previousSelectedId, selectedWeddingId)
        : starting.cacheRevision;

      commit({
        accountId,
        phase: "ready",
        memberships,
        selectedWeddingId,
        membershipLost,
        error: null,
        cacheRevision,
      });
      await storeSelectedWeddingId(accountId, selectedWeddingId);
    })();

    return () => {
      active = false;
      requests.current.invalidate();
    };
  }, [accessError, accessLoading, accountId, sessionRevision, commit]);

  const currentMemberships = workspaceMembershipsForAccount(snapshot, accountId);
  const currentSelectedWeddingId = workspaceSelectionForAccount(snapshot, accountId);
  const currentStatus = workspaceRestorationStatus({
    accessLoading,
    accessError,
    accountId,
    snapshot,
  });
  const currentError = accessError ?? (accountId && snapshot.accountId === accountId ? snapshot.error : null);

  const membershipFor = useCallback(
    (weddingId: string) => findActiveMembership(currentMemberships, weddingId),
    [currentMemberships],
  );

  const setSelectedWedding = useCallback((weddingId: string) => {
    const membership = findActiveMembership(currentMemberships, weddingId);
    if (!membership || !accountId) throw new WorkspaceMembershipLostError();
    const current = snapshotRef.current;
    if (current.accountId !== accountId) throw new WorkspaceMembershipLostError();
    if (current.selectedWeddingId !== weddingId) {
      requests.current.invalidate();
      commit({
        ...current,
        phase: "ready",
        selectedWeddingId: weddingId,
        membershipLost: false,
        error: null,
        cacheRevision: nextWorkspaceCacheRevision(current.cacheRevision, current.selectedWeddingId, weddingId),
      });
      void storeSelectedWeddingId(accountId, weddingId);
    }
    return membership;
  }, [accountId, commit, currentMemberships]);

  const activateWedding = useCallback(async (weddingId: string) => {
    const activeMemberships = await refreshMemberships(weddingId);
    const membership = findActiveMembership(activeMemberships, weddingId);
    if (!membership) throw new WorkspaceMembershipLostError();
    return membership;
  }, [refreshMemberships]);

  const clearForLogout = useCallback(async () => {
    const previous = snapshotRef.current;
    requests.current.invalidate();
    commit({
      accountId,
      phase: "loading",
      memberships: [],
      selectedWeddingId: null,
      membershipLost: false,
      error: null,
      cacheRevision: previous.cacheRevision + (previous.selectedWeddingId || previous.memberships.length ? 1 : 0),
    });
    await clearStoredSelection(accountId);
  }, [accountId, commit]);

  const selectedMembership = currentSelectedWeddingId ? membershipFor(currentSelectedWeddingId) : null;
  const value = useMemo<WorkspaceContextValue>(() => ({
    status: currentStatus,
    loading: currentStatus === "AUTH_LOADING" || currentStatus === "AUTHENTICATED_WORKSPACE_LOADING",
    error: currentError,
    memberships: currentMemberships,
    selectedWeddingId: currentSelectedWeddingId,
    selectedMembership,
    membershipLost: accountId && snapshot.accountId === accountId ? snapshot.membershipLost : false,
    sessionRevision,
    cacheRevision: snapshot.cacheRevision,
    membershipFor,
    setSelectedWedding,
    activateWedding,
    refreshMemberships,
    clearForLogout,
  }), [
    currentStatus, currentError, currentMemberships, currentSelectedWeddingId, selectedMembership,
    accountId, snapshot.accountId, snapshot.membershipLost, snapshot.cacheRevision, sessionRevision,
    membershipFor, setSelectedWedding, activateWedding, refreshMemberships, clearForLogout,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceProvider is missing.");
  return value;
}
