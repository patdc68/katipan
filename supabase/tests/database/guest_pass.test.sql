begin;
set local role postgres;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000001001','authenticated','authenticated','pass-owner@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000001002','authenticated','authenticated','pass-full@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000001003','authenticated','authenticated','pass-day@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000001004','authenticated','authenticated','pass-guest@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000001005','authenticated','authenticated','pass-other@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000001006','authenticated','authenticated','pass-controller@katipan.test','{}','{}',now(),now());
insert into public.weddings(id,origin,status,ownership_mode,created_by_user_id,display_name,wedding_date) values
('10000000-0000-0000-0000-000000001001','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000001001','Pass Wedding A','2027-02-01'),
('10000000-0000-0000-0000-000000001002','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000001005','Pass Wedding B','2027-03-01'),
('10000000-0000-0000-0000-000000001003','COORDINATOR_CREATED','ACTIVE','COORDINATOR_MANAGED','00000000-0000-0000-0000-000000001006','Pass Managed Wedding','2027-04-01');
insert into public.wedding_memberships(wedding_id,user_id,role) values
('10000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000001001','OWNER'),
('10000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000001002','FULL_COORDINATOR'),
('10000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000001003','DAY_OF_COORDINATOR'),
('10000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000001004','GUEST_COORDINATOR'),
('10000000-0000-0000-0000-000000001002','00000000-0000-0000-0000-000000001005','OWNER'),
('10000000-0000-0000-0000-000000001003','00000000-0000-0000-0000-000000001006','FULL_COORDINATOR');
set constraints all immediate;
insert into public.guest_households(id,wedding_id,display_name) values
('20000000-0000-0000-0000-000000001001','10000000-0000-0000-0000-000000001001','Pass Household A'),
('20000000-0000-0000-0000-000000001002','10000000-0000-0000-0000-000000001001','Pass Household B'),
('20000000-0000-0000-0000-000000001003','10000000-0000-0000-0000-000000001003','Managed Household'),
('20000000-0000-0000-0000-000000001004','10000000-0000-0000-0000-000000001002','Other Wedding Household');
insert into public.wedding_people(id,wedding_id,display_name) values
('30000000-0000-0000-0000-000000001001','10000000-0000-0000-0000-000000001001','Pass Guest A'),
('30000000-0000-0000-0000-000000001002','10000000-0000-0000-0000-000000001001','Pass Guest B'),
('30000000-0000-0000-0000-000000001003','10000000-0000-0000-0000-000000001001','Pass Guest C'),
('30000000-0000-0000-0000-000000001004','10000000-0000-0000-0000-000000001003','Managed Guest'),
('30000000-0000-0000-0000-000000001005','10000000-0000-0000-0000-000000001001','Pass Guest D'),
('30000000-0000-0000-0000-000000001006','10000000-0000-0000-0000-000000001002','Other Wedding Guest');
update public.wedding_people
set first_name='Private First', last_name='Private Last',
  email='pass-a-private@example.test', phone='+639170000001'
where id = '30000000-0000-0000-0000-000000001001';
insert into public.guests(id,wedding_id,person_id,household_id) values
('40000000-0000-0000-0000-000000001001','10000000-0000-0000-0000-000000001001','30000000-0000-0000-0000-000000001001','20000000-0000-0000-0000-000000001001'),
('40000000-0000-0000-0000-000000001002','10000000-0000-0000-0000-000000001001','30000000-0000-0000-0000-000000001002','20000000-0000-0000-0000-000000001002'),
('40000000-0000-0000-0000-000000001003','10000000-0000-0000-0000-000000001001','30000000-0000-0000-0000-000000001003','20000000-0000-0000-0000-000000001001'),
('40000000-0000-0000-0000-000000001004','10000000-0000-0000-0000-000000001003','30000000-0000-0000-0000-000000001004','20000000-0000-0000-0000-000000001003'),
('40000000-0000-0000-0000-000000001005','10000000-0000-0000-0000-000000001001','30000000-0000-0000-0000-000000001005','20000000-0000-0000-0000-000000001001'),
('40000000-0000-0000-0000-000000001006','10000000-0000-0000-0000-000000001002','30000000-0000-0000-0000-000000001006','20000000-0000-0000-0000-000000001004');
update public.guests
set internal_notes = 'Private planner note', accessibility_assistance_note = 'Private access note'
where id = '40000000-0000-0000-0000-000000001001';
create temporary table pass_test(name text primary key, result jsonb not null) on commit drop;
grant all on pass_test to authenticated, service_role;

do $$ begin
  if has_table_privilege('anon','private.guest_passes','SELECT')
    or has_table_privilege('authenticated','private.guest_passes','SELECT')
    or has_function_privilege('anon','public.guest_pass_lookup(uuid,text)','EXECUTE')
    or has_function_privilege('anon','public.issue_guest_pass(uuid)','EXECUTE')
    or has_function_privilege('anon','public.guest_wedding_guide(text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.guest_wedding_guide(text,text)','EXECUTE')
    or not has_function_privilege('service_role','public.guest_wedding_guide(text,text)','EXECUTE') then
    raise exception 'Pass secret or workflow exposed to anon/authenticated tables';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001001',true);
do $$ begin
  begin
    perform public.issue_guest_pass('40000000-0000-0000-0000-000000001001');
    raise exception 'NO_RESPONSE Guest received Pass';
  exception when check_violation then null; end;
end $$;
select public.set_guest_rsvp('40000000-0000-0000-0000-000000001001','ATTENDING');
select public.set_guest_rsvp('40000000-0000-0000-0000-000000001002','ATTENDING');
select public.set_guest_rsvp('40000000-0000-0000-0000-000000001003','DECLINED');
select public.set_guest_rsvp('40000000-0000-0000-0000-000000001005','ATTENDING');
insert into pass_test values
('a', public.issue_guest_pass('40000000-0000-0000-0000-000000001001')),
('b', public.issue_guest_pass('40000000-0000-0000-0000-000000001002')),
('d', public.issue_guest_pass('40000000-0000-0000-0000-000000001005'));
do $$
declare a jsonb := (select result from pass_test where name='a');
        b jsonb := (select result from pass_test where name='b');
        d jsonb := (select result from pass_test where name='d');
begin
  if a <> public.issue_guest_pass('40000000-0000-0000-0000-000000001001')
    or a <> public.get_guest_pass('40000000-0000-0000-0000-000000001001')
    or a->>'reference' = b->>'reference'
    or a->>'reference' = d->>'reference'
    or a->>'qrPayload' = b->>'qrPayload'
    or a->>'qrPayload' = d->>'qrPayload'
    or a->>'qrPayload' !~ '^[0-9a-f]{64}$'
    or a->>'qrPayload' like '%40000000%'
    or (select count(*) from public.seating_assignments) <> 0 then
    raise exception 'Pass issuance, randomness, uniqueness, or retry failed';
  end if;
  begin
    perform public.issue_guest_pass('40000000-0000-0000-0000-000000001003');
    raise exception 'DECLINED Guest received Pass';
  exception when check_violation then null; end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001005',true);
select public.set_guest_rsvp('40000000-0000-0000-0000-000000001006','ATTENDING');
insert into pass_test values ('other', public.issue_guest_pass('40000000-0000-0000-0000-000000001006'));
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001001',true);

set local role postgres;
insert into public.wedding_websites(wedding_id,slug,is_published,published_at,access_mode) values
('10000000-0000-0000-0000-000000001001','pass-wedding-a',true,now(),'INVITED_GUESTS_ONLY'),
('10000000-0000-0000-0000-000000001002','pass-wedding-b',true,now(),'INVITED_GUESTS_ONLY');
insert into private.household_website_tokens(wedding_id,household_id,token_hash) values
('10000000-0000-0000-0000-000000001001','20000000-0000-0000-0000-000000001001',extensions.digest(repeat('a',64),'sha256')),
('10000000-0000-0000-0000-000000001001','20000000-0000-0000-0000-000000001002',extensions.digest(repeat('b',64),'sha256')),
('10000000-0000-0000-0000-000000001002','20000000-0000-0000-0000-000000001004',extensions.digest(repeat('c',64),'sha256'));
set local role service_role;
do $$
declare a jsonb := public.guest_wedding_guide('pass-wedding-a',repeat('a',64));
        b jsonb := public.guest_wedding_guide('pass-wedding-a',repeat('b',64));
        other jsonb := public.guest_wedding_guide('pass-wedding-b',repeat('c',64));
begin
  if jsonb_array_length(a->'guestPasses') <> 2 or jsonb_array_length(b->'guestPasses') <> 1
    or jsonb_array_length(other->'guestPasses') <> 1
    or a->'guestPasses'->0->>'guestId' <> '40000000-0000-0000-0000-000000001001'
    or a->'guestPasses'->0->>'name' <> 'Pass Guest A'
    or a->'guestPasses'->1->>'guestId' <> '40000000-0000-0000-0000-000000001005'
    or a->'guestPasses'->1->>'name' <> 'Pass Guest D'
    or b->'guestPasses'->0->>'guestId' <> '40000000-0000-0000-0000-000000001002'
    or b->'guestPasses'->0->>'name' <> 'Pass Guest B'
    or other->'guestPasses'->0->>'guestId' <> '40000000-0000-0000-0000-000000001006'
    or other->'guestPasses'->0->>'name' <> 'Other Wedding Guest'
    or a::text like '%40000000-0000-0000-0000-000000001006%'
    or a::text like '%Other Wedding Guest%'
    or (select result->>'reference' from pass_test where name='a') <> (a->'guestPasses'->0->>'reference')
    or (select result->>'qrPayload' from pass_test where name='a') <> (a->'guestPasses'->0->>'qrPayload')
    or (select result->>'reference' from pass_test where name='d') <> (a->'guestPasses'->1->>'reference')
    or (select result->>'qrPayload' from pass_test where name='d') <> (a->'guestPasses'->1->>'qrPayload') then
    raise exception 'Household Pass projection leaked or omitted a Pass';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(a->'guestPasses') as pass_entry(value)
    where (select count(*) from jsonb_object_keys(pass_entry.value)) <> 5
      or pass_entry.value ?| array[
        'personId', 'linkedUserId', 'email', 'phone', 'firstName', 'lastName',
        'internalNotes', 'accessibilityAssistanceNote'
      ]
      or pass_entry.value::text like '%pass-a-private@example.test%'
      or pass_entry.value::text like '%Private access note%'
      or pass_entry.value::text like '%Private planner note%'
  ) then
    raise exception 'Private Wedding Person or Guest fields leaked into Guest Pass JSON';
  end if;
  begin
    perform public.guest_wedding_guide('pass-wedding-a',repeat('c',64));
    raise exception 'Invalid Household token retrieved Guide';
  exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001001',true);
do $$
declare e uuid; t uuid; s uuid; j jsonb;
begin
  e := public.create_seating_event('10000000-0000-0000-0000-000000001001','Reception');
  t := public.create_seating_table(e,'Table One',10);
  s := public.create_seating_seat(t,'Seat 1');
  perform public.seat_guest(e,'40000000-0000-0000-0000-000000001001',t,s);
  perform public.seat_guest(e,'40000000-0000-0000-0000-000000001005',t);
  perform public.set_seating_visibility(e,'TABLE_ONLY');
  j := public.get_guest_pass('40000000-0000-0000-0000-000000001001');
  if j <> (select result from pass_test where name='a') then
    raise exception 'Seating regenerated Pass';
  end if;
end $$;
set local role service_role;
do $$
declare j jsonb := public.guest_wedding_guide('pass-wedding-a',repeat('a',64));
begin
  if j->'guestPasses'->0->'seating'->0->>'tableName' <> 'Table One'
    or j->'guestPasses'->0->'seating'->0 ? 'seatLabel'
    or j->'guestPasses'->1->'seating'->0->>'tableName' <> 'Table One'
    or j->'guestPasses'->1->'seating'->0 ? 'seatLabel' then
    raise exception 'Dynamic TABLE_ONLY seating projection failed';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001001',true);
select public.set_seating_visibility(
  (select id from public.seating_events where wedding_id='10000000-0000-0000-0000-000000001001'),
  'TABLE_AND_SEAT'
);
set local role service_role;
do $$
declare j jsonb := public.guest_wedding_guide('pass-wedding-a',repeat('a',64));
begin
  if j->'guestPasses'->0->'seating'->0->>'tableName' <> 'Table One'
    or j->'guestPasses'->0->'seating'->0->>'seatLabel' <> 'Seat 1'
    or j->'guestPasses'->1->'seating'->0->>'tableName' <> 'Table One'
    or j->'guestPasses'->1->'seating'->0 ? 'seatLabel' then
    raise exception 'Dynamic TABLE_AND_SEAT seating projection failed';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001001',true);
select public.set_seating_visibility(
  (select id from public.seating_events where wedding_id='10000000-0000-0000-0000-000000001001'),
  'HIDDEN'
);
set local role service_role;
do $$
declare j jsonb := public.guest_wedding_guide('pass-wedding-a',repeat('a',64));
begin
  if jsonb_array_length(j->'guestPasses'->0->'seating') <> 0
    or jsonb_array_length(j->'guestPasses'->1->'seating') <> 0 then
    raise exception 'HIDDEN seating remained visible in Household Passes';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001001',true);
select public.set_seating_visibility(
  (select id from public.seating_events where wedding_id='10000000-0000-0000-0000-000000001001'),
  'TABLE_ONLY'
);

select public.set_guest_rsvp('40000000-0000-0000-0000-000000001003','ATTENDING');
insert into pass_test values ('c', public.issue_guest_pass('40000000-0000-0000-0000-000000001003'));
select public.set_guest_rsvp('40000000-0000-0000-0000-000000001003','DECLINED');
set local role service_role;
do $$
declare j jsonb := public.guest_wedding_guide('pass-wedding-a',repeat('a',64));
begin
  if jsonb_array_length(j->'guestPasses') <> 2
    or exists (
      select 1 from jsonb_array_elements(j->'guestPasses') as pass_entry(value)
      where pass_entry.value->>'guestId' = '40000000-0000-0000-0000-000000001003'
    ) then
    raise exception 'DECLINED Guest Pass was projected';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001001',true);
select public.set_guest_rsvp('40000000-0000-0000-0000-000000001003','NO_RESPONSE');
select public.set_guest_rsvp('40000000-0000-0000-0000-000000001005','NO_RESPONSE');
set local role service_role;
do $$
declare j jsonb := public.guest_wedding_guide('pass-wedding-a',repeat('a',64));
begin
  if jsonb_array_length(j->'guestPasses') <> 1
    or j->'guestPasses'->0->>'guestId' <> '40000000-0000-0000-0000-000000001001'
    or exists (
      select 1 from jsonb_array_elements(j->'guestPasses') as pass_entry(value)
      where pass_entry.value->>'guestId' in (
        '40000000-0000-0000-0000-000000001003', '40000000-0000-0000-0000-000000001005'
      )
    ) then
    raise exception 'NO_RESPONSE Guest Pass was projected';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001001',true);
do $$
declare token text := (select result->>'qrPayload' from pass_test where name='a');
begin
  if public.guest_pass_lookup('10000000-0000-0000-0000-000000001001',token)->>'status' <> 'VALID'
    or public.guest_pass_lookup('10000000-0000-0000-0000-000000001001',repeat('0',64))->>'status' <> 'NOT_RECOGNIZED' then
    raise exception 'Owner scanner lookup failed';
  end if;
end $$;
select public.set_guest_rsvp('40000000-0000-0000-0000-000000001001','DECLINED');
do $$ begin
  if public.guest_pass_lookup('10000000-0000-0000-0000-000000001001',
    (select result->>'qrPayload' from pass_test where name='a'))->>'status' <> 'DECLINED_REVIEW'
    or (select status from public.guest_rsvps where guest_id='40000000-0000-0000-0000-000000001001') <> 'DECLINED' then
    raise exception 'Declined Pass was not handled as review state';
  end if;
end $$;
set local role service_role;
do $$ begin
  if jsonb_array_length(public.guest_wedding_guide('pass-wedding-a',repeat('a',64))->'guestPasses') <> 0 then
    raise exception 'Declined Guest Pass remained visible in Household Guide';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001001',true);
select public.set_guest_rsvp('40000000-0000-0000-0000-000000001001','ATTENDING');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001002',true);
do $$ begin
  if public.guest_pass_lookup('10000000-0000-0000-0000-000000001001',
    (select result->>'qrPayload' from pass_test where name='a'))->>'status' <> 'VALID' then
    raise exception 'Full Coordinator scanner denied';
  end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001003',true);
do $$ begin
  if public.guest_pass_lookup('10000000-0000-0000-0000-000000001001',
    (select result->>'qrPayload' from pass_test where name='a'))->>'status' <> 'VALID' then
    raise exception 'Day-of scanner denied';
  end if;
  begin
    perform public.revoke_guest_pass('40000000-0000-0000-0000-000000001001');
    raise exception 'Day-of Coordinator revoked Pass';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001004',true);
do $$ begin
  if public.guest_pass_lookup('10000000-0000-0000-0000-000000001001',
    (select result->>'qrPayload' from pass_test where name='a'))->>'status' <> 'VALID' then
    raise exception 'Guest Coordinator scanner denied';
  end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001005',true);
do $$ begin
  if public.guest_pass_lookup('10000000-0000-0000-0000-000000001002',
    (select result->>'qrPayload' from pass_test where name='a'))->>'status' <> 'DIFFERENT_WEDDING' then
    raise exception 'Cross-Wedding scan leaked or returned wrong state';
  end if;
  begin
    perform public.guest_pass_lookup('10000000-0000-0000-0000-000000001001',
      (select result->>'qrPayload' from pass_test where name='a'));
    raise exception 'Cross-Wedding scanner accessed Guest';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001006',true);
select public.set_guest_rsvp('40000000-0000-0000-0000-000000001004','ATTENDING');
do $$ begin
  if public.issue_guest_pass('40000000-0000-0000-0000-000000001004')->>'reference' is null then
    raise exception 'Temporary controller could not issue Pass';
  end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001001',true);
do $$
declare old_token text := (select result->>'qrPayload' from pass_test where name='a');
begin
  if not public.revoke_guest_pass('40000000-0000-0000-0000-000000001001')
    or public.revoke_guest_pass('40000000-0000-0000-0000-000000001001') then
    raise exception 'Revoke was not idempotent';
  end if;
  if public.guest_pass_lookup('10000000-0000-0000-0000-000000001001',old_token)->>'status' <> 'REVOKED' then
    raise exception 'Revoked QR still valid';
  end if;
  begin
    perform public.issue_guest_pass('40000000-0000-0000-0000-000000001001');
    raise exception 'Normal issue silently replaced revoked QR';
  exception when check_violation then null; end;
end $$;
set local role service_role;
do $$
declare j jsonb := public.guest_wedding_guide('pass-wedding-a',repeat('a',64));
begin
  if jsonb_array_length(j->'guestPasses') <> 0 then
    raise exception 'Revoked Guest Pass remained projected';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001001',true);
do $$
declare old_token text := (select result->>'qrPayload' from pass_test where name='a');
        rotated jsonb;
begin
  rotated := public.rotate_guest_pass('40000000-0000-0000-0000-000000001001');
  if rotated->>'qrPayload' = old_token or rotated->>'id' = (select result->>'id' from pass_test where name='a')
    or rotated <> public.issue_guest_pass('40000000-0000-0000-0000-000000001001')
    or public.guest_pass_lookup('10000000-0000-0000-0000-000000001001',old_token)->>'status' <> 'REVOKED'
    or rotated <> public.get_guest_pass('40000000-0000-0000-0000-000000001001') then
    raise exception 'Explicit rotation or safe retry failed';
  end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform count(*) from private.guest_passes;
    raise exception 'Anon read Pass secrets';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
