-- Connected Instagram account checks.
-- Run in a privileged SQL session after 20261119130000_add_social_posts.sql.

begin;

do $$
begin
  if not (select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'social_accounts') then
    raise exception 'social_accounts must have RLS enabled.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'social_accounts') then
    raise exception 'social_accounts must have no client policy.';
  end if;
  if has_table_privilege('anon', 'public.social_accounts', 'SELECT')
    or has_table_privilege('authenticated', 'public.social_accounts', 'SELECT')
    or has_column_privilege('authenticated', 'public.social_accounts', 'access_token_encrypted', 'SELECT') then
    raise exception 'Client roles must not read social_accounts.';
  end if;
  if not has_table_privilege('service_role', 'public.social_accounts', 'UPDATE') then
    raise exception 'The service role must manage social_accounts.';
  end if;

  begin
    insert into public.social_accounts (ig_user_id, access_token_encrypted, token_expires_at, token_refreshed_at)
    values ('178414000000', 'clear-token', now() + interval '60 days', now());
    raise exception 'A token stored without the encryption envelope was accepted.';
  exception when check_violation then null;
  end;

  insert into public.social_accounts (ig_user_id, access_token_encrypted, token_expires_at, token_refreshed_at)
  values ('178414000000', 'v1:a:b:c', now() + interval '60 days', now());
  begin
    insert into public.social_accounts (ig_user_id, access_token_encrypted, token_expires_at, token_refreshed_at)
    values ('178414000000', 'v1:d:e:f', now() + interval '60 days', now());
    raise exception 'Two rows for the same Instagram account were accepted.';
  exception when unique_violation then null;
  end;

  begin
    update public.social_accounts set status = 'expired' where ig_user_id = '178414000000';
    raise exception 'An unknown account status was accepted.';
  exception when check_violation then null;
  end;
end;
$$;

rollback;
