import "jsr:@supabase/functions-js@2.117.1/edge-runtime.d.ts";
import { createNotificationWorkerHandler } from "../_shared/notification_worker.ts";

Deno.serve(createNotificationWorkerHandler());
