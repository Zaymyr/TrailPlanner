-- Transactional checks for RaceBook partner slots. Run with a privileged role:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/racebook_partner_slots_checks.sql
begin;

do $$
declare
  edition_a uuid;
  edition_b uuid;
  sponsor_b uuid;
  rejected boolean;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.race_event_edition_partner_slots'::regclass) then
    raise exception 'race_event_edition_partner_slots must have RLS enabled';
  end if;
  if has_table_privilege('anon', 'public.race_event_edition_partner_slots', 'select')
    or has_table_privilege('authenticated', 'public.race_event_edition_partner_slots', 'select')
    or has_table_privilege('authenticated', 'public.race_event_edition_partner_slots', 'insert') then
    raise exception 'partner slots must not be readable or writable by client roles';
  end if;
  if has_function_privilege('anon', 'public.increment_racebook_partner_slot_metric(uuid, text, text)', 'execute')
    or has_function_privilege('authenticated', 'public.increment_racebook_partner_slot_metric(uuid, text, text)', 'execute') then
    raise exception 'partner slot metric RPC must be service-only';
  end if;

  select id into edition_a from public.race_event_editions order by id limit 1;
  select id into edition_b from public.race_event_editions where id <> edition_a order by id limit 1;
  if edition_a is null or edition_b is null then
    raise notice 'Skipping data checks: fewer than two editions exist.';
    return;
  end if;

  insert into public.race_event_edition_sponsors (edition_id, name, logo_url, is_active, show_in_banner, position)
  values (edition_b, 'Partner slot fixture', 'https://example.com/logo.png', false, false, 9)
  returning id into sponsor_b;

  -- A partner slot cannot point at another edition's sponsor.
  rejected := false;
  begin
    insert into public.race_event_edition_partner_slots (edition_id, slot_key, mode, sponsor_id)
    values (edition_a, 'equipment', 'partner', sponsor_b);
  exception when foreign_key_violation then rejected := true;
  end;
  if not rejected then raise exception 'cross-edition partner sponsor must be rejected'; end if;

  -- Partner mode requires a sponsor; other modes forbid one.
  rejected := false;
  begin
    insert into public.race_event_edition_partner_slots (edition_id, slot_key, mode) values (edition_b, 'lodging', 'partner');
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'partner mode without sponsor must be rejected'; end if;

  -- Deleting the sponsor returns the slot to its default by deleting the row.
  insert into public.race_event_edition_partner_slots (edition_id, slot_key, mode, sponsor_id, headline)
  values (edition_b, 'equipment', 'partner', sponsor_b, 'Magasin partenaire');
  delete from public.race_event_edition_sponsors where id = sponsor_b;
  if exists (select 1 from public.race_event_edition_partner_slots where edition_id = edition_b and slot_key = 'equipment') then
    raise exception 'sponsor deletion must cascade to its partner slot';
  end if;

  -- Invalid metric input is rejected before any update.
  rejected := false;
  begin
    perform public.increment_racebook_partner_slot_metric(gen_random_uuid(), 'equipment', 'share');
  exception when invalid_parameter_value then rejected := true;
  end;
  if not rejected then raise exception 'invalid partner slot metric must be rejected'; end if;
end;
$$;

rollback;
