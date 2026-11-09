-- Giftable organizer features are pack exceptions, not products sold a la carte.
-- Keep their availability catalog while removing every monetary representation.

do $$
begin
  if exists (
    select 1
    from public.organizer_invoices invoice_row
    where invoice_row.document_status = 'active'
      and invoice_row.paid_at is not null
      and exists (
        select 1
        from jsonb_array_elements(coalesce(invoice_row.legal_snapshot -> 'lines', '[]'::jsonb)) line
        where line ? 'featureKey'
          and (line ? 'unitPriceCents' or line ? 'discountCents' or line ? 'netCents')
      )
  ) then
    raise exception 'A paid active organizer invoice still contains priced gifted features; an automatic correction is not allowed.';
  end if;

  if exists (
    select 1
    from public.organizer_invoices invoice_row
    where invoice_row.document_status = 'active'
      and invoice_row.paid_at is null
      and invoice_row.created_by is null
      and exists (
        select 1
        from jsonb_array_elements(coalesce(invoice_row.legal_snapshot -> 'lines', '[]'::jsonb)) line
        where line ? 'featureKey'
          and (line ? 'unitPriceCents' or line ? 'discountCents' or line ? 'netCents')
      )
  ) then
    raise exception 'An active organizer invoice with priced gifted features has no audit actor.';
  end if;
end;
$$;

drop function public.update_admin_organizer_feature_catalog(uuid, text, integer, boolean);

alter table public.organizer_feature_catalog
  drop column unit_price_cents,
  drop column currency;

create function public.update_admin_organizer_feature_catalog(
  p_admin_id uuid,
  p_feature_key text,
  p_is_active boolean
)
returns public.organizer_feature_catalog
language plpgsql
security invoker
set search_path = ''
as $$
declare catalog_row public.organizer_feature_catalog;
begin
  if p_admin_id is null or p_is_active is null then
    raise exception 'Invalid organizer feature catalog update.' using errcode = '22023';
  end if;

  update public.organizer_feature_catalog
  set is_active = p_is_active,
      updated_by = p_admin_id,
      updated_at = now()
  where feature_key = p_feature_key
  returning * into catalog_row;

  if catalog_row.feature_key is null then
    raise exception 'Unknown organizer feature.' using errcode = '22023';
  end if;
  return catalog_row;
end;
$$;

revoke all on function public.update_admin_organizer_feature_catalog(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.update_admin_organizer_feature_catalog(uuid, text, boolean) to service_role;

create function private.validate_organizer_invoice_gift_lines()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pack_line jsonb;
begin
  if jsonb_typeof(new.legal_snapshot -> 'lines') <> 'array' then
    raise exception 'Organizer invoice lines are required.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.legal_snapshot -> 'lines') line
    where line ? 'featureKey'
      and (
        coalesce((line ->> 'offered')::boolean, false) is not true
        or line ? 'unitPriceCents'
        or line ? 'discountCents'
        or line ? 'netCents'
      )
  ) then
    raise exception 'Gifted organizer features cannot carry monetary values.' using errcode = '23514';
  end if;

  if (select count(*) from jsonb_array_elements(new.legal_snapshot -> 'lines') line where not (line ? 'featureKey')) <> 1 then
    raise exception 'An organizer invoice must contain exactly one priced pack line.' using errcode = '23514';
  end if;

  select line into pack_line
  from jsonb_array_elements(new.legal_snapshot -> 'lines') line
  where not (line ? 'featureKey')
  limit 1;

  if jsonb_typeof(pack_line -> 'unitPriceCents') <> 'number'
    or jsonb_typeof(pack_line -> 'discountCents') <> 'number'
    or jsonb_typeof(pack_line -> 'netCents') <> 'number'
    or new.original_subtotal <> (pack_line ->> 'unitPriceCents')::integer
    or new.discount_total <> (pack_line ->> 'discountCents')::integer
    or new.net_total <> (pack_line ->> 'netCents')::integer
  then
    raise exception 'Organizer invoice totals must describe only the priced pack.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_organizer_invoice_gift_lines_trigger
before insert on public.organizer_invoices
for each row execute function private.validate_organizer_invoice_gift_lines();

revoke all on function private.validate_organizer_invoice_gift_lines() from public, anon, authenticated;
grant execute on function private.validate_organizer_invoice_gift_lines() to service_role;

-- Replace every still-active unpaid invoice produced by the former priced-gift
-- model. The immutable original remains downloadable for the audit trail.
do $$
declare
  source_invoice public.organizer_invoices;
  corrected_lines jsonb;
  corrected_snapshot jsonb;
  pack_line jsonb;
  pack_catalog integer;
  pack_discount integer;
  pack_net integer;
begin
  for source_invoice in
    select invoice_row.*
    from public.organizer_invoices invoice_row
    where invoice_row.document_status = 'active'
      and invoice_row.paid_at is null
      and exists (
        select 1
        from jsonb_array_elements(coalesce(invoice_row.legal_snapshot -> 'lines', '[]'::jsonb)) line
        where line ? 'featureKey'
          and (line ? 'unitPriceCents' or line ? 'discountCents' or line ? 'netCents')
      )
    order by invoice_row.invoice_issued_at, invoice_row.id
    for update
  loop
    select jsonb_agg(
      case
        when line ? 'featureKey'
          then (line - 'unitPriceCents' - 'discountCents' - 'netCents') || jsonb_build_object('offered', true)
        else line
      end
      order by ordinal
    ) into corrected_lines
    from jsonb_array_elements(source_invoice.legal_snapshot -> 'lines') with ordinality as invoice_line(line, ordinal);

    select line into pack_line
    from jsonb_array_elements(corrected_lines) line
    where not (line ? 'featureKey')
    limit 1;

    if pack_line is null
      or jsonb_typeof(pack_line -> 'unitPriceCents') <> 'number'
      or jsonb_typeof(pack_line -> 'discountCents') <> 'number'
      or jsonb_typeof(pack_line -> 'netCents') <> 'number'
    then
      raise exception 'Invoice % has no usable priced pack line.', source_invoice.invoice_number;
    end if;

    pack_catalog := (pack_line ->> 'unitPriceCents')::integer;
    pack_discount := (pack_line ->> 'discountCents')::integer;
    pack_net := (pack_line ->> 'netCents')::integer;

    corrected_snapshot := jsonb_set(source_invoice.legal_snapshot, '{lines}', corrected_lines, false);
    corrected_snapshot := jsonb_set(
      corrected_snapshot,
      '{commercialTotals}',
      jsonb_build_object(
        'originalSubtotalCents', pack_catalog,
        'discountTotalCents', pack_discount,
        'netTotalCents', pack_net
      ),
      true
    );
    corrected_snapshot := jsonb_set(
      corrected_snapshot,
      '{correction}',
      jsonb_build_object(
        'replacesInvoiceNumber', source_invoice.invoice_number,
        'replacesIssuedAt', source_invoice.invoice_issued_at
      ),
      true
    );

    perform public.issue_admin_organizer_invoice(
      source_invoice.edition_id,
      source_invoice.created_by,
      source_invoice.tier,
      source_invoice.service_date,
      source_invoice.due_date,
      pack_catalog,
      pack_discount,
      pack_net,
      corrected_snapshot,
      source_invoice.id
    );
  end loop;
end;
$$;

comment on table public.organizer_feature_catalog is 'Service-only availability catalog for individually giftable organizer features; features have no standalone price.';
comment on column public.organizer_invoices.original_subtotal is 'Catalog price of the pack only, excluding gifted features.';
comment on column public.organizer_invoices.discount_total is 'Discount applied to the pack only, excluding gifted features.';
