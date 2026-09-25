begin;

-- Partner invitations remain tied to an existing Person. Team invitations are
-- account invitations and never create or link a wedding_people row.
alter table public.wedding_invitations
  add constraint wedding_invitations_target_matches_role_check check (
    (intended_role = 'OWNER' and target_person_id is not null)
    or (intended_role in ('FULL_COORDINATOR', 'DAY_OF_COORDINATOR', 'GUEST_COORDINATOR')
      and target_person_id is null)
  );

create unique index wedding_invitations_one_pending_team_email_idx
  on public.wedding_invitations (wedding_id, invited_email)
  where status = 'PENDING' and target_person_id is null and invited_email is not null;

create function public.issue_coordinator_invitation(
  p_wedding_id uuid,
  p_intended_role public.wedding_membership_role,
  p_invited_email text default null
)
returns table (
  invitation_id uuid,
  raw_token text,
  invitation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller uuid := (select auth.uid());
  v_invitation_id uuid;
  v_token text;
  v_expires_at timestamptz := pg_catalog.now() + interval '7 days';
  v_email text := nullif(pg_catalog.lower(pg_catalog.btrim(p_invited_email)), '');
begin
  if v_caller is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_intended_role is null or p_intended_role not in
    ('FULL_COORDINATOR', 'DAY_OF_COORDINATOR', 'GUEST_COORDINATOR') then
    raise exception 'A coordinator role is required.' using errcode = '22023';
  end if;

  perform 1 from public.weddings w
    where w.id = p_wedding_id and w.status in ('DRAFT', 'ACTIVE')
      and w.deletion_requested_at is null
    for update;
  if not found or not private.can_manage_owner_invitations(p_wedding_id) then
    raise exception 'Coordinator invitation is not permitted.' using errcode = '42501';
  end if;

  -- The Wedding row lock serializes invitations for a bound email.
  if v_email is not null then
    update public.wedding_invitations i
      set status = 'REVOKED', revoked_at = pg_catalog.now()
      where i.wedding_id = p_wedding_id and i.target_person_id is null
        and i.invited_email = v_email and i.status = 'PENDING';
  end if;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.wedding_invitations
    (wedding_id, intended_role, invited_email, expires_at, created_by_user_id)
  values (p_wedding_id, p_intended_role, v_email, v_expires_at, v_caller)
  returning id into v_invitation_id;

  insert into private.wedding_invitation_secrets (invitation_id, token_hash)
  values (v_invitation_id, extensions.digest(v_token, 'sha256'));

  return query select v_invitation_id, v_token, v_expires_at;
end;
$function$;

create function public.accept_coordinator_invitation(p_raw_token text)
returns table (
  invitation_id uuid,
  wedding_id uuid,
  membership_id uuid,
  membership_role public.wedding_membership_role
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller uuid := (select auth.uid());
  v_invitation_id uuid;
  v_wedding_id uuid;
  v_status public.wedding_invitation_status;
  v_role public.wedding_membership_role;
  v_email text;
  v_expires_at timestamptz;
  v_existing public.wedding_memberships%rowtype;
  v_membership_id uuid;
begin
  if v_caller is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_raw_token is null or pg_catalog.length(p_raw_token) <> 64
    or p_raw_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitation cannot be accepted.' using errcode = '22023';
  end if;

  select i.id, i.wedding_id into v_invitation_id, v_wedding_id
    from private.wedding_invitation_secrets s
    join public.wedding_invitations i on i.id = s.invitation_id
    where s.token_hash = extensions.digest(p_raw_token, 'sha256');
  if not found then
    raise exception 'Invitation cannot be accepted.' using errcode = '22023';
  end if;

  perform 1 from public.weddings w
    where w.id = v_wedding_id and w.status in ('DRAFT', 'ACTIVE')
      and w.deletion_requested_at is null
    for update;
  if not found then
    raise exception 'Invitation cannot be accepted.' using errcode = '22023';
  end if;

  select i.status, i.intended_role, i.invited_email, i.expires_at
    into v_status, v_role, v_email, v_expires_at
    from public.wedding_invitations i
    join private.wedding_invitation_secrets s on s.invitation_id = i.id
    where i.id = v_invitation_id and i.wedding_id = v_wedding_id
      and i.target_person_id is null
      and s.token_hash = extensions.digest(p_raw_token, 'sha256')
    for update of i, s;
  if not found or v_status <> 'PENDING' or v_expires_at <= pg_catalog.now()
    or v_role not in ('FULL_COORDINATOR', 'DAY_OF_COORDINATOR', 'GUEST_COORDINATOR') then
    raise exception 'Invitation cannot be accepted.' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users u where u.id = v_caller
    and (v_email is null or
      (pg_catalog.lower(u.email) = v_email and u.email_confirmed_at is not null))) then
    raise exception 'Invitation cannot be accepted.' using errcode = '22023';
  end if;

  -- A linked Partner must use the Owner workflow, even after a prior removal.
  if exists (select 1 from public.wedding_people p
    join public.wedding_partners partner
      on partner.wedding_id = p.wedding_id and partner.person_id = p.id
    where p.wedding_id = v_wedding_id and p.linked_user_id = v_caller) then
    raise exception 'Invitation cannot be accepted.' using errcode = '22023';
  end if;

  select m.* into v_existing from public.wedding_memberships m
    where m.wedding_id = v_wedding_id and m.user_id = v_caller
    for update;
  if found then
    if v_existing.status = 'ACTIVE' or v_existing.role = 'OWNER' then
      raise exception 'Invitation cannot be accepted.' using errcode = '22023';
    end if;
    update public.wedding_memberships m
      set role = v_role, status = 'ACTIVE', joined_at = pg_catalog.now(),
        ended_at = null
      where m.id = v_existing.id
      returning m.id into v_membership_id;
  else
    insert into public.wedding_memberships (wedding_id, user_id, role)
      values (v_wedding_id, v_caller, v_role)
      returning id into v_membership_id;
  end if;

  update public.wedding_invitations i
    set status = 'ACCEPTED', accepted_by_user_id = v_caller,
      accepted_at = pg_catalog.now()
    where i.id = v_invitation_id and i.status = 'PENDING';
  if not found then
    raise exception 'Invitation cannot be accepted.' using errcode = '22023';
  end if;

  return query select v_invitation_id, v_wedding_id, v_membership_id, v_role;
end;
$function$;

create function public.change_coordinator_role(
  p_wedding_id uuid,
  p_target_membership_id uuid,
  p_new_role public.wedding_membership_role
)
returns public.wedding_memberships
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller uuid := (select auth.uid());
  v_target public.wedding_memberships%rowtype;
begin
  if v_caller is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_new_role is null or p_new_role not in
    ('FULL_COORDINATOR', 'DAY_OF_COORDINATOR', 'GUEST_COORDINATOR') then
    raise exception 'A coordinator role is required.' using errcode = '22023';
  end if;
  perform 1 from public.weddings w
    where w.id = p_wedding_id and w.status in ('DRAFT', 'ACTIVE')
      and w.deletion_requested_at is null
    for update;
  if not found or not private.can_manage_owner_invitations(p_wedding_id) then
    raise exception 'Coordinator role change is not permitted.' using errcode = '42501';
  end if;

  select m.* into v_target from public.wedding_memberships m
    where m.id = p_target_membership_id and m.wedding_id = p_wedding_id
    for update;
  if not found or v_target.status <> 'ACTIVE' or v_target.role = 'OWNER'
    or v_target.user_id = v_caller then
    raise exception 'Target must be another active Coordinator.' using errcode = '22023';
  end if;

  update public.wedding_memberships m set role = p_new_role
    where m.id = p_target_membership_id
    returning m.* into v_target;
  return v_target;
end;
$function$;

-- The existing finance write policies and RPCs already use this helper.
-- Align reads with those same capabilities, including evidence links.
drop policy suppliers_select_member on public.suppliers;
drop policy budget_categories_select_member on public.budget_categories;
drop policy budget_items_select_member on public.budget_items;
drop policy supplier_payments_select_member on public.supplier_payments;
drop policy supplier_contract_attachments_select_member on public.supplier_contract_attachments;
drop policy payment_receipt_attachments_select_member on public.payment_receipt_attachments;

create policy suppliers_select_finance on public.suppliers for select to authenticated
  using ((select private.can_manage_wedding_finances(wedding_id)));
create policy budget_categories_select_finance on public.budget_categories for select to authenticated
  using ((select private.can_manage_wedding_finances(wedding_id)));
create policy budget_items_select_finance on public.budget_items for select to authenticated
  using ((select private.can_manage_wedding_finances(wedding_id)));
create policy supplier_payments_select_finance on public.supplier_payments for select to authenticated
  using ((select private.can_manage_wedding_finances(wedding_id)));
create policy supplier_contract_attachments_select_finance on public.supplier_contract_attachments for select to authenticated
  using ((select private.can_manage_wedding_finances(wedding_id)));
create policy payment_receipt_attachments_select_finance on public.payment_receipt_attachments for select to authenticated
  using ((select private.can_manage_wedding_finances(wedding_id)));

-- A left join against Weddings would otherwise return a visible zero-total row
-- to a lower-scope member, despite the protected finance source being hidden.
create or replace view public.wedding_budget_totals
with (security_invoker = true) as
select w.id as wedding_id, w.currency_code,
  count(b.id) filter (where b.status in ('PLANNED','CONFIRMED'))::bigint as active_item_count,
  coalesce(sum(b.estimated_amount) filter (where b.status in ('PLANNED','CONFIRMED')), 0::numeric)::numeric(14,2) as estimated_total,
  coalesce(sum(b.actual_amount) filter (where b.status in ('PLANNED','CONFIRMED')), 0::numeric)::numeric(14,2) as actual_total
from public.weddings w
left join public.budget_items b on b.wedding_id = w.id
where private.can_manage_wedding_finances(w.id)
group by w.id, w.currency_code;

create or replace view public.wedding_payment_totals
with (security_invoker = true) as
select w.id as wedding_id, w.currency_code,
  coalesce(sum(p.amount) filter (where p.status <> 'CANCELLED'), 0::numeric)::numeric(14,2) as scheduled_total,
  coalesce(sum(p.amount) filter (where p.status = 'PAID'), 0::numeric)::numeric(14,2) as paid_total,
  coalesce(sum(p.amount) filter (where p.status = 'PENDING' and p.due_date >= current_date), 0::numeric)::numeric(14,2) as pending_total,
  coalesce(sum(p.amount) filter (where p.status = 'PENDING' and p.due_date < current_date), 0::numeric)::numeric(14,2) as overdue_total
from public.weddings w
left join public.supplier_payments p on p.wedding_id = w.id
where private.can_manage_wedding_finances(w.id)
group by w.id, w.currency_code;

revoke execute on function public.issue_coordinator_invitation(uuid, public.wedding_membership_role, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.accept_coordinator_invitation(text)
  from public, anon, authenticated, service_role;
revoke execute on function public.change_coordinator_role(uuid, uuid, public.wedding_membership_role)
  from public, anon, authenticated, service_role;
grant execute on function public.issue_coordinator_invitation(uuid, public.wedding_membership_role, text),
  public.accept_coordinator_invitation(text),
  public.change_coordinator_role(uuid, uuid, public.wedding_membership_role)
  to authenticated;

comment on function public.issue_coordinator_invitation(uuid, public.wedding_membership_role, text) is
  'Owner or temporary controller issues a single-use, digest-backed Coordinator invitation.';
comment on function public.accept_coordinator_invitation(text) is
  'Authenticated token bearer joins or reactivates a Coordinator membership; partner ownership is untouched.';
comment on function public.change_coordinator_role(uuid, uuid, public.wedding_membership_role) is
  'Owner or temporary controller changes another active Coordinator role without altering membership identity.';

commit;
