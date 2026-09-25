begin;

create type public.guest_check_in_event_type as enum ('CHECK_IN', 'REVERSAL');
create type public.guest_check_in_source as enum ('QR', 'MANUAL', 'OFFLINE_SYNC');
create type public.wedding_day_item_status as enum
  ('UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'SKIPPED', 'CANCELLED');

-- Event order is assigned by the database. occurred_at records a possible offline
-- observation time and must never be used to decide the current state.
create table public.guest_check_in_events (
  id uuid primary key default gen_random_uuid(),
  event_sequence bigint generated always as identity unique,
  wedding_id uuid not null,
  guest_id uuid not null,
  event_type public.guest_check_in_event_type not null,
  source public.guest_check_in_source not null,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  recorded_by_user_id uuid not null references auth.users(id),
  client_event_id uuid not null,
  reverses_event_id uuid,
  reversal_reason text,
  constraint guest_check_in_events_guest_same_wedding_fkey
    foreign key (wedding_id, guest_id) references public.guests(wedding_id, id),
  constraint guest_check_in_events_wedding_guest_id_key unique (wedding_id, guest_id, id),
  constraint guest_check_in_events_reversal_same_guest_fkey
    foreign key (wedding_id, guest_id, reverses_event_id)
    references public.guest_check_in_events(wedding_id, guest_id, id),
  constraint guest_check_in_events_reversal_shape_check check (
    (event_type = 'CHECK_IN' and reverses_event_id is null and reversal_reason is null)
    or (event_type = 'REVERSAL' and reverses_event_id is not null and source <> 'QR')
  ),
  constraint guest_check_in_events_reversal_reason_check
    check (reversal_reason is null or btrim(reversal_reason) <> '')
);
create unique index guest_check_in_events_idempotency_idx
  on public.guest_check_in_events(wedding_id, client_event_id);
create unique index guest_check_in_events_one_reversal_idx
  on public.guest_check_in_events(reverses_event_id) where reverses_event_id is not null;
create index guest_check_in_events_latest_idx
  on public.guest_check_in_events(wedding_id, guest_id, event_sequence desc);
create index guest_check_in_events_recorded_by_user_idx
  on public.guest_check_in_events(recorded_by_user_id);
create index guest_check_in_events_reversal_ref_idx
  on public.guest_check_in_events(wedding_id,guest_id,reverses_event_id);

create function private.reject_check_in_event_change() returns trigger
language plpgsql set search_path = '' as $function$
begin
  raise exception 'Check-in history is append-only' using errcode = '42501';
end;
$function$;
create trigger guest_check_in_events_immutable
  before update or delete on public.guest_check_in_events
  for each row execute function private.reject_check_in_event_change();

create function private.can_manage_wedding_day(p_wedding_id uuid) returns boolean
language sql stable security definer set search_path = '' as $function$
  select exists (select 1 from public.weddings w
    where w.id = p_wedding_id and w.status = 'ACTIVE')
    and (private.has_active_wedding_role(p_wedding_id,
      array['OWNER','FULL_COORDINATOR','DAY_OF_COORDINATOR']::public.wedding_membership_role[])
      or private.controls_coordinator_managed_wedding(p_wedding_id));
$function$;

-- A single RPC transaction and row lock serialize all operations for one Guest.
-- The RPC never writes RSVP, Seating, or Guest Pass records.
create function public.wedding_day_check_in(
  p_wedding_id uuid, p_guest_id uuid default null, p_qr_token text default null,
  p_client_event_id uuid default null, p_occurred_at timestamptz default null,
  p_household_id uuid default null
) returns jsonb language plpgsql volatile security definer set search_path = '' as $function$
declare
  v_guest_id uuid;
  v_pass private.guest_passes;
  v_rsvp public.guest_rsvp_status;
  v_name text;
  v_reference text;
  v_previous public.guest_check_in_events;
  v_existing public.guest_check_in_events;
  v_event_id uuid;
  v_client_event_id uuid := coalesce(p_client_event_id, gen_random_uuid());
begin
  if (select auth.uid()) is null or not private.can_scan_guest_pass(p_wedding_id) then
    raise exception 'Wedding-Day check-in is not permitted' using errcode = '42501';
  end if;
  if (p_guest_id is null) = (p_qr_token is null) then
    raise exception 'Specify one Guest ID or QR token' using errcode = '22023';
  end if;
  if p_qr_token is not null then
    if p_household_id is not null then
      raise exception 'Household selection requires manual check-in' using errcode = '22023';
    end if;
    if p_qr_token !~ '^[0-9a-f]{64}$' then
      return jsonb_build_object('status','NOT_RECOGNIZED');
    end if;
    select * into v_pass from private.guest_passes
      where token_hash = extensions.digest(p_qr_token, 'sha256');
    if not found then return jsonb_build_object('status','NOT_RECOGNIZED'); end if;
    if v_pass.wedding_id <> p_wedding_id then
      return jsonb_build_object('status','DIFFERENT_WEDDING');
    end if;
    if v_pass.revoked_at is not null then
      return jsonb_build_object('status','REVOKED_PASS');
    end if;
    v_guest_id := v_pass.guest_id;
    v_reference := v_pass.reference;
  else
    select g.id into v_guest_id from public.guests g
      where g.wedding_id = p_wedding_id and g.id = p_guest_id
        and (p_household_id is null or g.household_id = p_household_id);
    if not found then return jsonb_build_object('status','NOT_RECOGNIZED'); end if;
  end if;

  select r.status, p.display_name into v_rsvp, v_name
    from public.guest_rsvps r
    join public.guests g on g.wedding_id = r.wedding_id and g.id = r.guest_id
    join public.wedding_people p on p.wedding_id = g.wedding_id and p.id = g.person_id
    where r.wedding_id = p_wedding_id and r.guest_id = v_guest_id
    for update of r;
  if not found then return jsonb_build_object('status','NOT_RECOGNIZED'); end if;
  select * into v_existing from public.guest_check_in_events
    where wedding_id = p_wedding_id and client_event_id = v_client_event_id;
  if found then
    if v_existing.guest_id <> v_guest_id or v_existing.event_type <> 'CHECK_IN' then
      raise exception 'Idempotency key was used for another operation' using errcode = '23505';
    end if;
    return jsonb_build_object('status','CHECKED_IN','guestId',v_guest_id,
      'name',v_name,'reference',v_reference,'eventId',v_existing.id,'replayed',true);
  end if;
  if v_rsvp = 'DECLINED' then return jsonb_build_object('status','DECLINED_REVIEW'); end if;
  if v_rsvp <> 'ATTENDING' then return jsonb_build_object('status','NO_RESPONSE_REVIEW'); end if;
  select * into v_previous from public.guest_check_in_events
    where wedding_id = p_wedding_id and guest_id = v_guest_id
    order by event_sequence desc limit 1;
  if found and v_previous.event_type = 'CHECK_IN' then
    return jsonb_build_object('status','ALREADY_CHECKED_IN','guestId',v_guest_id,
      'name',v_name,'reference',v_reference,'eventId',v_previous.id);
  end if;
  insert into public.guest_check_in_events
    (wedding_id,guest_id,event_type,source,occurred_at,recorded_by_user_id,client_event_id)
    values (p_wedding_id,v_guest_id,'CHECK_IN',
      case when p_qr_token is not null then 'QR'::public.guest_check_in_source
        when p_occurred_at is not null then 'OFFLINE_SYNC'::public.guest_check_in_source
        else 'MANUAL'::public.guest_check_in_source end,
      coalesce(p_occurred_at,now()),(select auth.uid()),v_client_event_id)
    returning id into v_event_id;
  return jsonb_build_object('status','CHECKED_IN','guestId',v_guest_id,
    'name',v_name,'reference',v_reference,'eventId',v_event_id,'replayed',false);
end;
$function$;

create function public.wedding_day_reverse_check_in(
  p_wedding_id uuid, p_guest_id uuid, p_client_event_id uuid default null,
  p_reason text default null, p_occurred_at timestamptz default null
) returns jsonb language plpgsql volatile security definer set search_path = '' as $function$
declare v_previous public.guest_check_in_events;
  v_existing public.guest_check_in_events;
  v_event_id uuid;
  v_client_event_id uuid := coalesce(p_client_event_id, gen_random_uuid());
begin
  if (select auth.uid()) is null or not private.can_scan_guest_pass(p_wedding_id) then
    raise exception 'Wedding-Day reversal is not permitted' using errcode = '42501';
  end if;
  perform 1 from public.guest_rsvps r
    where r.wedding_id = p_wedding_id and r.guest_id = p_guest_id for update;
  if not found then return jsonb_build_object('status','NOT_RECOGNIZED'); end if;
  select * into v_existing from public.guest_check_in_events
    where wedding_id = p_wedding_id and client_event_id = v_client_event_id;
  if found then
    if v_existing.guest_id <> p_guest_id or v_existing.event_type <> 'REVERSAL' then
      raise exception 'Idempotency key was used for another operation' using errcode = '23505';
    end if;
    return jsonb_build_object('status','REVERSED','guestId',p_guest_id,
      'eventId',v_existing.id,'replayed',true);
  end if;
  select * into v_previous from public.guest_check_in_events
    where wedding_id = p_wedding_id and guest_id = p_guest_id
    order by event_sequence desc limit 1;
  if not found or v_previous.event_type = 'REVERSAL' then
    return jsonb_build_object('status','NOT_CHECKED_IN');
  end if;
  insert into public.guest_check_in_events
    (wedding_id,guest_id,event_type,source,occurred_at,recorded_by_user_id,
     client_event_id,reverses_event_id,reversal_reason)
    values (p_wedding_id,p_guest_id,'REVERSAL',
      case when p_occurred_at is null then 'MANUAL'::public.guest_check_in_source
        else 'OFFLINE_SYNC'::public.guest_check_in_source end,
      coalesce(p_occurred_at,now()),(select auth.uid()),v_client_event_id,
      v_previous.id,nullif(btrim(p_reason),'')) returning id into v_event_id;
  return jsonb_build_object('status','REVERSED','guestId',p_guest_id,
    'eventId',v_event_id,'replayed',false);
end;
$function$;

create view public.guest_check_in_state with (security_invoker = true) as
select g.wedding_id, g.id as guest_id,
  coalesce(latest.event_type = 'CHECK_IN',false) as is_checked_in,
  latest.id as latest_event_id, latest.recorded_at as last_recorded_at
from public.guests g
left join lateral (
  select e.id,e.event_type,e.recorded_at from public.guest_check_in_events e
  where e.wedding_id = g.wedding_id and e.guest_id = g.id
  order by e.event_sequence desc limit 1
) latest on true;

create table public.wedding_day_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id),
  title text not null check (btrim(title) <> ''),
  description text,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  status public.wedding_day_item_status not null default 'UPCOMING',
  sort_order integer not null default 0,
  place_id uuid,
  created_by_user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_day_items_wedding_id_id_key unique (wedding_id,id),
  constraint wedding_day_items_place_same_wedding_fkey
    foreign key (wedding_id,place_id) references public.wedding_places(wedding_id,id),
  constraint wedding_day_items_scheduled_order_check
    check (scheduled_end is null or scheduled_end >= scheduled_start),
  constraint wedding_day_items_actual_order_check
    check (actual_end is null or (actual_start is not null and actual_end >= actual_start))
);
create index wedding_day_items_order_idx
  on public.wedding_day_items(wedding_id,sort_order,scheduled_start,id);
create index wedding_day_items_status_idx
  on public.wedding_day_items(wedding_id,status,scheduled_start);
create index wedding_day_items_created_by_idx
  on public.wedding_day_items(created_by_user_id);
create index wedding_day_items_place_idx
  on public.wedding_day_items(wedding_id,place_id);
create trigger wedding_day_items_set_updated_at before update on public.wedding_day_items
  for each row execute function private.set_updated_at();

create table public.wedding_day_item_memberships (
  wedding_id uuid not null,
  item_id uuid not null,
  membership_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (item_id,membership_id),
  constraint wedding_day_item_memberships_item_same_wedding_fkey
    foreign key (wedding_id,item_id) references public.wedding_day_items(wedding_id,id) on delete cascade,
  constraint wedding_day_item_memberships_member_same_wedding_fkey
    foreign key (wedding_id,membership_id) references public.wedding_memberships(wedding_id,id)
);
create index wedding_day_item_memberships_member_idx
  on public.wedding_day_item_memberships(wedding_id,membership_id);
create index wedding_day_item_memberships_item_wedding_idx
  on public.wedding_day_item_memberships(wedding_id,item_id);
create function private.require_active_wedding_day_assignee() returns trigger
language plpgsql set search_path = '' as $function$
begin
  if not exists (select 1 from public.wedding_memberships m
    where m.wedding_id = new.wedding_id and m.id = new.membership_id
      and m.status = 'ACTIVE' and m.user_id is not null) then
    raise exception 'Responsible member must be active in this Wedding' using errcode = '23503';
  end if;
  return new;
end;
$function$;
create trigger wedding_day_item_memberships_require_active
  before insert or update on public.wedding_day_item_memberships
  for each row execute function private.require_active_wedding_day_assignee();

create function public.wedding_day_dashboard(p_wedding_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $function$
declare v_total integer; v_checked integer; v_current jsonb; v_next jsonb; v_delayed jsonb;
begin
  if (select auth.uid()) is null or not private.has_active_wedding_membership(p_wedding_id) then
    raise exception 'Wedding-Day dashboard access is not permitted' using errcode = '42501';
  end if;
  select count(*)::integer,
    count(*) filter (where coalesce(s.is_checked_in,false))::integer
    into v_total,v_checked
  from public.guest_rsvps r
  left join public.guest_check_in_state s
    on s.wedding_id = r.wedding_id and s.guest_id = r.guest_id
  where r.wedding_id = p_wedding_id and r.status = 'ATTENDING';
  select to_jsonb(i) - 'created_by_user_id' - 'wedding_id'
    into v_current from public.wedding_day_items i
    where i.wedding_id = p_wedding_id and i.status = 'IN_PROGRESS'
    order by i.actual_start nulls last,i.sort_order,i.id limit 1;
  select to_jsonb(i) - 'created_by_user_id' - 'wedding_id'
    into v_next from public.wedding_day_items i
    where i.wedding_id = p_wedding_id and i.status = 'UPCOMING'
    order by i.scheduled_start,i.sort_order,i.id limit 1;
  select coalesce(jsonb_agg(to_jsonb(i) - 'created_by_user_id' - 'wedding_id'
    order by i.scheduled_start,i.sort_order,i.id),'[]'::jsonb)
    into v_delayed from public.wedding_day_items i
    where i.wedding_id = p_wedding_id and i.status = 'DELAYED';
  return jsonb_build_object('totalAttending',v_total,'checkedIn',v_checked,
    'remaining',v_total-v_checked,'currentItem',v_current,'nextItem',v_next,
    'delayedItems',v_delayed);
end;
$function$;

alter table public.guest_check_in_events enable row level security;
alter table public.wedding_day_items enable row level security;
alter table public.wedding_day_item_memberships enable row level security;
create policy guest_check_in_events_select_member on public.guest_check_in_events
  for select to authenticated using ((select private.has_active_wedding_membership(wedding_id)));
create policy wedding_day_items_select_member on public.wedding_day_items
  for select to authenticated using ((select private.has_active_wedding_membership(wedding_id)));
create policy wedding_day_items_insert_manager on public.wedding_day_items
  for insert to authenticated with check ((select private.can_manage_wedding_day(wedding_id)));
create policy wedding_day_items_update_manager on public.wedding_day_items
  for update to authenticated using ((select private.can_manage_wedding_day(wedding_id)))
  with check ((select private.can_manage_wedding_day(wedding_id)));
create policy wedding_day_items_delete_manager on public.wedding_day_items
  for delete to authenticated using ((select private.can_manage_wedding_day(wedding_id)));
create policy wedding_day_item_memberships_select_member on public.wedding_day_item_memberships
  for select to authenticated using ((select private.has_active_wedding_membership(wedding_id)));
create policy wedding_day_item_memberships_insert_manager on public.wedding_day_item_memberships
  for insert to authenticated with check ((select private.can_manage_wedding_day(wedding_id)));
create policy wedding_day_item_memberships_delete_manager on public.wedding_day_item_memberships
  for delete to authenticated using ((select private.can_manage_wedding_day(wedding_id)));

revoke all on public.guest_check_in_events,public.wedding_day_items,
  public.wedding_day_item_memberships,public.guest_check_in_state
  from public,anon,authenticated,service_role;
grant select on public.guest_check_in_events,public.wedding_day_items,
  public.wedding_day_item_memberships,public.guest_check_in_state to authenticated;
grant insert(wedding_id,title,description,scheduled_start,scheduled_end,actual_start,
    actual_end,status,sort_order,place_id),
  update(title,description,scheduled_start,scheduled_end,actual_start,
    actual_end,status,sort_order,place_id),delete on public.wedding_day_items to authenticated;
grant insert(wedding_id,item_id,membership_id),delete
  on public.wedding_day_item_memberships to authenticated;
grant select,insert,update,delete on public.guest_check_in_events,
  public.wedding_day_items,public.wedding_day_item_memberships to service_role;
grant select on public.guest_check_in_state to service_role;
revoke all on type public.guest_check_in_event_type,public.guest_check_in_source,
  public.wedding_day_item_status from public,anon,authenticated,service_role;
grant usage on type public.guest_check_in_event_type,public.guest_check_in_source,
  public.wedding_day_item_status to authenticated,service_role;
revoke execute on function private.reject_check_in_event_change(),
  private.can_manage_wedding_day(uuid),private.require_active_wedding_day_assignee(),
  public.wedding_day_check_in(uuid,uuid,text,uuid,timestamptz,uuid),
  public.wedding_day_reverse_check_in(uuid,uuid,uuid,text,timestamptz),
  public.wedding_day_dashboard(uuid) from public,anon,authenticated,service_role;
grant execute on function private.can_manage_wedding_day(uuid),
  public.wedding_day_check_in(uuid,uuid,text,uuid,timestamptz,uuid),
  public.wedding_day_reverse_check_in(uuid,uuid,uuid,text,timestamptz),
  public.wedding_day_dashboard(uuid) to authenticated;

comment on table public.guest_check_in_events is
  'Append-only individual Guest attendance history. Current state is derived by event_sequence.';
comment on table public.wedding_day_items is
  'Operational Run of Show only; separate from the guest-facing Wedding program.';
comment on function public.wedding_day_check_in(uuid,uuid,text,uuid,timestamptz,uuid) is
  'Membership-checked, serialized Guest check-in with opaque QR and manual idempotency.';

commit;
