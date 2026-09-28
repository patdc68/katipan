begin;

-- Historical LEGACY transactions and REVERSAL rows intentionally keep a null
-- request key. New MANUAL PAYMENT rows use one key per recorder and action.
alter table public.supplier_payment_transactions
  add column client_request_id uuid;

create unique index supplier_payment_transactions_recorder_request_unique
  on public.supplier_payment_transactions(recorded_by_user_id, client_request_id)
  where kind = 'PAYMENT'
    and source = 'MANUAL'
    and client_request_id is not null;

create or replace function private.validate_supplier_payment_transaction()
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
  if new.kind = 'PAYMENT' and new.source = 'MANUAL'
     and new.client_request_id is null then
    raise exception 'A request ID is required for manual payments.' using errcode = '23514';
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

-- Remove the old callable shape. Keeping it as an overload would leave the
-- non-idempotent payment path available to authenticated clients.
revoke execute on function public.record_supplier_payment(
  uuid, uuid, uuid, uuid, numeric, timestamptz, text, text, text
) from public, anon, authenticated, service_role;
drop function public.record_supplier_payment(
  uuid, uuid, uuid, uuid, numeric, timestamptz, text, text, text
);

create function public.record_supplier_payment(
  p_wedding_id uuid,
  p_supplier_id uuid,
  p_installment_id uuid,
  p_budget_item_id uuid,
  p_amount numeric,
  p_paid_at timestamptz,
  p_client_request_id uuid,
  p_payment_method text default null,
  p_reference_number text default null,
  p_notes text default null
) returns uuid language plpgsql security invoker set search_path = '' as $function$
declare
  v_actor uuid;
  v_amount numeric(14,2);
  v_payment_method text;
  v_reference_number text;
  v_existing public.supplier_payment_transactions%rowtype;
  v_id uuid;
begin
  if not private.can_manage_wedding_finances(p_wedding_id) then
    raise exception 'Payment recording is not permitted.' using errcode = '42501';
  end if;
  v_actor := (select auth.uid());
  if v_actor is null then
    raise exception 'Payment recording is not permitted.' using errcode = '42501';
  end if;
  if p_client_request_id is null then
    raise exception 'A client request ID is required.' using errcode = '22023';
  end if;

  -- Match the values stored by the existing insert path, including the
  -- payment method/reference trimming and the ledger amount's numeric scale.
  v_amount := p_amount::numeric(14,2);
  v_payment_method := nullif(btrim(p_payment_method), '');
  v_reference_number := nullif(btrim(p_reference_number), '');

  select * into v_existing
  from public.supplier_payment_transactions t
  where t.recorded_by_user_id = v_actor
    and t.client_request_id = p_client_request_id
    and t.kind = 'PAYMENT'
    and t.source = 'MANUAL';
  if found then
    if v_existing.wedding_id is distinct from p_wedding_id
       or v_existing.supplier_id is distinct from p_supplier_id
       or v_existing.installment_id is distinct from p_installment_id
       or v_existing.budget_item_id is distinct from p_budget_item_id
       or v_existing.amount is distinct from v_amount
       or v_existing.paid_at is distinct from p_paid_at
       or v_existing.payment_method is distinct from v_payment_method
       or v_existing.reference_number is distinct from v_reference_number
       or v_existing.notes is distinct from p_notes then
      raise exception 'Client request ID conflicts with existing payment details.'
        using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  -- The partial unique index is authoritative. DO NOTHING waits for a
  -- concurrent winner; a fresh SELECT below then compares its committed row.
  insert into public.supplier_payment_transactions
    (wedding_id, supplier_id, installment_id, budget_item_id, amount,
     paid_at, payment_method, reference_number, notes,
     client_request_id, recorded_by_user_id)
  values (p_wedding_id, p_supplier_id, p_installment_id, p_budget_item_id,
    v_amount, p_paid_at, v_payment_method, v_reference_number, p_notes,
    p_client_request_id, v_actor)
  on conflict (recorded_by_user_id, client_request_id)
    where kind = 'PAYMENT' and source = 'MANUAL' and client_request_id is not null
  do nothing
  returning id into v_id;

  if v_id is not null then
    return v_id;
  end if;

  select * into v_existing
  from public.supplier_payment_transactions t
  where t.recorded_by_user_id = v_actor
    and t.client_request_id = p_client_request_id
    and t.kind = 'PAYMENT'
    and t.source = 'MANUAL';
  if not found then
    -- Avoid revealing whether an inaccessible row owns the colliding key.
    raise exception 'Client request ID is already in use.' using errcode = '22023';
  end if;
  if v_existing.wedding_id is distinct from p_wedding_id
     or v_existing.supplier_id is distinct from p_supplier_id
     or v_existing.installment_id is distinct from p_installment_id
     or v_existing.budget_item_id is distinct from p_budget_item_id
     or v_existing.amount is distinct from v_amount
     or v_existing.paid_at is distinct from p_paid_at
     or v_existing.payment_method is distinct from v_payment_method
     or v_existing.reference_number is distinct from v_reference_number
     or v_existing.notes is distinct from p_notes then
    raise exception 'Client request ID conflicts with existing payment details.'
      using errcode = '22023';
  end if;
  return v_existing.id;
end;
$function$;

revoke execute on function public.record_supplier_payment(
  uuid, uuid, uuid, uuid, numeric, timestamptz, uuid, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.record_supplier_payment(
  uuid, uuid, uuid, uuid, numeric, timestamptz, uuid, text, text, text
) to authenticated, service_role;

grant insert(wedding_id, supplier_id, installment_id, budget_item_id,
  kind, source, amount, paid_at, payment_method, reference_number, notes,
  client_request_id, recorded_by_user_id, reverses_transaction_id)
  on public.supplier_payment_transactions to authenticated;

comment on column public.supplier_payment_transactions.client_request_id is
  'Client-generated payment action key. Required for MANUAL PAYMENT rows; historical LEGACY and REVERSAL rows may remain null.';
comment on function public.record_supplier_payment(
  uuid, uuid, uuid, uuid, numeric, timestamptz, uuid, text, text, text
) is
  'Records an idempotent MANUAL PAYMENT keyed by recorder and client_request_id; exact replays return the existing transaction ID.';
comment on function public.reverse_supplier_payment(uuid, text) is
  'Reversal creation and retry behavior is separate from record_supplier_payment idempotency; a PAYMENT can be reversed once.';

commit;
