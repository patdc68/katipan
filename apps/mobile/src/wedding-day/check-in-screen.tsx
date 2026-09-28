import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Modal, StyleSheet, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as Crypto from "expo-crypto";
import { useFocusEffect, type Href } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import {
  CheckInGuestRow,
  CheckInResultCard,
  FilterPill,
  ReversalResultCard,
  WeddingDayHeader,
  WeddingDayScreenHeader,
  useWeddingDayRoute,
} from "./components";
import {
  checkInGuestManually,
  createManualCheckInAction,
  loadWeddingDayCheckInRoster,
  reverseWeddingDayCheckIn,
  syncQueuedManualCheckIns,
  type CheckInRosterSnapshot,
  type QueuedSyncResult,
} from "./api";
import { filterWeddingDayGuests, type CheckInFilter, type ManualCheckInAction, type WeddingDayCheckInResult, type WeddingDayGuest, type WeddingDayReversalResult } from "./model";
import { EditorialCard, EmptyState, ErrorState, FormField, KatipanButton, KatipanScreen, KatipanText, LoadingState } from "../ui";

type LoadState = { requestId: string; snapshot: CheckInRosterSnapshot | null; failed: boolean };
type ReverseAction = { guestId: string; clientEventId: string; reason?: string };

export function GuestCheckInScreen() {
  const { weddingId, router, workspace, membership, isCurrent } = useWeddingDayRoute();
  const [retryCount, setRetryCount] = useState(0);
  const [load, setLoad] = useState<LoadState | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CheckInFilter>("ALL");
  const [checkInResult, setCheckInResult] = useState<WeddingDayCheckInResult | null>(null);
  const [queued, setQueued] = useState(false);
  const [reversalResult, setReversalResult] = useState<WeddingDayReversalResult | null>(null);
  const [activeGuestId, setActiveGuestId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<WeddingDayGuest | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [reversing, setReversing] = useState(false);
  const [reverseActionId, setReverseActionId] = useState<string | null>(null);
  const manualActions = useRef(new Map<string, ManualCheckInAction>());
  const reverseAction = useRef<ReverseAction | null>(null);
  const refreshActive = useRef(false);
  const scopeKey = `${weddingId}:${membership?.membershipId ?? "none"}:${workspace.selectedWeddingId ?? "none"}:${workspace.cacheRevision}`;
  const scopeRef = useRef(scopeKey);
  const requestId = `${weddingId}:${membership?.membershipId ?? "none"}:${workspace.cacheRevision}:${retryCount}`;

  useEffect(() => {
    if (scopeRef.current === scopeKey) return;
    scopeRef.current = scopeKey;
    setLoad(null);
    setSearch("");
    setFilter("ALL");
    setCheckInResult(null);
    setQueued(false);
    setReversalResult(null);
    setActiveGuestId(null);
    setActionError(null);
    setReverseTarget(null);
    setReverseReason("");
    setReverseError(null);
    setReversing(false);
    setReverseActionId(null);
    manualActions.current.clear();
    reverseAction.current = null;
  }, [scopeKey]);

  const refresh = useCallback(async (): Promise<QueuedSyncResult | null> => {
    if (!isCurrent || !membership || refreshActive.current) return null;
    refreshActive.current = true;
    setSyncing(true);
    try {
      const sync = await syncQueuedManualCheckIns(membership);
      for (const outcome of sync.outcomes) manualActions.current.delete(outcome.guestId);
      const snapshot = await loadWeddingDayCheckInRoster(membership);
      setLoad({ requestId, snapshot, failed: false });
      return sync;
    } catch {
      setLoad({ requestId, snapshot: null, failed: true });
      return null;
    } finally {
      refreshActive.current = false;
      setSyncing(false);
    }
  }, [isCurrent, membership, requestId]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === true && state.isInternetReachable !== false) void refresh();
    });
    return unsubscribe;
  }, [refresh]);

  const currentLoad = load?.requestId === requestId ? load : null;
  const snapshot = currentLoad?.snapshot ?? null;
  const guests = snapshot ? filterWeddingDayGuests(snapshot.guests, search, filter) : [];
  const queuedIds = new Set(snapshot?.queuedGuestIds ?? []);
  const syncNow = async () => {
    if (!membership) return;
    const operationScope = scopeKey;
    setActionError(null);
    const sync = await refresh();
    if (scopeRef.current !== operationScope) return;
    if (!sync) setActionError("Pending manual check-ins could not sync. The same action IDs remain saved for retry.");
    else if (sync.offline) setActionError("This device is offline. Pending manual check-ins remain saved and QR scans are not verified offline.");
    else if (sync.remaining > 0) setActionError(`${sync.remaining} manual check-in action${sync.remaining === 1 ? "" : "s"} still need server confirmation.`);
    else setActionError("Pending manual check-ins are synced.");
  };

  const submitManualCheckIn = async (guest: WeddingDayGuest) => {
    if (!membership || activeGuestId) return;
    const operationScope = scopeKey;
    setActiveGuestId(guest.guestId);
    setActionError(null);
    setCheckInResult(null);
    setReversalResult(null);
    setQueued(false);
    const action = manualActions.current.get(guest.guestId) ?? createManualCheckInAction(membership, guest.guestId);
    manualActions.current.set(guest.guestId, action);
    try {
      const outcome = await checkInGuestManually(membership, action);
      if (scopeRef.current !== operationScope) return;
      if (outcome.kind === "RESULT") {
        manualActions.current.delete(guest.guestId);
        setCheckInResult(outcome.result);
      } else setQueued(true);
      const sync = await refresh();
      if (scopeRef.current !== operationScope) return;
      if (outcome.kind === "QUEUED") {
        const confirmation = sync?.outcomes.find((item) => item.clientEventId === action.clientEventId);
        if (confirmation) {
          manualActions.current.delete(guest.guestId);
          setQueued(false);
          setCheckInResult(confirmation.result);
        }
      }
    } catch (error) {
      if (scopeRef.current !== operationScope) return;
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      setActionError(code === "OFFLINE_ROSTER_MISSING"
        ? "This Guest is not in the cached roster. Connect and refresh the Wedding-Day list before checking in offline."
        : "Manual check-in could not be confirmed. Refresh the Guest list and try again.");
    } finally {
      setActiveGuestId(null);
    }
  };

  const beginReversal = (guest: WeddingDayGuest) => {
    setReverseTarget(guest);
    setReverseReason("");
    setReverseError(null);
    setReverseActionId(null);
    reverseAction.current = null;
  };

  const cancelReversal = () => {
    if (reverseAction.current || reversing) return;
    setReverseTarget(null);
    setReverseReason("");
    setReverseError(null);
  };

  const confirmReversal = async () => {
    if (!membership || !reverseTarget || reversing) return;
    const operationScope = scopeKey;
    const action = reverseAction.current ?? {
      guestId: reverseTarget.guestId,
      clientEventId: Crypto.randomUUID(),
      ...(reverseReason.trim() ? { reason: reverseReason.trim() } : {}),
    };
    reverseAction.current = action;
    setReverseActionId(action.clientEventId);
    setReversing(true);
    setReverseError(null);
    try {
      const result = await reverseWeddingDayCheckIn(membership, action.guestId, action.clientEventId, action.reason);
      if (scopeRef.current !== operationScope) return;
      setReversalResult(result);
      setCheckInResult(null);
      setReverseTarget(null);
      setReverseReason("");
      setReverseActionId(null);
      manualActions.current.delete(action.guestId);
      reverseAction.current = null;
      await refresh();
    } catch {
      if (scopeRef.current !== operationScope) return;
      setReverseError("The reversal could not be confirmed. Retry this same reversal to preserve its event ID.");
    } finally {
      setReversing(false);
    }
  };

  if (workspace.loading || (isCurrent && membership && !currentLoad)) {
    return <KatipanScreen><LoadingState label="Loading Guest Check-In…" /></KatipanScreen>;
  }
  if (!isCurrent || !membership) {
    return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  }
  if (currentLoad?.failed || !snapshot) {
    return <KatipanScreen><ErrorState title="Guest Check-In unavailable" description="Connect to load this Wedding's Guest roster. Previously cached rosters are available when this device is offline." onRetry={() => setRetryCount((value) => value + 1)} /></KatipanScreen>;
  }

  const openScanner = () => router.push({ pathname: "/(wedding)/[weddingId]/day/scan", params: { weddingId } } as unknown as Href);
  const listHeader = (
    <View style={styles.listHeader}>
      <WeddingDayScreenHeader title="Guest Check-In" onBack={() => router.back()} />
      <View style={styles.actionRow}>
        <KatipanButton label="Scan Guest Pass" onPress={openScanner} />
        <KatipanButton label="Refresh List" variant="secondary" loading={syncing} onPress={() => void refresh()} />
      </View>
      <FormField
        label="Search Guests"
        value={search}
        onChangeText={setSearch}
        placeholder="Guest or Household name"
        autoCapitalize="words"
        returnKeyType="search"
      />
      <View style={styles.filterRow} accessibilityLabel="Check-in state filter">
        <FilterPill label="All Guests" selected={filter === "ALL"} onPress={() => setFilter("ALL")} />
        <FilterPill label="Checked In" selected={filter === "CHECKED_IN"} onPress={() => setFilter("CHECKED_IN")} />
        <FilterPill label="Not Checked In" selected={filter === "NOT_CHECKED_IN"} onPress={() => setFilter("NOT_CHECKED_IN")} />
      </View>
      {snapshot.source === "OFFLINE_CACHE" && (
        <EditorialCard style={styles.offlineNotice} accessibilityRole="summary">
          <KatipanText variant="title">Offline roster</KatipanText>
          <KatipanText color="textMuted">Only the cached Guest name, Household, RSVP, and last known check-in state are shown. Manual actions queue for server confirmation. QR passes cannot be verified offline.</KatipanText>
        </EditorialCard>
      )}
      {snapshot.pendingActionCount > 0 && (
        <EditorialCard style={styles.pendingNotice} accessibilityRole="summary">
          <KatipanText variant="title">{snapshot.pendingActionCount} manual check-in action{snapshot.pendingActionCount === 1 ? "" : "s"} pending</KatipanText>
          <KatipanText color="textMuted">The server has not confirmed these Guests yet.</KatipanText>
          <KatipanButton label="Sync Pending Check-Ins" variant="secondary" loading={syncing} onPress={() => void syncNow()} />
        </EditorialCard>
      )}
      {!!actionError && <ErrorState title="Check-In update" description={actionError} />}
      <CheckInResultCard result={checkInResult} queued={queued} />
      <ReversalResultCard result={reversalResult} />
      <WeddingDayHeader membership={membership} title="Guest List" description="Each check-in belongs to one Guest. RSVP and seating remain unchanged." />
    </View>
  );

  return (
    <KatipanScreen scroll={false} padded={false} contentContainerStyle={styles.listPage}>
      <FlatList
        data={guests}
        keyExtractor={(guest) => guest.guestId}
        renderItem={({ item }) => (
          <CheckInGuestRow
            guest={item}
            pending={queuedIds.has(item.guestId)}
            disabled={activeGuestId !== null || syncing}
            onCheckIn={() => void submitManualCheckIn(item)}
            onReverse={() => beginReversal(item)}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <EmptyState
            title={search ? "No Guests match this search" : snapshot.guests.length ? "No Guests match this filter" : "No Guests in this Wedding yet"}
            description={snapshot.guests.length ? "Try another name or check-in filter." : "The Guest list is empty. Check-in can be used after Guests are added."}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
      <Modal visible={Boolean(reverseTarget)} transparent animationType="slide" onRequestClose={cancelReversal}>
        <View style={styles.modalBackdrop}>
          <EditorialCard style={styles.modalCard}>
            <KatipanText variant="labelCaps" color="secondary">CHECK-IN HISTORY</KatipanText>
            <KatipanText variant="headlineSmall" accessibilityRole="header">Reverse this check-in?</KatipanText>
            <KatipanText color="textMuted">{reverseTarget?.displayName} · {reverseTarget?.householdName}</KatipanText>
            <KatipanText color="textMuted">This adds a new reversal event. The earlier event stays in history. RSVP, seating, and Guest Pass remain unchanged.</KatipanText>
            <FormField
              label="Reason (optional)"
              value={reverseReason}
              onChangeText={setReverseReason}
              maxLength={500}
              multiline
              editable={!reverseActionId}
              placeholder="Add a note for the check-in record"
              style={styles.reasonInput}
            />
            {!!reverseError && <ErrorState title="Reversal not confirmed" description={reverseError} />}
            <View style={styles.modalActions}>
              {!reverseActionId && <KatipanButton label="Cancel" variant="secondary" disabled={reversing} onPress={cancelReversal} />}
              <KatipanButton label={reverseActionId ? "Retry Reversal" : "Confirm Reversal"} loading={reversing} onPress={() => void confirmReversal()} />
            </View>
          </EditorialCard>
        </View>
      </Modal>
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  listPage: { flex: 1, gap: 0, paddingHorizontal: 0, paddingVertical: 0 },
  listContent: { paddingHorizontal: s.margin, paddingVertical: s.large, paddingBottom: s.extraLarge, flexGrow: 1 },
  listHeader: { gap: s.large, paddingBottom: s.large },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  separator: { height: s.medium },
  offlineNotice: { gap: s.small, backgroundColor: c.surfaceLow },
  pendingNotice: { gap: s.small, borderColor: c.secondary, backgroundColor: c.secondaryFixed },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(30,27,25,0.42)", padding: s.medium },
  modalCard: { gap: s.medium, borderRadius: r.extraLarge, padding: s.cardLarge, backgroundColor: c.background },
  reasonInput: { minHeight: 88, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: s.small },
});
