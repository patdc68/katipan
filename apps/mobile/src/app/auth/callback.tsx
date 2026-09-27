import { useEffect, useRef, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { KatipanButton, KatipanScreen, KatipanText } from "../../ui";
import { exchangeConfirmationCode } from "../../auth/email";
import { useAccess } from "../../onboarding/provider";

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string | string[]; error?: string | string[] }>();
  const router = useRouter();
  const { refresh, session } = useAccess();
  const started = useRef(false);
  const [state, setState] = useState<"loading" | "error" | "complete">("loading");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        if (params.error || Array.isArray(params.code)) throw new Error("Invalid confirmation link.");
        await exchangeConfirmationCode(params.code);
        await refresh();
        setState("complete");
      } catch {
        setState("error");
      }
    })();
  }, [params.code, params.error, refresh]);

  if (state === "complete" && session) return <Redirect href="/" />;
  if (state === "complete") return <KatipanScreen contentContainerStyle={{ justifyContent: "center", gap: 16 }}><KatipanText accessibilityRole="header" variant="headlineMobile">Your account is confirmed.</KatipanText><KatipanText color="textMuted">We’re opening your wedding planning space.</KatipanText></KatipanScreen>;
  if (state === "error") return <KatipanScreen contentContainerStyle={{ justifyContent: "center", gap: 16 }}><KatipanText accessibilityRole="header" variant="headlineMobile">This confirmation link can’t be used.</KatipanText><KatipanText color="textMuted">It may have expired or already been used. Sign in or request a new confirmation email to continue.</KatipanText><KatipanButton label="Go to sign in" onPress={() => router.replace("/(access)/auth?mode=signin")} /></KatipanScreen>;
  return <KatipanScreen contentContainerStyle={{ justifyContent: "center", gap: 16 }}><KatipanText accessibilityRole="header" variant="headlineMobile">Confirming your account…</KatipanText><KatipanText color="textMuted">Please wait while we securely restore your session.</KatipanText></KatipanScreen>;
}
