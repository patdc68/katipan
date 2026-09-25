import "@supabase/functions-js/edge-runtime.d.ts";
import { createGuestPassLookupHandler } from "../_shared/guest_pass_lookup.ts";

Deno.serve(createGuestPassLookupHandler());
