import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createGooglePlacesHandler } from "../_shared/google_places.ts";

Deno.serve(createGooglePlacesHandler("details"));
