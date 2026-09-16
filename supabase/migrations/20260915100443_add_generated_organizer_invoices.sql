alter table public.organizer_edition_payments
  add column if not exists invoice_number text,
  add column if not exists invoice_sequence integer,
  add column if not exists invoice_issued_at timestamptz,
  add column if not exists invoice_source text,
  add column if not exists invoice_legal_snapshot jsonb;

create unique index if not exists organizer_edition_payments_invoice_number_idx
  on public.organizer_edition_payments (invoice_number)
  where invoice_number is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizer_edition_payments_generated_invoice_check'
      and conrelid = 'public.organizer_edition_payments'::regclass
  ) then
    alter table public.organizer_edition_payments
      add constraint organizer_edition_payments_generated_invoice_check
      check (
        (
          invoice_number is null
          and invoice_sequence is null
          and invoice_issued_at is null
          and invoice_source is null
          and invoice_legal_snapshot is null
        )
        or (
          invoice_number is not null
          and invoice_sequence is not null and invoice_sequence > 0
          and invoice_issued_at is not null
          and invoice_source = 'generated'
          and jsonb_typeof(invoice_legal_snapshot) = 'object'
          and (
            (invoice_storage_path is null and invoice_original_name is null and invoice_uploaded_at is null and invoice_uploaded_by is null)
            or
            (invoice_storage_path is not null and invoice_original_name is not null and invoice_uploaded_at is not null and invoice_uploaded_by is not null)
          )
        )
        or (
          invoice_number is null
          and invoice_sequence is null
          and invoice_issued_at is null
          and invoice_source = 'uploaded'
          and invoice_legal_snapshot is null
          and invoice_storage_path is not null
        )
      ) not valid;
  end if;
end $$;

update public.organizer_edition_payments
set invoice_source = 'uploaded'
where invoice_storage_path is not null
  and invoice_source is null;

alter table public.organizer_edition_payments
  validate constraint organizer_edition_payments_generated_invoice_check;

create or replace function public.issue_admin_organizer_invoice(
  p_payment_id uuid,
  p_admin_id uuid,
  p_invoice_legal_snapshot jsonb
)
returns public.organizer_edition_payments
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  payment_row public.organizer_edition_payments;
  issued_at timestamptz := now();
  issued_year integer := extract(year from timezone('Europe/Paris', now()))::integer;
  next_sequence integer;
begin
  if p_admin_id is null
    or p_invoice_legal_snapshot is null
    or jsonb_typeof(p_invoice_legal_snapshot) <> 'object'
  then
    raise exception 'Incomplete generated invoice metadata.';
  end if;

  select * into payment_row
  from public.organizer_edition_payments
  where id = p_payment_id
  for update;

  if payment_row.id is null
    or payment_row.payment_channel <> 'bank_transfer'
    or payment_row.status <> 'paid'
  then
    raise exception 'A paid bank transfer is required.';
  end if;
  if payment_row.invoice_number is not null then
    raise exception 'This payment already has an issued invoice.';
  end if;

  perform pg_advisory_xact_lock(hashtext('organizer_invoice_' || issued_year::text));
  select coalesce(max(invoice_sequence), 0) + 1
  into next_sequence
  from public.organizer_edition_payments
  where invoice_issued_at >= make_timestamptz(issued_year, 1, 1, 0, 0, 0, 'Europe/Paris')
    and invoice_issued_at < make_timestamptz(issued_year + 1, 1, 1, 0, 0, 0, 'Europe/Paris');

  update public.organizer_edition_payments
  set invoice_number = 'PY-' || issued_year::text || '-' || lpad(next_sequence::text, 6, '0'),
      invoice_sequence = next_sequence,
      invoice_issued_at = issued_at,
      invoice_source = 'generated',
      invoice_legal_snapshot = p_invoice_legal_snapshot,
      updated_at = issued_at
  where id = payment_row.id
  returning * into payment_row;

  return payment_row;
end;
$$;

revoke all on function public.issue_admin_organizer_invoice(uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.issue_admin_organizer_invoice(uuid, uuid, jsonb)
to service_role;

comment on column public.organizer_edition_payments.invoice_number is
  'Immutable chronological invoice identifier allocated when an automatic PDF is issued.';
comment on column public.organizer_edition_payments.invoice_legal_snapshot is
  'Exact seller, customer, service, payment and amount facts rendered into the issued PDF.';
comment on function public.issue_admin_organizer_invoice(uuid, uuid, jsonb) is
  'Allocates a gap-free yearly invoice number under an advisory lock and stores the immutable legal snapshot before the private PDF is rendered.';

create or replace function public.record_admin_organizer_bank_transfer_invoice(
  p_edition_id uuid,
  p_admin_id uuid,
  p_tier text,
  p_paid_at timestamptz,
  p_amount_subtotal integer,
  p_invoice_legal_snapshot jsonb
)
returns public.organizer_edition_payments
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  payment_row public.organizer_edition_payments;
begin
  payment_row := public.record_admin_organizer_bank_transfer(
    p_edition_id,
    p_admin_id,
    p_tier,
    p_paid_at,
    p_amount_subtotal,
    0,
    null,
    null
  );
  return public.issue_admin_organizer_invoice(payment_row.id, p_admin_id, p_invoice_legal_snapshot);
end;
$$;

revoke all on function public.record_admin_organizer_bank_transfer_invoice(uuid, uuid, text, timestamptz, integer, jsonb)
from public, anon, authenticated;
grant execute on function public.record_admin_organizer_bank_transfer_invoice(uuid, uuid, text, timestamptz, integer, jsonb)
to service_role;

comment on function public.record_admin_organizer_bank_transfer_invoice(uuid, uuid, text, timestamptz, integer, jsonb) is
  'Atomically records a VAT-exempt paid bank transfer, recalculates its entitlement, and issues its immutable invoice number and legal snapshot.';

create or replace function private.protect_issued_organizer_invoice()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and old.invoice_number is not null then
    raise exception 'An issued organizer invoice cannot be deleted.';
  end if;
  if tg_op = 'UPDATE' and old.invoice_number is not null and (
    new.invoice_number is distinct from old.invoice_number
    or new.invoice_sequence is distinct from old.invoice_sequence
    or new.invoice_issued_at is distinct from old.invoice_issued_at
    or new.invoice_source is distinct from old.invoice_source
    or new.invoice_legal_snapshot is distinct from old.invoice_legal_snapshot
    or new.edition_id is distinct from old.edition_id
    or new.amount_subtotal is distinct from old.amount_subtotal
    or new.amount_tax is distinct from old.amount_tax
    or new.amount_total is distinct from old.amount_total
    or new.currency is distinct from old.currency
    or new.paid_at is distinct from old.paid_at
  ) then
    raise exception 'Issued organizer invoice facts are immutable.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_issued_organizer_invoice_trigger on public.organizer_edition_payments;
create trigger protect_issued_organizer_invoice_trigger
before update or delete on public.organizer_edition_payments
for each row execute function private.protect_issued_organizer_invoice();

revoke all on function private.protect_issued_organizer_invoice() from public, anon, authenticated;
grant execute on function private.protect_issued_organizer_invoice() to service_role;

comment on function private.protect_issued_organizer_invoice() is
  'Prevents deletion or mutation of the legal facts of an issued organizer invoice while allowing its private PDF attachment metadata to be repaired.';
