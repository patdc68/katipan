import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { createGuestGroup, deleteGuestGroup, updateGuestGroup } from "./api";
import { guestGroupDraftSchema, safeGuestError, SingleSubmitGate, type GuestEntry, type GuestGroup } from "./model";
import type { WorkspaceMembership } from "../workspace/model";
import { EditorialCard, FormField, KatipanButton, KatipanText } from "../ui";

type Props = {
  groups: GuestGroup[];
  entries: GuestEntry[];
  membership: WorkspaceMembership;
  onChanged: () => void;
};

export function GroupManagementPanel({ groups, entries, membership, onChanged }: Props) {
  const gate = useRef(new SingleSubmitGate());
  const [editingGroup, setEditingGroup] = useState<GuestGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingGroup(null);
    setCreating(true);
    setDraftName("");
    setFormError(null);
  };
  const openEdit = (group: GuestGroup) => {
    setCreating(false);
    setEditingGroup(group);
    setDraftName(group.name);
    setFormError(null);
  };
  const closeEditor = () => {
    setCreating(false);
    setEditingGroup(null);
    setFormError(null);
  };

  const save = async () => {
    const parsed = guestGroupDraftSchema.safeParse({ name: draftName });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the group name.");
      return;
    }
    await gate.current.run(async () => {
      if (saving) return;
      setSaving(true);
      setFormError(null);
      try {
        if (editingGroup) await updateGuestGroup(membership, editingGroup.id, parsed.data);
        else await createGuestGroup(membership, parsed.data);
        closeEditor();
        onChanged();
      } catch (cause) {
        setFormError(safeGuestError(cause, "We couldn't save this guest group."));
      } finally {
        setSaving(false);
      }
    });
  };

  const remove = async (groupId: string) => {
    await gate.current.run(async () => {
      if (saving) return;
      setSaving(true);
      setFormError(null);
      try {
        await deleteGuestGroup(membership, groupId);
        setConfirmingDeleteId(null);
        onChanged();
      } catch (cause) {
        setFormError(safeGuestError(cause, "We couldn't remove this guest group."));
      } finally {
        setSaving(false);
      }
    });
  };

  return (
    <EditorialCard style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelCopy}>
          <KatipanText variant="headlineSmall" accessibilityRole="header">Guest groups</KatipanText>
          <KatipanText variant="bodySmall" color="textMuted">A Guest can belong to more than one group. Removing a group keeps every Guest.</KatipanText>
        </View>
        {!creating && !editingGroup && <KatipanButton label="Add group" variant="secondary" disabled={saving} onPress={openCreate} />}
      </View>

      {groups.length === 0 && !creating && !editingGroup ? (
        <KatipanText color="textMuted">No groups yet. Create a group to organize the Guest List.</KatipanText>
      ) : groups.map((group) => {
        const memberCount = entries.filter((entry) => entry.groupIds.includes(group.id)).length;
        return (
          <View key={group.id} style={styles.groupRow}>
            <View style={styles.groupCopy}>
              <KatipanText variant="labelLarge">{group.name}</KatipanText>
              <KatipanText variant="bodySmall" color="textMuted">{memberCount} {memberCount === 1 ? "Guest" : "Guests"}</KatipanText>
            </View>
            {confirmingDeleteId === group.id ? (
              <View style={styles.confirmActions}>
                <KatipanButton label="Keep" variant="text" disabled={saving} onPress={() => setConfirmingDeleteId(null)} />
                <KatipanButton label="Remove" variant="text" disabled={saving} loading={saving} onPress={() => void remove(group.id)} />
              </View>
            ) : (
              <View style={styles.rowActions}>
                <KatipanButton label={`Rename ${group.name}`} variant="text" disabled={saving} onPress={() => openEdit(group)} />
                <KatipanButton label={`Remove ${group.name}`} variant="text" disabled={saving} onPress={() => setConfirmingDeleteId(group.id)} />
              </View>
            )}
          </View>
        );
      })}

      {(creating || editingGroup) && (
        <View style={styles.editor}>
          <FormField
            label="Group name"
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Family, friends, or another group"
            autoCapitalize="words"
            maxLength={80}
          />
          {!!formError && <KatipanText accessibilityRole="alert" color="error">{formError}</KatipanText>}
          <View style={styles.rowActions}>
            <KatipanButton label="Cancel" variant="secondary" disabled={saving} onPress={closeEditor} />
            <KatipanButton label={editingGroup ? "Save group" : "Create group"} loading={saving} onPress={() => void save()} />
          </View>
        </View>
      )}
      {!!formError && !creating && !editingGroup && <KatipanText accessibilityRole="alert" color="error">{formError}</KatipanText>}
    </EditorialCard>
  );
}

const styles = StyleSheet.create({
  panel: { gap: s.medium, padding: s.medium, backgroundColor: c.warmAlabaster },
  panelHeader: { flexDirection: "row", alignItems: "flex-start", gap: s.small },
  panelCopy: { flex: 1, gap: s.micro },
  groupRow: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small, paddingVertical: s.small, borderTopWidth: 1, borderTopColor: c.stoneBorder },
  groupCopy: { flex: 1, gap: s.micro },
  rowActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: s.micro },
  confirmActions: { flexDirection: "row", gap: s.micro },
  editor: { gap: s.medium, padding: s.medium, borderRadius: r.large, backgroundColor: c.cardIvory },
});
