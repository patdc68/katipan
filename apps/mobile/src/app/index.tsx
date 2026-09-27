import { StyleSheet, View } from "react-native";
import { colorTokens, spacingTokens } from "@katipan/ui";
import { KatipanText } from "../ui";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <KatipanText variant="headlineLarge">KATIPAN</KatipanText>
      <KatipanText variant="body" color="textMuted">Mobile foundation ready.</KatipanText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colorTokens.background,
    flex: 1,
    justifyContent: "center",
    padding: spacingTokens.large,
    gap: spacingTokens.medium,
  },
});
