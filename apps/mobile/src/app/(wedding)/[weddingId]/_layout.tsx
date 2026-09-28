import { useEffect } from "react";
import { Redirect, Tabs, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { colorTokens as c, fontTokens } from "@katipan/ui";
import { useAccess } from "../../../onboarding/provider";
import { useWorkspace } from "../../../workspace/context";
import { destinationAfterRestore, isCurrentWeddingWorkspace } from "../../../workspace/model";
import { ErrorState, KatipanScreen, LoadingState } from "../../../ui";

export default function WeddingTabsLayout() {
  const params = useLocalSearchParams<{ weddingId?: string | string[] }>();
  const weddingId = Array.isArray(params.weddingId) ? params.weddingId[0] ?? "" : params.weddingId ?? "";
  const access = useAccess();
  const workspace = useWorkspace();
  const membership = workspace.membershipFor(weddingId);
  const { selectedWeddingId, setSelectedWedding } = workspace;

  useEffect(() => {
    if (membership && weddingId && selectedWeddingId !== weddingId) {
      try { setSelectedWedding(weddingId); } catch { /* The redirect below handles a stale membership. */ }
    }
  }, [membership, weddingId, selectedWeddingId, setSelectedWedding]);

  if (access.loading || (access.session && workspace.loading)) return <KatipanScreen><LoadingState label="Restoring your Wedding…" /></KatipanScreen>;
  if (!access.session) return <Redirect href="/(access)/welcome" />;
  if (access.error) return <KatipanScreen><ErrorState description={access.error} onRetry={() => void access.refresh()} /></KatipanScreen>;
  if (workspace.error) return <KatipanScreen><ErrorState description={workspace.error} onRetry={() => void workspace.refreshMemberships()} /></KatipanScreen>;
  if (!membership) {
    const destination = destinationAfterRestore(true, workspace.memberships);
    return destination === "create-wedding"
      ? <Redirect href="/(access)/create-wedding" />
      : <Redirect href="/(workspace)/weddings" />;
  }
  if (!isCurrentWeddingWorkspace(membership, selectedWeddingId, weddingId)) return <KatipanScreen><LoadingState label="Opening your Wedding…" /></KatipanScreen>;

  return (
    <Tabs
      key={`${weddingId}:${workspace.cacheRevision}`}
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.outline,
        tabBarLabelStyle: { fontFamily: fontTokens.bodySemibold, fontSize: 10, marginBottom: 4 },
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          backgroundColor: c.background,
          borderTopColor: c.stoneBorder,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarAccessibilityLabel: "Home tab", tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size + 5 }}>♡</Text> }} />
      <Tabs.Screen name="plan" options={{ title: "Plan", tabBarAccessibilityLabel: "Plan tab", tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size + 3 }}>☷</Text> }} />
      <Tabs.Screen name="guests" options={{ title: "Guests", tabBarAccessibilityLabel: "Guests tab", tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size + 3 }}>♧</Text> }} />
      <Tabs.Screen name="seating" options={{ href: null, title: "Seating" }} />
      <Tabs.Screen name="day" options={{ href: null, title: "Wedding Day" }} />
      <Tabs.Screen name="website" options={{ href: null, title: "Wedding Website" }} />
      <Tabs.Screen name="budget" options={{ title: "Budget", tabBarAccessibilityLabel: "Budget tab", tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size + 3 }}>₱</Text> }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarAccessibilityLabel: "More tab", tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size + 3 }}>•••</Text> }} />
    </Tabs>
  );
}
