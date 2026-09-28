import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useWorkspace } from "../workspace/context";
import { isCurrentWeddingWorkspace } from "../workspace/model";
import type { WorkspaceMembership } from "../workspace/model";
import {
  loadSupplierDetails,
  loadSupplierForEditor,
  loadSupplierList,
} from "./api";
import type {
  SupplierDetailsData,
  SupplierEditorData,
  SupplierLoadResult,
} from "./model";

type Loader<T> = (membership: WorkspaceMembership) => Promise<SupplierLoadResult<T>>;
type RequestResult<T> = { requestId: string; result: SupplierLoadResult<T> | null; failed: boolean };

export function useSupplierResource<T>(loader: Loader<T>, resourceKey: string) {
  const params = useLocalSearchParams<{ weddingId?: string | string[] }>();
  const weddingId = Array.isArray(params.weddingId) ? params.weddingId[0] ?? "" : params.weddingId ?? "";
  const workspace = useWorkspace();
  const membership = weddingId ? workspace.membershipFor(weddingId) : null;
  const isCurrent = isCurrentWeddingWorkspace(membership, workspace.selectedWeddingId, weddingId);
  const [reloadCount, setReloadCount] = useState(0);
  const [requestResult, setRequestResult] = useState<RequestResult<T> | null>(null);
  const requestId = [
    weddingId,
    membership?.membershipId ?? "no-membership",
    String(workspace.cacheRevision),
    resourceKey,
    String(reloadCount),
  ].join(":");

  useEffect(() => {
    let current = true;
    if (!isCurrent || !membership) return () => { current = false; };
    void loader(membership)
      .then((result) => {
        if (current) setRequestResult({ requestId, result, failed: false });
      })
      .catch(() => {
        if (current) setRequestResult({ requestId, result: null, failed: true });
      });
    return () => { current = false; };
  }, [isCurrent, loader, membership, requestId]);

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
    data: resultIsCurrent ? requestResult.result : null,
    error: resultIsCurrent && requestResult.failed,
    loading: workspace.loading || Boolean(membership && !isCurrent) || (isCurrent && !resultIsCurrent),
    retry: () => setReloadCount((count) => count + 1),
  };
}

export function useSupplierListResource() {
  return useSupplierResource(loadSupplierList, "list");
}

export function useSupplierDetailsResource(supplierId: string) {
  const loader = useCallback(
    (membership: WorkspaceMembership) => loadSupplierDetails(membership, supplierId),
    [supplierId],
  );
  return useSupplierResource<SupplierDetailsData>(loader, `details:${supplierId}`);
}

export function useSupplierEditorResource(supplierId: string | null) {
  const loader = useCallback(
    (membership: WorkspaceMembership) => loadSupplierForEditor(membership, supplierId),
    [supplierId],
  );
  return useSupplierResource<SupplierEditorData>(loader, `editor:${supplierId ?? "new"}`);
}
