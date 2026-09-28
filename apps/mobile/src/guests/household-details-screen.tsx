import { useEffect, useRef, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colorTokens as c, spacingTokens as s } from "@katipan/ui";
import {
  claimGuestAllowance,
  createGuestAllowance,
  deleteGuestAllowance,
  markHouseholdInvitationSent,
  releaseGuestAllowanceClaim,
  resetHouseholdInvitationDelivery,
  updateGuestAllowance,
} from "./api";
import { AllowanceCard, AllowanceForm } from "./allowance-components";
import { GuestRow, ProgressBar } from "./components";
import {
  buildGuestEntries,
  canManageGuestDomain,
  canViewGuestNotes,
  deriveHouseholdProgress,
  householdProgressLabel,
  safeGuestError,
  SingleSubmitGate,
} from "./model";
import { useGuestWorkspace } from "./use-guest-workspace";
import { issueHouseholdAccess, loadWebsite, revokeHouseholdAccess } from "../website/api";
import { canManageWebsite } from "../website/model";
import {
  EditorialCard,
  EmptyState,
  ErrorState,
  KatipanButton,
  KatipanScreen,
  KatipanText,
  LoadingState,
  SectionHeader,
  StatusChip,
} from "../ui";

export default function HouseholdDetailsScreen() {
  const params = useLocalSearchParams<{ householdId?: string | string[] }>();
  const householdId = Array.isArray(params.householdId) ? params.householdId[0] ?? "" : params.householdId ?? "";
  const { weddingId, membership, isCurrent, loading, error, data, retry } = useGuestWorkspace();
  const router = useRouter();
  const gate = useRef(new SingleSubmitGate());
  const [saving, setSaving] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [claimingAllowanceId, setClaimingAllowanceId] = useState<string | null>(null);
  const [claimingGuestId, setClaimingGuestId] = useState<string | null>(null);
  const [allowanceEditor, setAllowanceEditor] = useState<string | "NEW" | null>(null);
  const [confirmingDeleteAllowanceId, setConfirmingDeleteAllowanceId] = useState<string | null>(null);
  const [websiteInfo, setWebsiteInfo] = useState<{ weddingId: string; slug: string | null; published: boolean } | null>(null);
  const websiteSlug = websiteInfo?.weddingId === weddingId ? websiteInfo.slug : null;
  const websitePublished = websiteInfo?.weddingId === weddingId && websiteInfo.published;
  const [issuedLink, setIssuedLink] = useState<{ weddingId: string; householdId: string; url: string } | null>(null);
  const [confirmAccess, setConfirmAccess] = useState<"issue" | "revoke" | null>(null);
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const accessGate = useRef(new SingleSubmitGate());
  useEffect(() => {
    let alive = true;
    if (membership && isCurrent) void loadWebsite(membership).then(value => {
      if (alive) setWebsiteInfo({ weddingId: membership.weddingId, slug: value.site?.slug ?? null, published: value.site?.is_published ?? false });
    }).catch(() => { if (alive) setWebsiteInfo(null); });
    return () => { alive = false; };
  }, [membership, isCurrent]);

  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading Household details…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load this Household." onRetry={retry} /></KatipanScreen>;

  const household = data.households.find((item) => item.id === householdId && item.wedding_id === weddingId);
  if (!household) return <KatipanScreen><ErrorState title="Household unavailable" description="This Household isn't part of the selected Wedding." onRetry={() => router.replace({ pathname: "/(wedding)/[weddingId]/guests/list", params: { weddingId } })} /></KatipanScreen>;

  const canEdit = canManageGuestDomain(membership);
  const canReadNotes = canViewGuestNotes(membership);
  const entries = buildGuestEntries(data);
  const members = entries.filter((entry) => entry.household.id === household.id);
  const derived = deriveHouseholdProgress(household.id, data.guests, data.rsvps);
  const viewProgress = data.householdProgress.find((row) => row.household_id === household.id);
  const totalGuests = viewProgress?.total_guests ?? derived.totalGuests;
  const respondedGuests = viewProgress?.responded_guests ?? derived.respondedGuests;
  const progressStatus = viewProgress?.progress ?? derived.progress;
  const progressPercent = totalGuests === 0 ? 0 : Math.round((respondedGuests / totalGuests) * 100);
  const allowances = data.allowances.filter((item) => item.wedding_id === weddingId && item.household_id === household.id);

  const runMutation = async (action: () => Promise<void>, allowanceId?: string, guestId?: string) => {
    await gate.current.run(async () => {
      if (saving) return;
      setSaving(true);
      setSavingError(null);
      setClaimingAllowanceId(allowanceId ?? null);
      setClaimingGuestId(guestId ?? null);
      try {
        await action();
        retry();
      } catch (cause) {
        setSavingError(safeGuestError(cause));
      } finally {
        setSaving(false);
        setClaimingAllowanceId(null);
        setClaimingGuestId(null);
      }
    });
  };
  const openGuest = (guestId: string) => router.navigate({
    pathname: "/(wedding)/[weddingId]/guests/[guestId]",
    params: { weddingId, guestId },
  });
  const addGuest = () => router.navigate({ pathname: "/(wedding)/[weddingId]/guests/add", params: { weddingId, householdId } });
  const editHousehold = () => router.navigate({
    pathname: "/(wedding)/[weddingId]/guests/households/[householdId]/edit",
    params: { weddingId, householdId },
  });

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">GUESTS / HOUSEHOLD</KatipanText>
        <KatipanText variant="headlineLarge" accessibilityRole="header">{household.display_name}</KatipanText>
        <View style={styles.badgeRow}>
          <StatusChip label={household.delivery_status === "SENT" ? "Invitation sent" : "Not sent"} tone={household.delivery_status === "SENT" ? "success" : "neutral"} />
          <StatusChip label={householdProgressLabel(progressStatus)} tone={progressStatus === "RESPONDED" ? "success" : progressStatus === "PARTIALLY_RESPONDED" ? "warning" : "neutral"} />
        </View>
      </View>

      {canEdit && <View style={styles.actionRow}>
        <KatipanButton label="Edit Household" variant="secondary" onPress={editHousehold} />
        <KatipanButton label="Add Guest" onPress={addGuest} />
      </View>}

      <View style={styles.section}>
        <SectionHeader title="Household invitation" description="Invitation delivery is separate from individual RSVP responses." />
        <EditorialCard style={styles.deliveryCard}>
          <View style={styles.deliveryHeading}>
            <View style={styles.deliveryCopy}>
              <KatipanText variant="labelCaps" color="secondary">DELIVERY STATUS</KatipanText>
              <KatipanText variant="headlineSmall">{household.delivery_status === "SENT" ? "Sent" : "Not sent"}</KatipanText>
              {!!household.sent_at && <KatipanText variant="bodySmall" color="textMuted">Recorded {new Date(household.sent_at).toLocaleDateString()}</KatipanText>}
            </View>
            <StatusChip label="Household" tone="neutral" />
          </View>
          {canEdit && (household.delivery_status === "SENT"
            ? <KatipanButton label="Reset to Not Sent" variant="secondary" loading={saving && !claimingAllowanceId} onPress={() => void runMutation(() => resetHouseholdInvitationDelivery(membership, household.id))} />
            : <KatipanButton label="Mark Invitation Sent" loading={saving && !claimingAllowanceId} onPress={() => void runMutation(() => markHouseholdInvitationSent(membership, household.id))} />)}
          <KatipanText variant="bodySmall" color="textMuted">This records delivery tracking only. It doesn&apos;t send an invitation or change any Guest&apos;s RSVP.</KatipanText>
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Wedding website access" description="One Household invitation link opens the personalized Guest Guide. Creating a link does not send an invitation or change delivery status." />
        <EditorialCard style={styles.deliveryCard}>
          <KatipanText variant="labelCaps" color="secondary">HOUSEHOLD LINK</KatipanText>
          <KatipanText color="textMuted">{websiteSlug ? `katipan.ph/w/${websiteSlug}` : "Create the Wedding website first."}</KatipanText>
          {websiteSlug && !websitePublished && <KatipanText color="textMuted">The website is still a draft. A link will work after publication.</KatipanText>}
          {canManageWebsite(membership) && websiteSlug && <>
            {confirmAccess === null ? <View style={styles.actionRow}>
              <KatipanButton label="Issue new access link" variant="secondary" disabled={accessBusy} onPress={() => setConfirmAccess("issue")} />
              <KatipanButton label="Revoke Household access" variant="text" disabled={accessBusy} onPress={() => setConfirmAccess("revoke")} />
            </View> : <>
              <KatipanText variant="headlineSmall">{confirmAccess === "issue" ? "Issue a new link?" : "Revoke access?"}</KatipanText>
              <KatipanText color="textMuted">{confirmAccess === "issue" ? "Any previous link for this Household will stop working. Share the new link intentionally." : "The old link will stop working. Guests, RSVP, seating and Guest Passes remain saved."}</KatipanText>
              <View style={styles.actionRow}>
                <KatipanButton label="Cancel" variant="secondary" onPress={() => setConfirmAccess(null)} />
                <KatipanButton label={confirmAccess === "issue" ? "Confirm issue" : "Confirm revoke"} loading={accessBusy} onPress={() => void accessGate.current.run(async () => {
                  setAccessBusy(true); setAccessError(null);
                  try {
                    if (confirmAccess === "issue") {
                      const token = await issueHouseholdAccess(membership, householdId);
                      setIssuedLink({ weddingId, householdId, url: `https://katipan.ph/w/${websiteSlug}?token=${token}` });
                    } else { await revokeHouseholdAccess(membership, householdId); setIssuedLink(null); }
                    setConfirmAccess(null);
                  } catch { setAccessError("We couldn't change Household access. Refresh and try again."); }
                  finally { setAccessBusy(false); }
                })} />
              </View>
            </>}
            {issuedLink?.weddingId === weddingId && issuedLink.householdId === householdId && <View style={styles.deliveryCard}>
              <KatipanText variant="labelCaps" color="secondary">NEW LINK · SHOWN THIS SESSION ONLY</KatipanText>
              <KatipanText selectable>{issuedLink.url}</KatipanText>
              <KatipanButton label="Share link" variant="secondary" onPress={() => void Share.share({ message: issuedLink.url })} />
              <KatipanButton label="Hide link" variant="text" onPress={() => setIssuedLink(null)} />
            </View>}
            {!!accessError && <KatipanText color="error">{accessError}</KatipanText>}
          </>}
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title="RSVP progress" description="Derived from the responses of named Guests in this Household." />
        <EditorialCard style={styles.progressCard}>
          <View style={styles.progressHeading}>
            <View style={styles.progressCopy}>
              <KatipanText variant="headlineSmall">{respondedGuests} of {totalGuests} responded</KatipanText>
              <KatipanText variant="bodySmall" color="textMuted">{derived.attendingGuests} attending · {derived.declinedGuests} declined · {derived.noResponseGuests} no response</KatipanText>
            </View>
            <KatipanText variant="headlineMedium" color="primary">{progressPercent}%</KatipanText>
          </View>
          <ProgressBar value={progressPercent} label={`${respondedGuests} of ${totalGuests} Household Guests responded`} />
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Household members" description={`${members.length} named ${members.length === 1 ? "Guest" : "Guests"}`} />
        {members.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState title="No named Guests yet" description="An allowance doesn&apos;t create a Guest. Add an individual Guest when you know who is invited." action={canEdit ? <KatipanButton label="Add Guest" onPress={addGuest} /> : undefined} />
          </EditorialCard>
        ) : members.map((entry) => <GuestRow key={entry.guest.id} entry={entry} onPress={() => openGuest(entry.guest.id)} />)}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Guest allowances"
          description="Plus-One allowances have a Guest sponsor. Child allowances belong to the Household. Unused allowances do not create people."
          action={canEdit ? <KatipanButton label="Add allowance" variant="text" disabled={saving} onPress={() => { setAllowanceEditor("NEW"); setSavingError(null); }} /> : undefined}
        />
        {allowanceEditor && (
          <AllowanceForm
            key={allowanceEditor}
            householdId={household.id}
            members={members}
            existing={allowanceEditor === "NEW" ? undefined : allowances.find((item) => item.id === allowanceEditor)}
            saving={saving}
            onCancel={() => setAllowanceEditor(null)}
            onSave={(draft) => void runMutation(async () => {
              if (allowanceEditor === "NEW") await createGuestAllowance(membership, draft);
              else await updateGuestAllowance(membership, allowanceEditor, draft);
              setAllowanceEditor(null);
            }, allowanceEditor === "NEW" ? undefined : allowanceEditor)}
          />
        )}
        {allowances.length === 0 ? (
          <EditorialCard style={styles.compactCard}><KatipanText color="textMuted">No allowances are recorded for this Household.</KatipanText></EditorialCard>
        ) : allowances.map((allowance) => {
          const claims = data.allowanceClaims.filter((claim) => claim.allowance_id === allowance.id && claim.wedding_id === weddingId);
          return (
            <AllowanceCard
              key={allowance.id}
              allowance={allowance}
              claims={claims}
              allClaims={data.allowanceClaims.filter((claim) => claim.wedding_id === weddingId)}
              members={members}
              sponsor={members.find((entry) => entry.guest.id === allowance.sponsor_guest_id)}
              canEdit={canEdit}
              saving={saving}
              claimingGuestId={claimingAllowanceId === allowance.id ? claimingGuestId : null}
              confirmingDelete={confirmingDeleteAllowanceId === allowance.id}
              onClaim={(guestId) => void runMutation(() => claimGuestAllowance(membership, allowance.id, guestId), allowance.id, guestId)}
              onRelease={(guestId) => void runMutation(() => releaseGuestAllowanceClaim(membership, allowance.id, guestId), allowance.id, guestId)}
              onEdit={() => { setAllowanceEditor(allowance.id); setSavingError(null); }}
              onRequestDelete={() => setConfirmingDeleteAllowanceId(allowance.id)}
              onDelete={() => void runMutation(async () => {
                await deleteGuestAllowance(membership, allowance.id);
                setConfirmingDeleteAllowanceId(null);
              }, allowance.id)}
              onCancelDelete={() => setConfirmingDeleteAllowanceId(null)}
            />
          );
        })}
      </View>

      {canReadNotes && !!household.notes?.trim() && (
        <View style={styles.section}>
          <SectionHeader title="Household notes" description="Private planning context" />
          <EditorialCard style={styles.notesCard}><KatipanText>{household.notes}</KatipanText></EditorialCard>
        </View>
      )}

      {!!savingError && <KatipanText accessibilityRole="alert" color="error">{savingError}</KatipanText>}
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  titleBlock: { gap: s.small },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  section: { gap: s.medium },
  deliveryCard: { gap: s.medium, padding: s.medium },
  deliveryHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  deliveryCopy: { flex: 1, gap: s.micro },
  progressCard: { gap: s.medium },
  progressHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s.medium },
  progressCopy: { flex: 1, gap: s.small },
  emptyCard: { padding: 0 },
  compactCard: { padding: s.medium },
  notesCard: { padding: s.medium, backgroundColor: c.warmAlabaster },
});
