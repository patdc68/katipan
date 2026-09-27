import { Redirect, Stack, useSegments } from "expo-router";
import { View } from "react-native";
import { colorTokens } from "@katipan/ui";
import { ErrorState, LoadingState } from "../../ui";
import { useAccess } from "../../onboarding/provider";
import { allowedRoute, type AccessRoute } from "../../onboarding/model";

export default function AccessLayout() {
  const { loading, error, refresh, session, stage, motifDone } = useAccess();
  const segments = useSegments();
  const requested = ((segments as string[])[1] || "welcome") as AccessRoute;
  if (loading) return <View style={{ flex: 1, backgroundColor: colorTokens.background }}><LoadingState label="Restoring your wedding…" /></View>;
  if (error) return <View style={{ flex: 1, backgroundColor: colorTokens.background }}><ErrorState description={error} onRetry={() => void refresh()} /></View>;
  const destination = allowedRoute(requested, Boolean(session), stage, motifDone);
  if (destination !== requested) return <Redirect href={`/(access)/${destination}`} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
