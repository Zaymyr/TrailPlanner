alter table if exists public.user_profiles
  add column if not exists sign_in_count integer not null default 0,
  add column if not exists first_sign_in_at timestamptz,
  add column if not exists last_sign_in_at timestamptz;

create or replace function public.increment_user_sign_in(p_user_id uuid, p_signed_in_at timestamptz default timezone('utc', now()))
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_profiles
  set
    sign_in_count = coalesce(sign_in_count, 0) + 1,
    first_sign_in_at = coalesce(first_sign_in_at, p_signed_in_at),
    last_sign_in_at = p_signed_in_at
  where user_id = p_user_id;
end;
$$;

revoke all on function public.increment_user_sign_in(uuid, timestamptz) from public;
grant execute on function public.increment_user_sign_in(uuid, timestamptz) to service_role;
