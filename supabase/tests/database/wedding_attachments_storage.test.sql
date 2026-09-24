begin;

set local role postgres;

create extension if not exists pgtap with schema extensions;

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

select extensions.no_plan();

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000201', 'authenticated', 'authenticated', 'attachment-owner-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000202', 'authenticated', 'authenticated', 'attachment-full-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000203', 'authenticated', 'authenticated', 'attachment-day-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000204', 'authenticated', 'authenticated', 'attachment-guest-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000205', 'authenticated', 'authenticated', 'attachment-unrelated@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000206', 'authenticated', 'authenticated', 'attachment-owner-b@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000207', 'authenticated', 'authenticated', 'attachment-controller@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.weddings (
  id,
  origin,
  status,
  ownership_mode,
  created_by_user_id,
  display_name
)
values
  ('10000000-0000-0000-0000-000000000201', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000201', 'Attachment Wedding A'),
  ('10000000-0000-0000-0000-000000000202', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000206', 'Attachment Wedding B'),
  ('10000000-0000-0000-0000-000000000203', 'COORDINATOR_CREATED', 'ACTIVE', 'COORDINATOR_MANAGED', '00000000-0000-0000-0000-000000000207', 'Attachment Controller Wedding');

insert into public.wedding_memberships (
  id,
  wedding_id,
  user_id,
  role
)
values
  ('20000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201', 'OWNER'),
  ('20000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000202', 'FULL_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000203', '10000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000203', 'DAY_OF_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000204', '10000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000204', 'GUEST_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000206', '10000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000206', 'OWNER'),
  ('20000000-0000-0000-0000-000000000207', '10000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000207', 'FULL_COORDINATOR');

set constraints all immediate;

create temporary table attachment_test_state (
  label text primary key,
  attachment_id uuid not null,
  bucket_id text not null,
  object_path text not null
);

grant all on table attachment_test_state to authenticated;

select extensions.is(
  (
    select bucket.public
    from storage.buckets as bucket
    where bucket.id = 'wedding-files'
  ),
  false,
  'wedding-files is private'
);

select extensions.is(
  (select count(*) from storage.buckets),
  1::bigint,
  'No accidental public or secondary bucket exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);

insert into attachment_test_state (label, attachment_id, bucket_id, object_path)
select 'owner-public', reserved.attachment_id, reserved.bucket_id, reserved.object_path
from public.reserve_attachment(
  '10000000-0000-0000-0000-000000000201',
  'photo.jpg',
  'image/jpeg',
  'PUBLIC'
) as reserved;

insert into attachment_test_state (label, attachment_id, bucket_id, object_path)
select 'owner-guest', reserved.attachment_id, reserved.bucket_id, reserved.object_path
from public.reserve_attachment(
  '10000000-0000-0000-0000-000000000201',
  'guide.pdf',
  'application/pdf',
  'GUEST_VISIBLE'
) as reserved;

insert into attachment_test_state (label, attachment_id, bucket_id, object_path)
select 'owner-member', reserved.attachment_id, reserved.bucket_id, reserved.object_path
from public.reserve_attachment(
  '10000000-0000-0000-0000-000000000201',
  'notes.txt',
  'text/plain',
  'WEDDING_MEMBER_PRIVATE'
) as reserved;

insert into attachment_test_state (label, attachment_id, bucket_id, object_path)
select 'owner-private', reserved.attachment_id, reserved.bucket_id, reserved.object_path
from public.reserve_attachment(
  '10000000-0000-0000-0000-000000000201',
  'owner.pdf',
  'application/pdf',
  'OWNER_PRIVATE'
) as reserved;

insert into attachment_test_state (label, attachment_id, bucket_id, object_path)
select 'owner-financial', reserved.attachment_id, reserved.bucket_id, reserved.object_path
from public.reserve_attachment(
  '10000000-0000-0000-0000-000000000201',
  'finance.pdf',
  'application/pdf',
  'FINANCIAL_PRIVATE'
) as reserved;

select extensions.is(
  (
    select count(*)
    from attachment_test_state
    where object_path ~ ('^weddings/10000000-0000-0000-0000-000000000201/' || attachment_id::text || '/[0-9a-f]{64}$')
      and bucket_id = 'wedding-files'
  ),
  5::bigint,
  'Owner reservations use the fixed bucket and opaque Wedding/Attachment/random path'
);

select extensions.throws_ok(
  $$
    insert into public.attachments (
      wedding_id,
      uploaded_by_user_id,
      object_path,
      original_filename,
      content_type,
      visibility
    )
    values (
      '10000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000201',
      'arbitrary',
      'arbitrary.txt',
      'text/plain',
      'PUBLIC'
    )
  $$,
  '42501',
  null,
  'Authenticated users cannot bypass reservation with direct metadata INSERT'
);

select extensions.throws_ok(
  $$
    update public.attachments
    set object_path = 'substituted'
    where id = (select attachment_id from attachment_test_state where label = 'owner-public')
  $$,
  '42501',
  null,
  'Authenticated users cannot change reserved identity columns'
);

insert into storage.objects (bucket_id, name, owner_id)
select state.bucket_id, state.object_path, '00000000-0000-0000-0000-000000000201'
from attachment_test_state as state
where state.label in ('owner-public', 'owner-guest', 'owner-member', 'owner-private', 'owner-financial');

select extensions.throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values ('wedding-files', 'weddings/random/unreserved/path', '00000000-0000-0000-0000-000000000201')
  $$,
  '42501',
  null,
  'An unreserved object path cannot be uploaded'
);

select extensions.lives_ok(
  $$
    update storage.objects
    set metadata = '{}'::jsonb
    where bucket_id = 'wedding-files'
  $$,
  'A denied direct Storage UPDATE is safely filtered by RLS'
);

select extensions.is(
  (
    select count(*)
    from storage.objects as object
    where object.bucket_id = 'wedding-files'
      and object.metadata is not null
  ),
  0::bigint,
  'Storage objects cannot be updated or overwritten'
);

select extensions.throws_ok(
  $$
    select *
    from public.confirm_attachment_uploaded(
      (select attachment_id from attachment_test_state where label = 'owner-public'),
      -1,
      null
    )
  $$,
  '22023',
  null,
  'Confirmation rejects a negative size'
);

select extensions.throws_ok(
  $$
    select *
    from public.confirm_attachment_uploaded(
      (select attachment_id from attachment_test_state where label = 'owner-public'),
      100,
      'not-a-checksum'
    )
  $$,
  '22023',
  null,
  'Confirmation rejects an invalid checksum'
);

select extensions.lives_ok(
  $$
    select *
    from public.confirm_attachment_uploaded(
      (select attachment_id from attachment_test_state where label = 'owner-public'),
      100,
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    )
  $$,
  'Owner confirms the exact uploaded object'
);

select extensions.lives_ok(
  $$ select * from public.confirm_attachment_uploaded(
    (select attachment_id from attachment_test_state where label = 'owner-guest'), 101, null
  ) $$,
  'GUEST_VISIBLE upload confirms'
);

select extensions.lives_ok(
  $$ select * from public.confirm_attachment_uploaded(
    (select attachment_id from attachment_test_state where label = 'owner-member'), 102, null
  ) $$,
  'WEDDING_MEMBER_PRIVATE upload confirms'
);

select extensions.lives_ok(
  $$ select * from public.confirm_attachment_uploaded(
    (select attachment_id from attachment_test_state where label = 'owner-private'), 103, null
  ) $$,
  'OWNER_PRIVATE upload confirms'
);

select extensions.lives_ok(
  $$ select * from public.confirm_attachment_uploaded(
    (select attachment_id from attachment_test_state where label = 'owner-financial'), 104, null
  ) $$,
  'FINANCIAL_PRIVATE upload confirms'
);

select extensions.is(
  (
    select attachment.checksum_sha256
    from public.attachments as attachment
    where attachment.id = (select attachment_id from attachment_test_state where label = 'owner-public')
  ),
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'Confirmation normalizes a SHA-256 checksum to lowercase'
);

select extensions.lives_ok(
  $$
    select *
    from public.confirm_attachment_uploaded(
      (select attachment_id from attachment_test_state where label = 'owner-public'),
      100,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )
  $$,
  'An identical confirmation retry is idempotent'
);

select extensions.throws_ok(
  $$
    select *
    from public.confirm_attachment_uploaded(
      (select attachment_id from attachment_test_state where label = 'owner-public'),
      999,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )
  $$,
  '22023',
  null,
  'A conflicting confirmation retry is rejected'
);

select extensions.is((select count(*) from public.attachments), 5::bigint, 'Owner reads all five AVAILABLE visibility classes');
select extensions.is((select count(*) from storage.objects), 5::bigint, 'Owner reads all five corresponding Storage objects');

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);

select extensions.throws_ok(
  $$
    select *
    from public.reserve_attachment(
      '10000000-0000-0000-0000-000000000201',
      'forbidden.pdf',
      'application/pdf',
      'OWNER_PRIVATE'
    )
  $$,
  '42501',
  null,
  'Full Coordinator cannot reserve OWNER_PRIVATE'
);

insert into attachment_test_state (label, attachment_id, bucket_id, object_path)
select 'full-upload', reserved.attachment_id, reserved.bucket_id, reserved.object_path
from public.reserve_attachment(
  '10000000-0000-0000-0000-000000000201',
  'coordinator.pdf',
  'application/pdf',
  'FINANCIAL_PRIVATE'
) as reserved;

insert into storage.objects (bucket_id, name, owner_id)
select state.bucket_id, state.object_path, '00000000-0000-0000-0000-000000000202'
from attachment_test_state as state
where state.label = 'full-upload';

select extensions.is((select count(*) from public.attachments), 4::bigint, 'Full Coordinator reads all classes except OWNER_PRIVATE');
select extensions.is((select count(*) from storage.objects), 4::bigint, 'Full Coordinator reads four AVAILABLE objects and not the pending upload');

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000203', true);

select extensions.throws_ok(
  $$
    select *
    from public.reserve_attachment(
      '10000000-0000-0000-0000-000000000201',
      'day.pdf',
      'application/pdf',
      'PUBLIC'
    )
  $$,
  '42501',
  null,
  'Day-of Coordinator cannot reserve generic attachments'
);

select extensions.is((select count(*) from public.attachments), 3::bigint, 'Day-of Coordinator reads only general member-visible metadata');
select extensions.is((select count(*) from storage.objects), 3::bigint, 'Day-of Coordinator reads only general member-visible objects');

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000204', true);

select extensions.throws_ok(
  $$
    select *
    from public.reserve_attachment(
      '10000000-0000-0000-0000-000000000201',
      'guest.pdf',
      'application/pdf',
      'PUBLIC'
    )
  $$,
  '42501',
  null,
  'Guest Coordinator cannot reserve generic attachments'
);

select extensions.is((select count(*) from public.attachments), 3::bigint, 'Guest Coordinator reads only general member-visible metadata');
select extensions.is((select count(*) from storage.objects), 3::bigint, 'Guest Coordinator reads only general member-visible objects');

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000205', true);

select extensions.throws_ok(
  $$
    select *
    from public.reserve_attachment(
      '10000000-0000-0000-0000-000000000201',
      'unrelated.pdf',
      'application/pdf',
      'PUBLIC'
    )
  $$,
  '42501',
  null,
  'Unrelated User cannot reserve an Attachment'
);

select extensions.is((select count(*) from public.attachments), 0::bigint, 'Unrelated User discovers no Attachment metadata');
select extensions.is((select count(*) from storage.objects), 0::bigint, 'Unrelated User discovers no Storage objects');

select extensions.throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    select state.bucket_id, state.object_path, '00000000-0000-0000-0000-000000000205'
    from attachment_test_state as state
    where state.label = 'full-upload'
  $$,
  '42501',
  null,
  'A reserved path cannot be uploaded by another User'
);

select extensions.throws_ok(
  $$
    select *
    from public.confirm_attachment_uploaded(
      (select attachment_id from attachment_test_state where label = 'owner-public'),
      100,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )
  $$,
  '42501',
  null,
  'Unrelated User cannot confirm another Wedding upload'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000206', true);

select extensions.is((select count(*) from public.attachments), 0::bigint, 'Wedding B Owner discovers no Wedding A metadata');
select extensions.is((select count(*) from storage.objects), 0::bigint, 'Wedding B Owner discovers no Wedding A objects');

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000207', true);

insert into attachment_test_state (label, attachment_id, bucket_id, object_path)
select 'controller-private', reserved.attachment_id, reserved.bucket_id, reserved.object_path
from public.reserve_attachment(
  '10000000-0000-0000-0000-000000000203',
  'controller-private.pdf',
  'application/pdf',
  'OWNER_PRIVATE'
) as reserved;

insert into storage.objects (bucket_id, name, owner_id)
select state.bucket_id, state.object_path, '00000000-0000-0000-0000-000000000207'
from attachment_test_state as state
where state.label = 'controller-private';

select extensions.lives_ok(
  $$ select * from public.confirm_attachment_uploaded(
    (select attachment_id from attachment_test_state where label = 'controller-private'), 200, null
  ) $$,
  'Temporary controller confirms the exact uploaded object'
);

select extensions.is((select count(*) from public.attachments), 1::bigint, 'Temporary controller can reserve and read OWNER_PRIVATE metadata');
select extensions.is((select count(*) from storage.objects), 1::bigint, 'Temporary controller can upload and read OWNER_PRIVATE object');

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);

insert into attachment_test_state (label, attachment_id, bucket_id, object_path)
select 'missing-object', reserved.attachment_id, reserved.bucket_id, reserved.object_path
from public.reserve_attachment(
  '10000000-0000-0000-0000-000000000201',
  'missing.pdf',
  'application/pdf',
  'PUBLIC'
) as reserved;

select extensions.throws_ok(
  $$
    select *
    from public.confirm_attachment_uploaded(
      (select attachment_id from attachment_test_state where label = 'missing-object'),
      1,
      null
    )
  $$,
  '22023',
  null,
  'Confirmation fails when the exact Storage object does not exist'
);

select extensions.ok(
  not private.can_delete_storage_object(
    'wedding-files',
    (select object_path from attachment_test_state where label = 'owner-guest')
  ),
  'Storage delete authorization is false before logical deletion'
);

select extensions.is(
  (
    select count(*)
    from storage.objects as object
    where object.bucket_id = 'wedding-files'
      and object.name = (select object_path from attachment_test_state where label = 'owner-guest')
  ),
  1::bigint,
  'Physical Storage object remains before metadata deletion'
);

select extensions.lives_ok(
  $$ select * from public.mark_attachment_deleted(
    (select attachment_id from attachment_test_state where label = 'owner-guest')
  ) $$,
  'AVAILABLE Attachment can be marked DELETED'
);

select extensions.ok(
  private.can_delete_storage_object(
    'wedding-files',
    (select object_path from attachment_test_state where label = 'owner-guest')
  ),
  'Storage delete authorization becomes true after logical deletion'
);

select extensions.lives_ok(
  $$ select * from public.mark_attachment_deleted(
    (select attachment_id from attachment_test_state where label = 'missing-object')
  ) $$,
  'PENDING_UPLOAD Attachment can be marked DELETED'
);

select extensions.throws_ok(
  $$
    select *
    from public.confirm_attachment_uploaded(
      (select attachment_id from attachment_test_state where label = 'missing-object'),
      1,
      null
    )
  $$,
  '22023',
  null,
  'A deleted Attachment cannot be confirmed'
);

set local role postgres;

select extensions.is(
  (
    select attachment.status::text
    from public.attachments as attachment
    where attachment.id = (select attachment_id from attachment_test_state where label = 'owner-guest')
  ),
  'DELETED',
  'Deleted Attachment metadata remains for history'
);

select extensions.throws_ok(
  $$
    update public.attachments
    set status = 'AVAILABLE', deleted_at = null
    where id = (select attachment_id from attachment_test_state where label = 'owner-guest')
  $$,
  '23514',
  null,
  'DELETED to AVAILABLE is rejected by the database lifecycle trigger'
);

select extensions.ok(
  not has_table_privilege('anon', 'public.attachments', 'SELECT'),
  'anon has no Attachment metadata SELECT privilege'
);

select extensions.ok(
  not exists (
    select 1
    from pg_policies as policy
    where policy.schemaname = 'storage'
      and policy.tablename = 'objects'
      and 'anon' = any (policy.roles)
  ),
  'No Storage object policy grants anon access'
);

select extensions.ok(
  not exists (
    select 1
    from pg_policies as policy
    where policy.schemaname = 'storage'
      and policy.tablename = 'objects'
      and policy.cmd = 'UPDATE'
      and policy.policyname like 'wedding_files_%'
  ),
  'No Storage UPDATE policy exists for wedding-files'
);

select extensions.ok(
  pg_get_expr(
    (
      select policy.polqual
      from pg_policy as policy
      join pg_class as policy_table
        on policy_table.oid = policy.polrelid
      join pg_namespace as policy_schema
        on policy_schema.oid = policy_table.relnamespace
      where policy_schema.nspname = 'storage'
        and policy_table.relname = 'objects'
        and policy.polname = 'wedding_files_select_available'
    ),
    'storage.objects'::regclass
  ) like '%storage.object.delete_many%',
  'Storage SELECT is operation-scoped for physical deletion after logical deletion'
);

select extensions.ok(
  (
    select count(*) = 3
    from pg_proc as routine
    join pg_namespace as routine_schema
      on routine_schema.oid = routine.pronamespace
    where routine_schema.nspname = 'public'
      and routine.proname in (
        'reserve_attachment',
        'confirm_attachment_uploaded',
        'mark_attachment_deleted'
      )
      and routine.prosecdef
      and ('search_path=' || chr(34) || chr(34)) = any(coalesce(routine.proconfig, '{}'::text[]))
  ),
  'Attachment workflows intentionally use SECURITY DEFINER with an empty search_path'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.reserve_attachment(uuid,text,text,public.attachment_visibility)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.reserve_attachment(uuid,text,text,public.attachment_visibility)',
    'EXECUTE'
  ),
  'Only authenticated clients can execute reservation workflow'
);

select * from extensions.finish();

rollback;
