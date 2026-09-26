# Phase 1B F7: notification delivery

Notifications are Wedding-scoped inbox records with optional email and Expo push delivery. Domain triggers create only the events below. All titles and bodies are fixed, generic text; private names, notes, contact details, financial documents, invitation secrets, Guest Pass QR values, signed URLs, and provider tokens never enter inbox metadata or provider messages. Metadata contains only an allowed route.

## Event and recipient matrix

| Category | Exact production event | Active recipients |
| --- | --- | --- |
| PLANNING_TASK | New task assignment; assigned task status or due date changes | Assigned member(s) |
| RSVP | Individual RSVP status changes | OWNER, FULL_COORDINATOR, GUEST_COORDINATOR |
| GUEST_UPDATE | Household invitation delivery becomes SENT; Guest moves Household | OWNER, FULL_COORDINATOR, GUEST_COORDINATOR |
| PAYMENT_DUE | Unpaid installment first enters the next-seven-day window; first becomes overdue | OWNER, FULL_COORDINATOR |
| WEDDING_DAY | Run-of-Show item becomes DELAYED/CANCELLED or scheduled start changes | OWNER, FULL_COORDINATOR, DAY_OF_COORDINATOR |
| MEMBERSHIP | Invitation is accepted; active member role changes; active member leaves/is removed | Acceptance: new member plus OWNER/FULL_COORDINATOR; role: target member; departure: remaining OWNER/FULL_COORDINATOR |
| SYSTEM | Archived Wedding is restored to ACTIVE | OWNER, FULL_COORDINATOR |

Only ACTIVE Weddings without a deletion request produce notifications. No generic row-update trigger exists. The payment producer is intended to run daily; it sends at most one upcoming and one overdue notice for each unpaid installment. It reads source installments and net payment transactions, not budget duplicates. The returned producer count is a processing count, not a unique-notification metric.

## Preferences and delivery

The existing preferences determine Wedding mute, category opt-out, email, push, timezone, and quiet hours. A mute/category opt-out suppresses new inbox production. Channel toggles affect outbox creation independently; an enabled inbox notification can have no external delivery. Preferences, active membership, Wedding state, and quiet hours are rechecked when claiming and immediately before dispatch. Removed or departed members retain historical inbox rows, while outstanding delivery is cancelled. Destination rows belong to the User and remain available for other Weddings.

Quiet hours delay the same outbox row until the local end time in the stored IANA zone. Overnight ranges and daylight-saving boundaries use PostgreSQL timezone conversion. A quiet-hours change between claim and dispatch defers the same claim rather than discarding or recreating the notification.

An inbox row has a stable event-derived recipient idempotency key; the outbox has one row per notification/channel. Claims use row locks and claim tokens. Email sends use the outbox UUID as the Resend `Idempotency-Key`. Only a definite rate-limit rejection is retried; ambiguous email failures are recorded as terminal provider failures to avoid replay beyond Resend's idempotency window. Expo has no send idempotency key: the worker reserves each device before sending and never replays an accepted or ambiguous reservation. Ambiguous push attempts may therefore be missed; Expo itself offers best-effort, at-least-once handoff rather than an exactly-once guarantee. Ticket receipts are checked on later worker runs; `DeviceNotRegistered` revokes the destination. The worker returns only counts and generic errors; it never returns keys, addresses, or device tokens.

## External configuration and operation

The Edge Function requires a service-role bearer token for invocation and uses that credential server-side only. Set `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` as Edge Function secrets after a sending domain is verified. The repository has no configured transactional email provider, so email rows are deferred hourly until these values exist. Do not use the Auth SMTP settings as an application-notification sender.

Expo native builds need APNs/FCM credentials and an EAS project ID. The mobile helper `registerNotificationDevice` obtains permission, fetches an Expo token using the project ID, and registers or updates a User-owned app-installation UUID; call it after sign-in once mobile Auth is wired. Call `revokeNotificationDevice` before sign-out. No EAS project ID or push credentials are present in this repository. Token registration and provider delivery cannot be exercised against physical devices until that setup is complete.

Schedule `notification-worker` with an authenticated server-side scheduler. DEV does not currently have `pg_cron` or `pg_net` installed, and the service credential must not be inserted into a migration or client config. A Supabase Cron job may use a Vault-stored service credential to call the function at least daily (preferably every minute); it can be configured after credentials are provisioned. The worker is safe for concurrent invocations. The migration deliberately does not create a remote-only scheduler or persist a credential.

## Verification

`supabase/tests/database/notification_delivery.test.sql` covers recipients, idempotency, opt-outs, mute, channel toggles, overnight quiet hours, removal, User-owned devices, retry reservation, isolation, payload safety, and inbox reads. `supabase/functions/tests/notification_worker.test.ts` covers authorization, Resend idempotency, deferral, multiple devices, and ambiguous push responses. Provider delivery to real mailboxes and physical devices remains an integration check after the external setup above.

Provider behavior and scheduling follow the [Expo push API](https://docs.expo.dev/push-notifications/sending-notifications/), [Expo delivery guarantees](https://docs.expo.dev/push-notifications/faq/), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), and [Supabase scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).
