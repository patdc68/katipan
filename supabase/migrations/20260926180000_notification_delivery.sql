begin;

-- A destination belongs to a User installation, never to a Wedding membership.
create table public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  expo_push_token text not null check (
    expo_push_token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{8,200}\]$'),
  platform text not null check (platform in ('ios','android')),
  enabled boolean not null default true,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id),
  unique (expo_push_token),
  check (revoked_at is null or not enabled)
);
create index notification_devices_user_enabled_idx
  on public.notification_devices(user_id) where enabled and revoked_at is null;
create trigger notification_devices_updated_at before update on public.notification_devices
  for each row execute function private.set_updated_at();
alter table public.notification_devices enable row level security;
create policy notification_devices_select_own on public.notification_devices
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_devices_insert_own on public.notification_devices
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy notification_devices_update_own on public.notification_devices
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy notification_devices_delete_own on public.notification_devices
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.notification_devices from public,anon,authenticated,service_role;
grant select,delete on public.notification_devices to authenticated;
grant insert(user_id,device_id,expo_push_token,platform,enabled),
  update(user_id,device_id,expo_push_token,platform,enabled,revoked_at)
  on public.notification_devices to authenticated;
grant select,insert,update,delete on public.notification_devices to service_role;

-- An Expo request has no provider-side idempotency key. Reserve each device
-- before dispatch and never resend an ambiguous reservation.
create table private.notification_push_deliveries (
  outbox_id uuid not null references private.notification_delivery_outbox(id) on delete cascade,
  device_id uuid not null references public.notification_devices(id) on delete cascade,
  status text not null check (status in ('RESERVED','ACCEPTED','RETRYABLE','REJECTED','UNKNOWN')),
  expo_ticket_id text,
  reserved_at timestamptz not null default now(),
  finished_at timestamptz,
  receipt_checked_at timestamptz,
  primary key (outbox_id,device_id)
);
create index notification_push_deliveries_device_idx
  on private.notification_push_deliveries(device_id);
alter table private.notification_push_deliveries enable row level security;
revoke all on private.notification_push_deliveries from public,anon,authenticated,service_role;
grant select,insert,update on private.notification_push_deliveries to service_role;

-- Stable per-recipient UUID keys preserve the existing inbox/outbox uniqueness.
create function private.notification_event_uuid(p_key text)
returns uuid language sql immutable set search_path = '' as $function$
  select pg_catalog.md5(p_key)::uuid;
$function$;

create function private.emit_wedding_notification(
  p_wedding_id uuid, p_recipient_user_id uuid,
  p_category public.notification_category, p_event_key text,
  p_title text, p_body text, p_route text
) returns uuid language plpgsql security definer set search_path = '' as $function$
begin
  if not exists (select 1 from public.weddings w where w.id = p_wedding_id
      and w.status = 'ACTIVE' and w.deletion_requested_at is null)
    or not exists (select 1 from public.wedding_memberships m
      where m.wedding_id = p_wedding_id and m.user_id = p_recipient_user_id
        and m.status = 'ACTIVE') then
    return null;
  end if;
  return public.enqueue_notification(p_wedding_id,p_recipient_user_id,p_category,
    p_title,p_body,private.notification_event_uuid(p_event_key),
    pg_catalog.jsonb_build_object('route',p_route));
end;
$function$;

-- Task assignment and consequential task status/due-date changes only.
create function private.notify_task_assignment() returns trigger
language plpgsql security definer set search_path = '' as $function$
declare v_user uuid;
begin
  select m.user_id into v_user from public.wedding_memberships m
    where m.id = new.membership_id and m.wedding_id = new.wedding_id and m.status = 'ACTIVE';
  if v_user is not null then
    perform private.emit_wedding_notification(new.wedding_id,v_user,'PLANNING_TASK',
      'task-assigned:'||new.task_id||':'||new.membership_id||':'||new.assigned_at,
      'Planning task assigned','A planning task was assigned to you.','PLANNING');
  end if;
  return new;
end;
$function$;
create trigger notification_task_assignment after insert on public.planning_task_assignees
  for each row execute function private.notify_task_assignment();

create function private.notify_task_change() returns trigger
language plpgsql security definer set search_path = '' as $function$
declare v_user uuid;
begin
  if row(old.status,old.due_date) is not distinct from row(new.status,new.due_date) then
    return new;
  end if;
  for v_user in select distinct m.user_id from public.planning_task_assignees a
    join public.wedding_memberships m on m.id = a.membership_id
      and m.wedding_id = a.wedding_id and m.status = 'ACTIVE'
    where a.task_id = new.id and a.wedding_id = new.wedding_id loop
    perform private.emit_wedding_notification(new.wedding_id,v_user,'PLANNING_TASK',
      'task-change:'||new.id||':'||old.status||':'||new.status||':'||
        coalesce(old.due_date::text,'')||':'||coalesce(new.due_date::text,'')||':'||new.updated_at,
      'Planning task changed','A task assigned to you has a status or due date change.','PLANNING');
  end loop;
  return new;
end;
$function$;
create trigger notification_task_change after update of status,due_date on public.planning_tasks
  for each row execute function private.notify_task_change();

-- Guest-facing fields, names, notes, and responses never enter notification text.
create function private.notify_guest_event() returns trigger
language plpgsql security definer set search_path = '' as $function$
declare v_user uuid; v_key text; v_category public.notification_category;
begin
  if tg_table_name = 'guest_rsvps' then
    if old.status is not distinct from new.status then return new; end if;
    v_category := 'RSVP';
    v_key := 'rsvp:'||new.guest_id||':'||old.status||':'||new.status||':'||new.updated_at;
  elsif tg_table_name = 'guest_households' then
    if old.delivery_status is not distinct from new.delivery_status
      or new.delivery_status <> 'SENT' then return new; end if;
    v_category := 'GUEST_UPDATE';
    v_key := 'household-sent:'||new.id||':'||new.updated_at;
  else
    if old.household_id is not distinct from new.household_id then return new; end if;
    v_category := 'GUEST_UPDATE';
    v_key := 'guest-household:'||new.id||':'||new.updated_at;
  end if;
  for v_user in select m.user_id from public.wedding_memberships m
    where m.wedding_id = new.wedding_id and m.status = 'ACTIVE'
      and m.role in ('OWNER','FULL_COORDINATOR','GUEST_COORDINATOR') loop
    perform private.emit_wedding_notification(new.wedding_id,v_user,v_category,v_key,
      case when v_category = 'RSVP' then 'RSVP changed' else 'Guest list updated' end,
      case when v_category = 'RSVP' then 'An individual RSVP changed.'
        else 'An important guest or household update was made.' end,'GUESTS');
  end loop;
  return new;
end;
$function$;
create trigger notification_rsvp_change after update of status on public.guest_rsvps
  for each row execute function private.notify_guest_event();
create trigger notification_household_sent after update of delivery_status on public.guest_households
  for each row execute function private.notify_guest_event();
create trigger notification_guest_household_move after update of household_id on public.guests
  for each row execute function private.notify_guest_event();

create function private.notify_wedding_day_event() returns trigger
language plpgsql security definer set search_path = '' as $function$
declare v_user uuid;
begin
  if old.status is not distinct from new.status and
    old.scheduled_start is not distinct from new.scheduled_start then return new; end if;
  if new.status not in ('DELAYED','CANCELLED') and
    old.scheduled_start is not distinct from new.scheduled_start then return new; end if;
  for v_user in select m.user_id from public.wedding_memberships m
    where m.wedding_id = new.wedding_id and m.status = 'ACTIVE'
      and m.role in ('OWNER','FULL_COORDINATOR','DAY_OF_COORDINATOR') loop
    perform private.emit_wedding_notification(new.wedding_id,v_user,'WEDDING_DAY',
      'run-of-show:'||new.id||':'||old.status||':'||new.status||':'||new.updated_at,
      'Run of Show changed','An important Wedding-Day item changed. Review the timeline.',
      'WEDDING_DAY');
  end loop;
  return new;
end;
$function$;
create trigger notification_wedding_day_change
  after update of status,scheduled_start on public.wedding_day_items
  for each row execute function private.notify_wedding_day_event();

create function private.notify_membership_event() returns trigger
language plpgsql security definer set search_path = '' as $function$
declare v_user uuid; v_key text;
begin
  if tg_table_name = 'wedding_invitations' then
    if old.status = 'ACCEPTED' or new.status <> 'ACCEPTED' then return new; end if;
    v_key := 'invitation-accepted:'||new.id;
    for v_user in select m.user_id from public.wedding_memberships m
      where m.wedding_id = new.wedding_id and m.status = 'ACTIVE'
        and (m.role in ('OWNER','FULL_COORDINATOR') or m.user_id = new.accepted_by_user_id) loop
      perform private.emit_wedding_notification(new.wedding_id,v_user,'MEMBERSHIP',v_key,
        'Member joined','A Wedding invitation was accepted.','MEMBERS');
    end loop;
  else
    if old.role is distinct from new.role and new.status = 'ACTIVE' then
      perform private.emit_wedding_notification(new.wedding_id,new.user_id,'MEMBERSHIP',
        'member-role:'||new.id||':'||new.role||':'||new.updated_at,
        'Wedding role changed','Your Wedding role changed.','MEMBERS');
    elsif old.status = 'ACTIVE' and new.status in ('LEFT','REMOVED') then
      v_key := 'member-ended:'||new.id||':'||new.status||':'||new.ended_at;
      for v_user in select m.user_id from public.wedding_memberships m
        where m.wedding_id = new.wedding_id and m.status = 'ACTIVE'
          and m.role in ('OWNER','FULL_COORDINATOR') loop
        perform private.emit_wedding_notification(new.wedding_id,v_user,'MEMBERSHIP',v_key,
          'Wedding member left','A Wedding membership ended.','MEMBERS');
      end loop;
    end if;
  end if;
  return new;
end;
$function$;
create trigger notification_invitation_accepted after update of status on public.wedding_invitations
  for each row execute function private.notify_membership_event();
create trigger notification_membership_changed after update of role,status on public.wedding_memberships
  for each row execute function private.notify_membership_event();

-- SYSTEM is limited to a Wedding restored from ARCHIVED to ACTIVE.
create function private.notify_wedding_restored() returns trigger
language plpgsql security definer set search_path = '' as $function$
declare v_user uuid;
begin
  if old.status = 'ARCHIVED' and new.status = 'ACTIVE' then
    for v_user in select m.user_id from public.wedding_memberships m
      where m.wedding_id = new.id and m.status = 'ACTIVE'
        and m.role in ('OWNER','FULL_COORDINATOR') loop
      perform private.emit_wedding_notification(new.id,v_user,'SYSTEM',
        'wedding-restored:'||new.id||':'||new.updated_at,
        'Wedding restored','This Wedding is active again.','SETTINGS');
    end loop;
  end if;
  return new;
end;
$function$;
create trigger notification_wedding_restored after update of status on public.weddings
  for each row execute function private.notify_wedding_restored();

-- Invoke once per day from the worker. Exactly one upcoming (within seven
-- days) and one overdue notice per installment, regardless of reruns.
create function public.produce_payment_due_notifications(p_as_of date default current_date)
returns integer language plpgsql security definer set search_path = '' as $function$
declare v_row record; v_user uuid; v_count integer := 0; v_phase text;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  for v_row in
    select i.id,i.wedding_id,i.due_date,i.amount,
      coalesce(sum(case when t.kind = 'PAYMENT' then t.amount else -t.amount end),0) as paid
    from public.supplier_installments i
    left join public.supplier_payment_transactions t on t.installment_id = i.id
    join public.weddings w on w.id = i.wedding_id and w.status = 'ACTIVE'
      and w.deletion_requested_at is null
    where i.cancelled_at is null and i.due_date <= p_as_of + 7
    group by i.id
    having i.amount > coalesce(sum(case when t.kind = 'PAYMENT' then t.amount else -t.amount end),0)
  loop
    v_phase := case when v_row.due_date < p_as_of then 'overdue' else 'upcoming' end;
    for v_user in select m.user_id from public.wedding_memberships m
      where m.wedding_id = v_row.wedding_id and m.status = 'ACTIVE'
        and m.role in ('OWNER','FULL_COORDINATOR') loop
      if private.emit_wedding_notification(v_row.wedding_id,v_user,'PAYMENT_DUE',
        'installment-'||v_phase||':'||v_row.id||':'||v_row.due_date,
        case when v_phase = 'overdue' then 'Supplier installment overdue'
          else 'Supplier installment due soon' end,
        'Review a supplier installment in the budget.','BUDGET') is not null then
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;
  return v_count;
end;
$function$;

-- Return only the destination for the current claim. Recheck membership and
-- preferences immediately before dispatch; historical inbox rows remain.
create function public.notification_delivery_destinations(p_outbox_id uuid,p_claim_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_row record; v_pref public.wedding_notification_preferences; v_devices jsonb;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select o.channel,n.wedding_id,n.recipient_user_id,n.category,u.email
    into v_row from private.notification_delivery_outbox o
    join public.notifications n on n.id = o.notification_id
    join auth.users u on u.id = n.recipient_user_id
    where o.id = p_outbox_id and o.claim_token = p_claim_token and o.status = 'CLAIMED';
  if not found or not private.wedding_allows_guest_access(v_row.wedding_id)
    or not exists (select 1 from public.wedding_memberships m
      where m.wedding_id = v_row.wedding_id and m.user_id = v_row.recipient_user_id
        and m.status = 'ACTIVE') then return null; end if;
  select * into v_pref from public.wedding_notification_preferences p
    where p.wedding_id = v_row.wedding_id and p.user_id = v_row.recipient_user_id;
  if v_pref is null or not v_pref.notifications_enabled
    or (v_row.channel = 'EMAIL' and not v_pref.email_enabled)
    or (v_row.channel = 'PUSH' and not v_pref.push_enabled)
    or exists (select 1 from public.wedding_notification_category_preferences c
      where c.wedding_id = v_row.wedding_id and c.user_id = v_row.recipient_user_id
        and c.category = v_row.category and not c.enabled)
    then return null; end if;
  if private.notification_next_delivery_at(now(),v_pref.timezone,
      v_pref.quiet_hours_enabled,v_pref.quiet_hours_start,v_pref.quiet_hours_end) > now() then
    return jsonb_build_object('defer_until',private.notification_next_delivery_at(
      now(),v_pref.timezone,v_pref.quiet_hours_enabled,
      v_pref.quiet_hours_start,v_pref.quiet_hours_end));
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'token',d.expo_push_token,
    'delivery_status',pd.status)),
    '[]'::jsonb) into v_devices from public.notification_devices d
    left join private.notification_push_deliveries pd
      on pd.device_id = d.id and pd.outbox_id = p_outbox_id
    where d.user_id = v_row.recipient_user_id and d.enabled and d.revoked_at is null;
  return jsonb_build_object('email',case when v_row.channel = 'EMAIL' then v_row.email end,
    'devices',case when v_row.channel = 'PUSH' then v_devices else '[]'::jsonb end);
end;
$function$;

create function public.pending_notification_push_receipts(p_limit integer default 25)
returns table(outbox_id uuid,device_id uuid,ticket_id text)
language plpgsql security definer set search_path = '' as $function$
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
    or p_limit not between 1 and 100 then
    raise exception 'Service role required' using errcode = '42501'; end if;
  return query select d.outbox_id,d.device_id,d.expo_ticket_id
    from private.notification_push_deliveries d
    where d.status = 'ACCEPTED' and d.expo_ticket_id is not null
      and d.receipt_checked_at is null and d.finished_at < now() - interval '15 minutes'
    order by d.finished_at limit p_limit;
end;
$function$;

create function public.finish_notification_push_receipt(
  p_outbox_id uuid,p_device_id uuid,p_ticket_id text,p_registered boolean)
returns boolean language plpgsql security definer set search_path = '' as $function$
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501'; end if;
  update private.notification_push_deliveries set receipt_checked_at = now(),
    status = case when p_registered then 'ACCEPTED' else 'REJECTED' end
    where outbox_id = p_outbox_id and device_id = p_device_id
      and expo_ticket_id = p_ticket_id and status = 'ACCEPTED'
      and receipt_checked_at is null;
  if found and not p_registered then
    update public.notification_devices set enabled = false,revoked_at = now()
      where id = p_device_id;
  end if;
  return found;
end;
$function$;

create function public.defer_notification_delivery(
  p_outbox_id uuid,p_claim_token uuid,p_next_attempt_at timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $function$
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
    or p_next_attempt_at < now() or p_next_attempt_at > now() + interval '2 days' then
    raise exception 'Invalid delivery deferral' using errcode = '42501'; end if;
  update private.notification_delivery_outbox set status = 'PENDING',
    next_attempt_at = p_next_attempt_at,claim_token = null,claimed_at = null,
    attempt_count = greatest(0,attempt_count - 1)
    where id = p_outbox_id and claim_token = p_claim_token and status = 'CLAIMED';
  return found;
end;
$function$;

create function public.reserve_notification_push_delivery(
  p_outbox_id uuid,p_claim_token uuid,p_device_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $function$
declare v_recipient uuid;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501'; end if;
  select n.recipient_user_id into v_recipient from private.notification_delivery_outbox o
    join public.notifications n on n.id = o.notification_id
    where o.id = p_outbox_id and o.claim_token = p_claim_token
      and o.status = 'CLAIMED' and o.channel = 'PUSH';
  if v_recipient is null or public.notification_delivery_destinations(p_outbox_id,p_claim_token) is null
    or not exists (select 1 from public.notification_devices d where d.id = p_device_id
      and d.user_id = v_recipient and d.enabled and d.revoked_at is null) then return false; end if;
  insert into private.notification_push_deliveries(outbox_id,device_id,status)
    values(p_outbox_id,p_device_id,'RESERVED') on conflict do nothing;
  if found then return true; end if;
  update private.notification_push_deliveries set status = 'RESERVED',
    reserved_at = now(),finished_at = null
    where outbox_id = p_outbox_id and device_id = p_device_id and status = 'RETRYABLE';
  return found;
end;
$function$;

create function public.finish_notification_push_delivery(
  p_outbox_id uuid,p_claim_token uuid,p_device_id uuid,
  p_status text,p_ticket_id text default null)
returns boolean language plpgsql security definer set search_path = '' as $function$
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
    or p_status not in ('ACCEPTED','RETRYABLE','REJECTED','UNKNOWN') then
    raise exception 'Invalid push result' using errcode = '42501'; end if;
  update private.notification_push_deliveries d set status = p_status,
    expo_ticket_id = case when p_status = 'ACCEPTED' then p_ticket_id else null end,
    finished_at = now()
    where d.outbox_id = p_outbox_id and d.device_id = p_device_id and d.status = 'RESERVED'
      and exists (select 1 from private.notification_delivery_outbox o
        where o.id = p_outbox_id and o.claim_token = p_claim_token and o.status = 'CLAIMED');
  return found;
end;
$function$;

revoke execute on function private.notification_event_uuid(text),
  private.emit_wedding_notification(uuid,uuid,public.notification_category,text,text,text,text),
  private.notify_task_assignment(),private.notify_task_change(),private.notify_guest_event(),
  private.notify_wedding_day_event(),private.notify_membership_event(),
  private.notify_wedding_restored(),public.produce_payment_due_notifications(date),
  public.notification_delivery_destinations(uuid,uuid),
  public.pending_notification_push_receipts(integer),
  public.finish_notification_push_receipt(uuid,uuid,text,boolean),
  public.defer_notification_delivery(uuid,uuid,timestamptz),
  public.reserve_notification_push_delivery(uuid,uuid,uuid),
  public.finish_notification_push_delivery(uuid,uuid,uuid,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.produce_payment_due_notifications(date),
  public.notification_delivery_destinations(uuid,uuid),
  public.pending_notification_push_receipts(integer),
  public.finish_notification_push_receipt(uuid,uuid,text,boolean),
  public.defer_notification_delivery(uuid,uuid,timestamptz),
  public.reserve_notification_push_delivery(uuid,uuid,uuid),
  public.finish_notification_push_delivery(uuid,uuid,uuid,text,text)
  to service_role;

comment on table public.notification_devices is
  'User-owned Expo destinations. Device ID is an app-installation UUID, independent of Wedding membership.';
comment on table private.notification_push_deliveries is
  'Server-only per-device dispatch ledger. Ambiguous sends are not retried because Expo has no send idempotency key.';
comment on table private.notification_delivery_outbox is
  'Server-only email/push queue processed by notification-worker.';

commit;
