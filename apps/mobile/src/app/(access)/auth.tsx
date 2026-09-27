import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, StyleSheet } from "react-native";
import { colorTokens as c, spacingTokens as s } from "@katipan/ui";
import { z } from "zod";
import { supabase, hasSupabaseConfig } from "../../auth/client";
import { signUpWithEmail } from "../../auth/email";
import { KatipanScreen, KatipanText, KatipanButton, FormField } from "../../ui";
import { artwork, Brand, EditorialImage } from "../../onboarding/components";

const credentialsSchema = z.object({ email: z.email("Enter a valid email address."), password: z.string().min(8, "Use at least 8 characters.") });
export default function Auth() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState(params.mode === "signin" ? "signin" : "signup");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  async function submit() {
    if (busy) return;
    const valid = credentialsSchema.safeParse({ email: email.trim(), password });
    if (!valid.success) { setError(valid.error.issues[0]?.message ?? "Check your details."); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      const result = mode === "signup" ? await signUpWithEmail(valid.data.email, valid.data.password) : await supabase.auth.signInWithPassword(valid.data);
      if (result.error) throw result.error;
      if (result.data.session) router.replace("/(access)/create-wedding");
      else setSuccess("Check your email and tap the confirmation link to continue in Katipan.");
    } catch { setError("We couldn't sign you in. Check your email and password, then try again."); }
    finally { setBusy(false); }
  }
  return <KatipanScreen contentContainerStyle={styles.content}>
    <Brand /><EditorialImage source={artwork.create} height={180} />
    <KatipanText variant="headlineMobile" accessibilityRole="header">{mode === "signup" ? "Begin your story." : "Welcome back."}</KatipanText>
    <KatipanText color="textMuted">{mode === "signup" ? "Create your Katipan account to start your shared wedding space." : "Sign in to continue planning together."}</KatipanText>
    <FormField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
    <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === "signup" ? "new-password" : "current-password"} textContentType={mode === "signup" ? "newPassword" : "password"} />
    {!!error && <KatipanText color="error" accessibilityRole="alert">{error}</KatipanText>}
    {!!success && <KatipanText color="primary" accessibilityRole="alert">{success}</KatipanText>}
    {!hasSupabaseConfig && <KatipanText color="error">Set the Expo public Supabase URL and publishable key to connect.</KatipanText>}
    <KatipanButton label={mode === "signup" ? "Create Account" : "Sign In"} onPress={() => void submit()} disabled={!hasSupabaseConfig} loading={busy} />
    <KatipanButton label={mode === "signup" ? "Already have an account? Sign in" : "New to Katipan? Create account"} variant="text" onPress={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setSuccess(""); }} />
    <View style={styles.note}><KatipanText variant="bodySmall" color="textMuted">Your wedding details stay private to your workspace.</KatipanText></View>
  </KatipanScreen>;
}
const styles = StyleSheet.create({ content: { gap: s.medium }, note: { backgroundColor: c.surfaceLow, borderRadius: 12, padding: s.medium } });
