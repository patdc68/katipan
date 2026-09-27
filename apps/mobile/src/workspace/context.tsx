import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useAccess } from "../onboarding/provider";
import { loadActiveMemberships } from "./api";
import {
  findActiveMembership,
  nextWorkspaceCacheRevision,
  resolveRestoredSelection,
  type WorkspaceMembership,
} from "./model";

const SELECTED_WEDDING_KEY = "katipan.selected-wedding-id";

async function readSelectedWeddingId(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(SELECTED_WEDDING_KEY) ?? null;
    return await SecureStore.getItemAsync(SELECTED_WEDDING_KEY);
  } catch {
    return null;
  }
}

async function storeSelectedWeddingId(weddingId: string | null): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (weddingId) globalThis.localStorage?.setItem(SELECTED_WEDDING_KEY, weddingId);
      else globalThis.localStorage?.removeItem(SELECTED_WEDDING_KEY);
    } else if (weddingId) {
      await SecureStore.setItemAsync(SELECTED_WEDDING_KEY, weddingId);
    } else {
      await SecureStore.deleteItemAsync(SELECTED_WEDDING_KEY);
    }
  } catch {
    // The selected Wedding is an optional convenience; RLS-backed restore remains authoritative.
  }
}

type WorkspaceContextValue = {
  loading: boolean;
  error: string | null;
  memberships: WorkspaceMembership[];
  selectedWeddingId: string | null;
  selectedMembership: WorkspaceMembership | null;
  cacheRevision: number;
  membershipFor: (weddingId: string) => WorkspaceMembership | null;
  setSelectedWedding: (weddingId: string) => WorkspaceMembership;
  activateWedding: (weddingId: string) => Promise<WorkspaceMembership>;
  refreshMemberships: (preferredWeddingId?: string) => Promise<WorkspaceMembership[]>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { session, loading: accessLoading } = useAccess();
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [membershipsUserId, setMembershipsUserId] = useState<string | null>(null);
  const [selectedWeddingId, setSelectedWeddingId] = useState<string | null>(null);
  const [cacheRevision, setCacheRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorUserId, setErrorUserId] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const userId = session?.user.id ?? null;
    if (accessLoading) return () => { current = false; };
    if (!userId) {
      void Promise.resolve().then(() => {
        if (!current) return;
        setMemberships([]);
        setMembershipsUserId(null);
        setSelectedWeddingId(null);
        setCacheRevision((revision) => revision + 1);
        setError(null);
        setErrorUserId(null);
        setLoading(false);
        void storeSelectedWeddingId(null);
      });
      return () => { current = false; };
    }

    void Promise.resolve().then(async () => {
      if (!current) return;
      setLoading(true);
      setError(null);
      setErrorUserId(userId);
      try {
        const [activeMemberships, savedId] = await Promise.all([loadActiveMemberships(userId), readSelectedWeddingId()]);
        if (!current) return;
        const selection = resolveRestoredSelection(savedId, activeMemberships);
        setMemberships(activeMemberships);
        setMembershipsUserId(userId);
        setSelectedWeddingId(selection);
        setCacheRevision((revision) => revision + 1);
        void storeSelectedWeddingId(selection);
      } catch {
        if (!current) return;
        setMemberships([]);
        setMembershipsUserId(userId);
        setSelectedWeddingId(null);
        setError("We couldn't load your Wedding workspaces. Check your connection and try again.");
        setErrorUserId(userId);
      } finally {
        if (current) setLoading(false);
      }
    });
    return () => { current = false; };
  }, [accessLoading, session?.user.id]);

  const sessionUserId = session?.user.id ?? null;
  const dataBelongsToSession = Boolean(sessionUserId && membershipsUserId === sessionUserId);
  const currentMemberships = useMemo(() => dataBelongsToSession ? memberships : [], [dataBelongsToSession, memberships]);
  const currentSelectedWeddingId = dataBelongsToSession ? selectedWeddingId : null;
  const currentError = errorUserId === sessionUserId ? error : null;
  const currentLoading = accessLoading || Boolean(sessionUserId && (!dataBelongsToSession || loading));

  const membershipFor = useCallback(
    (weddingId: string) => findActiveMembership(currentMemberships, weddingId),
    [currentMemberships],
  );

  const refreshMemberships = useCallback(async (preferredWeddingId?: string) => {
    const userId = session?.user.id;
    if (!userId) throw new Error("A signed-in account is required.");
    setLoading(true);
    setError(null);
    try {
      const activeMemberships = await loadActiveMemberships(userId);
      const savedId = preferredWeddingId ?? await readSelectedWeddingId();
      const selection = preferredWeddingId
        ? findActiveMembership(activeMemberships, preferredWeddingId)?.weddingId ?? null
        : resolveRestoredSelection(savedId, activeMemberships);
      setMemberships(activeMemberships);
      setMembershipsUserId(userId);
      if (preferredWeddingId && !selection) {
        setSelectedWeddingId(null);
        setCacheRevision((revision) => revision + 1);
        await storeSelectedWeddingId(null);
        throw new Error("Wedding membership is no longer active.");
      }
      setSelectedWeddingId(selection);
      setCacheRevision((revision) => revision + 1);
      setError(null);
      setErrorUserId(userId);
      await storeSelectedWeddingId(selection);
      return activeMemberships;
    } catch {
      setError("We couldn't verify that Wedding workspace. Refresh your memberships and try again.");
      setErrorUserId(userId);
      setMembershipsUserId(userId);
      setMemberships([]);
      setSelectedWeddingId(null);
      throw new Error("Wedding membership could not be verified.");
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  const activateWedding = useCallback(async (weddingId: string) => {
    const activeMemberships = await refreshMemberships(weddingId);
    const membership = findActiveMembership(activeMemberships, weddingId);
    if (!membership) throw new Error("Wedding membership could not be verified.");
    return membership;
  }, [refreshMemberships]);

  const setSelectedWedding = useCallback((weddingId: string) => {
    const membership = findActiveMembership(currentMemberships, weddingId);
    if (!membership) throw new Error("Wedding membership is unavailable.");
    if (currentSelectedWeddingId !== weddingId) setCacheRevision((revision) => nextWorkspaceCacheRevision(revision, currentSelectedWeddingId, weddingId));
    setSelectedWeddingId(weddingId);
    void storeSelectedWeddingId(weddingId);
    return membership;
  }, [currentMemberships, currentSelectedWeddingId]);

  const selectedMembership = currentSelectedWeddingId ? membershipFor(currentSelectedWeddingId) : null;
  const value = useMemo<WorkspaceContextValue>(() => ({
    loading: currentLoading,
    error: currentError,
    memberships: currentMemberships,
    selectedWeddingId: currentSelectedWeddingId,
    selectedMembership,
    cacheRevision,
    membershipFor,
    setSelectedWedding,
    activateWedding,
    refreshMemberships,
  }), [
    currentLoading, currentError, currentMemberships, currentSelectedWeddingId, selectedMembership, cacheRevision,
    membershipFor, setSelectedWedding, activateWedding, refreshMemberships,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceProvider is missing.");
  return value;
}
