do $verify$
begin
  if (select count(*) from private.legacy_supplier_payments
      where wedding_id='10000000-0000-0000-0000-000000000790') <> 3
    or (select count(*) from public.supplier_installments
      where wedding_id='10000000-0000-0000-0000-000000000790') <> 3
    or (select count(*) from public.supplier_payment_transactions
      where wedding_id='10000000-0000-0000-0000-000000000790') <> 3 then
    raise exception 'Legacy row counts changed during migration';
  end if;
  if not exists (select 1 from public.supplier_payment_transactions
      where id='70000000-0000-0000-0000-000000000790'
        and kind='PAYMENT' and source='LEGACY' and amount=100
        and paid_at='2026-09-25 10:00+00'::timestamptz
        and payment_method='Bank transfer' and reference_number='LEGACY-001'
        and installment_id='70000000-0000-0000-0000-000000000790') then
    raise exception 'Legacy actual payment details were not preserved';
  end if;
  if not exists (select 1 from public.supplier_payment_transactions
      where reverses_transaction_id='70000000-0000-0000-0000-000000000791'
        and kind='REVERSAL' and amount=50
        and paid_at='2026-09-26 10:00+00'::timestamptz
        and id=md5('70000000-0000-0000-0000-000000000791:legacy-reversal')::uuid) then
    raise exception 'Cancelled paid row did not get a deterministic reversal';
  end if;
  if (select count(*) from public.payment_receipt_attachments
      where wedding_id='10000000-0000-0000-0000-000000000790') <> 1
    or not exists (select 1 from public.payment_receipt_attachments
      where payment_id='70000000-0000-0000-0000-000000000790'
        and attachment_id='40000000-0000-0000-0000-000000000790')
    or (select count(*) from private.legacy_payment_receipt_attachments
      where wedding_id='10000000-0000-0000-0000-000000000790') <> 2 then
    raise exception 'Paid or pending legacy attachment relationship was lost';
  end if;
  if not exists (select 1 from public.supplier_contract_attachments
      where supplier_id='50000000-0000-0000-0000-000000000790'
        and attachment_id='40000000-0000-0000-0000-000000000792') then
    raise exception 'Contract attachment relationship was lost';
  end if;
  if not exists (select 1 from public.budget_items
      where id='60000000-0000-0000-0000-000000000790'
        and actual_amount is null and legacy_supplier_actual_amount=40) then
    raise exception 'Ambiguous supplier budget actual was not preserved for audit';
  end if;
end;
$verify$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000790',true);
do $verify$
begin
  if not exists (select 1 from public.wedding_payment_totals
      where wedding_id='10000000-0000-0000-0000-000000000790'
        and scheduled_total=125 and paid_total=100 and overdue_total=0)
    or not exists (select 1 from public.wedding_budget_totals
      where wedding_id='10000000-0000-0000-0000-000000000790'
        and manual_actual_total=5 and supplier_actual_total=100 and actual_total=105) then
    raise exception 'Migrated totals double-counted or omitted historical costs';
  end if;
end;
$verify$;
rollback;
