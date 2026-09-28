import { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, Share, StyleSheet, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { z } from "zod";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { useAccess } from "../onboarding/provider";
import { partnerInvitationLink } from "../onboarding/api";
import { Brand, ChoiceChip } from "../onboarding/components";
import { ErrorState, EditorialCard, FormField, KatipanButton, KatipanScreen, KatipanText, LoadingState, StatusChip } from "../ui";
import { useWorkspace } from "../workspace/context";
import { roleLabel, type WorkspaceMembership } from "../workspace/model";
import {
  canChangeCoordinatorRole,
  canLeaveWedding,
  canManageOwnerMemberships,
  canManageWeddingTeam,
  canPromoteMemberToOwner,
  canRemoveWeddingMember,
  coordinatorRoles,
  safeCoordinatorFailure,
  type CoordinatorRole,
} from "./model";
import {
  changeCoordinatorRole,
  issueCoordinatorInvitation,
  leaveWedding,
  loadWeddingTeam,
  promoteWeddingMemberToOwner,
  removeWeddingMember,
  revokeWeddingInvitation,
  type PendingWeddingInvitation,
  type TeamMember,
  type WeddingTeamSnapshot,
} from "./api";

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  action: () => Promise<void>;
};

export function WeddingTeamScreen() {
  const params = useLocalSearchParams<{ weddingId?: string | string[] }>();
  const weddingId = Array.isArray(params.weddingId) ? params.weddingId[0] ?? "" : params.weddingId ?? "";
  const router = useRouter();
  const access = useAccess();
  const workspace = useWorkspace();
  const membership = workspace.membershipFor(weddingId);
  const canManage = membership ? canManageWeddingTeam(membership) : false;
  const [snapshot, setSnapshot] = useState<WeddingTeamSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inviteRole, setInviteRole] = useState<CoordinatorRole>("FULL_COORDINATOR");
  const [inviteEmail, setInviteEmail] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (!weddingId || !membership?.membershipId) return () => { active = false; };
    void loadWeddingTeam(weddingId).then((result) => {
      if (active) { setSnapshot(result); setError(""); }
    }).catch(() => {
      if (active) setError("We could not load the Wedding team. Check your active membership and try again.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [membership?.membershipId, refreshVersion, weddingId]);

  function retryTeamLoad() {
    setLoading(true);
    setRefreshVersion((value) => value + 1);
  }

  async function runAction(action: () => Promise<void>, afterLeave = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      if (afterLeave) {
        await workspace.refreshMemberships();
        router.replace("/(workspace)/weddings");
      } else {
        await workspace.refreshMemberships(weddingId);
        setSnapshot(await loadWeddingTeam(weddingId));
        setNotice("Wedding membership details were refreshed.");
      }
    } catch (caught) {
      setError(safeCoordinatorFailure(caught));
      if (!afterLeave) {
        try { setSnapshot(await loadWeddingTeam(weddingId)); } catch { /* Keep the safe action error visible. */ }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      setConfirmation(null);
    }
  }

  async function issueCoordinatorInvite() {
    if (busyRef.current || !canManage) return;
    const normalizedEmail = inviteEmail.trim();
    if (normalizedEmail && !z.email().safeParse(normalizedEmail).success) {
      setError("Enter a valid email address or leave it blank.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const issued = await issueCoordinatorInvitation(weddingId, inviteRole, normalizedEmail);
      const link = partnerInvitationLink(issued.raw_token);
      try {
        await Share.share({ title: "Join a Wedding team on Katipan", message: link });
        setNotice("The single-use Coordinator invitation was opened in your share sheet.");
      } catch {
        setError("The invitation was created, but the share sheet could not open. Its link is not saved in the app; revoke it and issue a fresh invitation before sharing.");
      }
      setSnapshot(await loadWeddingTeam(weddingId));
    } catch (caught) {
      setError(safeCoordinatorFailure(caught));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (access.loading || (access.session && workspace.loading)) return <KatipanScreen><LoadingState label="Checking Wedding membership…" /></KatipanScreen>;
  if (!access.session) return <Redirect href="/(access)/welcome" />;
  if (!membership) return <Redirect href="/(workspace)/weddings" />;
  if (loading) return <KatipanScreen><LoadingState label="Loading Wedding team…" /></KatipanScreen>;
  if (error && !snapshot) return <KatipanScreen><ErrorState description={error} onRetry={retryTeamLoad} /></KatipanScreen>;

  const members = snapshot?.members ?? [];
  const pendingInvitations = snapshot?.pendingInvitations ?? [];
  const owners = members.filter((member) => member.role === "OWNER");
  const activeOwnerCount = owners.length;
  const ownMembership = members.find((member) => member.userId === access.session?.user.id);
  const canManageOwners = canManageOwnerMemberships(membership);
  const mayLeave = canLeaveWedding(membership, activeOwnerCount);

  return (
    <KatipanScreen contentContainerStyle={styles.screen}>
      <View style={styles.topline}><Brand /><KatipanText variant="labelCaps" color="secondary">WEDDING ACCESS</KatipanText></View>
      <View style={styles.intro}>
        <KatipanText variant="headlineMobile" accessibilityRole="header">Wedding Team & Coordinator Access</KatipanText>
        <KatipanText color="textMuted">Memberships and invitations for this Wedding. Every role applies to this Wedding only.</KatipanText>
      </View>
      <View style={styles.chips}>
        <StatusChip label={roleLabel(membership.role)} tone={membership.role === "OWNER" ? "success" : "neutral"} />
        <StatusChip label={membership.wedding.ownership_mode === "COORDINATOR_MANAGED" ? "Coordinator-managed" : "Couple-owned"} tone="neutral" />
      </View>

      {error ? <KatipanText color="error" accessibilityRole="alert">{error}</KatipanText> : null}
      {notice ? <KatipanText color="primary" accessibilityRole="alert">{notice}</KatipanText> : null}

      <SectionTitle title="Active members" detail={String(members.length)} />
      {members.length ? members.map((member) => (
        <MemberCard
          key={member.membershipId}
          member={member}
          caller={membership}
          currentUserId={access.session?.user.id ?? ""}
          activeOwnerCount={activeOwnerCount}
          canManage={canManage}
          canManageOwners={canManageOwners}
          busy={busy}
          onChangeRole={(role) => setConfirmation({
            title: "Change Coordinator role?",
            description: member.displayName + " will have " + roleLabel(role) + " access to this Wedding.",
            confirmLabel: "Change role",
            action: () => runAction(() => changeCoordinatorRole(weddingId, member.membershipId, role)),
          })}
          onPromote={() => setConfirmation({
            title: "Promote to Owner?",
            description: member.displayName + " will become an equal Owner of this couple-owned Wedding. There is no Primary Owner role.",
            confirmLabel: "Promote to Owner",
            action: () => runAction(() => promoteWeddingMemberToOwner(weddingId, member.membershipId)),
          })}
          onRemove={() => setConfirmation({
            title: "Remove this Wedding member?",
            description: "This ends their access to the Wedding. The Wedding data and membership history stay in place.",
            confirmLabel: "Remove member",
            destructive: true,
            action: () => runAction(() => removeWeddingMember(weddingId, member.membershipId)),
          })}
        />
      )) : <EditorialCard style={styles.card}><KatipanText color="textMuted">No active memberships are visible for this Wedding.</KatipanText></EditorialCard>}

      {canManage ? <>
        <SectionTitle title="Invite a Coordinator" detail="THIS WEDDING" />
        <EditorialCard style={styles.card}>
          <KatipanText color="textMuted">Invite a person to one of the three Coordinator roles. Owner access is never issued here.</KatipanText>
          <View style={styles.choices}>
            {coordinatorRoles.map((role) => <ChoiceChip key={role} label={roleLabel(role)} selected={inviteRole === role} onPress={() => setInviteRole(role)} />)}
          </View>
          <FormField label="Invited email (optional)" placeholder="coordinator@example.com" value={inviteEmail} onChangeText={setInviteEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" />
          <KatipanButton label="Create & Share Coordinator Invite" variant="secondary" loading={busy} onPress={() => void issueCoordinatorInvite()} />
        </EditorialCard>
      </> : null}

      <SectionTitle title="Pending invitations" detail={String(pendingInvitations.length)} />
      {pendingInvitations.length ? pendingInvitations.map((invitation) => (
        <InvitationCard
          key={invitation.invitationId}
          invitation={invitation}
          canRevoke={canManage}
          busy={busy}
          onRevoke={() => setConfirmation({
            title: "Revoke this invitation?",
            description: "The invitation will stop working. Its history remains in the Wedding.",
            confirmLabel: "Revoke invitation",
            destructive: true,
            action: () => runAction(() => revokeWeddingInvitation(invitation.invitationId)),
          })}
        />
      )) : <EditorialCard style={styles.card}><KatipanText color="textMuted">No pending invitations are visible to your current Wedding role.</KatipanText></EditorialCard>}

      <SectionTitle title="Your access" detail="CURRENT MEMBERSHIP" />
      <EditorialCard style={styles.card}>
        <KatipanText variant="title">{ownMembership?.displayName ?? "Your membership"}</KatipanText>
        <KatipanText variant="bodySmall" color="textMuted">{roleLabel(membership.role)} access to {membership.wedding.display_name || "this Wedding"}.</KatipanText>
        {mayLeave ? (
          <KatipanButton label="Leave this Wedding" variant="secondary" disabled={busy} onPress={() => setConfirmation({
            title: "Leave this Wedding?",
            description: "You will lose access to this Wedding. Its data will remain for the other members.",
            confirmLabel: "Leave Wedding",
            destructive: true,
            action: () => runAction(() => leaveWedding(weddingId), true),
          })} />
        ) : (
          <KatipanText variant="bodySmall" color="textMuted">{membership.role === "OWNER" && activeOwnerCount <= 1
            ? "The final active Owner cannot leave. Promote another active member to Owner first."
            : "The Coordinator controller cannot leave a coordinator-managed Wedding before ownership transfers."}</KatipanText>
        )}
      </EditorialCard>
      <KatipanButton label="Back to Wedding" variant="text" onPress={() => router.replace({ pathname: "/(wedding)/[weddingId]/home", params: { weddingId } } as unknown as Href)} />

      <ConfirmDialog confirmation={confirmation} busy={busy} onDismiss={() => { if (!busy) setConfirmation(null); }} onConfirm={() => {
        if (!confirmation || busyRef.current) return;
        void confirmation.action();
      }} />
    </KatipanScreen>
  );
}

function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return <View style={styles.sectionTitle}><KatipanText variant="headlineMedium" accessibilityRole="header">{title}</KatipanText><KatipanText variant="labelCaps" color="textMuted">{detail}</KatipanText></View>;
}

function MemberCard({
  member, caller, currentUserId, activeOwnerCount, canManage, canManageOwners, busy, onChangeRole, onPromote, onRemove,
}: {
  member: TeamMember;
  caller: WorkspaceMembership;
  currentUserId: string;
  activeOwnerCount: number;
  canManage: boolean;
  canManageOwners: boolean;
  busy: boolean;
  onChangeRole: (role: CoordinatorRole) => void;
  onPromote: () => void;
  onRemove: () => void;
}) {
  const isSelf = member.userId === currentUserId;
  const target = { userId: member.userId, role: member.role, status: member.status };
  const mayChangeRole = canChangeCoordinatorRole(caller, target);
  const mayPromote = canPromoteMemberToOwner(caller, target);
  const mayRemove = canRemoveWeddingMember(caller, target, activeOwnerCount);
  return (
    <EditorialCard style={styles.card}>
      <View style={styles.memberTop}>
        <View style={styles.memberCopy}>
          <KatipanText variant="title">{member.displayName}{isSelf ? " · You" : ""}</KatipanText>
          <KatipanText variant="bodySmall" color="textMuted">Joined {formatJoinedDate(member.joinedAt)}</KatipanText>
        </View>
        <StatusChip label={roleLabel(member.role)} tone={member.role === "OWNER" ? "success" : "neutral"} />
      </View>
      {mayChangeRole ? <View style={styles.roleChoices}>
        <KatipanText variant="labelCaps" color="textMuted">COORDINATOR ROLE</KatipanText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>
          {coordinatorRoles.filter((role) => role !== member.role).map((role) => (
            <ChoiceChip key={role} label={roleLabel(role)} selected={false} onPress={() => onChangeRole(role)} />
          ))}
        </ScrollView>
      </View> : null}
      {(mayPromote || mayRemove) ? <View style={styles.memberActions}>
        {mayPromote ? <KatipanButton label="Promote to Owner" variant="secondary" disabled={busy} onPress={onPromote} /> : null}
        {mayRemove ? <KatipanButton label="Remove member" variant="text" disabled={busy} onPress={onRemove} /> : null}
      </View> : null}
    </EditorialCard>
  );
}

function InvitationCard({ invitation, canRevoke, busy, onRevoke }: {
  invitation: PendingWeddingInvitation;
  canRevoke: boolean;
  busy: boolean;
  onRevoke: () => void;
}) {
  const label = invitation.targetPersonId ? invitation.targetDisplayName || "Partner invitation" : "Coordinator invitation";
  return (
    <EditorialCard style={styles.card}>
      <View style={styles.memberTop}>
        <View style={styles.memberCopy}>
          <KatipanText variant="title">{label}</KatipanText>
          <KatipanText variant="bodySmall" color="textMuted">{invitation.invitedEmail || "Not bound to an email"}</KatipanText>
        </View>
        <StatusChip label="Pending" tone="neutral" />
      </View>
      <KatipanText variant="bodySmall" color="textMuted">{roleLabel(invitation.role)} · Expires {new Date(invitation.expiresAt).toLocaleDateString()}</KatipanText>
      {canRevoke ? <KatipanButton label="Revoke invitation" variant="text" disabled={busy} onPress={onRevoke} /> : null}
    </EditorialCard>
  );
}

function ConfirmDialog({ confirmation, busy, onDismiss, onConfirm }: {
  confirmation: Confirmation | null;
  busy: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={Boolean(confirmation)} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.scrim}>
        <View style={styles.dialog} accessibilityRole="alert">
          <KatipanText variant="headlineMedium" accessibilityRole="header">{confirmation?.title}</KatipanText>
          <KatipanText color="textMuted">{confirmation?.description}</KatipanText>
          <KatipanButton label={confirmation?.confirmLabel ?? "Confirm"} loading={busy} onPress={onConfirm} />
          <KatipanButton label="Cancel" variant="secondary" disabled={busy} onPress={onDismiss} />
        </View>
      </View>
    </Modal>
  );
}

function formatJoinedDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Wedding member" : date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

const styles = StyleSheet.create({
  screen: { gap: s.large, paddingBottom: s.extraLarge },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  intro: { gap: s.small },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  sectionTitle: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: s.small, marginTop: s.small },
  card: { gap: s.medium, backgroundColor: c.surfaceLowest, borderRadius: r.extraLarge, padding: s.cardLarge },
  memberTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s.medium },
  memberCopy: { flex: 1, gap: s.micro },
  roleChoices: { gap: s.small },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  memberActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: s.small },
  scrim: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1E1B19AA", padding: s.margin },
  dialog: { width: "100%", maxWidth: 440, gap: s.medium, backgroundColor: c.surfaceLowest, borderRadius: r.extraLarge, padding: s.cardLarge },
});
