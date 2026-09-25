import "jsr:@supabase/functions-js@2.117.1/edge-runtime.d.ts";
import { createAccountDeletionHandler } from "../_shared/wedding_lifecycle.ts";

Deno.serve(createAccountDeletionHandler());
