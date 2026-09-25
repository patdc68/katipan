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
  ('00000000-0000-0000-0000-000000000701', 'authenticated', 'authenticated', 'planning-owner-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000702', 'authenticated', 'authenticated', 'planning-full-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000703', 'authenticated', 'authenticated', 'planning-day-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000704', 'authenticated', 'authenticated', 'planning-guest-coordinator-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000705', 'authenticated', 'authenticated', 'planning-unrelated@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000706', 'authenticated', 'authenticated', 'planning-owner-b@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000707', 'authenticated', 'authenticated', 'planning-controller@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.weddings (
  id,
  origin,
  status,
  ownership_mode,
  created_by_user_id,
  display_name
)
values
  ('10000000-0000-0000-0000-000000000701', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000701', 'Planning Wedding A'),
  ('10000000-0000-0000-0000-000000000702', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000706', 'Planning Wedding B'),
  ('10000000-0000-0000-0000-000000000703', 'COORDINATOR_CREATED', 'ACTIVE', 'COORDINATOR_MANAGED', '00000000-0000-0000-0000-000000000707', 'Planning Controller Wedding');

insert into public.wedding_memberships (
  id,
  wedding_id,
  user_id,
  role
)
values
  ('20000000-0000-0000-0000-000000000701', '10000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000701', 'OWNER'),
  ('20000000-0000-0000-0000-000000000702', '10000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702', 'FULL_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000703', '10000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000703', 'DAY_OF_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000704', '10000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000704', 'GUEST_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000706', '10000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000706', 'OWNER'),
  ('20000000-0000-0000-0000-000000000707', '10000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000707', 'FULL_COORDINATOR');

set constraints all immediate;

create temporary table planning_test_state (
  label text primary key,
  value uuid not null
);

grant all on table planning_test_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000701', true);

with created as (
  insert into public.task_categories (wedding_id, name, sort_order)
  values (
    '10000000-0000-0000-0000-000000000701',
    'Venue logistics',
    20
  )
  returning id
)
insert into planning_test_state (label, value)
select 'category-a', id from created;

with created as (
  insert into public.task_categories (wedding_id, name, sort_order)
  values (
    '10000000-0000-0000-0000-000000000701',
    'Personal checklist',
    10
  )
  returning id
)
insert into planning_test_state (label, value)
select 'category-a-2', id from created;

select extensions.is(
  (
    select pg_catalog.string_agg(category.name, ', ' order by category.sort_order)
    from public.task_categories as category
  ),
  'Personal checklist, Venue logistics',
  'Wedding members can customize category names and ordering without hard-coded presets'
);

insert into planning_test_state (label, value)
values (
  'task-a-1',
  public.create_planning_task(
    '10000000-0000-0000-0000-000000000701',
    (select value from planning_test_state where label = 'category-a'),
    'Confirm venue access',
    'Confirm supplier ingress and loading rules',
    'HIGH',
    '2026-10-01',
    '2026-10-05',
    10,
    'Internal planning note'
  )
);

insert into planning_test_state (label, value)
values (
  'task-a-2',
  public.create_planning_task(
    '10000000-0000-0000-0000-000000000701',
    (select value from planning_test_state where label = 'category-a'),
    'Finalize supplier access list',
    null,
    'NORMAL',
    null,
    '2026-10-10',
    20,
    null
  )
);

insert into planning_test_state (label, value)
values (
  'task-a-3',
  public.create_planning_task(
    '10000000-0000-0000-0000-000000000701',
    null,
    'Send final operations brief',
    null,
    'URGENT',
    null,
    null,
    30,
    null
  )
);

select extensions.ok(
  (
    select task.status = 'TODO'
      and task.created_by_user_id = '00000000-0000-0000-0000-000000000701'
      and task.completed_at is null
      and task.completed_by_user_id is null
    from public.planning_tasks as task
    where task.id = (select value from planning_test_state where label = 'task-a-1')
  ),
  'Task creation derives the caller and starts without completion metadata'
);

do $workflow$
begin
  perform public.change_planning_task_status(
    (select value from planning_test_state where label = 'task-a-1'),
    'IN_PROGRESS'
  );
end;
$workflow$;

select extensions.is(
  (
    select task.status::text
    from public.planning_tasks as task
    where task.id = (select value from planning_test_state where label = 'task-a-1')
  ),
  'IN_PROGRESS',
  'A TODO Task can move to IN_PROGRESS'
);

do $workflow$
begin
  perform public.change_planning_task_status(
    (select value from planning_test_state where label = 'task-a-1'),
    'COMPLETED'
  );
end;
$workflow$;

select extensions.ok(
  (
    select task.status = 'COMPLETED'
      and task.completed_at is not null
      and task.completed_by_user_id = '00000000-0000-0000-0000-000000000701'
    from public.planning_tasks as task
    where task.id = (select value from planning_test_state where label = 'task-a-1')
  ),
  'Completing a Task derives completion time and completing caller'
);

do $workflow$
begin
  perform public.change_planning_task_status(
    (select value from planning_test_state where label = 'task-a-1'),
    'TODO'
  );
end;
$workflow$;

select extensions.ok(
  (
    select task.status = 'TODO'
      and task.completed_at is null
      and task.completed_by_user_id is null
    from public.planning_tasks as task
    where task.id = (select value from planning_test_state where label = 'task-a-1')
  ),
  'Reopening a completed Task clears all completion metadata'
);

select extensions.throws_ok(
  format(
    'select public.create_planning_task(%L::uuid, null, %L, null, %L::public.planning_task_priority, %L::date, %L::date, 0, null)',
    '10000000-0000-0000-0000-000000000701',
    'Invalid date order',
    'NORMAL',
    '2026-10-20',
    '2026-10-10'
  ),
  '23514',
  null,
  'Task planning dates reject start_date after due_date'
);

do $workflow$
begin
  perform public.assign_planning_task(
    (select value from planning_test_state where label = 'task-a-1'),
    '20000000-0000-0000-0000-000000000701'
  );
  perform public.assign_planning_task(
    (select value from planning_test_state where label = 'task-a-1'),
    '20000000-0000-0000-0000-000000000702'
  );
end;
$workflow$;

select extensions.is(
  (
    select count(*)
    from public.planning_task_assignees as assignment
    where assignment.task_id = (select value from planning_test_state where label = 'task-a-1')
  ),
  2::bigint,
  'A Planning Task supports multiple Wedding Membership assignees'
);

select extensions.throws_ok(
  format(
    'select public.assign_planning_task(%L::uuid, %L::uuid)',
    (select value from planning_test_state where label = 'task-a-1'),
    '20000000-0000-0000-0000-000000000706'
  ),
  '23503',
  null,
  'Task assignment rejects a Membership from another Wedding'
);

do $workflow$
begin
  perform public.unassign_planning_task(
    (select value from planning_test_state where label = 'task-a-1'),
    '20000000-0000-0000-0000-000000000701'
  );
end;
$workflow$;

select extensions.ok(
  exists (
    select 1
    from public.planning_tasks as task
    where task.id = (select value from planning_test_state where label = 'task-a-1')
  )
  and exists (
    select 1
    from public.wedding_memberships as membership
    where membership.id = '20000000-0000-0000-0000-000000000701'
  ),
  'Unassigning a relationship deletes neither the Task nor the Wedding Membership'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000706', true);

with created as (
  insert into public.task_categories (wedding_id, name, sort_order)
  values ('10000000-0000-0000-0000-000000000702', 'Wedding B custom', 0)
  returning id
)
insert into planning_test_state (label, value)
select 'category-b', id from created;

insert into planning_test_state (label, value)
values (
  'task-b-1',
  public.create_planning_task(
    '10000000-0000-0000-0000-000000000702',
    (select value from planning_test_state where label = 'category-b'),
    'Wedding B Task',
    null,
    'LOW',
    null,
    null,
    0,
    null
  )
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000701', true);

select extensions.throws_ok(
  format(
    'select public.update_planning_task(%L::uuid, %L::uuid, %L, null, %L::public.planning_task_priority, null, null, 0, null)',
    (select value from planning_test_state where label = 'task-a-1'),
    (select value from planning_test_state where label = 'category-b'),
    'Cross-Wedding category attempt',
    'NORMAL'
  ),
  '23503',
  null,
  'Task categories are enforced within the same Wedding'
);

do $workflow$
begin
  perform public.add_planning_task_dependency(
    (select value from planning_test_state where label = 'task-a-2'),
    (select value from planning_test_state where label = 'task-a-1')
  );
  perform public.add_planning_task_dependency(
    (select value from planning_test_state where label = 'task-a-3'),
    (select value from planning_test_state where label = 'task-a-2')
  );
end;
$workflow$;

select extensions.is(
  (select count(*) from public.planning_task_dependencies),
  2::bigint,
  'A Planning Task can participate in explicit prerequisite relationships'
);

select extensions.throws_ok(
  format(
    'select public.add_planning_task_dependency(%L::uuid, %L::uuid)',
    (select value from planning_test_state where label = 'task-a-1'),
    (select value from planning_test_state where label = 'task-a-1')
  ),
  '23514',
  null,
  'A Planning Task cannot depend on itself'
);

select extensions.throws_ok(
  format(
    'select public.add_planning_task_dependency(%L::uuid, %L::uuid)',
    (select value from planning_test_state where label = 'task-a-1'),
    (select value from planning_test_state where label = 'task-b-1')
  ),
  '23503',
  null,
  'Planning Task dependencies cannot cross Weddings'
);

select extensions.throws_ok(
  format(
    'select public.add_planning_task_dependency(%L::uuid, %L::uuid)',
    (select value from planning_test_state where label = 'task-a-2'),
    (select value from planning_test_state where label = 'task-a-1')
  ),
  '23505',
  null,
  'Duplicate Planning Task dependencies are rejected'
);

select extensions.throws_ok(
  format(
    'select public.add_planning_task_dependency(%L::uuid, %L::uuid)',
    (select value from planning_test_state where label = 'task-a-1'),
    (select value from planning_test_state where label = 'task-a-3')
  ),
  '23514',
  null,
  'Cyclic Planning Task dependencies are rejected'
);

do $workflow$
begin
  perform public.remove_planning_task_dependency(
    (select value from planning_test_state where label = 'task-a-3'),
    (select value from planning_test_state where label = 'task-a-2')
  );
end;
$workflow$;

select extensions.ok(
  exists (
    select 1 from public.planning_tasks
    where id = (select value from planning_test_state where label = 'task-a-2')
  )
  and exists (
    select 1 from public.planning_tasks
    where id = (select value from planning_test_state where label = 'task-a-3')
  ),
  'Removing a dependency never deletes either Planning Task'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000702', true);

insert into planning_test_state (label, value)
values (
  'task-full-a',
  public.create_planning_task(
    '10000000-0000-0000-0000-000000000701',
    null,
    'Full Coordinator Task',
    null,
    'NORMAL',
    null,
    null,
    40,
    null
  )
);

select extensions.ok(
  exists (
    select 1 from public.planning_tasks
    where id = (select value from planning_test_state where label = 'task-full-a')
  ),
  'An active FULL_COORDINATOR can manage Planning Tasks'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000703', true);

select extensions.ok(
  (select count(*) from public.planning_tasks) >= 4,
  'An active DAY_OF_COORDINATOR can read Wedding Planning Tasks'
);

select extensions.throws_ok(
  $$select public.create_planning_task('10000000-0000-0000-0000-000000000701', null, 'Denied Day-of write', null, 'NORMAL', null, null, 0, null)$$,
  '42501',
  null,
  'A DAY_OF_COORDINATOR cannot manage Planning Tasks'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000704', true);

select extensions.ok(
  (select count(*) from public.planning_tasks) >= 4,
  'An active GUEST_COORDINATOR can read Wedding Planning Tasks'
);

select extensions.throws_ok(
  $$select public.create_planning_task('10000000-0000-0000-0000-000000000701', null, 'Denied Guest Coordinator write', null, 'NORMAL', null, null, 0, null)$$,
  '42501',
  null,
  'A GUEST_COORDINATOR cannot manage Planning Tasks'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000705', true);

select extensions.is(
  (select count(*) from public.planning_tasks),
  0::bigint,
  'An unrelated authenticated user cannot read Planning Tasks'
);

select extensions.throws_ok(
  $$select public.create_planning_task('10000000-0000-0000-0000-000000000701', null, 'Denied unrelated write', null, 'NORMAL', null, null, 0, null)$$,
  '42501',
  null,
  'An unrelated authenticated user cannot manage Planning Tasks'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000707', true);

insert into planning_test_state (label, value)
values (
  'task-controller',
  public.create_planning_task(
    '10000000-0000-0000-0000-000000000703',
    null,
    'Controller Task',
    null,
    'NORMAL',
    null,
    null,
    0,
    null
  )
);

select extensions.ok(
  exists (
    select 1 from public.planning_tasks
    where id = (select value from planning_test_state where label = 'task-controller')
  ),
  'The temporary coordinator-managed controller can manage Planning Tasks'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000701', true);

select extensions.is(
  (
    select count(*)
    from public.planning_tasks as task
    where task.wedding_id = '10000000-0000-0000-0000-000000000702'
  ),
  0::bigint,
  'RLS isolates Planning Tasks across Weddings'
);

do $workflow$
begin
  perform public.remove_wedding_member(
    '10000000-0000-0000-0000-000000000701',
    '20000000-0000-0000-0000-000000000702'
  );
end;
$workflow$;

select extensions.ok(
  exists (
    select 1
    from public.planning_tasks as task
    where task.id = (select value from planning_test_state where label = 'task-a-1')
  )
  and exists (
    select 1
    from public.planning_task_assignees as assignment
    where assignment.task_id = (select value from planning_test_state where label = 'task-a-1')
      and assignment.membership_id = '20000000-0000-0000-0000-000000000702'
  ),
  'Removing an assigned Membership deletes neither the Task nor its historical assignment link'
);

select extensions.ok(
  not pg_catalog.has_table_privilege('anon', 'public.planning_tasks', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'public.planning_task_assignees', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'public.planning_task_dependencies', 'SELECT'),
  'Anon receives no Planning Task table privileges'
);

select extensions.ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.planning_tasks', 'INSERT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.planning_tasks', 'UPDATE')
  and not pg_catalog.has_table_privilege('authenticated', 'public.planning_task_assignees', 'INSERT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.planning_task_dependencies', 'INSERT'),
  'Protected Task metadata and relationships can only change through narrow workflows'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select extensions.throws_ok(
  'select count(*) from public.planning_tasks',
  '42501',
  null,
  'Anon cannot read Planning Tasks'
);

select extensions.throws_ok(
  $$select public.create_planning_task('10000000-0000-0000-0000-000000000701', null, 'Anon denied', null, 'NORMAL', null, null, 0, null)$$,
  '42501',
  null,
  'Anon cannot execute Planning Task workflows'
);

reset role;

select * from extensions.finish();

rollback;
