begin;
set local role postgres;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000009301','authenticated','authenticated','delivery-owner@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000009302','authenticated','authenticated','delivery-member@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000009303','authenticated','authenticated','delivery-outsider@katipan.test','{}','{}',now(),now());
insert into public.weddings(id,origin,status,ownership_mode,created_by_user_id,display_name) values
('10000000-0000-0000-0000-000000009301','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000009301','Delivery A'),
('10000000-0000-0000-0000-000000009302','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000009303','Delivery B');
insert into public.wedding_memberships(id,wedding_id,user_id,role) values
('20000000-0000-0000-0000-000000009301','10000000-0000-0000-0000-000000009301','00000000-0000-0000-0000-000000009301','OWNER'),
('20000000-0000-0000-0000-000000009302','10000000-0000-0000-0000-000000009301','00000000-0000-0000-0000-000000009302','FULL_COORDINATOR'),
('20000000-0000-0000-0000-000000009303','10000000-0000-0000-0000-000000009302','00000000-0000-0000-0000-000000009303','OWNER');
set constraints all immediate;

insert into public.wedding_notification_preferences(wedding_id,user_id,email_enabled,push_enabled,timezone)
values ('10000000-0000-0000-0000-000000009301','00000000-0000-0000-0000-000000009301',true,true,'Asia/Manila'),
('10000000-0000-0000-0000-000000009301','00000000-0000-0000-0000-000000009302',false,true,'UTC');
insert into public.wedding_notification_category_preferences(wedding_id,user_id,category,enabled)
values ('10000000-0000-0000-0000-000000009301','00000000-0000-0000-0000-000000009302','RSVP',false);

do $$ begin
  if has_table_privilege('anon','public.notification_devices','SELECT')
    or has_table_privilege('anon','private.notification_push_deliveries','SELECT')
    or has_function_privilege('authenticated','public.produce_payment_due_notifications(date)','EXECUTE')
    or has_function_privilege('authenticated','public.notification_delivery_destinations(uuid,uuid)','EXECUTE') then
    raise exception 'Notification delivery grant boundary failed';
  end if;
  if private.notification_next_delivery_at('2026-09-25 15:00+00','Asia/Manila',true,time '22:00',time '08:00')
      <> '2026-09-26 00:00+00'::timestamptz
    or private.notification_next_delivery_at('2026-09-25 23:00+00','Asia/Manila',true,time '22:00',time '08:00')
      <> '2026-09-26 00:00+00'::timestamptz then
    raise exception 'Overnight quiet hours failed';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009301',true);
insert into public.notification_devices(user_id,device_id,expo_push_token,platform) values
('00000000-0000-0000-0000-000000009301','30000000-0000-0000-0000-000000009301','ExpoPushToken[ownertoken123]','ios'),
('00000000-0000-0000-0000-000000009301','30000000-0000-0000-0000-000000009302','ExpoPushToken[ownertoken456]','android');
update public.notification_devices set enabled = false,revoked_at = now()
  where device_id = '30000000-0000-0000-0000-000000009302';
update public.notification_devices set enabled = true,revoked_at = null
  where device_id = '30000000-0000-0000-0000-000000009302';
do $$ begin
  begin
    insert into public.notification_devices(user_id,device_id,expo_push_token,platform) values
    ('00000000-0000-0000-0000-000000009302','30000000-0000-0000-0000-000000009303','ExpoPushToken[othertoken123]','ios');
    raise exception 'Cross-user destination insert was accepted';
  exception when insufficient_privilege then null; end;
end $$;
set local role postgres;
insert into public.notification_devices(user_id,device_id,expo_push_token,platform) values
('00000000-0000-0000-0000-000000009302','30000000-0000-0000-0000-000000009303','ExpoPushToken[othertoken123]','ios');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009301',true);
do $$ begin
  if (select count(*) from public.notification_devices) <> 2 then
    raise exception 'Cross-user destination read was allowed'; end if;
  update public.notification_devices set enabled = false
    where device_id = '30000000-0000-0000-0000-000000009303';
  if found then raise exception 'Cross-user destination update was allowed'; end if;
  delete from public.notification_devices where device_id = '30000000-0000-0000-0000-000000009303';
  if found then raise exception 'Cross-user destination deletion was allowed'; end if;
end $$;

set local role postgres;
insert into public.planning_tasks(id,wedding_id,title,created_by_user_id)
values('40000000-0000-0000-0000-000000009301','10000000-0000-0000-0000-000000009301',
  'Private task title','00000000-0000-0000-0000-000000009301');
insert into public.planning_task_assignees(wedding_id,task_id,membership_id)
values('10000000-0000-0000-0000-000000009301','40000000-0000-0000-0000-000000009301',
  '20000000-0000-0000-0000-000000009302');
update public.planning_tasks set status = 'IN_PROGRESS'
  where id = '40000000-0000-0000-0000-000000009301';
update public.planning_tasks set status = 'IN_PROGRESS'
  where id = '40000000-0000-0000-0000-000000009301';
do $$ begin
  if (select count(*) from public.notifications where recipient_user_id = '00000000-0000-0000-0000-000000009302'
    and category = 'PLANNING_TASK') <> 2 then raise exception 'Task event selection or no-op dedupe failed'; end if;
end $$;

insert into public.wedding_people(id,wedding_id,display_name) values
('50000000-0000-0000-0000-000000009301','10000000-0000-0000-0000-000000009301','Private Guest');
insert into public.guest_households(id,wedding_id,display_name) values
('60000000-0000-0000-0000-000000009301','10000000-0000-0000-0000-000000009301','Private Household'),
('60000000-0000-0000-0000-000000009302','10000000-0000-0000-0000-000000009301','Other Household');
insert into public.guests(id,wedding_id,person_id,household_id) values
('70000000-0000-0000-0000-000000009301','10000000-0000-0000-0000-000000009301',
 '50000000-0000-0000-0000-000000009301','60000000-0000-0000-0000-000000009301');
update public.guest_rsvps set status = 'ATTENDING',responded_at = now()
  where guest_id = '70000000-0000-0000-0000-000000009301';
update public.guest_households set delivery_status = 'SENT',sent_at = now()
  where id = '60000000-0000-0000-0000-000000009301';
update public.guests set household_id = '60000000-0000-0000-0000-000000009302'
  where id = '70000000-0000-0000-0000-000000009301';
do $$ begin
  if (select count(*) from public.notifications where category = 'RSVP') <> 1
    or (select count(*) from public.notifications where category = 'GUEST_UPDATE') <> 4
    or exists (select 1 from public.notifications where title ilike '%Private%' or body ilike '%Private%'
      or metadata ? 'token') then raise exception 'Guest event or payload safety failed'; end if;
end $$;

insert into public.suppliers(id,wedding_id,name,category)
values('80000000-0000-0000-0000-000000009301','10000000-0000-0000-0000-000000009301','Private Supplier','Catering');
insert into public.supplier_installments(id,wedding_id,supplier_id,amount,due_date) values
('90000000-0000-0000-0000-000000009301','10000000-0000-0000-0000-000000009301',
 '80000000-0000-0000-0000-000000009301',1000,current_date + 2);
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.produce_payment_due_notifications(current_date);
select public.produce_payment_due_notifications(current_date);
set local role postgres;
do $$ begin
  if (select count(*) from public.notifications where category = 'PAYMENT_DUE') <> 2 then
    raise exception 'Payment due recipient or idempotency failed'; end if;
end $$;

insert into public.wedding_day_items(id,wedding_id,title,scheduled_start,created_by_user_id)
values('a0000000-0000-0000-0000-000000009301','10000000-0000-0000-0000-000000009301',
  'Private Run of Show',now() + interval '1 day','00000000-0000-0000-0000-000000009301');
update public.wedding_day_items set status = 'DELAYED'
  where id = 'a0000000-0000-0000-0000-000000009301';
do $$ begin
  if (select count(*) from public.notifications where category = 'WEDDING_DAY') <> 2 then
    raise exception 'Wedding-Day recipient selection failed'; end if;
end $$;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
do $$ declare c record; v_context jsonb; v_device uuid; v_seen boolean := false; begin
  for c in select * from public.claim_notification_deliveries(100) loop
    if c.recipient_user_id = '00000000-0000-0000-0000-000000009301'
      and c.channel = 'PUSH' and not v_seen then
      v_seen := true;
      v_context := public.notification_delivery_destinations(c.outbox_id,c.claim_token);
      if jsonb_array_length(v_context->'devices') <> 2 then
        raise exception 'Multiple owned devices were not selected'; end if;
      v_device := (v_context->'devices'->0->>'id')::uuid;
      if not public.reserve_notification_push_delivery(c.outbox_id,c.claim_token,v_device)
        or public.reserve_notification_push_delivery(c.outbox_id,c.claim_token,v_device)
        or not public.finish_notification_push_delivery(c.outbox_id,c.claim_token,v_device,
          'ACCEPTED','ticket-1')
        or not public.finish_notification_delivery(c.outbox_id,c.claim_token,true)
        or public.finish_notification_delivery(c.outbox_id,c.claim_token,true) then
        raise exception 'Push reservation/retry idempotency failed'; end if;
    end if;
  end loop;
  if not v_seen then raise exception 'No push delivery was claimed'; end if;
end $$;
set local role postgres;
do $$ begin
  if exists (select 1 from public.notifications where wedding_id =
    '10000000-0000-0000-0000-000000009302') then
    raise exception 'Cross-Wedding notification leaked'; end if;
end $$;

-- A category or Wedding mute prevents new inbox rows; channel switches affect
-- outbox creation independently of inbox creation.
update public.wedding_notification_preferences set notifications_enabled = false
  where user_id = '00000000-0000-0000-0000-000000009301';
update public.guest_rsvps set status = 'DECLINED',responded_at = now()
  where guest_id = '70000000-0000-0000-0000-000000009301';
do $$ begin
  if (select count(*) from public.notifications where category = 'RSVP') <> 1 then
    raise exception 'Wedding mute or category opt-out failed'; end if;
end $$;
update public.wedding_notification_preferences set notifications_enabled = true,
  email_enabled = false,push_enabled = false
  where user_id = '00000000-0000-0000-0000-000000009301';
update public.guest_rsvps set status = 'ATTENDING',responded_at = now()
  where guest_id = '70000000-0000-0000-0000-000000009301';
do $$ begin
  if (select count(*) from public.notifications where category = 'RSVP') <> 2
    or exists (select 1 from private.notification_delivery_outbox o
      join public.notifications n on n.id = o.notification_id
      where n.idempotency_key = private.notification_event_uuid('rsvp:'||
        '70000000-0000-0000-0000-000000009301:DECLINED:ATTENDING:'||
        (select updated_at from public.guest_rsvps
          where guest_id = '70000000-0000-0000-0000-000000009301'))
        and n.recipient_user_id = '00000000-0000-0000-0000-000000009301') then
    raise exception 'Channel opt-out prevented inbox or created outbox'; end if;
end $$;

-- Role changes notify the target; removal cancels pending delivery but keeps inbox.
update public.wedding_memberships set role = 'GUEST_COORDINATOR'
  where id = '20000000-0000-0000-0000-000000009302';
do $$ begin
  if (select count(*) from public.notifications where category = 'MEMBERSHIP'
    and recipient_user_id = '00000000-0000-0000-0000-000000009302') <> 1 then
    raise exception 'Role change did not notify target'; end if;
end $$;
update public.wedding_memberships set status = 'REMOVED',ended_at = now()
  where id = '20000000-0000-0000-0000-000000009302';
do $$ begin
  if exists (select 1 from private.notification_delivery_outbox o
    join public.notifications n on n.id = o.notification_id
    where n.recipient_user_id = '00000000-0000-0000-0000-000000009302'
      and o.status in ('PENDING','CLAIMED','FAILED'))
    or (select count(*) from public.notifications where recipient_user_id =
      '00000000-0000-0000-0000-000000009302') < 1 then
    raise exception 'Removal did not cancel delivery and preserve inbox'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009302',true);
do $$ begin
  if (select count(*) from public.notifications) < 1 then
    raise exception 'Historical inbox is missing'; end if;
  if not public.mark_notification_read((select id from public.notifications limit 1)) then
    raise exception 'Read workflow broke'; end if;
  if (select count(*) from public.notification_devices) <> 1 then
    raise exception 'Destination ownership changed with membership'; end if;
end $$;

rollback;
