-- organizer_demo_requests privilege and constraint checks.
-- Run after 20261116150000_add_organizer_demo_requests.sql in a privileged test database.

begin;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.organizer_demo_requests'::regclass) then
    raise exception 'organizer_demo_requests must have RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.organizer_demo_requests', 'select,insert,update,delete')
    or has_table_privilege('authenticated', 'public.organizer_demo_requests', 'select,insert,update,delete') then
    raise exception 'Clients must not access organizer_demo_requests.';
  end if;

  if not has_table_privilege('service_role', 'public.organizer_demo_requests', 'select,insert,update,delete') then
    raise exception 'service_role needs full access to organizer_demo_requests.';
  end if;

  begin
    insert into public.organizer_demo_requests (email, race_url) values ('orga@trail.fr', 'ftp://trail.fr');
    raise exception 'A non-http race link must be rejected.';
  exception when check_violation then null;
  end;

  insert into public.organizer_demo_requests (email, race_url, phone) values ('orga@trail.fr', 'https://trail.fr', null);
  if not exists (select 1 from public.organizer_demo_requests where email = 'orga@trail.fr' and is_pending) then
    raise exception 'A new demo request must be pending.';
  end if;
end;
$$;

rollback;
