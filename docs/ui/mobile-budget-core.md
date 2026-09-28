# Mobile Budget Core

## Selected Dashboard Stitch composition

This implementation follows **Budget Dashboard** (`9b1a1de7722f49fa948b5b90a90fb384`). Its composition places the estimate and actual-spend summary first, then a compact category overview and recently updated Budget Items.

The compared alternative, **Budget Dashboard variant** (`9bd119aa583c4d15a03ddc4b64fefbf0`), gives more of the first view to a large budget-goal card and payment-oriented content. The selected screen better supports this slice's path from Wedding totals to categories and Budget Items. Both Stitch screens include payment-oriented material below their summaries; upcoming payments and schedule figures are omitted here because Supplier commitments and installments belong to the next finance slice.

Both compositions use **Warm Editorial Nuptial**: the existing shared ivory surfaces, sage actions, Playfair Display headings, Plus Jakarta Sans operational text, rounded editorial cards, and the established 20 px page margin.

## Implemented routes

- `/(wedding)/[weddingId]/budget`
- `/(wedding)/[weddingId]/budget/categories`
- `/(wedding)/[weddingId]/budget/categories/[categoryId]`
- `/(wedding)/[weddingId]/budget/items/new`
- `/(wedding)/[weddingId]/budget/items/[itemId]`
- `/(wedding)/[weddingId]/budget/expenses/new`
- `/(wedding)/[weddingId]/budget/supplier-payments-info` (explanatory placeholder only)

## Finance source of truth

- The dashboard reads estimated, actual, manual actual, Supplier actual, active item count, and currency from `wedding_budget_totals`.
- `estimated_total` is the active planned allocation. Actual spend is the backend's manual non-Supplier actual plus net `supplier_payment_transactions`.
- The dashboard never reconstructs Wedding totals from Budget Items and never reads `legacy_supplier_actual_amount` or legacy `supplier_payments`.
- Scheduled installments, commitments, and payment schedules are not shown as actual spending.
- The Wedding `currency_code` drives number formatting. The Budget tab uses a generic currency glyph so it does not imply PHP.

## Categories and category totals

Active categories are read by `wedding_id` with `archived_at IS NULL`, ordered by `sort_order`. Category names are trimmed, and duplicate active names are reported from the database's case-insensitive unique index. Editing and reordering update scoped rows; archive sets `archived_at` and retains the category and its Budget Items.

Category estimates sum only `PLANNED` and `CONFIRMED` items. Manual actuals sum `budget_items.actual_amount` only when `supplier_id IS NULL`. Supplier actual contribution is derived from net payment and reversal transactions linked to a Budget Item in that category. It does not include installments or payments without a linked Budget Item. Such unallocated Supplier transactions remain in the canonical Wedding total and are not assigned to a category.

Archived categories are left out of active category lists. Their records remain available through their scoped category route; existing Budget Items can be moved to an active category. Item statuses are exactly `PLANNED`, `CONFIRMED`, `CANCELLED`, and `ARCHIVED`.

## Manual actuals and Supplier actuals

For a Budget Item without a Supplier, `actual_amount` holds an optional manual actual cost. The item editor can add or edit it. Add Expense creates a `CONFIRMED` non-Supplier Budget Item with `estimated_amount = 0` and saves the entered cost to `actual_amount`.

For a Supplier-linked Budget Item, `actual_amount` stays null. Choosing a Supplier explains that actual Supplier payments are managed separately; the Budget UI does not create a payment transaction, commitment, installment, or receipt. The Supplier Payments action opens an explanatory placeholder for the next slice. The database constraint remains authoritative if a client submits an invalid combination.

## Finance privacy and Wedding boundaries

Finance access follows `private.can_manage_wedding_finances`: Owners, Full Coordinators, and the existing coordinator-managed controller path. The controller path is represented by an active Full Coordinator membership. Day-of and Guest Coordinators receive a private/unavailable state with no displayed totals. If the protected canonical totals view returns no row, the UI treats the Budget as private rather than showing an empty budget with fake zeroes.

Every read and mutation includes the active Wedding ID. Item edits first locate the item within that Wedding; category and Supplier selections are also checked within it. Final authorization and same-Wedding constraints remain enforced by Supabase RLS and database constraints. Switching Weddings resets the nested Budget stack and its loaded state through the existing workspace cache revision.

## Intentional Stitch adaptations

- Payment schedules and Supplier payment actions are removed from the selected Dashboard composition. The remaining summary reports actual spend from the canonical totals view only.
- The Add Expense presentation is mapped to a manual non-Supplier actual on a Budget Item. Its date, payment-method, Supplier-payment, and receipt concepts are omitted because those records are outside this slice's backend/UI contract.
- A linked Supplier opens an explanatory Supplier Payments placeholder; this branch does not implement Supplier details or payment entry.
- Categories and amounts come from the current Wedding. No sample finance values or wedding facts are included.

## Deferred physical QA

- Currency input keyboard
- Amount formatting
- Category scrolling and reordering
- Add Expense form ergonomics
- Status actions
- Large Budget Item lists
- Android and iOS layout
