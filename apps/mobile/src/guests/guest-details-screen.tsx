import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import {
  addGuestToGroup,
  claimGuestAllowance,
  createGuestAllowance,
  deleteGuestAllowance,
  releaseGuestAllowanceClaim,
  removeGuestFromGroup,
  setGuestRsvp,
  updateGuestAllowance,
} from "./api";
import { getGuestPass, issueGuestPass, revokeGuestPass, rotateGuestPass } from "./guest-pass-api";
import { AllowanceCard, AllowanceForm } from "./allowance-components";
import { GuestFilterChip } from "./components";
import {
  buildGuestEntries,
  canManageGuestPass,
  canManageGuestDomain,
  canViewGuestNotes,
  guestAllowanceLabel,
  guestName,
  guestRsvpLabel,
  guestRsvpStatus,
  guestRsvpStatuses,
  guestPassActionState,
  isRevokedGuestPassError,
  safeGuestPassError,
  safeGuestError,
  SingleSubmitGate,
  type GuestEntry,
  type GuestAllowanceDraft,
  type GuestPass,
  type GuestWorkspaceData,
} from "./model";
import { useGuestWorkspace } from "./use-guest-workspace";
import type { WorkspaceMembership } from "../workspace/model";
import {
  EditorialCard,
  ErrorState,
  FormField,
  KatipanButton,
  KatipanScreen,
  KatipanText,
  LoadingState,
  SectionHeader,
  StatusChip,
} from "../ui";

export default function GuestDetailsScreen() {
  const params = useLocalSearchParams<{ guestId?: string | string[] }>();
  const guestId = Array.isArray(params.guestId) ? params.guestId[0] ?? "" : params.guestId ?? "";
  const { weddingId, membership, isCurrent, loading, error, data, retry } = useGuestWorkspace();
  const router = useRouter();
  const entries = data ? buildGuestEntries(data) : [];
  const entry = entries.find((item) => item.guest.id === guestId && item.guest.wedding_id === weddingId);

  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading Guest details…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load this Guest." onRetry={retry} /></KatipanScreen>;
  if (!entry) return <KatipanScreen><ErrorState title="Guest unavailable" description="This Guest isn't part of the selected Wedding." onRetry={() => router.replace({ pathname: "/(wedding)/[weddingId]/guests/list", params: { weddingId } })} /></KatipanScreen>;

  return <GuestDetailsContent key={`${weddingId}:${entry.guest.id}:${entry.guest.updated_at}:${entry.rsvp?.updated_at ?? "none"}`} weddingId={weddingId} membership={membership} data={data} entry={entry} retry={retry} />;
}

function GuestDetailsContent({
  weddingId,
  membership,
  data,
  entry,
  retry,
}: {
  weddingId: string;
  membership: WorkspaceMembership;
  data: GuestWorkspaceData;
  entry: GuestEntry;
  retry: () => void;
}) {
  const router = useRouter();
  const gate = useRef(new SingleSubmitGate());
  const [selectedStatus, setSelectedStatus] = useState<(typeof guestRsvpStatuses)[number]>(() => guestRsvpStatus(entry.rsvp));
  const [mealChoice, setMealChoice] = useState(() => entry.rsvp?.meal_choice ?? "");
  const [dietaryNotes, setDietaryNotes] = useState(() => entry.rsvp?.dietary_notes ?? "");
  const [responseNotes, setResponseNotes] = useState(() => entry.rsvp?.response_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [savingAllowanceId, setSavingAllowanceId] = useState<string | null>(null);
  const [savingGuestId, setSavingGuestId] = useState<string | null>(null);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [allowanceEditor, setAllowanceEditor] = useState<string | "NEW" | null>(null);
  const [confirmingDeleteAllowanceId, setConfirmingDeleteAllowanceId] = useState<string | null>(null);
  const canEdit = canManageGuestDomain(membership);
  const canReadNotes = canViewGuestNotes(membership);
  const rsvpStatus = guestRsvpStatus(entry.rsvp);
  const allowanceById = new Map(data.allowances.filter((item) => item.wedding_id === weddingId).map((item) => [item.id, item]));
  const entries = buildGuestEntries(data);
  const householdMembers = entries.filter((candidate) => candidate.household.id === entry.household.id);
  const sponsoredAllowances = data.allowances.filter((allowance) => allowance.wedding_id === weddingId && allowance.sponsor_guest_id === entry.guest.id);
  const runMutation = async (
    action: () => Promise<void>,
    fallback = "We couldn't save this Guest change.",
    allowanceId?: string,
    guestId?: string,
  ) => {
    await gate.current.run(async () => {
      if (saving) return;
      setSaving(true);
      setSavingAllowanceId(allowanceId ?? null);
      setSavingGuestId(guestId ?? null);
      setSavingError(null);
      try {
        await action();
        retry();
      } catch (cause) {
        setSavingError(safeGuestError(cause, fallback));
      } finally {
        setSaving(false);
        setSavingAllowanceId(null);
        setSavingGuestId(null);
      }
    });
  };
  const saveRsvp = async () => runMutation(
    () => setGuestRsvp(membership, entry.guest.id, selectedStatus, mealChoice, dietaryNotes, responseNotes),
    "We couldn't update this Guest's RSVP.",
  );
  const editGuest = () => router.navigate({
    pathname: "/(wedding)/[weddingId]/guests/[guestId]/edit",
    params: { weddingId, guestId: entry.guest.id },
  });
  const openHousehold = () => router.navigate({
    pathname: "/(wedding)/[weddingId]/guests/households/[householdId]",
    params: { weddingId, householdId: entry.household.id },
  });
  const openGuestList = () => router.navigate({ pathname: "/(wedding)/[weddingId]/guests/list", params: { weddingId } });
  const openEntourage = () => router.navigate({ pathname: "/(wedding)/[weddingId]/guests/entourage", params: { weddingId } });
  const openSeating = () => router.navigate({ pathname: "/(wedding)/[weddingId]/seating", params: { weddingId } });
  const toggleGroup = (groupId: string) => {
    const isMember = entry.groupIds.includes(groupId);
    void runMutation(
      () => isMember
        ? removeGuestFromGroup(membership, groupId, entry.guest.id)
        : addGuestToGroup(membership, groupId, entry.guest.id),
      "We couldn't update this Guest's groups.",
      undefined,
      entry.guest.id,
    );
  };
  const saveAllowance = (allowanceId: string | null, draft: GuestAllowanceDraft) => {
    void runMutation(async () => {
      if (allowanceId) await updateGuestAllowance(membership, allowanceId, draft);
      else await createGuestAllowance(membership, draft);
      setAllowanceEditor(null);
    }, "We couldn't save this allowance.", allowanceId ?? entry.guest.id);
  };
  const removeAllowance = (allowanceId: string) => {
    void runMutation(async () => {
      await deleteGuestAllowance(membership, allowanceId);
      setConfirmingDeleteAllowanceId(null);
    }, "We couldn't remove this allowance.", allowanceId);
  };
  const claimAllowance = (allowanceId: string, guestId: string) => {
    void runMutation(
      () => claimGuestAllowance(membership, allowanceId, guestId),
      "We couldn't claim this allowance.",
      allowanceId,
      guestId,
    );
  };
  const releaseAllowance = (allowanceId: string, guestId: string) => {
    void runMutation(
      () => releaseGuestAllowanceClaim(membership, allowanceId, guestId),
      "We couldn't release this allowance claim.",
      allowanceId,
      guestId,
    );
  };

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">GUEST / INDIVIDUAL DETAILS</KatipanText>
        <View style={styles.personHeading}>
          <View style={styles.avatar}><KatipanText variant="headlineMedium" color="primary">{guestName(entry).slice(0, 1).toUpperCase()}</KatipanText></View>
          <View style={styles.titleCopy}>
            <KatipanText variant="headlineLarge" accessibilityRole="header">{guestName(entry)}</KatipanText>
            <GuestFilterChip label={entry.household.display_name} selected={false} onPress={openHousehold} />
          </View>
        </View>
        <GuestRsvpHeader status={rsvpStatus} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Contact & personal details" description="Wedding Person data linked to this individual Guest" />
        <EditorialCard style={styles.detailsCard}>
          {!!entry.person.email && <DetailLine label="Email" value={entry.person.email} />}
          {!!entry.person.phone && <DetailLine label="Phone" value={entry.person.phone} />}
          {!!entry.person.first_name && <DetailLine label="First name" value={entry.person.first_name} />}
          {!!entry.person.last_name && <DetailLine label="Last name" value={entry.person.last_name} />}
          {!entry.person.email && !entry.person.phone && !entry.person.first_name && !entry.person.last_name && <KatipanText color="textMuted">No contact details are recorded.</KatipanText>}
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Individual RSVP" description="This response belongs to this Guest, not the Household." />
        <EditorialCard style={styles.rsvpCard}>
          <View style={styles.statusRow}>
            {guestRsvpStatuses.map((status) => (
              <GuestFilterChip
                key={status}
                label={guestRsvpLabel(status)}
                selected={selectedStatus === status}
                disabled={!canEdit || saving}
                onPress={() => setSelectedStatus(status)}
              />
            ))}
          </View>
          <FormField label="Meal choice" value={mealChoice} onChangeText={setMealChoice} editable={canEdit && !saving} placeholder="No meal choice recorded" maxLength={160} />
          <FormField label="Dietary notes" value={dietaryNotes} onChangeText={setDietaryNotes} editable={canEdit && !saving} placeholder="No dietary notes recorded" multiline numberOfLines={3} maxLength={2000} />
          <FormField label="Response notes" value={responseNotes} onChangeText={setResponseNotes} editable={canEdit && !saving} placeholder="Optional RSVP context" multiline numberOfLines={3} maxLength={2000} />
          {entry.rsvp?.responded_at && <KatipanText variant="bodySmall" color="textMuted">Response recorded {new Date(entry.rsvp.responded_at).toLocaleDateString()}</KatipanText>}
          {canEdit && <KatipanButton label="Save RSVP details" loading={saving} onPress={() => void saveRsvp()} />}
        </EditorialCard>
      </View>

      <GuestPassManagementSection
        membership={membership}
        guestId={entry.guest.id}
        guestName={guestName(entry)}
        rsvpStatus={rsvpStatus}
      />

      <View style={styles.section}>
        <SectionHeader
          title="Guest groups"
          description="A Guest can belong to more than one group."
          action={canEdit ? <KatipanButton label="Manage groups" variant="text" onPress={openGuestList} /> : undefined}
        />
        <EditorialCard style={styles.detailsCard}>
          {data.groups.filter((group) => group.wedding_id === weddingId).length ? (
            <View style={styles.chipRow}>
              {data.groups.filter((group) => group.wedding_id === weddingId).map((group) => (
                <GuestFilterChip
                  key={group.id}
                  label={group.name}
                  selected={entry.groupIds.includes(group.id)}
                  disabled={!canEdit || saving}
                  onPress={() => toggleGroup(group.id)}
                />
              ))}
            </View>
          ) : (
            <KatipanText color="textMuted">No guest groups exist yet. Create a group from the Guest List.</KatipanText>
          )}
          {canEdit && <KatipanText variant="bodySmall" color="textMuted">Tap a group to add or remove this Guest.</KatipanText>}
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Allowance claim" description="A claim links this named Guest to one allowance. RSVP stays separate." />
        <EditorialCard style={styles.detailsCard}>
          {entry.allowanceClaims.length ? entry.allowanceClaims.map((claim) => {
            const allowance = allowanceById.get(claim.allowance_id);
            const claimCount = data.allowanceClaims.filter((item) => item.allowance_id === claim.allowance_id && item.wedding_id === weddingId).length;
            const sponsor = allowance?.sponsor_guest_id ? entries.find((candidate) => candidate.guest.id === allowance.sponsor_guest_id) : undefined;
            return (
              <View key={claim.allowance_id} style={styles.claimSummary}>
                <DetailLine
                  label={allowance ? guestAllowanceLabel(allowance.allowance_type) : "Allowance"}
                  value={allowance ? `${claimCount} of ${allowance.max_count} claimed` : "Claim association unavailable"}
                />
                {!!sponsor && <DetailLine label="Sponsored by" value={guestName(sponsor)} />}
                {canEdit && allowance && <KatipanButton label="Release this claim" variant="secondary" loading={saving && savingAllowanceId === allowance.id && savingGuestId === entry.guest.id} onPress={() => releaseAllowance(allowance.id, entry.guest.id)} />}
              </View>
            );
          }) : <KatipanText color="textMuted">No allowance is claimed for this Guest.</KatipanText>}
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Sponsored Plus-One allowances"
          description="Allowance capacity belongs to this Guest and Household; adding one does not add a person."
          action={canEdit ? <KatipanButton label="Add allowance" variant="text" disabled={saving} onPress={() => { setAllowanceEditor("NEW"); setSavingError(null); }} /> : undefined}
        />
        {allowanceEditor === "NEW" && (
          <AllowanceForm
            key="new-plus-one"
            householdId={entry.household.id}
            members={householdMembers}
            fixedType="PLUS_ONE"
            fixedSponsorGuestId={entry.guest.id}
            saving={saving}
            onCancel={() => setAllowanceEditor(null)}
            onSave={(draft) => saveAllowance(null, draft)}
          />
        )}
        {sponsoredAllowances.length === 0 && allowanceEditor !== "NEW" ? (
          <EditorialCard style={styles.detailsCard}>
            <KatipanText color="textMuted">This Guest does not sponsor a Plus-One allowance.</KatipanText>
          </EditorialCard>
        ) : sponsoredAllowances.map((allowance) => {
          const claims = data.allowanceClaims.filter((claim) => claim.allowance_id === allowance.id && claim.wedding_id === weddingId);
          return (
            <View key={allowance.id} style={styles.allowanceSection}>
              {allowanceEditor === allowance.id ? (
                <AllowanceForm
                  key={allowance.id}
                  householdId={allowance.household_id}
                  members={householdMembers}
                  existing={allowance}
                  fixedType="PLUS_ONE"
                  fixedSponsorGuestId={entry.guest.id}
                  saving={saving}
                  onCancel={() => setAllowanceEditor(null)}
                  onSave={(draft) => saveAllowance(allowance.id, draft)}
                />
              ) : (
                <AllowanceCard
                  allowance={allowance}
                  claims={claims}
                  allClaims={data.allowanceClaims.filter((claim) => claim.wedding_id === weddingId)}
                  members={householdMembers}
                  sponsor={entry}
                  canEdit={canEdit}
                  saving={saving}
                  claimingGuestId={savingAllowanceId === allowance.id ? savingGuestId : null}
                  confirmingDelete={confirmingDeleteAllowanceId === allowance.id}
                  onClaim={(guestId) => claimAllowance(allowance.id, guestId)}
                  onRelease={(guestId) => releaseAllowance(allowance.id, guestId)}
                  onEdit={() => { setAllowanceEditor(allowance.id); setSavingError(null); }}
                  onRequestDelete={() => setConfirmingDeleteAllowanceId(allowance.id)}
                  onDelete={() => removeAllowance(allowance.id)}
                  onCancelDelete={() => setConfirmingDeleteAllowanceId(null)}
                />
              )}
            </View>
          );
        })}
      </View>

      {entry.entourageRoles !== null && (
        <View style={styles.section}>
          <SectionHeader
            title="Entourage roles"
            description="Existing roles use this Guest record."
            action={<KatipanButton label={canEdit ? "Manage roles" : "View roles"} variant="text" onPress={openEntourage} />}
          />
          <EditorialCard style={styles.detailsCard}>
            {entry.entourageRoles.length
              ? <View style={styles.chipRow}>{entry.entourageRoles.map((role) => <StatusChip key={role} label={role} tone="success" />)}</View>
              : <KatipanText color="textMuted">No entourage role is recorded.</KatipanText>}
            <KatipanText variant="bodySmall" color="textMuted">A role does not change this Guest&apos;s RSVP, seating, Guest Pass or check-in.</KatipanText>
          </EditorialCard>
        </View>
      )}

      {entry.seating !== null && (
        <View style={styles.section}>
          <SectionHeader title="Reception seating" description="Seating is tracked separately from RSVP and event check-in." action={<KatipanButton label={canEdit ? "Manage seating" : "View seating"} variant="text" onPress={openSeating} />} />
          <EditorialCard style={styles.detailsCard}>
            {entry.seating.length ? entry.seating.map((item) => (
              <DetailLine key={`${item.eventName}:${item.tableName}`} label={item.eventName} value={`${item.tableName}${item.seatLabel ? ` · Seat ${item.seatLabel}` : " · Table only"}`} />
            )) : rsvpStatus === "ATTENDING" ? <KatipanText color="textMuted">This Attending Guest is not seated at the Reception yet.</KatipanText> : <KatipanText color="textMuted">No Reception seating assignment is recorded.</KatipanText>}
          </EditorialCard>
        </View>
      )}

      {canReadNotes && (!!entry.guest.accessibility_assistance_note?.trim() || !!entry.guest.internal_notes?.trim()) && (
        <View style={styles.section}>
          <SectionHeader title="Private planner notes" description="Available to guest-domain managers" />
          <EditorialCard style={styles.notesCard}>
            {!!entry.guest.accessibility_assistance_note?.trim() && <DetailLine label="Accessibility assistance" value={entry.guest.accessibility_assistance_note} />}
            {!!entry.guest.internal_notes?.trim() && <DetailLine label="Internal note" value={entry.guest.internal_notes} />}
          </EditorialCard>
        </View>
      )}

      <EditorialCard style={styles.separationCard}>
        <KatipanText variant="labelCaps" color="secondary">SEPARATE GUEST-DAY STATES</KatipanText>
        <KatipanText variant="bodySmall" color="textMuted">Invitation delivery, RSVP, seating, Guest Pass and check-in are tracked independently. This RSVP does not confirm seating, a Guest Pass or check-in.</KatipanText>
      </EditorialCard>

      {!!savingError && <KatipanText accessibilityRole="alert" color="error">{savingError}</KatipanText>}
      {canEdit && <KatipanButton label="Edit Guest Details" variant="secondary" onPress={editGuest} />}
    </KatipanScreen>
  );
}

function GuestPassManagementSection({
  membership,
  guestId,
  guestName: displayName,
  rsvpStatus,
}: {
  membership: WorkspaceMembership;
  guestId: string;
  guestName: string;
  rsvpStatus: (typeof guestRsvpStatuses)[number];
}) {
  const canManage = canManageGuestPass(membership);
  const passActionGate = useRef(new SingleSubmitGate());
  const [pass, setPass] = useState<GuestPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [priorPassWasRevoked, setPriorPassWasRevoked] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<"REVOKE" | "ROTATE" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!canManage) return () => { cancelled = true; };
    void getGuestPass(membership, guestId)
      .then((current) => { if (!cancelled) setPass(current); })
      .catch((cause: unknown) => { if (!cancelled) setLoadError(safeGuestPassError(cause)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [canManage, guestId, membership, reloadKey]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError(null);
    setReloadKey((key) => key + 1);
  };

  const runAction = async (action: () => Promise<void>) => passActionGate.current.run(async () => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (cause) {
      if (isRevokedGuestPassError(cause)) setPriorPassWasRevoked(true);
      setActionError(safeGuestPassError(cause));
    } finally {
      setBusy(false);
    }
  });
  const actions = guestPassActionState(rsvpStatus, pass, priorPassWasRevoked);
  const issue = () => runAction(async () => {
    const created = await issueGuestPass(membership, guestId);
    setPass(created);
    setPriorPassWasRevoked(false);
  });
  const revoke = () => runAction(async () => {
    await revokeGuestPass(membership, guestId);
    setPass(null);
    setPriorPassWasRevoked(true);
    setConfirmingAction(null);
    setPreviewOpen(false);
  });
  const rotate = () => runAction(async () => {
    const replacement = await rotateGuestPass(membership, guestId);
    setPass(replacement);
    setPriorPassWasRevoked(false);
    setConfirmingAction(null);
    setPreviewOpen(false);
  });

  return (
    <View style={styles.section}>
      <SectionHeader title="Guest Pass" description="One Pass belongs to this individual Guest. RSVP and seating remain separate." />
      <EditorialCard style={styles.guestPassCard}>
        {!canManage ? (
          <KatipanText color="textMuted">Guest Pass management is available to an active Owner or Full Coordinator.</KatipanText>
        ) : loading ? (
          <View style={styles.passLoading}>
            <ActivityIndicator color={c.primary} />
            <KatipanText color="textMuted">Checking this Guest&apos;s Pass…</KatipanText>
          </View>
        ) : loadError ? (
          <>
            <KatipanText accessibilityRole="alert" color="error">{loadError}</KatipanText>
            <KatipanButton label="Try again" variant="secondary" disabled={busy} onPress={retryLoad} />
          </>
        ) : (
          <>
            {rsvpStatus !== "ATTENDING" && (
              <KatipanText color="textMuted">
                This Guest must be Attending before a Pass can be issued or rotated. RSVP stays separate and will not change here.
              </KatipanText>
            )}
            {pass && (
              <View style={styles.passSummary}>
                <View style={styles.passHeading}>
                  <View style={styles.passCopy}>
                    <KatipanText variant="title">Active Guest Pass</KatipanText>
                    <KatipanText variant="bodySmall" color="textMuted">For {displayName}</KatipanText>
                  </View>
                  <StatusChip label="Active" tone="success" />
                </View>
                <DetailLine label="Reference" value={pass.reference} />
                <DetailLine label="Issued" value={new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(pass.issuedAt))} />
                {rsvpStatus === "ATTENDING" ? (
                  <View style={styles.passActionRow}>
                    <KatipanButton label="Preview Pass" variant="secondary" disabled={busy} onPress={() => setPreviewOpen(true)} />
                    <KatipanButton label="Revoke Pass" variant="text" disabled={busy} onPress={() => setConfirmingAction("REVOKE")} />
                    <KatipanButton label="Rotate Pass" variant="text" disabled={busy} onPress={() => setConfirmingAction("ROTATE")} />
                  </View>
                ) : (
                  <KatipanButton label="Revoke Pass" variant="secondary" disabled={busy} onPress={() => setConfirmingAction("REVOKE")} />
                )}
              </View>
            )}
            {!pass && rsvpStatus === "ATTENDING" && actions.primaryAction === "ISSUE" && (
              <KatipanButton label="Issue Guest Pass" loading={busy} onPress={() => void issue()} />
            )}
            {!pass && rsvpStatus === "ATTENDING" && actions.primaryAction === "ROTATE" && (
              <KatipanButton label="Rotate Guest Pass" loading={busy} onPress={() => setConfirmingAction("ROTATE")} />
            )}
            {!pass && rsvpStatus === "ATTENDING" && !priorPassWasRevoked && !actionError && (
              <KatipanText variant="bodySmall" color="textMuted">Issuing a Pass does not change RSVP or Seating. Reopening this screen will show the same active Pass.</KatipanText>
            )}
            {!!actionError && <KatipanText accessibilityRole="alert" color="error">{actionError}</KatipanText>}
            {confirmingAction && (
              <View style={styles.passConfirmation}>
                <KatipanText variant="title">
                  {confirmingAction === "REVOKE" ? "Revoke this Guest Pass?" : "Rotate this Guest Pass?"}
                </KatipanText>
                <KatipanText variant="bodySmall" color="textMuted">
                  {confirmingAction === "REVOKE"
                    ? "The current QR will stop working. RSVP, Seating, and Guest identity will stay unchanged."
                    : "The current QR will be invalidated and a new Pass issued for this Guest. RSVP and Seating will stay unchanged."}
                </KatipanText>
                <View style={styles.passActionRow}>
                  <KatipanButton label="Cancel" variant="secondary" disabled={busy} onPress={() => setConfirmingAction(null)} />
                  <KatipanButton
                    label={confirmingAction === "REVOKE" ? "Confirm revoke" : "Confirm rotation"}
                    loading={busy}
                    onPress={() => void (confirmingAction === "REVOKE" ? revoke() : rotate())}
                  />
                </View>
              </View>
            )}
          </>
        )}
      </EditorialCard>
      {pass && actions.canPreview && (
        <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
          <View style={styles.passModalBackdrop}>
            <View style={styles.passModalCard}>
              <KatipanText variant="labelCaps" color="secondary">GUEST PASS PREVIEW</KatipanText>
              <KatipanText variant="headlineMedium" accessibilityRole="header">{displayName}</KatipanText>
              <View style={styles.passQrQuietZone} accessible accessibilityLabel={`QR code for ${displayName}`}>
                <QRCode
                  value={pass.qrPayload}
                  size={248}
                  quietZone={16}
                  ecl="H"
                  color="#1E1B19"
                  backgroundColor="#FFFFFF"
                />
              </View>
              <KatipanText variant="labelLarge">{pass.reference}</KatipanText>
              <KatipanButton label="Close preview" variant="secondary" onPress={() => setPreviewOpen(false)} />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function GuestRsvpHeader({ status }: { status: (typeof guestRsvpStatuses)[number] }) {
  const tone = status === "ATTENDING" ? "success" : status === "DECLINED" ? "error" : "warning";
  return <StatusChip label={guestRsvpLabel(status)} tone={tone} />;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <KatipanText variant="bodySmall" color="textMuted">{label}</KatipanText>
      <KatipanText variant="bodySmall" style={styles.detailValue}>{value}</KatipanText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  titleBlock: { gap: s.medium },
  personHeading: { flexDirection: "row", alignItems: "center", gap: s.medium },
  avatar: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: r.pill, backgroundColor: c.primaryFixed, borderWidth: 1, borderColor: c.stoneBorder },
  titleCopy: { flex: 1, gap: s.small },
  section: { gap: s.medium },
  detailsCard: { gap: s.medium },
  rsvpCard: { gap: s.medium, padding: s.medium },
  guestPassCard: { gap: s.medium, padding: s.medium },
  passLoading: { flexDirection: "row", alignItems: "center", gap: s.small },
  passSummary: { gap: s.medium },
  passHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  passCopy: { flex: 1, gap: s.micro },
  passActionRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: s.small },
  passConfirmation: { gap: s.small, padding: s.medium, borderRadius: 16, backgroundColor: c.surfaceLow },
  passModalBackdrop: { flex: 1, justifyContent: "center", padding: s.medium, backgroundColor: "rgba(30, 27, 25, 0.48)" },
  passModalCard: { alignItems: "center", gap: s.medium, padding: s.medium, borderRadius: 24, backgroundColor: c.surface },
  passQrQuietZone: { alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 12, backgroundColor: "#FFFFFF" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  detailLine: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s.medium },
  detailValue: { flex: 1, textAlign: "right" },
  claimSummary: { gap: s.small },
  allowanceSection: { gap: s.medium },
  notesCard: { gap: s.medium, padding: s.medium, backgroundColor: c.warmAlabaster },
  separationCard: { gap: s.small, padding: s.medium, backgroundColor: c.surfaceLow },
});
