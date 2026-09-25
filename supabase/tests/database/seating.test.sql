begin;
set local role postgres;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000901','authenticated','authenticated','seat-owner@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000902','authenticated','authenticated','seat-full@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000903','authenticated','authenticated','seat-guest-coord@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000904','authenticated','authenticated','seat-day@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000905','authenticated','authenticated','seat-outsider@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000906','authenticated','authenticated','seat-other-owner@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000907','authenticated','authenticated','seat-controller@katipan.test','{}','{}',now(),now());
insert into public.weddings(id,origin,status,ownership_mode,created_by_user_id,display_name,wedding_date) values
('10000000-0000-0000-0000-000000000901','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000000901','Seating Wedding A','2027-02-01'),
('10000000-0000-0000-0000-000000000902','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000000906','Seating Wedding B','2027-03-01'),
('10000000-0000-0000-0000-000000000903','COORDINATOR_CREATED','ACTIVE','COORDINATOR_MANAGED','00000000-0000-0000-0000-000000000907','Managed Wedding','2027-04-01');
insert into public.wedding_memberships(wedding_id,user_id,role) values
('10000000-0000-0000-0000-000000000901','00000000-0000-0000-0000-000000000901','OWNER'),
('10000000-0000-0000-0000-000000000901','00000000-0000-0000-0000-000000000902','FULL_COORDINATOR'),
('10000000-0000-0000-0000-000000000901','00000000-0000-0000-0000-000000000903','GUEST_COORDINATOR'),
('10000000-0000-0000-0000-000000000901','00000000-0000-0000-0000-000000000904','DAY_OF_COORDINATOR'),
('10000000-0000-0000-0000-000000000902','00000000-0000-0000-0000-000000000906','OWNER'),
('10000000-0000-0000-0000-000000000903','00000000-0000-0000-0000-000000000907','FULL_COORDINATOR');
set constraints all immediate;
insert into public.guest_households(id,wedding_id,display_name) values
('20000000-0000-0000-0000-000000000901','10000000-0000-0000-0000-000000000901','Family A'),
('20000000-0000-0000-0000-000000000902','10000000-0000-0000-0000-000000000901','Family B'),
('20000000-0000-0000-0000-000000000903','10000000-0000-0000-0000-000000000902','Other Wedding Family');
insert into public.wedding_people(id,wedding_id,display_name) values
('30000000-0000-0000-0000-000000000901','10000000-0000-0000-0000-000000000901','Guest A1'),
('30000000-0000-0000-0000-000000000902','10000000-0000-0000-0000-000000000901','Guest A2'),
('30000000-0000-0000-0000-000000000903','10000000-0000-0000-0000-000000000901','Guest B1'),
('30000000-0000-0000-0000-000000000904','10000000-0000-0000-0000-000000000901','Unanswered'),
('30000000-0000-0000-0000-000000000905','10000000-0000-0000-0000-000000000902','Other Guest');
insert into public.guests(id,wedding_id,person_id,household_id) values
('40000000-0000-0000-0000-000000000901','10000000-0000-0000-0000-000000000901','30000000-0000-0000-0000-000000000901','20000000-0000-0000-0000-000000000901'),
('40000000-0000-0000-0000-000000000902','10000000-0000-0000-0000-000000000901','30000000-0000-0000-0000-000000000902','20000000-0000-0000-0000-000000000901'),
('40000000-0000-0000-0000-000000000903','10000000-0000-0000-0000-000000000901','30000000-0000-0000-0000-000000000903','20000000-0000-0000-0000-000000000902'),
('40000000-0000-0000-0000-000000000904','10000000-0000-0000-0000-000000000901','30000000-0000-0000-0000-000000000904','20000000-0000-0000-0000-000000000902'),
('40000000-0000-0000-0000-000000000905','10000000-0000-0000-0000-000000000902','30000000-0000-0000-0000-000000000905','20000000-0000-0000-0000-000000000903');
create temporary table seating_test_ids(name text primary key, id uuid not null) on commit drop;
grant all on seating_test_ids to authenticated, service_role;
create temporary table seating_test_tokens(name text primary key, token text not null) on commit drop;
grant all on seating_test_tokens to authenticated, service_role;

do $$ begin
  if has_table_privilege('anon','public.seating_assignments','SELECT')
    or has_table_privilege('authenticated','public.seating_assignments','INSERT')
    or has_function_privilege('anon','public.guest_wedding_guide(text,text)','EXECUTE') then
    raise exception 'Raw seating or guide privilege is too broad';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',true);
select public.set_guest_rsvp('40000000-0000-0000-0000-000000000901','ATTENDING');
select public.set_guest_rsvp('40000000-0000-0000-0000-000000000902','ATTENDING');
select public.set_guest_rsvp('40000000-0000-0000-0000-000000000903','ATTENDING');
insert into seating_test_ids values
('event_a',public.create_seating_event('10000000-0000-0000-0000-000000000901','Reception'));
do $$ begin
  begin
    perform public.create_seating_table((select id from seating_test_ids where name='event_a'),
      'Invalid Table',0);
    raise exception 'Non-positive Table capacity was accepted';
  exception when check_violation then null; end;
end $$;
insert into seating_test_ids values
('table_a',public.create_seating_table((select id from seating_test_ids where name='event_a'),'Family Table',2,'ROUND',1,'North','Near exit',0)),
('table_b',public.create_seating_table((select id from seating_test_ids where name='event_a'),'Friends Table',1,'RECTANGULAR',2,null,null,1));
insert into seating_test_ids values
('seat_a',public.create_seating_seat((select id from seating_test_ids where name='table_a'),'A1')),
('seat_b',public.create_seating_seat((select id from seating_test_ids where name='table_b'),'B1'));
insert into seating_test_ids values
('assignment_a1',public.seat_guest((select id from seating_test_ids where name='event_a'),
  '40000000-0000-0000-0000-000000000901',(select id from seating_test_ids where name='table_a'),
  (select id from seating_test_ids where name='seat_a')));
select public.seat_guest((select id from seating_test_ids where name='event_a'),
  '40000000-0000-0000-0000-000000000902',(select id from seating_test_ids where name='table_a'));
select public.seat_guest((select id from seating_test_ids where name='event_a'),
  '40000000-0000-0000-0000-000000000903',(select id from seating_test_ids where name='table_b'),
  (select id from seating_test_ids where name='seat_b'));

do $$
declare e uuid := (select id from seating_test_ids where name='event_a');
        a uuid := (select id from seating_test_ids where name='table_a');
        b uuid := (select id from seating_test_ids where name='table_b');
        sa uuid := (select id from seating_test_ids where name='seat_a');
begin
  if (select count(*) from public.seating_assignments where event_id=e) <> 3 then
    raise exception 'Initial seating count incorrect';
  end if;
  if (select count(*) from public.seating_assignments where event_id=e and seat_id is null) <> 1 then
    raise exception 'Exact seat should be optional';
  end if;
  if (select count(*) from public.guest_rsvps where wedding_id='10000000-0000-0000-0000-000000000901'
    and status='ATTENDING') <> 3 then raise exception 'Unseated RSVP changed'; end if;
  begin
    perform public.seat_guest(e,'40000000-0000-0000-0000-000000000904',a);
    raise exception 'NO_RESPONSE Guest was seated';
  exception when check_violation then null; end;
  perform public.set_guest_rsvp('40000000-0000-0000-0000-000000000904','DECLINED');
  begin
    perform public.seat_guest(e,'40000000-0000-0000-0000-000000000904',a);
    raise exception 'DECLINED Guest was seated';
  exception when check_violation then null; end;
  begin
    perform public.seat_guest(e,'40000000-0000-0000-0000-000000000902',a,sa);
    raise exception 'Seat was assigned twice';
  exception when unique_violation then null; end;
  begin
    perform public.seat_guest(e,'40000000-0000-0000-0000-000000000901',b);
    raise exception 'Full Table accepted move';
  exception when check_violation then null; end;
  if not exists (select 1 from public.seating_assignments
    where id=(select id from seating_test_ids where name='assignment_a1') and table_id=a and seat_id=sa) then
    raise exception 'Failed move did not preserve old Table and Seat';
  end if;
  begin
    perform public.update_seating_table(a,'Family Table',1,'ROUND',1,'North','Near exit',0);
    raise exception 'Capacity reduced below occupancy';
  exception when check_violation then null; end;
end $$;

select public.unseat_guest((select id from seating_test_ids where name='event_a'),
  '40000000-0000-0000-0000-000000000903');
do $$ begin
  if (select status from public.guest_rsvps where guest_id='40000000-0000-0000-0000-000000000903') <> 'ATTENDING' then
    raise exception 'Unseating altered RSVP';
  end if;
end $$;
do $$
begin
  begin
    perform public.seat_guest((select id from seating_test_ids where name='event_a'),
      '40000000-0000-0000-0000-000000000902',
      (select id from seating_test_ids where name='table_a'),
      (select id from seating_test_ids where name='seat_b'));
    raise exception 'Seat from another Table was accepted';
  exception when foreign_key_violation then null; end;
end $$;
select public.seat_guest((select id from seating_test_ids where name='event_a'),
  '40000000-0000-0000-0000-000000000901',(select id from seating_test_ids where name='table_b'));
select public.seat_guest((select id from seating_test_ids where name='event_a'),
  '40000000-0000-0000-0000-000000000903',(select id from seating_test_ids where name='table_a'));
select public.seat_guest((select id from seating_test_ids where name='event_a'),
  '40000000-0000-0000-0000-000000000902',(select id from seating_test_ids where name='table_a'),
  (select id from seating_test_ids where name='seat_a'));
select public.update_seating_seat((select id from seating_test_ids where name='seat_a'),'A1 Updated',0);
select public.update_seating_seat((select id from seating_test_ids where name='seat_a'),'A1',0);
do $$
declare e uuid := (select id from seating_test_ids where name='event_a');
        a uuid := (select id from seating_test_ids where name='table_a');
        b uuid := (select id from seating_test_ids where name='table_b');
begin
  if (select count(*) from public.seating_assignments where event_id=e and guest_id='40000000-0000-0000-0000-000000000901') <> 1
    or (select id from public.seating_assignments where event_id=e and guest_id='40000000-0000-0000-0000-000000000901')
      <> (select id from seating_test_ids where name='assignment_a1')
    or (select seat_id from public.seating_assignments where event_id=e and guest_id='40000000-0000-0000-0000-000000000901') is not null then
    raise exception 'Atomic move failed to retain one assignment or clear old Seat';
  end if;
  if not exists (select 1 from public.seating_assignments where event_id=e
      and guest_id='40000000-0000-0000-0000-000000000901' and table_id=b)
    or not exists (select 1 from public.seating_assignments where event_id=e
      and guest_id='40000000-0000-0000-0000-000000000902' and table_id=a) then
    raise exception 'Household split was blocked';
  end if;
  begin
    perform public.seat_guest(e,'40000000-0000-0000-0000-000000000901',a);
    raise exception 'Capacity failed to count a Table-only assignment';
  exception when check_violation then null; end;
end $$;
insert into public.wedding_websites(wedding_id,slug,access_mode) values
('10000000-0000-0000-0000-000000000901','seating-wedding-a','ANYONE_WITH_LINK');
insert into public.wedding_website_sections(wedding_id,section_key,section_type,sort_order,audience,enabled)
values ('10000000-0000-0000-0000-000000000901','intro','INTRO',0,'PUBLIC',true);
insert into seating_test_tokens values
('family_a',public.issue_household_website_token('20000000-0000-0000-0000-000000000901')),
('family_b',public.issue_household_website_token('20000000-0000-0000-0000-000000000902'));
select public.publish_wedding_website('10000000-0000-0000-0000-000000000901',true);

set local role service_role;
do $$
declare j jsonb; t text := (select token from seating_test_tokens where name='family_a');
begin
  j := public.guest_wedding_guide('seating-wedding-a',t);
  if j ? 'seating' then raise exception 'HIDDEN seating leaked'; end if;
  j := public.guest_wedding_guide('seating-wedding-a');
  if j ? 'seating' then raise exception 'Public seating leaked'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',true);
select public.set_seating_visibility((select id from seating_test_ids where name='event_a'),'TABLE_ONLY');
set local role service_role;
do $$
declare j jsonb; t text := (select token from seating_test_tokens where name='family_a');
begin
  j := public.guest_wedding_guide('seating-wedding-a',t);
  if jsonb_array_length(j->'seating') <> 2 or j::text like '%Guest B1%'
    or (j->'seating')::text like '%seatLabel%' then
    raise exception 'TABLE_ONLY Household projection invalid: %',j;
  end if;
  j := public.guest_wedding_guide('seating-wedding-a',(select token from seating_test_tokens where name='family_b'));
  if jsonb_array_length(j->'seating') <> 1
    or j->'seating'->0->>'guestId' <> '40000000-0000-0000-0000-000000000903' then
    raise exception 'Household token crossed Household: %',j;
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',true);
select public.set_seating_visibility((select id from seating_test_ids where name='event_a'),'TABLE_AND_SEAT');
set local role service_role;
do $$
declare j jsonb; t text := (select token from seating_test_tokens where name='family_a');
begin
  j := public.guest_wedding_guide('seating-wedding-a',t);
  if jsonb_array_length(j->'seating') <> 2
    or not exists (select 1 from jsonb_array_elements(j->'seating') x
      where x->>'guestId'='40000000-0000-0000-0000-000000000902' and x->>'seatLabel'='A1')
    or exists (select 1 from jsonb_array_elements(j->'seating') x
      where x->>'guestId'='40000000-0000-0000-0000-000000000901' and x ? 'seatLabel') then
    raise exception 'TABLE_AND_SEAT projection invalid: %',j;
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',true);
select public.delete_seating_seat((select id from seating_test_ids where name='seat_a'));
do $$ begin
  if not exists (select 1 from public.seating_assignments where guest_id='40000000-0000-0000-0000-000000000902'
    and table_id=(select id from seating_test_ids where name='table_a') and seat_id is null) then
    raise exception 'Seat deletion lost Table assignment';
  end if;
end $$;
set local role service_role;
select public.guest_submit_rsvp('seating-wedding-a',
  (select token from seating_test_tokens where name='family_a'),
  '40000000-0000-0000-0000-000000000902','DECLINED');
set local role postgres;
do $$ begin
  if exists (select 1 from public.seating_assignments where guest_id='40000000-0000-0000-0000-000000000902')
    or (select status from public.guest_rsvps where guest_id='40000000-0000-0000-0000-000000000902') <> 'DECLINED' then
    raise exception 'Household RSVP decline did not unseat';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',true);
select public.set_guest_rsvp('40000000-0000-0000-0000-000000000903','NO_RESPONSE');
do $$ begin
  if exists (select 1 from public.seating_assignments where guest_id='40000000-0000-0000-0000-000000000903') then
    raise exception 'Manager RSVP reset did not unseat';
  end if;
end $$;
select public.delete_seating_table((select id from seating_test_ids where name='table_b'));
do $$ begin
  if exists (select 1 from public.seating_assignments where guest_id='40000000-0000-0000-0000-000000000901')
    or not exists (select 1 from public.guests where id='40000000-0000-0000-0000-000000000901')
    or (select status from public.guest_rsvps where guest_id='40000000-0000-0000-0000-000000000901') <> 'ATTENDING' then
    raise exception 'Table deletion changed Guest or RSVP';
  end if;
end $$;
insert into seating_test_ids values
('future_event',public.create_seating_event('10000000-0000-0000-0000-000000000901',
  'After Party','AFTER_PARTY',1));
insert into seating_test_ids values
('future_table',public.create_seating_table(
  (select id from seating_test_ids where name='future_event'),'Late Table',1));
select public.seat_guest((select id from seating_test_ids where name='future_event'),
  '40000000-0000-0000-0000-000000000901',
  (select id from seating_test_ids where name='future_table'));
do $$ begin
  if (select count(*) from public.seating_assignments
    where guest_id='40000000-0000-0000-0000-000000000901') <> 1 then
    raise exception 'Future Seating Event could not seat Guest independently';
  end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',true);
select public.update_seating_event((select id from seating_test_ids where name='event_a'),'Reception Dinner','RECEPTION',0);
do $$ begin
  if (select count(*) from public.seating_events where wedding_id='10000000-0000-0000-0000-000000000901') <> 2 then
    raise exception 'Full Coordinator cannot read seating';
  end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000903',true);
select public.update_seating_table((select id from seating_test_ids where name='table_a'),
  'Family Table',2,'ROUND',1,'North','Near exit',0);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000904',true);
do $$
begin
  if (select count(*) from public.seating_assignments where wedding_id='10000000-0000-0000-0000-000000000901') <> 1
    or (select count(*) from public.seating_tables where wedding_id='10000000-0000-0000-0000-000000000901') <> 2 then
    raise exception 'Day-of Coordinator read failed';
  end if;
  begin
    perform public.set_seating_visibility((select id from seating_test_ids where name='event_a'),'HIDDEN');
    raise exception 'Day-of Coordinator changed visibility';
  exception when insufficient_privilege then null; end;
  begin
    perform public.delete_seating_table((select id from seating_test_ids where name='table_a'));
    raise exception 'Day-of Coordinator deleted Table';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000905',true);
do $$ begin
  if (select count(*) from public.seating_events) <> 0 then raise exception 'Unrelated user read seating'; end if;
  begin
    perform public.create_seating_event('10000000-0000-0000-0000-000000000901','Denied');
    raise exception 'Unrelated user created event';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000906',true);
do $$ begin
  if (select count(*) from public.seating_events) <> 0 then raise exception 'Cross-Wedding seating read'; end if;
  begin
    perform public.seat_guest((select id from seating_test_ids where name='event_a'),
      '40000000-0000-0000-0000-000000000905',(select id from seating_test_ids where name='table_a'));
    raise exception 'Cross-Wedding seating mutation';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000907',true);
insert into seating_test_ids values
('event_c',public.create_seating_event('10000000-0000-0000-0000-000000000903','Client Reception'));
do $$ begin
  if (select count(*) from public.seating_events where wedding_id='10000000-0000-0000-0000-000000000903') <> 1 then
    raise exception 'Temporary coordinator controller failed';
  end if;
end $$;
set local role postgres;
update public.seating_tables set capacity=2
  where id=(select id from seating_test_ids where name='future_table');
do $$ begin
  begin
    insert into public.seating_assignments(wedding_id,event_id,table_id,guest_id)
    values ('10000000-0000-0000-0000-000000000901',
      (select id from seating_test_ids where name='future_event'),
      (select id from seating_test_ids where name='future_table'),
      '40000000-0000-0000-0000-000000000901');
    raise exception 'Duplicate Guest/Event assignment was accepted';
  exception when unique_violation then null; end;
end $$;
set local role anon;
do $$ begin
  begin
    perform count(*) from public.seating_events;
    raise exception 'Anon read raw seating';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_seating_event('10000000-0000-0000-0000-000000000901','Anon');
    raise exception 'Anon created seating';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
