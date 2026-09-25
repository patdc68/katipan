begin;
set local role postgres;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000009101','authenticated','authenticated','day-owner@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000009102','authenticated','authenticated','day-full@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000009103','authenticated','authenticated','day-day@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000009104','authenticated','authenticated','day-guest@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000009105','authenticated','authenticated','day-other@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000009106','authenticated','authenticated','day-controller@katipan.test','{}','{}',now(),now());
insert into public.weddings(id,origin,status,ownership_mode,created_by_user_id,display_name) values
('10000000-0000-0000-0000-000000009101','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000009101','Day A'),
('10000000-0000-0000-0000-000000009102','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000009105','Day B'),
('10000000-0000-0000-0000-000000009103','COORDINATOR_CREATED','ACTIVE','COORDINATOR_MANAGED','00000000-0000-0000-0000-000000009106','Day Managed');
insert into public.wedding_memberships(wedding_id,user_id,role) values
('10000000-0000-0000-0000-000000009101','00000000-0000-0000-0000-000000009101','OWNER'),
('10000000-0000-0000-0000-000000009101','00000000-0000-0000-0000-000000009102','FULL_COORDINATOR'),
('10000000-0000-0000-0000-000000009101','00000000-0000-0000-0000-000000009103','DAY_OF_COORDINATOR'),
('10000000-0000-0000-0000-000000009101','00000000-0000-0000-0000-000000009104','GUEST_COORDINATOR'),
('10000000-0000-0000-0000-000000009102','00000000-0000-0000-0000-000000009105','OWNER'),
('10000000-0000-0000-0000-000000009103','00000000-0000-0000-0000-000000009106','FULL_COORDINATOR');
set constraints all immediate;
insert into public.guest_households(id,wedding_id,display_name) values
('20000000-0000-0000-0000-000000009101','10000000-0000-0000-0000-000000009101','Day Household'),
('20000000-0000-0000-0000-000000009102','10000000-0000-0000-0000-000000009102','Other Household');
insert into public.wedding_people(id,wedding_id,display_name) values
('30000000-0000-0000-0000-000000009101','10000000-0000-0000-0000-000000009101','Day Guest A'),
('30000000-0000-0000-0000-000000009102','10000000-0000-0000-0000-000000009101','Day Guest B'),
('30000000-0000-0000-0000-000000009103','10000000-0000-0000-0000-000000009101','Day Guest C'),
('30000000-0000-0000-0000-000000009104','10000000-0000-0000-0000-000000009102','Other Guest');
insert into public.guests(id,wedding_id,person_id,household_id) values
('40000000-0000-0000-0000-000000009101','10000000-0000-0000-0000-000000009101','30000000-0000-0000-0000-000000009101','20000000-0000-0000-0000-000000009101'),
('40000000-0000-0000-0000-000000009102','10000000-0000-0000-0000-000000009101','30000000-0000-0000-0000-000000009102','20000000-0000-0000-0000-000000009101'),
('40000000-0000-0000-0000-000000009103','10000000-0000-0000-0000-000000009101','30000000-0000-0000-0000-000000009103','20000000-0000-0000-0000-000000009101'),
('40000000-0000-0000-0000-000000009104','10000000-0000-0000-0000-000000009102','30000000-0000-0000-0000-000000009104','20000000-0000-0000-0000-000000009102');
create temporary table day_test(name text primary key, value jsonb not null) on commit drop;
grant all on day_test to authenticated;

do $$ begin
  if has_table_privilege('authenticated','public.guest_check_in_events','INSERT')
    or has_table_privilege('authenticated','public.guest_check_in_events','UPDATE')
    or has_table_privilege('authenticated','public.guest_check_in_events','DELETE')
    or has_function_privilege('anon','public.wedding_day_check_in(uuid,uuid,text,uuid,timestamptz,uuid)','EXECUTE')
    or has_function_privilege('anon','public.wedding_day_dashboard(uuid)','EXECUTE') then
    raise exception 'Check-in writes or dashboard leaked';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009101',true);
select public.set_guest_rsvp('40000000-0000-0000-0000-000000009101','ATTENDING');
select public.set_guest_rsvp('40000000-0000-0000-0000-000000009102','ATTENDING');
select public.set_guest_rsvp('40000000-0000-0000-0000-000000009103','DECLINED');
insert into day_test values ('pass',public.issue_guest_pass('40000000-0000-0000-0000-000000009101'));
insert into day_test values ('first',public.wedding_day_check_in(
  '10000000-0000-0000-0000-000000009101',null,
  (select value->>'qrPayload' from day_test where name='pass'),
  '50000000-0000-0000-0000-000000009101'));
do $$ declare a jsonb := (select value from day_test where name='first'); begin
  if a->>'status' <> 'CHECKED_IN' or a->>'replayed' <> 'false'
    or public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',null,
      (select value->>'qrPayload' from day_test where name='pass'),
      '50000000-0000-0000-0000-000000009101')->>'replayed' <> 'true'
    or public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',null,
      (select value->>'qrPayload' from day_test where name='pass'))->>'status' <> 'ALREADY_CHECKED_IN'
    or (select count(*) from public.guest_check_in_events where guest_id='40000000-0000-0000-0000-000000009101') <> 1
    or (select count(*) from public.seating_assignments) <> 0 then
    raise exception 'QR check-in, duplicate scan, or unseated Guest failed';
  end if;
end $$;
do $$ begin
  if public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',
    '40000000-0000-0000-0000-000000009103')->>'status' <> 'DECLINED_REVIEW'
    or (select status from public.guest_rsvps where guest_id='40000000-0000-0000-0000-000000009103') <> 'DECLINED'
    or public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',null,repeat('0',64))->>'status' <> 'NOT_RECOGNIZED'
    or public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',
      '40000000-0000-0000-0000-000000009104')->>'status' <> 'NOT_RECOGNIZED' then
    raise exception 'Review, invalid, or cross-Wedding manual outcome failed';
  end if;
  if (select is_checked_in from public.guest_check_in_state
    where guest_id='40000000-0000-0000-0000-000000009103') then
    raise exception 'Unscanned Guest is shown as checked in';
  end if;
end $$;
insert into day_test values ('manual',public.wedding_day_check_in(
  '10000000-0000-0000-0000-000000009101',
  '40000000-0000-0000-0000-000000009102',null,
  '50000000-0000-0000-0000-000000009102',null,
  '20000000-0000-0000-0000-000000009101'));
do $$ begin
  if (select value->>'status' from day_test where name='manual') <> 'CHECKED_IN'
    or (select count(*) from public.guest_check_in_events where wedding_id='10000000-0000-0000-0000-000000009101') <> 2
    or (select count(distinct guest_id) from public.guest_check_in_events where wedding_id='10000000-0000-0000-0000-000000009101') <> 2
    or public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',
      '40000000-0000-0000-0000-000000009102',null,
      '50000000-0000-0000-0000-000000009102')->>'replayed' <> 'true'
    or public.wedding_day_dashboard('10000000-0000-0000-0000-000000009101')->>'checkedIn' <> '2' then
    raise exception 'Household individual check-in or retry failed';
  end if;
end $$;
insert into day_test values ('reverse',public.wedding_day_reverse_check_in(
  '10000000-0000-0000-0000-000000009101',
  '40000000-0000-0000-0000-000000009101',
  '50000000-0000-0000-0000-000000009103','Wrong scan'));
do $$ begin
  if (select value->>'status' from day_test where name='reverse') <> 'REVERSED'
    or public.wedding_day_reverse_check_in('10000000-0000-0000-0000-000000009101',
      '40000000-0000-0000-0000-000000009101',
      '50000000-0000-0000-0000-000000009103')->>'replayed' <> 'true'
    or (select count(*) from public.guest_check_in_events where guest_id='40000000-0000-0000-0000-000000009101') <> 2
    or (select is_checked_in from public.guest_check_in_state where guest_id='40000000-0000-0000-0000-000000009101')
    or public.wedding_day_dashboard('10000000-0000-0000-0000-000000009101')->>'remaining' <> '1' then
    raise exception 'Reversal or dashboard failed';
  end if;
  begin
    update public.guest_check_in_events set reversal_reason='altered'
      where guest_id='40000000-0000-0000-0000-000000009101';
    raise exception 'History was mutable';
  exception when insufficient_privilege then null; end;
end $$;
set local role service_role;
do $$ begin
  begin
    delete from public.guest_check_in_events
      where guest_id='40000000-0000-0000-0000-000000009101';
    raise exception 'Privileged mutation erased check-in history';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009101',true);
do $$ begin
  if public.wedding_day_reverse_check_in('10000000-0000-0000-0000-000000009101',
    '40000000-0000-0000-0000-000000009102',
    '50000000-0000-0000-0000-000000009104')->>'status' <> 'REVERSED'
    or public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',
      '40000000-0000-0000-0000-000000009102',null,
      '50000000-0000-0000-0000-000000009105','2026-09-25T12:00:00Z') is null
    or (select source from public.guest_check_in_events
      where client_event_id='50000000-0000-0000-0000-000000009105') <> 'OFFLINE_SYNC'
    or public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',
      '40000000-0000-0000-0000-000000009102',null,
      '50000000-0000-0000-0000-000000009105')->>'replayed' <> 'true' then
    raise exception 'Offline manual synchronization failed';
  end if;
end $$;
do $$ begin
  if public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',
    '40000000-0000-0000-0000-000000009101',null,
    '50000000-0000-0000-0000-000000009101')->>'replayed' <> 'true'
    or (select count(*) from public.guest_check_in_events where guest_id='40000000-0000-0000-0000-000000009101') <> 2 then
    raise exception 'Old offline retry rechecked a reversed Guest';
  end if;
end $$;

insert into public.wedding_day_items(wedding_id,title,scheduled_start,scheduled_end,sort_order)
  values ('10000000-0000-0000-0000-000000009101','Ceremony',now(),now()+interval '1 hour',1),
    ('10000000-0000-0000-0000-000000009101','Reception',now()+interval '2 hours',now()+interval '3 hours',2);
do $$ declare first_id uuid; later_start timestamptz; begin
  select id into first_id from public.wedding_day_items where title='Ceremony';
  select scheduled_start into later_start from public.wedding_day_items where title='Reception';
  update public.wedding_day_items set status='DELAYED' where id=first_id;
  if (select status from public.wedding_day_items where id=first_id) <> 'DELAYED'
    or (select scheduled_start from public.wedding_day_items where title='Reception') <> later_start
    or jsonb_array_length(public.wedding_day_dashboard('10000000-0000-0000-0000-000000009101')->'delayedItems') <> 1 then
    raise exception 'Delay cascaded or dashboard omitted delayed item';
  end if;
  update public.wedding_day_items set status='IN_PROGRESS',actual_start=now() where id=first_id;
  if public.wedding_day_dashboard('10000000-0000-0000-0000-000000009101')->'currentItem'->>'title' <> 'Ceremony'
    or public.wedding_day_dashboard('10000000-0000-0000-0000-000000009101')->'nextItem'->>'title' <> 'Reception' then
    raise exception 'Current or next Run-of-Show item incorrect';
  end if;
  update public.wedding_day_items set status='COMPLETED',actual_end=now() where id=first_id;
  update public.wedding_day_items set status='SKIPPED' where id=first_id;
  update public.wedding_day_items set status='CANCELLED' where id=first_id;
  update public.wedding_day_items set status='UPCOMING',actual_start=null,actual_end=null where id=first_id;
end $$;
insert into public.wedding_day_item_memberships(wedding_id,item_id,membership_id)
select i.wedding_id,i.id,m.id from public.wedding_day_items i
  join public.wedding_memberships m on m.wedding_id=i.wedding_id
  where i.title='Ceremony' and m.user_id='00000000-0000-0000-0000-000000009103';
set local role postgres;
do $$ begin
  begin
    insert into public.wedding_day_item_memberships(wedding_id,item_id,membership_id)
    select i.wedding_id,i.id,m.id from public.wedding_day_items i
      cross join public.wedding_memberships m
      where i.title='Ceremony' and m.user_id='00000000-0000-0000-0000-000000009105';
    raise exception 'Cross-Wedding responsible member accepted';
  exception when foreign_key_violation then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009101',true);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009102',true);
insert into public.wedding_day_items(wedding_id,title,scheduled_start)
values ('10000000-0000-0000-0000-000000009101','Full item',now());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009103',true);
insert into public.wedding_day_items(wedding_id,title,scheduled_start)
values ('10000000-0000-0000-0000-000000009101','Day item',now());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009104',true);
do $$ begin
  if public.wedding_day_dashboard('10000000-0000-0000-0000-000000009101')->>'totalAttending' <> '2'
    or public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',
      '40000000-0000-0000-0000-000000009101')->>'status' <> 'CHECKED_IN' then
    raise exception 'Guest Coordinator dashboard or check-in denied';
  end if;
  begin
    insert into public.wedding_day_items(wedding_id,title,scheduled_start)
      values ('10000000-0000-0000-0000-000000009101','Forbidden',now());
    raise exception 'Guest Coordinator managed Run of Show';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009105',true);
select public.set_guest_rsvp('40000000-0000-0000-0000-000000009104','ATTENDING');
insert into day_test values ('otherpass',public.issue_guest_pass('40000000-0000-0000-0000-000000009104'));
do $$ begin
  if public.wedding_day_check_in('10000000-0000-0000-0000-000000009102',null,
    (select value->>'qrPayload' from day_test where name='pass'))->>'status' <> 'DIFFERENT_WEDDING'
    or public.wedding_day_check_in('10000000-0000-0000-0000-000000009102',null,
      repeat('0',64))->>'status' <> 'NOT_RECOGNIZED' then
    raise exception 'Other-Wedding or invalid QR outcome failed';
  end if;
  begin
    perform public.wedding_day_dashboard('10000000-0000-0000-0000-000000009101');
    raise exception 'Other Wedding dashboard leaked';
  exception when insufficient_privilege then null; end;
  begin
    perform public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',
      '40000000-0000-0000-0000-000000009101');
    raise exception 'Other Wedding check-in succeeded';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009101',true);
do $$ begin
  if public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',null,
    (select value->>'qrPayload' from day_test where name='otherpass'))->>'status' <> 'DIFFERENT_WEDDING'
    or not public.revoke_guest_pass('40000000-0000-0000-0000-000000009101')
    or public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',null,
      (select value->>'qrPayload' from day_test where name='pass'))->>'status' <> 'REVOKED_PASS'
    or (select count(*) from public.guest_check_in_events where guest_id='40000000-0000-0000-0000-000000009101') <> 3 then
    raise exception 'Revoked or other-Wedding QR handling failed';
  end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000009106',true);
insert into public.wedding_day_items(wedding_id,title,scheduled_start)
values ('10000000-0000-0000-0000-000000009103','Controller item',now());
set local role anon;
do $$ begin
  begin
    perform public.wedding_day_dashboard('10000000-0000-0000-0000-000000009101');
    raise exception 'Anon dashboard succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.wedding_day_check_in('10000000-0000-0000-0000-000000009101',
      '40000000-0000-0000-0000-000000009101');
    raise exception 'Anon check-in succeeded';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
