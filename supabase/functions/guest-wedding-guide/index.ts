import { createGuestWebsiteHandler } from "../_shared/guest_website.ts";

Deno.serve(createGuestWebsiteHandler("guide"));
