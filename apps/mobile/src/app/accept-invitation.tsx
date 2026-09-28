import { useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { z } from "zod";
import { KatipanButton, KatipanScreen, KatipanText, FormField } from "../ui";
import { artwork, Brand, EditorialImage } from "../onboarding/components";
import { useAccess } from "../onboarding/provider";
import { supabase } from "../auth/client";
import { signUpWithEmail } from "../auth/email";
import { acceptInvitation } from "../workspace/api";
import { useWorkspace } from "../workspace/context";
import { safeInvitationFailure } from "../workspace/model";

const credentials = z.object({ email: z.email(), password: z.string().min(8) });

export default function AcceptInvitation() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = typeof params.token === "string" ? params.token : null;
  const router = useRouter();
  const { session } = useAccess();
  const workspace = useWorkspace();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const busyRef = useRef(false);

  async function authenticate() {
    if (busyRef.current) return;
    const parsed = credentials.safeParse({ email: email.trim(), password });
    if (!parsed.success) { setError("Enter a valid email and a password of at least 8 characters."); return; }
    busyRef.current = true; setBusy(true); setError("");
    try {
      const result = mode === "signup"
        ? await signUpWithEmail(parsed.data.email, parsed.data.password)
        : await supabase.auth.signInWithPassword(parsed.data);
      if (result.error) throw result.error;
      if (!result.data.session) setMessage("Check your email to confirm your account, then reopen the invitation link.");
    } catch {
      setError("We couldn't sign you in. Check your details and try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function accept() {
    if (busyRef.current || !session || !token || !/^[0-9a-f]{64}$/.test(token)) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const result = await acceptInvitation(token);
      const accepted = result.invitation;
      try {
        await workspace.refreshMemberships(accepted.wedding_id);
      } catch {
        setError("Your invitation was accepted, but we couldn't open the Wedding workspace yet. Try accepting the link again.");
        return;
      }
      router.replace({ pathname: "/(wedding)/[weddingId]/home", params: { weddingId: accepted.wedding_id } });
    } catch (acceptError) {
      setError(safeInvitationFailure(acceptError));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <KatipanScreen contentContainerStyle={{ gap: 20 }}>
      <Brand />
      <EditorialImage source={artwork.invite} height={210} />
      <KatipanText variant="headlineMobile" accessibilityRole="header">Join the Wedding on Katipan.</KatipanText>
      {!token || !/^[0-9a-f]{64}$/.test(token) ? (
        <KatipanText color="error">This invitation link is not valid. Ask the sender for a fresh link.</KatipanText>
      ) : session ? (
        <>
          <KatipanText color="textMuted">Accept this invitation to join the existing Wedding with the access set by the sender. Use the account invited for this link.</KatipanText>
          <KatipanButton label="Accept Invitation" loading={busy} onPress={() => void accept()} />
        </>
      ) : (
        <>
          <KatipanText color="textMuted">Sign in or create an account with the invited email address, then accept this link. If email confirmation takes you away from this screen, reopen the invitation from your message.</KatipanText>
          <FormField label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <KatipanButton label={mode === "signup" ? "Create Account" : "Sign In"} loading={busy} onPress={() => void authenticate()} />
          <KatipanButton
            label={mode === "signup" ? "Already have an account? Sign in" : "New to Katipan? Create account"}
            variant="text"
            onPress={() => setMode(mode === "signup" ? "signin" : "signup")}
          />
        </>
      )}
      {!!error && <KatipanText color="error" accessibilityRole="alert">{error}</KatipanText>}
      {!!message && <KatipanText color="primary" accessibilityRole="alert">{message}</KatipanText>}
    </KatipanScreen>
  );
}
