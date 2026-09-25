begin;

create type public.notification_category as enum (
  'PLANNING_TASK', 'RSVP', 'GUEST_UPDATE', 'PAYMENT_DUE',
  'WEDDING_DAY', 'MEMBERSHIP', 'SYSTEM'
);
create type public.notification_delivery_channel as enum ('EMAIL', 'PUSH');
create type public.notification_delivery_status as enum (
  'PENDING', 'CLAIMED', 'SENT', 'FAILED', 'SKIPPED'
);

-- pg_timezone_names contains PostgreSQL's IANA timezone catalogue. This is
-- deliberately checked at write time instead of trusting a client supplied offset.
create function private.is_valid_notification_timezone(p_timezone text)
returns boolean language sql stable set search_path = '' as $function$
  select exists (
    select 1 from pg_catalog.pg_timezone_names z where z.name = p_timezone
  );
$function$;

create table public.wedding_notification_preferences (
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time without time zone not null default time '22:00',
  quiet_hours_end time without time zone not null default time '08:00',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (wedding_id, user_id),
  constraint notification_preferences_timezone_valid
    check (private.is_valid_notification_timezone(timezone)),
  constraint notification_preferences_quiet_range_valid
    check (not quiet_hours_enabled or quiet_hours_start <> quiet_hours_end)
);
create index wedding_notification_preferences_user_idx
  on public.wedding_notification_preferences(user_id, wedding_id);
create trigger wedding_notification_preferences_set_updated_at
  before update on public.wedding_notification_preferences
  for each row execute function private.set_updated_at();

create table public.wedding_notification_category_preferences (
  wedding_id uuid not null,
  user_id uuid not null,
  category public.notification_category not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (wedding_id, user_id, category),
  foreign key (wedding_id, user_id)
    references public.wedding_notification_preferences(wedding_id, user_id)
    on delete cascade
);
create trigger wedding_notification_category_preferences_set_updated_at
  before update on public.wedding_notification_category_preferences
  for each row execute function private.set_updated_at();

-- Only routing hints and a UUID source reference may enter metadata. Titles
-- and summaries must be written by trusted server code and contain no secrets.
create function private.notification_metadata_valid(p_metadata jsonb)
returns boolean language sql immutable set search_path = '' as $function$
  select p_metadata is not null
    and pg_catalog.jsonb_typeof(p_metadata) = 'object'
    and p_metadata - 'source_kind' - 'source_id' - 'route' = '{}'::jsonb
    and (not p_metadata ? 'source_kind' or
      (pg_catalog.jsonb_typeof(p_metadata->'source_kind') = 'string' and
       p_metadata->>'source_kind' in
         ('TASK','RSVP','GUEST','PAYMENT','WEDDING_DAY','MEMBERSHIP','SYSTEM')))
    and (not p_metadata ? 'source_id' or
      (pg_catalog.jsonb_typeof(p_metadata->'source_id') = 'string' and
       p_metadata->>'source_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
    and (not p_metadata ? 'route' or
      (pg_catalog.jsonb_typeof(p_metadata->'route') = 'string' and
       p_metadata->>'route' in
         ('PLANNING','GUESTS','BUDGET','WEDDING_DAY','MEMBERS','SETTINGS')));
$function$;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references public.weddings(id) on delete set null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  category public.notification_category not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_title_safe check (
    char_length(btrim(title)) between 1 and 160 and
    title !~* '(https?://|bearer[[:space:]]|token[[:space:]:=]|secret[[:space:]:=])'
  ),
  constraint notifications_body_safe check (
    char_length(btrim(body)) between 1 and 1000 and
    body !~* '(https?://|bearer[[:space:]]|token[[:space:]:=]|secret[[:space:]:=])'
  ),
  constraint notifications_metadata_valid check (private.notification_metadata_valid(metadata)),
  constraint notifications_recipient_idempotency_key unique (recipient_user_id,idempotency_key)
);
create index notifications_recipient_wedding_created_idx
  on public.notifications(recipient_user_id,wedding_id,created_at desc,id desc);
create index notifications_wedding_id_idx
  on public.notifications(wedding_id) where wedding_id is not null;
create index notifications_recipient_unread_idx
  on public.notifications(recipient_user_id,created_at desc)
  where read_at is null;

create table private.notification_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel public.notification_delivery_channel not null,
  status public.notification_delivery_status not null default 'PENDING',
  next_attempt_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  claimed_at timestamptz,
  claim_token uuid,
  sent_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id,channel),
  constraint notification_delivery_error_code_safe check (
    last_error_code is null or last_error_code in
      ('PROVIDER_RETRY','PROVIDER_REJECTED','ADDRESS_UNAVAILABLE','DEVICE_UNAVAILABLE')
  )
);
create index notification_delivery_outbox_due_idx
  on private.notification_delivery_outbox(next_attempt_at,id)
  where status in ('PENDING','FAILED');
create trigger notification_delivery_outbox_set_updated_at
  before update on private.notification_delivery_outbox
  for each row execute function private.set_updated_at();

-- Quiet hours can cross midnight. The record is created immediately; only
-- email/push delivery is deferred. A local end time is resolved in the user's
-- IANA zone, including daylight-saving transitions.
create function private.notification_next_delivery_at(
  p_now timestamptz, p_timezone text, p_quiet_enabled boolean,
  p_start time without time zone, p_end time without time zone
) returns timestamptz language plpgsql stable set search_path = '' as $function$
declare v_local timestamp; v_end_date date;
begin
  if not p_quiet_enabled then return p_now; end if;
  if not private.is_valid_notification_timezone(p_timezone) or p_start = p_end then
    raise exception 'Invalid quiet hours or timezone' using errcode = '22023';
  end if;
  v_local := p_now at time zone p_timezone;
  if p_start < p_end then
    if v_local::time < p_start or v_local::time >= p_end then return p_now; end if;
    v_end_date := v_local::date;
  else
    if v_local::time >= p_start then
      v_end_date := v_local::date + 1;
    elsif v_local::time < p_end then
      v_end_date := v_local::date;
    else
      return p_now;
    end if;
  end if;
  return (v_end_date + p_end) at time zone p_timezone;
end;
$function$;

create function private.require_active_notification_recipient()
returns trigger language plpgsql set search_path = '' as $function$
begin
  if new.wedding_id is not null and not exists (
    select 1 from public.wedding_memberships m
    where m.wedding_id = new.wedding_id
      and m.user_id = new.recipient_user_id and m.status = 'ACTIVE'
  ) then
    raise exception 'Notification recipient is not an active Wedding member'
      using errcode = '23503';
  end if;
  return new;
end;
$function$;
create trigger notifications_require_active_recipient
  before insert on public.notifications
  for each row execute function private.require_active_notification_recipient();

create function private.protect_notification_update()
returns trigger language plpgsql set search_path = '' as $function$
begin
  if (to_jsonb(new) - 'read_at') <> (to_jsonb(old) - 'read_at')
    or old.read_at is not null or new.read_at is null then
    raise exception 'Only an unread notification may be marked read'
      using errcode = '42501';
  end if;
  new.read_at := now();
  return new;
end;
$function$;
create trigger notifications_protect_update
  before update on public.notifications
  for each row execute function private.protect_notification_update();

-- A membership lifecycle change invalidates outstanding claims as well as
-- pending work. The inbox rows themselves remain for audit and user history.
create function private.cancel_removed_member_notification_delivery()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if old.status = 'ACTIVE' and new.status <> 'ACTIVE' then
    update private.notification_delivery_outbox o set status = 'SKIPPED',
      claim_token = null
      from public.notifications n
      where n.id = o.notification_id and n.wedding_id = new.wedding_id
        and n.recipient_user_id = new.user_id
        and o.status in ('PENDING','FAILED','CLAIMED');
  end if;
  return new;
end;
$function$;
create trigger wedding_memberships_cancel_notification_delivery
  after update of status on public.wedding_memberships
  for each row execute function private.cancel_removed_member_notification_delivery();

alter table public.wedding_notification_preferences enable row level security;
alter table public.wedding_notification_category_preferences enable row level security;
alter table public.notifications enable row level security;
alter table private.notification_delivery_outbox enable row level security;

create policy notification_preferences_select_own
  on public.wedding_notification_preferences for select to authenticated
  using (user_id = (select auth.uid()) and
    (select private.has_active_wedding_membership(wedding_id)));
create policy notification_preferences_insert_own
  on public.wedding_notification_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and
    (select private.has_active_wedding_membership(wedding_id)));
create policy notification_preferences_update_own
  on public.wedding_notification_preferences for update to authenticated
  using (user_id = (select auth.uid()) and
    (select private.has_active_wedding_membership(wedding_id)))
  with check (user_id = (select auth.uid()) and
    (select private.has_active_wedding_membership(wedding_id)));
create policy notification_category_preferences_select_own
  on public.wedding_notification_category_preferences for select to authenticated
  using (user_id = (select auth.uid()) and
    (select private.has_active_wedding_membership(wedding_id)));
create policy notification_category_preferences_insert_own
  on public.wedding_notification_category_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and
    (select private.has_active_wedding_membership(wedding_id)));
create policy notification_category_preferences_update_own
  on public.wedding_notification_category_preferences for update to authenticated
  using (user_id = (select auth.uid()) and
    (select private.has_active_wedding_membership(wedding_id)))
  with check (user_id = (select auth.uid()) and
    (select private.has_active_wedding_membership(wedding_id)));
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_user_id = (select auth.uid()));
create policy notifications_mark_read_own on public.notifications
  for update to authenticated
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()) and read_at is not null);

revoke all on public.wedding_notification_preferences,
  public.wedding_notification_category_preferences,public.notifications,
  private.notification_delivery_outbox
  from public,anon,authenticated,service_role;
grant select on public.wedding_notification_preferences,
  public.wedding_notification_category_preferences,public.notifications to authenticated;
grant insert(wedding_id,user_id,notifications_enabled,email_enabled,push_enabled,
  quiet_hours_enabled,quiet_hours_start,quiet_hours_end,timezone),
  update(notifications_enabled,email_enabled,push_enabled,quiet_hours_enabled,
    quiet_hours_start,quiet_hours_end,timezone)
  on public.wedding_notification_preferences to authenticated;
grant insert(wedding_id,user_id,category,enabled),update(enabled)
  on public.wedding_notification_category_preferences to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant select,insert,update on public.wedding_notification_preferences,
  public.wedding_notification_category_preferences,public.notifications to service_role;
grant select,insert,update on private.notification_delivery_outbox to service_role;
grant usage on schema private to service_role;

revoke all on type public.notification_category,
  public.notification_delivery_channel,public.notification_delivery_status
  from public,anon,authenticated,service_role;
grant usage on type public.notification_category to authenticated,service_role;
grant usage on type public.notification_delivery_channel,
  public.notification_delivery_status to service_role;

-- Caller identity comes only from auth.uid(); the API never accepts a user ID.
create function public.get_wedding_notification_preferences(p_wedding_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $function$
declare v_result jsonb;
begin
  if (select auth.uid()) is null or
    not private.has_active_wedding_membership(p_wedding_id) then
    raise exception 'Wedding notification preferences unavailable' using errcode = '42501';
  end if;
  select to_jsonb(p) into v_result
    from public.wedding_notification_preferences p
    where p.wedding_id = p_wedding_id and p.user_id = (select auth.uid());
  return coalesce(v_result, jsonb_build_object(
    'wedding_id',p_wedding_id,'user_id',(select auth.uid()),
    'notifications_enabled',true,'email_enabled',false,'push_enabled',false,
    'quiet_hours_enabled',false,'quiet_hours_start','22:00:00',
    'quiet_hours_end','08:00:00','timezone','UTC',
    'created_at',null,'updated_at',null));
end;
$function$;

create function public.set_wedding_notification_preferences(
  p_wedding_id uuid, p_notifications_enabled boolean default null,
  p_email_enabled boolean default null, p_push_enabled boolean default null,
  p_quiet_hours_enabled boolean default null,
  p_quiet_hours_start time without time zone default null,
  p_quiet_hours_end time without time zone default null,
  p_timezone text default null
) returns public.wedding_notification_preferences
language plpgsql security invoker set search_path = '' as $function$
declare v_row public.wedding_notification_preferences;
begin
  if (select auth.uid()) is null or
    not private.has_active_wedding_membership(p_wedding_id) then
    raise exception 'Wedding notification preferences unavailable' using errcode = '42501';
  end if;
  insert into public.wedding_notification_preferences as pref (
    wedding_id,user_id,notifications_enabled,email_enabled,push_enabled,
    quiet_hours_enabled,quiet_hours_start,quiet_hours_end,timezone)
  values (p_wedding_id,(select auth.uid()),coalesce(p_notifications_enabled,true),
    coalesce(p_email_enabled,false),coalesce(p_push_enabled,false),
    coalesce(p_quiet_hours_enabled,false),coalesce(p_quiet_hours_start,time '22:00'),
    coalesce(p_quiet_hours_end,time '08:00'),coalesce(p_timezone,'UTC'))
  on conflict (wedding_id,user_id) do update set
    notifications_enabled = coalesce(p_notifications_enabled,pref.notifications_enabled),
    email_enabled = coalesce(p_email_enabled,pref.email_enabled),
    push_enabled = coalesce(p_push_enabled,pref.push_enabled),
    quiet_hours_enabled = coalesce(p_quiet_hours_enabled,pref.quiet_hours_enabled),
    quiet_hours_start = coalesce(p_quiet_hours_start,pref.quiet_hours_start),
    quiet_hours_end = coalesce(p_quiet_hours_end,pref.quiet_hours_end),
    timezone = coalesce(p_timezone,pref.timezone)
  returning * into v_row;
  return v_row;
end;
$function$;

create function public.set_wedding_notification_category(
  p_wedding_id uuid,p_category public.notification_category,p_enabled boolean
) returns public.wedding_notification_category_preferences
language plpgsql security invoker set search_path = '' as $function$
declare v_row public.wedding_notification_category_preferences;
begin
  if (select auth.uid()) is null or p_category is null or p_enabled is null or
    not private.has_active_wedding_membership(p_wedding_id) then
    raise exception 'Wedding notification category unavailable' using errcode = '42501';
  end if;
  perform public.set_wedding_notification_preferences(p_wedding_id);
  insert into public.wedding_notification_category_preferences as pref
    (wedding_id,user_id,category,enabled)
  values (p_wedding_id,(select auth.uid()),p_category,p_enabled)
  on conflict (wedding_id,user_id,category) do update set enabled = excluded.enabled
  returning * into v_row;
  return v_row;
end;
$function$;

create function public.mute_wedding_notifications(p_wedding_id uuid,p_muted boolean)
returns public.wedding_notification_preferences
language plpgsql security invoker set search_path = '' as $function$
begin
  if p_muted is null then raise exception 'Mute value is required' using errcode = '22023'; end if;
  return public.set_wedding_notification_preferences(
    p_wedding_id,p_notifications_enabled => not p_muted);
end;
$function$;

create function public.mark_notification_read(p_notification_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.notifications n set read_at = now()
    where n.id = p_notification_id and n.recipient_user_id = (select auth.uid())
      and n.read_at is null;
  return found;
end;
$function$;

create function public.mark_wedding_notifications_read(p_wedding_id uuid)
returns integer language plpgsql security invoker set search_path = '' as $function$
declare v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.notifications n set read_at = now()
    where n.wedding_id = p_wedding_id and n.recipient_user_id = (select auth.uid())
      and n.read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- Explicit server workflow: one idempotency key creates at most one inbox row
-- and one outbox row per enabled channel. No provider call occurs in SQL.
create function public.enqueue_notification(
  p_wedding_id uuid,p_recipient_user_id uuid,
  p_category public.notification_category,p_title text,p_body text,
  p_idempotency_key uuid,p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = '' as $function$
declare v_id uuid; v_pref public.wedding_notification_preferences;
begin
  if p_recipient_user_id is null or p_idempotency_key is null then
    raise exception 'Recipient and idempotency key are required' using errcode = '22023';
  end if;
  if p_wedding_id is not null then
    if not exists (select 1 from public.wedding_memberships m
      where m.wedding_id = p_wedding_id and m.user_id = p_recipient_user_id
        and m.status = 'ACTIVE') then
      raise exception 'Recipient is not an active Wedding member' using errcode = '42501';
    end if;
    select * into v_pref from public.wedding_notification_preferences p
      where p.wedding_id = p_wedding_id and p.user_id = p_recipient_user_id;
    if (v_pref is not null and not v_pref.notifications_enabled) or
      exists (select 1 from public.wedding_notification_category_preferences c
        where c.wedding_id = p_wedding_id and c.user_id = p_recipient_user_id
          and c.category = p_category and not c.enabled) then
      return null;
    end if;
  end if;
  insert into public.notifications(wedding_id,recipient_user_id,category,title,body,
    idempotency_key,metadata)
  values(p_wedding_id,p_recipient_user_id,p_category,p_title,p_body,
    p_idempotency_key,p_metadata)
  on conflict (recipient_user_id,idempotency_key) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.notifications
      where recipient_user_id = p_recipient_user_id
        and idempotency_key = p_idempotency_key;
    return v_id;
  end if;
  if p_wedding_id is not null and v_pref is not null then
    if v_pref.email_enabled then
      insert into private.notification_delivery_outbox(notification_id,channel,next_attempt_at)
      values(v_id,'EMAIL',private.notification_next_delivery_at(now(),v_pref.timezone,
        v_pref.quiet_hours_enabled,v_pref.quiet_hours_start,v_pref.quiet_hours_end));
    end if;
    if v_pref.push_enabled then
      insert into private.notification_delivery_outbox(notification_id,channel,next_attempt_at)
      values(v_id,'PUSH',private.notification_next_delivery_at(now(),v_pref.timezone,
        v_pref.quiet_hours_enabled,v_pref.quiet_hours_start,v_pref.quiet_hours_end));
    end if;
  end if;
  return v_id;
end;
$function$;

-- Workers claim due rows with row locks. Eligibility is rechecked at delivery
-- time so a removed member or a later opt-out is never sent a stale message.
create function public.claim_notification_deliveries(p_limit integer default 25)
returns table(outbox_id uuid,claim_token uuid,notification_id uuid,channel public.notification_delivery_channel,
  recipient_user_id uuid,title text,body text)
language plpgsql security definer set search_path = '' as $function$
declare v_row record; v_pref public.wedding_notification_preferences; v_due timestamptz;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Invalid delivery batch limit' using errcode = '22023';
  end if;
  for v_row in
    select o.id,o.notification_id,o.channel,n.wedding_id,n.recipient_user_id,
      n.category,n.title,n.body
    from private.notification_delivery_outbox o
    join public.notifications n on n.id = o.notification_id
    where ((o.status in ('PENDING','FAILED') and o.next_attempt_at <= now())
      or (o.status = 'CLAIMED' and o.claimed_at < now() - interval '5 minutes'))
      and o.attempt_count < 10
    order by o.next_attempt_at,o.id limit p_limit
    for update of o skip locked
  loop
    if v_row.wedding_id is not null then
      select * into v_pref from public.wedding_notification_preferences p
        where p.wedding_id = v_row.wedding_id and p.user_id = v_row.recipient_user_id;
      if not exists (select 1 from public.wedding_memberships m
        where m.wedding_id = v_row.wedding_id and m.user_id = v_row.recipient_user_id
          and m.status = 'ACTIVE')
        or v_pref is null or not v_pref.notifications_enabled
        or (v_row.channel = 'EMAIL' and not v_pref.email_enabled)
        or (v_row.channel = 'PUSH' and not v_pref.push_enabled)
        or exists (select 1 from public.wedding_notification_category_preferences c
          where c.wedding_id = v_row.wedding_id and c.user_id = v_row.recipient_user_id
            and c.category = v_row.category and not c.enabled) then
        update private.notification_delivery_outbox o set status = 'SKIPPED'
          where o.id = v_row.id;
        continue;
      end if;
      v_due := private.notification_next_delivery_at(now(),v_pref.timezone,
        v_pref.quiet_hours_enabled,v_pref.quiet_hours_start,v_pref.quiet_hours_end);
      if v_due > now() then
        update private.notification_delivery_outbox o set next_attempt_at = v_due
          where o.id = v_row.id;
        continue;
      end if;
    end if;
    update private.notification_delivery_outbox o
      set status = 'CLAIMED',claimed_at = now(),claim_token = gen_random_uuid(),
        attempt_count = attempt_count + 1
      where o.id = v_row.id;
    outbox_id := v_row.id;
    select o.claim_token into claim_token from private.notification_delivery_outbox o
      where o.id = v_row.id;
    notification_id := v_row.notification_id;
    channel := v_row.channel;
    recipient_user_id := v_row.recipient_user_id;
    title := v_row.title;
    body := v_row.body;
    return next;
  end loop;
end;
$function$;

create function public.finish_notification_delivery(
  p_outbox_id uuid,p_claim_token uuid,p_sent boolean,p_error_code text default null
) returns boolean language plpgsql security definer set search_path = '' as $function$
declare v_row private.notification_delivery_outbox;
begin
  if p_sent is null or (not p_sent and (p_error_code is null or p_error_code not in
    ('PROVIDER_RETRY','PROVIDER_REJECTED','ADDRESS_UNAVAILABLE','DEVICE_UNAVAILABLE'))) then
    raise exception 'Invalid delivery result' using errcode = '22023';
  end if;
  select * into v_row from private.notification_delivery_outbox
    where id = p_outbox_id for update;
  if v_row is null or v_row.status <> 'CLAIMED' or
    v_row.claim_token is distinct from p_claim_token then return false; end if;
  update private.notification_delivery_outbox
    set status = case when p_sent then 'SENT'::public.notification_delivery_status
      when p_error_code = 'PROVIDER_RETRY' and v_row.attempt_count < 10
        then 'FAILED'::public.notification_delivery_status
      else 'SKIPPED'::public.notification_delivery_status end,
      sent_at = case when p_sent then now() else null end,
      next_attempt_at = case when not p_sent and p_error_code = 'PROVIDER_RETRY'
        then now() + (power(2,v_row.attempt_count)::integer * interval '1 minute')
        else next_attempt_at end,
      last_error_code = case when p_sent then null else p_error_code end
    where id = p_outbox_id;
  return true;
end;
$function$;

revoke execute on function private.is_valid_notification_timezone(text),
  private.notification_metadata_valid(jsonb),
  private.notification_next_delivery_at(timestamptz,text,boolean,time,time),
  private.require_active_notification_recipient(),
  private.protect_notification_update(),
  private.cancel_removed_member_notification_delivery(),
  public.get_wedding_notification_preferences(uuid),
  public.set_wedding_notification_preferences(uuid,boolean,boolean,boolean,boolean,time,time,text),
  public.set_wedding_notification_category(uuid,public.notification_category,boolean),
  public.mute_wedding_notifications(uuid,boolean),
  public.mark_notification_read(uuid),
  public.mark_wedding_notifications_read(uuid),
  public.enqueue_notification(uuid,uuid,public.notification_category,text,text,uuid,jsonb),
  public.claim_notification_deliveries(integer),
  public.finish_notification_delivery(uuid,uuid,boolean,text)
  from public,anon,authenticated,service_role;
grant execute on function private.is_valid_notification_timezone(text),
  private.notification_metadata_valid(jsonb),
  public.get_wedding_notification_preferences(uuid),
  public.set_wedding_notification_preferences(uuid,boolean,boolean,boolean,boolean,time,time,text),
  public.set_wedding_notification_category(uuid,public.notification_category,boolean),
  public.mute_wedding_notifications(uuid,boolean),
  public.mark_notification_read(uuid),public.mark_wedding_notifications_read(uuid)
  to authenticated;
grant execute on function private.is_valid_notification_timezone(text),
  private.notification_metadata_valid(jsonb),
  private.notification_next_delivery_at(timestamptz,text,boolean,time,time),
  public.enqueue_notification(uuid,uuid,public.notification_category,text,text,uuid,jsonb),
  public.claim_notification_deliveries(integer),
  public.finish_notification_delivery(uuid,uuid,boolean,text)
  to service_role;

comment on table public.wedding_notification_preferences is
  'Authenticated User preferences for one Wedding; absent row means in-app enabled, email/push off.';
comment on table public.notifications is
  'Recipient-owned in-app inbox. Metadata accepts only bounded routing hints; no tokens or private documents.';
comment on table private.notification_delivery_outbox is
  'Server-only email/push delivery queue. Provider integration is intentionally deferred.';

commit;
