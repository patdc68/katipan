import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { useRouter } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { KatipanText } from "../ui";

export const artwork: Record<"welcome" | "create" | "details" | "motif" | "invite", ImageSourcePropType> = {
  welcome: require("../../assets/images/stitch-welcome.jpg"),
  create: require("../../assets/images/stitch-create.jpg"),
  details: require("../../assets/images/stitch-details.jpg"),
  motif: require("../../assets/images/stitch-motif.jpg"),
  invite: require("../../assets/images/stitch-invite.jpg"),
};

export function Brand({ compact = false }: { compact?: boolean }) {
  return <View style={styles.brand}><View style={styles.brandSeal}><KatipanText variant="label" color="primary">♡</KatipanText></View><KatipanText variant={compact ? "labelCaps" : "headlineSmall"}>KATIPAN</KatipanText></View>;
}

export function OnboardingHeader({ step, total = 4, onBack, end, showBack = true, backLabel = "Go back" }: { step?: number; total?: number; onBack?: () => void; end?: ReactNode; showBack?: boolean; backLabel?: string }) {
  const router = useRouter();
  return <View style={styles.headerWrap}>
    <View style={styles.header}>
      {showBack ? <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack ?? (() => router.back())} style={styles.back}><KatipanText variant="title">‹</KatipanText></Pressable> : <View style={styles.back} />}
      <Brand compact />
      <View style={styles.headerEnd}>{end}</View>
    </View>
    {step != null && <View style={styles.progressWrap}><View style={styles.progressLabels}><KatipanText variant="labelCaps" color="secondary">STEP {step} OF {total}</KatipanText><KatipanText variant="label" color="textMuted">{step === 1 ? "The Foundations" : step === 2 ? "Your Wedding Style" : "Katipan Partnership"}</KatipanText></View><View style={styles.progress}>{Array.from({ length: total }, (_, index) => <View key={index} style={[styles.progressBar, index < step && styles.progressActive]} />)}</View></View>}
  </View>;
}

export function EditorialImage({ source, height = 220, width = "100%", caption }: { source: ImageSourcePropType; height?: number; width?: number | "100%"; caption?: string }) {
  return <View style={[styles.imageFrame, { height, width }]}><Image source={source} style={styles.image} resizeMode="cover" accessibilityLabel={caption ?? "Wedding editorial photograph"} />{caption && <View style={styles.imageCaption}><KatipanText variant="label" color="onPrimary">{caption}</KatipanText></View>}</View>;
}

export function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><KatipanText variant="label" color={selected ? "onPrimary" : "text"}>{label}</KatipanText></Pressable>;
}

export function InfoRow({ title, description, icon = "♡" }: { title: string; description: string; icon?: string }) {
  return <View style={styles.infoRow}><View style={styles.infoIcon}><KatipanText variant="title" color="primary">{icon}</KatipanText></View><View style={{ flex: 1 }}><KatipanText variant="title">{title}</KatipanText><KatipanText variant="bodySmall" color="textMuted">{description}</KatipanText></View></View>;
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: s.small },
  brandSeal: { width: 22, height: 22, borderWidth: 1, borderColor: c.antiqueGold, borderRadius: r.pill, alignItems: "center", justifyContent: "center" },
  headerWrap: { gap: s.medium },
  header: { height: 48, flexDirection: "row", alignItems: "center", gap: s.small },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerEnd: { marginLeft: "auto" },
  progressWrap: { gap: s.small },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  progress: { flexDirection: "row", gap: s.small },
  progressBar: { flex: 1, height: 6, backgroundColor: c.surfaceHighest, borderRadius: r.pill },
  progressActive: { backgroundColor: c.primaryContainer },
  imageFrame: { overflow: "hidden", borderRadius: r.large, backgroundColor: c.surfaceLow },
  image: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%" },
  imageCaption: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#1e1b1977", padding: s.small },
  chip: { minHeight: 44, paddingHorizontal: s.medium, justifyContent: "center", alignItems: "center", backgroundColor: c.surfaceLow, borderRadius: r.pill, borderWidth: 1, borderColor: c.stoneBorder },
  chipSelected: { backgroundColor: c.primary, borderColor: c.primary },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: s.medium },
  infoIcon: { width: 34, height: 34, borderRadius: r.pill, backgroundColor: c.primaryFixed, alignItems: "center", justifyContent: "center" },
});
