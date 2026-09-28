import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import {
  deleteAttireGroup,
  deleteGuestAttireGuidance,
  deleteWeddingDressCode,
  deleteWeddingMotif,
  reorderAttireGroups,
  saveAttireGroup,
  saveGuestAttireGuidance,
  saveWeddingDressCode,
  saveWeddingMotif,
  setAttireGroupGuestTarget,
  setAttireGroupRoleTarget,
} from "./api";
import {
  attireGroupDraftSchema,
  canManageWeddingStyling,
  dressCodeDraftSchema,
  guestGuidanceDraftSchema,
  motifDraftSchema,
  moveId,
  orderedColors,
  safeStylingError,
  StylingSubmitGate,
  type AttireGroupDraft,
  type DressCodeDraft,
  type GuestGuidanceDraft,
  type MotifDraft,
} from "./model";
import { useStylingWorkspace } from "./use-styling-workspace";
import { ColorCollectionEditor, ColorConflictNotice, InspirationGallery, SelectionRow } from "./components";
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

export function StylingOverviewScreen() {
  const state = useStylingWorkspace();
  const router = useRouter();
  if (state.loading) return <ScreenLoading label="Loading Wedding styling…" />;
  if (!state.membership || !state.isCurrent) return <WorkspaceUnavailable />;
  if (state.error || !state.data) return <ScreenError description="We couldn't load the styling plan." retry={state.retry} />;
  const { data, membership, weddingId } = state;
  const canEdit = canManageWeddingStyling(membership);
  const weddingName = membership.partnerNames.join(" & ") || membership.wedding.display_name || "Wedding workspace";
  const directTargets = data.attireGroups.reduce((sum, item) => sum + item.guestTargets.length, 0);
  const roleTargets = data.attireGroups.reduce((sum, item) => sum + item.roleTargets.length, 0);

  return (
    <KatipanScreen contentContainerStyle={styles.screenContent}>
      <SectionHeader title="Wedding Styling" eyebrow={weddingName} description="Shape the Wedding look and give guests clear, separate attire guidance." />
      {!canEdit && <StatusChip label="Read only · styling managers can edit" />}
      <EditorialCard style={styles.introCard}>
        <KatipanText variant="labelCaps" color="secondary">ONE PLAN, DISTINCT GUIDANCE</KatipanText>
        <KatipanText color="textMuted">Wedding Motif captures the wedding aesthetic. Dress Code and Attire Groups tell Guests what to wear. Motif colors never become recommended Guest colors automatically.</KatipanText>
      </EditorialCard>

      <EditorialCard style={styles.summaryCard}>
        <SectionHeader title="Wedding Motif" description={data.motif?.title ?? "No motif has been added yet."} />
        {data.motif && <>
          <KatipanText color="textMuted">{data.motif.description || "No motif description yet."}</KatipanText>
          <View style={styles.swatchRow}>
            {orderedColors(data.motifColors).map((color) => <View key={color.id} style={[styles.summarySwatch, { backgroundColor: color.color_hex }]} accessibilityLabel={`${color.name ?? color.color_hex}, ${color.color_hex}`} />)}
            {data.motifColors.length === 0 && <KatipanText variant="bodySmall" color="textMuted">No palette colors yet.</KatipanText>}
          </View>
          <KatipanText variant="bodySmall" color="textMuted">{data.motifInspiration.length} inspiration {data.motifInspiration.length === 1 ? "image" : "images"}</KatipanText>
        </>}
        <KatipanButton label={canEdit ? "Manage Wedding Motif" : "View Wedding Motif"} variant="secondary"
          onPress={() => pushRoute(router, "/(wedding)/[weddingId]/style/motif", { weddingId })} />
      </EditorialCard>

      <EditorialCard style={styles.summaryCard}>
        <SectionHeader title="Dress Code" description={data.dressCode?.title ?? "No dress code has been added yet."} />
        {data.dressCode && <>
          <KatipanText color="textMuted">{data.dressCode.description || "Add guidance for what Wedding Guests should wear."}</KatipanText>
          <ColorPreview label="Recommended for Guests" colors={data.dressRecommendedColors} />
          <ColorPreview label="Colors to avoid" colors={data.dressAvoidColors} />
          <KatipanText variant="bodySmall" color="textMuted">{data.dressInspiration.length} inspiration {data.dressInspiration.length === 1 ? "image" : "images"}</KatipanText>
        </>}
        <KatipanButton label={canEdit ? "Manage Dress Code" : "View Dress Code"} variant="secondary"
          onPress={() => pushRoute(router, "/(wedding)/[weddingId]/style/dress-code", { weddingId })} />
      </EditorialCard>

      <EditorialCard style={styles.summaryCard}>
        <View style={styles.rowBetween}>
          <SectionHeader title="Attire Groups" description={`${data.attireGroups.length} ${data.attireGroups.length === 1 ? "group" : "groups"} · ${directTargets} direct Guest targets · ${roleTargets} role targets`} />
        </View>
        {data.attireGroups.length ? (
          <View style={styles.groupSummaryList}>
            {data.attireGroups.slice(0, 4).map(({ group, guestTargets, roleTargets: targetRoles }) => (
              <View key={group.id} style={styles.summaryGroupRow}>
                <KatipanText variant="labelLarge">{group.title}</KatipanText>
                <KatipanText variant="bodySmall" color="textMuted">{guestTargets.length} direct Guests · {targetRoles.length} Entourage roles</KatipanText>
              </View>
            ))}
            {data.attireGroups.length > 4 && <KatipanText variant="bodySmall" color="textMuted">And {data.attireGroups.length - 4} more groups</KatipanText>}
          </View>
        ) : <KatipanText color="textMuted">No Attire Groups have been added.</KatipanText>}
        <KatipanButton label={canEdit ? "Manage Attire Groups" : "View Attire Groups"} variant="secondary"
          onPress={() => pushRoute(router, "/(wedding)/[weddingId]/style/attire-groups", { weddingId })} />
      </EditorialCard>
      <KatipanButton label="Back to More" variant="text" onPress={() => pushRoute(router, "/(wedding)/[weddingId]/more", { weddingId })} />
    </KatipanScreen>
  );
}

export function WeddingMotifScreen() {
  const state = useStylingWorkspace();
  const motif = state.data?.motif ?? null;
  const key = `${state.weddingId}:${motif?.id ?? "new"}:${motif?.updated_at ?? ""}`;
  const gate = useRef(new StylingSubmitGate());
  const [drafts, setDrafts] = useState<Record<string, MotifDraft>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialDraft: MotifDraft = { title: motif?.title ?? "", description: motif?.description ?? "", notes: motif?.notes ?? "" };
  const displayedDraft = drafts[key] ?? initialDraft;
  if (state.loading) return <ScreenLoading label="Loading Wedding Motif…" />;
  if (!state.membership || !state.isCurrent) return <WorkspaceUnavailable />;
  if (state.error || !state.data) return <ScreenError description="We couldn't load the Wedding Motif." retry={state.retry} />;
  const { data, membership, weddingId } = state;
  const canEdit = canManageWeddingStyling(membership);
  const run = (operation: () => Promise<void>, done?: () => void) => {
    void gate.current.run(async () => {
      setBusy(true); setError(null);
      try { await operation(); done?.(); state.retry(); }
      catch (cause) { setError(safeStylingError(cause)); }
      finally { setBusy(false); }
    });
  };
  const update = (field: keyof MotifDraft, value: string) => setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? initialDraft), [field]: value } }));
  const save = () => {
    try { motifDraftSchema.parse(displayedDraft); }
    catch (cause) { setError(safeStylingError(cause)); return; }
    run(() => saveWeddingMotif(membership, displayedDraft));
  };

  return (
    <KatipanScreen contentContainerStyle={styles.screenContent}>
      <PageHeading title="Wedding Motif" subtitle="Wedding aesthetic and palette" weddingId={weddingId} />
      <EditorialCard style={styles.summaryCard}>
        <KatipanText color="textMuted">Use the motif for the overall Wedding aesthetic. Its colors remain separate from recommended and avoid Guest attire colors.</KatipanText>
        {canEdit ? <>
          <FormField label="Motif title" value={displayedDraft.title} onChangeText={(value) => update("title", value)} placeholder="Botanical garden" maxLength={120} />
          <FormField label="Description" value={displayedDraft.description} onChangeText={(value) => update("description", value)} placeholder="A short description of the Wedding look" multiline numberOfLines={3} maxLength={2000} />
          <FormField label="Private planner notes" value={displayedDraft.notes} onChangeText={(value) => update("notes", value)} placeholder="Notes for Wedding members" multiline numberOfLines={3} maxLength={4000} />
          <KatipanButton label={motif ? "Save Motif" : "Create Motif"} loading={busy} onPress={save} />
          {motif && !confirmDelete && <KatipanButton label="Reset Wedding Motif" variant="text" disabled={busy} onPress={() => setConfirmDelete(true)} />}
          {motif && confirmDelete && <ConfirmationCard title="Reset this Wedding Motif?" detail="This removes the motif, its palette, and its image links. Guest records and the uploaded Attachment files remain unchanged." busy={busy} confirmLabel="Reset Motif" onCancel={() => setConfirmDelete(false)} onConfirm={() => run(() => deleteWeddingMotif(membership, motif.id), () => setConfirmDelete(false))} />}
        </> : <>
          <InfoField label="Title" value={motif?.title} empty="No motif has been added." />
          <InfoField label="Description" value={motif?.description} />
          <InfoField label="Private planner notes" value={motif?.notes} />
        </>}
        {!!error && <KatipanText accessibilityRole="alert" color="error">{error}</KatipanText>}
      </EditorialCard>
      {motif && <>
        <SectionHeader title="Motif colors" description="These swatches describe the Wedding aesthetic. They do not populate Guest attire recommendations." />
        <ColorCollectionEditor title="Wedding palette" description="Normalized to uppercase #RRGGBB." collection={{ kind: "motif", parentId: motif.id }} rows={data.motifColors} membership={membership} canEdit={canEdit} onChanged={state.retry} />
        <InspirationGallery title="Motif inspiration" description="Private planner images or Guest-visible images for the Guest Guide." source="MOTIF" parentId={motif.id} images={data.motifInspiration} membership={membership} canEdit={canEdit} onChanged={state.retry} />
      </>}
    </KatipanScreen>
  );
}

export function DressCodeScreen() {
  const state = useStylingWorkspace();
  const dressCode = state.data?.dressCode ?? null;
  const key = `${state.weddingId}:${dressCode?.id ?? "new"}:${dressCode?.updated_at ?? ""}`;
  const gate = useRef(new StylingSubmitGate());
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, DressCodeDraft>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialDraft: DressCodeDraft = { title: dressCode?.title ?? "", description: dressCode?.description ?? "", venueAdvice: dressCode?.venue_advice ?? "", generalNotes: dressCode?.general_notes ?? "" };
  const displayedDraft = drafts[key] ?? initialDraft;
  if (state.loading) return <ScreenLoading label="Loading Dress Code…" />;
  if (!state.membership || !state.isCurrent) return <WorkspaceUnavailable />;
  if (state.error || !state.data) return <ScreenError description="We couldn't load the Dress Code." retry={state.retry} />;
  const { data, membership, weddingId } = state;
  const canEdit = canManageWeddingStyling(membership);
  const update = (field: keyof DressCodeDraft, value: string) => setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? initialDraft), [field]: value } }));
  const run = (operation: () => Promise<void>, done?: () => void) => {
    void gate.current.run(async () => {
      setBusy(true); setError(null);
      try { await operation(); done?.(); state.retry(); }
      catch (cause) { setError(safeStylingError(cause)); }
      finally { setBusy(false); }
    });
  };
  const save = () => {
    try { dressCodeDraftSchema.parse(displayedDraft); }
    catch (cause) { setError(safeStylingError(cause)); return; }
    run(() => saveWeddingDressCode(membership, displayedDraft));
  };

  return (
    <KatipanScreen contentContainerStyle={styles.screenContent}>
      <PageHeading title="Dress Code" subtitle="Guest attire guidance" weddingId={weddingId} />
      <EditorialCard style={styles.summaryCard}>
        <KatipanText color="textMuted">Dress Code tells Guests what to wear. It stays separate from the Wedding Motif and its palette.</KatipanText>
        {canEdit ? <>
          <FormField label="Dress Code title" value={displayedDraft.title} onChangeText={(value) => update("title", value)} placeholder="Garden formal" maxLength={120} />
          <FormField label="Description" value={displayedDraft.description} onChangeText={(value) => update("description", value)} placeholder="A guest-facing overview" multiline numberOfLines={3} maxLength={2000} />
          <FormField label="Venue advice" value={displayedDraft.venueAdvice} onChangeText={(value) => update("venueAdvice", value)} placeholder="Consider grass, gravel, or the weather" multiline numberOfLines={3} maxLength={2000} />
          <FormField label="General notes" value={displayedDraft.generalNotes} onChangeText={(value) => update("generalNotes", value)} placeholder="Additional guidance for Wedding members" multiline numberOfLines={3} maxLength={4000} />
          <KatipanButton label={dressCode ? "Save Dress Code" : "Create Dress Code"} loading={busy} onPress={save} />
          {dressCode && !confirmDelete && <KatipanButton label="Reset Dress Code" variant="text" disabled={busy} onPress={() => setConfirmDelete(true)} />}
          {dressCode && confirmDelete && <ConfirmationCard title="Reset this Dress Code?" detail="This removes general colors, Attire Groups, Guest targeting, and image links under this Dress Code. Guests and uploaded Attachment files remain unchanged." busy={busy} confirmLabel="Reset Dress Code" onCancel={() => setConfirmDelete(false)} onConfirm={() => run(() => deleteWeddingDressCode(membership, dressCode.id), () => setConfirmDelete(false))} />}
        </> : <>
          <InfoField label="Title" value={dressCode?.title} empty="No Dress Code has been added." />
          <InfoField label="Description" value={dressCode?.description} />
          <InfoField label="Venue advice" value={dressCode?.venue_advice} />
          <InfoField label="General notes" value={dressCode?.general_notes} />
        </>}
        {!!error && <KatipanText accessibilityRole="alert" color="error">{error}</KatipanText>}
      </EditorialCard>
      {dressCode && <>
        <ColorCollectionEditor title="Recommended for Guests" description="Colors Guests are encouraged to wear." collection={{ kind: "dress-recommended", parentId: dressCode.id }} rows={data.dressRecommendedColors} membership={membership} canEdit={canEdit} onChanged={state.retry} />
        <ColorCollectionEditor title="Colors to avoid" description="Colors Guests are asked not to wear. This remains a separate list." collection={{ kind: "dress-avoid", parentId: dressCode.id }} rows={data.dressAvoidColors} membership={membership} canEdit={canEdit} onChanged={state.retry} />
        <ColorConflictNotice recommended={data.dressRecommendedColors} avoid={data.dressAvoidColors} />
        <InspirationGallery title="Dress Code inspiration" description="Reference images can be planner-only or included in the Guest Guide." source="DRESS_CODE" parentId={dressCode.id} images={data.dressInspiration} membership={membership} canEdit={canEdit} onChanged={state.retry} />
        <EditorialCard style={styles.summaryCard}>
          <SectionHeader title="Attire Groups" description="Give selected Guests or Entourage roles additional instructions and colors." />
          <KatipanButton label={canEdit ? "Manage Attire Groups" : "View Attire Groups"} variant="secondary" onPress={() => pushRoute(router, "/(wedding)/[weddingId]/style/attire-groups", { weddingId })} />
        </EditorialCard>
      </>}
    </KatipanScreen>
  );
}

export function AttireGroupListScreen() {
  const state = useStylingWorkspace();
  const gate = useRef(new StylingSubmitGate());
  const router = useRouter();
  const [draft, setDraft] = useState<AttireGroupDraft>({ title: "", description: "", instructions: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (state.loading) return <ScreenLoading label="Loading Attire Groups…" />;
  if (!state.membership || !state.isCurrent) return <WorkspaceUnavailable />;
  if (state.error || !state.data) return <ScreenError description="We couldn't load Attire Groups." retry={state.retry} />;
  const { data, membership, weddingId } = state;
  const canEdit = canManageWeddingStyling(membership);
  if (!data.dressCode) {
    return <KatipanScreen contentContainerStyle={styles.screenContent}><PageHeading title="Attire Groups" subtitle="Additional Guest guidance" weddingId={weddingId} />
      <EmptyState title="Add a Dress Code first" description="Attire Groups are part of the Wedding Dress Code." action={<KatipanButton label="Open Dress Code" variant="secondary" onPress={() => pushRoute(router, "/(wedding)/[weddingId]/style/dress-code", { weddingId })} />} />
    </KatipanScreen>;
  }
  const dressCode = data.dressCode;
  const run = (operation: () => Promise<void>) => {
    void gate.current.run(async () => {
      setBusy(true); setError(null);
      try { await operation(); setDraft({ title: "", description: "", instructions: "" }); state.retry(); }
      catch (cause) { setError(safeStylingError(cause)); }
      finally { setBusy(false); }
    });
  };
  const create = () => {
    try { attireGroupDraftSchema.parse(draft); }
    catch (cause) { setError(safeStylingError(cause)); return; }
    run(() => saveAttireGroup(membership, dressCode.id, draft));
  };
  const move = (groupId: string, direction: -1 | 1) => {
    const ordered = data.attireGroups.map((item) => item.group).sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
    const ids = moveId(ordered, groupId, direction);
    if (ids.every((id, index) => id === ordered[index]?.id)) return;
    run(() => reorderAttireGroups(membership, ordered, ids));
  };

  return (
    <KatipanScreen contentContainerStyle={styles.screenContent}>
      <PageHeading title="Attire Groups" subtitle={`${dressCode.title} · target Guests and roles independently`} weddingId={weddingId} />
      <EditorialCard style={styles.summaryCard}>
        <KatipanText color="textMuted">Groups add guidance for selected Guests and/or Entourage roles. A Guest can match more than one group. Assignments never change Guest identity, RSVP, Seating, or Entourage membership.</KatipanText>
        {data.attireGroups.length === 0 ? <KatipanText color="textMuted">No Attire Groups have been added.</KatipanText> : (
          <View style={styles.groupList}>
            {data.attireGroups.map(({ group, guestTargets, roleTargets }) => (
              <View key={group.id} style={styles.groupRow}>
                <Pressable accessibilityRole="button" onPress={() => pushRoute(router, "/(wedding)/[weddingId]/style/attire-groups/[groupId]", { weddingId, groupId: group.id })} style={styles.groupPressable}>
                  <KatipanText variant="title">{group.title}</KatipanText>
                  <KatipanText variant="bodySmall" color="textMuted">{guestTargets.length} direct Guests · {roleTargets.length} roles</KatipanText>
                  <KatipanText variant="bodySmall" color="primary">View group and guidance ›</KatipanText>
                </Pressable>
                {canEdit && <View style={styles.groupActions}>
                  <SmallButton label="Move up" disabled={busy || data.attireGroups[0]?.group.id === group.id} onPress={() => move(group.id, -1)} />
                  <SmallButton label="Move down" disabled={busy || data.attireGroups.at(-1)?.group.id === group.id} onPress={() => move(group.id, 1)} />
                </View>}
              </View>
            ))}
          </View>
        )}
      </EditorialCard>
      {canEdit && <EditorialCard style={styles.summaryCard}>
        <SectionHeader title="Add an Attire Group" description="Use any title that fits this Wedding." />
        <FormField label="Group title" value={draft.title} onChangeText={(title) => setDraft((current) => ({ ...current, title }))} placeholder="Family" maxLength={120} />
        <FormField label="Description" value={draft.description} onChangeText={(description) => setDraft((current) => ({ ...current, description }))} placeholder="Who this guidance is for" multiline numberOfLines={2} maxLength={2000} />
        <FormField label="Instructions" value={draft.instructions} onChangeText={(instructions) => setDraft((current) => ({ ...current, instructions }))} placeholder="Optional group-specific instructions" multiline numberOfLines={3} maxLength={4000} />
        <KatipanButton label="Create Attire Group" loading={busy} onPress={create} />
        {!!error && <KatipanText accessibilityRole="alert" color="error">{error}</KatipanText>}
      </EditorialCard>}
    </KatipanScreen>
  );
}

export function AttireGroupDetailsScreen() {
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] ?? "" : params.groupId ?? "";
  const state = useStylingWorkspace();
  const groupForDraft = state.data?.attireGroups.find((item) => item.group.id === groupId && item.group.wedding_id === state.weddingId)?.group ?? null;
  const key = `${state.weddingId}:${groupForDraft?.id ?? "missing"}:${groupForDraft?.updated_at ?? ""}`;
  const router = useRouter();
  const gate = useRef(new StylingSubmitGate());
  const [drafts, setDrafts] = useState<Record<string, AttireGroupDraft>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialDraft: AttireGroupDraft = { title: groupForDraft?.title ?? "", description: groupForDraft?.description ?? "", instructions: groupForDraft?.instructions ?? "" };
  const displayedDraft = drafts[key] ?? initialDraft;
  if (state.loading) return <ScreenLoading label="Loading Attire Group…" />;
  if (!state.membership || !state.isCurrent) return <WorkspaceUnavailable />;
  if (state.error || !state.data) return <ScreenError description="We couldn't load this Attire Group." retry={state.retry} />;
  const { data, membership, weddingId } = state;
  const canEdit = canManageWeddingStyling(membership);
  const groupData = data.attireGroups.find((item) => item.group.id === groupId && item.group.wedding_id === weddingId);
  if (!groupData || !data.dressCode) return <ScreenError title="Attire Group unavailable" description="This group isn't part of the selected Wedding." retry={state.retry} />;
  const { group, recommendedColors, avoidColors, guestTargets, roleTargets, inspiration } = groupData;
  const run = (operation: () => Promise<void>, done?: () => void) => {
    void gate.current.run(async () => {
      setBusy(true); setError(null);
      try { await operation(); done?.(); state.retry(); }
      catch (cause) { setError(safeStylingError(cause)); }
      finally { setBusy(false); }
    });
  };
  const save = () => {
    try { attireGroupDraftSchema.parse(displayedDraft); }
    catch (cause) { setError(safeStylingError(cause)); return; }
    run(() => saveAttireGroup(membership, data.dressCode!.id, displayedDraft, group.id));
  };
  const directTargetIds = new Set(guestTargets.map((target) => target.guest_id));
  const targetRoleIds = new Set(roleTargets.map((target) => target.entourage_role_id));
  const roleNameById = new Map(data.entourageRoles.map((role) => [role.id, role.name]));
  const guestNameById = new Map(data.guests.map((guest) => [guest.id, guest.display_name]));
  const assignedRoleGuestIds = new Set(data.entourageAssignments.filter((assignment) => targetRoleIds.has(assignment.role_id)).map((assignment) => assignment.guest_id));

  return (
    <KatipanScreen contentContainerStyle={styles.screenContent}>
      <PageHeading title={group.title} subtitle="Attire Group" weddingId={weddingId} />
      <EditorialCard style={styles.summaryCard}>
        {canEdit ? <>
          <FormField label="Group title" value={displayedDraft.title} onChangeText={(title) => setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? initialDraft), title } }))} maxLength={120} />
          <FormField label="Description" value={displayedDraft.description} onChangeText={(description) => setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? initialDraft), description } }))} placeholder="Who this guidance is for" multiline numberOfLines={3} maxLength={2000} />
          <FormField label="Group instructions" value={displayedDraft.instructions} onChangeText={(instructions) => setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? initialDraft), instructions } }))} placeholder="Special instructions for this group" multiline numberOfLines={4} maxLength={4000} />
          <KatipanButton label="Save Attire Group" loading={busy} onPress={save} />
        </> : <>
          <InfoField label="Description" value={group.description} />
          <InfoField label="Instructions" value={group.instructions} />
        </>}
        {!!error && <KatipanText accessibilityRole="alert" color="error">{error}</KatipanText>}
        {canEdit && !confirmDelete && <KatipanButton label="Delete Attire Group" variant="text" disabled={busy} onPress={() => setConfirmDelete(true)} />}
        {canEdit && confirmDelete && <ConfirmationCard title={`Delete ${group.title}?`} detail="This removes its colors, Guest and role targets, and image links. Guest and Entourage records and uploaded Attachment files remain unchanged." busy={busy} confirmLabel="Delete Attire Group" onCancel={() => setConfirmDelete(false)} onConfirm={() => run(() => deleteAttireGroup(membership, data.dressCode!.id, group.id), () => { setConfirmDelete(false); pushRoute(router, "/(wedding)/[weddingId]/style/attire-groups", { weddingId }); })} />}
      </EditorialCard>

      <ColorCollectionEditor title="Recommended for this group" description="These colors specialize the general Dress Code for matching Guests." collection={{ kind: "group-recommended", parentId: group.id }} rows={recommendedColors} membership={membership} canEdit={canEdit} onChanged={state.retry} />
      <ColorCollectionEditor title="Colors to avoid for this group" description="This list remains separate from the group's recommended colors." collection={{ kind: "group-avoid", parentId: group.id }} rows={avoidColors} membership={membership} canEdit={canEdit} onChanged={state.retry} />
      <ColorConflictNotice recommended={recommendedColors} avoid={avoidColors} />

      <EditorialCard style={styles.summaryCard}>
        <SectionHeader title="Assign Guests" description="Direct targeting adds this group's attire guidance without changing Guest identity or other group assignments." />
        <KatipanText variant="bodySmall" color="textMuted">A Guest can belong to multiple Attire Groups. Entourage-role targeting can also make this group apply to a Guest.</KatipanText>
        {!canEdit ? guestTargets.length ? <View style={styles.targetList}>
          {guestTargets.flatMap((target) => {
            const name = guestNameById.get(target.guest_id);
            return name ? [<KatipanText key={target.guest_id} variant="labelLarge">{name}</KatipanText>] : [];
          })}
        </View> : <KatipanText color="textMuted">No Guests are directly assigned to this group.</KatipanText> : data.guests.length === 0 ? <KatipanText color="textMuted">No individual Guests are available in this Wedding.</KatipanText> : (
          <View style={styles.targetList}>
            {data.guests.map((guest) => {
              const roleMatches = data.entourageAssignments.filter((assignment) => assignment.guest_id === guest.id && targetRoleIds.has(assignment.role_id));
              const roleLabels = roleMatches.map((assignment) => roleNameById.get(assignment.role_id)).filter((name): name is string => Boolean(name));
              const otherGroups = data.attireGroups.filter((item) => item.group.id !== group.id && item.guestTargets.some((target) => target.guest_id === guest.id));
              const detail = [roleLabels.length ? `also matched by ${roleLabels.join(", ")}` : "", otherGroups.length ? `also in ${otherGroups.map((item) => item.group.title).join(", ")}` : ""].filter(Boolean).join(" · ");
              return <SelectionRow key={guest.id} label={guest.display_name} detail={detail || undefined} selected={directTargetIds.has(guest.id)} disabled={!canEdit || busy}
                onPress={() => run(() => setAttireGroupGuestTarget(membership, data.dressCode!.id, group.id, guest.id, !directTargetIds.has(guest.id)))} />;
            })}
          </View>
        )}
      </EditorialCard>

      <EditorialCard style={styles.summaryCard}>
        <SectionHeader title="Assign Entourage roles" description="Guests who hold a selected Wedding role receive this group's guidance." />
        {!canEdit ? roleTargets.length ? <View style={styles.targetList}>
          {roleTargets.flatMap((target) => {
            const name = roleNameById.get(target.entourage_role_id);
            const matchCount = data.entourageAssignments.filter((assignment) => assignment.role_id === target.entourage_role_id).length;
            return name ? [<KatipanText key={target.entourage_role_id} variant="labelLarge">{name} · {matchCount} matching Guest{matchCount === 1 ? "" : "s"}</KatipanText>] : [];
          })}
        </View> : <KatipanText color="textMuted">No Entourage roles are targeted by this group.</KatipanText> : data.entourageRoles.length === 0 ? <KatipanText color="textMuted">No Entourage roles are set up for this Wedding. Add roles from the Guest workspace.</KatipanText> : (
          <View style={styles.targetList}>
            {data.entourageRoles.map((role) => {
              const matchCount = targetRoleIds.has(role.id) && assignedRoleGuestIds.size
                ? data.entourageAssignments.filter((assignment) => assignment.role_id === role.id && assignedRoleGuestIds.has(assignment.guest_id)).length
                : 0;
              return <SelectionRow key={role.id} label={role.name} detail={matchCount ? `${matchCount} assigned Guest${matchCount === 1 ? "" : "s"} currently match` : "No assigned Guests currently match"}
                selected={targetRoleIds.has(role.id)} disabled={!canEdit || busy}
                onPress={() => run(() => setAttireGroupRoleTarget(membership, data.dressCode!.id, group.id, role.id, !targetRoleIds.has(role.id)))} />;
            })}
          </View>
        )}
        <KatipanText variant="bodySmall" color="textMuted">Role targeting never changes Entourage membership or creates another Guest record.</KatipanText>
      </EditorialCard>
      <InspirationGallery title="Group inspiration" description="Show this image to matching Guests only when it is Guest-visible and eligible in the Guest Guide." source="ATTIRE_GROUP" parentId={group.id} images={inspiration} membership={membership} canEdit={canEdit} onChanged={state.retry} />
      <KatipanText variant="bodySmall" color="textMuted">{guestTargets.length} direct Guest targets · {roleTargets.length} Entourage role targets</KatipanText>
    </KatipanScreen>
  );
}

export function GuestAttireGuidanceScreen() {
  const params = useLocalSearchParams<{ guestId?: string | string[] }>();
  const guestId = Array.isArray(params.guestId) ? params.guestId[0] ?? "" : params.guestId ?? "";
  const state = useStylingWorkspace();
  const guestForDraft = state.data?.guests.find((item) => item.id === guestId && item.wedding_id === state.weddingId) ?? null;
  const guidanceForDraft = state.data?.guestGuidance.find((item) => item.guest_id === guestId && item.wedding_id === state.weddingId) ?? null;
  const key = `${state.weddingId}:${guestForDraft?.id ?? "missing"}:${guidanceForDraft?.id ?? "new"}:${guidanceForDraft?.updated_at ?? ""}`;
  const router = useRouter();
  const gate = useRef(new StylingSubmitGate());
  const [drafts, setDrafts] = useState<Record<string, GuestGuidanceDraft>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialDraft: GuestGuidanceDraft = { title: guidanceForDraft?.title ?? "", instructions: guidanceForDraft?.instructions ?? "", notes: guidanceForDraft?.notes ?? "" };
  const displayedDraft = drafts[key] ?? initialDraft;
  if (state.loading) return <ScreenLoading label="Loading guest attire guidance…" />;
  if (!state.membership || !state.isCurrent) return <WorkspaceUnavailable />;
  if (state.error || !state.data) return <ScreenError description="We couldn't load guest attire guidance." retry={state.retry} />;
  const { data, membership, weddingId } = state;
  const canEdit = canManageWeddingStyling(membership);
  const guest = data.guests.find((item) => item.id === guestId && item.wedding_id === weddingId);
  if (!guest) return <ScreenError title="Guest unavailable" description="This Guest isn't part of the selected Wedding." retry={state.retry} />;
  const guidance = data.guestGuidance.find((item) => item.guest_id === guestId && item.wedding_id === weddingId) ?? null;
  const roles = data.entourageAssignments.filter((item) => item.guest_id === guest.id).map((item) => item.role_id);
  const matchingGroups = data.attireGroups.filter((item) => item.guestTargets.some((target) => target.guest_id === guest.id)
    || item.roleTargets.some((target) => roles.includes(target.entourage_role_id)));
  const assignedRoleNames = data.entourageRoles.filter((role) => roles.includes(role.id)).map((role) => role.name);
  const run = (operation: () => Promise<void>, done?: () => void) => {
    void gate.current.run(async () => {
      setBusy(true); setError(null);
      try { await operation(); done?.(); state.retry(); }
      catch (cause) { setError(safeStylingError(cause)); }
      finally { setBusy(false); }
    });
  };
  const save = () => {
    try { guestGuidanceDraftSchema.parse(displayedDraft); }
    catch (cause) { setError(safeStylingError(cause)); return; }
    run(async () => { await saveGuestAttireGuidance(membership, guest.id, displayedDraft); });
  };

  return (
    <KatipanScreen contentContainerStyle={styles.screenContent}>
      <PageHeading title="Guest Attire Guidance" subtitle={guest.display_name} weddingId={weddingId} />
      {data.dressCode && <EditorialCard style={styles.summaryCard}>
        <SectionHeader title={`General Dress Code · ${data.dressCode.title}`} description="General guidance remains a separate source from personal and group overrides." />
        <ColorPreview label="Recommended for Guests" colors={data.dressRecommendedColors} />
        <ColorPreview label="Colors to avoid" colors={data.dressAvoidColors} />
      </EditorialCard>}
      <EditorialCard style={styles.summaryCard}>
        <SectionHeader title="Matching Attire Groups" description="A Guest may match several groups through direct targeting or an existing Entourage role." />
        {assignedRoleNames.length > 0 && <KatipanText variant="bodySmall" color="textMuted">Current Entourage roles: {assignedRoleNames.join(", ")}</KatipanText>}
        {matchingGroups.length === 0 ? <KatipanText color="textMuted">No Attire Group currently targets this Guest or their roles.</KatipanText> : matchingGroups.map(({ group, recommendedColors, avoidColors }) => (
          <View key={group.id} style={styles.matchingGroup}>
            <KatipanText variant="title">{group.title}</KatipanText>
            {!!group.instructions && <KatipanText color="textMuted">{group.instructions}</KatipanText>}
            <ColorPreview label="Group recommended colors" colors={recommendedColors} />
            <ColorPreview label="Group colors to avoid" colors={avoidColors} />
            <KatipanButton label="Open Attire Group" variant="text" onPress={() => pushRoute(router, "/(wedding)/[weddingId]/style/attire-groups/[groupId]", { weddingId, groupId: group.id })} />
          </View>
        ))}
      </EditorialCard>
      <EditorialCard style={styles.summaryCard}>
        <SectionHeader title="Guest-specific override" description="Use this for a special case. Instructions are required when a guidance record is saved." />
        {canEdit ? <>
          <FormField label="Guidance title (optional)" value={displayedDraft.title} onChangeText={(title) => setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? initialDraft), title } }))} placeholder="A descriptive label" maxLength={120} />
          <FormField label="Guest-specific instructions" value={displayedDraft.instructions} onChangeText={(instructions) => setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? initialDraft), instructions } }))} placeholder="Instructions for this Guest" multiline numberOfLines={4} maxLength={4000} />
          <FormField label="Private planner notes" value={displayedDraft.notes} onChangeText={(notes) => setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? initialDraft), notes } }))} placeholder="Notes for Wedding members" multiline numberOfLines={3} maxLength={4000} />
          <KatipanButton label={guidance ? "Save Guest Override" : "Add Guest Override"} loading={busy} onPress={save} />
          {guidance && !confirmDelete && <KatipanButton label="Remove Guest Override" variant="text" disabled={busy} onPress={() => setConfirmDelete(true)} />}
          {guidance && confirmDelete && <ConfirmationCard title="Remove this Guest override?" detail="This removes the personal instructions and Guest-specific colors. It doesn't change this Guest's Entourage roles, RSVP, or other group guidance." busy={busy} confirmLabel="Remove override" onCancel={() => setConfirmDelete(false)} onConfirm={() => run(() => deleteGuestAttireGuidance(membership, guest.id, guidance.id), () => setConfirmDelete(false))} />}
        </> : guidance ? <>
          <InfoField label="Title" value={guidance.title} />
          <InfoField label="Instructions" value={guidance.instructions} />
          <InfoField label="Private planner notes" value={guidance.notes} />
        </> : <EmptyState title="No Guest-specific override" description="This Guest uses the applicable Dress Code and Attire Group guidance." />}
        {!!error && <KatipanText accessibilityRole="alert" color="error">{error}</KatipanText>}
      </EditorialCard>
      {guidance && <>
        <ColorCollectionEditor title="Guest-specific recommended colors" description="These colors apply only to this Guest-specific guidance." collection={{ kind: "guest-recommended", parentId: guidance.id }} rows={data.guestRecommendedColors.filter((color) => color.guest_attire_guidance_id === guidance.id)} membership={membership} canEdit={canEdit} onChanged={state.retry} />
        <ColorCollectionEditor title="Guest-specific colors to avoid" description="Keep this list separate from recommended colors and group colors." collection={{ kind: "guest-avoid", parentId: guidance.id }} rows={data.guestAvoidColors.filter((color) => color.guest_attire_guidance_id === guidance.id)} membership={membership} canEdit={canEdit} onChanged={state.retry} />
        <ColorConflictNotice recommended={data.guestRecommendedColors.filter((color) => color.guest_attire_guidance_id === guidance.id)} avoid={data.guestAvoidColors.filter((color) => color.guest_attire_guidance_id === guidance.id)} />
      </>}
      <EditorialCard style={styles.projectionNote}>
        <KatipanText variant="labelCaps" color="secondary">GUEST GUIDE PROJECTION</KatipanText>
        <KatipanText color="textMuted">The existing Guest Guide projection remains authoritative for effective instructions and colors: Guest-specific, then applicable Attire Group, then general Dress Code. This screen shows each source separately and does not calculate a competing projection.</KatipanText>
      </EditorialCard>
    </KatipanScreen>
  );
}

function ColorPreview({ label, colors }: { label: string; colors: readonly { id: string; color_hex: string; name: string | null; sort_order: number }[] }) {
  return (
    <View style={styles.previewBlock}>
      <KatipanText variant="label">{label}</KatipanText>
      {colors.length ? <View style={styles.swatchRow}>
        {[...colors].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)).map((color) => <View key={color.id} style={styles.previewColor}>
          <View style={[styles.summarySwatch, styles.previewSwatch, { backgroundColor: color.color_hex }]} />
          <KatipanText variant="bodySmall" color="textMuted">{color.name || color.color_hex}</KatipanText>
        </View>)}
      </View> : <KatipanText variant="bodySmall" color="textMuted">No colors added.</KatipanText>}
    </View>
  );
}

function InfoField({ label, value, empty }: { label: string; value: string | null | undefined; empty?: string }) {
  if (!value && !empty) return null;
  return <View style={styles.infoField}>
    <KatipanText variant="label">{label}</KatipanText>
    <KatipanText color={value ? "text" : "textMuted"}>{value || empty}</KatipanText>
  </View>;
}

function PageHeading({ title, subtitle, weddingId }: { title: string; subtitle: string; weddingId: string }) {
  const router = useRouter();
  return <>
    <KatipanButton label="Wedding Styling" variant="text" onPress={() => pushRoute(router, "/(wedding)/[weddingId]/style", { weddingId })} />
    <SectionHeader title={title} eyebrow="Wedding styling" description={subtitle} />
  </>;
}

function ConfirmationCard({ title, detail, busy, confirmLabel, onCancel, onConfirm }: {
  title: string; detail: string; busy: boolean; confirmLabel: string; onCancel: () => void; onConfirm: () => void;
}) {
  return <View style={styles.confirmCard}>
    <KatipanText variant="title">{title}</KatipanText>
    <KatipanText variant="bodySmall" color="textMuted">{detail}</KatipanText>
    <View style={styles.confirmActions}>
      <KatipanButton label="Cancel" variant="text" disabled={busy} onPress={onCancel} />
      <KatipanButton label={confirmLabel} variant="secondary" loading={busy} onPress={onConfirm} />
    </View>
  </View>;
}

function SmallButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.smallButton, disabled && styles.disabled]}>
    <KatipanText variant="label" color={disabled ? "outline" : "primary"}>{label}</KatipanText>
  </Pressable>;
}

function ScreenLoading({ label }: { label: string }) {
  return <KatipanScreen><LoadingState label={label} /></KatipanScreen>;
}

function WorkspaceUnavailable() {
  const router = useRouter();
  return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
}

function ScreenError({ title = "Styling unavailable", description, retry }: { title?: string; description: string; retry: () => void }) {
  return <KatipanScreen><ErrorState title={title} description={description} onRetry={retry} /></KatipanScreen>;
}

function pushRoute(router: ReturnType<typeof useRouter>, pathname: string, params: Record<string, string>) {
  router.push({ pathname, params } as unknown as Href);
}

const styles = StyleSheet.create({
  screenContent: { gap: s.large, paddingBottom: s.extraLarge },
  introCard: { gap: s.small, backgroundColor: c.surfaceLow },
  summaryCard: { gap: s.medium },
  swatchRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: s.small },
  summarySwatch: { width: 34, height: 34, borderRadius: r.pill, borderWidth: 1, borderColor: c.stoneBorder },
  previewBlock: { gap: s.small },
  previewColor: { minWidth: 58, alignItems: "center", gap: s.micro },
  previewSwatch: { width: 28, height: 28 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  groupSummaryList: { gap: s.small },
  summaryGroupRow: { gap: s.micro, paddingVertical: s.small, borderBottomColor: c.outlineSubtle, borderBottomWidth: 1 },
  groupList: { gap: s.small },
  groupRow: { flexDirection: "row", alignItems: "center", gap: s.small, borderBottomWidth: 1, borderBottomColor: c.outlineSubtle, paddingVertical: s.small },
  groupPressable: { flex: 1, gap: s.micro, paddingVertical: s.small },
  groupActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end" },
  smallButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: s.small, borderRadius: r.pill },
  disabled: { opacity: 0.5 },
  targetList: { gap: s.small },
  matchingGroup: { gap: s.small, paddingTop: s.medium, borderTopWidth: 1, borderTopColor: c.outlineSubtle },
  infoField: { gap: s.small, paddingVertical: s.small },
  confirmCard: { gap: s.small, padding: s.medium, backgroundColor: c.surfaceLow, borderRadius: r.medium },
  confirmActions: { flexDirection: "row", flexWrap: "wrap", gap: s.small, alignItems: "center", justifyContent: "flex-end" },
  projectionNote: { gap: s.small, backgroundColor: c.surfaceLow },
});
