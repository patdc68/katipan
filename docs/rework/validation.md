# R0 validation evidence

Date: 2026-11-16. Base: master `ee79721`. Scope: AGENTS.md, 11 runbooks and rework documents only. No product implementation, schema, migration or Edge implementation changes. Local .codex/config.toml is excluded and its original content hash is preserved.

| Check | Result |
| --- | --- |
| Git preflight | Only intentional local config at start; correct foundation branch; no staged work |
| Live DEV audit | Project-scoped MCP URL, 22 migrations, catalog definitions/grants, Edge inventory and both advisors read successfully; no writes |
| Stitch | 67 live entries: 61 UI + 6 assets; complete primary-owner map; mixed invitation/website HTML inspected |
| Markdown/link/contract sanity | PASS: 22 Markdown files; 11 runbooks with 12 required headings each; relative links; 67 unique primary-owned Stitch entries; 26 exclusive audit rows; balanced fences |
| npm.cmd run lint | PASS: mobile Expo lint and web ESLint |
| npm.cmd run typecheck | PASS: all configured workspaces |
| npm.cmd test -- --reporter=dot | PASS: 46 files, 362 tests |
| git diff --check | PASS; repeated after final documentation edits |
| Changed-file secret-pattern scan | PASS: all 22 documentation files scanned for private keys, GitHub/Supabase secret shapes, Google keys, JWTs and credentialed database URLs; no matches |

No configured Markdown checker was found; a local sanity check validates relative links, required runbook headings/handoff fields, unique Stitch IDs/owners, code fence balance and matrix decisions. External Canva/Supabase documentation was checked during the architecture audit; no claim of exhaustive external-link crawling.

Tests reflect the master base: the six extra tests in preserved snapshot 4c44a01 are not imported. SQL/pgTAP, Deno Edge, native builds, device QA and deployments were not run in this documentation-only task. Future gates require those relevant checks; existing advisor warnings and Journey A findings remain open. See the [ledger](rework-ledger.md) and [audit](supabase-contract-audit.md).
