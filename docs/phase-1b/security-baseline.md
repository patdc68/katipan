# Proposed `security_baseline` migration

This is a reviewed migration plan, not an applied migration. It intentionally creates no application tables and changes no Supabase-managed schema or object.

## Exact proposed SQL

```sql
begin;

-- `public` remains the application-facing Data API schema. Schema usage does
-- not expose an object by itself; every table/function still requires an
-- explicit object grant in the migration that creates it.
revoke create on schema public from public, anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- KATIPAN migrations are owned by `postgres`. Change defaults for that owner
-- only so Supabase-managed owners and objects are not altered.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

-- Private implementation details and narrowly justified privileged helpers
-- live outside the Data API schemas.
create schema if not exists private authorization postgres;
revoke all on schema private from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke all on tables from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke all on sequences from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated, service_role;

comment on schema private is
  'Non-exposed KATIPAN implementation objects. Privileged functions must set search_path to an empty string, fully qualify referenced objects, verify auth.uid(), and receive explicit EXECUTE grants.';

commit;
```

## Conventions enforced in subsequent migrations

- Every application table in an exposed schema enables RLS in the same migration that creates it.
- Grants control whether `anon`, `authenticated`, or `service_role` can reach an object; RLS controls which rows are accessible.
- `authenticated` policies always include wedding membership/capability predicates. Authentication alone is not authorization.
- Update policies include a matching select policy plus both `using` and `with check` expressions.
- Policy predicates use indexed columns and wrap stable request helpers such as `auth.uid()` in `select` where appropriate.
- Views exposed through the Data API use `security_invoker = true` or are replaced with controlled projections.
- New functions receive no implicit client execution. Each callable function gets a deliberate signature-specific `grant execute`.
- `security definer` is exceptional. Any approved privileged function belongs in `private`, uses `set search_path = ''`, fully qualifies every object, validates the caller with `auth.uid()`, and revokes execution from `public`, `anon`, `authenticated`, and `service_role` before granting only the intended role/signature.
- Migrations do not alter objects in `auth`, `storage`, `realtime`, `vault`, or other Supabase-managed schemas.
