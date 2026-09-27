import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { KatipanButton, KatipanScreen, KatipanText, EditorialCard, FormField } from "../../ui";
import { artwork, EditorialImage, OnboardingHeader } from "../../onboarding/components";
import { useAccess } from "../../onboarding/provider";
import { MotifPersistenceError, saveMotif } from "../../onboarding/api";
import { SingleFlight } from "../../onboarding/model";

const palettes = [
  { title: "Sage Romance", colors: ["#60725A", "#C5A059", "#D9D0C3", "#FAF8F5"] },
  { title: "Dusty Blue & Silver", colors: ["#7B90A5", "#BAC7D5", "#F4F6F8", "#9AA0A6"] },
  { title: "Champagne Elegance", colors: ["#D4AF37", "#E6D5AC", "#FAF3E0", "#A38029"] },
  { title: "Terracotta & Olive", colors: ["#C36B4E", "#E2A78F", "#FBF4F0", "#556B2F"] },
  { title: "Emerald & Gold", colors: ["#1B4D3E", "#88B79B", "#CFB53B", "#F8F9F7"] },
  { title: "Beach Neutral", colors: ["#D3B89D", "#8C7B6D", "#C0D6DF", "#FFFFFF"] },
] as const;

export default function MotifComplete() {
  const router = useRouter(); const { wedding, draft, finishMotif } = useAccess();
  const [selection, setSelection] = useState(0); const [custom, setCustom] = useState(false);
  const [customColors, setCustomColors] = useState(["#60725A", "#C5A059", "#D9D0C3"]);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const flight = useRef(new SingleFlight<void>()); const busyRef = useRef(false);
  const chosen = custom ? { title: "Custom Palette", colors: customColors } : palettes[selection];
  async function continueToInvite() {
    if (busyRef.current || !wedding) return;
    if (new Set(chosen.colors).size !== chosen.colors.length || chosen.colors.some(color => !/^#[0-9A-F]{6}$/.test(color))) { setError("Use 3–5 distinct colors in #RRGGBB format."); return; }
    busyRef.current = true; setBusy(true); setError("");
    try { await flight.current.run(async () => { await saveMotif(wedding.weddingId, chosen.title, chosen.colors); finishMotif(); router.replace("/(access)/invite-partner"); }); }
    catch (caught) {
      if (__DEV__ && caught instanceof MotifPersistenceError) setError(`We couldn’t save your wedding colors (${caught.stage}). Check your connection and try again.`);
      else setError("We couldn’t save your wedding colors. Check your connection and try again.");
    }
    finally { busyRef.current = false; setBusy(false); }
  }
  const names = [draft.currentName, draft.partnerName].filter(Boolean).join(" & ") || "Your wedding";
  return <KatipanScreen contentContainerStyle={styles.content}>
    <OnboardingHeader step={2} showBack={false} />
    <View style={styles.intro}><KatipanText variant="labelCaps" color="secondary">PERSONALIZED ATMOSPHERE</KatipanText><KatipanText variant="headlineMobile" accessibilityRole="header">Make Katipan feel like your wedding.</KatipanText><KatipanText color="textMuted">Choose your wedding motif to personalize your shared workspace, milestone countdown, and digital guest invitations.</KatipanText></View>
    <View style={styles.preview}><KatipanText variant="labelCaps" color="primary">LIVE PREVIEW</KatipanText><KatipanText variant="headlineSmall">{names}</KatipanText><KatipanText variant="bodySmall" color="textMuted">{draft.date || "Date to be decided"} · {draft.location || "Location to be decided"}</KatipanText><View style={styles.selected}><KatipanText variant="label" color="textMuted">Selected Theme</KatipanText><KatipanText variant="label" color="primary">{chosen.title}</KatipanText></View></View>
    <KatipanText variant="title">Wedding Color Palettes</KatipanText>
    <View style={styles.palettes}>{palettes.map((palette, index) => <Pressable key={palette.title} accessibilityRole="button" accessibilityLabel={palette.title} accessibilityState={{ selected: !custom && selection === index }} onPress={() => { setCustom(false); setSelection(index); }} style={[styles.palette, !custom && selection === index && styles.paletteSelected]}><View style={styles.paletteHeading}><KatipanText variant="title">{palette.title}</KatipanText><KatipanText color="primary">{!custom && selection === index ? "✓" : "○"}</KatipanText></View><View style={styles.swatches}>{palette.colors.map(color => <View key={color} style={[styles.swatch, { backgroundColor: color }]} />)}</View></Pressable>)}</View>
    <KatipanButton label="+ Create Custom Palette (3–5 swatches)" variant="secondary" onPress={() => setCustom(!custom)} />
    {custom && <EditorialCard><KatipanText variant="title">Custom palette</KatipanText>{customColors.map((color, index) => <FormField key={index} label={`Color ${index + 1}`} value={color} onChangeText={text => setCustomColors(current => current.map((item, i) => i === index ? text.toUpperCase() : item))} autoCapitalize="characters" />)}<View style={styles.customActions}><KatipanButton label="Remove" variant="text" disabled={customColors.length <= 3} onPress={() => setCustomColors(current => current.slice(0, -1))} /><KatipanButton label="Add color" variant="text" disabled={customColors.length >= 5} onPress={() => setCustomColors(current => [...current, "#FFFFFF"])} /></View></EditorialCard>}
    <View><KatipanText variant="title">Wedding Workspace Cover Photo</KatipanText><EditorialImage source={artwork.motif} height={180} caption="GARDEN CEREMONY INSPIRATION" /><KatipanText variant="bodySmall" color="textMuted">This editorial preview is bundled with the app. Add your own cover through Attachments later.</KatipanText></View>
    <View style={styles.celebration}><View style={styles.medal}><KatipanText variant="headlineMedium" color="secondary">✦</KatipanText></View><KatipanText variant="headlineMedium" accessibilityRole="header">Your wedding space is ready.</KatipanText><KatipanText color="textMuted" style={styles.center}>Let’s start planning {names}’s special day.</KatipanText><View style={styles.wrap}>{[draft.date || "Date later", draft.location || "Location later", draft.guestCount == null ? "Guest count later" : `${draft.guestCount} guests`, chosen.title].map(item => <View key={item} style={styles.summary}><KatipanText variant="label">{item}</KatipanText></View>)}</View></View>
    <View style={styles.roadmap}><KatipanText variant="labelCaps" color="secondary">WHAT TO EXPLORE FIRST</KatipanText><KatipanText>• Add ceremony and reception places</KatipanText><KatipanText>• Review your personalized checklist</KatipanText><KatipanText>• Add your first supplier</KatipanText><KatipanText>• Start your guest list</KatipanText></View>
    {!!error && <KatipanText color="error" accessibilityRole="alert">{error}</KatipanText>}
    <KatipanButton label="Continue to Partner Invitation  →" loading={busy} onPress={() => void continueToInvite()} />
  </KatipanScreen>;
}
const styles = StyleSheet.create({ content: { gap: s.large }, intro: { gap: s.small }, preview: { backgroundColor: c.surfaceLow, borderRadius: r.large, padding: s.card, gap: s.small }, selected: { backgroundColor: c.surfaceLowest, borderRadius: r.medium, padding: s.small, flexDirection: "row", justifyContent: "space-between" }, palettes: { gap: s.medium }, palette: { backgroundColor: c.surfaceLow, padding: s.medium, borderRadius: r.large, gap: s.medium, borderWidth: 2, borderColor: "transparent" }, paletteSelected: { borderColor: c.primary }, paletteHeading: { flexDirection: "row", justifyContent: "space-between" }, swatches: { flexDirection: "row", gap: s.small }, swatch: { flex: 1, height: 36, borderRadius: r.base, borderWidth: 1, borderColor: c.stoneBorder }, customActions: { flexDirection: "row", justifyContent: "space-between" }, celebration: { alignItems: "center", gap: s.medium, padding: s.large, borderRadius: r.extraLarge, backgroundColor: c.surfaceLow }, medal: { width: 56, height: 56, borderRadius: r.pill, backgroundColor: c.secondaryContainer, alignItems: "center", justifyContent: "center" }, center: { textAlign: "center" }, wrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: s.small }, summary: { borderRadius: r.pill, backgroundColor: c.surfaceContainer, paddingHorizontal: s.medium, paddingVertical: s.small }, roadmap: { backgroundColor: c.surfaceLow, borderRadius: r.large, padding: s.card, gap: s.medium } });
