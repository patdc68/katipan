import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { View } from "react-native";
import { EditorialCard, ErrorState, FormField, KatipanButton, KatipanScreen, KatipanText, LoadingState, StatusChip } from "../ui";
import DateTimeField from "../run-of-show/DateTimeField";
import { formatTime, useWeddingDayRoute } from "../wedding-day/components";
import { createProgramItem, deleteProgramItem, editProgramItem, loadProgram, setProgramPublication } from "./api";
import { ProgramHeader, ProgramSection, programStyles } from "./components";
import { canManageProgram, draftFromItem, safeProgramError, SubmitGate, type ProgramData, type ProgramDraft } from "./model";

function Choice({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return <KatipanButton label={`${selected ? "✓ " : ""}${label}`} variant={selected ? "primary" : "secondary"} disabled={disabled} onPress={onPress} />;
}
export default function GuestProgramItemScreen({ create = false }: { create?: boolean }) {
  const { itemId: rawItemId } = useLocalSearchParams<{ itemId?: string | string[] }>();
  const itemId = create ? null : Array.isArray(rawItemId) ? rawItemId[0] ?? null : rawItemId ?? null;
  const { weddingId, membership, isCurrent, workspace, router } = useWeddingDayRoute();
  const [revision, setRevision] = useState(0);
  const [load, setLoad] = useState<{ key: string; data: ProgramData | null; failed: boolean } | null>(null);
  const [draftState, setDraftState] = useState<{ identity: string; value: ProgramDraft } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSync, setConfirmSync] = useState(false);
  const gate = useRef(new SubmitGate());
  const key = `${weddingId}:${membership?.membershipId ?? "none"}:${workspace.cacheRevision}:${itemId ?? "new"}:${revision}`;
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (isCurrent && membership) void loadProgram(membership)
      .then(data => { if (alive) setLoad({ key, data, failed: false }); })
      .catch(() => { if (alive) setLoad({ key, data: null, failed: true }); });
    return () => { alive = false; };
  }, [isCurrent, membership, key]));
  const item = load?.key === key ? load.data?.items.find(row => row.id === itemId) ?? null : null;
  const identity = `${weddingId}:${workspace.cacheRevision}:${itemId ?? "new"}`;
  const draft: ProgramDraft = draftState?.identity === identity ? draftState.value : item ? draftFromItem(item) :
    { title: "", description: "", scheduledStart: "", scheduledEnd: null, placeId: null, operationalItemId: null, sortOrder: 0 };
  const set = <K extends keyof ProgramDraft>(field: K, value: ProgramDraft[K]) => setDraftState({ identity, value: { ...draft, [field]: value } });
  const back = () => router.navigate({ pathname: "/(wedding)/[weddingId]/website/program", params: { weddingId } } as unknown as Href);
  const refresh = () => setRevision(n => n + 1);
  async function perform(action: () => Promise<void>) {
    await gate.current.run(async () => {
      setBusy(true); setError(null);
      try { await action(); setDraftState(null); setConfirmDelete(false); setConfirmUnpublish(false); setConfirmSync(false); refresh(); }
      catch (cause) { setError(safeProgramError(cause)); }
      finally { setBusy(false); }
    });
  }
  if (workspace.loading || (isCurrent && membership && load?.key !== key)) return <KatipanScreen><LoadingState label="Loading Guest Program item…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (load?.failed || !load?.data) return <KatipanScreen><ErrorState title="Guest Program unavailable" onRetry={refresh} /></KatipanScreen>;
  if (!create && !item) return <KatipanScreen><ErrorState title="Item unavailable in this Wedding" onRetry={back} /></KatipanScreen>;
  const data = load.data;
  const canEdit = canManageProgram(membership);
  const operation = data.operations.find(row => row.id === item?.operational_item_id);
  const selectedOperation = data.operations.find(row => row.id === draft.operationalItemId);
  const scheduleChanged = !!item && (draft.scheduledStart !== item.scheduled_start || draft.scheduledEnd !== item.scheduled_end);
  return <KatipanScreen contentContainerStyle={programStyles.page}>
    <KatipanButton label="Back to Guest Program" variant="text" onPress={back} />
    <ProgramHeader title={create ? "Add Guest Program Item" : item?.title ?? "Guest Program Item"}
      description="Guest-facing details and time are independent of Run of Show." />
    {!!error && <EditorialCard accessibilityRole="alert" style={programStyles.notice}><KatipanText color="error">{error}</KatipanText></EditorialCard>}
    {item && <EditorialCard style={programStyles.notice}>
      <View style={programStyles.choices}><StatusChip label={item.is_published ? "Published" : "Draft"} tone={item.is_published ? "success" : "neutral"} />
        {item.review_required && <StatusChip label="Review Required" tone="warning" />}</View>
      <KatipanText>Current guest schedule: {formatTime(item.scheduled_start)}{item.scheduled_end ? ` – ${formatTime(item.scheduled_end)}` : ""}</KatipanText>
      <KatipanText color="textMuted">{item.is_published ? "Guests can see this item when the website is available." : "Guests cannot see this draft item."}</KatipanText>
    </EditorialCard>}
    {canEdit ? <ProgramSection title={create ? "Item Details" : "Edit Details"} description="Saving details does not publish or change the guest schedule.">
      <FormField label="Title" value={draft.title} onChangeText={value => set("title", value)} editable={!busy} />
      <FormField label="Description" value={draft.description} onChangeText={value => set("description", value)} editable={!busy} multiline />
      {create && <><DateTimeField label="Guest-facing Start" value={draft.scheduledStart || null} onChange={value => set("scheduledStart", value)} disabled={busy} />
        <DateTimeField label="Guest-facing End (optional)" value={draft.scheduledEnd} onChange={value => set("scheduledEnd", value)} disabled={busy} />
        {!!draft.scheduledEnd && <KatipanButton label="Clear End" variant="text" disabled={busy} onPress={() => set("scheduledEnd", null)} />}</>}
      <FormField label="Sort order" keyboardType="number-pad" value={String(draft.sortOrder)} onChangeText={value => set("sortOrder", Number(value))} editable={!busy} />
      <KatipanText variant="labelLarge">Wedding place</KatipanText>
      <View style={programStyles.choices}><Choice label="No place" selected={!draft.placeId} disabled={busy} onPress={() => set("placeId", null)} />
        {data.places.map(place => <Choice key={place.id} label={place.name} selected={draft.placeId === place.id} disabled={busy} onPress={() => set("placeId", place.id)} />)}</View>
      <KatipanText variant="labelLarge">Run of Show link</KatipanText>
      <KatipanText color="textMuted">Linking never synchronizes schedules automatically.</KatipanText>
      <View style={programStyles.choices}><Choice label="Standalone item" selected={!draft.operationalItemId} disabled={busy} onPress={() => set("operationalItemId", null)} />
        {data.operations.map(row => <Choice key={row.id} label={row.title} selected={draft.operationalItemId === row.id} disabled={busy} onPress={() => set("operationalItemId", row.id)} />)}</View>
      <KatipanButton label={create ? "Create Draft Item" : "Save Details"} loading={busy} onPress={() => void perform(async () => {
        if (create) {
          const id = await createProgramItem(membership, draft);
          router.replace({ pathname: "/(wedding)/[weddingId]/website/program/[itemId]", params: { weddingId, itemId: id } } as unknown as Href);
        } else if (itemId) await editProgramItem(membership, itemId, draft);
      })} />
    </ProgramSection> : <EditorialCard><KatipanText color="textMuted">Your Wedding role can view this item. An Owner or Full Coordinator manages the Guest Program.</KatipanText></EditorialCard>}
    {item && canEdit && <ProgramSection title="Guest Schedule" description="Changing guest-facing time requires a separate confirmation.">
      <DateTimeField label="Guest-facing Start" value={draft.scheduledStart || null} onChange={value => set("scheduledStart", value)} disabled={busy} />
      <DateTimeField label="Guest-facing End (optional)" value={draft.scheduledEnd} onChange={value => set("scheduledEnd", value)} disabled={busy} />
      {!!draft.scheduledEnd && <KatipanButton label="Clear End" variant="text" disabled={busy} onPress={() => set("scheduledEnd", null)} />}
      {selectedOperation && <><KatipanText color="textMuted">Linked operational scheduled: {formatTime(selectedOperation.scheduled_start)}{selectedOperation.scheduled_end ? ` – ${formatTime(selectedOperation.scheduled_end)}` : ""}</KatipanText>
        {confirmSync ? <><KatipanText>Proposed guest time: {formatTime(selectedOperation.scheduled_start)}{selectedOperation.scheduled_end ? ` – ${formatTime(selectedOperation.scheduled_end)}` : ""}. This does not update until you confirm below.</KatipanText>
          <KatipanButton label="Use Proposed Time" variant="secondary" onPress={() => { setDraftState({ identity, value: { ...draft, scheduledStart: selectedOperation.scheduled_start, scheduledEnd: selectedOperation.scheduled_end } }); setConfirmSync(false); }} /></>
          : <KatipanButton label="Propose Operational Scheduled Time" variant="text" onPress={() => setConfirmSync(true)} />}</>}
      {scheduleChanged && <><KatipanText color="secondary">Proposed guest time: {formatTime(draft.scheduledStart)}{draft.scheduledEnd ? ` – ${formatTime(draft.scheduledEnd)}` : ""}. Publication stays {item.is_published ? "published" : "draft"}.</KatipanText>
        {!item.review_required && <KatipanButton label="Confirm Guest Schedule Update" loading={busy} onPress={() => void perform(() => setProgramPublication(membership, item.id, "UPDATE", draft.scheduledStart, draft.scheduledEnd))} />}</>}
    </ProgramSection>}
    {item && canEdit && <ProgramSection title="Publication" description="Publish only when this guest-facing item is ready. Saving details never publishes.">
      {item.is_published ? confirmUnpublish ? <><KatipanText>Remove this item from the guest-visible program?</KatipanText>
        <KatipanButton label="Confirm Unpublish" variant="secondary" loading={busy} onPress={() => void perform(() => setProgramPublication(membership, item.id, "UPDATE", item.scheduled_start, item.scheduled_end, false))} />
        <KatipanButton label="Cancel" variant="text" onPress={() => setConfirmUnpublish(false)} /></>
        : <KatipanButton label="Unpublish Item" variant="secondary" onPress={() => setConfirmUnpublish(true)} />
        : <KatipanButton label="Publish Item" loading={busy} onPress={() => void perform(() => setProgramPublication(membership, item.id, "UPDATE", item.scheduled_start, item.scheduled_end, true))} />}
    </ProgramSection>}
    {item?.review_required && <ProgramSection title="Review Required" description="An operational change requested a review. Guest timing has not changed automatically.">
      <KatipanText variant="title">{item.title}</KatipanText>
      <KatipanText>Guest schedule: {formatTime(item.scheduled_start)}{item.scheduled_end ? ` – ${formatTime(item.scheduled_end)}` : ""}</KatipanText>
      <KatipanText>Operational scheduled: {operation ? `${formatTime(operation.scheduled_start)}${operation.scheduled_end ? ` – ${formatTime(operation.scheduled_end)}` : ""}` : "Linked item unavailable"}</KatipanText>
      {operation && <><KatipanText>Operational actual: {operation.actual_start ? `${formatTime(operation.actual_start)}${operation.actual_end ? ` – ${formatTime(operation.actual_end)}` : ""}` : "Not recorded"}</KatipanText>
        <KatipanText>Operational status: {operation.status.replaceAll("_", " ")}</KatipanText></>}
      <KatipanText>Publication: {item.is_published ? "Published" : "Draft"}</KatipanText>
      {canEdit ? <><KatipanButton label="Keep Guest Schedule" variant="secondary" loading={busy} onPress={() => void perform(() => setProgramPublication(membership, item.id, "KEEP"))} />
        <KatipanText color="textMuted">To update, choose guest-facing times above. Proposed: {formatTime(draft.scheduledStart)}{draft.scheduledEnd ? ` – ${formatTime(draft.scheduledEnd)}` : ""}. Publication stays as it is.</KatipanText>
        <KatipanButton label="Update Guest Schedule and Resolve" loading={busy} onPress={() => void perform(() => setProgramPublication(membership, item.id, "UPDATE", draft.scheduledStart, draft.scheduledEnd))} /></>
        : <KatipanText color="secondary">An Owner or Full Coordinator must resolve this review.</KatipanText>}
    </ProgramSection>}
    {item && canEdit && <ProgramSection title="Remove Item" description="Deleting a Guest Program item does not delete its operational Run-of-Show link target.">
      {confirmDelete ? <><KatipanText>Delete this Guest Program item?</KatipanText>
        <KatipanButton label="Confirm Delete" variant="secondary" loading={busy} onPress={() => void perform(async () => { await deleteProgramItem(membership, item.id); back(); })} />
        <KatipanButton label="Cancel" variant="text" onPress={() => setConfirmDelete(false)} /></>
        : <KatipanButton label="Delete Item" variant="secondary" onPress={() => setConfirmDelete(true)} />}
    </ProgramSection>}
  </KatipanScreen>;
}
