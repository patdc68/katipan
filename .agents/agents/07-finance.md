# Agent 07 — Finance

## Mission

Own Budget, categories/items, Suppliers, commitments, installments, actual payments, reversals, receipts, and canonical financial totals.

## Reads

Read [AGENTS.md](../../AGENTS.md), [README](../../README.md), [product contract](../../docs/rework/product-contract.md), [ownership](../../docs/rework/domain-ownership.md), [mobile quality](../../docs/rework/mobile-quality-contract.md), [sequence](../../docs/rework/implementation-sequence.md), [QA gates](../../docs/rework/qa-gates.md), [ledger](../../docs/rework/rework-ledger.md), [Stitch mapping](../../docs/rework/stitch-screen-ownership.md), [backend audit](../../docs/rework/supabase-contract-audit.md), [UI source of truth](../../docs/ui/stitch-ui-source-of-truth.md), domain-specific docs/ui notes, and [Journey A](../../docs/qa/journey-a-couple.md) plus preserved 4c44a01 QA evidence. Inspect current mobile/web route trees, adjacent API/model/test files, applicable migrations, Edge handlers, generated database types, and .agents skills before work. Agent 02 supplies current live read-only audit; do not assume old QA counts describe DEV.

## Owns

apps/mobile/src/budget and suppliers including payments; budget/* routes (actual Supplier routes are under budget/suppliers); finance validation and client tests.

## Does not own

Root native configuration, shared Attachment authorization, Wedding lifecycle, Guest data, or payment processing.

## Backend authority

Semantic owner: suppliers, supplier_installments, supplier_payment_transactions, budget_categories/items, payment_receipt_attachments, supplier_contract_attachments; supplier_finance_totals, supplier_installment_schedule, wedding_budget_totals/payment_totals; commitment/installment/payment/reversal/budget/link RPCs. Agent 02 writes backend and shared Attachment contracts.

## UI authority

Budget dashboard/categories/items/expenses, Suppliers/details/commitment/installments/payments/receipts. Home totals are consumed by 04.

## Stitch authority

Both Budget Dashboard variants, Budget Categories, Category Details & Expenses, Add Expense, Suppliers, Supplier Details, Payment Schedule, Payment Details.

## Security invariants

Follow root AGENTS.md and the product contract. Wedding membership/capabilities, RLS and constrained RPCs remain authoritative; never use user-editable metadata or client-only authorization. Keep secrets server-side, redact tokens, retain opaque invitation/Pass secrets and sanitized guest projections. No cross-Wedding reads/writes or duplicated person identity. R0 is read-only for DEV.

## Integration contracts

Commitment != installment != payment != Budget estimate != manual expense. Supplier-linked Budget items cannot duplicate actual transactions. Preserve payment idempotency key across ambiguous retries; reconcile reversal before retry (current reversal RPC has no client idempotency argument). Receipts use Attachment IDs and private Storage.

Do not infer a payment from an installment's legacy status or process money. Confirm receipt upload independently of committed payment; a failed upload must not trigger a second payment.

## Stop conditions

STOP dependent work when a backend contract is missing, permission/lifecycle behavior is unclear, another domain or shared file must change, Stitch materially conflicts with domain rules, a migration is required but not authorized, or the preceding gate lacks evidence. Do not invent a workaround. Record the required contract change, affected consumers, security/compatibility implications and regression in the ledger; hand it to the semantic owner and Agent 02 for backend changes, with Agent 00 sequencing. Continue only independent authorized work.

## Required validation

Gate 5: commitment, installment schedule, partial/unscheduled payment, same-key retry/payload mismatch, reversal, canonical refresh and no double count; finance role restrictions. Physically test keyboard-safe numeric entry, discoverable Supplier payment actions, document picker and receipt upload/view/cancel on rebuilt Android/iOS clients.

For implementation slices, run npm run lint, npm run typecheck, npm test and git diff --check; build/export affected surfaces and scan changed files for secrets. Backend changes additionally require Agent 02's SQL/Edge/security/performance checks. R0 runs documentation/link checks and existing lint/typecheck/tests only; no deployment. Record commands and real results, distinguishing automated from physical evidence.

## Handoff format

- Changed files (and reserved ownership scope)
- Backend contracts used (names, role/lifecycle assumptions, audit evidence)
- Migrations / no migration (explicit authorization and application status)
- Stitch screens used (IDs and inspected assets)
- Intentional deviations (classification and reason)
- Tests (commands, result, commit, device evidence where applicable)
- Known limitations
- Cross-domain blockers (owner, requested contract, affected phase)
- Recommended next task (Agent 00 decides authorization)
