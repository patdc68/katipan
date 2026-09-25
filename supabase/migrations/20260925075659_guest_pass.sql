begin;

-- Pass secrets are recoverable only inside this unexposed schema so an ordinary
-- retry can return the original QR. The digest is indexed for scanner lookup.
create table private.guest_passes (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  guest_id uuid not null,
  reference text not null,
  qr_token text not null,
  token_hash bytea generated always as (extensions.digest(qr_token, 'sha256')) stored,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_passes_guest_fkey foreign key (wedding_id, guest_id)
    references public.guests(wedding_id, id) on delete cascade,
  constraint guest_passes_wedding_reference_key unique (wedding_id, reference),
  constraint guest_passes_token_hash_key unique (token_hash),
  constraint guest_passes_token_check check (qr_token ~ '^[0-9a-f]{64}$'),
  constraint guest_passes_reference_check check (reference ~ '^K[0-9A-F]{4}-[0-9A-F]{4}$'),
  constraint guest_passes_revoked_check check (revoked_at is null or revoked_at >= issued_at)
);
create unique index guest_passes_active_guest_idx on private.guest_passes(wedding_id, guest_id)
  where revoked_at is null;
create index guest_passes_guest_history_idx on private.guest_passes(wedding_id, guest_id, issued_at desc);
create trigger guest_passes_updated_at before update on private.guest_passes
  for each row execute function private.set_updated_at();
alter table private.guest_passes enable row level security;
revoke all on private.guest_passes from public, anon, authenticated;

create function private.can_manage_guest_pass(p_wedding_id uuid) returns boolean
language sql stable security definer set search_path = '' as $function$
  select exists (select 1 from public.weddings w where w.id = p_wedding_id and w.status = 'ACTIVE')
    and (private.has_active_wedding_role(p_wedding_id,
      array['OWNER', 'FULL_COORDINATOR']::public.wedding_membership_role[])
      or private.controls_coordinator_managed_wedding(p_wedding_id));
$function$;

create function private.can_scan_guest_pass(p_wedding_id uuid) returns boolean
language sql stable security definer set search_path = '' as $function$
  select exists (select 1 from public.weddings w where w.id = p_wedding_id and w.status = 'ACTIVE')
    and private.has_active_wedding_role(p_wedding_id,
      array['OWNER', 'FULL_COORDINATOR', 'DAY_OF_COORDINATOR', 'GUEST_COORDINATOR']::public.wedding_membership_role[]);
$function$;

create function private.guest_pass_json(p_pass private.guest_passes) returns jsonb
language sql stable set search_path = '' as $function$
  select jsonb_build_object('id', p_pass.id, 'guestId', p_pass.guest_id,
    'reference', p_pass.reference, 'qrPayload', p_pass.qr_token,
    'issuedAt', p_pass.issued_at, 'revokedAt', p_pass.revoked_at);
$function$;

create function private.new_guest_pass(p_wedding_id uuid, p_guest_id uuid)
returns private.guest_passes language plpgsql volatile security definer set search_path = '' as $function$
declare v_pass private.guest_passes; v_reference text;
begin
  for i in 1..12 loop
    v_reference := 'K' || upper(encode(extensions.gen_random_bytes(2), 'hex'))
      || '-' || upper(encode(extensions.gen_random_bytes(2), 'hex'));
    begin
      insert into private.guest_passes(wedding_id, guest_id, reference, qr_token)
      values (p_wedding_id, p_guest_id, v_reference,
        encode(extensions.gen_random_bytes(32), 'hex')) returning * into v_pass;
      return v_pass;
    exception when unique_violation then
      -- Reference collision is possible; retry with independent random bytes.
      null;
    end;
  end loop;
  raise exception 'Could not allocate Guest Pass reference' using errcode = '23505';
end;
$function$;

create function public.issue_guest_pass(p_guest_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $function$
declare v_wedding_id uuid; v_status public.guest_rsvp_status; v_pass private.guest_passes;
begin
  select r.wedding_id, r.status into v_wedding_id, v_status
  from public.guest_rsvps r where r.guest_id = p_guest_id for update;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_pass(v_wedding_id) then
    raise exception 'Guest Pass management is not permitted' using errcode = '42501';
  end if;
  select * into v_pass from private.guest_passes
    where wedding_id = v_wedding_id and guest_id = p_guest_id and revoked_at is null;
  if found then return private.guest_pass_json(v_pass); end if;
  if exists (select 1 from private.guest_passes
      where wedding_id = v_wedding_id and guest_id = p_guest_id) then
    raise exception 'A revoked Pass requires explicit rotation' using errcode = '23514';
  end if;
  if v_status <> 'ATTENDING' then
    raise exception 'Only an ATTENDING Guest may receive a Pass' using errcode = '23514';
  end if;
  v_pass := private.new_guest_pass(v_wedding_id, p_guest_id);
  return private.guest_pass_json(v_pass);
end;
$function$;

create function public.get_guest_pass(p_guest_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $function$
declare v_wedding_id uuid; v_pass private.guest_passes;
begin
  select wedding_id into v_wedding_id from public.guests where id = p_guest_id;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_pass(v_wedding_id) then
    raise exception 'Guest Pass management is not permitted' using errcode = '42501';
  end if;
  select * into v_pass from private.guest_passes
    where wedding_id = v_wedding_id and guest_id = p_guest_id and revoked_at is null;
  if not found then return null; end if;
  return private.guest_pass_json(v_pass);
end;
$function$;

create function public.revoke_guest_pass(p_guest_id uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $function$
declare v_wedding_id uuid; v_count integer;
begin
  select r.wedding_id into v_wedding_id from public.guest_rsvps r
    where r.guest_id = p_guest_id for update;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_pass(v_wedding_id) then
    raise exception 'Guest Pass management is not permitted' using errcode = '42501';
  end if;
  update private.guest_passes set revoked_at = now()
    where wedding_id = v_wedding_id and guest_id = p_guest_id and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$function$;

create function public.rotate_guest_pass(p_guest_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $function$
declare v_wedding_id uuid; v_status public.guest_rsvp_status; v_pass private.guest_passes;
begin
  select r.wedding_id, r.status into v_wedding_id, v_status
    from public.guest_rsvps r where r.guest_id = p_guest_id for update;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_pass(v_wedding_id) then
    raise exception 'Guest Pass management is not permitted' using errcode = '42501';
  end if;
  if v_status <> 'ATTENDING' then
    raise exception 'Only an ATTENDING Guest may receive a Pass' using errcode = '23514';
  end if;
  if not exists (select 1 from private.guest_passes
      where wedding_id = v_wedding_id and guest_id = p_guest_id) then
    raise exception 'No prior Pass exists to rotate' using errcode = '23514';
  end if;
  update private.guest_passes set revoked_at = now()
    where wedding_id = v_wedding_id and guest_id = p_guest_id and revoked_at is null;
  v_pass := private.new_guest_pass(v_wedding_id, p_guest_id);
  return private.guest_pass_json(v_pass);
end;
$function$;

-- The target Wedding is authorized before inspecting a token. A token from
-- another Wedding yields no Guest details, even to a member of this Wedding.
create function public.guest_pass_lookup(p_wedding_id uuid, p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $function$
declare v_pass private.guest_passes; v_status public.guest_rsvp_status; v_name text;
begin
  if (select auth.uid()) is null or not private.can_scan_guest_pass(p_wedding_id) then
    raise exception 'Scanner access is not permitted' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'NOT_RECOGNIZED');
  end if;
  select * into v_pass from private.guest_passes
    where token_hash = extensions.digest(p_token, 'sha256');
  if not found then return jsonb_build_object('status', 'NOT_RECOGNIZED'); end if;
  if v_pass.wedding_id <> p_wedding_id then
    return jsonb_build_object('status', 'DIFFERENT_WEDDING');
  end if;
  if v_pass.revoked_at is not null then
    return jsonb_build_object('status', 'REVOKED');
  end if;
  select r.status, p.display_name into v_status, v_name
    from public.guest_rsvps r
    join public.guests g on g.wedding_id = r.wedding_id and g.id = r.guest_id
    join public.wedding_people p on p.wedding_id = g.wedding_id and p.id = g.person_id
    where r.wedding_id = v_pass.wedding_id and r.guest_id = v_pass.guest_id;
  if v_status = 'DECLINED' then return jsonb_build_object('status', 'DECLINED_REVIEW'); end if;
  if v_status <> 'ATTENDING' then return jsonb_build_object('status', 'NO_RESPONSE_REVIEW'); end if;
  return jsonb_build_object('status', 'VALID', 'guestId', v_pass.guest_id,
    'name', v_name, 'reference', v_pass.reference);
end;
$function$;

-- Preserve the existing guide and its current seating visibility rules.
alter function public.guest_wedding_guide(text, text) set schema private;
alter function private.guest_wedding_guide(text, text) rename to guest_wedding_guide_seating_base;
revoke execute on function private.guest_wedding_guide_seating_base(text, text)
  from public, anon, authenticated, service_role;
create function public.guest_wedding_guide(p_slug text, p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_guide jsonb; v_wedding_id uuid; v_household_id uuid; v_passes jsonb;
begin
  v_guide := private.guest_wedding_guide_seating_base(p_slug, p_token);
  if p_token is null then return v_guide; end if;
  select wedding_id into v_wedding_id from public.wedding_websites
    where slug = p_slug and is_published;
  v_household_id := private.valid_household_website_token(v_wedding_id, p_token);
  if v_household_id is null then
    raise exception 'Invalid invitation access' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'guestId', g.id, 'reference', gp.reference, 'qrPayload', gp.qr_token,
    'seating', coalesce((select jsonb_agg(s.value)
      from jsonb_array_elements(coalesce(v_guide->'seating', '[]'::jsonb)) s(value)
      where s.value->>'guestId' = g.id::text), '[]'::jsonb))
    order by g.id), '[]'::jsonb) into v_passes
  from public.guests g
  join public.guest_rsvps r on r.wedding_id = g.wedding_id and r.guest_id = g.id
  join private.guest_passes gp on gp.wedding_id = g.wedding_id and gp.guest_id = g.id
    and gp.revoked_at is null
  where g.wedding_id = v_wedding_id and g.household_id = v_household_id
    and r.status = 'ATTENDING';
  return v_guide || jsonb_build_object('guestPasses', v_passes);
end;
$function$;

revoke execute on function private.can_manage_guest_pass(uuid), private.can_scan_guest_pass(uuid),
  private.guest_pass_json(private.guest_passes), private.new_guest_pass(uuid,uuid),
  private.guest_wedding_guide_seating_base(text,text),
  public.issue_guest_pass(uuid), public.get_guest_pass(uuid), public.revoke_guest_pass(uuid),
  public.rotate_guest_pass(uuid), public.guest_pass_lookup(uuid,text),
  public.guest_wedding_guide(text,text) from public, anon, authenticated, service_role;
grant execute on function public.issue_guest_pass(uuid), public.get_guest_pass(uuid),
  public.revoke_guest_pass(uuid), public.rotate_guest_pass(uuid),
  public.guest_pass_lookup(uuid,text) to authenticated;
grant execute on function public.guest_wedding_guide(text,text) to service_role;

comment on table private.guest_passes is
  'Private individual Guest Pass history. Raw QR material is recoverable only through authorized workflows and the Household Guest Guide.';
comment on function public.guest_pass_lookup(uuid,text) is
  'Read-only Wedding-scoped scanner validation. Authorization precedes token lookup; no attendance or other domain state is changed.';

commit;
