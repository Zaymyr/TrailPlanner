-- Trail Ton Château is billed under the VAT exemption. Correct the one
-- Essential bank transfer recorded on 2026-09-11 without changing its HT
-- amount, payment status, entitlement, or invoice metadata.
update public.organizer_edition_payments
set amount_tax = 0,
    amount_total = amount_subtotal
where edition_id = 'e1a49881-dc73-41c0-b39c-c7a1df536aab'::uuid
  and payment_channel = 'bank_transfer'
  and purchase_kind = 'essential_direct'
  and to_tier = 'essential'
  and status = 'paid'
  and paid_at = timestamptz '2026-09-11 00:00:00+00'
  and amount_subtotal = 9900
  and amount_tax = 1980
  and amount_total = 11880;
