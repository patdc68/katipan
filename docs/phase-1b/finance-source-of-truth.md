# Finance source of truth (Phase 1B F5)

## Flow

`Budget → Commitment → Installment Schedule → Actual Transaction`

These are four independent records. Katipan records amounts and evidence; it does not move money.

| Concept | Authoritative record | Meaning | Wedding aggregate |
| --- | --- | --- | --- |
| Budget allocation | `budget_items.estimated_amount` for active items | Planned allocation, including supplier and non-supplier items | `wedding_budget_totals.estimated_total` |
| Manual non-supplier actual | `budget_items.actual_amount` when `supplier_id IS NULL` | Actual cost entered without a supplier transaction | `wedding_budget_totals.manual_actual_total` |
| Supplier commitment | `suppliers.committed_amount` | Current contracted value, which may be unknown (`NULL`) | `wedding_payment_totals.committed_total` |
| Installment schedule | Active `supplier_installments.amount` | Planned due amount; editing it does not edit actual payments | `wedding_payment_totals.scheduled_total` |
| Actual supplier payment | `supplier_payment_transactions` with `kind = 'PAYMENT'` | Money recorded as paid, with date, method, reference, recorder, and receipt | Net `paid_total` |
| Reversal | `supplier_payment_transactions` with `kind = 'REVERSAL'` | Negates exactly one earlier payment. A corrected payment is a new row. | Subtracted from net `paid_total` |

No aggregate adds budget allocation, commitments, and schedules as if they were spending. The budget's `actual_total` is **manual non-supplier actual plus net supplier transactions**, each counted once. Supplier-linked `budget_items.actual_amount` is prohibited. Pre-F5 supplier-linked values, if any, move to `legacy_supplier_actual_amount` for audit and do not enter totals because their relationship to past payments was ambiguous.

## Derived balances

- An installment's paid amount is the net sum of its payment and reversal transactions. `unpaid_balance = max(planned amount − net paid, 0)`. `OVERDUE` means a non-cancelled installment has a past due date and a positive unpaid balance. It is never stored as editable truth.
- An unscheduled payment has a `NULL installment_id`. It contributes to supplier and Wedding actual paid and to commitment remaining, but to no installment balance.
- Supplier remaining commitment is `committed_amount − net actual paid`. It remains `NULL` when no commitment is known. A negative value exposes overpayment rather than hiding it. Wedding totals sum known commitments and remaining amounts and expose `uncommitted_supplier_count`.
- Cancelled installments leave historical transactions intact. Cancellation removes the installment from active scheduled and overdue totals; it does not reverse payments. A payment reversal is explicit.
- `supplier_finance_totals`, `supplier_installment_schedule`, `wedding_payment_totals`, and `wedding_budget_totals` are `security_invoker` views. They aggregate each source separately to avoid join multiplication and apply finance RLS.

## Migration from `supplier_payments`

The original combined rows and receipt links remain intact in `private.legacy_supplier_payments` and `private.legacy_payment_receipt_attachments`, inaccessible to client roles. Every old row is copied into `supplier_installments` with the same UUID, amount, due date, supplier, budget item, notes, cancellation, and timestamps. Every old row with `paid_at` also becomes a `LEGACY` actual transaction with that same UUID, preserving the paid date, payment method, reference, amount, and notes. A previously paid then cancelled row additionally gets a deterministic reversal at its cancellation time. Receipts for paid rows attach to the resulting actual transaction with their original relationship and timestamp. Any receipt linked to a row that was never paid remains preserved in the private legacy evidence table; no payment is invented to host it. Contract attachments remain linked to the supplier.

DEV had zero supplier, budget item, old payment, contract attachment, and receipt rows at pre-flight. The migration nevertheless handles existing records with the rules above. The archived source permits later audit of any unusual legacy interpretation.

The regression fixture in `supabase/tests/migration/finance_source_of_truth_seed.sql` and `finance_source_of_truth_verify.sql` seeds paid, paid-then-cancelled, and unpaid legacy rows, plus receipt, contract, and ambiguous supplier budget actuals. It must run against a **pre-F5 schema** with the migration SQL between the seed and verification, all in one transaction ending in `ROLLBACK`. It is kept outside the normal post-migration database suite because its seed intentionally uses the old table shape. The normal suite also checks migrated legacy rows against their archived originals when such rows exist.

## Authorization and evidence

Finance tables and views use the existing `private.can_manage_wedding_finances(wedding_id)` capability: active OWNER, active FULL_COORDINATOR, or valid temporary controller of a coordinator-managed Wedding. DAY_OF_COORDINATOR, GUEST_COORDINATOR, unrelated members, and anon are denied. Composite foreign keys enforce same-Wedding supplier, installment, budget item, and Attachment links. Financial contract and receipt evidence must remain `FINANCIAL_PRIVATE`. Receipts link to actual payment transactions; changing an installment never moves or recreates a receipt.

Client roles can insert transactions but cannot update or delete them. A reversal requires a reason, exactly matches one original payment, and is unique per original payment. The database trigger rejects transaction updates and deletes even for privileged table writers. No service-role key is used in a public client.
