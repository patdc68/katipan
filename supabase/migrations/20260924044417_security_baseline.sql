begin;

revoke create on schema public
from public, anon, authenticated, service_role;

grant usage on schema public
to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete
  on tables
  from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select
  on sequences
  from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute
  on functions
  from anon, authenticated, service_role;

alter default privileges for role postgres
  revoke execute
  on functions
  from public;

create schema if not exists private authorization postgres;

revoke all on schema private
from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke all on tables
  from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke all on sequences
  from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke execute on functions
  from public, anon, authenticated, service_role;

comment on schema private is
  'Non-exposed KATIPAN implementation objects. Privileged functions must use a locked search_path, fully qualified object references, explicit auth checks, and explicit EXECUTE grants.';

commit;
