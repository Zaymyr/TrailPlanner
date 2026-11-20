-- Automatic reel pipeline checks.
-- Run in a privileged SQL session after 20261120140000_add_reel_automation.sql and
-- 20261120140100_schedule_reel_automation_cron.sql.

begin;

do $$
declare
  v_table text;
  v_race uuid;
  v_item uuid;
begin
  foreach v_table in array array['reel_automation_settings', 'reel_automation_items'] loop
    if not (select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = v_table) then
      raise exception '% must have RLS enabled.', v_table;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_table) then
      raise exception '% must have no client policy.', v_table;
    end if;
    if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
      or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') then
      raise exception 'Client roles must not access %.', v_table;
    end if;
    if not has_table_privilege('service_role', format('public.%I', v_table), 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'The service role must manage %.', v_table;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.configure_reel_automation_cron()', 'execute')
    or has_function_privilege('authenticated', 'public.configure_reel_automation_cron()', 'execute') then
    raise exception 'Client roles must not configure the reel automation cron.';
  end if;
  if not exists (select 1 from cron.job where jobname = 'reel-automation' and schedule = '17 * * * *') then
    raise exception 'The reel-automation cron job must run hourly at :17.';
  end if;

  -- One settings row, both switches off by default.
  if (select count(*) from public.reel_automation_settings) <> 1 then
    raise exception 'reel_automation_settings must hold exactly one row.';
  end if;
  if (select generation_enabled or auto_publish_enabled from public.reel_automation_settings) then
    raise exception 'Both automation switches must be off by default.';
  end if;
  begin
    insert into public.reel_automation_settings (id) values (false);
    raise exception 'A second settings row must be rejected.';
  exception when check_violation then
    null;
  end;
  begin
    update public.reel_automation_settings set auto_publish_enabled = true, generation_enabled = false;
    raise exception 'Automatic publication without generation must be rejected.';
  exception when check_violation then
    null;
  end;

  select id into v_race from public.races limit 1;
  if v_race is null then
    raise notice 'No race: item checks skipped.';
    return;
  end if;

  insert into public.reel_automation_items (race_id, edition_key, mode, planned_publish_date)
  values (v_race, 'edition:check', 'highlights', '2030-01-01')
  returning id into v_item;
  if (select status from public.reel_automation_items where id = v_item) <> 'planned' then
    raise exception 'A new item must be planned.';
  end if;

  begin
    insert into public.reel_automation_items (race_id, edition_key, mode, planned_publish_date)
    values (v_race, 'edition:check', 'full', '2030-01-02');
    raise exception 'A second item for the same race and edition must be rejected.';
  exception when unique_violation then
    null;
  end;
  begin
    update public.reel_automation_items set status = 'published' where id = v_item;
    raise exception 'An unknown status must be rejected.';
  exception when check_violation then
    null;
  end;
  begin
    update public.reel_automation_items set mode = 'teaser' where id = v_item;
    raise exception 'An unknown mode must be rejected.';
  exception when check_violation then
    null;
  end;
  begin
    update public.reel_automation_items set work = '[]'::jsonb where id = v_item;
    raise exception 'A non-object work payload must be rejected.';
  exception when check_violation then
    null;
  end;
end;
$$;

rollback;
