import "jsr:@supabase/functions-js@2.117.1/edge-runtime.d.ts";
import { createWeddingDeletionHandler } from "../_shared/wedding_lifecycle.ts";

Deno.serve(createWeddingDeletionHandler());
