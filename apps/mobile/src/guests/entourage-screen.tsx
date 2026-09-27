import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import {
  assignGuestToEntourageRole,
  createEntourageRole,
  deleteEntourageRole,
  removeGuestFromEntourageRole,
  updateEntourageRole,
} from "./api";
import { GuestSectionNavigation } from "./components";
import {
  buildEntourageRoleEntries,
  buildGuestEntries,
  canManageGuestDomain,
  entourageRoleDraftSchema,
  guestName,
  safeGuestError,
  SingleSubmitGate,
  type EntourageRoleDraft,
  type GuestEntourageRole,
} from "./model";
import { useGuestWorkspace } from "./use-guest-workspace";
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

export default function EntourageScreen() {
  const { weddingId, membership, isCurrent, loading, error, data, retry } = useGuestWorkspace();
  const router = useRouter();
  const gate = useRef(new SingleSubmitGate());
  const [saving, setSaving] = useState(false);
  const [savingGuestId, setSavingGuestId] = useState<string | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | "NEW" | null>(null);
  const [confirmingDeleteRoleId, setConfirmingDeleteRoleId] = useState<string | null>(null);
  const [assigningRoleId, setAssigningRoleId] = useState<string | null>(null);
  const [assignmentSearch, setAssignmentSearch] = useState("");

  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading Entourage roles…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load the Entourage roles." onRetry={retry} /></KatipanScreen>;
  if (data.entourageRoles === null || data.entourageAssignments === null) {
    return <KatipanScreen><ErrorState description="Entourage roles are unavailable right now." onRetry={retry} /></KatipanScreen>;
  }

  const canEdit = canManageGuestDomain(membership);
  const entries = buildGuestEntries(data);
  const roles = buildEntourageRoleEntries(data, weddingId);
  const assignedGuestIds = new Set(data.entourageAssignments
    .filter((assignment) => assignment.wedding_id === weddingId)
    .map((assignment) => assignment.guest_id));
  const assignmentCount = data.entourageAssignments.filter((assignment) => assignment.wedding_id === weddingId).length;
  const rolesByGuest = new Map<string, Set<string>>();
  for (const assignment of data.entourageAssignments) {
    if (assignment.wedding_id !== weddingId) continue;
    const guestRoleIds = rolesByGuest.get(assignment.guest_id) ?? new Set<string>();
    guestRoleIds.add(assignment.role_id);
    rolesByGuest.set(assignment.guest_id, guestRoleIds);
  }
  const multipleRoleGuests = entries.filter((entry) => (rolesByGuest.get(entry.guest.id)?.size ?? 0) > 1);

  const openGuestList = () => router.navigate({ pathname: "/(wedding)/[weddingId]/guests/list", params: { weddingId } });
  const openGuest = (guestId: string) => router.navigate({ pathname: "/(wedding)/[weddingId]/guests/[guestId]", params: { weddingId, guestId } });
  const runMutation = async (action: () => Promise<void>, roleId?: string, guestId?: string) => {
    await gate.current.run(async () => {
      if (saving) return;
      setSaving(true);
      setSavingRoleId(roleId ?? null);
      setSavingGuestId(guestId ?? null);
      setMutationError(null);
      try {
        await action();
        retry();
      } catch (cause) {
        setMutationError(safeGuestError(cause, "We couldn't save this Entourage change."));
      } finally {
        setSaving(false);
        setSavingRoleId(null);
        setSavingGuestId(null);
      }
    });
  };
  const saveRole = (roleId: string | null, draft: EntourageRoleDraft) => {
    void runMutation(async () => {
      if (roleId) await updateEntourageRole(membership, roleId, draft);
      else await createEntourageRole(membership, draft);
      setEditingRoleId(null);
    }, roleId ?? undefined);
  };
  const removeRole = (roleId: string) => {
    const role = roles.find((entry) => entry.role.id === roleId);
    void runMutation(async () => {
      await deleteEntourageRole(membership, roleId);
      setConfirmingDeleteRoleId(null);
    }, role?.role.id);
  };
  const assignGuest = (roleId: string, guestId: string) => {
    void runMutation(async () => {
      await assignGuestToEntourageRole(membership, roleId, guestId);
      setAssigningRoleId(null);
      setAssignmentSearch("");
    }, roleId, guestId);
  };
  const removeAssignment = (roleId: string, guestId: string) => {
    void runMutation(() => removeGuestFromEntourageRole(membership, roleId, guestId), roleId, guestId);
  };

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <GuestSectionNavigation active="ENTOURAGE" onGuestsPress={openGuestList} />

      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">GUESTS / ENTOURAGE</KatipanText>
        <KatipanText variant="headlineLarge" accessibilityRole="header">Entourage</KatipanText>
        <KatipanText color="textMuted">The Guests assigned to each role in your Wedding.</KatipanText>
      </View>

      <EditorialCard style={styles.summaryCard}>
        <View style={styles.summaryHeading}>
          <View style={styles.summaryCopy}>
            <KatipanText variant="labelCaps" color="secondary">ROLE SUMMARY</KatipanText>
            <KatipanText variant="headlineSmall">{roles.length} {roles.length === 1 ? "role" : "roles"} configured</KatipanText>
            <KatipanText variant="bodySmall" color="textMuted">
              {assignmentCount} role assignments across {assignedGuestIds.size} {assignedGuestIds.size === 1 ? "Guest" : "Guests"}
            </KatipanText>
          </View>
          <StatusChip label={`${roles.length} ${roles.length === 1 ? "role" : "roles"}`} tone="success" />
        </View>
        <KatipanText variant="bodySmall" color="textMuted">
          A Guest may hold more than one role. Role assignments do not change RSVP, seating, Guest Pass, or check-in.
        </KatipanText>
        {canEdit && editingRoleId === "NEW" ? (
          <EntourageRoleForm saving={saving} onCancel={() => setEditingRoleId(null)} onSave={(draft) => saveRole(null, draft)} />
        ) : canEdit ? (
          <KatipanButton label="Add entourage role" onPress={() => { setMutationError(null); setEditingRoleId("NEW"); }} />
        ) : null}
      </EditorialCard>

      {!!mutationError && <KatipanText accessibilityRole="alert" color="error">{mutationError}</KatipanText>}

      {multipleRoleGuests.length > 0 && (
        <EditorialCard style={styles.multipleRolesCard}>
          <KatipanText variant="labelLarge" color="secondary">Multiple roles</KatipanText>
          <KatipanText variant="bodySmall" color="textMuted">
            {multipleRoleGuests.slice(0, 3).map((entry) => guestName(entry)).join(", ")}
            {multipleRoleGuests.length > 3 ? ` and ${multipleRoleGuests.length - 3} more` : ""} {multipleRoleGuests.length === 1 ? "holds" : "hold"} more than one role.
          </KatipanText>
        </EditorialCard>
      )}

      <View style={styles.section}>
        <SectionHeader title="Entourage roles" description="Ordered by the Wedding's saved role order." />
        {roles.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState
              title="No entourage roles yet"
              description="Add a role and assign existing Guests when you're ready."
              action={canEdit ? <KatipanButton label="Add first role" onPress={() => setEditingRoleId("NEW")} /> : undefined}
            />
          </EditorialCard>
        ) : roles.map(({ role, guests }) => {
          const assignedToRole = new Set(guests.map((entry) => entry.guest.id));
          const search = assignmentSearch.trim().toLocaleLowerCase();
          const candidates = entries.filter((entry) => !assignedToRole.has(entry.guest.id)
            && (!search || `${guestName(entry)} ${entry.household.display_name}`.toLocaleLowerCase().includes(search)));
          return (
            <EditorialCard key={role.id} style={styles.roleCard}>
              <View style={styles.roleHeading}>
                <View style={styles.roleCopy}>
                  <KatipanText variant="headlineSmall">{role.name}</KatipanText>
                  <KatipanText variant="bodySmall" color="textMuted">{guests.length} {guests.length === 1 ? "Guest assigned" : "Guests assigned"}</KatipanText>
                </View>
                <StatusChip label={guests.length ? "Assigned" : "Unassigned"} tone={guests.length ? "success" : "neutral"} />
              </View>

              {!!role.description?.trim() && <KatipanText variant="bodySmall" color="textMuted">{role.description}</KatipanText>}

              {guests.length > 0 ? (
                <View style={styles.assignedList}>
                  {guests.map((entry) => (
                    <View key={entry.guest.id} style={styles.guestRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open Guest details for ${guestName(entry)}`}
                        onPress={() => openGuest(entry.guest.id)}
                        style={styles.guestCopy}
                      >
                        <KatipanText variant="labelLarge">{guestName(entry)}</KatipanText>
                        <KatipanText variant="bodySmall" color="textMuted">{entry.household.display_name}</KatipanText>
                      </Pressable>
                      {canEdit && <KatipanButton label={`Remove ${guestName(entry)} from ${role.name}`} variant="text" loading={saving && savingRoleId === role.id && savingGuestId === entry.guest.id} onPress={() => removeAssignment(role.id, entry.guest.id)} />}
                    </View>
                  ))}
                </View>
              ) : (
                <KatipanText variant="bodySmall" color="textMuted">No Guests are assigned to this role.</KatipanText>
              )}

              {canEdit && editingRoleId === role.id && (
                <EntourageRoleForm
                  key={role.id}
                  role={role}
                  saving={saving}
                  onCancel={() => setEditingRoleId(null)}
                  onSave={(draft) => saveRole(role.id, draft)}
                />
              )}

              {canEdit && assigningRoleId === role.id && (
                <View style={styles.assignmentPicker}>
                  <KatipanText variant="labelLarge">Assign an existing Guest</KatipanText>
                  <FormField label="Find a Guest" value={assignmentSearch} onChangeText={setAssignmentSearch} placeholder="Guest or Household" autoCapitalize="words" />
                  {candidates.length > 0 ? candidates.map((entry) => (
                    <Pressable
                      key={entry.guest.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Assign ${guestName(entry)} to ${role.name}`}
                      disabled={saving}
                      onPress={() => assignGuest(role.id, entry.guest.id)}
                      style={styles.candidateRow}
                    >
                      <View style={styles.guestCopy}>
                        <KatipanText variant="labelLarge" color="primary">{guestName(entry)}</KatipanText>
                        <KatipanText variant="bodySmall" color="textMuted">{entry.household.display_name}</KatipanText>
                      </View>
                      <KatipanText variant="labelLarge" color="primary">{saving && savingRoleId === role.id && savingGuestId === entry.guest.id ? "Saving…" : "Assign"}</KatipanText>
                    </Pressable>
                  )) : (
                    <KatipanText variant="bodySmall" color="textMuted">No Guests match this search. A Guest already assigned to this role is not listed.</KatipanText>
                  )}
                  <KatipanButton label="Close Guest choices" variant="text" disabled={saving} onPress={() => { setAssigningRoleId(null); setAssignmentSearch(""); }} />
                </View>
              )}

              {canEdit && confirmingDeleteRoleId === role.id && (
                <View style={styles.confirmBox}>
                  <KatipanText variant="bodySmall" color="textMuted">
                    Remove this role and its {guests.length} assignment{guests.length === 1 ? "" : "s"}? Guest records and their other roles stay in the Wedding.
                  </KatipanText>
                  <View style={styles.actions}>
                    <KatipanButton label="Keep role" variant="secondary" disabled={saving} onPress={() => setConfirmingDeleteRoleId(null)} />
                    <KatipanButton label="Confirm removal" loading={saving && savingRoleId === role.id} onPress={() => removeRole(role.id)} />
                  </View>
                </View>
              )}

              {canEdit && (
                <View style={styles.actions}>
                  <KatipanButton label={`Edit ${role.name}`} variant="text" disabled={saving} onPress={() => { setMutationError(null); setEditingRoleId(role.id); setAssigningRoleId(null); setConfirmingDeleteRoleId(null); }} />
                  <KatipanButton
                    label={assigningRoleId === role.id ? "Hide Guest choices" : "Assign Guest"}
                    variant="text"
                    disabled={saving}
                    onPress={() => { setAssigningRoleId(assigningRoleId === role.id ? null : role.id); setAssignmentSearch(""); setEditingRoleId(null); }}
                  />
                  <KatipanButton label={`Remove ${role.name}`} variant="text" disabled={saving} onPress={() => { setConfirmingDeleteRoleId(role.id); setEditingRoleId(null); setAssigningRoleId(null); }} />
                </View>
              )}
            </EditorialCard>
          );
        })}
      </View>

      <EditorialCard style={styles.reassuranceCard}>
        <KatipanText variant="labelLarge" color="primary">Integrated Guest records</KatipanText>
        <KatipanText variant="bodySmall" color="textMuted">
          Entourage roles use the existing Guest record. Role assignment does not change RSVP, seating, Guest Pass, or check-in.
        </KatipanText>
      </EditorialCard>
    </KatipanScreen>
  );
}

function EntourageRoleForm({
  role,
  saving,
  onCancel,
  onSave,
}: {
  role?: GuestEntourageRole;
  saving: boolean;
  onCancel: () => void;
  onSave: (draft: EntourageRoleDraft) => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const save = () => {
    const parsed = entourageRoleDraftSchema.safeParse({ name, description });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the role details.");
      return;
    }
    setFormError(null);
    onSave(parsed.data);
  };

  return (
    <EditorialCard style={styles.formCard}>
      <KatipanText variant="title">{role ? "Edit role" : "New entourage role"}</KatipanText>
      <FormField label="Role name" value={name} onChangeText={setName} placeholder="Role name" autoCapitalize="words" maxLength={120} />
      <FormField label="Description (optional)" value={description} onChangeText={setDescription} placeholder="Add a little context" multiline numberOfLines={3} maxLength={1000} />
      {!!formError && <KatipanText accessibilityRole="alert" color="error">{formError}</KatipanText>}
      <View style={styles.actions}>
        <KatipanButton label="Cancel" variant="secondary" disabled={saving} onPress={onCancel} />
        <KatipanButton label={role ? "Save role" : "Create role"} loading={saving} onPress={save} />
      </View>
    </EditorialCard>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  titleBlock: { gap: s.small },
  summaryCard: { gap: s.medium, padding: s.cardLarge, backgroundColor: c.surfaceLow },
  summaryHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  summaryCopy: { flex: 1, gap: s.micro },
  section: { gap: s.medium },
  emptyCard: { padding: 0 },
  roleCard: { gap: s.medium, padding: s.medium },
  roleHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  roleCopy: { flex: 1, gap: s.micro },
  assignedList: { gap: s.small },
  guestRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: s.small, padding: s.small, borderRadius: r.large, backgroundColor: c.surfaceLow },
  guestCopy: { flex: 1, gap: s.micro },
  assignmentPicker: { gap: s.small, padding: s.medium, borderRadius: r.large, backgroundColor: c.warmAlabaster },
  candidateRow: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small, padding: s.small, borderRadius: r.medium, backgroundColor: c.cardIvory },
  confirmBox: { gap: s.small, padding: s.medium, borderRadius: r.large, backgroundColor: c.warmAlabaster },
  multipleRolesCard: { gap: s.small, padding: s.medium, backgroundColor: c.secondaryFixed },
  reassuranceCard: { gap: s.small, padding: s.medium, backgroundColor: c.warmAlabaster },
  formCard: { gap: s.medium, padding: s.medium, backgroundColor: c.warmAlabaster },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
});
