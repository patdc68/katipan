import { useCallback, useState } from "react";
import { useFocusEffect, type Href } from "expo-router";
import { EditorialCard, EmptyState, ErrorState, KatipanButton, KatipanScreen, KatipanText, LoadingState } from "../ui";
import { useWeddingDayRoute } from "../wedding-day/components";
import { loadProgram } from "./api";
import { ProgramCard, ProgramHeader, programStyles } from "./components";
import { canManageProgram, type ProgramData } from "./model";

export default function GuestProgramListScreen() {
  const { weddingId, membership, isCurrent, workspace, router } = useWeddingDayRoute();
  const [revision, setRevision] = useState(0);
  const [load, setLoad] = useState<{ key: string; data: ProgramData | null; failed: boolean } | null>(null);
  const key = `${weddingId}:${membership?.membershipId ?? "none"}:${workspace.cacheRevision}:${revision}`;
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (isCurrent && membership) void loadProgram(membership)
      .then(data => { if (alive) setLoad({ key, data, failed: false }); })
      .catch(() => { if (alive) setLoad({ key, data: null, failed: true }); });
    return () => { alive = false; };
  }, [isCurrent, membership, key]));
  const base = { weddingId };
  if (workspace.loading || (isCurrent && membership && load?.key !== key)) return <KatipanScreen><LoadingState label="Loading Guest Program…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (load?.failed || !load?.data) return <KatipanScreen><ErrorState title="Guest Program unavailable" onRetry={() => setRevision(n => n + 1)} /></KatipanScreen>;
  const data = load.data;
  return <KatipanScreen contentContainerStyle={programStyles.page}>
    <KatipanButton label="Back to More" variant="text" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/more", params: base } as unknown as Href)} />
    <ProgramHeader title="Guest Program" description="The schedule guests see. Run of Show keeps separate operational timing." />
    <EditorialCard style={programStyles.notice}><KatipanText variant="labelCaps" color="secondary">GUEST VISIBILITY</KatipanText>
      <KatipanText>Only published Guest Program items appear in the guest guide. Drafts remain private to the Wedding team.</KatipanText>
      <KatipanButton label="Preview Published Program" variant="secondary" onPress={() => router.push({ pathname: "/(wedding)/[weddingId]/website/program/preview", params: base } as unknown as Href)} />
    </EditorialCard>
    {canManageProgram(membership) && <KatipanButton label="Add Guest Program Item" onPress={() => router.push({ pathname: "/(wedding)/[weddingId]/website/program/new", params: base } as unknown as Href)} />}
    {!canManageProgram(membership) && <KatipanText color="textMuted">Your Wedding role can view this program. An Owner or Full Coordinator manages guest-facing changes.</KatipanText>}
    {data.items.length ? data.items.map(item => <ProgramCard key={item.id} item={item} data={data}
      onOpen={() => router.push({ pathname: "/(wedding)/[weddingId]/website/program/[itemId]", params: { ...base, itemId: item.id } } as unknown as Href)} />)
      : <EditorialCard><EmptyState title="No Guest Program items yet" description="Add guest-facing events, then publish each item when it is ready." /></EditorialCard>}
  </KatipanScreen>;
}
