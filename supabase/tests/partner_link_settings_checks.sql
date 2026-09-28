-- Partner-link configuration checks.
-- Run manually after migrations; all data mutations are rolled back.

begin;

do $$
begin
  if not (
    select c.relrowsecurity
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'partner_link_settings'
  ) then
    raise exception 'partner_link_settings must have RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.partner_link_settings', 'SELECT')
    or has_table_privilege('authenticated', 'public.partner_link_settings', 'SELECT')
    or has_table_privilege('anon', 'public.partner_link_settings', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.partner_link_settings', 'INSERT,UPDATE,DELETE') then
    raise exception 'Client roles must not access partner_link_settings.';
  end if;

  if not has_table_privilege('service_role', 'public.partner_link_settings', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'service_role must manage partner_link_settings.';
  end if;

  if (select count(*) from public.partner_link_settings) <> 2 then
    raise exception 'Exactly the Booking and Decathlon settings must be seeded.';
  end if;
end $$;

set local role service_role;

update public.partner_link_settings
set affiliate_url = 'https://example.test/affiliate/booking',
    affiliate_enabled = true,
    is_enabled = true,
    updated_at = timezone('utc', now())
where partner_key = 'booking';

do $$
begin
  if not exists (
    select 1
    from public.partner_link_settings
    where partner_key = 'booking'
      and affiliate_enabled
      and is_enabled
  ) then
    raise exception 'Service role must be able to update a partner configuration.';
  end if;

  begin
    update public.partner_link_settings
    set affiliate_url = null,
        affiliate_enabled = true
    where partner_key = 'booking';
    raise exception 'Expected affiliate-enabled configuration without URL to fail.';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.partner_link_settings (partner_key, standard_url)
    values ('unknown', 'https://example.test/');
    raise exception 'Expected unknown partner key to fail.';
  exception
    when check_violation then
      null;
  end;
end $$;

rollback;
