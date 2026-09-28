import { useRouter, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { KatipanButton, KatipanScreen, KatipanText, EditorialCard } from "../ui";
import { artwork, Brand, EditorialImage, InfoRow } from "../onboarding/components";

export function CoordinatorOnboardingScreen() {
  const router = useRouter();
  return (
    <KatipanScreen contentContainerStyle={styles.screen}>
      <View style={styles.topline}><Brand /><KatipanText variant="labelCaps" color="secondary">COORDINATOR WORKFLOW</KatipanText></View>
      <EditorialImage source={artwork.create} height={218} caption="One workspace for each celebration" />
      <View style={styles.intro}>
        <KatipanText variant="headlineMobile" accessibilityRole="header">Plan every Wedding in one place.</KatipanText>
        <KatipanText color="textMuted">Your Katipan account can coordinate client Weddings and belong to your own Wedding too. Your role is set separately for each Wedding.</KatipanText>
      </View>
      <EditorialCard style={styles.card}>
        <InfoRow icon="◇" title="Keep every Wedding together" description="Switch between the Weddings you own and the client Weddings you coordinate from My Weddings." />
        <InfoRow icon="♡" title="Start before the couple joins" description="Create one shared Wedding workspace with the partners' existing Person records. They can join later through separate invitations." />
        <InfoRow icon="↔" title="No permanent account type" description="There is no coordinator-only or couple-only account. Access comes from each Wedding membership." />
      </EditorialCard>
      <KatipanButton label="Create a Client Wedding" onPress={() => router.push("/(coordinator)/create-client-wedding" as unknown as Href)} />
      <KatipanButton label="Back to My Weddings" variant="text" onPress={() => router.replace("/(workspace)/weddings")} />
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: s.large, paddingBottom: s.extraLarge },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  intro: { gap: s.small },
  card: { gap: s.large, backgroundColor: c.surfaceLowest, borderRadius: r.extraLarge, padding: s.cardLarge },
});
