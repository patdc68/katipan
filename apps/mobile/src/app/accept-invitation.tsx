import { useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { z } from "zod";
import { KatipanButton, KatipanScreen, KatipanText, FormField } from "../ui";
import { artwork, Brand, EditorialImage } from "../onboarding/components";
import { useAccess } from "../onboarding/provider";
import { supabase } from "../auth/client";
import { signUpWithEmail } from "../auth/email";

const credentials = z.object({ email: z.email(), password: z.string().min(8) });
export default function AcceptInvitation() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { session, refresh } = useAccess();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false); const busyRef = useRef(false);
  async function authenticate() {
    if (busyRef.current) return;
    const parsed = credentials.safeParse({ email: email.trim(), password });
    if (!parsed.success) { setError("Enter a valid email and a password of at least 8 characters."); return; }
    busyRef.current = true; setBusy(true); setError("");
    try {
      const result = mode === "signup" ? await signUpWithEmail(parsed.data.email, parsed.data.password) : await supabase.auth.signInWithPassword(parsed.data);
      if (result.error) throw result.error;
      if (!result.data.session) setMessage("Check your email to confirm your account, then reopen the invitation link.");
    } catch { setError("We couldn’t sign you in. Check your details and try again."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function accept() {
    if (busyRef.current || !token || !/^[0-9a-f]{64}$/.test(token)) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("accept_wedding_invitation", { p_raw_token: token });
      if (rpcError || !data?.[0]) throw rpcError ?? new Error("Missing acceptance result");
      setAccepted(true); await refresh();
    } catch { setError("This invitation is unavailable or has expired. Ask your partner for a new link."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <KatipanScreen contentContainerStyle={{ gap: 20 }}>
    <Brand /><EditorialImage source={artwork.invite} height={210} />
    <KatipanText variant="headlineMobile" accessibilityRole="header">Join your Katipan.</KatipanText>
    {accepted ? <KatipanText color="primary">You joined the existing wedding workspace. Your partner can now plan with you.</KatipanText> : !token || !/^[0-9a-f]{64}$/.test(token) ? <KatipanText color="error">This invitation link is invalid. Ask your partner for a fresh link.</KatipanText> : session ? <><KatipanText color="textMuted">Accept your partner’s invitation to join their existing wedding.</KatipanText><KatipanButton label="Accept Invitation" loading={busy} onPress={() => void accept()} /></> : <><KatipanText color="textMuted">Sign in with the invited email address. Your wedding details will remain in the existing workspace.</KatipanText><FormField label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" /><FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry /><KatipanButton label={mode === "signup" ? "Create Account" : "Sign In"} loading={busy} onPress={() => void authenticate()} /><KatipanButton label={mode === "signup" ? "Already have an account? Sign in" : "New to Katipan? Create account"} variant="text" onPress={() => setMode(mode === "signup" ? "signin" : "signup")} /></>}
    {!!error && <KatipanText color="error" accessibilityRole="alert">{error}</KatipanText>}
    {!!message && <KatipanText color="primary" accessibilityRole="alert">{message}</KatipanText>}
  </KatipanScreen>;
}
