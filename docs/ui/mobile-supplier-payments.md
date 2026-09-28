# Mobile Supplier Payments

## Stitch and visual direction

The finance flow follows the **Warm Editorial Nuptial** design system and these Stitch screens:

- Payment Schedule — `32aabb6540a045cbb16d0593fce47968`
- Payment Details — `e1b9851f737541849ee9248c0c29ea3a`
- Supplier Details — `a23d06be3ec24409abbb53b330da36fd`

The screens use the shared mobile typography, ivory surfaces, sage actions, gold accents, rounded cards, and existing spacing tokens. The Stitch records were queried, but their externally hosted screenshots could not be opened in this environment. A direct screenshot comparison remains Deferred physical QA. Existing Warm Editorial components and the local Stitch source-of-truth document are used as the canonical visual reference.

## Routes

- `/(wedding)/[weddingId]/budget/suppliers/[supplierId]/payments` — schedule, canonical totals, upcoming installments, recent actual payments.
- `/(wedding)/[weddingId]/budget/suppliers/[supplierId]/installments/new` — create installment.
- `/(wedding)/[weddingId]/budget/suppliers/[supplierId]/installments/[installmentId]` — edit or cancel an installment.
- `/(wedding)/[weddingId]/budget/suppliers/[supplierId]/payments/new` — record an installment-linked or explicitly unscheduled payment.
- `/(wedding)/[weddingId]/budget/suppliers/[supplierId]/payments/[paymentId]` — payment details, reversal history, receipt evidence.

Supplier Details links to Payment Schedule and provides Add Installment and Record Payment actions. No bottom tab was added.

## Installment schedule

`supplier_installment_schedule` is authoritative for paid amount, unpaid balance, and status. The client maps the returned values and does not derive or persist status. Supported states are `PENDING`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, and `CANCELLED`. The schedule shows amount, due date, paid amount, unpaid balance, linked Budget Item name, and notes.

Creation calls `create_supplier_installment` with the active Wedding and Supplier, a positive amount, required date, optional same-Wedding/same-Supplier Budget Item, and optional notes. Editing uses the RLS-protected table update with only `budget_item_id`, `amount`, `due_date`, and `notes`. Cancellation sets `cancelled_at`; it does not delete a row or payment, reverse a transaction, or adjust Supplier commitment or Budget Item actual amount. The editor asks for confirmation before cancellation.

## Actual payment ledger and retries

Actuals are append-only rows in `supplier_payment_transactions`. Mobile creates new `PAYMENT` rows only through `record_supplier_payment`; it never chooses transaction `kind` or `source`, and never updates or deletes ledger rows. `PAYMENT` and its optional `REVERSAL` are displayed as separate history. A reversed original is clearly marked and remains unchanged.

Each deliberate payment action creates one `client_request_id` UUID and one `paid_at` timestamp, then freezes them with amount, Wedding, Supplier, optional installment and Budget Item, method, reference, and notes. The exact pending object is written before the RPC call. Native apps use SecureStore; web uses the existing browser local storage session pattern. Until a definitive success or backend rejection, Retry resends the stored facts without making a new key or timestamp. An unreadable stored attempt blocks a new payment rather than silently discarding unresolved facts. The database returns the original transaction ID for exact replay and rejects changed facts under the same key.

Partial payments are recorded as normal actual payments; the refreshed authoritative schedule shows the resulting paid amount and balance. A genuinely unscheduled payment sends a null installment ID and does not create a placeholder installment. After success the screen reloads the schedule and canonical Supplier, Wedding payment, and Budget totals. Aggregate refresh failures do not change a successful payment result; the destination reloads those canonical views.

## Reversal

Reversal requires a non-empty reason and an explicit confirmation. The client calls `reverse_supplier_payment`; the database appends a `REVERSAL`. The action is disabled while it is submitting, and the screen reloads payment details and canonical aggregates after success.

The reversal RPC has no idempotency key. If its response times out, the app reports that it could not confirm the result and asks the user to refresh Payment Details before deciding what to do. The UI does not automatically retry a reversal and does not claim a timeout is safe to replay. The backend's one-reversal-per-payment constraint remains authoritative.

## Receipt evidence

Receipts link only to original `PAYMENT` transactions. The mobile lifecycle is:

1. Call `reserve_attachment` with the Wedding, selected filename, content type, and `FINANCIAL_PRIVATE` visibility.
2. Upload the bytes to the exact reserved object path in `wedding-files` with overwrite disabled.
3. Call `confirm_attachment_uploaded` with the reserved attachment ID and byte size.
4. Call `link_payment_receipt_attachment` with the payment and attachment IDs.

Payment Details displays private attachment metadata. Opening a receipt revalidates the link and requests a 60-second signed URL. Removing a receipt calls `mark_attachment_deleted`; storage objects are not exposed as permanent URLs. Receipts never link to installments or reversal rows.

## Finance privacy and Wedding boundaries

Finance screens are available to active `OWNER` and `FULL_COORDINATOR` memberships. Day-of and Guest Coordinators receive a private state, not empty or zero-valued finance. A canonical `wedding_budget_totals` row is required before the client considers finance available. RLS, RPC authorization, composite Wedding relationships, and Storage policies remain authoritative.

Reads and mutations scope the current Wedding, Supplier, and related records. Receipt access is limited to active finance-authorized screens. No legacy payment table, legacy amount field, or old payment mutation RPC is used. Budget and payment aggregate values are read from `supplier_finance_totals`, `wedding_payment_totals`, and `wedding_budget_totals`; the UI does not rebuild canonical totals from raw ledger rows.

## Deferred physical QA

- Currency keyboard entry and validation on Android and iOS.
- Date and time picker behavior across locales and time zones.
- Partial payment against an installment and schedule refresh.
- Ambiguous network timeout followed by Retry with the same request ID and timestamp.
- App background/resume while an attempt is pending.
- App termination with an unresolved attempt, then recovery from SecureStore.
- Installment cancellation confirmation and refreshed `CANCELLED` state.
- Reversal confirmation, refresh, and timeout/review behavior.
- Receipt picker, upload, private view/download, and logical deletion on Android and iOS.
- Android/iOS layout, keyboard overlap, small screens, and accessibility scaling.
- Direct visual comparison against the Stitch-hosted screenshots when those image assets are accessible.
