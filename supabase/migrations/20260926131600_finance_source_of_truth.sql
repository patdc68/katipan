begin;

-- A commitment is a supplier contract value, not the sum of its installments.
alter table public.suppliers
  add column committed_amount numeric(14, 2),
  add column committed_on date,
  add column commitment_notes text,
  add constraint suppliers_committed_amount_nonnegative_check
    check (committed_amount is null or committed_amount >= 0),
  add constraint suppliers_commitment_metadata_check
    check (committed_amount is not null or (committed_on is null and commitment_notes is null));

-- Preserve any old supplier-linked manual figure for audit, but never count it
-- as a payment. New manual actuals belong only to non-supplier Budget Items.
alter table public.budget_items
  add column legacy_supplier_actual_amount numeric(14, 2);
update public.budget_items
set legacy_supplier_actual_amount = actual_amount, actual_amount = null
where supplier_id is not null and actual_amount is not null;
alter table public.budget_items
  add constraint budget_items_actual_only_without_supplier_check
    check (supplier_id is null or actual_amount is null);

-- The old row carried both a plan and payment facts. Keep it, and its original
-- evidence links, in the unexposed private schema for deterministic audit.
drop view public.supplier_payment_schedule;
drop view public.wedding_budget_totals;
drop view public.wedding_payment_totals;

drop function public.create_supplier_payment(uuid, uuid, uuid, numeric, date, text, text, text);
drop function public.update_supplier_payment(uuid, uuid, numeric, date, text, text, text);
drop function public.mark_supplier_payment_paid(uuid, timestamptz, text, text);
drop function public.mark_supplier_payment_unpaid(uuid);
drop function public.cancel_supplier_payment(uuid);

alter table public.payment_receipt_attachments rename to legacy_payment_receipt_attachments;
alter table public.legacy_payment_receipt_attachments set schema private;
alter table public.supplier_payments rename to legacy_supplier_payments;
alter table public.legacy_supplier_payments set schema private;
revoke all on table private.legacy_supplier_payments,
  private.legacy_payment_receipt_attachments
from public, anon, authenticated, service_role;

create table public.supplier_installments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  supplier_id uuid not null,
  budget_item_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  due_date date not null,
  notes text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_installments_supplier_same_wedding_fkey
    foreign key (wedding_id, supplier_id)
    references public.suppliers(wedding_id, id) on delete restrict,
  constraint supplier_installments_budget_item_same_supplier_fkey
    foreign key (wedding_id, budget_item_id, supplier_id)
    references public.budget_items(wedding_id, id, supplier_id) on delete restrict,
  constraint supplier_installments_wedding_id_id_key unique (wedding_id, id),
  constraint supplier_installments_wedding_supplier_id_key unique (wedding_id, supplier_id, id),
  constraint supplier_installments_cancelled_at_check
    check (cancelled_at is null or cancelled_at >= created_at)
);
create index supplier_installments_due_idx
  on public.supplier_installments(wedding_id, due_date, supplier_id)
  where cancelled_at is null;
create index supplier_installments_budget_item_idx
  on public.supplier_installments(wedding_id, budget_item_id, supplier_id);
create trigger supplier_installments_set_updated_at
  before update on public.supplier_installments for each row
  execute function private.set_updated_at();

create table public.supplier_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  supplier_id uuid not null,
  installment_id uuid,
  budget_item_id uuid,
  kind text not null default 'PAYMENT'
    check (kind in ('PAYMENT', 'REVERSAL')),
  source text not null default 'MANUAL'
    check (source in ('MANUAL', 'LEGACY')),
  amount numeric(14, 2) not null check (amount > 0),
  paid_at timestamptz not null,
  payment_method text check (payment_method is null or btrim(payment_method) <> ''),
  reference_number text check (reference_number is null or btrim(reference_number) <> ''),
  notes text,
  recorded_by_user_id uuid references auth.users(id) on delete set null,
  reverses_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_payment_transactions_supplier_same_wedding_fkey
    foreign key (wedding_id, supplier_id)
    references public.suppliers(wedding_id, id) on delete restrict,
  constraint supplier_payment_transactions_installment_same_supplier_fkey
    foreign key (wedding_id, supplier_id, installment_id)
    references public.supplier_installments(wedding_id, supplier_id, id) on delete restrict,
  constraint supplier_payment_transactions_budget_item_same_supplier_fkey
    foreign key (wedding_id, budget_item_id, supplier_id)
    references public.budget_items(wedding_id, id, supplier_id) on delete restrict,
  constraint supplier_payment_transactions_wedding_id_id_key unique (wedding_id, id),
  constraint supplier_payment_transactions_wedding_supplier_id_key unique (wedding_id, supplier_id, id),
  constraint supplier_payment_transactions_reversal_fkey
    foreign key (wedding_id, supplier_id, reverses_transaction_id)
    references public.supplier_payment_transactions(wedding_id, supplier_id, id) on delete restrict,
  constraint supplier_payment_transactions_reversal_shape_check
    check ((kind = 'PAYMENT' and reverses_transaction_id is null)
       or (kind = 'REVERSAL' and reverses_transaction_id is not null)),
  constraint supplier_payment_transactions_distinct_reversal_check
    check (reverses_transaction_id is null or reverses_transaction_id <> id),
  constraint supplier_payment_transactions_reversal_unique unique (reverses_transaction_id)
);
create index supplier_payment_transactions_supplier_paid_idx
  on public.supplier_payment_transactions(wedding_id, supplier_id, paid_at);
create index supplier_payment_transactions_installment_idx
  on public.supplier_payment_transactions(wedding_id, supplier_id, installment_id);
create index supplier_payment_transactions_budget_item_idx
  on public.supplier_payment_transactions(wedding_id, budget_item_id, supplier_id);
create index supplier_payment_transactions_reversal_idx
  on public.supplier_payment_transactions(wedding_id, supplier_id, reverses_transaction_id);
create index supplier_payment_transactions_recorded_by_idx
  on public.supplier_payment_transactions(recorded_by_user_id)
  where recorded_by_user_id is not null;

create function private.validate_supplier_payment_transaction()
returns trigger language plpgsql set search_path = '' as $function$
declare v_original public.supplier_payment_transactions%rowtype;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Payment transactions are append-only.' using errcode = '23514';
  end if;
  if current_user = 'authenticated' then
    if new.source <> 'MANUAL' or (select auth.uid()) is null
       or new.recorded_by_user_id is distinct from (select auth.uid()) then
      raise exception 'Payment recorder must be the authenticated caller.' using errcode = '42501';
    end if;
  end if;
  if new.kind = 'REVERSAL' then
    select * into v_original from public.supplier_payment_transactions p
    where p.wedding_id = new.wedding_id and p.supplier_id = new.supplier_id
      and p.id = new.reverses_transaction_id;
    if not found or v_original.kind <> 'PAYMENT'
       or new.amount <> v_original.amount
       or new.installment_id is distinct from v_original.installment_id
       or new.budget_item_id is distinct from v_original.budget_item_id
       or new.paid_at < v_original.paid_at then
      raise exception 'Reversal must match its original payment.' using errcode = '23514';
    end if;
    if new.notes is null or btrim(new.notes) = '' then
      raise exception 'A reversal reason is required.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;
create trigger supplier_payment_transactions_validate_insert
  before insert on public.supplier_payment_transactions for each row
  execute function private.validate_supplier_payment_transaction();
create trigger supplier_payment_transactions_reject_change
  before update or delete on public.supplier_payment_transactions for each row
  execute function private.validate_supplier_payment_transaction();

create table public.payment_receipt_attachments (
  wedding_id uuid not null,
  payment_id uuid not null,
  attachment_id uuid not null,
  created_at timestamptz not null default now(),
  constraint payment_receipt_attachments_pkey primary key (wedding_id, payment_id, attachment_id),
  constraint payment_receipt_attachments_payment_same_wedding_fkey
    foreign key (wedding_id, payment_id)
    references public.supplier_payment_transactions(wedding_id, id) on delete restrict,
  constraint payment_receipt_attachments_attachment_same_wedding_fkey
    foreign key (wedding_id, attachment_id)
    references public.attachments(wedding_id, id) on delete restrict
);
create index payment_receipt_attachments_attachment_idx
  on public.payment_receipt_attachments(wedding_id, attachment_id);
create trigger payment_receipt_attachments_enforce_financial_visibility
  before insert or update on public.payment_receipt_attachments for each row
  execute function private.enforce_financial_attachment_link();
create function private.enforce_actual_payment_receipt()
returns trigger language plpgsql set search_path = '' as $function$
begin
  if not exists (
    select 1 from public.supplier_payment_transactions t
    where t.wedding_id = new.wedding_id and t.id = new.payment_id
      and t.kind = 'PAYMENT'
  ) then
    raise exception 'Receipts must link to actual PAYMENT transactions.' using errcode = '23514';
  end if;
  return new;
end;
$function$;
create trigger payment_receipt_attachments_enforce_actual_payment
  before insert or update on public.payment_receipt_attachments for each row
  execute function private.enforce_actual_payment_receipt();

-- Every legacy row becomes a schedule row with the same ID. A paid row also
-- becomes an actual transaction with the same ID, preserving receipt identity.
insert into public.supplier_installments
  (id, wedding_id, supplier_id, budget_item_id, amount, due_date, notes,
   cancelled_at, created_at, updated_at)
select id, wedding_id, supplier_id, budget_item_id, amount, due_date, notes,
       cancelled_at, created_at, updated_at
from private.legacy_supplier_payments;

insert into public.supplier_payment_transactions
  (id, wedding_id, supplier_id, installment_id, budget_item_id, kind,
   source, amount, paid_at, payment_method, reference_number, notes,
   created_at, updated_at)
select id, wedding_id, supplier_id, id, budget_item_id, 'PAYMENT',
       'LEGACY', amount, paid_at, payment_method, reference_number, notes,
       created_at, updated_at
from private.legacy_supplier_payments
where paid_at is not null;

insert into public.supplier_payment_transactions
  (id, wedding_id, supplier_id, installment_id, budget_item_id, kind,
   source, amount, paid_at, notes, reverses_transaction_id, created_at, updated_at)
select md5(id::text || ':legacy-reversal')::uuid, wedding_id, supplier_id,
       id, budget_item_id, 'REVERSAL', 'LEGACY', amount, cancelled_at,
       'Migrated cancellation of a previously paid legacy row', id,
       cancelled_at, cancelled_at
from private.legacy_supplier_payments
where status = 'CANCELLED' and paid_at is not null;

insert into public.payment_receipt_attachments
  (wedding_id, payment_id, attachment_id, created_at)
select a.wedding_id, a.payment_id, a.attachment_id, a.created_at
from private.legacy_payment_receipt_attachments a
join private.legacy_supplier_payments p
  on p.wedding_id = a.wedding_id and p.id = a.payment_id
where p.paid_at is not null;

alter table public.supplier_installments enable row level security;
alter table public.supplier_payment_transactions enable row level security;
alter table public.payment_receipt_attachments enable row level security;
create policy supplier_installments_select_finance on public.supplier_installments
  for select to authenticated using ((select private.can_manage_wedding_finances(wedding_id)));
create policy supplier_installments_insert_finance on public.supplier_installments
  for insert to authenticated with check ((select private.can_manage_wedding_finances(wedding_id)));
create policy supplier_installments_update_finance on public.supplier_installments
  for update to authenticated
  using ((select private.can_manage_wedding_finances(wedding_id)))
  with check ((select private.can_manage_wedding_finances(wedding_id)));
create policy supplier_payment_transactions_select_finance on public.supplier_payment_transactions
  for select to authenticated using ((select private.can_manage_wedding_finances(wedding_id)));
create policy supplier_payment_transactions_insert_finance on public.supplier_payment_transactions
  for insert to authenticated
  with check ((select private.can_manage_wedding_finances(wedding_id))
    and source = 'MANUAL' and recorded_by_user_id = (select auth.uid()));
create policy payment_receipt_attachments_select_finance on public.payment_receipt_attachments
  for select to authenticated using ((select private.can_manage_wedding_finances(wedding_id)));
create policy payment_receipt_attachments_insert_finance on public.payment_receipt_attachments
  for insert to authenticated with check ((select private.can_manage_wedding_finances(wedding_id)));

-- One aggregation per source prevents a multiplication join between plans,
-- transactions, and budget allocations.
create view public.supplier_installment_schedule with (security_invoker = true) as
select i.id, i.wedding_id, i.supplier_id, i.budget_item_id, i.amount,
  i.due_date, i.notes, i.cancelled_at, i.created_at, i.updated_at,
  coalesce(t.paid_amount, 0::numeric)::numeric(14,2) as paid_amount,
  greatest(i.amount - coalesce(t.paid_amount, 0::numeric), 0::numeric)::numeric(14,2) as unpaid_balance,
  case when i.cancelled_at is not null then 'CANCELLED'
       when coalesce(t.paid_amount, 0) >= i.amount then 'PAID'
       when i.due_date < current_date then 'OVERDUE'
       when coalesce(t.paid_amount, 0) > 0 then 'PARTIALLY_PAID'
       else 'PENDING' end as status
from public.supplier_installments i
left join lateral (
  select sum(case when p.kind = 'PAYMENT' then p.amount else -p.amount end) as paid_amount
  from public.supplier_payment_transactions p
  where p.wedding_id = i.wedding_id and p.installment_id = i.id
) t on true
where private.can_manage_wedding_finances(i.wedding_id);

create view public.supplier_finance_totals with (security_invoker = true) as
select s.id as supplier_id, s.wedding_id, s.committed_amount,
  coalesce(i.scheduled_amount, 0::numeric)::numeric(14,2) as scheduled_amount,
  coalesce(p.actual_paid, 0::numeric)::numeric(14,2) as actual_paid,
  case when s.committed_amount is null then null
       else (s.committed_amount - coalesce(p.actual_paid, 0::numeric))::numeric(14,2)
  end as remaining_commitment,
  coalesce(i.overdue_balance, 0::numeric)::numeric(14,2) as overdue_balance,
  coalesce(p.unscheduled_paid, 0::numeric)::numeric(14,2) as unscheduled_paid
from public.suppliers s
left join lateral (
  select sum(amount) filter (where cancelled_at is null) as scheduled_amount,
         sum(unpaid_balance) filter (where cancelled_at is null and due_date < current_date)
           as overdue_balance
  from public.supplier_installment_schedule sch
  where sch.wedding_id = s.wedding_id and sch.supplier_id = s.id
) i on true
left join lateral (
  select sum(case when kind = 'PAYMENT' then amount else -amount end) as actual_paid,
         sum(case when kind = 'PAYMENT' then amount else -amount end)
           filter (where installment_id is null) as unscheduled_paid
  from public.supplier_payment_transactions t
  where t.wedding_id = s.wedding_id and t.supplier_id = s.id
) p on true
where private.can_manage_wedding_finances(s.wedding_id);

create view public.wedding_payment_totals with (security_invoker = true) as
select w.id as wedding_id, w.currency_code,
  coalesce(s.committed_total, 0::numeric)::numeric(14,2) as committed_total,
  coalesce(s.scheduled_total, 0::numeric)::numeric(14,2) as scheduled_total,
  coalesce(s.paid_total, 0::numeric)::numeric(14,2) as paid_total,
  coalesce(i.pending_total, 0::numeric)::numeric(14,2) as pending_total,
  coalesce(s.overdue_total, 0::numeric)::numeric(14,2) as overdue_total,
  coalesce(s.remaining_commitment, 0::numeric)::numeric(14,2) as remaining_commitment,
  coalesce(s.unscheduled_paid_total, 0::numeric)::numeric(14,2) as unscheduled_paid_total,
  coalesce(s.uncommitted_supplier_count, 0)::bigint as uncommitted_supplier_count
from public.weddings w
left join lateral (
  select sum(committed_amount) as committed_total,
         sum(scheduled_amount) as scheduled_total,
         sum(actual_paid) as paid_total,
         sum(overdue_balance) as overdue_total,
         sum(remaining_commitment) as remaining_commitment,
         sum(unscheduled_paid) as unscheduled_paid_total,
         count(*) filter (where committed_amount is null) as uncommitted_supplier_count
  from public.supplier_finance_totals f where f.wedding_id = w.id
) s on true
left join lateral (
  select sum(unpaid_balance) as pending_total
  from public.supplier_installment_schedule sch
  where sch.wedding_id = w.id and sch.cancelled_at is null
    and sch.due_date >= current_date
) i on true
where private.can_manage_wedding_finances(w.id);

create view public.wedding_budget_totals with (security_invoker = true) as
select w.id as wedding_id, w.currency_code,
  coalesce(b.active_item_count, 0)::bigint as active_item_count,
  coalesce(b.estimated_total, 0::numeric)::numeric(14,2) as estimated_total,
  (coalesce(b.manual_actual_total, 0::numeric) + coalesce(p.paid_total, 0::numeric))::numeric(14,2)
    as actual_total,
  coalesce(b.manual_actual_total, 0::numeric)::numeric(14,2) as manual_actual_total,
  coalesce(p.paid_total, 0::numeric)::numeric(14,2) as supplier_actual_total
from public.weddings w
left join lateral (
  select count(*) filter (where status in ('PLANNED', 'CONFIRMED')) as active_item_count,
         sum(estimated_amount) filter (where status in ('PLANNED', 'CONFIRMED')) as estimated_total,
         sum(actual_amount) as manual_actual_total
  from public.budget_items b where b.wedding_id = w.id
) b on true
left join lateral (
  select sum(case when kind = 'PAYMENT' then amount else -amount end) as paid_total
  from public.supplier_payment_transactions t where t.wedding_id = w.id
) p on true
where private.can_manage_wedding_finances(w.id);

create function public.set_supplier_commitment(
  p_supplier_id uuid, p_amount numeric, p_committed_on date default null,
  p_notes text default null
) returns uuid language plpgsql security invoker set search_path = '' as $function$
begin
  update public.suppliers s set committed_amount = p_amount,
    committed_on = p_committed_on, commitment_notes = p_notes
  where s.id = p_supplier_id and private.can_manage_wedding_finances(s.wedding_id);
  if not found then raise exception 'Supplier commitment is not accessible.' using errcode = '42501'; end if;
  return p_supplier_id;
end;
$function$;

create function public.create_supplier_installment(
  p_wedding_id uuid, p_supplier_id uuid, p_budget_item_id uuid,
  p_amount numeric, p_due_date date, p_notes text default null
) returns uuid language plpgsql security invoker set search_path = '' as $function$
declare v_id uuid;
begin
  if not private.can_manage_wedding_finances(p_wedding_id) then
    raise exception 'Installment management is not permitted.' using errcode = '42501';
  end if;
  insert into public.supplier_installments
    (wedding_id, supplier_id, budget_item_id, amount, due_date, notes)
  values (p_wedding_id, p_supplier_id, p_budget_item_id, p_amount, p_due_date, p_notes)
  returning id into v_id;
  return v_id;
end;
$function$;

create function public.record_supplier_payment(
  p_wedding_id uuid, p_supplier_id uuid, p_installment_id uuid,
  p_budget_item_id uuid, p_amount numeric, p_paid_at timestamptz,
  p_payment_method text default null, p_reference_number text default null,
  p_notes text default null
) returns uuid language plpgsql security invoker set search_path = '' as $function$
declare v_id uuid;
begin
  if not private.can_manage_wedding_finances(p_wedding_id) then
    raise exception 'Payment recording is not permitted.' using errcode = '42501';
  end if;
  insert into public.supplier_payment_transactions
    (wedding_id, supplier_id, installment_id, budget_item_id, amount,
     paid_at, payment_method, reference_number, notes, recorded_by_user_id)
  values (p_wedding_id, p_supplier_id, p_installment_id, p_budget_item_id,
    p_amount, p_paid_at, nullif(btrim(p_payment_method), ''),
    nullif(btrim(p_reference_number), ''), p_notes, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$function$;

create function public.reverse_supplier_payment(p_payment_id uuid, p_reason text)
returns uuid language plpgsql security invoker set search_path = '' as $function$
declare v_original public.supplier_payment_transactions%rowtype; v_id uuid;
begin
  select * into v_original from public.supplier_payment_transactions p
  where p.id = p_payment_id;
  if not found or not private.can_manage_wedding_finances(v_original.wedding_id) then
    raise exception 'Payment reversal is not permitted.' using errcode = '42501';
  end if;
  if v_original.kind <> 'PAYMENT' then
    raise exception 'Only a payment can be reversed.' using errcode = '22023';
  end if;
  insert into public.supplier_payment_transactions
    (wedding_id, supplier_id, installment_id, budget_item_id,
     kind, amount, paid_at, notes, reverses_transaction_id, recorded_by_user_id)
  values (v_original.wedding_id, v_original.supplier_id,
    v_original.installment_id, v_original.budget_item_id,
    'REVERSAL', v_original.amount, greatest(now(), v_original.paid_at),
    p_reason, p_payment_id, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.link_payment_receipt_attachment(
  p_payment_id uuid, p_attachment_id uuid
) returns boolean language plpgsql security invoker set search_path = '' as $function$
declare v_wedding_id uuid;
begin
  select wedding_id into v_wedding_id from public.supplier_payment_transactions
  where id = p_payment_id and kind = 'PAYMENT';
  if not found then raise exception 'Payment transaction not found.' using errcode = '22023'; end if;
  if not private.can_manage_wedding_finances(v_wedding_id) then
    raise exception 'Receipt Attachment linking is not permitted.' using errcode = '42501';
  end if;
  insert into public.payment_receipt_attachments(wedding_id, payment_id, attachment_id)
  values (v_wedding_id, p_payment_id, p_attachment_id) on conflict do nothing;
  return found;
end;
$function$;

revoke all on table public.supplier_installments,
  public.supplier_payment_transactions, public.payment_receipt_attachments,
  public.supplier_installment_schedule, public.supplier_finance_totals,
  public.wedding_payment_totals, public.wedding_budget_totals
from public, anon, authenticated, service_role;
grant select on table public.supplier_installments,
  public.supplier_payment_transactions, public.payment_receipt_attachments,
  public.supplier_installment_schedule, public.supplier_finance_totals,
  public.wedding_payment_totals, public.wedding_budget_totals to authenticated;
grant insert(wedding_id, supplier_id, budget_item_id, amount, due_date, notes),
  update(budget_item_id, amount, due_date, notes, cancelled_at)
  on public.supplier_installments to authenticated;
grant insert(wedding_id, supplier_id, installment_id, budget_item_id,
  kind, source, amount, paid_at, payment_method, reference_number, notes,
  recorded_by_user_id, reverses_transaction_id)
  on public.supplier_payment_transactions to authenticated;
grant insert(wedding_id, payment_id, attachment_id)
  on public.payment_receipt_attachments to authenticated;
grant select, insert, update, delete on public.supplier_installments,
  public.supplier_payment_transactions, public.payment_receipt_attachments
  to service_role;
grant select on public.supplier_installment_schedule,
  public.supplier_finance_totals, public.wedding_payment_totals,
  public.wedding_budget_totals to service_role;
grant update(committed_amount, committed_on, commitment_notes)
  on public.suppliers to authenticated;
revoke update(actual_amount, legacy_supplier_actual_amount) on public.budget_items from authenticated;
grant update(actual_amount) on public.budget_items to authenticated;
revoke insert(legacy_supplier_actual_amount) on public.budget_items from authenticated;

revoke execute on function private.validate_supplier_payment_transaction()
  from public, anon, authenticated, service_role;
revoke execute on function private.enforce_actual_payment_receipt()
  from public, anon, authenticated, service_role;
revoke execute on function public.set_supplier_commitment(uuid,numeric,date,text),
  public.create_supplier_installment(uuid,uuid,uuid,numeric,date,text),
  public.record_supplier_payment(uuid,uuid,uuid,uuid,numeric,timestamptz,text,text,text),
  public.reverse_supplier_payment(uuid,text)
from public, anon, authenticated, service_role;
grant execute on function public.set_supplier_commitment(uuid,numeric,date,text),
  public.create_supplier_installment(uuid,uuid,uuid,numeric,date,text),
  public.record_supplier_payment(uuid,uuid,uuid,uuid,numeric,timestamptz,text,text,text),
  public.reverse_supplier_payment(uuid,text)
to authenticated, service_role;

comment on column public.budget_items.actual_amount is
  'Manual actual non-supplier cost only. Supplier actuals come solely from net payment transactions.';
comment on column public.budget_items.legacy_supplier_actual_amount is
  'Preserved pre-F5 supplier-linked actual estimate. Audit-only; excluded from all financial aggregates.';
comment on table public.supplier_installments is
  'Editable planned installment amounts and due dates; payment transactions remain independent and immutable.';
comment on table public.supplier_payment_transactions is
  'Append-only actual payment ledger. REVERSAL rows negate one PAYMENT; corrections require a new PAYMENT.';
comment on table public.payment_receipt_attachments is
  'FINANCIAL_PRIVATE receipts attached to actual PAYMENT transactions, never schedules.';
comment on view public.wedding_budget_totals is
  'Allocation sums Budget Items; actual_total sums manual non-supplier actuals and net supplier transactions exactly once.';
comment on view public.wedding_payment_totals is
  'Independent commitment, installment, and net actual aggregates; overdue is derived from unpaid past-due balances.';

commit;
