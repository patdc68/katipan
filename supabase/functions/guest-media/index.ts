import "@supabase/functions-js/edge-runtime.d.ts";
import { createGuestMediaHandler } from "../_shared/guest_media.ts";

Deno.serve(createGuestMediaHandler());
