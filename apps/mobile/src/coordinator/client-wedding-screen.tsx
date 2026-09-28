import { useRef, useState } from "react";
import { Redirect, useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { useAccess } from "../onboarding/provider";
import { Brand, ChoiceChip } from "../onboarding/components";
import WeddingDateField from "../onboarding/WeddingDateField";
import { FormField, KatipanButton, KatipanScreen, KatipanText, LoadingState } from "../ui";
import { useWorkspace } from "../workspace/context";
import { ceremonyStyleOptions, clientWeddingDraftSchema, emptyClientWeddingDraft, safeClientWeddingFailure, type ClientWeddingDraft } from "./model";
import { createClientWedding } from "./api";

export function ClientWeddingScreen() {
  const router = useRouter();
  const access = useAccess();
  const workspace = useWorkspace();
  const [draft, setDraft] = useState<ClientWeddingDraft>(emptyClientWeddingDraft);
  const [noDate, setNoDate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createdWeddingId, setCreatedWeddingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const busyRef = useRef(false);

  function change<K extends keyof ClientWeddingDraft>(key: K, value: ClientWeddingDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function openCreatedWedding(weddingId: string) {
    try {
      await workspace.refreshMemberships(weddingId);
      router.replace({ pathname: "/(coordinator)/[weddingId]/overview", params: { weddingId } } as unknown as Href);
    } catch {
      setError("The client Wedding was created. We could not refresh your memberships yet; try opening it again.");
    }
  }

  async function submit() {
    if (busyRef.current || !access.session) return;
    if (createdWeddingId) {
      busyRef.current = true;
      setBusy(true);
      setError("");
      try { await openCreatedWedding(createdWeddingId); }
      finally { busyRef.current = false; setBusy(false); }
      return;
    }
    const candidate = { ...draft, weddingDate: noDate ? "" : draft.weddingDate };
    const parsed = clientWeddingDraftSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review the Wedding details and try again.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const created = await createClientWedding(parsed.data);
      setCreatedWeddingId(created.wedding_id);
      await openCreatedWedding(created.wedding_id);
    } catch (caught) {
      if (!createdWeddingId) setError(safeClientWeddingFailure(caught));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (access.loading || (access.session && workspace.loading)) return <KatipanScreen><LoadingState label="Restoring your Wedding memberships…" /></KatipanScreen>;
  if (!access.session) return <Redirect href="/(access)/welcome" />;

  return (
    <KatipanScreen contentContainerStyle={styles.screen}>
      <View style={styles.topline}><Brand /><KatipanText variant="labelCaps" color="secondary">NEW CLIENT WEDDING</KatipanText></View>
      <View style={styles.intro}>
        <KatipanText variant="headlineMobile" accessibilityRole="header">Create a Client Wedding</KatipanText>
        <KatipanText color="textMuted">The partners begin as Person records in this Wedding. They do not need Katipan accounts yet.</KatipanText>
      </View>

      <View style={styles.card}>
        <KatipanText variant="title">Wedding and partners</KatipanText>
        <FormField label="Wedding display name" placeholder="Juan & Maria’s Wedding" value={draft.weddingDisplayName} onChangeText={(value) => change("weddingDisplayName", value)} autoCapitalize="words" />
        <FormField label="Partner 1 name" placeholder="Juan" value={draft.partner1DisplayName} onChangeText={(value) => change("partner1DisplayName", value)} autoCapitalize="words" />
        <FormField label="Partner 2 name" placeholder="Maria" value={draft.partner2DisplayName} onChangeText={(value) => change("partner2DisplayName", value)} autoCapitalize="words" />
      </View>

      <View style={styles.card}>
        <KatipanText variant="title">Celebration details</KatipanText>
        <WeddingDateField date={draft.weddingDate} disabled={noDate || busy} onChange={(value) => { change("weddingDate", value); if (value) setNoDate(false); }} label="Wedding date (optional)" />
        <Pressable accessibilityRole="checkbox" accessibilityLabel="Wedding date is undecided" accessibilityState={{ checked: noDate }} disabled={busy} onPress={() => { const next = !noDate; setNoDate(next); if (next) change("weddingDate", ""); }} style={styles.inline}>
          <KatipanText color="primary">{noDate ? "☑" : "□"}</KatipanText><KatipanText>We have not chosen a date yet</KatipanText>
        </Pressable>
        <FormField label="Timezone (optional)" placeholder="Asia/Manila" value={draft.timezone} onChangeText={(value) => change("timezone", value)} autoCapitalize="none" autoCorrect={false} />
        <FormField label="General location (optional)" placeholder="Antipolo, Rizal" value={draft.generalLocation} onChangeText={(value) => change("generalLocation", value)} autoCapitalize="words" />
        <FormField label="Estimated guest count (optional)" placeholder="e.g. 120" value={draft.estimatedGuestCount} onChangeText={(value) => change("estimatedGuestCount", value)} keyboardType="number-pad" />
      </View>

      <View style={styles.card}>
        <KatipanText variant="title">Ceremony style</KatipanText>
        <KatipanText variant="bodySmall" color="textMuted">This is independent of venue or place type. Choose the ceremony style value that fits best.</KatipanText>
        <View style={styles.choices}>
          {ceremonyStyleOptions.map((item) => (
            <ChoiceChip key={item.value} label={item.label} selected={draft.ceremonyStyle === item.value} onPress={() => change("ceremonyStyle", item.value)} />
          ))}
        </View>
      </View>

      {error ? <KatipanText color="error" accessibilityRole="alert">{error}</KatipanText> : null}
      <KatipanButton label={createdWeddingId ? "Open Client Wedding" : "Create Client Wedding"} loading={busy} onPress={() => void submit()} />
      <KatipanText variant="bodySmall" color="textMuted" style={styles.footnote}>You will be the Full Coordinator for this Wedding. Couples can join later through their own invitations.</KatipanText>
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: s.large, paddingBottom: s.extraLarge },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  intro: { gap: s.small },
  card: { gap: s.medium, backgroundColor: c.surfaceLowest, borderRadius: r.large, padding: s.cardLarge },
  inline: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: s.small },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  footnote: { textAlign: "center" },
});
