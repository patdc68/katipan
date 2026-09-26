begin;
set local role postgres;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000009201','authenticated','authenticated','notify-owner@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000009202','authenticated','authenticated','notify-member@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000009203','authenticated','authenticated','notify-other@katipan.test','{}','{}',now(),now());
insert into public.weddings(id,origin,status,ownership_mode,created_by_user_id,display_name) values
('10000000-0000-0000-0000-000000009201','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000009201','Notify A'),
('10000000-0000-0000-0000-000000009202','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000009201','Notify B');
insert into public.wedding_memberships(wedding_id,user_id,role) values
('10000000-0000-0000-0000-000000009201','00000000-0000-0000-0000-000000009201','OWNER'),
('10000000-0000-0000-0000-000000009202','00000000-0000-0000-0000-000000009201','OWNER'),
('10000000-0000-0000-0000-000000009201','00000000-0000-0000-0000-000000009202','FULL_COORDINATOR'),
('10000000-0000-0000-0000-000000009202','00000000-0000-0000-0000-000000009203','FULL_COORDINATOR');
set constraints all immediate;

do $$ begin
  if has_table_privilege('anon','public.notifications','SELECT')
    or has_table_privilege('anon','public.wedding_notification_preferences','SELECT')
    or has_function_privilege('anon','public.get_wedding_notification_preferences(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.enqueue_notification(uuid,uuid,public.notification_category,text,text,uuid,jsonb)','EXECUTE')
    or has_table_privilege('authenticated','public.notifications','INSERT')
    or has_table_privilege('authenticated','private.notification_delivery_outbox','SELECT') then
    raise exception 'Notification privilege boundary failed';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009201',true);
do $$ declare a jsonb; begin
  a := public.get_wedding_notification_preferences('10000000-0000-0000-0000-000000009201');
  if a->>'notifications_enabled' <> 'true' or a->>'email_enabled' <> 'false'
    or a->>'push_enabled' <> 'false' or a->>'timezone' <> 'UTC' then
    raise exception 'Default preferences failed';
  end if;
end $$;
select public.set_wedding_notification_preferences(
  '10000000-0000-0000-0000-000000009201',
  p_email_enabled => true,p_push_enabled => true,p_quiet_hours_enabled => true,
  p_quiet_hours_start => time '22:00',p_quiet_hours_end => time '08:00',
  p_timezone => 'Asia/Manila');
select public.set_wedding_notification_preferences(
  '10000000-0000-0000-0000-000000009202',p_email_enabled => false,
  p_timezone => 'UTC');
select public.set_wedding_notification_category(
  '10000000-0000-0000-0000-000000009201','RSVP',false);
do $$ begin
  if (select count(*) from public.wedding_notification_preferences
    where user_id = (select auth.uid())) <> 2
    or (select email_enabled from public.wedding_notification_preferences
      where wedding_id = '10000000-0000-0000-0000-000000009201'
        and user_id = (select auth.uid())) is not true
    or (select email_enabled from public.wedding_notification_preferences
      where wedding_id = '10000000-0000-0000-0000-000000009202'
        and user_id = (select auth.uid())) is not false
    or (select enabled from public.wedding_notification_category_preferences
      where wedding_id = '10000000-0000-0000-0000-000000009201'
        and user_id = (select auth.uid()) and category = 'RSVP') is not false then
    raise exception 'Per User + Wedding or category preference failed';
  end if;
  begin
    perform public.set_wedding_notification_preferences(
      '10000000-0000-0000-0000-000000009201',p_timezone => 'Mars/Olympus');
    raise exception 'Invalid timezone was accepted';
  exception when check_violation then null; end;
end $$;

set local role postgres;
do $$ begin
  if private.notification_next_delivery_at('2026-09-25 15:00+00',
    'Asia/Manila',true,time '22:00',time '08:00')
      <> '2026-09-26 00:00+00'::timestamptz
    or private.notification_next_delivery_at('2026-09-25 23:00+00',
      'Asia/Manila',true,time '22:00',time '08:00')
      <> '2026-09-26 00:00+00'::timestamptz
    or private.notification_next_delivery_at('2026-09-25 04:00+00',
      'Asia/Manila',true,time '22:00',time '08:00')
      <> '2026-09-25 04:00+00'::timestamptz then
    raise exception 'Quiet hours across midnight failed';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009202',true);
select public.set_wedding_notification_preferences(
  '10000000-0000-0000-0000-000000009201',p_notifications_enabled => false);
do $$ begin
  if (select count(*) from public.wedding_notification_preferences) <> 1 then
    raise exception 'Another member preferences were visible';
  end if;
  update public.wedding_notification_preferences set notifications_enabled = false
    where user_id = '00000000-0000-0000-0000-000000009201';
  if found then raise exception 'Another member preferences were mutable'; end if;
  begin
    perform public.get_wedding_notification_preferences(
      '10000000-0000-0000-0000-000000009202');
    raise exception 'Cross-Wedding preferences were accessible';
  exception when insufficient_privilege then null; end;
end $$;

set local role service_role;
do $$ declare v_id uuid; begin
  if public.enqueue_notification('10000000-0000-0000-0000-000000009201',
    '00000000-0000-0000-0000-000000009201','RSVP','RSVP updated','A response changed',
    '50000000-0000-0000-0000-000000009201') is not null then
    raise exception 'Disabled category created a notification';
  end if;
  v_id := public.enqueue_notification('10000000-0000-0000-0000-000000009201',
    '00000000-0000-0000-0000-000000009201','PLANNING_TASK','Task updated','A task changed',
    '50000000-0000-0000-0000-000000009202','{"route":"PLANNING"}'::jsonb);
  if v_id is null or v_id <> public.enqueue_notification(
    '10000000-0000-0000-0000-000000009201',
    '00000000-0000-0000-0000-000000009201','PLANNING_TASK','Task updated','A task changed',
    '50000000-0000-0000-0000-000000009202') then
    raise exception 'Idempotent enqueue failed';
  end if;
  begin
    perform public.enqueue_notification('10000000-0000-0000-0000-000000009201',
      '00000000-0000-0000-0000-000000009201','SYSTEM','Token notice','Sensitive token',
      '50000000-0000-0000-0000-000000009203','{"guest_token":"secret"}'::jsonb);
    raise exception 'Sensitive metadata was accepted';
  exception when check_violation then null; end;
  begin
    perform public.enqueue_notification('10000000-0000-0000-0000-000000009201',
      '00000000-0000-0000-0000-000000009201','SYSTEM','Link','https://secret.example',
      '50000000-0000-0000-0000-000000009204');
    raise exception 'Sensitive body was accepted';
  exception when check_violation then null; end;
  if (select count(*) from private.notification_delivery_outbox
    where notification_id = v_id) <> 2 then
    raise exception 'Email and push outbox rows missing';
  end if;
  perform public.enqueue_notification('10000000-0000-0000-0000-000000009201',
    '00000000-0000-0000-0000-000000009201','MEMBERSHIP','Member update','Membership changed',
    '50000000-0000-0000-0000-000000009207');
  insert into public.notifications(id,wedding_id,recipient_user_id,category,title,body,idempotency_key)
    values('60000000-0000-0000-0000-000000009201',
      '10000000-0000-0000-0000-000000009201',
      '00000000-0000-0000-0000-000000009202','SYSTEM',
      'Own inbox','A separate user message',
      '50000000-0000-0000-0000-000000009208');
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009201',true);
do $$ begin
  if (select count(*) from public.notifications) <> 2 then
    raise exception 'Inbox selection failed';
  end if;
  if public.mark_notification_read('60000000-0000-0000-0000-000000009201') then
    raise exception 'Another user notification was marked read';
  end if;
  if not public.mark_notification_read((select id from public.notifications
      where idempotency_key = '50000000-0000-0000-0000-000000009202'))
    or public.mark_notification_read((select id from public.notifications
      where idempotency_key = '50000000-0000-0000-0000-000000009202')) then
    raise exception 'Mark read idempotency failed';
  end if;
  if public.mark_wedding_notifications_read('10000000-0000-0000-0000-000000009201') <> 1
    or public.mark_wedding_notifications_read('10000000-0000-0000-0000-000000009201') <> 0 then
    raise exception 'Mark all read workflow failed';
  end if;
  perform public.mute_wedding_notifications('10000000-0000-0000-0000-000000009201',true);
  if (select notifications_enabled from public.wedding_notification_preferences
    where wedding_id = '10000000-0000-0000-0000-000000009201'
      and user_id = (select auth.uid())) then
    raise exception 'Wedding mute failed';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009202',true);
do $$ begin
  if (select count(*) from public.notifications) <> 1
    or not public.mark_notification_read('60000000-0000-0000-0000-000000009201') then
    raise exception 'Cross-user inbox isolation failed';
  end if;
end $$;
set local role service_role;
do $$ begin
  if public.enqueue_notification('10000000-0000-0000-0000-000000009201',
    '00000000-0000-0000-0000-000000009201','SYSTEM','Muted','Muted message',
    '50000000-0000-0000-0000-000000009205') is not null then
    raise exception 'Mute did not stop creation';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009201',true);
select public.mute_wedding_notifications('10000000-0000-0000-0000-000000009201',false);

set local role postgres;
update public.wedding_memberships set status = 'REMOVED',ended_at = now()
  where wedding_id = '10000000-0000-0000-0000-000000009201'
    and user_id = '00000000-0000-0000-0000-000000009202';
set local role service_role;
do $$ begin
  begin
    perform public.enqueue_notification('10000000-0000-0000-0000-000000009201',
      '00000000-0000-0000-0000-000000009202','SYSTEM','Removed','No delivery',
      '50000000-0000-0000-0000-000000009206');
    raise exception 'Removed membership received new notification';
  exception when insufficient_privilege then null; end;
end $$;
set local role postgres;
insert into public.wedding_memberships(wedding_id,user_id,role) values
('10000000-0000-0000-0000-000000009201','00000000-0000-0000-0000-000000009203','OWNER');
set constraints all immediate;
update public.wedding_memberships set status = 'REMOVED',ended_at = now()
  where wedding_id = '10000000-0000-0000-0000-000000009201'
    and user_id = '00000000-0000-0000-0000-000000009201';
update private.notification_delivery_outbox set next_attempt_at = now() - interval '1 second';
set local role service_role;
select * from public.claim_notification_deliveries(10);
set local role postgres;
do $$ begin
  if (select count(*) from private.notification_delivery_outbox where status = 'SKIPPED') <> 6
    or (select count(*) from public.notifications
      where recipient_user_id = '00000000-0000-0000-0000-000000009201') <> 3 then
    raise exception 'Removal did not stop delivery while preserving history';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009201',true);
do $$ begin
  if (select count(*) from public.notifications) <> 3 then
    raise exception 'Historical notification vanished after membership removal';
  end if;
end $$;
rollback;
