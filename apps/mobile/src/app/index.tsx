import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>KATIPAN</Text>
      <Text style={styles.subtitle}>Mobile foundation ready.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#fffaf7",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#4c1d2f",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 2,
  },
  subtitle: {
    color: "#6b5560",
    fontSize: 16,
    marginTop: 12,
  },
});
