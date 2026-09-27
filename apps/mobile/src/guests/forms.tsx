import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import {
  addExistingPersonAsGuest,
  createGuest,
  createGuestHousehold,
  updateGuestHousehold,
  updateGuestPerson,
} from "./api";
import {
  availableWeddingPeople,
  buildGuestEntries,
  canManageGuestDomain,
  guestDraftSchema,
  householdDraftSchema,
  safeGuestError,
  SingleSubmitGate,
  type GuestDraft,
  type GuestEntry,
  type GuestWorkspaceData,
  type HouseholdDraft,
} from "./model";
import { GuestFilterChip } from "./components";
import type { WorkspaceMembership } from "../workspace/model";
import { useGuestWorkspace } from "./use-guest-workspace";
import {
  EditorialCard,
  ErrorState,
  FormField,
  KatipanButton,
  KatipanScreen,
  KatipanText,
  LoadingState,
  SectionHeader,
} from "../ui";

const emptyHouseholdDraft: HouseholdDraft = { displayName: "", notes: "" };
const emptyGuestDraft: GuestDraft = {
  displayName: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  accessibilityAssistanceNote: "",
  internalNotes: "",
};

export function HouseholdFormScreen() {
  const params = useLocalSearchParams<{ householdId?: string | string[] }>();
  const householdId = Array.isArray(params.householdId) ? params.householdId[0] ?? "" : params.householdId ?? "";
  const { weddingId, membership, isCurrent, loading, error, data, retry } = useGuestWorkspace();
  const router = useRouter();
  const household = data?.households.find((item) => item.id === householdId && item.wedding_id === weddingId);

  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading Household form…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load Household details." onRetry={retry} /></KatipanScreen>;
  if (householdId && !household) return <KatipanScreen><ErrorState title="Household unavailable" description="This Household isn't part of the selected Wedding." onRetry={() => router.back()} /></KatipanScreen>;
  if (!canManageGuestDomain(membership)) return <KatipanScreen><ErrorState title="Guest changes are read-only" description="Only an Owner, Full Coordinator or Guest Coordinator can manage this Wedding's guest list." onRetry={() => router.back()} /></KatipanScreen>;
  return <HouseholdFormEditor weddingId={weddingId} membership={membership} household={household ?? null} />;
}

function HouseholdFormEditor({
  weddingId,
  membership,
  household,
}: {
  weddingId: string;
  membership: WorkspaceMembership;
  household: NonNullable<ReturnType<typeof useGuestWorkspace>["data"]>["households"][number] | null;
}) {
  const router = useRouter();
  const gate = useRef(new SingleSubmitGate());
  const [draft, setDraft] = useState<HouseholdDraft>(() => household
    ? { displayName: household.display_name, notes: household.notes ?? "" }
    : emptyHouseholdDraft);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const save = async () => {
    const parsed = householdDraftSchema.safeParse(draft);
    if (!parsed.success) { setFormError(parsed.error.issues[0]?.message ?? "Check the Household details."); return; }
    await gate.current.run(async () => {
      if (saving) return;
      setSaving(true);
      setFormError(null);
      try {
        if (household) {
          await updateGuestHousehold(membership, household.id, parsed.data);
          router.replace({ pathname: "/(wedding)/[weddingId]/guests/households/[householdId]", params: { weddingId, householdId: household.id } });
        } else {
          const newHouseholdId = await createGuestHousehold(membership, parsed.data);
          router.replace({ pathname: "/(wedding)/[weddingId]/guests/households/[householdId]", params: { weddingId, householdId: newHouseholdId } });
        }
      } catch (cause) {
        setFormError(safeGuestError(cause, "We couldn't save this Household. Try again."));
      } finally { setSaving(false); }
    });
  };

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">GUESTS / HOUSEHOLD</KatipanText>
        <KatipanText variant="headlineLarge" accessibilityRole="header">{household ? "Edit Household" : "Create Household"}</KatipanText>
        <KatipanText color="textMuted">A Household groups invitation delivery. Each named Guest keeps an individual RSVP.</KatipanText>
      </View>
      <EditorialCard style={styles.formCard}>
        <FormField
          label="Household display name"
          value={draft.displayName}
          onChangeText={(displayName) => setDraft((current) => ({ ...current, displayName }))}
          placeholder="Santos Family"
          autoCapitalize="words"
          maxLength={160}
          returnKeyType="next"
        />
        <FormField
          label="Private notes"
          value={draft.notes}
          onChangeText={(notes) => setDraft((current) => ({ ...current, notes }))}
          placeholder="Optional planning notes"
          multiline
          numberOfLines={4}
          maxLength={4000}
        />
        <KatipanText variant="bodySmall" color="textMuted">Notes are shown only to guest-domain managers in this mobile experience.</KatipanText>
      </EditorialCard>
      {!!formError && <KatipanText accessibilityRole="alert" color="error">{formError}</KatipanText>}
      <KatipanButton label={household ? "Save Household" : "Create Household"} loading={saving} onPress={() => void save()} />
      <KatipanButton label="Cancel" variant="text" disabled={saving} onPress={() => router.back()} />
    </KatipanScreen>
  );
}

export function GuestFormScreen() {
  const params = useLocalSearchParams<{ householdId?: string | string[]; guestId?: string | string[] }>();
  const householdParam = Array.isArray(params.householdId) ? params.householdId[0] ?? "" : params.householdId ?? "";
  const guestParam = Array.isArray(params.guestId) ? params.guestId[0] ?? "" : params.guestId ?? "";
  const { weddingId, membership, isCurrent, loading, error, data, retry } = useGuestWorkspace();
  const router = useRouter();
  const entries = data ? buildGuestEntries(data) : [];
  const guestEntry = guestParam ? entries.find((entry) => entry.guest.id === guestParam && entry.guest.wedding_id === weddingId) : undefined;

  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading Guest form…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load Guest details." onRetry={retry} /></KatipanScreen>;
  if (guestParam && !guestEntry) return <KatipanScreen><ErrorState title="Guest unavailable" description="This Guest isn't part of the selected Wedding." onRetry={() => router.back()} /></KatipanScreen>;
  if (householdParam && !data.households.some((item) => item.id === householdParam && item.wedding_id === weddingId)) return <KatipanScreen><ErrorState title="Household unavailable" description="This Household isn't part of the selected Wedding." onRetry={() => router.back()} /></KatipanScreen>;
  if (!canManageGuestDomain(membership)) return <KatipanScreen><ErrorState title="Guest changes are read-only" description="Only an Owner, Full Coordinator or Guest Coordinator can manage this Wedding's guest list." onRetry={() => router.back()} /></KatipanScreen>;

  return <GuestFormEditor weddingId={weddingId} membership={membership} data={data} guestEntry={guestEntry ?? null} householdId={householdParam} />;
}

function GuestFormEditor({
  weddingId,
  membership,
  data,
  guestEntry,
  householdId,
}: {
  weddingId: string;
  membership: WorkspaceMembership;
  data: GuestWorkspaceData;
  guestEntry: GuestEntry | null;
  householdId: string;
}) {
  const router = useRouter();
  const gate = useRef(new SingleSubmitGate());
  const [draft, setDraft] = useState<GuestDraft>(() => guestEntry ? {
    displayName: guestEntry.person.display_name,
    firstName: guestEntry.person.first_name ?? "",
    lastName: guestEntry.person.last_name ?? "",
    email: guestEntry.person.email ?? "",
    phone: guestEntry.person.phone ?? "",
    accessibilityAssistanceNote: guestEntry.guest.accessibility_assistance_note ?? "",
    internalNotes: guestEntry.guest.internal_notes ?? "",
  } : emptyGuestDraft);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(guestEntry?.household.id ?? householdId);
  const [mode, setMode] = useState<"NEW" | "EXISTING">("NEW");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedHousehold = data.households.find((household) => household.id === selectedHouseholdId && household.wedding_id === weddingId);
  const availablePeople = selectedHousehold ? availableWeddingPeople(data, selectedHousehold.id) : [];
  const existingMode = !guestEntry && mode === "EXISTING";
  const save = async () => {
    if (!selectedHousehold && !guestEntry) { setFormError("Choose a Household for this Guest."); return; }
    const parsed = guestDraftSchema.safeParse(draft);
    if (!parsed.success) { setFormError(parsed.error.issues[0]?.message ?? "Check the Guest details."); return; }
    await gate.current.run(async () => {
      if (saving) return;
      setSaving(true);
      setFormError(null);
      try {
        if (guestEntry) {
          await updateGuestPerson(membership, guestEntry.guest.id, parsed.data);
          router.replace({ pathname: "/(wedding)/[weddingId]/guests/[guestId]", params: { weddingId, guestId: guestEntry.guest.id } });
        } else {
          if (!selectedHousehold) throw new Error("Choose a Household for this Guest.");
          const newGuestId = await createGuest(membership, selectedHousehold.id, parsed.data);
          router.replace({ pathname: "/(wedding)/[weddingId]/guests/[guestId]", params: { weddingId, guestId: newGuestId } });
        }
      } catch (cause) {
        setFormError(safeGuestError(cause, "We couldn't save this Guest. Try again."));
      } finally { setSaving(false); }
    });
  };
  const addExisting = async (personId: string) => {
    if (!selectedHousehold) return;
    await gate.current.run(async () => {
      if (saving) return;
      setSaving(true);
      setFormError(null);
      try {
        const newGuestId = await addExistingPersonAsGuest(membership, selectedHousehold.id, personId);
        router.replace({ pathname: "/(wedding)/[weddingId]/guests/[guestId]", params: { weddingId, guestId: newGuestId } });
      } catch (cause) {
        setFormError(safeGuestError(cause, "We couldn't add this existing person as a Guest."));
      } finally { setSaving(false); }
    });
  };

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">GUESTS / INDIVIDUAL PERSON</KatipanText>
        <KatipanText variant="headlineLarge" accessibilityRole="header">{guestEntry ? "Edit Guest" : "Add Guest"}</KatipanText>
        <KatipanText color="textMuted">A named person is an individual Guest. An unused allowance never creates a placeholder person.</KatipanText>
      </View>

      {guestEntry ? (
        <EditorialCard style={styles.selectedHouseholdCard}>
          <KatipanText variant="labelCaps" color="secondary">HOUSEHOLD</KatipanText>
          <KatipanText variant="title">{guestEntry.household.display_name}</KatipanText>
        </EditorialCard>
      ) : (
        <View style={styles.section}>
          <SectionHeader title="Choose a Household" description="Household is the invitation grouping for this Guest." />
          {data.households.length === 0 ? (
            <EditorialCard style={styles.emptyCard}>
              <KatipanText color="textMuted">Create a Household before adding a Guest.</KatipanText>
              <KatipanButton label="Create Household" variant="secondary" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/guests/households/new", params: { weddingId } })} />
            </EditorialCard>
          ) : (
            <View style={styles.householdChoices}>
              {data.households.map((household) => (
                <Pressable
                  key={household.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: household.id === selectedHouseholdId }}
                  onPress={() => setSelectedHouseholdId(household.id)}
                  style={[styles.householdChoice, household.id === selectedHouseholdId && styles.householdChoiceSelected]}
                >
                  <KatipanText variant="labelLarge" color={household.id === selectedHouseholdId ? "primary" : "text"}>{household.display_name}</KatipanText>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {!guestEntry && selectedHousehold && (
        <View style={styles.section}>
          <SectionHeader title="Person" description="Reuse an existing Wedding Person where one already exists." />
          <View style={styles.modeRow}>
            <GuestFilterChip label="New person" selected={mode === "NEW"} onPress={() => setMode("NEW")} />
            <GuestFilterChip label="Existing Wedding Person" selected={mode === "EXISTING"} onPress={() => setMode("EXISTING")} />
          </View>
        </View>
      )}

      {existingMode && (
        <View style={styles.section}>
          {availablePeople.length === 0 ? (
            <EditorialCard style={styles.emptyCard}>
              <KatipanText color="textMuted">Every current Wedding Person is already a Guest, or no other people are available. Existing people are not duplicated.</KatipanText>
            </EditorialCard>
          ) : availablePeople.map((person) => (
            <EditorialCard key={person.id} style={styles.personCard}>
              <View style={styles.personCopy}>
                <KatipanText variant="title">{person.display_name}</KatipanText>
                <KatipanText variant="bodySmall" color="textMuted">{[person.email, person.phone].filter(Boolean).join(" · ") || "Wedding Person"}</KatipanText>
              </View>
              <KatipanButton label={`Add ${person.display_name}`} loading={saving} onPress={() => void addExisting(person.id)} />
            </EditorialCard>
          ))}
        </View>
      )}

      {!guestEntry && !existingMode && selectedHousehold && (
        <EditorialCard style={styles.formCard}>
          <FormField label="Display name" value={draft.displayName} onChangeText={(displayName) => setDraft((current) => ({ ...current, displayName }))} placeholder="Maria Santos" autoCapitalize="words" maxLength={160} />
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}><FormField label="First name" value={draft.firstName} onChangeText={(firstName) => setDraft((current) => ({ ...current, firstName }))} autoCapitalize="words" maxLength={100} /></View>
            <View style={styles.fieldHalf}><FormField label="Last name" value={draft.lastName} onChangeText={(lastName) => setDraft((current) => ({ ...current, lastName }))} autoCapitalize="words" maxLength={100} /></View>
          </View>
          <FormField label="Email" value={draft.email} onChangeText={(email) => setDraft((current) => ({ ...current, email }))} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
          <FormField label="Phone" value={draft.phone} onChangeText={(phone) => setDraft((current) => ({ ...current, phone }))} keyboardType="phone-pad" maxLength={40} />
          <FormField label="Accessibility assistance note" value={draft.accessibilityAssistanceNote} onChangeText={(accessibilityAssistanceNote) => setDraft((current) => ({ ...current, accessibilityAssistanceNote }))} multiline numberOfLines={3} maxLength={2000} placeholder="Optional" />
          <FormField label="Private guest notes" value={draft.internalNotes} onChangeText={(internalNotes) => setDraft((current) => ({ ...current, internalNotes }))} multiline numberOfLines={3} maxLength={4000} placeholder="Optional" />
        </EditorialCard>
      )}

      {guestEntry && (
        <EditorialCard style={styles.formCard}>
          <FormField label="Display name" value={draft.displayName} onChangeText={(displayName) => setDraft((current) => ({ ...current, displayName }))} autoCapitalize="words" maxLength={160} />
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}><FormField label="First name" value={draft.firstName} onChangeText={(firstName) => setDraft((current) => ({ ...current, firstName }))} autoCapitalize="words" maxLength={100} /></View>
            <View style={styles.fieldHalf}><FormField label="Last name" value={draft.lastName} onChangeText={(lastName) => setDraft((current) => ({ ...current, lastName }))} autoCapitalize="words" maxLength={100} /></View>
          </View>
          <FormField label="Email" value={draft.email} onChangeText={(email) => setDraft((current) => ({ ...current, email }))} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
          <FormField label="Phone" value={draft.phone} onChangeText={(phone) => setDraft((current) => ({ ...current, phone }))} keyboardType="phone-pad" maxLength={40} />
          <KatipanText variant="bodySmall" color="textMuted">This updates the existing Wedding Person through the guest update workflow. Household, RSVP, seating and claims stay unchanged.</KatipanText>
        </EditorialCard>
      )}

      {!!formError && <KatipanText accessibilityRole="alert" color="error">{formError}</KatipanText>}
      {(guestEntry || (!existingMode && selectedHousehold)) && <KatipanButton label={guestEntry ? "Save Guest Details" : "Create named Guest"} loading={saving} onPress={() => void save()} />}
      <KatipanButton label="Cancel" variant="text" disabled={saving} onPress={() => router.back()} />
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  titleBlock: { gap: s.small },
  formCard: { gap: s.large, padding: s.cardLarge, backgroundColor: c.cardIvory },
  selectedHouseholdCard: { gap: s.small },
  section: { gap: s.medium },
  householdChoices: { gap: s.small },
  householdChoice: { minHeight: 52, justifyContent: "center", paddingHorizontal: s.medium, borderRadius: r.large, borderWidth: 1, borderColor: c.stoneBorder, backgroundColor: c.cardIvory },
  householdChoiceSelected: { borderColor: c.primaryContainer, backgroundColor: c.warmAlabaster },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  personCard: { gap: s.medium, padding: s.medium },
  personCopy: { gap: s.micro },
  fieldRow: { flexDirection: "row", gap: s.medium },
  fieldHalf: { flex: 1 },
  emptyCard: { gap: s.medium },
});
