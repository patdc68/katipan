# R1 Stitch design contract

Status: **Agent 01 complete — prerequisite for Agent 03**
Project: **Katipan Wedding Planner UI System** (`13691899610292683671`)
Design system: **Warm Editorial Nuptial** (`assets/abc9492ec46641418007fbb73b75456e`)
Inspected: 2026-11-16

This contract records the reference for R1 Core Workspace implementation. It is not a visual acceptance result. Agent 03 owns the reserved Core Workspace routes and must follow it; Agent 10 verifies the implemented behavior. The R1 Supabase contract is documented in [the Agent 02 audit](supabase-contract-audit.md).

## Stitch evidence

`get_project`, `list_design_systems`, and `list_screens` returned 61 DESIGN screens and 6 IMAGE assets for the project. The 21 R1-related screens listed below were retrieved through Stitch `download_file`; both their screenshot and HTML payloads were inspected. Some Stitch responses omitted screenshot dimensions, but their image payloads were available and visually inspected. All six project IMAGE entries were also downloaded and inspected. No image or HTML asset was written into the repository.

The mapped inventory contains **no dedicated Sign In, Sign Up, email-verification, or invitation-acceptance screen**. Reuse the existing Warm Editorial access layout and form components, using the Welcome and onboarding screens below as the nearest references. This is a screen gap, not authority to invent another auth or partner-join flow.

| Screen | Stitch ID | Screenshot | HTML | R1 reference |
| --- | --- | :---: | :---: | --- |
| Welcome to Katipan | `40853f07b29042cdb22c49d5bd778dd4` | Inspected | Inspected | Signed-out entry and nearest auth baseline |
| Create Our Wedding | `d53e9d8d88584c57b5e9999fe1f2fe48` | Inspected | Inspected | Onboarding introduction and invitation entry point |
| Couple & Wedding Details | `f12a02d5acfa435f97c8263961825b61` | Inspected | Inspected | Couple setup form and progress treatment |
| Invite My Katipan | `586c03b4559547ff994754a861b689ce` | Inspected | Inspected | Partner invitation step; not invitation artwork |
| Wedding Motif & Onboarding Complete | `cc9eb4285dd846fea49152bcc8c4f6e6` | Inspected | Inspected | Onboarding completion and workspace handoff; motif feature remains owned separately |
| My Weddings | `9df96942a14c4734849671e04b4be370` | Inspected | Inspected | Portfolio list variant and Coordinator Mode navigation |
| Enhanced My Weddings | `9f449d0690074bb0bcb0875d288b24a3` | Inspected | Inspected | Preferred workspace/portfolio list treatment per the screen map |
| Coordinator Onboarding | `a7970cf399a44499b12d921b316d9db1` | Inspected | Inspected | Coordinator entry and portfolio path |
| Create Client Wedding | `2689ca94563540339ca1edbd62884161` | Inspected | Inspected | Client Wedding setup and identity-preserving handoff |
| Invite Couple to Katipan / Ownership Transition | `72c44d6876884247826048a2bb72f789` | Inspected | Inspected | Existing-person invitation and lifecycle explanation |
| Coordinator Wedding Overview | `d99ee81c2e8743ce99a87253259dcc35` | Inspected | Inspected | Shared coordinator overview variant |
| Coordinator-Managed Wedding Overview | `4753b63a91304fac884ec6debf7681c5` | Inspected | Inspected | Coordinator-created Wedding before couple acceptance |
| More / Settings Hub | `8275da0c147c4648a73cb2e8851e54db` | Inspected | Inspected | Active Wedding card, switch action, account actions, Couple tabs |
| Wedding Team & Coordinator Access | `1f25d64a13e74969a684fb476c593388` | Inspected | Inspected | Member roles, coordinator invitation sheet, visible Back |
| Wedding Access & Ownership | `920e8f16f2ea4434b4b22dde8f086e83` | Inspected | Inspected | Owner/coordinator access and lifecycle presentation |
| Privacy & Guest Visibility | `2660bcece31b4b8f89ed4b9c361be0d6` | Inspected | Inspected | Read for the More/access boundary only; Website/Seating edits are out of R1 |
| Home Dashboard | `1a677a73dfc74f658dba3bb5e1254615` | Inspected | Inspected | Couple tab shell; Home content remains Agent 04-owned |
| Plan Home | `b6d0688030cc4acabf230818ba872d3c` | Inspected | Inspected | Shared Couple tab bar; Plan content is out of R1 |
| Guests Home | `db3b28b46d7b4d44a4b6574e8367471c` | Inspected | Inspected | Shared Couple tab bar; Guest content is out of R1 |
| Budget Dashboard (variant A) | `9b1a1de7722f49fa948b5b90a90fb384` | Inspected | Inspected | Shared Couple tab bar; finance content is out of R1 |
| Budget Dashboard (variant B) | `9bd119aa583c4d15a03ddc4b64fefbf0` | Inspected | Inspected | Shared Couple tab bar; finance content is out of R1 |

### Project IMAGE entries inspected

| Asset | Stitch ID | Inspection |
| --- | --- | --- |
| Katipan Interlocking Rings Brandmark | `3dfbe2a0e4344cc786ec71c3b04a439d` | Downloaded and inspected; Warm Editorial logo reference |
| Modern intimate beach wedding setup | `fbd7c40da2134e85858ea790d98580a9` | Downloaded and inspected; editorial venue photo reference |
| Romantic warm wedding-planning flatlay | `c6e13256bc99425b85a5b6591f523329` | Downloaded and inspected; stationery/photo reference |
| Full-length Filipino couple portrait | `d54ca987052b4c8d9ac039d04b850bbb` | Downloaded and inspected; Welcome/onboarding photo reference |
| Open-air garden wedding pavilion | `00b48f1476dc4156bd36a1c9279a2a42` | Downloaded and inspected; coordinator/venue photo reference |
| Close-up Filipino couple portrait | `4608062ebe1e4685ab1f8ea1dced6576` | Downloaded and inspected; Home hero photo reference |

## Shared Warm Editorial rules

- **Hierarchy — DESIGN_REQUIRED:** Use Playfair Display for the editorial screen and section headings; Plus Jakarta Sans for body copy, labels, forms, and operational details. Keep compact uppercase micro-labels subordinate to a legible serif heading. Do not make every data label editorial.
- **Color — DESIGN_REQUIRED:** Actual inspected screens use a warm ivory canvas (`#FFF8F5`), espresso text (`#1E1B19`), soft warm surfaces (`#FAF2EE`, white), sage primary actions (`#60725A`), structured primary semantic (`#485943`), and restrained gold accents (`#775A19` / editorial `#C5A059`). Keep structured roles intact; the source-of-truth records that the screen's primary button uses prose sage `#60725A`. Do not silently change shared tokens.
- **Spacing and shapes — DESIGN_REQUIRED:** Keep the 20 px mobile page margin, the 4/8/16/24/36 px rhythm, generous 20–24 px card interiors, 16–24 px editorial card corners, 12 px form controls, and capsule primary buttons. Preserve the calm page cadence and rounded tonal layers from the screenshots.
- **Imagery — DESIGN_OPTIONAL:** Retain a warm Filipino wedding photo as a deliberate hero or card, with a soft overlay when text sits on it. Images are presentation only; sample couples, dates, locations, guest counts, roles, budgets, and Wedding IDs in Stitch are not production values.
- **Content density — DESIGN_REQUIRED:** Group related setup fields and workspace choices into clear cards. Use short labels, explanatory copy below the action it clarifies, and one clearly dominant CTA per step. Secondary choices stay visually quieter.
- **No screen redesign:** Use existing reusable mobile primitives (`KatipanScreen`, `KatipanText`, `KatipanButton`, `EditorialCard`, `FormField`, `LoadingState`, `EmptyState`, `ErrorState`) where they fit. HTML is visual evidence, not source code to port.

## Navigation contract

### Couple workspace

The Couple root has exactly five bottom tabs, in this order: **Home, Plan, Guests, Budget, More**. The Home, Plan, Guests, Budget, and More screenshots all show that shared tab bar. It is visible only at root tabs. Feature detail, onboarding, team, access, and invitation routes belong to nested stacks; their leaf routes must never become tabs.

When the signed-out user authenticates or a saved session restores, replace obsolete auth/onboarding history with the appropriate authenticated destination. The Wedding Home stack must not sit above a Sign In route that Android Back can reveal. An account with no authoritative Wedding membership receives the My Weddings/onboarding empty route. A valid single Wedding can open its workspace directly; multiple Weddings use My Weddings with a validated selected Wedding.

### Coordinator workspace variant

The Stitch map contains a distinct Coordinator Mode portfolio and coordinator-managed Wedding overview. The portfolio reference uses **Weddings / Schedule / Attention / More**; coordinator Wedding overviews show **Overview / Plan / Guests / Day / More**. Keep these only in their Coordinator branch and preserve their existing mapped presentation. They do not replace or leak into the Couple's five canonical tabs. R1 only needs reliable list, selection, restore, and entry; it does not redesign coordinator portfolio features or implement those feature tabs.

The screen map prefers Enhanced My Weddings (`9f449d…`) for the later list treatment and keeps My Weddings (`9df969…`) as a separate reference variant. It retains both Coordinator Overview variants. Use the Coordinator-Managed variant only for an existing coordinator-managed Wedding context; do not infer a new role or ownership permission from the design title.

### Back behavior — DESIGN_REQUIRED / PLATFORM_ADAPTATION

- A tab root has no visible Back control. At authenticated Home root, Android Back stays on the authenticated root or exits/minimizes according to native behavior; it must never expose Sign In.
- A nested screen that has a prior valid in-app route shows a visible leading Back affordance consistent with the references. Visible Back and Android system/gesture Back return to the same valid prior authenticated route.
- A deep link with no safe history returns to its authenticated parent/root, not a stale access route. Do not hardcode every nested Back to Home.
- During a form, keep the visible back/cancel affordance reachable above the keyboard. Preserve existing unsaved-change behavior; this design contract does not invent a new confirmation flow.
- Root-history replacement and Android Back handling are platform mechanics; use native-safe behavior and verify on device. The screenshots do not define how Android exits an app.

## Shared workspace states

Stitch has no separate loading, empty, recoverable-error, membership-lost, or authorization-state screens. These states reuse the existing Warm Editorial shell and semantic state components; treat the following state names and differences as `BACKEND_CONSTRAINT` where they affect access.

| State | Visual treatment and transition |
| --- | --- |
| Auth/session loading | A deliberate full-page `LoadingState` on the warm canvas. Keep it visible while the authoritative session is unresolved. Do not flash Welcome or an unavailable message. |
| Authenticated workspace/membership loading | Keep the authenticated shell in loading state until memberships and the selected Wedding are authoritatively revalidated. An old Wedding label or feature card must not be presented as the new selection while resolving. |
| Ready | Render the existing screen hierarchy with the validated account, membership, Wedding, and role. A DRAFT Wedding with an ACTIVE membership remains a valid workspace; a lifecycle chip may say “Draft.” |
| Empty — no accessible Weddings | Show `EmptyState` in the My Weddings composition with concise next actions for creating a Couple Wedding, starting a client Wedding when eligible, or opening a received invitation. Empty results are not an error. |
| Recoverable network/server error | Show `ErrorState` with a retry action in the existing screen shell. Do not convert a failed refresh into membership loss; preserve the user's screen context and same-account last-verified presentation if the domain contract allows it. |
| Confirmed membership lost / unauthorized | Only after authoritative membership resolution, clear the selected Wedding and its private presentation, then route to My Weddings or signed-out Welcome as appropriate. Use a calm explanation; do not label an unresolved read “unavailable.” |
| Wedding switch | The More active-Wedding card and My Weddings entries are the visual switch points. Show an intentional busy/loading state while the target membership is revalidated. Reveal the new Wedding only after resolution; never show Wedding A data under Wedding B. |
| Sign out / account change | Clear the selected Wedding and session-scoped visual state before showing Welcome. Do not render the previous account's Wedding title or cache while the next account restores. |

`Wedding unavailable` must not stand in for pending restoration or a recoverable network error. No Wedding is an explicit empty state; unauthorized is a confirmed membership result. DRAFT/ACTIVE/COMPLETED/ARCHIVED lifecycle is separate from membership status (Agent 02 verified that active membership policies do not require an ACTIVE Wedding).

## R1 screen contracts

| Screen / ID | Hierarchy, typography, spacing, colors, cards | Primary actions and navigation | Loading / error / empty / keyboard / accessibility |
| --- | --- | --- | --- |
| **Welcome to Katipan** `40853f…` | Full-width warm couple hero, brandmark, centered Playfair promise, sans-serif supporting paragraph, two strong lower actions, warm ivory background. | Create Account is primary; Sign In is secondary. It is signed-out entry, not a tab. | Auth submission stays in place with a visible error/success message. Label fields and password visibility. Safe-area scroll if content exceeds a short screen. |
| **Create Our Wedding** `d53e9…` | Intro heading and copy, featured stationery photo, explanatory benefit cards, then one full-width primary action. Serif headline, sans body, gold/sage icon chips. | Leading Back to Welcome; Start Planning primary; invitation link is a secondary path into acceptance. | Keep the two paths distinct and reachable. No new wedding is created from the invitation link. Keyboard is not open on the intro. |
| **Couple & Wedding Details** `f12a…` | Step counter and progress bar; grouped couple, date, location, guest-count, and optional budget cards. Serif step headline; sans labels/values; form rows are soft-filled. | Continue primary; Skip for now secondary where already supported; visible Back returns to prior onboarding step. | Scroll and keyboard-avoidance are required; focused field and Continue stay reachable. Associate each label/helper/error with its field; don't rely on selected color alone. |
| **Invite My Katipan** `586c…` | Step 3 of onboarding, editorial title and couple image, short benefit cards, email entry card, pending-invitation status panel. | Send Invitation & Continue primary; Invite Later secondary. Link-based acceptance continues through the existing acceptance route. | Email keyboard must not cover the send action. Show pending/expired/retry feedback inline and never expose a raw invitation token. No duplicate person is created on acceptance. |
| **Wedding Motif & Onboarding Complete** `cc9e…` | Progress at completion, preview card, palette options, cover-photo card, completion summary and one final CTA. | Go to My Wedding Dashboard hands off to validated workspace root. | R1 owns the onboarding handoff only. Motif/palette/photo feature behavior stays with its domain; don't expand it as part of workspace restoration. Preserve safe-area access to the final CTA. |
| **My Weddings** `9df9…` | Portfolio list with search/filter chips, attention card, wedding cards with role/status tags, active-profile/switch panel. The actual image shows a Coordinator Mode variant. | Wedding card opens the validated selected workspace. Coordinator-only schedule/attention links remain in that branch. | Empty list uses the shared EmptyState. Search/filter controls need accessible labels and selected states. Loading and refresh errors use shared semantics. |
| **Enhanced My Weddings** `9f44…` | More developed portfolio console: create-client entry, summary metrics, search/filter, attention cards, large Wedding portfolio cards, context switch panel. | New Wedding for an eligible coordinator; each card opens its existing Wedding; switch panel changes context. | Use live membership rows, not Stitch's sample metrics or Wedding details. Busy state is attached to the selected card/switch action; no stale card data during account changes. |
| **Coordinator Onboarding** `a797…` | Coordinator title/photo, profile fields in a card, clear two-step progression, separate invitation and portfolio paths. | Continue to My Weddings for portfolio; received invitation follows invitation acceptance. | Form keyboard/safe-area rules apply. Optional coordinator profile fields remain optional. Do not make business registration, CRM, or marketplace features mandatory. |
| **Create Client Wedding** `2689…` | Couple identity fields, Wedding details card, optional internal notes card, explanatory handoff card, primary create and secondary cancel. | Create Client Wedding creates one coordinator-managed Wedding through the existing contract; Cancel returns to prior coordinator route. | Keep validation errors close to fields. Invitation is a later explicit action. Existing Person/Wedding identity and current backend role transition govern all text/labels. |
| **Invite Couple to Katipan / Ownership Transition** `72c4…` | Existing Wedding summary; Partner cards separated by person; lifecycle diagram and transition assurances; compact hierarchy with one overall CTA and per-person action. | Each existing Partner can be invited/accept independently. Close/back returns to the same Wedding overview. | Keep outcome text aligned with the audited RPC: first client acceptance links the existing Person, preserves Wedding ID/data, makes that client OWNER and leaves coordinator FULL_COORDINATOR; the second Partner joins separately. No token in UI logs. |
| **Coordinator Wedding Overview** `d99e…` | Overview hero, role chip, grouped status cards, attention list, milestones, quick links; coordinator-specific tabs along bottom. | Back to My Weddings; tab/quick link goes to its existing feature route. | In R1 only workspace identity, role, selected Wedding, and entry are in scope. Feature summaries/actions are not rewritten here. |
| **Coordinator-Managed Wedding Overview** `4753…` | Wedding image/header with Coordinator-managed state, client-not-on-Katipan tag, explanatory handoff card, live-summary cards, invite CTA, coordinator-specific tabs. | Invite Couple uses existing partner invitation route; Keep Planning remains in this same Wedding. | `BACKEND_CONSTRAINT`: coordinator-managed means valid accessible Wedding membership; later client acceptance never creates a clone. Do not show no-membership/unavailable because the Wedding is DRAFT. |
| **More / Settings Hub** `8275…` | Header, active Wedding card with date/role, obvious Switch Wedding control, grouped Wedding Settings, shortcuts, account rows, sign-out action; Couple tab bar remains visible. | Switch Wedding opens My Weddings/selection; Team and Access remain workspace destinations; Sign Out clears workspace before Welcome. | The active card must reflect the currently validated Wedding. Keep settings links to other domains as existing routes; don't rewrite their destination screens. Label icon-only search/profile controls. |
| **Wedding Team & Coordinator Access** `1f25…` | Visible title and Back, couple ownership explanation, separate Owner and Coordinator lists, invitation sheet with role choices. | Back to originating More/Team route; invitation sheet has clear cancel and send actions. | Labels must use only OWNER/FULL_COORDINATOR/DAY_OF_COORDINATOR/GUEST_COORDINATOR. `BACKEND_CONSTRAINT`: the screenshot's “Primary Account” wording is not a fifth role; never introduce `PRIMARY_OWNER`. Role choice and invitation outcome are server-authoritative. |
| **Wedding Access & Ownership** `920e…` | Access title, owner/member summary, coordinator roles, lifecycle cards, clear danger-zone grouping. | Back returns to More; member/ownership operations use existing transaction-safe route/RPC contracts. | Archive/delete/leave remain explicit, confirmed lifecycle operations; don't infer authorization from presentation. State changes refresh memberships before showing the outcome. Never relabel DRAFT membership as invalid. |
| **Privacy & Guest Visibility** `2660…` | Wedding Website access, section audience, seating visibility, RSVP privacy, private-data explainer and save CTA. | Back returns to More. | Read only to establish the More/access boundary. `BACKEND_CONSTRAINT`: Website audiences belong to Agent 08 and seating visibility to Agent 06; R1 must not edit or reimplement this screen or its domain behavior. |
| **Home Dashboard** `1a67…` | Couple hero photo/countdown, planning summary card, priorities, guest/seating and places summaries, editorial cards; Couple tabs visible. | Home tab root. More/account/workspace switching remains reachable through the shared shell. | Agent 04 owns content; Agent 03 owns only session/root Back integration. Do not alter Home feature composition under this reservation. |
| **Plan Home** `b6d0…` | Planning headline, category chips, checklist progress, timeline/place/creative cards; same Couple tab bar. | Plan tab root. | Agent 04 owns screen behavior; R1 checks only that changing tabs preserves the selected Wedding and shell. |
| **Guests Home** `db3b…` | Guest summary, Guest List, entourage, seating and check-in cards; same Couple tab bar. | Guests tab root. | Agent 05/06/09 behavior remains out of scope. R1 checks only stable workspace context/navigation. |
| **Budget Dashboard** `9b1a…`, `9bd1…` | Two distinct treasury layouts with serif amount/headings, sans operational labels and warm progress/card surfaces; both show the same Couple tab bar. | Budget tab root. | Agent 07 owns finance presentation and data. R1 does not choose/rewrite its feature variant; preserve workspace/tab stability only. |

## Accessibility and safe-area adaptation

- **PLATFORM_ADAPTATION:** Apply top/bottom safe-area insets to the page shell, sticky actions, and tab bar. Keep the 20 px content margin inside the inset; do not let an action overlap Android navigation or the keyboard.
- **PLATFORM_ADAPTATION:** Use scrollable forms with keyboard avoidance; keep focused controls, validation copy, visible Back/Cancel, and primary submit reachable at small sizes and large text. Preserve date-only calendar semantics.
- **PLATFORM_ADAPTATION:** Give every icon-only control an accessible name, selected tabs/filters a selected state, asynchronous progress a busy announcement, and errors an alert role. Provide at least 44 dp interactive targets and sufficient contrast; pair colored status with text/icon.
- **PLATFORM_ADAPTATION:** Support Dynamic Type/font scaling without truncating names, Wedding labels, role labels, or CTA text. Let controls and cards grow vertically rather than forcing one-line summaries.
- **PLATFORM_ADAPTATION:** Respect reduced-motion and native back/gesture behavior. Visual Back and system Back must not dispatch two pops or bypass unsaved changes.

## Intentional adaptations and scope boundaries

| Decision | Label | Contract |
| --- | --- | --- |
| No separate Stitch Sign In, Sign Up, verification, or acceptance screens | DESIGN_OPTIONAL / PLATFORM_ADAPTATION | Reuse the Warm Editorial Welcome/onboarding shell and existing field/button primitives. Do not add a new auth method or acceptance workflow. |
| Separate coordinator portfolio/overview navigation | DESIGN_REQUIRED | Preserve the coordinator-only variants shown by Stitch inside the coordinator branch. The Couple tabs stay exactly Home, Plan, Guests, Budget, More. Nested routes stay out of both tab bars. |
| “Primary Account” wording on Team reference | BACKEND_CONSTRAINT | Use the audited membership roles; there is no PRIMARY_OWNER role. |
| Privacy & Guest Visibility composition | BACKEND_CONSTRAINT | Website and seating controls remain owned by later feature domains. R1 preserves only the More/workspace navigation boundary. |
| Workspace loading/empty/error/unauthorized states | BACKEND_CONSTRAINT / PLATFORM_ADAPTATION | The screens were not present in Stitch. Use shared semantic state components and the distinctions above without implying unauthorized during unresolved restoration. |
| Stitch examples show personal names, sample Wedding dates/IDs and fabricated summary counts | DESIGN_OPTIONAL / BACKEND_CONSTRAINT | Treat all as visual sample content. Hydrate the selected account's real authorized data; never hardcode examples into production logic. |

**Agent 01 handoff:** The 21 R1-related screens and six image entries were retrieved and inspected; the two My Weddings variants, both Coordinator Overview variants, both Budget variants, and role-specific navigation are documented. No Stitch asset retrieval blocker remains. Agent 03 may begin only after Agent 00 records this handoff alongside Agent 02's KEEP/no-migration audit.
