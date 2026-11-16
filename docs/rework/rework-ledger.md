# Rework ledger

Agent 00 maintains this ledger. Updated 2026-11-16 for R0. Status is documentation readiness, not product release readiness.

## Current state

| Field | Value |
| --- | --- |
| Current phase | R0 Foundation |
| Foundation branch/base | chore/v1-rework-foundation from master ee79721 |
| Preserved work | wip/pre-rework-journey-a-20261116 at 4c44a01; pushed and verified during preflight |
| Local state | .codex/config.toml intentionally untouched/unstaged |
| Completed agent slices | R0 architecture/runbooks/audit; no R1–R8 implementation slice completed |
| QA gate status | G0 validation recorded in validation.md; G1–G8 PENDING |
| Release readiness | NOT READY; physical and security/contract gates remain open |
| Next authorized agent | 00 for R0 review/handoff only; proposed next implementation owner 03 at R1 after authorization and 01/02 prerequisite audits |

## Open blockers and pending contract changes

| ID | Owner / support | Phase | Required decision / next action | Status |
| --- | --- | --- | --- | --- |
| C-01 | 06 + 03 / 02 | R4 | Confirm draft Pass management scope without weakening guest-facing active-only access; assess snapshot proposal | OPEN |
| C-02 | 08 + 03 / 02 | R6 | Decide explicit activation then publication versus authorized atomic confirmed publish; preserve lifecycle ownership | OPEN |
| C-03 | 09 + 03 / 02 | R7 | Decide draft Run of Show management separately from active check-in | OPEN |
| C-04 | 08 / 02, 05 | R6 | Approve additive Canva credential/design model, scoped server endpoints and Household QR transfer behavior | PROPOSED, not implemented |
| C-05 | 02 / 03 and each semantic owner | R1–R8 | Disposition 53 security-definer warnings, five private no-policy infos, leaked-password warning and 91 unused-index infos | OPEN; no automatic revocation/drop |
| C-06 | 06 / 02 | R4 | Assess private retrievable qr_token protection and retention without breaking stable re-display | OPEN |
| Q-01 | 10 / domain owners | R1–R8 | Reproduce/verify every Journey A finding in qa-gates.md; snapshot does not close findings | OPEN |
| D-01 | 01 / 08 | R6 | Produce detailed mixed-screen website/artwork design contract; preserve website theme controls | OPEN before UI work |

## Write reservations

| Scope | Single writer | Collaborating review | Release condition |
| --- | --- | --- | --- |
| R0 AGENTS.md, .agents/agents, docs/rework | Foundation author under 00 scope | 01 design, 02 backend, 10 QA responsibilities represented by runbooks; no claim of separate agent review | R0 PR handoff |
| Product code, migrations, Edge implementations, DEV | None authorized in R0 | Domain owners for future proposals only | New phase authorization and gate prerequisites |

Before a new slice add exact files/exported contracts, owner, branch, start, release condition and dependencies. Shared-file changes require a single reservation even if several semantic owners review. Add completed slice commit/evidence links and update the next authorized agent only after Agent 10's gate verdict.
