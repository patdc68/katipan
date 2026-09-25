import "@supabase/functions-js/edge-runtime.d.ts";
import { createGuestWebsiteHandler } from "../_shared/guest_website.ts";

Deno.serve(createGuestWebsiteHandler("rsvp"));
