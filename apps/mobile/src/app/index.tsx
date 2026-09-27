import { Redirect } from "expo-router";
import { LoadingState } from "../ui";
import { useAccess } from "../onboarding/provider";

export default function Index() {
  const { loading, session, stage, motifDone } = useAccess();
  if (loading) return <LoadingState label="Restoring your wedding…" />;
  if (!session) return <Redirect href="/(access)/welcome" />;
  if (stage === "created") return <Redirect href={motifDone ? "/(access)/invite-partner" : "/(access)/motif-complete"} />;
  return <Redirect href={stage === "details" ? "/(access)/wedding-details" : "/(access)/create-wedding"} />;
}
