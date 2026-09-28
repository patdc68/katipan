# Mobile Suppliers

## Stitch references

This slice queries the **Warm Editorial Nuptial** design system and these Stitch screens:

- Suppliers — `74509b36726a4eafa2fd8d5d445e61e1`
- Supplier Details — `a23d06be3ec24409abbb53b330da36fd`
- Budget Dashboard — `9b1a1de7722f49fa948b5b90a90fb384`
- Category Details & Expenses — `5fcef1d558b94455a18d05b6ea20c303`

The four mobile Stitch records were queried. Stitch returned external screenshot and HTML URLs, but this environment could not retrieve those assets for a visual comparison. The implementation follows the local Warm Editorial source-of-truth tokens and existing mobile Budget composition: Playfair Display headings, Plus Jakarta Sans operational text, ivory surfaces, sage actions, gold accents, rounded cards, 20 px page margins and 24 px primary card corners. A direct per-screen visual comparison remains outstanding.

## Routes and navigation

- `/(wedding)/[weddingId]/budget/suppliers` — live Supplier list, search and filters.
- `/(wedding)/[weddingId]/budget/suppliers/new` — add Supplier.
- `/(wedding)/[weddingId]/budget/suppliers/[supplierId]` — Supplier details, finance summary and linked records.
- `/(wedding)/[weddingId]/budget/suppliers/[supplierId]/edit` — edit Supplier.

The Budget Dashboard links to Suppliers without adding a bottom tab. Supplier-linked Budget Items link to Supplier Details from the Budget list and item editor. Supplier Details links back into the existing Budget Item screen.

## Supplier lifecycle

Supplier status is exactly `PROSPECT`, `CONTACTED`, `BOOKED`, `COMPLETED` or `CANCELLED`. The form exposes those five backend values and never hard-deletes a Supplier. Categories remain free text and list filters are derived from the saved Wedding data.

Create and edit use `create_supplier` and `update_supplier`. The form requires a name and category, trims user input and lowercases a valid optional email before calling the RPC. Contact links open native mail, telephone or browser handlers only after the user taps them.

## Commitment semantics

Commitment is the agreed Supplier contract value. It is separate from scheduled installments, actual payments and Budget estimates. The Supplier screen calls `set_supplier_commitment` to create or edit a commitment. A clear action sends null for the amount, date and notes together; the existing RPC and database constraint support this safely.

Commitments accept zero or a positive amount. An amount is required when setting one. A date and notes are optional, and are cleared with the amount. The app does not derive a commitment from installments.

## Supplier finance aggregate

The UI reads `supplier_finance_totals`, the canonical per-Supplier aggregate. It keeps these values distinct:

- **Committed** — agreed Supplier contract value.
- **Scheduled** — active installment schedule total.
- **Paid** — net `PAYMENT` minus `REVERSAL` transactions.
- **Remaining Commitment** — committed amount minus actual paid.
- **Overdue** — unpaid balance on overdue installments.
- **Unscheduled Paid** — net actual Supplier payments not tied to an installment.

The Supplier UI does not read `supplier_payments`, `private.legacy_supplier_payments` or `legacy_supplier_actual_amount`. It does not calculate actual paid from transactions itself. The aggregate row supplies each value independently. When commitment is absent, the UI says “Not set” or “Not available” instead of substituting a zero commitment.

## Budget Item relationship

Supplier Details lists Budget Items where `supplier_id` and `wedding_id` match the current Supplier and Wedding. Each row shows its name, category, estimated amount and status. Selecting a row opens the existing Budget Item flow. Supplier-linked `actual_amount` must stay null; Supplier spending comes from payment transactions and is not copied onto the Budget Item.

## Contract documents

Supplier Details shows linked contract attachment metadata that is available in the existing attachment tables, including file name, content type and size. The query scopes both the link and attachment to the current Wedding, filters for `FINANCIAL_PRIVATE`, and never exposes a storage locator. Upload and linking controls are deferred to the payments/evidence slice; no new document-storage architecture or receipt workflow is introduced here.

## Finance privacy and Wedding boundaries

Supplier and finance data is available only to an active Owner or Full Coordinator membership, including the existing coordinator-managed controller path represented by a Full Coordinator membership. Day-of and Guest Coordinators receive a private state without empty or zero finance values. The app checks a finance totals row before rendering an empty list, and backend RLS/RPC authorization remains authoritative.

Supplier, finance, Budget Item, category and attachment reads include the active Wedding ID. Edit and commitment operations verify that the Supplier belongs to that Wedding before calling the existing RPC. Cross-Wedding IDs are treated as unavailable and never reveal the referenced record.

## Intentional Stitch adaptations

- Search and status filters cover the five allowed lifecycle states; category filters come from live category text rather than a fixed enum.
- Supplier cards use initials because the final Supplier model has no Supplier image field. No sample Supplier imagery or details are fabricated.
- Payment Schedule management, installments, actual payment entry, reversals and receipts are omitted for the next finance slice. The summary only displays canonical aggregate values.
- Contract attachments are read-only metadata in this slice. Uploading, linking and opening private files are deferred.
- A direct Suppliers entry is placed in the Budget flow; no sixth bottom tab is added.
- Juan & Maria remain the canonical demo couple. Supplier names, categories and financial values come from the selected Wedding.

## Deferred physical QA

- Supplier search and filters
- Add/Edit Supplier form ergonomics
- Email, phone and website links
- Currency input
- Commitment editing and clearing
- Long notes
- Linked Budget Item navigation
- Android and iOS layout
