-- Preserve historical trial dates; newly created users receive an ordinary profile.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), '');
begin
  insert into public.user_profiles (user_id, full_name)
  values (new.id, profile_name)
  on conflict (user_id) do update
    set full_name = coalesce(public.user_profiles.full_name, excluded.full_name);
  return new;
end;
$$;

-- This is a trigger implementation, never a public RPC.
revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
