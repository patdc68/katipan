import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import {
  createReceptionEvent,
  createSeatingSeat,
  createSeatingTable,
  deleteSeatingSeat,
  deleteSeatingTable,
  seatGuest,
  setReceptionVisibility,
  unseatGuest,
  updateReceptionEvent,
  updateSeatingSeat,
  updateSeatingTable,
} from "./api";
import {
  buildSeatingGuestEntries,
  buildSeatingOverview,
  canManageSeating,
  deriveHouseholdSplitWarning,
  safeSeatingError,
  seatingRsvpLabel,
  seatingTableDraftSchema,
  seatingSeatDraftSchema,
  seatingEventDraftSchema,
  SeatingSubmitGate,
  type SeatingTableDraft,
  type SeatingTableShape,
  type SeatingVisibility,
} from "./model";
import { useSeatingWorkspace } from "./use-seating-workspace";
import { GuestFilterChip } from "../guests/components";
import {
  EditorialCard,
  EmptyState,
  ErrorState,
  FormField,
  KatipanButton,
  KatipanScreen,
  KatipanText,
  LoadingState,
  SectionHeader,
  StatusChip,
} from "../ui";

const shapes: SeatingTableShape[] = ["ROUND", "RECTANGULAR", "SQUARE", "OVAL", "OTHER"];
const visibilities: SeatingVisibility[] = ["HIDDEN", "TABLE_ONLY", "TABLE_AND_SEAT"];
type Filter = "ALL" | "UNSEATED" | "SEATED" | "DECLINED" | "NO_RESPONSE";

function shapeLabel(shape: SeatingTableShape): string {
  return shape.charAt(0) + shape.slice(1).toLowerCase();
}

function visibilityLabel(visibility: SeatingVisibility): string {
  return visibility === "HIDDEN" ? "Hidden from Guests" : visibility === "TABLE_ONLY" ? "Table only" : "Table and Seat";
}

function seatingRoute(router: ReturnType<typeof useRouter>, weddingId: string) {
  router.navigate({ pathname: "/(wedding)/[weddingId]/seating", params: { weddingId } });
}

export function SeatingOverviewScreen() {
  const { weddingId, membership, isCurrent, loading, error, data, retry } = useSeatingWorkspace();
  const router = useRouter();
  const gate = useRef(new SeatingSubmitGate());
  const [saving, setSaving] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState(false);
  const [eventName, setEventName] = useState("Reception");
  const [addingTable, setAddingTable] = useState(false);
  const [draft, setDraft] = useState<SeatingTableDraft>({ name: "", tableNumber: "", capacity: 8, shape: "ROUND", zone: "", notes: "", sortOrder: 0 });
  const [mutationError, setMutationError] = useState<string | null>(null);
  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading Reception seating…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load seating for this Wedding." onRetry={retry} /></KatipanScreen>;

  const canEdit = canManageSeating(membership);
  const overview = buildSeatingOverview(data);
  const run = async (action: () => Promise<unknown>, fallback: string, after?: () => void) => {
    await gate.current.run(async () => {
      setSaving(true); setMutationError(null);
      try { await action(); after?.(); retry(); }
      catch (cause) { setMutationError(safeSeatingError(cause, fallback)); }
      finally { setSaving(false); }
    });
  };
  const saveEvent = () => {
    const parsed = seatingEventDraftSchema.safeParse({ name: eventName, sortOrder: 0 });
    if (!parsed.success) { setMutationError(parsed.error.issues[0]?.message ?? "Enter a Seating Event name."); return; }
    void run(() => createReceptionEvent(membership, parsed.data), "We couldn't create Reception seating.", () => setCreatingEvent(false));
  };
  const saveEventName = () => {
    if (!overview) return;
    const parsed = seatingEventDraftSchema.safeParse({ name: eventName, sortOrder: overview.event.sort_order });
    if (!parsed.success) { setMutationError(parsed.error.issues[0]?.message ?? "Enter a Seating Event name."); return; }
    void run(() => updateReceptionEvent(membership, overview.event.id, parsed.data), "We couldn't update the Seating Event name.", () => setEditingEvent(false));
  };
  const saveTable = () => {
    if (!overview) return;
    const parsed = seatingTableDraftSchema.safeParse({ ...draft, sortOrder: overview.tableCount });
    if (!parsed.success) { setMutationError(parsed.error.issues[0]?.message ?? "Check the Table details."); return; }
    void run(async () => {
      const id = await createSeatingTable(membership, overview.event.id, parsed.data);
      setDraft({ name: "", tableNumber: "", capacity: 8, shape: "ROUND", zone: "", notes: "", sortOrder: data.tables.length });
      return id;
    }, "We couldn't add this Table.", () => setAddingTable(false));
  };

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.kicker}><KatipanText variant="labelCaps" color="secondary">KATIPAN · GUESTS</KatipanText><StatusChip label={membership.role.replaceAll("_", " ")} tone="neutral" /></View>
      <View style={styles.titleBlock}>
        <KatipanText variant="headlineLarge" accessibilityRole="header">Seating Overview</KatipanText>
        <KatipanText color="textMuted">Reception tables and individual Guest assignments.</KatipanText>
      </View>
      {!overview ? (
        <EditorialCard style={styles.emptyCard}>
          <EmptyState
            title="Reception seating is ready when you are"
            description="Create the Reception Seating Event when you are ready to organize Tables. Opening this screen never creates Wedding data."
            action={canEdit && !creatingEvent ? <KatipanButton label="Create Reception Seating" onPress={() => { setMutationError(null); setCreatingEvent(true); }} /> : undefined}
          />
          {creatingEvent && <View style={styles.formCard}>
            <FormField label="Seating Event name" value={eventName} onChangeText={setEventName} editable={!saving} maxLength={120} />
            {mutationError && <KatipanText color="error">{mutationError}</KatipanText>}
            <View style={styles.actions}><KatipanButton label="Create Reception" loading={saving} onPress={saveEvent} /><KatipanButton label="Cancel" variant="text" disabled={saving} onPress={() => setCreatingEvent(false)} /></View>
          </View>}
        </EditorialCard>
      ) : (
        <>
          <EditorialCard style={styles.eventCard}>
            <View style={styles.rowBetween}>
              <View style={styles.flexCopy}><KatipanText variant="labelCaps" color="secondary">RECEPTION SEATING EVENT</KatipanText><KatipanText variant="headlineMedium">{overview.event.name}</KatipanText></View>
              <StatusChip label={visibilityLabel(overview.event.visibility)} tone={overview.event.visibility === "HIDDEN" ? "neutral" : "success"} />
            </View>
            <View style={styles.statsRow}>
              <Stat label="SEATED" value={overview.seatedCount} />
              <Stat label="UNSEATED ATTENDING" value={overview.unseatedAttendingCount} />
              <Stat label="CAPACITY" value={overview.capacity} />
            </View>
            {canEdit && <KatipanButton label="Assign Guests" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/seating/assign", params: { weddingId } })} />}
            <View style={styles.summaryFoot}><KatipanText variant="bodySmall" color="textMuted">{overview.tableCount} {overview.tableCount === 1 ? "Table" : "Tables"} · {overview.attendingCount} Attending Guests</KatipanText><KatipanText variant="bodySmall" color="textMuted">{overview.event.visibility === "HIDDEN" ? "Guests cannot see seating." : "Guest visibility never changes planner assignments."}</KatipanText></View>
            {canEdit && <KatipanButton label={editingEvent ? "Cancel rename" : "Rename Seating Event"} variant="text" disabled={saving} onPress={() => { setEventName(overview.event.name); setEditingEvent((value) => !value); setMutationError(null); }} />}
            {editingEvent && <View style={styles.formCard}><FormField label="Seating Event name" value={eventName} onChangeText={setEventName} editable={!saving} maxLength={120} />{mutationError && <KatipanText color="error">{mutationError}</KatipanText>}<KatipanButton label="Save name" loading={saving} onPress={saveEventName} /></View>}
            {canEdit && <>
              <SectionHeader title="Guest-facing visibility" description="RSVP, seating and Guest Pass remain separate." />
              <View style={styles.chipRow}>{visibilities.map((visibility) => <GuestFilterChip key={visibility} label={visibilityLabel(visibility)} selected={overview.event.visibility === visibility} disabled={saving} onPress={() => void run(() => setReceptionVisibility(membership, overview.event.id, visibility), "We couldn't update Guest-facing visibility.")} />)}</View>
            </>}
          </EditorialCard>
          <View style={styles.section}>
            <SectionHeader title="Reception tables" description="Capacity and occupancy update from individual seating assignments." action={canEdit ? <KatipanButton label="Add Table" variant="text" onPress={() => { setMutationError(null); setAddingTable((value) => !value); }} /> : undefined} />
            {overview.tables.length === 0 && !addingTable ? <EditorialCard style={styles.emptyTable}><EmptyState title="No Tables yet" description={canEdit ? "Add Tables as your reception layout takes shape." : "The Reception has no Tables yet."} /></EditorialCard> : null}
            {overview.tables.map(({ table, occupancy, remaining }) => (
              <Pressable key={table.id} accessibilityRole="button" accessibilityLabel={`Open ${table.name}, ${occupancy} of ${table.capacity} seats filled`} onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/seating/tables/[tableId]", params: { weddingId, tableId: table.id } })} style={({ pressed }) => [styles.tableCard, pressed && styles.pressed]}>
                <View style={styles.rowBetween}><View style={styles.flexCopy}><KatipanText variant="title">{table.table_number ? `Table ${table.table_number} · ` : ""}{table.name}</KatipanText><KatipanText variant="bodySmall" color="textMuted">{shapeLabel(table.shape)}{table.zone ? ` · ${table.zone}` : ""}</KatipanText></View><StatusChip label={`${occupancy}/${table.capacity}`} tone={occupancy >= table.capacity ? "warning" : "success"} /></View>
                <Progress value={table.capacity ? occupancy / table.capacity : 0} />
                <KatipanText variant="bodySmall" color="textMuted">{remaining} {remaining === 1 ? "place" : "places"} remaining · {overview.tables.find((entry) => entry.table.id === table.id)?.guests.length ?? 0} named Guests</KatipanText>
              </Pressable>
            ))}
            {addingTable && overview && <EditorialCard style={styles.formCard}>
              <SectionHeader title="Add a Table" description="Add capacity and location details. Exact Seats are optional." />
              <FormField label="Table name" value={draft.name} onChangeText={(name) => setDraft((value) => ({ ...value, name }))} editable={!saving} maxLength={120} placeholder="Name this Table" />
              <View style={styles.fieldRow}>
                <View style={styles.half}><FormField label="Table number" value={String(draft.tableNumber)} onChangeText={(raw) => setDraft((value) => ({ ...value, tableNumber: raw }))} keyboardType="number-pad" editable={!saving} placeholder="Optional" /></View>
                <View style={styles.half}><FormField label="Capacity" value={String(draft.capacity)} onChangeText={(raw) => setDraft((value) => ({ ...value, capacity: raw }))} keyboardType="number-pad" editable={!saving} /></View>
              </View>
              <FormField label="Zone (optional)" value={draft.zone} onChangeText={(zone) => setDraft((value) => ({ ...value, zone }))} editable={!saving} maxLength={120} placeholder="Area or section" />
              <FormField label="Notes (optional)" value={draft.notes} onChangeText={(notes) => setDraft((value) => ({ ...value, notes }))} editable={!saving} multiline maxLength={2000} />
              <KatipanText variant="labelLarge">Table shape</KatipanText>
              <View style={styles.chipRow}>{shapes.map((shape) => <GuestFilterChip key={shape} label={shapeLabel(shape)} selected={draft.shape === shape} disabled={saving} onPress={() => setDraft((value) => ({ ...value, shape }))} />)}</View>
              {!!mutationError && <KatipanText color="error">{mutationError}</KatipanText>}
              <View style={styles.actions}><KatipanButton label="Save Table" loading={saving} onPress={saveTable} /><KatipanButton label="Cancel" variant="text" disabled={saving} onPress={() => setAddingTable(false)} /></View>
            </EditorialCard>}
            {!!mutationError && !addingTable && <KatipanText color="error">{mutationError}</KatipanText>}
          </View>
          <EditorialCard style={styles.noteCard}><KatipanText variant="labelLarge">Assignments are individual</KatipanText><KatipanText variant="bodySmall" color="textMuted">Only Attending Guests can be seated. Household members may sit at different Tables. Seating does not update RSVP, Guest Pass or check-in.</KatipanText></EditorialCard>
        </>
      )}
    </KatipanScreen>
  );
}

export function SeatingTableDetailsScreen() {
  const params = useLocalSearchParams<{ tableId?: string | string[] }>();
  const tableId = Array.isArray(params.tableId) ? params.tableId[0] ?? "" : params.tableId ?? "";
  const { weddingId, membership, isCurrent, loading, error, data, retry } = useSeatingWorkspace();
  const router = useRouter();
  const gate = useRef(new SeatingSubmitGate());
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingSeat, setAddingSeat] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteSeatId, setConfirmDeleteSeatId] = useState<string | null>(null);
  const [seatDraft, setSeatDraft] = useState("");
  const [editingSeatId, setEditingSeatId] = useState<string | null>(null);
  const [seatEditLabel, setSeatEditLabel] = useState("");
  const [seatEditSortOrder, setSeatEditSortOrder] = useState("");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SeatingTableDraft>({ name: "", tableNumber: "", capacity: 8, shape: "ROUND", zone: "", notes: "", sortOrder: 0 });
  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading Table details…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load this Table." onRetry={retry} /></KatipanScreen>;
  const table = data.tables.find((item) => item.id === tableId && item.wedding_id === weddingId);
  const event = table && data.events.find((item) => item.id === table.event_id && item.wedding_id === weddingId && item.event_kind === "RECEPTION");
  if (!table || !event) return <KatipanScreen><ErrorState title="Table unavailable" description="This Table isn't part of the selected Wedding." onRetry={() => seatingRoute(router, weddingId)} /></KatipanScreen>;
  const canEdit = canManageSeating(membership);
  const summary = buildSeatingOverview(data, event)?.tables.find((item) => item.table.id === table.id);
  if (!summary) return <KatipanScreen><ErrorState title="Table unavailable" description="This Table could not be loaded for the selected Wedding." onRetry={() => seatingRoute(router, weddingId)} /></KatipanScreen>;
  const seats = data.seats.filter((seat) => seat.wedding_id === weddingId && seat.event_id === event.id && seat.table_id === table.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  const assignmentBySeat = new Map(data.assignments.filter((assignment) => assignment.wedding_id === weddingId && assignment.event_id === event.id && assignment.table_id === table.id && assignment.seat_id)
    .map((assignment) => [assignment.seat_id!, summary.guests.find((entry) => entry.guest.id === assignment.guest_id)?.name ?? "Assigned Guest"]));
  const run = async (action: () => Promise<unknown>, fallback: string, after?: () => void) => {
    await gate.current.run(async () => {
      setSaving(true); setMutationError(null);
      try { await action(); after?.(); retry(); }
      catch (cause) { setMutationError(safeSeatingError(cause, fallback)); }
      finally { setSaving(false); }
    });
  };
  const initialDraft: SeatingTableDraft = { name: table.name, tableNumber: table.table_number === null ? "" : String(table.table_number), capacity: String(table.capacity), shape: table.shape, zone: table.zone ?? "", notes: table.notes ?? "", sortOrder: table.sort_order };
  const saveTable = () => {
    const parsed = seatingTableDraftSchema.safeParse(draft);
    if (!parsed.success) { setMutationError(parsed.error.issues[0]?.message ?? "Check the Table details."); return; }
    void run(() => updateSeatingTable(membership, table.id, parsed.data, data), "We couldn't update this Table.", () => setEditing(false));
  };
  const saveSeat = () => {
    const parsed = seatingSeatDraftSchema.safeParse({ label: seatDraft, sortOrder: seats.length });
    if (!parsed.success) { setMutationError(parsed.error.issues[0]?.message ?? "Enter a Seat label."); return; }
    void run(() => createSeatingSeat(membership, table.id, parsed.data), "We couldn't add this Seat.", () => { setSeatDraft(""); setAddingSeat(false); });
  };
  const saveSeatEdit = (seatId: string, sortOrder: number) => {
    const parsed = seatingSeatDraftSchema.safeParse({ label: seatEditLabel, sortOrder: seatEditSortOrder || sortOrder });
    if (!parsed.success) { setMutationError(parsed.error.issues[0]?.message ?? "Enter a Seat label."); return; }
    void run(() => updateSeatingSeat(membership, seatId, parsed.data), "We couldn't update this Seat.", () => setEditingSeatId(null));
  };
  const assignGuests = () => router.navigate({ pathname: "/(wedding)/[weddingId]/seating/assign", params: { weddingId, tableId: table.id } });

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="‹ Seating Overview" variant="text" onPress={() => seatingRoute(router, weddingId)} />
      <View style={styles.titleBlock}><KatipanText variant="labelCaps" color="secondary">TABLE DETAILS</KatipanText><KatipanText variant="headlineLarge" accessibilityRole="header">{table.table_number ? `Table ${table.table_number}: ` : ""}{table.name}</KatipanText></View>
      <EditorialCard style={styles.eventCard}>
        <View style={styles.rowBetween}><StatusChip label={shapeLabel(table.shape)} tone="neutral" /><StatusChip label={`${summary.occupancy} / ${table.capacity} seated`} tone={summary.occupancy >= table.capacity ? "warning" : "success"} /></View>
        {table.zone && <SummaryLine label="Zone" value={table.zone} />}
        {table.notes && <SummaryLine label="Notes" value={table.notes} />}
        <View style={styles.actions}>
          <KatipanButton label="Assign Guests" onPress={assignGuests} />
          {canEdit && <KatipanButton label={editing ? "Cancel Edit" : "Edit Table"} variant="secondary" onPress={() => { setDraft(initialDraft); setEditing((value) => !value); setMutationError(null); }} />}
        </View>
      </EditorialCard>
      {editing && canEdit && <TableEditCard draft={draft} setDraft={setDraft} saving={saving} error={mutationError} onSave={saveTable} onCancel={() => setEditing(false)} />}
      <View style={styles.section}>
        <SectionHeader title="Assigned Guests" description="Households are shown for context. Each assignment belongs to one Guest." action={canEdit ? <KatipanButton label="Assign more" variant="text" onPress={assignGuests} /> : undefined} />
        {summary.guests.length === 0 ? <EditorialCard style={styles.emptyTable}><EmptyState title="No Guests assigned yet" description="Only Guests with an Attending RSVP can be assigned to this Table." action={canEdit ? <KatipanButton label="Assign Guests" onPress={assignGuests} /> : undefined} /></EditorialCard> : summary.guests.map((entry) => (
          <EditorialCard key={entry.guest.id} style={styles.guestCard}>
            <View style={styles.rowBetween}><View style={styles.flexCopy}><KatipanText variant="title">{entry.name}</KatipanText><KatipanText variant="bodySmall" color="textMuted">{entry.household.display_name}{entry.seat ? ` · Seat ${entry.seat.label}` : " · Table only"}</KatipanText></View><StatusChip label="Attending" tone="success" /></View>
            {canEdit && <View style={styles.actions}><KatipanButton label="Move Guest" variant="text" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/seating/assign", params: { weddingId, tableId: table.id, guestId: entry.guest.id } })} /><KatipanButton label="Unseat" variant="text" disabled={saving} onPress={() => void run(() => unseatGuest(membership, event.id, entry.guest.id), "We couldn't unseat this Guest.")} /></View>}
          </EditorialCard>
        ))}
      </View>
      <View style={styles.section}>
        <SectionHeader title="Exact Seats" description="Optional named positions. Guests remain at this Table if an occupied Seat is deleted." action={canEdit ? <KatipanButton label={addingSeat ? "Cancel" : "Add Seat"} variant="text" onPress={() => setAddingSeat((value) => !value)} /> : undefined} />
        {!seats.length && !addingSeat && <EditorialCard style={styles.noteCard}><KatipanText color="textMuted">No exact Seats configured. Table assignment works without them.</KatipanText></EditorialCard>}
        {seats.map((seat) => {
          const assignedName = assignmentBySeat.get(seat.id);
          return <EditorialCard key={seat.id} style={styles.seatCard}>
            {editingSeatId === seat.id ? <><FormField label="Seat label" value={seatEditLabel} onChangeText={setSeatEditLabel} editable={!saving} maxLength={80} /><FormField label="Order" value={seatEditSortOrder} onChangeText={setSeatEditSortOrder} editable={!saving} keyboardType="number-pad" /><View style={styles.actions}><KatipanButton label="Save label and order" loading={saving} onPress={() => saveSeatEdit(seat.id, seat.sort_order)} /><KatipanButton label="Cancel" variant="text" onPress={() => setEditingSeatId(null)} /></View></> : confirmDeleteSeatId === seat.id ? <View style={styles.confirmCard}><KatipanText variant="title">Delete Seat {seat.label}?</KatipanText><KatipanText variant="bodySmall" color="textMuted">{assignedName ? `${assignedName} stays assigned to ${table.name} without an exact Seat.` : "This open Seat label will be removed."}</KatipanText><View style={styles.actions}><KatipanButton label="Confirm Delete Seat" loading={saving} onPress={() => void run(() => deleteSeatingSeat(membership, seat.id), "We couldn't delete this Seat.", () => setConfirmDeleteSeatId(null))} /><KatipanButton label="Keep Seat" variant="text" onPress={() => setConfirmDeleteSeatId(null)} /></View></View> : <>
              <View style={styles.rowBetween}><View style={styles.flexCopy}><KatipanText variant="title">{seat.label}</KatipanText><KatipanText variant="bodySmall" color="textMuted">{assignedName ? `Assigned to ${assignedName}` : "Available"}</KatipanText></View><StatusChip label={assignedName ? "Assigned" : "Available"} tone={assignedName ? "warning" : "success"} /></View>
              {canEdit && <View style={styles.actions}><KatipanButton label="Edit label and order" variant="text" onPress={() => { setEditingSeatId(seat.id); setSeatEditLabel(seat.label); setSeatEditSortOrder(String(seat.sort_order)); }} /><KatipanButton label="Delete Seat" variant="text" disabled={saving} onPress={() => setConfirmDeleteSeatId(seat.id)} /></View>}
            </>}
          </EditorialCard>;
        })}
        {addingSeat && canEdit && <EditorialCard style={styles.formCard}><FormField label="Seat label" value={seatDraft} onChangeText={setSeatDraft} editable={!saving} maxLength={80} placeholder="A1" /><KatipanText variant="bodySmall" color="textMuted">Seats have labels and order only. They are not placed on a floor-plan diagram.</KatipanText>{!!mutationError && <KatipanText color="error">{mutationError}</KatipanText>}<View style={styles.actions}><KatipanButton label="Save Seat" loading={saving} onPress={saveSeat} /><KatipanButton label="Cancel" variant="text" onPress={() => setAddingSeat(false)} /></View></EditorialCard>}
      </View>
      {canEdit && <View style={styles.section}><SectionHeader title="Remove Table" description="Deleting a Table makes its assigned Guests unseated. Guest records and RSVP responses are preserved." />{!confirmDelete ? <KatipanButton label="Delete Table" variant="secondary" onPress={() => setConfirmDelete(true)} /> : <EditorialCard style={styles.confirmCard}><KatipanText variant="title">Guests assigned here will become unseated.</KatipanText><KatipanText variant="bodySmall" color="textMuted">Their Guest records and RSVP responses stay in the Wedding.</KatipanText>{!!mutationError && <KatipanText color="error">{mutationError}</KatipanText>}<View style={styles.actions}><KatipanButton label="Confirm Delete Table" loading={saving} onPress={() => void run(() => deleteSeatingTable(membership, table.id), "We couldn't delete this Table.", () => router.replace({ pathname: "/(wedding)/[weddingId]/seating", params: { weddingId } }))} /><KatipanButton label="Keep Table" variant="text" onPress={() => setConfirmDelete(false)} /></View></EditorialCard>}</View>}
      {!!mutationError && !editing && !addingSeat && !confirmDelete && <KatipanText color="error">{mutationError}</KatipanText>}
    </KatipanScreen>
  );
}

export function AssignGuestsScreen() {
  const params = useLocalSearchParams<{ tableId?: string | string[]; guestId?: string | string[] }>();
  const requestedTableId = Array.isArray(params.tableId) ? params.tableId[0] ?? "" : params.tableId ?? "";
  const requestedGuestId = Array.isArray(params.guestId) ? params.guestId[0] ?? "" : params.guestId ?? "";
  const { weddingId, membership, isCurrent, loading, error, data, retry } = useSeatingWorkspace();
  const router = useRouter();
  const gate = useRef(new SeatingSubmitGate());
  const [saving, setSaving] = useState(false);
  const [targetTableId, setTargetTableId] = useState(requestedTableId);
  const [selectedGuestId, setSelectedGuestId] = useState(requestedGuestId);
  const [selectedSeatId, setSelectedSeatId] = useState("AUTO");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [splitConfirmed, setSplitConfirmed] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading assignable Guests…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load assignable Guests." onRetry={retry} /></KatipanScreen>;
  const canEdit = canManageSeating(membership);
  const event = data.events.find((item) => item.wedding_id === weddingId && item.event_kind === "RECEPTION");
  if (!event) return <KatipanScreen contentContainerStyle={styles.page}><KatipanButton label="‹ Seating Overview" variant="text" onPress={() => seatingRoute(router, weddingId)} /><EditorialCard style={styles.emptyCard}><EmptyState title="No Reception Seating Event" description="Create Reception seating from the overview before assigning Guests." action={<KatipanButton label="Open Seating Overview" onPress={() => seatingRoute(router, weddingId)} />} /></EditorialCard></KatipanScreen>;
  const overview = buildSeatingOverview(data, event);
  const entries = buildSeatingGuestEntries(data, event.id);
  const tables = overview?.tables ?? [];
  const target = tables.find((item) => item.table.id === targetTableId);
  const selected = entries.find((entry) => entry.guest.id === selectedGuestId);
  const tableSeats = target ? data.seats.filter((seat) => seat.wedding_id === weddingId && seat.event_id === event.id && seat.table_id === target.table.id)
    .filter((seat) => !data.assignments.some((assignment) => assignment.wedding_id === weddingId && assignment.seat_id === seat.id && assignment.guest_id !== selectedGuestId))
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)) : [];
  const householdSplit = Boolean(selected && target && deriveHouseholdSplitWarning(data, event.id, selected.guest.id, target.table.id));
  const currentTarget = selected?.table?.id === target?.table.id;
  const effectiveSeatId = selectedSeatId === "AUTO" ? (currentTarget ? selected?.seat?.id ?? "" : "")
    : selectedSeatId === "TABLE_ONLY" ? "" : selectedSeatId;
  const capacityFull = Boolean(target && target.occupancy >= target.table.capacity && !currentTarget);
  const displayed = entries.filter((entry) => {
    if (filter === "UNSEATED") return entry.status === "ATTENDING" && !entry.assignment;
    if (filter === "SEATED") return entry.status === "ATTENDING" && Boolean(entry.assignment);
    if (filter === "DECLINED") return entry.status === "DECLINED";
    if (filter === "NO_RESPONSE") return entry.status === "NO_RESPONSE";
    return true;
  });
  const run = async (action: () => Promise<unknown>, fallback: string) => {
    await gate.current.run(async () => {
      setSaving(true); setMutationError(null);
      try { await action(); setSelectedGuestId(""); setSelectedSeatId("AUTO"); setSplitConfirmed(false); retry(); }
      catch (cause) { setMutationError(safeSeatingError(cause, fallback)); }
      finally { setSaving(false); }
    });
  };
  const chooseGuest = (guestId: string) => { setSelectedGuestId(guestId); setSelectedSeatId("AUTO"); setSplitConfirmed(false); setMutationError(null); };
  const doAssign = () => {
    if (!canEdit || !selected || !target || selected.status !== "ATTENDING" || capacityFull) return;
    if (householdSplit && !splitConfirmed) { setSplitConfirmed(true); return; }
    void run(() => seatGuest(membership, event.id, selected.guest.id, target.table.id, effectiveSeatId || null), "We couldn't assign this Guest to the Table.");
  };
  const filters: Filter[] = ["ALL", "UNSEATED", "SEATED", "DECLINED", "NO_RESPONSE"];
  const labels: Record<Filter, string> = { ALL: "All Guests", UNSEATED: "Unseated · Attending", SEATED: "Seated", DECLINED: "Declined", NO_RESPONSE: "No response" };

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="‹ Seating Overview" variant="text" onPress={() => seatingRoute(router, weddingId)} />
      <View style={styles.titleBlock}><KatipanText variant="labelCaps" color="secondary">RECEPTION SEATING</KatipanText><KatipanText variant="headlineLarge" accessibilityRole="header">Assign Guests</KatipanText><KatipanText color="textMuted">Choose a Table and seat each Attending Guest individually.</KatipanText></View>
      <EditorialCard style={styles.eventCard}>
        <SectionHeader title="Choose a Table" description="Moving a Guest updates their existing Reception assignment." />
        {tables.length ? <View style={styles.tableChoices}>{tables.map((summary) => <Pressable key={summary.table.id} accessibilityRole="button" accessibilityState={{ selected: targetTableId === summary.table.id }} onPress={() => { setTargetTableId(summary.table.id); setSelectedSeatId("AUTO"); setSplitConfirmed(false); }} style={[styles.tableChoice, targetTableId === summary.table.id && styles.tableChoiceSelected]}><KatipanText variant="title" color={targetTableId === summary.table.id ? "primary" : "text"}>{summary.table.table_number ? `#${summary.table.table_number} ` : ""}{summary.table.name}</KatipanText><KatipanText variant="bodySmall" color="textMuted">{summary.occupancy}/{summary.table.capacity} · {shapeLabel(summary.table.shape)}</KatipanText></Pressable>)}</View> : <><KatipanText color="textMuted">Add a Table before assigning Guests.</KatipanText><KatipanButton label="Open Seating Overview" variant="secondary" onPress={() => seatingRoute(router, weddingId)} /></>}
        {target && <StatusChip label={`${target.occupancy} of ${target.table.capacity} occupied`} tone={capacityFull ? "warning" : "success"} />}
      </EditorialCard>
      {target && <EditorialCard style={styles.eventCard}>
        <SectionHeader title="Guest list" description="Declined and No Response Guests are visible for context but cannot be assigned." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{filters.map((item) => <GuestFilterChip key={item} label={labels[item]} selected={filter === item} onPress={() => setFilter(item)} />)}</ScrollView>
        {displayed.length === 0 ? <EmptyState title="No Guests in this view" description="Try another RSVP filter." /> : displayed.map((entry) => {
          const isSelectable = entry.status === "ATTENDING" && canEdit;
          const selectedHere = selectedGuestId === entry.guest.id;
          return <Pressable key={entry.guest.id} accessibilityRole="button" accessibilityState={{ selected: selectedHere, disabled: !isSelectable }} onPress={() => isSelectable && chooseGuest(entry.guest.id)} style={[styles.candidate, selectedHere && styles.candidateSelected, !isSelectable && styles.candidateDisabled]}>
            <View style={styles.rowBetween}><View style={styles.flexCopy}><KatipanText variant="title">{entry.name}</KatipanText><KatipanText variant="bodySmall" color="textMuted">{entry.household.display_name}{entry.table ? ` · ${entry.table.name}${entry.seat ? ` / ${entry.seat.label}` : ""}` : " · Unseated"}</KatipanText></View><StatusChip label={seatingRsvpLabel(entry.status)} tone={entry.status === "ATTENDING" ? "success" : entry.status === "DECLINED" ? "error" : "warning"} /></View>
            {isSelectable && <KatipanText variant="label" color="secondary">{entry.assignment ? entry.table?.id === target.table.id ? "Selected Table" : "MOVE TO THIS TABLE" : "TAP TO SELECT"}</KatipanText>}
          </Pressable>;
        })}
      </EditorialCard>}
      {selected && selected.status === "ATTENDING" && target && <EditorialCard style={styles.assignmentCard}>
        <SectionHeader title={selected.assignment ? "Move Guest" : "Assignment details"} description={`${selected.name} · ${selected.household.display_name}`} />
        {selected.table && <KatipanText variant="bodySmall" color="textMuted">Currently at {selected.table.name}{selected.seat ? ` · Seat ${selected.seat.label}` : " · no exact Seat"}</KatipanText>}
        <KatipanText variant="labelLarge">Exact Seat (optional)</KatipanText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}><GuestFilterChip label="Table only" selected={!effectiveSeatId} disabled={saving} onPress={() => setSelectedSeatId("TABLE_ONLY")} />{tableSeats.map((seat) => <GuestFilterChip key={seat.id} label={seat.label} selected={effectiveSeatId === seat.id} disabled={saving} onPress={() => setSelectedSeatId(seat.id)} />)}</ScrollView>
        {capacityFull && <KatipanText color="error">This Table is at capacity. Choose another Table to move this Guest.</KatipanText>}
        {householdSplit && <EditorialCard style={styles.warningCard}><KatipanText variant="title" color="secondary">Household members will be split across Tables.</KatipanText><KatipanText variant="bodySmall" color="textMuted">This is allowed. Only {selected.name} will be assigned.</KatipanText>{splitConfirmed && <KatipanText variant="labelLarge" color="secondary">Confirm below to continue with this individual assignment.</KatipanText>}</EditorialCard>}
        {mutationError && <KatipanText color="error">{mutationError}</KatipanText>}
        {!canEdit ? <KatipanText color="textMuted">Seating actions are read-only for your Wedding role.</KatipanText> : <KatipanButton label={householdSplit && !splitConfirmed ? "Continue with Household split" : householdSplit ? "Confirm split and assign" : selected.assignment ? "Move Guest to Table" : "Assign Guest to Table"} loading={saving} disabled={capacityFull} onPress={doAssign} />}
      </EditorialCard>}
      {selected && selected.assignment && canEdit && <KatipanButton label="Unseat selected Guest" variant="secondary" disabled={saving} onPress={() => void run(() => unseatGuest(membership, event.id, selected.guest.id), "We couldn't unseat this Guest.")} />}
      {capacityFull && <KatipanButton label="Manage Tables" variant="text" onPress={() => seatingRoute(router, weddingId)} />}
      <EditorialCard style={styles.noteCard}><KatipanText variant="bodySmall" color="textMuted">RSVP remains unchanged when a Guest is seated, moved or unseated. Declined and No Response Guests cannot be seated from this workflow.</KatipanText></EditorialCard>
    </KatipanScreen>
  );
}

function TableEditCard({ draft, setDraft, saving, error, onSave, onCancel }: {
  draft: SeatingTableDraft; setDraft: (next: SeatingTableDraft | ((current: SeatingTableDraft) => SeatingTableDraft)) => void;
  saving: boolean; error: string | null; onSave: () => void; onCancel: () => void;
}) {
  return <EditorialCard style={styles.formCard}>
    <SectionHeader title="Edit Table" description="Capacity cannot be lowered below current occupancy." />
    <FormField label="Table name" value={draft.name} onChangeText={(name) => setDraft((value) => ({ ...value, name }))} editable={!saving} maxLength={120} />
    <View style={styles.fieldRow}><View style={styles.half}><FormField label="Table number" value={String(draft.tableNumber)} onChangeText={(raw) => setDraft((value) => ({ ...value, tableNumber: raw }))} keyboardType="number-pad" editable={!saving} placeholder="Optional" /></View><View style={styles.half}><FormField label="Capacity" value={String(draft.capacity)} onChangeText={(raw) => setDraft((value) => ({ ...value, capacity: raw }))} keyboardType="number-pad" editable={!saving} /></View></View>
    <FormField label="Zone" value={draft.zone} onChangeText={(zone) => setDraft((value) => ({ ...value, zone }))} editable={!saving} maxLength={120} />
    <FormField label="Notes" value={draft.notes} onChangeText={(notes) => setDraft((value) => ({ ...value, notes }))} editable={!saving} multiline maxLength={2000} />
    <KatipanText variant="labelLarge">Table shape</KatipanText><View style={styles.chipRow}>{shapes.map((shape) => <GuestFilterChip key={shape} label={shapeLabel(shape)} selected={draft.shape === shape} disabled={saving} onPress={() => setDraft((value) => ({ ...value, shape }))} />)}</View>
    {!!error && <KatipanText color="error">{error}</KatipanText>}<View style={styles.actions}><KatipanButton label="Save changes" loading={saving} onPress={onSave} /><KatipanButton label="Cancel" variant="text" disabled={saving} onPress={onCancel} /></View>
  </EditorialCard>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <View style={styles.stat}><KatipanText variant="headlineMedium" color="primary">{String(value)}</KatipanText><KatipanText variant="labelCaps" color="textMuted">{label}</KatipanText></View>;
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.summaryLine}><KatipanText variant="bodySmall" color="textMuted">{label}</KatipanText><KatipanText variant="bodySmall" style={styles.summaryValue}>{value}</KatipanText></View>;
}

function Progress({ value }: { value: number }) {
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }} style={styles.progress}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, value * 100))}%` as `${number}%` }]} /></View>;
}

const styles = StyleSheet.create({
  page: { gap: s.large, paddingBottom: s.extraLarge },
  kicker: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titleBlock: { gap: s.small },
  eventCard: { gap: s.medium, padding: s.cardLarge, backgroundColor: c.surfaceLow },
  emptyCard: { padding: s.medium },
  emptyTable: { padding: 0 },
  section: { gap: s.medium },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  flexCopy: { flex: 1, gap: s.micro },
  statsRow: { flexDirection: "row", gap: s.small, paddingTop: s.small },
  stat: { flex: 1, gap: s.micro },
  summaryFoot: { gap: s.micro, paddingTop: s.small, borderTopWidth: 1, borderTopColor: c.stoneBorder },
  tableCard: { gap: s.small, padding: s.medium, borderRadius: r.large, borderWidth: 1, borderColor: c.stoneBorder, backgroundColor: c.cardIvory },
  pressed: { opacity: 0.76 },
  progress: { height: 7, borderRadius: r.pill, backgroundColor: c.softBeige, overflow: "hidden" },
  progressFill: { height: 7, borderRadius: r.pill, backgroundColor: c.primaryContainer },
  formCard: { gap: s.medium, padding: s.medium, backgroundColor: c.warmAlabaster },
  fieldRow: { flexDirection: "row", gap: s.small },
  half: { flex: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  noteCard: { gap: s.small, padding: s.medium, backgroundColor: c.warmAlabaster },
  sectionHeading: { gap: s.small },
  guestCard: { gap: s.small, padding: s.medium },
  seatCard: { gap: s.small, padding: s.medium },
  confirmCard: { gap: s.small, padding: s.medium, backgroundColor: c.errorContainer },
  summaryLine: { flexDirection: "row", justifyContent: "space-between", gap: s.medium },
  summaryValue: { flex: 1, textAlign: "right" },
  tableChoices: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  tableChoice: { minWidth: 130, flexGrow: 1, gap: s.micro, padding: s.medium, borderRadius: r.large, borderWidth: 1, borderColor: c.stoneBorder, backgroundColor: c.cardIvory },
  tableChoiceSelected: { borderColor: c.primaryContainer, backgroundColor: c.primaryFixed },
  filterRow: { flexDirection: "row", gap: s.small, paddingVertical: s.micro },
  candidate: { gap: s.small, padding: s.medium, borderBottomWidth: 1, borderBottomColor: c.stoneBorder },
  candidateSelected: { borderRadius: r.medium, backgroundColor: c.primaryFixed, borderBottomColor: c.primaryFixed },
  candidateDisabled: { opacity: 0.82 },
  assignmentCard: { gap: s.medium, padding: s.cardLarge, backgroundColor: c.surfaceLow },
  warningCard: { gap: s.small, padding: s.medium, backgroundColor: c.secondaryFixed },
});
