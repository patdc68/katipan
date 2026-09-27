import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import {
  EditorialCard, EmptyState, ErrorState, KatipanButton,
  KatipanScreen, KatipanText, LoadingState, StatusChip,
} from "../ui";
import { Brand, ChoiceChip } from "../onboarding/components";
import { useWorkspace } from "./context";
import { roleLabel, weddingStatusLabel, type WorkspaceMembership } from "./model";
import { formatWeddingDate, localCalendarDate, weddingDisplayName } from "./presentation";

type Filter = "ALL" | "UPCOMING" | "PAST";

function isUpcoming(membership: WorkspaceMembership, today: string): boolean {
  const date = membership.wedding.wedding_date;
  return Boolean(date && date >= today && membership.wedding.status !== "COMPLETED" && membership.wedding.status !== "ARCHIVED");
}

function isPast(membership: WorkspaceMembership, today: string): boolean {
  return membership.wedding.status === "COMPLETED"
    || membership.wedding.status === "ARCHIVED"
    || Boolean(membership.wedding.wedding_date && membership.wedding.wedding_date < today);
}

function WeddingCard({ membership, busy, onOpen }: {
  membership: WorkspaceMembership;
  busy: boolean;
  onOpen: () => void;
}) {
  const { wedding, partnerNames } = membership;
  const title = weddingDisplayName(partnerNames, wedding.display_name);
  const date = formatWeddingDate(wedding.wedding_date);
  const originLabel = wedding.origin === "COORDINATOR_CREATED" ? "Coordinator-created" : "Couple-created";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}, ${roleLabel(membership.role)}, ${weddingStatusLabel(wedding.status)}`}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onOpen}
      testID={`wedding-card-${wedding.id}`}
      style={({ pressed }) => [styles.weddingCardPressable, pressed && styles.pressed]}
    >
      <EditorialCard style={styles.weddingCard}>
        <View style={styles.cardTags}>
          <StatusChip label={originLabel} tone="neutral" />
          <StatusChip label={roleLabel(membership.role)} tone={membership.role === "OWNER" ? "success" : "neutral"} />
        </View>
        <KatipanText variant="headlineMedium" accessibilityRole="header">{title}</KatipanText>
        {wedding.display_name && partnerNames.length > 0 && wedding.display_name !== title && (
          <KatipanText color="textMuted">{wedding.display_name}</KatipanText>
        )}
        <KatipanText color="textMuted">
          {[date, wedding.general_location].filter(Boolean).join(" · ") || "Wedding date and location not added"}
        </KatipanText>
        <View style={styles.cardFooter}>
          <StatusChip label={weddingStatusLabel(wedding.status)} tone={wedding.status === "ACTIVE" ? "success" : "neutral"} />
          <View style={styles.openWedding}>
            {busy ? <LoadingState label="Opening…" /> : <KatipanText variant="labelLarge" color="primary">Open Wedding  →</KatipanText>}
          </View>
        </View>
      </EditorialCard>
    </Pressable>
  );
}

export function WeddingsSelector() {
  const router = useRouter();
  const workspace = useWorkspace();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const today = localCalendarDate();

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return workspace.memberships.filter((membership) => {
      const matchesFilter = filter === "ALL"
        || (filter === "UPCOMING" && isUpcoming(membership, today))
        || (filter === "PAST" && isPast(membership, today));
      if (!matchesFilter) return false;
      if (!search) return true;
      const terms = [
        membership.wedding.display_name,
        membership.wedding.general_location,
        membership.partnerNames.join(" "),
        roleLabel(membership.role),
        weddingStatusLabel(membership.wedding.status),
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return terms.includes(search);
    });
  }, [filter, query, today, workspace.memberships]);

  async function openWedding(weddingId: string) {
    if (openingId) return;
    setOpeningId(weddingId);
    setLocalError("");
    try {
      await workspace.activateWedding(weddingId);
      router.replace({ pathname: "/(wedding)/[weddingId]/home", params: { weddingId } });
    } catch {
      setLocalError("This Wedding workspace is no longer available. Refresh your memberships and try again.");
      setOpeningId(null);
    }
  }

  if (workspace.loading) return <KatipanScreen><LoadingState label="Loading your Weddings…" /></KatipanScreen>;
  if (workspace.error) return <KatipanScreen><ErrorState description={workspace.error} onRetry={() => void workspace.refreshMemberships()} /></KatipanScreen>;

  const upcomingCount = workspace.memberships.filter((membership) => isUpcoming(membership, today)).length;
  const dateNeededCount = workspace.memberships.filter((membership) => !membership.wedding.wedding_date).length;

  return (
    <KatipanScreen contentContainerStyle={styles.screen}>
      <View style={styles.topline}><Brand /><KatipanText variant="labelCaps" color="secondary">YOUR WORKSPACES</KatipanText></View>
      <View style={styles.intro}>
        <KatipanText variant="headlineMobile" accessibilityRole="header">My Weddings</KatipanText>
        <KatipanText color="textMuted">Choose a Wedding workspace to continue.</KatipanText>
      </View>

      {workspace.memberships.length === 0 ? (
        <EmptyState
          title="No active Wedding memberships"
          description="Create a Wedding or reopen an invitation you have received."
          action={<KatipanButton label="Create a Wedding" onPress={() => router.replace("/(access)/create-wedding")} />}
        />
      ) : <>
        <View style={styles.metrics}>
          <Metric value={String(workspace.memberships.length)} label="CONNECTED WEDDINGS" />
          <Metric value={String(upcomingCount)} label="UPCOMING DATES" />
          <Metric value={String(dateNeededCount)} label="DATES TO ADD" />
        </View>

        <View style={styles.searchBox}>
          <KatipanText variant="title" color="textMuted">⌕</KatipanText>
          <TextInput
            accessibilityLabel="Search weddings by couple, wedding name, or location"
            placeholder="Search by couple or location…"
            placeholderTextColor={c.outline}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filters}>
          <ChoiceChip label="All" selected={filter === "ALL"} onPress={() => setFilter("ALL")} />
          <ChoiceChip label="Upcoming" selected={filter === "UPCOMING"} onPress={() => setFilter("UPCOMING")} />
          <ChoiceChip label="Past" selected={filter === "PAST"} onPress={() => setFilter("PAST")} />
        </View>

        <View style={styles.sectionHeading}>
          <KatipanText variant="headlineMedium" accessibilityRole="header">Your Wedding spaces</KatipanText>
          <KatipanText variant="labelCaps" color="textMuted">{filtered.length} SHOWN</KatipanText>
        </View>
        {localError ? <KatipanText color="error" accessibilityRole="alert">{localError}</KatipanText> : null}
        {filtered.length === 0 ? (
          <EmptyState title="No Weddings match this view" description="Try another date filter or search term." />
        ) : filtered.map((membership) => (
          <WeddingCard
            key={membership.membershipId}
            membership={membership}
            busy={openingId === membership.weddingId}
            onOpen={() => void openWedding(membership.weddingId)}
          />
        ))}
      </>}
    </KatipanScreen>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}>
    <KatipanText variant="headlineMobile" color="primary">{value}</KatipanText>
    <KatipanText variant="labelCaps" color="textMuted" style={styles.metricLabel}>{label}</KatipanText>
  </View>;
}

const styles = StyleSheet.create({
  screen: { gap: s.large, paddingBottom: s.extraLarge },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  intro: { gap: s.small, paddingTop: s.small },
  metrics: { flexDirection: "row", gap: s.small },
  metric: { flex: 1, minHeight: 88, alignItems: "center", justifyContent: "center", gap: s.small, backgroundColor: c.surfaceLow, borderRadius: r.large, padding: s.small },
  metricLabel: { textAlign: "center", fontSize: 9 },
  searchBox: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: s.small, backgroundColor: c.surfaceLowest, borderRadius: r.large, borderWidth: 1, borderColor: c.stoneBorder, paddingHorizontal: s.medium },
  searchInput: { flex: 1, minWidth: 0, color: c.text, fontFamily: "PlusJakartaSans_400Regular", fontSize: 14, paddingVertical: 12 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  sectionHeading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: s.small, marginTop: s.small },
  weddingCardPressable: { borderRadius: r.extraLarge },
  weddingCard: { gap: s.medium, padding: s.cardLarge, backgroundColor: c.surfaceLow },
  cardTags: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  openWedding: { minHeight: 42, justifyContent: "center" },
  pressed: { opacity: 0.85 },
});
