import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";
import { colorTokens as c, spacingTokens as s } from "@katipan/ui";
import { EditorialCard, EmptyState, ErrorState, FormField, KatipanButton, KatipanScreen, KatipanText, LoadingState, SectionHeader, StatusChip } from "../ui";
import { formatTime, useWeddingDayRoute, WeddingDayHeader } from "../wedding-day/components";
import { changeRunStatus, deleteRunItem, loadRun, saveRunItem, setResponsibleMember } from "./api";
import DateTimeField from "./DateTimeField";
import { canManageRun, runStatusLabel, safeRunError, SubmitGate, type RunData, type RunDraft, type RunItem, type RunStatus } from "./model";

export default function RunItemScreen({ create = false }: { create?: boolean }) {
  const { itemId: rawItemId } = useLocalSearchParams<{ itemId?: string | string[] }>();
  const itemId = create ? null : Array.isArray(rawItemId) ? rawItemId[0] ?? null : rawItemId ?? null;
  const { weddingId, membership, isCurrent, workspace, router } = useWeddingDayRoute();
  const [revision, setRevision] = useState(0);
  const [load, setLoad] = useState<{ key: string; data: RunData | null; failed: boolean } | null>(null);
  const [draftState, setDraftState] = useState<{ identity: string; value: RunDraft } | null>(null);
  const [initialStart] = useState(() => new Date().toISOString());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const gate = useRef(new SubmitGate());
  const key = `${weddingId}:${membership?.membershipId ?? "none"}:${workspace.cacheRevision}:${itemId ?? "new"}:${revision}`;
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (isCurrent && membership) void loadRun(membership)
      .then(data => { if (alive) setLoad({ key, data, failed: false }); })
      .catch(() => { if (alive) setLoad({ key, data: null, failed: true }); });
    return () => { alive = false; };
  }, [isCurrent, membership, key]));
  const item = load?.key === key ? load.data?.items.find(row => row.id === itemId) ?? null : null;
  const identity = `${weddingId}:${itemId ?? "new"}`;
  const draft: RunDraft = draftState?.identity === identity ? draftState.value : item ? draftFromItem(item) : {
    title: "", description: "", scheduledStart: initialStart, scheduledEnd: null,
    actualStart: null, actualEnd: null, sortOrder: 0, placeId: null,
  };
  const back = () => router.navigate({ pathname: "/(wedding)/[weddingId]/plan/run-of-show", params: { weddingId } } as unknown as Href);
  const refresh = () => setRevision(n => n + 1);
  async function perform(action: () => Promise<void>) {
    await gate.current.run(async () => {
      setBusy(true); setError(null);
      try { await action(); setDraftState(null); refresh(); }
      catch (cause) { setError(safeRunError(cause)); }
      finally { setBusy(false); }
    });
  }
  if (workspace.loading || (isCurrent && membership && load?.key !== key)) return <KatipanScreen><LoadingState label="Loading operational item…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (load?.failed || !load?.data) return <KatipanScreen><ErrorState title="Run of Show unavailable" onRetry={refresh} /></KatipanScreen>;
  if (!create && !item) return <KatipanScreen><ErrorState title="Item unavailable in this Wedding" onRetry={back} /></KatipanScreen>;
  const data = load.data;
  const canEdit = canManageRun(membership);
  const set = <K extends keyof RunDraft>(field: K, value: RunDraft[K]) => setDraftState({ identity, value: { ...draft, [field]: value } });
  const linked = data.guestLinks.filter(link => link.operational_item_id === itemId);
  return <KatipanScreen contentContainerStyle={styles.page}>
    <KatipanButton label="Back to Run of Show" variant="text" onPress={back} />
    <WeddingDayHeader membership={membership} title={create ? "Add Run of Show Item" : item?.title ?? "Run of Show Item"}
      description="Operational team timing and responsibilities" />
    {!!item && <EditorialCard style={styles.summary}>
      <View style={styles.row}><StatusChip label={runStatusLabel(item.status)} tone={item.status === "DELAYED" ? "warning" : item.status === "IN_PROGRESS" ? "success" : "neutral"} />
        <KatipanText variant="labelCaps" color="secondary">OPERATIONAL ONLY</KatipanText></View>
      <KatipanText>Scheduled {formatTime(item.scheduled_start)}{item.scheduled_end ? ` – ${formatTime(item.scheduled_end)}` : ""}</KatipanText>
      {!!item.actual_start && <KatipanText color="textMuted">Actual {formatTime(item.actual_start)}{item.actual_end ? ` – ${formatTime(item.actual_end)}` : ""}</KatipanText>}
      {item.status === "DELAYED" && <KatipanText color="secondary">Review later items individually. Their times stay as scheduled.</KatipanText>}
    </EditorialCard>}
    {!!error && <EditorialCard accessibilityRole="alert" style={styles.alert}><KatipanText color="error">{error}</KatipanText></EditorialCard>}
    {canEdit ? <EditorialCard style={styles.form}>
      <SectionHeader title={create ? "Item Details" : "Edit Item"} description="Saved times are local selections stored with their UTC offset." />
      <FormField label="Title" value={draft.title} onChangeText={value => set("title", value)} editable={!busy} />
      <FormField label="Description" value={draft.description} onChangeText={value => set("description", value)} editable={!busy} multiline />
      <DateTimeField label="Scheduled Start" value={draft.scheduledStart} onChange={value => set("scheduledStart", value)} disabled={busy} />
      <OptionalTime label="Scheduled End" value={draft.scheduledEnd} onChange={value => set("scheduledEnd", value)} onClear={() => set("scheduledEnd", null)} disabled={busy} />
      <OptionalTime label="Actual Start" value={draft.actualStart} onChange={value => set("actualStart", value)} onClear={() => set("actualStart", null)} disabled={busy} />
      <OptionalTime label="Actual End" value={draft.actualEnd} onChange={value => set("actualEnd", value)} onClear={() => set("actualEnd", null)} disabled={busy} />
      <FormField label="Order among items at the same time" keyboardType="number-pad" value={String(draft.sortOrder)}
        onChangeText={value => set("sortOrder", Number(value))} editable={!busy} />
      <KatipanText variant="labelLarge">Place</KatipanText>
      <View style={styles.choices}>
        <Choice label="No place" selected={!draft.placeId} disabled={busy} onPress={() => set("placeId", null)} />
        {data.places.map(place => <Choice key={place.id} label={place.name} selected={draft.placeId === place.id} disabled={busy} onPress={() => set("placeId", place.id)} />)}
      </View>
      <KatipanButton label={create ? "Create Item" : "Save Item"} loading={busy} onPress={() => void perform(async () => {
        const savedId = await saveRunItem(membership, draft, itemId ?? undefined);
        if (create) router.replace({ pathname: "/(wedding)/[weddingId]/plan/run-of-show/[itemId]", params: { weddingId, itemId: savedId } } as unknown as Href);
      })} />
    </EditorialCard> : !!item && <EditorialCard><EmptyState title="Read-only operational item" description="Your Wedding role can view this timeline. An Owner or operational coordinator can change it." /></EditorialCard>}
    {!!item && <>
      {canEdit && <EditorialCard style={styles.form}>
        <SectionHeader title="Status" description="Each status change is intentional. Scheduled times and later items stay unchanged." />
        <View style={styles.choices}>
          {(["UPCOMING", "IN_PROGRESS", "COMPLETED", "DELAYED", "SKIPPED", "CANCELLED"] as RunStatus[]).filter(status => status !== item.status).map(status =>
            <KatipanButton key={status} label={status === "IN_PROGRESS" ? "Start & Record Actual Time" : status === "COMPLETED" ? "Complete & Record Actual Time" : `Mark ${runStatusLabel(status)}`}
              variant={status === "IN_PROGRESS" || status === "COMPLETED" ? "primary" : "secondary"} disabled={busy}
              onPress={() => void perform(() => changeRunStatus(membership, item.id, status, status === "IN_PROGRESS" || status === "COMPLETED"))} />)}
        </View>
      </EditorialCard>}
      <EditorialCard style={styles.form}>
        <SectionHeader title="Responsible Team" description="Active members of this Wedding" />
        {data.members.length === 0 ? <KatipanText color="textMuted">No active team members available.</KatipanText> : data.members.map(member => {
          const assigned = data.assignments.some(a => a.itemId === item.id && a.membershipId === member.id);
          return <View key={member.id} style={styles.member}><View style={styles.memberCopy}>
            <KatipanText variant="labelLarge">{member.name}</KatipanText><KatipanText variant="bodySmall" color="textMuted">{runStatusLabel(member.role)}</KatipanText>
          </View>{canEdit ? <KatipanButton label={assigned ? "Remove" : "Assign"} variant="secondary" disabled={busy}
            onPress={() => void perform(() => setResponsibleMember(membership, item.id, member.id, !assigned))} /> : assigned ? <StatusChip label="Responsible" /> : null}</View>;
        })}
      </EditorialCard>
      {linked.map(link => <EditorialCard key={link.id} style={[styles.form, link.review_required && styles.alert]}>
        <SectionHeader title="Linked Guest Program" description={link.title} />
        <View style={styles.row}><StatusChip label={link.is_published ? "Published" : "Draft"} tone={link.is_published ? "success" : "neutral"} />
          {link.review_required && <StatusChip label="Review Required" tone="warning" />}</View>
        <KatipanText color="textMuted">Guest-facing {formatTime(link.scheduled_start)}{link.scheduled_end ? ` – ${formatTime(link.scheduled_end)}` : ""}. Operational changes do not copy automatically.</KatipanText>
        <KatipanButton label="Open Guest Program Item" variant="secondary" onPress={() => router.push({ pathname: "/(wedding)/[weddingId]/website/program/[itemId]", params: { weddingId, itemId: link.id } } as unknown as Href)} />
      </EditorialCard>)}
      {canEdit && <EditorialCard style={styles.form}>
        <SectionHeader title="Remove Item" description="Linked Guest Program items retain their own published schedule." />
        {confirmDelete ? <><KatipanText>Delete this operational item?</KatipanText><KatipanButton label="Confirm Delete" variant="secondary" disabled={busy} onPress={() => void perform(async () => { await deleteRunItem(membership, item.id); back(); })} /><KatipanButton label="Cancel" variant="text" onPress={() => setConfirmDelete(false)} /></>
          : <KatipanButton label="Delete Item" variant="secondary" onPress={() => setConfirmDelete(true)} />}
      </EditorialCard>}
    </>}
  </KatipanScreen>;
}
function draftFromItem(item: RunItem): RunDraft { return { title: item.title, description: item.description ?? "", scheduledStart: item.scheduled_start,
  scheduledEnd: item.scheduled_end, actualStart: item.actual_start, actualEnd: item.actual_end, sortOrder: item.sort_order, placeId: item.place_id }; }
function OptionalTime({ label, value, onChange, onClear, disabled }: { label: string; value: string | null; onChange: (value: string) => void; onClear: () => void; disabled: boolean }) {
  return <View style={styles.optional}><DateTimeField label={label} value={value} onChange={onChange} disabled={disabled} />
    {value && <KatipanButton label={`Clear ${label}`} variant="text" disabled={disabled} onPress={onClear} />}</View>;
}
function Choice({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return <KatipanButton label={`${selected ? "✓ " : ""}${label}`} variant={selected ? "primary" : "secondary"} disabled={disabled} onPress={onPress} />;
}
const styles = StyleSheet.create({
  page: { gap: s.large, paddingBottom: s.extraLarge }, form: { gap: s.medium, backgroundColor: c.surfaceLowest },
  summary: { gap: s.small, backgroundColor: c.surfaceLow }, alert: { gap: s.medium, borderColor: c.champagne, backgroundColor: c.softBeige },
  row: { flexDirection: "row", justifyContent: "space-between", gap: s.small, alignItems: "center" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: s.small }, optional: { gap: s.micro },
  member: { flexDirection: "row", alignItems: "center", gap: s.small, justifyContent: "space-between" }, memberCopy: { flex: 1 },
});
