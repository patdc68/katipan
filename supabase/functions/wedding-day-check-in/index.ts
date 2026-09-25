import "@supabase/functions-js/edge-runtime.d.ts";
import { createWeddingDayCheckInHandler } from "../_shared/wedding_day_check_in.ts";

Deno.serve(createWeddingDayCheckInHandler());
