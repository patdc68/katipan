import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useWorkspace } from "../workspace/context";
import { isCurrentWeddingWorkspace } from "../workspace/model";
import { loadPlanningWorkspace } from "./api";
import type { PlanningWorkspaceData } from "./model";

type RequestResult = {
  requestId: string;
  data: PlanningWorkspaceData | null;
  failed: boolean;
};

export function usePlanningWorkspace() {
  const params = useLocalSearchParams<{ weddingId?: string | string[] }>();
  const weddingId = Array.isArray(params.weddingId) ? params.weddingId[0] ?? "" : params.weddingId ?? "";
  const workspace = useWorkspace();
  const membership = weddingId ? workspace.membershipFor(weddingId) : null;
  const isCurrent = isCurrentWeddingWorkspace(membership, workspace.selectedWeddingId, weddingId);
  const [reloadCount, setReloadCount] = useState(0);
  const [requestResult, setRequestResult] = useState<RequestResult | null>(null);
  const requestId = [
    weddingId,
    membership?.membershipId ?? "no-membership",
    String(workspace.cacheRevision),
    String(reloadCount),
  ].join(":");

  useEffect(() => {
    let current = true;
    if (!isCurrent || !membership) return () => { current = false; };
    void loadPlanningWorkspace(membership)
      .then((data) => {
        if (current) setRequestResult({ requestId, data, failed: false });
      })
      .catch(() => {
        if (current) setRequestResult({ requestId, data: null, failed: true });
      });
    return () => { current = false; };
  }, [isCurrent, membership, requestId]);

  const hasFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (hasFocused.current) setReloadCount((count) => count + 1);
    else hasFocused.current = true;
  }, []));

  const resultIsCurrent = requestResult?.requestId === requestId;
  return {
    weddingId,
    membership,
    isCurrent,
    data: resultIsCurrent ? requestResult.data : null,
    error: resultIsCurrent && requestResult.failed,
    loading: workspace.loading || Boolean(membership && !isCurrent) || (isCurrent && !resultIsCurrent),
    retry: () => setReloadCount((count) => count + 1),
  };
}
