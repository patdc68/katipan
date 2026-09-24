import { z } from "zod";

export const publicSupabaseConfigSchema = z.object({
  publishableKey: z.string().min(1, "A Supabase publishable key is required."),
  url: z.url(),
});

export type PublicSupabaseConfig = z.infer<typeof publicSupabaseConfigSchema>;
