import { Redirect } from "expo-router";
import { ErrorState, LoadingState } from "../ui";
import { useAccess } from "../onboarding/provider";
import { useWorkspace } from "../workspace/context";

export default function Index() {
  const { loading, session, error, refresh } = useAccess();
  const workspace = useWorkspace();
  if (loading || workspace.status === "AUTH_LOADING" || workspace.status === "AUTHENTICATED_WORKSPACE_LOADING") {
    return <LoadingState label="Restoring your wedding…" />;
  }
  if (error) return <ErrorState description={error} onRetry={() => void refresh()} />;
  if (!session || workspace.status === "SIGNED_OUT") return <Redirect href="/(access)/welcome" />;
  if (workspace.status === "RECOVERABLE_ERROR") {
    return <ErrorState description={workspace.error ?? "We couldn't restore your Wedding workspaces. Check your connection and try again."} onRetry={() => void workspace.refreshMemberships()} />;
  }
  if (workspace.status !== "AUTHENTICATED_WEDDING_READY" || !workspace.selectedMembership) {
    return <Redirect href="/(workspace)/weddings" />;
  }
  const membership = workspace.selectedMembership;
  if (membership.role === "FULL_COORDINATOR" && membership.wedding.origin === "COORDINATOR_CREATED") {
    return <Redirect href={{ pathname: "/(coordinator)/[weddingId]/overview", params: { weddingId: membership.weddingId } }} />;
  }
  return <Redirect href={{
    pathname: "/(wedding)/[weddingId]/home",
    params: { weddingId: membership.weddingId },
  }} />;
}
