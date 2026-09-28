export type RawGuideResult =
  | { status: "ready"; value: unknown }
  | { status: "invalid-invitation" }
  | { status: "unavailable" };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const tokenPattern = /^[0-9a-f]{64}$/;
export async function fetchGuestGuide(
  slug: string,
  invitationToken: string | null,
  dependencies: { fetcher?: typeof fetch; supabaseUrl?: string; publishableKey?: string } = {},
): Promise<RawGuideResult> {
  if (slug.length < 3 || slug.length > 80 || !slugPattern.test(slug)
    || (invitationToken !== null && !tokenPattern.test(invitationToken))) return { status: "invalid-invitation" };
  const supabaseUrl = dependencies.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = dependencies.publishableKey ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return { status: "unavailable" };
  try {
    const response = await (dependencies.fetcher ?? fetch)(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/guest-wedding-guide`, {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ slug, ...(invitationToken ? { invitationToken } : {}) }),
      cache: "no-store",
    });
    if (response.status === 403) return { status: "invalid-invitation" };
    if (!response.ok) return { status: "unavailable" };
    return { status: "ready", value: await response.json() };
  } catch { return { status: "unavailable" }; }
}
