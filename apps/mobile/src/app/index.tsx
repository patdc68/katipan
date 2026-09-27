import { Redirect } from "expo-router";
import { ErrorState, LoadingState } from "../ui";
import { useAccess } from "../onboarding/provider";
import { useWorkspace } from "../workspace/context";
import { destinationAfterRestore } from "../workspace/model";

export default function Index() {
  const { loading, session, error, refresh } = useAccess();
  const workspace = useWorkspace();
  if (loading || (session && workspace.loading)) return <LoadingState label="Restoring your wedding…" />;
  if (error) return <ErrorState description={error} onRetry={() => void refresh()} />;
  if (!session) return <Redirect href="/(access)/welcome" />;
  if (workspace.error) return <ErrorState description={workspace.error} onRetry={() => void workspace.refreshMemberships()} />;
  const destination = destinationAfterRestore(true, workspace.memberships);
  if (destination === "create-wedding") return <Redirect href="/(access)/create-wedding" />;
  if (destination === "home") return <Redirect href={{
    pathname: "/(wedding)/[weddingId]/home",
    params: { weddingId: workspace.memberships[0]!.weddingId },
  }} />;
  return <Redirect href="/(workspace)/weddings" />;
}
