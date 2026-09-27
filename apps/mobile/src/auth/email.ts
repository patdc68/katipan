import { getAuthRedirectUrl, supabase } from "./client";

export function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: getAuthRedirectUrl() },
  });
}

export async function exchangeConfirmationCode(code: unknown) {
  if (typeof code !== "string" || code.length < 8 || code.length > 512 || !/^[A-Za-z0-9._~-]+$/.test(code)) {
    throw new Error("Invalid confirmation link.");
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !data.session) throw sessionError ?? new Error("Confirmation session unavailable.");
}
