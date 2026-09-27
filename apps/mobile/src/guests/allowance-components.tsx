import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { GuestFilterChip } from "./components";
import {
  guestAllowanceDraftSchema,
  guestAllowanceLabel,
  guestName,
  type GuestAllowance,
  type GuestAllowanceClaim,
  type GuestAllowanceDraft,
  type GuestAllowanceType,
  type GuestEntry,
} from "./model";
import { EditorialCard, FormField, KatipanButton, KatipanText, SectionHeader, StatusChip } from "../ui";

type AllowanceCardProps = {
  allowance: GuestAllowance;
  claims: GuestAllowanceClaim[];
  allClaims: GuestAllowanceClaim[];
  members: GuestEntry[];
  sponsor: GuestEntry | undefined;
  canEdit: boolean;
  saving: boolean;
  claimingGuestId: string | null;
  confirmingDelete: boolean;
  onClaim: (guestId: string) => void;
  onRelease: (guestId: string) => void;
  onEdit: () => void;
  onRequestDelete: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
};

export function AllowanceCard({
  allowance,
  claims,
  allClaims,
  members,
  sponsor,
  canEdit,
  saving,
  claimingGuestId,
  confirmingDelete,
  onClaim,
  onRelease,
  onEdit,
  onRequestDelete,
  onDelete,
  onCancelDelete,
}: AllowanceCardProps) {
  const [showCandidates, setShowCandidates] = useState(false);
  const claimedGuestIds = new Set(allClaims
    .filter((claim) => claim.wedding_id === allowance.wedding_id)
    .map((claim) => claim.guest_id));
  const membersById = new Map(members.map((entry) => [entry.guest.id, entry]));
  const candidates = members.filter((entry) =>
    entry.guest.wedding_id === allowance.wedding_id && !claimedGuestIds.has(entry.guest.id));
  const remaining = Math.max(0, allowance.max_count - claims.length);

  return (
    <EditorialCard style={styles.allowanceCard}>
      <View style={styles.allowanceHeading}>
        <View style={styles.allowanceCopy}>
          <KatipanText variant="title">{guestAllowanceLabel(allowance.allowance_type)}</KatipanText>
          <KatipanText variant="bodySmall" color="textMuted">
            {claims.length} of {allowance.max_count} claimed · {remaining} remaining
          </KatipanText>
        </View>
        <StatusChip label={remaining === 0 ? "Full" : "Available"} tone={remaining === 0 ? "success" : "neutral"} />
      </View>

      {allowance.allowance_type === "PLUS_ONE" && (
        <DetailLine label="Sponsored by" value={sponsor ? guestName(sponsor) : "Sponsor Guest unavailable"} />
      )}

      {claims.length > 0 && (
        <View style={styles.claimList}>
          <SectionHeader title="Named Guests" description="Each claim uses an existing Guest record." />
          {claims.map((claim) => (
            <View key={`${claim.allowance_id}:${claim.guest_id}`} style={styles.claimRow}>
              <KatipanText variant="bodySmall" style={styles.claimName}>
                {membersById.has(claim.guest_id) ? guestName(membersById.get(claim.guest_id)!) : "Guest"}
              </KatipanText>
              {canEdit && (
                <GuestFilterChip
                  label="Release"
                  selected={false}
                  disabled={saving}
                  onPress={() => onRelease(claim.guest_id)}
                />
              )}
            </View>
          ))}
        </View>
      )}

      {canEdit && remaining > 0 && (
        <View style={styles.claimSection}>
          <KatipanButton
            label={showCandidates ? "Hide Guest choices" : "Link an existing Guest"}
            variant="secondary"
            disabled={saving}
            onPress={() => setShowCandidates((current) => !current)}
          />
          {showCandidates && (candidates.length > 0 ? (
            <View style={styles.candidateList}>
              {candidates.map((entry) => (
                <Pressable
                  key={entry.guest.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Claim ${guestAllowanceLabel(allowance.allowance_type)} allowance for ${guestName(entry)}`}
                  accessibilityState={{ disabled: saving }}
                  disabled={saving}
                  onPress={() => onClaim(entry.guest.id)}
                  style={styles.candidateRow}
                >
                  <View style={styles.candidateCopy}>
                    <KatipanText variant="labelLarge" color="primary">{guestName(entry)}</KatipanText>
                    <KatipanText variant="bodySmall" color="textMuted">{entry.household.display_name}</KatipanText>
                  </View>
                  <KatipanText variant="labelLarge" color="primary">
                    {claimingGuestId === entry.guest.id ? "Saving…" : "Claim"}
                  </KatipanText>
                </Pressable>
              ))}
            </View>
          ) : (
            <KatipanText variant="bodySmall" color="textMuted">
              Add a named Guest to this Household before linking the allowance. Guests already linked to another allowance are not offered again.
            </KatipanText>
          ))}
        </View>
      )}

      {canEdit && claims.length === 0 && (
        <View style={styles.actions}>
          <KatipanButton label="Edit allowance" variant="text" disabled={saving} onPress={onEdit} />
          <KatipanButton label="Remove allowance" variant="text" disabled={saving} onPress={onRequestDelete} />
        </View>
      )}
      {canEdit && claims.length > 0 && (
        <KatipanText variant="bodySmall" color="textMuted">Release every claim before editing or removing this allowance.</KatipanText>
      )}

      {confirmingDelete && (
        <View style={styles.deleteConfirm}>
          <KatipanText variant="bodySmall" color="textMuted">
            Remove this allowance definition? Release its claims first. The named Guest records will stay in the Household.
          </KatipanText>
          <View style={styles.actions}>
            <KatipanButton label="Keep allowance" variant="secondary" disabled={saving} onPress={onCancelDelete} />
            <KatipanButton label="Confirm removal" disabled={saving} onPress={onDelete} />
          </View>
        </View>
      )}
    </EditorialCard>
  );
}

type AllowanceFormProps = {
  householdId: string;
  members: GuestEntry[];
  existing?: GuestAllowance;
  fixedType?: GuestAllowanceType;
  fixedSponsorGuestId?: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (draft: GuestAllowanceDraft) => void;
};

export function AllowanceForm({
  householdId,
  members,
  existing,
  fixedType,
  fixedSponsorGuestId,
  saving,
  onCancel,
  onSave,
}: AllowanceFormProps) {
  const [allowanceType, setAllowanceType] = useState<GuestAllowanceType>(fixedType ?? existing?.allowance_type ?? "CHILD");
  const [sponsorGuestId, setSponsorGuestId] = useState<string | null>(fixedSponsorGuestId ?? existing?.sponsor_guest_id ?? null);
  const [maxCount, setMaxCount] = useState(String(existing?.max_count ?? 1));
  const [formError, setFormError] = useState<string | null>(null);
  const fixed = fixedType !== undefined;
  const save = () => {
    const parsed = guestAllowanceDraftSchema.safeParse({
      householdId,
      allowanceType,
      sponsorGuestId: allowanceType === "CHILD" ? null : sponsorGuestId,
      maxCount,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the allowance details.");
      return;
    }
    setFormError(null);
    onSave(parsed.data);
  };

  return (
    <EditorialCard style={styles.formCard}>
      <KatipanText variant="headlineSmall" accessibilityRole="header">{existing ? "Edit allowance" : "Add allowance"}</KatipanText>
      {!fixed && (
        <View style={styles.typeChoices}>
          <GuestFilterChip
            label="Plus one"
            selected={allowanceType === "PLUS_ONE"}
            disabled={saving}
            onPress={() => { setAllowanceType("PLUS_ONE"); setSponsorGuestId(null); }}
          />
          <GuestFilterChip
            label="Child"
            selected={allowanceType === "CHILD"}
            disabled={saving}
            onPress={() => { setAllowanceType("CHILD"); setSponsorGuestId(null); }}
          />
        </View>
      )}

      {allowanceType === "PLUS_ONE" && (
        <View style={styles.sponsorChoices}>
          <KatipanText variant="labelLarge">Sponsor Guest</KatipanText>
          {fixedSponsorGuestId ? (
            <KatipanText color="textMuted">
              {members.find((entry) => entry.guest.id === fixedSponsorGuestId)?.person.display_name ?? "Selected Guest"}
            </KatipanText>
          ) : members.length === 0 ? (
            <KatipanText variant="bodySmall" color="textMuted">Add a named Guest to this Household before creating a Plus-One allowance.</KatipanText>
          ) : (
            <View style={styles.typeChoices}>
              {members.map((entry) => (
                <GuestFilterChip
                  key={entry.guest.id}
                  label={guestName(entry)}
                  selected={sponsorGuestId === entry.guest.id}
                  disabled={saving}
                  onPress={() => setSponsorGuestId(entry.guest.id)}
                />
              ))}
            </View>
          )}
          <KatipanText variant="bodySmall" color="textMuted">The sponsor must be an existing Guest in this Household.</KatipanText>
        </View>
      )}

      {allowanceType === "CHILD" && (
        <KatipanText variant="bodySmall" color="textMuted">Child allowances belong to the Household and have no Guest sponsor.</KatipanText>
      )}

      <FormField
        label="Maximum named Guests"
        value={maxCount}
        onChangeText={setMaxCount}
        keyboardType="number-pad"
        maxLength={5}
        hint="Use a whole number greater than zero."
      />
      {!!formError && <KatipanText accessibilityRole="alert" color="error">{formError}</KatipanText>}
      <View style={styles.actions}>
        <KatipanButton label="Cancel" variant="secondary" disabled={saving} onPress={onCancel} />
        <KatipanButton label={existing ? "Save allowance" : "Create allowance"} loading={saving} onPress={save} />
      </View>
    </EditorialCard>
  );
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
  allowanceCard: { gap: s.medium, padding: s.medium },
  allowanceHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  allowanceCopy: { flex: 1, gap: s.micro },
  claimList: { gap: s.small },
  claimRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small, paddingVertical: s.small, borderTopWidth: 1, borderTopColor: c.stoneBorder },
  claimName: { flex: 1 },
  claimSection: { gap: s.small, paddingTop: s.small, borderTopWidth: 1, borderTopColor: c.stoneBorder },
  candidateList: { gap: s.small },
  candidateRow: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small, padding: s.small, borderRadius: r.medium, backgroundColor: c.surfaceLow },
  candidateCopy: { flex: 1, gap: s.micro },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  deleteConfirm: { gap: s.small, padding: s.medium, borderRadius: r.medium, backgroundColor: c.surfaceLow },
  formCard: { gap: s.medium, padding: s.cardLarge, backgroundColor: c.warmAlabaster },
  typeChoices: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  sponsorChoices: { gap: s.small },
  detailLine: { flexDirection: "row", justifyContent: "space-between", gap: s.medium },
  detailValue: { flex: 1, textAlign: "right" },
});
