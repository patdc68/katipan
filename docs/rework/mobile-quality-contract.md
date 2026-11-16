# Shared mobile quality contract

Mandatory for Agents 03–09. Agent 01 reviews visual/platform adaptations; Agent 03 owns root navigation/session mechanics; Agent 10 verifies behavior. These requirements override historical notes that allowed unverified physical QA to pass a rework gate.

## Navigation

Visible bottom tabs, in order: **Home, Plan, Guests, Budget, More**. Feature routes remain nested stacks and must not become tabs. Agent 03 owns the root layout and canonical route/history contract; feature owners own their nested stack. A nested screen requires a visible Back affordance unless its design contract defines another safe model. Specify both in-app Back and system/gesture Back targets, including deep links with no history and unsaved changes. Do not hardcode every Back to Home.

Authenticated root Android Back must never reveal Sign In. Authentication success and restored-session entry must replace obsolete auth history. Root Back behavior is implemented by Agent 03 and verified after login, cold start, foreground resume, Wedding switch, and invitation acceptance. An implementation choice such as exit behavior must be reviewed against native expectations rather than copied from the WIP snapshot without testing.

## Keyboard

Focused fields and validation/submit actions must remain reachable above the keyboard. Use shared scrolling, safe area, and keyboard avoidance primitives, with one owner for app-level native configuration. Test numeric amounts, date selection, multiline notes, long forms, and document forms on Android and iOS. Check small screens, large text, keyboard open/close, landscape where supported, validation focus, picker cancel, and return from background. Date-only values retain calendar semantics across time zones. An Expo export cannot prove keyboard layout or native picker availability.

## Loading

Model restoring session, restoring memberships, loading Wedding data, ready, empty, unauthorized, unavailable, and retryable error separately. Do not show “Wedding workspace unavailable” while authoritative restoration is in progress. Superseded account/Wedding requests must not commit; a new request cannot be cleared by an old request's finally handler. A failed refresh is not evidence of revoked membership; confirmed removal must invalidate access. Define retry and cancellation in the screen contract.

## Errors

Do not label transient loading or network races as authorization failures. Safe messages must not leak SQL, RPC internals, secrets, personal records, or raw provider responses. Preserve user input on retryable errors. Ambiguous writes require authoritative reconciliation before retry: use supported idempotency keys, and never assume every RPC is idempotent. Distinguish empty results from failed reads.

## Permissions

UI checks are advisory. RLS and RPC authorization are authoritative. Resolve every route ID against the active Wedding and authorized record set. Do not substitute service credentials, user-editable metadata, or permissive policies for a broken UI flow. Role and lifecycle behavior must be agreed with Agent 02 before implementation.

## Cache isolation

Invalidate Wedding-scoped state on Wedding switch, sign-out, confirmed membership loss, or account change. Include account, Wedding, and validated membership/cache revision in async ownership. Old responses may not render or mutate a new context. Persisted selection is convenience only and must be revalidated. Offline attendance queues must never replay under another account/Wedding; retain pending work securely and require reauthorization or explicit disposition. Raw invitation and pass tokens never enter logs, analytics, general persistent caches, or unrelated outgoing links.

## Acceptance evidence

Each slice supplies route/Back targets, loading/error/empty screenshots, device and OS/build/commit, keyboard and accessibility results, and role/isolation tests. Agent 01 records DESIGN_REQUIRED, DESIGN_OPTIONAL, PLATFORM_ADAPTATION, BACKEND_CONSTRAINT, or SUPERSEDED_BY_CANVA per decision. Missing physical evidence means a gate is PENDING, not PASS. See [QA gates](qa-gates.md).
