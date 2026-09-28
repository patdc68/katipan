import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { Brand } from "../onboarding/components";
import { useWorkspace } from "../workspace/context";
import { isCurrentWeddingWorkspace } from "../workspace/model";
import { weddingDisplayName } from "../workspace/presentation";
import {
  archivePlace,
  createCustomPlace,
  loadPlaceDetails,
  loadPlaces,
  removePlacePurpose,
  saveGooglePlace,
  savePlacePurpose,
  searchGooglePlaces,
  updatePlaceContext,
} from "./api";
import {
  canManagePlaces,
  contextDraftFromPlace,
  emptyCustomPlaceDraft,
  normalizedPlaceQuery,
  placeAddress,
  placePurposes,
  placeSearchDebounceMs,
  placeTitle,
  placeTypeLabels,
  placeTypes,
  placesRequestKey,
  purposeDraftFromRow,
  purposeLabels,
  purposeVisibilitySummary,
  schedulePlaceSearch,
  safePlaceError,
  PlaceSubmitGate,
  type GooglePlaceDetails,
  type PlaceContextDraft,
  type PlacePurpose,
  type PlacePurposeDraft,
  type WeddingPlaceDetails,
} from "./model";
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

type RouteIdentity = {
  weddingId: string;
  membership: ReturnType<ReturnType<typeof useWorkspace>["membershipFor"]>;
  isCurrent: boolean;
  cacheRevision: number;
  workspaceLoading: boolean;
};

function usePlaceRouteIdentity(): RouteIdentity {
  const params = useLocalSearchParams<{ weddingId?: string | string[] }>();
  const weddingId = Array.isArray(params.weddingId) ? params.weddingId[0] ?? "" : params.weddingId ?? "";
  const workspace = useWorkspace();
  const membership = weddingId ? workspace.membershipFor(weddingId) : null;
  return {
    weddingId,
    membership,
    isCurrent: isCurrentWeddingWorkspace(membership, workspace.selectedWeddingId, weddingId),
    cacheRevision: workspace.cacheRevision,
    workspaceLoading: workspace.loading,
  };
}

function usePlacesListResource(identity: RouteIdentity) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data: WeddingPlaceDetails[] | null;
    failed: boolean;
  } | null>(null);
  const key = placesRequestKey(identity.weddingId, identity.membership?.membershipId, identity.cacheRevision, attempt);
  useEffect(() => {
    let current = true;
    if (!identity.isCurrent || !identity.membership) return () => { current = false; };
    void loadPlaces(identity.membership)
      .then((data) => { if (current) setResult({ key, data, failed: false }); })
      .catch(() => { if (current) setResult({ key, data: null, failed: true }); });
    return () => { current = false; };
  }, [identity.isCurrent, identity.membership, key]);
  const hasFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (hasFocused.current) setAttempt((count) => count + 1);
    else hasFocused.current = true;
  }, []));
  const currentResult = result?.key === key ? result : null;
  return {
    data: currentResult?.data ?? null,
    error: currentResult?.failed ?? false,
    loading: identity.workspaceLoading || Boolean(identity.membership && !identity.isCurrent) || Boolean(identity.membership && !currentResult),
    retry: () => setAttempt((count) => count + 1),
  };
}

function usePlaceDetailResource(identity: RouteIdentity, placeId: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data: WeddingPlaceDetails | null;
    failed: boolean;
  } | null>(null);
  const key = `${placesRequestKey(identity.weddingId, identity.membership?.membershipId, identity.cacheRevision, attempt)}:${placeId}`;
  useEffect(() => {
    let current = true;
    if (!identity.isCurrent || !identity.membership || !placeId) return () => { current = false; };
    void loadPlaceDetails(identity.membership, placeId)
      .then((data) => { if (current) setResult({ key, data, failed: false }); })
      .catch(() => { if (current) setResult({ key, data: null, failed: true }); });
    return () => { current = false; };
  }, [identity.isCurrent, identity.membership, key, placeId]);
  const hasFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (hasFocused.current) setAttempt((count) => count + 1);
    else hasFocused.current = true;
  }, []));
  const currentResult = result?.key === key ? result : null;
  return {
    data: currentResult?.data ?? null,
    error: currentResult?.failed ?? false,
    loading: identity.workspaceLoading || Boolean(identity.membership && !identity.isCurrent) || Boolean(identity.membership && !currentResult),
    retry: () => setAttempt((count) => count + 1),
  };
}

function screenTitle(membership: NonNullable<RouteIdentity["membership"]>): string {
  return weddingDisplayName(membership.partnerNames, membership.wedding.display_name);
}

function navigateToPlace(router: ReturnType<typeof useRouter>, weddingId: string, placeId: string) {
  router.push({
    pathname: "/(wedding)/[weddingId]/places/[placeId]",
    params: { weddingId, placeId },
  } as unknown as Href);
}

function PlaceVisual({ source }: { source: "GOOGLE_PLACES" | "CUSTOM" }) {
  return (
    <View style={styles.placeVisual} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <KatipanText variant="headlineMedium" color="primary">{source === "GOOGLE_PLACES" ? "⌖" : "✦"}</KatipanText>
    </View>
  );
}

function PlaceCard({
  item,
  onPress,
}: {
  item: WeddingPlaceDetails;
  onPress: () => void;
}) {
  const title = placeTitle(item.place, item.google);
  const address = placeAddress(item.place, item.google);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={onPress} style={({ pressed }) => [styles.placeCardPressable, pressed && styles.pressed]}>
      <EditorialCard style={styles.placeCard}>
        <PlaceVisual source={item.place.source} />
        <View style={styles.placeCardCopy}>
          <View style={styles.placeTitleRow}>
            <KatipanText variant="headlineSmall" style={styles.flex}>{title}</KatipanText>
            <KatipanText variant="bodySmall" color="textMuted">›</KatipanText>
          </View>
          {!!item.place.user_label && item.place.source === "GOOGLE_PLACES" && (
            <KatipanText variant="bodySmall" color="secondary">Wedding label · {item.place.user_label}</KatipanText>
          )}
          {!!address && <KatipanText color="textMuted" numberOfLines={3}>{address}</KatipanText>}
          {item.googleUnavailable && item.place.source === "GOOGLE_PLACES" && (
            <KatipanText variant="bodySmall" color="textMuted">Current Google details are unavailable.</KatipanText>
          )}
          <View style={styles.chipRow}>
            <StatusChip label={placeTypeLabels[item.place.place_type]} />
            <StatusChip label={item.place.source === "CUSTOM" ? "Katipan Place" : "Google Place"} tone="success" />
          </View>
          {item.purposes.length > 0 && <View style={styles.chipRow}>
            {item.purposes.map((purpose) => <StatusChip key={purpose.id} label={purpose.purpose_label || purposeLabels[purpose.purpose]} tone="warning" />)}
          </View>}
          <KatipanText variant="bodySmall" color="textMuted">{purposeVisibilitySummary(item.purposes)}</KatipanText>
        </View>
      </EditorialCard>
    </Pressable>
  );
}

export function PlacesListScreen() {
  const identity = usePlaceRouteIdentity();
  const router = useRouter();
  const { data, error, loading, retry } = usePlacesListResource(identity);
  if (loading) return <KatipanScreen><LoadingState label="Loading Wedding Places…" /></KatipanScreen>;
  if (!identity.membership || !identity.isCurrent) {
    return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  }
  if (error || !data) return <KatipanScreen><ErrorState description="We couldn't load Places for this Wedding." onRetry={retry} /></KatipanScreen>;
  const canEdit = canManagePlaces(identity.membership);
  const openCollection = (route: "search" | "new") => router.push({
    pathname: `/(wedding)/[weddingId]/places/${route}`,
    params: { weddingId: identity.weddingId },
  } as unknown as Href);

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.brandRow}>
        <View style={styles.brandCopy}><Brand compact /><KatipanText variant="labelCaps" color="secondary">WEDDING PLANNING</KatipanText></View>
        <StatusChip label={identity.membership.role.replaceAll("_", " ")} tone="success" />
      </View>
      <SectionHeader
        title="Our Places"
        eyebrow={screenTitle(identity.membership)}
        description="Keep the places for your wedding together, with notes for your team and the details guests need."
      />
      {canEdit && <View style={styles.actionRow}>
        <KatipanButton style={styles.flexButton} label="Search Google Places" variant="secondary" onPress={() => openCollection("search")} />
        <KatipanButton style={styles.flexButton} label="Add Custom Place" onPress={() => openCollection("new")} />
      </View>}
      {!canEdit && <KatipanText color="textMuted">Your Wedding role can view Places. An Owner or Full Coordinator manages changes.</KatipanText>}
      <EditorialCard style={styles.contextCard}>
        <KatipanText variant="labelCaps" color="secondary">PLACE TYPE & PURPOSE</KatipanText>
        <KatipanText color="textMuted">Type describes the venue. Purpose describes how you use it. A Place can have several purposes.</KatipanText>
      </EditorialCard>
      {data.length === 0 ? (
        <EditorialCard style={styles.emptyCard}>
          <EmptyState
            title="No Places saved yet"
            description="Add a Google Place or enter a custom Place for this Wedding."
            action={canEdit ? <View style={styles.actionColumn}>
              <KatipanButton label="Search Google Places" variant="secondary" onPress={() => openCollection("search")} />
              <KatipanButton label="Add Custom Place" onPress={() => openCollection("new")} />
            </View> : undefined}
          />
        </EditorialCard>
      ) : (
        <View style={styles.placeList}>
          {data.map((item) => <PlaceCard
            key={item.place.id}
            item={item}
            onPress={() => navigateToPlace(router, identity.weddingId, item.place.id)}
          />)}
        </View>
      )}
      <KatipanButton label="Back to Plan" variant="text" onPress={() => router.back()} />
    </KatipanScreen>
  );
}

type SearchState =
  | { kind: "idle" | "too-short" }
  | { kind: "loading" }
  | { kind: "ready"; places: GooglePlaceDetails[] }
  | { kind: "error" };

export function PlaceSearchScreen() {
  const identity = usePlaceRouteIdentity();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [searchState, setSearchState] = useState<SearchState>({ kind: "idle" });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const gate = useRef(new PlaceSubmitGate());
  const canEdit = Boolean(identity.membership && canManagePlaces(identity.membership));
  useEffect(() => {
    let active = true;
    const normalized = normalizedPlaceQuery(query);
    if (!normalized) return () => { active = false; };
    const cancel = schedulePlaceSearch(query, (term) => {
      if (!identity.membership || !identity.isCurrent) return;
      void searchGooglePlaces(identity.membership, term)
        .then((places) => { if (active) setSearchState({ kind: "ready", places }); })
        .catch(() => { if (active) setSearchState({ kind: "error" }); });
    });
    return () => { active = false; cancel(); };
  }, [query, searchAttempt, identity.membership, identity.isCurrent, identity.weddingId, identity.cacheRevision]);

  if (!identity.membership || !identity.isCurrent) {
    return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  }
  if (!canEdit) return <KatipanScreen><ErrorState title="Place search is read-only" description="An Owner or Full Coordinator can search and save Places." onRetry={() => router.back()} /></KatipanScreen>;

  const save = async (google: GooglePlaceDetails) => {
    await gate.current.run(async () => {
      setSavingId(google.placeId);
      setActionError(null);
      try {
        const result = await saveGooglePlace(identity.membership!, google.placeId);
        navigateToPlace(router, identity.weddingId, result.placeId);
      } catch (cause) {
        setActionError(safePlaceError(cause));
      } finally {
        setSavingId(null);
      }
    });
  };
  const changeQuery = (value: string) => {
    setQuery(value);
    setActionError(null);
    setSearchState(normalizedPlaceQuery(value)
      ? { kind: "loading" }
      : value.trim().length > 0 ? { kind: "too-short" } : { kind: "idle" });
  };
  const retrySearch = () => {
    setSearchState({ kind: "loading" });
    setSearchAttempt((attempt) => attempt + 1);
  };

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <Brand compact />
      <SectionHeader title="Find a Place" eyebrow="Google Places" description="Search through Katipan's secure Places connection. Google details stay separate from your Wedding notes." />
      <FormField
        label="Search places"
        value={query}
        onChangeText={changeQuery}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
        placeholder="Try a venue or address"
        accessibilityHint={`Search starts after ${placeSearchDebounceMs} milliseconds. Enter at least two characters.`}
      />
      <KatipanText variant="bodySmall" color="textMuted">Enter at least two characters. Results come from Google Places.</KatipanText>
      {!!actionError && <ErrorState title="Place could not be saved" description={actionError} />}
      {searchState.kind === "idle" && <EmptyState title="Start with a place name" description="Recent venues, churches, hotels, or addresses work well." />}
      {searchState.kind === "too-short" && <EmptyState title="Add one more character" description="Search needs at least two characters." />}
      {searchState.kind === "loading" && <LoadingState label="Searching Places…" />}
      {searchState.kind === "error" && <ErrorState title="Search unavailable" description="We could not search Google Places. Check your connection and try again." onRetry={retrySearch} />}
      {searchState.kind === "ready" && searchState.places.length === 0 && <EmptyState title="No matching Places" description="Try a nearby city, venue name, or a shorter search." />}
      {searchState.kind === "ready" && searchState.places.map((place) => (
        <EditorialCard key={place.placeId} style={styles.resultCard}>
          <PlaceVisual source="GOOGLE_PLACES" />
          <View style={styles.resultCopy}>
            <KatipanText variant="headlineSmall">{place.displayName ?? "Google Place"}</KatipanText>
            {!!place.formattedAddress && <KatipanText color="textMuted">{place.formattedAddress}</KatipanText>}
            {!!place.primaryType && <KatipanText variant="bodySmall" color="secondary">{place.primaryType.replaceAll("_", " ")}</KatipanText>}
          </View>
          <KatipanButton
            label={savingId === place.placeId ? "Saving…" : "Save Place"}
            loading={savingId === place.placeId}
            disabled={savingId !== null}
            onPress={() => void save(place)}
          />
        </EditorialCard>
      ))}
      <KatipanButton label="Back to Our Places" variant="text" onPress={() => router.back()} />
    </KatipanScreen>
  );
}

function PlaceTypeChoices({
  value,
  onChange,
  disabled = false,
}: {
  value: PlaceContextDraft["placeType"];
  onChange: (value: PlaceContextDraft["placeType"]) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <KatipanText variant="labelLarge">Place type</KatipanText>
      <View style={styles.choiceWrap}>
        {placeTypes.map((placeType) => {
          const selected = value === placeType;
          return (
            <Pressable
              key={placeType}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              accessibilityLabel={placeTypeLabels[placeType]}
              disabled={disabled}
              onPress={() => onChange(placeType)}
              style={[styles.choiceChip, selected && styles.choiceChipSelected, disabled && styles.disabled]}
            >
              <KatipanText variant="label" style={selected && styles.selectedLabel}>{placeTypeLabels[placeType]}</KatipanText>
            </Pressable>
          );
        })}
      </View>
      <KatipanText variant="bodySmall" color="textMuted">Place type is separate from the way you use this Place.</KatipanText>
    </View>
  );
}

export function AddCustomPlaceScreen() {
  const identity = usePlaceRouteIdentity();
  const router = useRouter();
  const [draft, setDraft] = useState<PlaceContextDraft>(emptyCustomPlaceDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gate = useRef(new PlaceSubmitGate());
  const canEdit = Boolean(identity.membership && canManagePlaces(identity.membership));

  if (!identity.membership || !identity.isCurrent) {
    return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  }
  if (!canEdit) return <KatipanScreen><ErrorState title="Place changes are read-only" description="An Owner or Full Coordinator can add a Custom Place." onRetry={() => router.back()} /></KatipanScreen>;

  const setField = <K extends keyof PlaceContextDraft>(key: K, value: PlaceContextDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    await gate.current.run(async () => {
      setSaving(true);
      setError(null);
      try {
        const placeId = await createCustomPlace(identity.membership!, draft);
        navigateToPlace(router, identity.weddingId, placeId);
      } catch (cause) {
        setError(safePlaceError(cause, "Check the required name and coordinates, then try again."));
      } finally {
        setSaving(false);
      }
    });
  };

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <Brand compact />
      <SectionHeader title="Add Custom Place" eyebrow={screenTitle(identity.membership)} description="For private homes, family properties, or a place you can't find in Google Places." />
      <EditorialCard style={styles.formCard}>
        <KatipanText variant="labelCaps" color="secondary">CUSTOM PLACE DETAILS</KatipanText>
        <FormField label="Place name" value={draft.customName} onChangeText={(value) => setField("customName", value)} placeholder="e.g. Maria's family home" maxLength={200} />
        <FormField label="Address" value={draft.customAddress} onChangeText={(value) => setField("customAddress", value)} placeholder="Street, city, or directions" maxLength={500} multiline />
        <View style={styles.coordinateRow}>
          <FormField style={styles.flex} label="Latitude (optional)" value={draft.latitude} onChangeText={(value) => setField("latitude", value)} placeholder="14.5995" keyboardType="decimal-pad" />
          <FormField style={styles.flex} label="Longitude (optional)" value={draft.longitude} onChangeText={(value) => setField("longitude", value)} placeholder="120.9842" keyboardType="decimal-pad" />
        </View>
        <KatipanText variant="bodySmall" color="textMuted">Enter both coordinates or leave both blank. Latitude is -90 to 90 and longitude is -180 to 180.</KatipanText>
        <PlaceTypeChoices value={draft.placeType} onChange={(value) => setField("placeType", value)} />
        <FormField label="Your Wedding label (optional)" value={draft.userLabel} onChangeText={(value) => setField("userLabel", value)} placeholder="A name your group will recognize" maxLength={120} />
        <FormField label="Private notes" value={draft.privateNotes} onChangeText={(value) => setField("privateNotes", value)} placeholder="For your planning team" maxLength={4000} multiline />
        <FormField label="Guest notes" value={draft.guestNotes} onChangeText={(value) => setField("guestNotes", value)} placeholder="Directions or details guests may need" maxLength={2000} multiline />
        {!!error && <ErrorState title="Custom Place could not be saved" description={error} />}
        <KatipanButton label="Save Custom Place" loading={saving} onPress={() => void submit()} />
      </EditorialCard>
      <KatipanButton label="Cancel" variant="text" onPress={() => router.back()} />
    </KatipanScreen>
  );
}

function createPurposeDraft(sortOrder: number): PlacePurposeDraft {
  return { sortOrder, guestVisible: false, purposeLabel: "", privateNotes: "", guestNotes: "" };
}

function PurposeCard({
  purpose,
  draft,
  onChange,
  onSave,
  onRemove,
  saving,
  canEdit,
}: {
  purpose: PlacePurpose;
  draft: PlacePurposeDraft;
  onChange: (field: keyof PlacePurposeDraft, value: string | number | boolean) => void;
  onSave: () => void;
  onRemove: () => void;
  saving: boolean;
  canEdit: boolean;
}) {
  return (
    <EditorialCard style={styles.purposeCard}>
      <View style={styles.purposeHeading}>
        <View style={styles.flex}>
          <KatipanText variant="headlineSmall">{purposeLabels[purpose]}</KatipanText>
          <KatipanText variant="bodySmall" color="textMuted">Guest visibility is set for this purpose only.</KatipanText>
        </View>
        {canEdit && <KatipanButton label="Remove" variant="text" disabled={saving} onPress={onRemove} />}
      </View>
      {!!draft.purposeLabel && <KatipanText color="secondary">{draft.purposeLabel}</KatipanText>}
      {canEdit ? (
        <>
          <FormField label="Display order" value={String(draft.sortOrder)} onChangeText={(value) => onChange("sortOrder", value.trim() === "" ? 0 : Number(value))} keyboardType="number-pad" />
          <FormField label="Purpose label (optional)" value={draft.purposeLabel} onChangeText={(value) => onChange("purposeLabel", value)} placeholder="e.g. Garden ceremony" maxLength={120} />
          <FormField label="Private notes" value={draft.privateNotes} onChangeText={(value) => onChange("privateNotes", value)} placeholder="For your planning team" maxLength={2000} multiline />
          <FormField label="Guest notes" value={draft.guestNotes} onChangeText={(value) => onChange("guestNotes", value)} placeholder="Directions or guest guidance" maxLength={2000} multiline />
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <KatipanText variant="labelLarge">Allow this purpose in the Guest Guide</KatipanText>
              <KatipanText variant="bodySmall" color="textMuted">This allows inclusion when the Places section is published. Other purposes keep their own setting.</KatipanText>
            </View>
            <Switch
              accessibilityLabel={`Show ${purposeLabels[purpose]} in the Guest Guide`}
              value={draft.guestVisible}
              onValueChange={(value) => onChange("guestVisible", value)}
              trackColor={{ false: c.outlineSubtle, true: c.primaryFixedDim }}
              thumbColor={draft.guestVisible ? c.primary : c.cardIvory}
            />
          </View>
          <KatipanButton label="Save purpose" variant="secondary" loading={saving} onPress={onSave} />
        </>
      ) : (
        <>
          <StatusChip label={draft.guestVisible ? "Guest Guide eligible" : "Hidden from Guest Guide"} tone={draft.guestVisible ? "success" : "neutral"} />
          {!!draft.guestNotes && <View><KatipanText variant="labelLarge">Guest notes</KatipanText><KatipanText>{draft.guestNotes}</KatipanText></View>}
          {!!draft.privateNotes && <View><KatipanText variant="labelLarge">Private notes</KatipanText><KatipanText>{draft.privateNotes}</KatipanText></View>}
        </>
      )}
    </EditorialCard>
  );
}

function confirmArchive(action: () => void) {
  const title = "Archive this Place?";
  const message = "It will leave the active Places list and Guest Guide. Existing wedding records will remain.";
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) action();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Archive Place", style: "destructive", onPress: action },
  ]);
}

export function PlaceDetailsScreen() {
  const params = useLocalSearchParams<{ placeId?: string | string[] }>();
  const placeId = Array.isArray(params.placeId) ? params.placeId[0] ?? "" : params.placeId ?? "";
  const identity = usePlaceRouteIdentity();
  const router = useRouter();
  const { data, error, loading, retry } = usePlaceDetailResource(identity, placeId);
  const [draftSnapshot, setDraftSnapshot] = useState<{ key: string; value: PlaceContextDraft } | null>(null);
  const [purposeSnapshot, setPurposeSnapshot] = useState<{
    key: string;
    value: Partial<Record<PlacePurpose, PlacePurposeDraft>>;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const gate = useRef(new PlaceSubmitGate());
  const canEdit = Boolean(identity.membership && canManagePlaces(identity.membership));
  const dataKey = data
    ? [identity.weddingId, identity.cacheRevision, data.place.id, data.place.updated_at,
      data.purposes.map((item) => `${item.id}:${item.updated_at}`).join(",")].join(":")
    : "";
  const draft = data
    ? draftSnapshot?.key === dataKey ? draftSnapshot.value : contextDraftFromPlace(data.place)
    : null;
  const purposeDrafts: Partial<Record<PlacePurpose, PlacePurposeDraft>> = data
    ? purposeSnapshot?.key === dataKey
      ? purposeSnapshot.value
      : Object.fromEntries(data.purposes.map((row) => [row.purpose, purposeDraftFromRow(row)]))
    : {};

  if (loading) return <KatipanScreen><LoadingState label="Loading Place details…" /></KatipanScreen>;
  if (!identity.membership || !identity.isCurrent) {
    return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  }
  if (error || !data || !draft) return <KatipanScreen><ErrorState title="Place unavailable" description="This Place may have been archived or belongs to a different Wedding." onRetry={retry} /> <KatipanButton label="Back to Our Places" variant="text" onPress={() => router.back()} /></KatipanScreen>;

  const place = data.place;
  const title = placeTitle(place, data.google);
  const address = placeAddress(place, data.google);
  const setContextField = <K extends keyof PlaceContextDraft>(key: K, value: PlaceContextDraft[K]) => {
    setDraftSnapshot((current) => ({
      key: dataKey,
      value: { ...(current?.key === dataKey ? current.value : contextDraftFromPlace(place)), [key]: value },
    }));
  };
  const updatePurposeDraft = (purpose: PlacePurpose, field: keyof PlacePurposeDraft, value: string | number | boolean) => {
    setPurposeSnapshot((current) => {
      const currentValues = current?.key === dataKey
        ? current.value
        : Object.fromEntries(data.purposes.map((row) => [row.purpose, purposeDraftFromRow(row)]));
      return {
        key: dataKey,
        value: {
          ...currentValues,
          [purpose]: { ...(currentValues[purpose] ?? createPurposeDraft(data.purposes.length)), [field]: value } as PlacePurposeDraft,
        },
      };
    });
  };
  const runMutation = async (key: string, action: () => Promise<void>) => {
    await gate.current.run(async () => {
      setBusy(key);
      setActionError(null);
      try {
        await action();
        retry();
      } catch (cause) {
        setActionError(safePlaceError(cause));
      } finally {
        setBusy(null);
      }
    });
  };
  const addPurpose = (purpose: PlacePurpose) => runMutation(`purpose:${purpose}`, async () => {
    await savePlacePurpose(identity.membership!, place.id, purpose, createPurposeDraft(data.purposes.length));
  });
  const savePurpose = (purpose: PlacePurpose) => runMutation(`purpose:${purpose}`, async () => {
    const value = purposeDrafts[purpose] ?? createPurposeDraft(data.purposes.length);
    await savePlacePurpose(identity.membership!, place.id, purpose, value);
  });
  const removePurpose = (purpose: PlacePurpose) => runMutation(`purpose:${purpose}`, async () => {
    await removePlacePurpose(identity.membership!, place.id, purpose);
  });
  const saveContext = () => runMutation("context", async () => {
    await updatePlaceContext(identity.membership!, place.id, draft);
  });
  const doArchive = () => {
    void runMutation("archive", async () => {
      await archivePlace(identity.membership!, place.id);
      router.replace({ pathname: "/(wedding)/[weddingId]/places", params: { weddingId: identity.weddingId } } as unknown as Href);
    });
  };
  const openMaps = async (url: string | null) => {
    if (!url) return;
    try { await Linking.openURL(url); } catch { setActionError("Google Maps couldn't be opened on this device."); }
  };

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <Brand compact />
      <View style={styles.heroCard}>
        <PlaceVisual source={place.source} />
        <View style={styles.heroCopy}>
          <StatusChip label={place.source === "CUSTOM" ? "Custom Place" : "Google Place"} tone="success" />
          <KatipanText variant="headlineLarge" accessibilityRole="header">{title}</KatipanText>
          {!!address && <KatipanText color="textMuted">{address}</KatipanText>}
          {place.source === "GOOGLE_PLACES" && data.googleUnavailable && (
            <KatipanText variant="bodySmall" color="textMuted">Current Google details could not be loaded. Your Wedding Place ID is still saved and can be refreshed later.</KatipanText>
          )}
          {place.source === "GOOGLE_PLACES" && data.google?.googleMapsUri && (
            <KatipanButton label="Open in Google Maps" variant="secondary" onPress={() => void openMaps(data.google?.googleMapsUri ?? null)} />
          )}
        </View>
      </View>
      {place.source === "CUSTOM" && place.custom_latitude !== null && place.custom_longitude !== null && (
        <EditorialCard style={styles.compactCard}>
          <KatipanText variant="labelCaps" color="secondary">COORDINATES</KatipanText>
          <KatipanText>{place.custom_latitude}, {place.custom_longitude}</KatipanText>
        </EditorialCard>
      )}
      <View style={styles.section}>
        <SectionHeader title="Wedding context" eyebrow="KATIPAN DETAILS" description="Your Place type, labels, and notes are stored separately from Google place data." />
        <EditorialCard style={styles.formCard}>
          {place.source === "CUSTOM" && <>
            <FormField label="Place name" value={draft.customName} editable={canEdit} onChangeText={(value) => setContextField("customName", value)} />
            <FormField label="Address" value={draft.customAddress} editable={canEdit} onChangeText={(value) => setContextField("customAddress", value)} multiline />
            <View style={styles.coordinateRow}>
              <FormField style={styles.flex} label="Latitude" value={draft.latitude} editable={canEdit} onChangeText={(value) => setContextField("latitude", value)} keyboardType="decimal-pad" />
              <FormField style={styles.flex} label="Longitude" value={draft.longitude} editable={canEdit} onChangeText={(value) => setContextField("longitude", value)} keyboardType="decimal-pad" />
            </View>
          </>}
          <PlaceTypeChoices value={draft.placeType} onChange={(value) => setContextField("placeType", value)} disabled={!canEdit} />
          <FormField label="Your Wedding label" value={draft.userLabel} editable={canEdit} onChangeText={(value) => setContextField("userLabel", value)} placeholder="Optional name for your group" />
          <FormField label="Place private notes" value={draft.privateNotes} editable={canEdit} onChangeText={(value) => setContextField("privateNotes", value)} placeholder="For your planning team" multiline />
          <FormField label="Place guest notes" value={draft.guestNotes} editable={canEdit} onChangeText={(value) => setContextField("guestNotes", value)} placeholder="For guests when a visible purpose is included" multiline />
          {canEdit && <KatipanButton label="Save Wedding context" variant="secondary" loading={busy === "context"} disabled={busy !== null && busy !== "context"} onPress={() => void saveContext()} />}
          {!canEdit && <KatipanText variant="bodySmall" color="textMuted">Your Wedding role has read-only Place access.</KatipanText>}
        </EditorialCard>
      </View>
      <View style={styles.section}>
        <SectionHeader title="Purposes" eyebrow="HOW THIS PLACE IS USED" description="Add more than one purpose. Guest visibility and notes are configured for each purpose." />
        {data.purposes.length === 0 && <EditorialCard style={styles.compactCard}><EmptyState title="No purpose assigned" description="Add one or more ways this Wedding will use the Place." /></EditorialCard>}
        {data.purposes.map((purpose) => (
          <PurposeCard
            key={purpose.id}
            purpose={purpose.purpose}
            draft={purposeDrafts[purpose.purpose] ?? purposeDraftFromRow(purpose)}
            canEdit={canEdit}
            saving={busy === `purpose:${purpose.purpose}`}
            onChange={(field, value) => updatePurposeDraft(purpose.purpose, field, value)}
            onSave={() => void savePurpose(purpose.purpose)}
            onRemove={() => void removePurpose(purpose.purpose)}
          />
        ))}
        {canEdit && <EditorialCard style={styles.formCard}>
          <KatipanText variant="labelLarge">Add another purpose</KatipanText>
          <View style={styles.choiceWrap}>
            {placePurposes.filter((purpose) => !data.purposes.some((current) => current.purpose === purpose)).map((purpose) => (
              <Pressable
                key={purpose}
                accessibilityRole="button"
                accessibilityLabel={`Add ${purposeLabels[purpose]} purpose`}
                disabled={busy !== null}
                onPress={() => void addPurpose(purpose)}
                style={[styles.choiceChip, styles.addPurposeChip, busy !== null && styles.disabled]}
              >
                <KatipanText variant="label">+ {purposeLabels[purpose]}</KatipanText>
              </Pressable>
            ))}
            {data.purposes.length === placePurposes.length && <KatipanText color="textMuted">All Place purposes are assigned.</KatipanText>}
          </View>
        </EditorialCard>}
      </View>
      {!!actionError && <ErrorState title="Place change couldn't be saved" description={actionError} />}
      {canEdit && <EditorialCard style={styles.archiveCard}>
        <KatipanText variant="labelCaps" color="error">ARCHIVE PLACE</KatipanText>
        <KatipanText color="textMuted">Archive this Place when the Wedding no longer uses it. The record stays attached to existing wedding history.</KatipanText>
        <KatipanButton label="Archive Place" variant="secondary" loading={busy === "archive"} disabled={busy !== null} onPress={() => confirmArchive(doArchive)} />
      </EditorialCard>}
      <KatipanButton label="Back to Our Places" variant="text" onPress={() => router.back()} />
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.large, paddingBottom: s.extraLarge },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  brandCopy: { flex: 1, gap: s.small },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  actionColumn: { width: "100%", gap: s.small },
  flexButton: { flexGrow: 1, flexBasis: 150 },
  contextCard: { gap: s.small, backgroundColor: c.surfaceLow },
  emptyCard: { paddingVertical: s.large },
  placeList: { gap: s.medium },
  placeCardPressable: { borderRadius: r.extraLarge },
  pressed: { opacity: 0.8 },
  placeCard: { flexDirection: "row", gap: s.medium, padding: s.medium, alignItems: "flex-start" },
  placeVisual: {
    width: 64, height: 64, borderRadius: r.large, backgroundColor: c.softBeige,
    borderWidth: 1, borderColor: c.stoneBorder, alignItems: "center", justifyContent: "center",
  },
  placeCardCopy: { flex: 1, gap: s.small, minWidth: 0 },
  placeTitleRow: { flexDirection: "row", alignItems: "center", gap: s.small },
  flex: { flex: 1, minWidth: 0 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  resultCard: { gap: s.medium },
  resultCopy: { gap: s.small },
  fieldGroup: { gap: s.small },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  choiceChip: {
    minHeight: 38, borderRadius: r.pill, paddingHorizontal: s.medium, paddingVertical: s.small,
    borderWidth: 1, borderColor: c.stoneBorder, backgroundColor: c.surface,
    alignItems: "center", justifyContent: "center",
  },
  choiceChipSelected: { backgroundColor: c.primaryContainer, borderColor: c.champagne },
  selectedLabel: { color: c.onPrimary },
  addPurposeChip: { backgroundColor: c.softBeige },
  disabled: { opacity: 0.55 },
  formCard: { gap: s.medium },
  coordinateRow: { flexDirection: "row", gap: s.medium, alignItems: "flex-start" },
  section: { gap: s.medium },
  compactCard: { gap: s.small },
  heroCard: {
    gap: s.medium, padding: s.cardLarge, borderRadius: r.extraLarge,
    backgroundColor: c.cardIvory, borderWidth: 1, borderColor: c.stoneBorder,
  },
  heroCopy: { gap: s.small, alignItems: "flex-start" },
  purposeCard: { gap: s.medium },
  purposeHeading: { flexDirection: "row", alignItems: "flex-start", gap: s.small },
  switchRow: { flexDirection: "row", alignItems: "center", gap: s.medium, paddingVertical: s.small },
  archiveCard: { gap: s.medium, borderColor: c.error, borderWidth: 1 },
});
