import { publicSupabaseConfigSchema } from "@katipan/validation";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

export function createPublicSupabaseClient(input: {
  publishableKey: string;
  url: string;
}) {
  const config = publicSupabaseConfigSchema.parse(input);
  return createClient<Database>(config.url, config.publishableKey);
}
