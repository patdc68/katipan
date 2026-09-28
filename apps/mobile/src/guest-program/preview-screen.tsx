import { useCallback, useState } from "react";
import { useFocusEffect, type Href } from "expo-router";
import { EditorialCard, EmptyState, ErrorState, KatipanButton, KatipanScreen, KatipanText, LoadingState, StatusChip } from "../ui";
import { useWeddingDayRoute } from "../wedding-day/components";
import { loadProgram } from "./api";
import { ProgramCard, ProgramHeader, programStyles } from "./components";
import { guestVisibleProgram, type ProgramData } from "./model";

export default function GuestProgramPreviewScreen() {
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
  if (workspace.loading || (isCurrent && membership && load?.key !== key)) return <KatipanScreen><LoadingState label="Loading published program…" /></KatipanScreen>;
  if (!membership || !isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (load?.failed || !load?.data) return <KatipanScreen><ErrorState title="Published program unavailable" onRetry={() => setRevision(n => n + 1)} /></KatipanScreen>;
  const data = load.data;
  const visible = guestVisibleProgram(data.items);
  return <KatipanScreen contentContainerStyle={programStyles.page}>
    <KatipanButton label="Back to Guest Program" variant="text" onPress={() => router.navigate({ pathname: "/(wedding)/[weddingId]/website/program", params: { weddingId } } as unknown as Href)} />
    <ProgramHeader title="Published Program Preview" description="A Wedding-team preview of the program records included by the sanitized Guest Guide." />
    <EditorialCard style={programStyles.notice}><StatusChip label={data.website?.isPublished ? "Website published" : "Website not published"} tone={data.website?.isPublished ? "success" : "warning"} />
      <KatipanText>{data.website?.isPublished ? "Guests with website access can see these published items." : "The Guest Guide is unavailable to guests until the Wedding Website is published."}</KatipanText>
      <KatipanText variant="bodySmall" color="textMuted">{data.items.length - visible.length} draft item{data.items.length - visible.length === 1 ? "" : "s"} excluded. Website access rules still govern who may open the guide.</KatipanText>
    </EditorialCard>
    {visible.length ? visible.map(item => <ProgramCard key={item.id} item={item} data={data} />)
      : <EditorialCard><EmptyState title="No published items" description="Draft Guest Program items do not appear in the guest guide." /></EditorialCard>}
  </KatipanScreen>;
}
