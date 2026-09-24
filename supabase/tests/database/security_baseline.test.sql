begin;

set local role postgres;

select plan(26);

create table public.__security_baseline_table_test (
  id bigint primary key
);

create sequence public.__security_baseline_sequence_test;

create function public.__security_baseline_function_test()
returns integer
language sql
as $function$
  select 1
$function$;

create table private.__security_baseline_private_test (
  id bigint primary key
);

select ok(
  not has_schema_privilege('anon', 'public', 'CREATE'),
  'anon cannot create objects in the public schema'
);

select ok(
  not has_schema_privilege('authenticated', 'public', 'CREATE'),
  'authenticated cannot create objects in the public schema'
);

select ok(
  not has_table_privilege('anon', 'public.__security_baseline_table_test', 'SELECT'),
  'anon is not automatically granted SELECT on new public tables'
);

select ok(
  not has_table_privilege('anon', 'public.__security_baseline_table_test', 'INSERT'),
  'anon is not automatically granted INSERT on new public tables'
);

select ok(
  not has_table_privilege('anon', 'public.__security_baseline_table_test', 'UPDATE'),
  'anon is not automatically granted UPDATE on new public tables'
);

select ok(
  not has_table_privilege('anon', 'public.__security_baseline_table_test', 'DELETE'),
  'anon is not automatically granted DELETE on new public tables'
);

select ok(
  not has_table_privilege('authenticated', 'public.__security_baseline_table_test', 'SELECT'),
  'authenticated is not automatically granted SELECT on new public tables'
);

select ok(
  not has_table_privilege('authenticated', 'public.__security_baseline_table_test', 'INSERT'),
  'authenticated is not automatically granted INSERT on new public tables'
);

select ok(
  not has_table_privilege('authenticated', 'public.__security_baseline_table_test', 'UPDATE'),
  'authenticated is not automatically granted UPDATE on new public tables'
);

select ok(
  not has_table_privilege('authenticated', 'public.__security_baseline_table_test', 'DELETE'),
  'authenticated is not automatically granted DELETE on new public tables'
);

select ok(
  not exists (
    select 1
    from pg_proc as procedure
    cross join lateral aclexplode(
      coalesce(procedure.proacl, acldefault('f', procedure.proowner))
    ) as expanded_acl
    where procedure.oid = 'public.__security_baseline_function_test()'::regprocedure
      and expanded_acl.grantee = 0
      and expanded_acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC is not automatically granted EXECUTE on new public functions'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.__security_baseline_function_test()',
    'EXECUTE'
  ),
  'anon is not automatically granted EXECUTE on new public functions'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.__security_baseline_function_test()',
    'EXECUTE'
  ),
  'authenticated is not automatically granted EXECUTE on new public functions'
);

select ok(
  not has_sequence_privilege(
    'anon',
    'public.__security_baseline_sequence_test',
    'USAGE'
  ),
  'anon is not automatically granted USAGE on new public sequences'
);

select ok(
  not has_sequence_privilege(
    'anon',
    'public.__security_baseline_sequence_test',
    'SELECT'
  ),
  'anon is not automatically granted SELECT on new public sequences'
);

select ok(
  not has_sequence_privilege(
    'authenticated',
    'public.__security_baseline_sequence_test',
    'USAGE'
  ),
  'authenticated is not automatically granted USAGE on new public sequences'
);

select ok(
  not has_sequence_privilege(
    'authenticated',
    'public.__security_baseline_sequence_test',
    'SELECT'
  ),
  'authenticated is not automatically granted SELECT on new public sequences'
);

select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon cannot use the private schema'
);

select ok(
  not has_schema_privilege('anon', 'private', 'CREATE'),
  'anon cannot create objects in the private schema'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated cannot use the private schema'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'CREATE'),
  'authenticated cannot create objects in the private schema'
);

select ok(
  has_schema_privilege('service_role', 'public', 'USAGE'),
  'service_role retains USAGE on the exposed public schema'
);

select ok(
  (
    select rolbypassrls
    from pg_roles
    where rolname = 'service_role'
  ),
  'service_role retains BYPASSRLS'
);

select ok(
  exists (select 1 from pg_namespace where nspname = 'auth'),
  'the Supabase-managed auth schema remains available'
);

select ok(
  exists (select 1 from pg_namespace where nspname = 'storage'),
  'the Supabase-managed storage schema remains available'
);

select ok(
  exists (select 1 from pg_namespace where nspname = 'realtime'),
  'the Supabase-managed realtime schema remains available'
);

select * from finish();

rollback;
