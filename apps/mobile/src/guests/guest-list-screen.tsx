import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { colorTokens as c, spacingTokens as s } from "@katipan/ui";
import {
  EditorialCard,
  EmptyState,
  ErrorState,
  FormField,
  KatipanButton,
  KatipanScreen,
  KatipanText,
  LoadingState,
  SectionHeader,
  StatusChip,
} from "../ui";
import { buildGuestEntries, canManageGuestDomain, filterGuestEntries, guestListStatusFilters, guestRsvpLabel } from "./model";
import { GuestFilterChip, GuestRow } from "./components";
import { useGuestWorkspace } from "./use-guest-workspace";

export default function GuestListScreen() {
  const { weddingId, membership, isCurrent, loading, error, data, retry } = useGuestWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof guestListStatusFilters)[number]>("ALL");
  const [groupId, setGroupId] = useState<string | undefined>();
  const router = useRouter();
  const entries = data ? buildGuestEntries(data) : [];
  const filtered = data ? filterGuestEntries(entries, { search, status, groupId }) : [];
  const groupsByHousehold = (data?.households ?? []).map((household) => ({
    household,
    guests: filtered.filter((entry) => entry.household.id === household.id),
  })).filter((group) => group.guests.length > 0);

  if (loading || (membership && !isCurrent)) return <KatipanScreen><LoadingState label="Loading Guest List…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load the Guest List." onRetry={retry} /></KatipanScreen>;

  const canEdit = canManageGuestDomain(membership);
  const openGuest = (guestId: string) => router.navigate({
    pathname: "/(wedding)/[weddingId]/guests/[guestId]",
    params: { weddingId, guestId },
  });
  const addGuest = () => router.navigate({ pathname: "/(wedding)/[weddingId]/guests/add", params: { weddingId } });
  const addHousehold = () => router.navigate({ pathname: "/(wedding)/[weddingId]/guests/households/new", params: { weddingId } });

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">GUESTS & INVITATIONS</KatipanText>
        <KatipanText variant="headlineLarge" accessibilityRole="header">Guest List</KatipanText>
        <KatipanText color="textMuted">{entries.length} individual {entries.length === 1 ? "Guest" : "Guests"} across {data.households.length} {data.households.length === 1 ? "Household" : "Households"}</KatipanText>
      </View>

      <EditorialCard style={styles.summaryCard}>
        <View style={styles.summaryHeading}>
          <View style={styles.summaryCopy}>
            <KatipanText variant="headlineSmall">{filtered.length} {filtered.length === 1 ? "Guest" : "Guests"}</KatipanText>
            <KatipanText variant="bodySmall" color="textMuted">RSVP status belongs to each individual Guest.</KatipanText>
          </View>
          <StatusChip label={status === "ALL" ? "All responses" : guestRsvpLabel(status)} tone="neutral" />
        </View>
        {canEdit && <KatipanButton label="Add Guest" onPress={addGuest} />}
      </EditorialCard>

      <View style={styles.searchBlock}>
        <FormField
          label="Search Guests"
          value={search}
          onChangeText={setSearch}
          placeholder="Name, Household, email or group"
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <View style={styles.filterSection}>
        <KatipanText variant="labelCaps" color="secondary">RSVP STATUS</KatipanText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
          {guestListStatusFilters.map((value) => (
            <GuestFilterChip key={value} label={value === "ALL" ? "All" : guestRsvpLabel(value)} selected={status === value} onPress={() => setStatus(value)} />
          ))}
        </ScrollView>
      </View>

      {data.groups.length > 0 && (
        <View style={styles.filterSection}>
          <KatipanText variant="labelCaps" color="secondary">GUEST GROUP</KatipanText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
            <GuestFilterChip label="All groups" selected={!groupId} onPress={() => setGroupId(undefined)} />
            {data.groups.map((group) => (
              <GuestFilterChip key={group.id} label={group.name} selected={groupId === group.id} onPress={() => setGroupId(group.id)} />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.results}>
        <SectionHeader title="Households" description="Invitation context for individual Guests" />
        {entries.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState
              title="No Guests yet"
              description="Create a Household, then add named Guests. Unused child or plus one allowances do not create people."
              action={canEdit ? <KatipanButton label="Create Household" onPress={addHousehold} /> : undefined}
            />
          </EditorialCard>
        ) : groupsByHousehold.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState title="No Guests match these filters" description="Try a different search term, group or RSVP status." />
          </EditorialCard>
        ) : groupsByHousehold.map(({ household, guests }) => (
          <View key={household.id} style={styles.householdGroup}>
            <View style={styles.householdHeading}>
              <View style={styles.householdCopy}>
                <KatipanText variant="headlineSmall">{household.display_name}</KatipanText>
                <KatipanText variant="bodySmall" color="textMuted">{guests.length} matching {guests.length === 1 ? "Guest" : "Guests"}</KatipanText>
              </View>
              <StatusChip label={household.delivery_status === "SENT" ? "Invitation sent" : "Not sent"} tone={household.delivery_status === "SENT" ? "success" : "neutral"} />
            </View>
            {guests.map((entry) => <GuestRow key={entry.guest.id} entry={entry} onPress={() => openGuest(entry.guest.id)} />)}
          </View>
        ))}
      </View>
      <View style={styles.bottomSpace} />
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  titleBlock: { gap: s.small },
  summaryCard: { gap: s.medium, padding: s.medium, backgroundColor: c.surfaceLow },
  summaryHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  summaryCopy: { flex: 1, gap: s.micro },
  searchBlock: { gap: s.small },
  filterSection: { gap: s.small },
  filterList: { gap: s.small, paddingRight: s.medium },
  results: { gap: s.medium },
  emptyCard: { padding: 0 },
  householdGroup: { gap: s.small },
  householdHeading: { flexDirection: "row", alignItems: "center", gap: s.small, paddingHorizontal: s.small },
  householdCopy: { flex: 1, gap: s.micro },
  bottomSpace: { height: s.large },
});
