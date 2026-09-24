# KATIPAN Supabase/Codex Setup

1. Copy these files into the repository root.
2. Trust the repository in Codex if prompted.
3. Restart Codex so project config and repo skills reload.
4. Run:

   `codex mcp login supabase`

5. Complete the Supabase OAuth flow and select the organization containing project ref:

   `fslwqgfuzzgsshkotfpn`

6. Verify:

   `codex mcp list`

7. First safe prompt:

   > Use the Supabase MCP and inspect the connected KATIPAN project. List existing public tables, migrations, extensions, edge functions, storage buckets, and security/performance advisor findings. Do not modify anything.

8. If that succeeds, you may change `required = false` to `required = true` in `.codex/config.toml`.

Do not begin schema implementation until the inspection succeeds.
