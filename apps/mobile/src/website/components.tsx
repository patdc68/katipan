import { useCallback, useRef, useState } from "react";
import { useFocusEffect, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";
import { colorTokens as c, spacingTokens as s } from "@katipan/ui";
import { useWeddingDayRoute } from "../wedding-day/components";
import { EditorialCard, ErrorState, KatipanButton, KatipanScreen, KatipanText, LoadingState, SectionHeader, StatusChip } from "../ui";
import { loadWebsite } from "./api";
import { canManageWebsite, safeWebsiteError, SubmitGate, type WebsiteData } from "./model";

export function useWebsiteScreen() {
  const route = useWeddingDayRoute();
  const [revision, setRevision] = useState(0);
  const [load, setLoad] = useState<{ key: string; data: WebsiteData | null; failed: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const gate = useRef(new SubmitGate());
  const { membership, isCurrent, workspace, weddingId } = route;
  const key = `${weddingId}:${membership?.membershipId ?? "none"}:${workspace.cacheRevision}:${revision}`;
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (isCurrent && membership) void loadWebsite(membership)
      .then(data => { if (alive) setLoad({ key, data, failed: false }); })
      .catch(() => { if (alive) setLoad({ key, data: null, failed: true }); });
    return () => { alive = false; };
  }, [isCurrent, membership, key]));
  const retry = () => setRevision(n => n + 1);
  const mutate = async (action: () => Promise<void>) => gate.current.run(async () => {
    setSaving(true); setSaveError(null);
    try { await action(); retry(); }
    catch (cause) { setSaveError(safeWebsiteError(cause)); }
    finally { setSaving(false); }
  });
  const navigate = (page: "" | "templates" | "sections" | "preview" | "program") => route.router.push({
    pathname: `/(wedding)/[weddingId]/website${page ? `/${page}` : ""}`, params: { weddingId },
  } as unknown as Href);
  return { ...route, data: load?.key === key ? load.data : null,
    pending: workspace.loading || (isCurrent && !!membership && load?.key !== key), failed: load?.failed ?? false,
    retry, saving, saveError, mutate, navigate, canManage: canManageWebsite(membership) };
}

export function WebsiteGuard({ state, children }: { state: ReturnType<typeof useWebsiteScreen>; children: React.ReactNode }) {
  if (state.pending) return <KatipanScreen><LoadingState label="Loading Wedding website…" /></KatipanScreen>;
  if (!state.membership || !state.isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" onRetry={() => state.router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (state.failed || !state.data) return <KatipanScreen><ErrorState title="Website unavailable" onRetry={state.retry} /></KatipanScreen>;
  return <>{children}</>;
}
export function WebsiteHeader({ title, description, published }: { title: string; description: string; published?: boolean }) {
  return <View style={styles.header}>
    <KatipanText variant="labelCaps" color="secondary">WEDDING WEBSITE</KatipanText>
    <KatipanText variant="headlineLarge" accessibilityRole="header">{title}</KatipanText>
    <KatipanText color="textMuted">{description}</KatipanText>
    {published !== undefined && <StatusChip label={published ? "Published" : "Draft"} tone={published ? "success" : "neutral"} />}
  </View>;
}
export function WebsiteError({ message }: { message: string | null }) {
  return message ? <EditorialCard style={styles.error}><KatipanText color="error">{message}</KatipanText></EditorialCard> : null;
}
export function WebsiteNavigation({ navigate, hasSite }: { navigate: ReturnType<typeof useWebsiteScreen>["navigate"]; hasSite: boolean }) {
  return <EditorialCard style={styles.card}>
    <SectionHeader title="Build your website" description="Choose a presentation, decide what guests see, then review publication." />
    <KatipanButton label="Template Gallery" variant="secondary" disabled={!hasSite} onPress={() => navigate("templates")} />
    <KatipanButton label="Sections & Visibility" variant="secondary" disabled={!hasSite} onPress={() => navigate("sections")} />
    <KatipanButton label="Preview & Publish" variant="secondary" disabled={!hasSite} onPress={() => navigate("preview")} />
    <KatipanButton label="Guest Program" variant="text" onPress={() => navigate("program")} />
  </EditorialCard>;
}
export const websiteStyles = StyleSheet.create({
  page: { gap: s.large, paddingBottom: s.extraLarge },
  card: { gap: s.medium, backgroundColor: c.surfaceLowest },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: s.small },
  notice: { gap: s.small, backgroundColor: c.softBeige, borderColor: c.champagne },
});
const styles = StyleSheet.create({
  header: { gap: s.small }, card: { gap: s.medium, backgroundColor: c.surfaceLowest },
  error: { backgroundColor: c.softBeige, borderColor: c.error },
});
