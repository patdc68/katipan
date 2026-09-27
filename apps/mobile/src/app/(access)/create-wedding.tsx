import { useRouter } from "expo-router";
import { View, StyleSheet } from "react-native";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { KatipanScreen, KatipanText, KatipanButton } from "../../ui";
import { artwork, EditorialImage, InfoRow, OnboardingHeader } from "../../onboarding/components";
import { useAccess } from "../../onboarding/provider";

export default function CreateWedding() {
  const router = useRouter(); const { beginDetails, signOut } = useAccess();
  return <KatipanScreen contentContainerStyle={styles.content}>
    <OnboardingHeader backLabel="Sign out" onBack={() => void signOut()} />
    <View style={styles.intro}><KatipanText variant="labelCaps" color="secondary">WELCOME TO KATIPAN</KatipanText><KatipanText variant="headlineMobile" accessibilityRole="header">Let’s create your wedding.</KatipanText><KatipanText color="textMuted" style={styles.center}>A few details will help Katipan personalize your planning experience, estimate your timeline, and tailor curated recommendations.</KatipanText></View>
    <EditorialImage source={artwork.create} height={220} caption="KEEPSAKE EDITION  ·  Araw ng Kasal" />
    <View style={styles.card}><KatipanText variant="title">What we’ll personalize</KatipanText><InfoRow title="Your Shared Planning Workspace" description="One collaborative space for you and your partner with live synced guest lists and budgets." /><InfoRow icon="◷" title="Personalized Milestone Roadmap" description="Built around your estimated date and celebration style." /><InfoRow icon="☷" title="A Plan Built Around Your Wedding" description="Checklist, budget, guests, places, and wedding details in one space." /></View>
    <View style={styles.time}><KatipanText variant="label" color="textMuted" style={styles.center}>Takes only 2 minutes · Details can be changed later</KatipanText></View>
    <KatipanButton label="Start Planning  →" onPress={() => { beginDetails(); router.push("/(access)/wedding-details"); }} />
  </KatipanScreen>;
}
const styles = StyleSheet.create({ content: { gap: s.large }, intro: { alignItems: "center", gap: s.small }, center: { textAlign: "center" }, card: { backgroundColor: c.surfaceLow, borderRadius: r.extraLarge, padding: s.large, gap: s.medium }, time: { backgroundColor: c.surfaceContainer, borderRadius: r.pill, padding: s.small } });
