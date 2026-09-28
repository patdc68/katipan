import { StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { spacingTokens as s } from "@katipan/ui";
import { Brand } from "../onboarding/components";
import { EditorialCard, KatipanButton, KatipanScreen, KatipanText } from "../ui";
import { useWorkspace } from "../workspace/context";
import { isCurrentWeddingWorkspace } from "../workspace/model";

export function SupplierPaymentsPlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ weddingId?: string | string[] }>();
  const weddingId = Array.isArray(params.weddingId) ? params.weddingId[0] ?? "" : params.weddingId ?? "";
  const workspace = useWorkspace();
  const membership = weddingId ? workspace.membershipFor(weddingId) : null;
  const isCurrent = isCurrentWeddingWorkspace(membership, workspace.selectedWeddingId, weddingId);

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <Brand compact />
      <EditorialCard style={styles.card}>
        <KatipanText variant="labelCaps" color="secondary">SUPPLIER PAYMENTS</KatipanText>
        <KatipanText variant="headlineMedium" accessibilityRole="header">Supplier payments are managed separately</KatipanText>
        <KatipanText color="textMuted">A linked Supplier’s actual spending belongs in the Supplier and Payments area. This Budget screen does not create payment records or receipts.</KatipanText>
        <KatipanText variant="bodySmall" color="textMuted">The Budget Item keeps its estimated amount. Actual Supplier payments will come from the Wedding’s payment transaction ledger.</KatipanText>
      </EditorialCard>
      <KatipanButton label="Back to Budget Item" variant="secondary" disabled={!isCurrent} onPress={() => router.back()} />
      {isCurrent && <KatipanButton label="Open Wedding Budget" variant="text" onPress={() => router.replace({
        pathname: "/(wedding)/[weddingId]/budget",
        params: { weddingId },
      } as unknown as Href)} />}
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  card: { gap: s.medium },
});
