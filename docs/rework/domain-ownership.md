# Domain ownership and change protocol

Agent numbers refer to the [runbooks](../../.agents/agents). Semantic ownership determines behavior; technical write ownership determines who edits a shared contract. Agent 02 is the sole backend writer for authorized migrations/RLS/RPCs/Edge contracts/types, with the named semantic owner's agreement. Agent 00 reserves exact files and contracts before work; no two agents may write the same contract simultaneously.

## Ownership map

| Agent | Domain / permitted client areas | Contract boundary |
| --- | --- | --- |
| 00 | Sequence, dependency graph, ledger, handoffs, release readiness | No feature code; controls reservations and next authorized slice |
| 01 | packages/ui, mobile src/ui, design contracts and visual QA | Tokens/primitives; no business logic or database |
| 02 | supabase migrations/functions/tests; generated database types; shared Attachment and notification infrastructure | Technical backend authority, not unilateral domain semantics |
| 03 | auth, onboarding, workspace restoration, coordinator/team, root navigation, app-level native config | Membership/session/lifecycle/partner acceptance and cache isolation |
| 04 | planning, places, styling, Home summary composition | Tasks/Places/Motif/Dress Code/attire; read Guest/finance summaries only |
| 05 | guests, RSVP/confirmation web routes and RSVP server handler | Household/Guest identity, individual RSVP, Entourage/groups/allowances, invitation authorization and delivery |
| 06 | seating, guests/guest-pass-api.ts and pass tests, pass web page/capsule | Seating/Pass lifecycle; no RSVP or attendance writes |
| 07 | budget, suppliers/payments, budget route tree | Commitment/installment/payment/reversal/receipt/totals separation |
| 08 | website excluding program, Guide/invitation web presentation, future Canva flow | Website/Canva presentation and OAuth semantics; consumes RSVP/Pass/Program contracts |
| 09 | wedding-day, run-of-show, guest-program and their routes | Attendance, operational schedule and explicit guest publication |
| 10 | QA documentation, integration test specifications/harnesses | Reproduce/classify/verify; does not implement feature fixes |

Paths above are relative to apps/mobile/src unless stated otherwise. A domain's tests follow that owner; backend tests follow 02 and integration tests 10. Shared packages/validation, packages/types and utilities are reserved per exported symbol and file by 00; no blanket permission to edit them. Existing .agents/skills/katipan-supabase remains intact. Runbooks are instructions, not automatically registered runtime agents.

## Exact route exceptions and shared files

- Agent 03 owns `app/_layout.tsx`, `app/index.tsx`, access/workspace/coordinator groups, auth callback, invitation acceptance, Wedding root `_layout.tsx`, More and Team. Agent 04 owns the Home route/content; Agent 03 supplies root Back behavior. `workspace/context.tsx`, `api.ts` and `model.ts` are 03; `workspace/home-api.ts` summary composition and `home-screen.tsx` are 04. Reserve the file with 00 if both need a coordinated change.
- Agent 04 owns `plan/*` except `plan/run-of-show/*` (09), plus `places/*`, `style/*`. Planning Timeline is a retained design without a current mobile route; do not claim it is implemented. Notifications & Reminders presentation is 04; delivery/preferences/device infrastructure is 02, with 03 governing account lifecycle.
- Agent 05 owns `guests/*`; 06 owns the pass module/capsule inside the Guest Details composition. The host file remains 05's write reservation; request its edit rather than editing it concurrently. Attire links go to 04 without transferring Guest identity ownership.
- Agent 07 owns actual Supplier routes under `budget/suppliers/*`; older Stitch planned `/suppliers` paths are references, not the current router.
- Agent 08 owns `website/*` except `website/program/*` (09). Web `/w/[slug]` and `/invitation`, shared Guide CSS/navigation and presentation are 08. `/rsvp`, `/rsvp/confirmation`, RSVP mutation handler `/api/w/[slug]/rsvp` and response-specific components are 05. `/pass` is 06. Shared web lib render models must be reserved by consumer boundary; 08 maintains Guide composition, 05 RSVP validation, 06 Pass validation.
- `supabase/functions/_shared/guest_website.ts` combines Guide and RSVP dispatch: 02 writes; 05 approves RSVP semantics and 08 Guide semantics. `guest_guide_places.ts` is 08 projection delivery with 04 Place authority. Guest Program fields belong to 09, Pass fields to 06, and identity/RSVP fields to 05; 08 cannot silently expand those projections.
- `wedding_people` has 05 identity stewardship; 03 owns partner/account linkage workflow. Changes require both semantic owners and 02. Household website-token authorization is 05 even though it was introduced in a website migration. `wedding_invitations` partner/coordinator membership invitations belong to 03 and are not Household RSVP tokens.
- Attachments/Storage are 02 shared infrastructure; 04 styling, 07 receipts and 08 invitation export consume Attachment IDs. Existing `notification-worker`, preferences, outbox and device contracts remain 02 infrastructure; producers require their semantic owner's approval.

## Cross-domain blocker handoff

STOP dependent work -> record blocker in [ledger](rework-ledger.md) -> hand it to the owner -> obtain an agreed contract -> Agent 00 schedules the single writer -> validate producer and consumers -> Agent 10 verifies the gate -> release reservation. Do not modify another agent's domain to unblock yourself.

Record: blocker ID, discovered phase/commit, caller/callee/files, current behavior, required behavior, owning/supporting agents, role/token impact, migration authorization needed, compatibility plan, tests, disposition and next action. Independent authorized tasks may continue. No authority is implied by an agent name or broad directory prefix.

## Stable handoffs

| Producer | Consumers | Required contract |
| --- | --- | --- |
| 03 | all mobile domains | Validated account/Wedding/membership, restore state, cache revision, safe navigation |
| 05 | 04/06/08/09 | Existing Guest/person IDs, individual RSVP, token-scoped Household projection; no duplicated identity |
| 04 | 08/09 | Guest-visible Place context and attire, typed task data; no private notes in Guide |
| 06 | 05/08/09 | Stable Pass lifecycle, sanitized seating visibility, online scan lookup; no RSVP writes |
| 07 | 04/03 | Authorized canonical totals; no client recomputation from duplicated payments |
| 08 | 05/06/09 | Website presentation/publication and secure navigation; artwork export never changes operational state |
| 09 | 08 | Published Guest Program projection; pending operational review kept separate |
| 02 | all | Typed backend contracts, role/lifecycle matrix, constraints, idempotency/error behavior, advisor evidence |

See [screen ownership](stitch-screen-ownership.md) for exactly one primary owner per Stitch entry and collaborators.
