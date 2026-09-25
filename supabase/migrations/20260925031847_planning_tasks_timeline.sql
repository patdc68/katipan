begin;

create type public.planning_task_status as enum (
  'TODO',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

create type public.planning_task_priority as enum (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

alter table public.wedding_memberships
  add constraint wedding_memberships_wedding_id_id_key
  unique (wedding_id, id);

create table public.task_categories (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_categories_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint task_categories_wedding_id_id_key
    unique (wedding_id, id),
  constraint task_categories_name_trimmed_check
    check (name = pg_catalog.btrim(name) and name <> ''),
  constraint task_categories_sort_order_check
    check (sort_order >= 0)
);

create unique index task_categories_normalized_name_idx
  on public.task_categories (wedding_id, pg_catalog.lower(name));

create index task_categories_wedding_sort_idx
  on public.task_categories (wedding_id, sort_order, id);

create table public.planning_tasks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  category_id uuid,
  title text not null,
  description text,
  status public.planning_task_status not null default 'TODO',
  priority public.planning_task_priority not null default 'NORMAL',
  start_date date,
  due_date date,
  completed_at timestamptz,
  completed_by_user_id uuid,
  sort_order integer not null default 0,
  private_notes text,
  created_by_user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_tasks_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint planning_tasks_category_same_wedding_fkey
    foreign key (wedding_id, category_id)
    references public.task_categories (wedding_id, id)
    on delete set null (category_id),
  constraint planning_tasks_completed_by_user_id_fkey
    foreign key (completed_by_user_id)
    references auth.users (id)
    on delete set null,
  constraint planning_tasks_created_by_user_id_fkey
    foreign key (created_by_user_id)
    references auth.users (id)
    on delete set null,
  constraint planning_tasks_wedding_id_id_key
    unique (wedding_id, id),
  constraint planning_tasks_title_trimmed_check
    check (title = pg_catalog.btrim(title) and title <> ''),
  constraint planning_tasks_sort_order_check
    check (sort_order >= 0),
  constraint planning_tasks_date_order_check
    check (start_date is null or due_date is null or start_date <= due_date),
  constraint planning_tasks_completion_lifecycle_check
    check (
      (
        status = 'COMPLETED'
        and completed_at is not null
      )
      or (
        status <> 'COMPLETED'
        and completed_at is null
        and completed_by_user_id is null
      )
    )
);

create index planning_tasks_wedding_sort_idx
  on public.planning_tasks (wedding_id, sort_order, id);

create index planning_tasks_wedding_status_due_idx
  on public.planning_tasks (wedding_id, status, due_date);

create index planning_tasks_category_idx
  on public.planning_tasks (wedding_id, category_id);

create index planning_tasks_completed_by_user_idx
  on public.planning_tasks (completed_by_user_id)
  where completed_by_user_id is not null;

create index planning_tasks_created_by_user_idx
  on public.planning_tasks (created_by_user_id)
  where created_by_user_id is not null;

create table public.planning_task_assignees (
  wedding_id uuid not null,
  task_id uuid not null,
  membership_id uuid not null,
  assigned_by_user_id uuid default auth.uid(),
  assigned_at timestamptz not null default now(),
  constraint planning_task_assignees_pkey
    primary key (wedding_id, task_id, membership_id),
  constraint planning_task_assignees_task_same_wedding_fkey
    foreign key (wedding_id, task_id)
    references public.planning_tasks (wedding_id, id)
    on delete cascade,
  constraint planning_task_assignees_membership_same_wedding_fkey
    foreign key (wedding_id, membership_id)
    references public.wedding_memberships (wedding_id, id),
  constraint planning_task_assignees_assigned_by_user_id_fkey
    foreign key (assigned_by_user_id)
    references auth.users (id)
    on delete set null
);

create index planning_task_assignees_membership_idx
  on public.planning_task_assignees (wedding_id, membership_id, task_id);

create index planning_task_assignees_assigned_by_user_idx
  on public.planning_task_assignees (assigned_by_user_id)
  where assigned_by_user_id is not null;

create table public.planning_task_dependencies (
  wedding_id uuid not null,
  task_id uuid not null,
  depends_on_task_id uuid not null,
  created_by_user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint planning_task_dependencies_pkey
    primary key (wedding_id, task_id, depends_on_task_id),
  constraint planning_task_dependencies_task_same_wedding_fkey
    foreign key (wedding_id, task_id)
    references public.planning_tasks (wedding_id, id)
    on delete cascade,
  constraint planning_task_dependencies_prerequisite_same_wedding_fkey
    foreign key (wedding_id, depends_on_task_id)
    references public.planning_tasks (wedding_id, id)
    on delete cascade,
  constraint planning_task_dependencies_created_by_user_id_fkey
    foreign key (created_by_user_id)
    references auth.users (id)
    on delete set null,
  constraint planning_task_dependencies_no_self_check
    check (task_id <> depends_on_task_id)
);

create index planning_task_dependencies_prerequisite_idx
  on public.planning_task_dependencies (
    wedding_id,
    depends_on_task_id,
    task_id
  );

create index planning_task_dependencies_created_by_user_idx
  on public.planning_task_dependencies (created_by_user_id)
  where created_by_user_id is not null;

create function private.can_manage_wedding_planning(
  p_wedding_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and (
      (select private.has_active_wedding_role(
        p_wedding_id,
        array['OWNER', 'FULL_COORDINATOR']::public.wedding_membership_role[]
      ))
      or (select private.controls_coordinator_managed_wedding(p_wedding_id))
    );
$function$;

create function private.enforce_planning_task_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if v_actor_user_id is not null then
      new.created_by_user_id := v_actor_user_id;
    end if;

    if new.status = 'COMPLETED' then
      new.completed_at := pg_catalog.now();
      new.completed_by_user_id := v_actor_user_id;
    else
      new.completed_at := null;
      new.completed_by_user_id := null;
    end if;

    return new;
  end if;

  new.created_by_user_id := old.created_by_user_id;

  if new.status = 'COMPLETED' and old.status <> 'COMPLETED' then
    new.completed_at := pg_catalog.now();
    new.completed_by_user_id := v_actor_user_id;
  elsif new.status <> 'COMPLETED' then
    new.completed_at := null;
    new.completed_by_user_id := null;
  else
    new.completed_at := old.completed_at;
    new.completed_by_user_id := old.completed_by_user_id;
  end if;

  return new;
end;
$function$;

create function private.enforce_planning_task_assignee()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.wedding_memberships as membership
    where membership.wedding_id = new.wedding_id
      and membership.id = new.membership_id
      and membership.status = 'ACTIVE'
      and membership.user_id is not null
  ) then
    raise exception using
      errcode = '23503',
      constraint = 'planning_task_assignees_active_membership_check',
      message = 'Tasks may only be assigned to active authenticated Wedding Memberships.';
  end if;

  if (select auth.uid()) is not null then
    new.assigned_by_user_id := (select auth.uid());
  end if;

  return new;
end;
$function$;

create function private.enforce_planning_task_dependency()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.task_id = new.depends_on_task_id then
    raise exception using
      errcode = '23514',
      constraint = 'planning_task_dependencies_no_self_check',
      message = 'A Planning Task cannot depend on itself.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'katipan:planning-task-dependencies:' || new.wedding_id::text,
      0
    )
  );

  if exists (
    with recursive reachable (task_id) as (
      select new.depends_on_task_id
      union
      select dependency.depends_on_task_id
      from public.planning_task_dependencies as dependency
      join reachable
        on reachable.task_id = dependency.task_id
      where dependency.wedding_id = new.wedding_id
    )
    select 1
    from reachable
    where reachable.task_id = new.task_id
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'planning_task_dependencies_acyclic',
      message = 'Planning Task dependencies cannot contain a cycle.';
  end if;

  if (select auth.uid()) is not null then
    new.created_by_user_id := (select auth.uid());
  end if;

  return new;
end;
$function$;

create function public.create_planning_task(
  p_wedding_id uuid,
  p_category_id uuid,
  p_title text,
  p_description text,
  p_priority public.planning_task_priority,
  p_start_date date,
  p_due_date date,
  p_sort_order integer,
  p_private_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_task_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not (select private.can_manage_wedding_planning(p_wedding_id)) then
    raise exception using errcode = '42501', message = 'Planning Task management is not permitted.';
  end if;

  insert into public.planning_tasks (
    wedding_id,
    category_id,
    title,
    description,
    priority,
    start_date,
    due_date,
    sort_order,
    private_notes
  )
  values (
    p_wedding_id,
    p_category_id,
    pg_catalog.btrim(p_title),
    p_description,
    p_priority,
    p_start_date,
    p_due_date,
    p_sort_order,
    p_private_notes
  )
  returning id into v_task_id;

  return v_task_id;
end;
$function$;

create function public.update_planning_task(
  p_task_id uuid,
  p_category_id uuid,
  p_title text,
  p_description text,
  p_priority public.planning_task_priority,
  p_start_date date,
  p_due_date date,
  p_sort_order integer,
  p_private_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select task.wedding_id
  into v_wedding_id
  from public.planning_tasks as task
  where task.id = p_task_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Planning Task not found.';
  end if;

  if not (select private.can_manage_wedding_planning(v_wedding_id)) then
    raise exception using errcode = '42501', message = 'Planning Task management is not permitted.';
  end if;

  update public.planning_tasks as task
  set
    category_id = p_category_id,
    title = pg_catalog.btrim(p_title),
    description = p_description,
    priority = p_priority,
    start_date = p_start_date,
    due_date = p_due_date,
    sort_order = p_sort_order,
    private_notes = p_private_notes
  where task.id = p_task_id;

  return p_task_id;
end;
$function$;

create function public.change_planning_task_status(
  p_task_id uuid,
  p_status public.planning_task_status
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select task.wedding_id
  into v_wedding_id
  from public.planning_tasks as task
  where task.id = p_task_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Planning Task not found.';
  end if;

  if not (select private.can_manage_wedding_planning(v_wedding_id)) then
    raise exception using errcode = '42501', message = 'Planning Task status changes are not permitted.';
  end if;

  update public.planning_tasks as task
  set status = p_status
  where task.id = p_task_id;

  return p_task_id;
end;
$function$;

create function public.assign_planning_task(
  p_task_id uuid,
  p_membership_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select task.wedding_id
  into v_wedding_id
  from public.planning_tasks as task
  where task.id = p_task_id;

  if not found then
    raise exception using errcode = '22023', message = 'Planning Task not found.';
  end if;

  if not (select private.can_manage_wedding_planning(v_wedding_id)) then
    raise exception using errcode = '42501', message = 'Planning Task assignment is not permitted.';
  end if;

  perform 1
  from public.wedding_memberships as membership
  where membership.wedding_id = v_wedding_id
    and membership.id = p_membership_id
    and membership.status = 'ACTIVE'
    and membership.user_id is not null
  ;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'planning_task_assignees_active_membership_check',
      message = 'Tasks may only be assigned to active authenticated Memberships from the same Wedding.';
  end if;

  insert into public.planning_task_assignees (
    wedding_id,
    task_id,
    membership_id
  )
  values (
    v_wedding_id,
    p_task_id,
    p_membership_id
  )
  on conflict do nothing;

  return found;
end;
$function$;

create function public.unassign_planning_task(
  p_task_id uuid,
  p_membership_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select task.wedding_id
  into v_wedding_id
  from public.planning_tasks as task
  where task.id = p_task_id;

  if not found then
    raise exception using errcode = '22023', message = 'Planning Task not found.';
  end if;

  if not (select private.can_manage_wedding_planning(v_wedding_id)) then
    raise exception using errcode = '42501', message = 'Planning Task assignment is not permitted.';
  end if;

  delete from public.planning_task_assignees as assignment
  where assignment.wedding_id = v_wedding_id
    and assignment.task_id = p_task_id
    and assignment.membership_id = p_membership_id;

  return found;
end;
$function$;

create function public.add_planning_task_dependency(
  p_task_id uuid,
  p_depends_on_task_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
  v_dependency_wedding_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_task_id = p_depends_on_task_id then
    raise exception using
      errcode = '23514',
      constraint = 'planning_task_dependencies_no_self_check',
      message = 'A Planning Task cannot depend on itself.';
  end if;

  select task.wedding_id
  into v_wedding_id
  from public.planning_tasks as task
  where task.id = p_task_id;

  if not found then
    raise exception using errcode = '22023', message = 'Planning Task not found.';
  end if;

  if not (select private.can_manage_wedding_planning(v_wedding_id)) then
    raise exception using errcode = '42501', message = 'Planning Task dependency management is not permitted.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'katipan:planning-task-dependencies:' || v_wedding_id::text,
      0
    )
  );

  select prerequisite.wedding_id
  into v_dependency_wedding_id
  from public.planning_tasks as prerequisite
  where prerequisite.id = p_depends_on_task_id;

  if not found or v_dependency_wedding_id <> v_wedding_id then
    raise exception using
      errcode = '23503',
      constraint = 'planning_task_dependencies_prerequisite_same_wedding_fkey',
      message = 'Planning Task dependencies must remain within one Wedding.';
  end if;

  if not exists (
    select 1
    from public.planning_tasks as task
    where task.id = p_task_id
      and task.wedding_id = v_wedding_id
  ) then
    raise exception using errcode = '22023', message = 'Planning Task not found.';
  end if;

  insert into public.planning_task_dependencies (
    wedding_id,
    task_id,
    depends_on_task_id
  )
  values (
    v_wedding_id,
    p_task_id,
    p_depends_on_task_id
  );

  return true;
end;
$function$;

create function public.remove_planning_task_dependency(
  p_task_id uuid,
  p_depends_on_task_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select task.wedding_id
  into v_wedding_id
  from public.planning_tasks as task
  where task.id = p_task_id;

  if not found then
    raise exception using errcode = '22023', message = 'Planning Task not found.';
  end if;

  if not (select private.can_manage_wedding_planning(v_wedding_id)) then
    raise exception using errcode = '42501', message = 'Planning Task dependency management is not permitted.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'katipan:planning-task-dependencies:' || v_wedding_id::text,
      0
    )
  );

  delete from public.planning_task_dependencies as dependency
  where dependency.wedding_id = v_wedding_id
    and dependency.task_id = p_task_id
    and dependency.depends_on_task_id = p_depends_on_task_id;

  return found;
end;
$function$;

create trigger task_categories_set_updated_at
before update on public.task_categories
for each row execute function private.set_updated_at();

create trigger planning_tasks_enforce_lifecycle
before insert or update on public.planning_tasks
for each row execute function private.enforce_planning_task_lifecycle();

create trigger planning_tasks_set_updated_at
before update on public.planning_tasks
for each row execute function private.set_updated_at();

create trigger planning_task_assignees_enforce_active_membership
before insert on public.planning_task_assignees
for each row execute function private.enforce_planning_task_assignee();

create trigger planning_task_dependencies_enforce_acyclic
before insert on public.planning_task_dependencies
for each row execute function private.enforce_planning_task_dependency();

alter table public.task_categories enable row level security;
alter table public.planning_tasks enable row level security;
alter table public.planning_task_assignees enable row level security;
alter table public.planning_task_dependencies enable row level security;

do $policies$
declare
  v_table text;
begin
  foreach v_table in array array[
    'task_categories',
    'planning_tasks',
    'planning_task_assignees',
    'planning_task_dependencies'
  ]
  loop
    execute pg_catalog.format(
      'create policy %I on public.%I for select to authenticated using ((select private.has_active_wedding_membership(wedding_id)))',
      v_table || '_select_member',
      v_table
    );

    execute pg_catalog.format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.can_manage_wedding_planning(wedding_id)))',
      v_table || '_insert_manager',
      v_table
    );

    execute pg_catalog.format(
      'create policy %I on public.%I for update to authenticated using ((select private.can_manage_wedding_planning(wedding_id))) with check ((select private.can_manage_wedding_planning(wedding_id)))',
      v_table || '_update_manager',
      v_table
    );

    execute pg_catalog.format(
      'create policy %I on public.%I for delete to authenticated using ((select private.can_manage_wedding_planning(wedding_id)))',
      v_table || '_delete_manager',
      v_table
    );
  end loop;
end;
$policies$;

revoke all on table public.task_categories,
  public.planning_tasks,
  public.planning_task_assignees,
  public.planning_task_dependencies
from public, anon, authenticated, service_role;

grant select on table public.task_categories,
  public.planning_tasks,
  public.planning_task_assignees,
  public.planning_task_dependencies
to authenticated;

grant insert (wedding_id, name, sort_order),
  update (name, sort_order),
  delete
on table public.task_categories
to authenticated;

grant insert (
  wedding_id,
  category_id,
  title,
  description,
  priority,
  start_date,
  due_date,
  sort_order,
  private_notes
),
update (
  category_id,
  title,
  description,
  status,
  priority,
  start_date,
  due_date,
  sort_order,
  private_notes
),
delete
on table public.planning_tasks
to authenticated;

grant insert (wedding_id, task_id, membership_id),
  delete
on table public.planning_task_assignees
to authenticated;

grant delete on table public.planning_task_dependencies
to authenticated;

grant select, insert, update, delete
on table public.task_categories,
  public.planning_tasks,
  public.planning_task_assignees,
  public.planning_task_dependencies
to service_role;

revoke all on type public.planning_task_status,
  public.planning_task_priority
from public, anon, authenticated, service_role;

grant usage on type public.planning_task_status,
  public.planning_task_priority
to authenticated, service_role;

revoke execute on function private.can_manage_wedding_planning(uuid),
  private.enforce_planning_task_lifecycle(),
  private.enforce_planning_task_assignee(),
  private.enforce_planning_task_dependency()
from public, anon, authenticated, service_role;

grant execute on function private.can_manage_wedding_planning(uuid)
to authenticated;

revoke execute on function public.create_planning_task(
  uuid,
  uuid,
  text,
  text,
  public.planning_task_priority,
  date,
  date,
  integer,
  text
),
public.update_planning_task(
  uuid,
  uuid,
  text,
  text,
  public.planning_task_priority,
  date,
  date,
  integer,
  text
),
public.change_planning_task_status(uuid, public.planning_task_status),
public.assign_planning_task(uuid, uuid),
public.unassign_planning_task(uuid, uuid),
public.add_planning_task_dependency(uuid, uuid),
public.remove_planning_task_dependency(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.create_planning_task(
  uuid,
  uuid,
  text,
  text,
  public.planning_task_priority,
  date,
  date,
  integer,
  text
),
public.update_planning_task(
  uuid,
  uuid,
  text,
  text,
  public.planning_task_priority,
  date,
  date,
  integer,
  text
),
public.change_planning_task_status(uuid, public.planning_task_status),
public.assign_planning_task(uuid, uuid),
public.unassign_planning_task(uuid, uuid),
public.add_planning_task_dependency(uuid, uuid),
public.remove_planning_task_dependency(uuid, uuid)
to authenticated, service_role;

comment on table public.task_categories is
  'Custom Wedding-scoped planning categories. No checklist category names are hard-coded.';

comment on table public.planning_tasks is
  'Wedding planning dates and work state only; this table is not a Wedding-Day Run of Show or Guest Program.';

comment on table public.planning_task_assignees is
  'Zero-to-many Task assignees linked through authenticated Wedding Memberships, without owning or deleting Tasks.';

comment on table public.planning_task_dependencies is
  'Acyclic same-Wedding Task prerequisites for future Katipan Ripple foundations; no automatic propagation occurs here.';

comment on function public.add_planning_task_dependency(uuid, uuid) is
  'Serializes dependency mutations per Wedding and rejects self, cross-Wedding, duplicate, and cyclic edges.';

commit;
