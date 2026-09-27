import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { KatipanButton, KatipanScreen, KatipanText, FormField } from "../../ui";
import WeddingDateField from "../../onboarding/WeddingDateField";
import { artwork, ChoiceChip, EditorialImage, OnboardingHeader } from "../../onboarding/components";
import { useAccess, findExistingWedding } from "../../onboarding/provider";
import { createCoupleWedding } from "../../onboarding/api";
import { friendlyError, SingleFlight, weddingDateForSubmit, weddingDraftSchema, type WeddingDraft } from "../../onboarding/model";

const destinations = ["Metro Manila", "Antipolo, Rizal", "Tagaytay", "Cebu", "Boracay / Palawan", "Destination Abroad"];
const guests: { label: string; count: number | null }[] = [{ label: "Under 50", count: 25 }, { label: "50–100", count: 75 }, { label: "100–150", count: 125 }, { label: "150–250", count: 200 }, { label: "250+", count: 250 }, { label: "Not sure yet", count: null }];
const stylesOfCeremony: WeddingDraft["ceremonyStyle"][] = ["UNDECIDED", "RELIGIOUS", "CIVIL", "SYMBOLIC", "SECULAR", "DESTINATION", "OTHER"];

export default function WeddingDetails() {
  const router = useRouter();
  const { draft, updateDraft, setWedding, session, returnToCreate } = useAccess();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [noDate, setNoDate] = useState(!draft.date);
  const flight = useRef(new SingleFlight<void>());
  const busyRef = useRef(false);
  function change<K extends keyof WeddingDraft>(key: K, value: WeddingDraft[K]) { updateDraft({ [key]: value }); }
  async function submit() {
    if (busyRef.current) return;
    const candidate = { ...draft, date: weddingDateForSubmit(draft.date, noDate), weddingName: draft.weddingName.trim() || [draft.currentName.trim(), draft.partnerName.trim()].filter(Boolean).join(" & ") + "’s Wedding" };
    const valid = weddingDraftSchema.safeParse(candidate);
    if (!valid.success) { setError(valid.error.issues[0]?.message ?? "Check your details."); return; }
    busyRef.current = true; setBusy(true); setError("");
    try {
      await flight.current.run(async () => {
        const created = await createCoupleWedding(valid.data);
        setWedding(created);
        router.replace("/(access)/motif-complete");
      });
    } catch (caught) {
      // A lost response after commit must not prompt the user to create a duplicate.
      try {
        const recovered = session && await findExistingWedding(session.user.id);
        if (recovered) { setWedding(recovered.wedding); router.replace("/(access)/motif-complete"); return; }
      } catch { /* Keep the form and allow a deliberate retry. */ }
      setError(friendlyError(caught, "We couldn’t create your wedding. Check your connection and try again."));
    } finally { busyRef.current = false; setBusy(false); }
  }
  return <KatipanScreen contentContainerStyle={styles.content}>
    <OnboardingHeader step={1} onBack={() => { returnToCreate(); router.replace("/(access)/create-wedding"); }} />
    <View style={styles.hero}><EditorialImage source={artwork.details} height={66} width={66} /><View style={{ flex: 1 }}><KatipanText variant="headlineMedium" accessibilityRole="header">Tell us about your day</KatipanText><KatipanText variant="bodySmall" color="textMuted">Let’s craft your wedding sanctuary together, step by step.</KatipanText></View></View>
    <View style={styles.card}><KatipanText variant="title">♡  The Couple</KatipanText><FormField label="Your Name" placeholder="e.g., Patrick" value={draft.currentName} onChangeText={text => change("currentName", text)} autoCapitalize="words" /><FormField label="Your Partner’s Name" placeholder="e.g., Anna" value={draft.partnerName} onChangeText={text => change("partnerName", text)} autoCapitalize="words" hint="You can invite your partner to co-plan in the last step." /><FormField label="Wedding workspace name" placeholder="e.g., Patrick & Anna’s Wedding" value={draft.weddingName} onChangeText={text => change("weddingName", text)} hint="Leave blank to use both names." /></View>
    <View style={styles.card}><KatipanText variant="title">▣  Wedding Date</KatipanText><WeddingDateField date={draft.date} disabled={noDate} onChange={date => { change("date", date); if (date) setNoDate(false); }} /><Pressable accessibilityRole="checkbox" accessibilityLabel="We haven’t chosen a date yet" accessibilityState={{ checked: noDate }} onPress={() => { const next = !noDate; setNoDate(next); if (next) change("date", ""); }} style={styles.inline}><KatipanText color="primary">{noDate ? "☑" : "□"}</KatipanText><KatipanText>We haven’t chosen a date yet</KatipanText></Pressable></View>
    <View style={styles.card}><KatipanText variant="title">⌖  General Wedding Location</KatipanText><FormField label="City, province, or destination" placeholder="e.g., Antipolo, Rizal" value={draft.location} onChangeText={text => change("location", text)} /><KatipanText variant="labelCaps" color="textMuted">POPULAR DESTINATIONS</KatipanText><View style={styles.wrap}>{destinations.map(item => <ChoiceChip key={item} label={item} selected={draft.location === item} onPress={() => change("location", item)} />)}</View></View>
    <View style={styles.card}><KatipanText variant="title">♧  Estimated Guest Count</KatipanText><KatipanText variant="bodySmall" color="textMuted">How many guests might join you to celebrate? Range choices use a planning estimate.</KatipanText><View style={styles.wrap}>{guests.map(item => <ChoiceChip key={item.label} label={item.label} selected={draft.guestCount === item.count} onPress={() => change("guestCount", item.count)} />)}</View></View>
    <View style={styles.card}><KatipanText variant="title">Ceremony Style</KatipanText><KatipanText variant="bodySmall" color="textMuted">Independent of your venue or place type.</KatipanText><View style={styles.wrap}>{stylesOfCeremony.map(item => <ChoiceChip key={item} label={item.charAt(0) + item.slice(1).toLowerCase()} selected={draft.ceremonyStyle === item} onPress={() => change("ceremonyStyle", item)} />)}</View></View>
    <View style={styles.card}><KatipanText variant="title">₱  Target Budget  <KatipanText variant="labelCaps" color="secondary">OPTIONAL PREVIEW</KatipanText></KatipanText><FormField label="Target amount" placeholder="e.g., 600,000" value={draft.targetBudget} onChangeText={text => change("targetBudget", text)} keyboardType="numeric" hint="For this preview only. Set your budget in Budget after onboarding." /></View>
    {!!error && <KatipanText color="error" accessibilityRole="alert">{error}</KatipanText>}
    <KatipanButton label="Continue  →" loading={busy} onPress={() => void submit()} />
    <KatipanText variant="labelCaps" color="textMuted" style={styles.center}>YOUR WEDDING IS CREATED WHEN YOU CONTINUE</KatipanText>
  </KatipanScreen>;
}
const styles = StyleSheet.create({ content: { gap: s.medium }, hero: { flexDirection: "row", alignItems: "center", gap: s.medium, padding: s.medium, backgroundColor: c.surfaceLow, borderRadius: r.large }, card: { backgroundColor: c.surfaceLowest, padding: s.card, borderRadius: r.large, gap: s.medium }, wrap: { flexDirection: "row", flexWrap: "wrap", gap: s.small }, inline: { flexDirection: "row", gap: s.small, minHeight: 48, alignItems: "center" }, center: { textAlign: "center" } });
