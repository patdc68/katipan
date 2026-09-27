import { useRouter } from "expo-router";
import { Image, StyleSheet, View } from "react-native";
import { colorTokens as c, spacingTokens as s, fontTokens } from "@katipan/ui";
import { KatipanButton, KatipanScreen, KatipanText } from "../../ui";
import { artwork, Brand } from "../../onboarding/components";

export default function Welcome() {
  const router = useRouter();
  return <KatipanScreen padded={false} contentContainerStyle={styles.content}>
    <View style={styles.hero}><Image source={artwork.welcome} style={styles.heroImage} resizeMode="cover" accessibilityLabel="Couple walking through a sunlit wedding garden" /><View style={[styles.fade, { bottom: 0, opacity: 1 }]} /><View style={[styles.fade, { bottom: 32, opacity: 0.7 }]} /><View style={[styles.fade, { bottom: 64, opacity: 0.4 }]} /><View style={[styles.fade, { bottom: 96, opacity: 0.15 }]} /></View>
    <View style={styles.body}>
      <Brand compact />
      <View style={styles.headline}><KatipanText variant="headlineMedium" color="secondary" style={styles.italic}>Plan your wedding.</KatipanText><KatipanText variant="headlineMobile">Together.</KatipanText></View>
      <KatipanText color="textMuted" style={styles.center}>Everything you need to plan your wedding, share the journey with your Katipan, and prepare for the big day.</KatipanText>
      <View style={styles.features}>{["♡  Shared Planning", "◇  Budget & Suppliers", "✉  Guests & RSVP", "▣  Wedding Website", "◷  Wedding Day"].map(item => <View key={item} style={styles.feature}><KatipanText variant="label" color="textMuted">{item}</KatipanText></View>)}</View>
      <View style={styles.actions}><KatipanButton label="Create Account  →" onPress={() => router.push("/(access)/auth?mode=signup")} /><KatipanButton label="Sign In" variant="secondary" onPress={() => router.push("/(access)/auth?mode=signin")} /></View>
      <KatipanText variant="bodySmall" color="textMuted" style={styles.center}>Already planning with your partner? Sign in to continue.</KatipanText>
      <KatipanText variant="labelCaps" color="textMuted" style={styles.footer}>CURATED FOR MODERN FILIPINO CELEBRATIONS</KatipanText>
    </View>
  </KatipanScreen>;
}
const styles = StyleSheet.create({
  content: { gap: 0 }, hero: { height: 390, overflow: "hidden" }, heroImage: { width: "100%", height: "100%" }, fade: { position: "absolute", left: 0, right: 0, height: 32, backgroundColor: c.background }, body: { paddingHorizontal: s.margin, alignItems: "center", gap: s.medium, marginTop: -40, paddingBottom: s.extraLarge },
  headline: { alignItems: "center" }, italic: { fontFamily: fontTokens.displaySemiboldItalic }, center: { textAlign: "center" },
  features: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: s.small, paddingVertical: s.small }, feature: { backgroundColor: c.surfaceLow, borderRadius: 9999, paddingHorizontal: s.small, paddingVertical: s.small }, actions: { width: "100%", gap: s.small },
  footer: { marginTop: s.extraLarge, textAlign: "center", letterSpacing: 1, color: c.secondary },
});
