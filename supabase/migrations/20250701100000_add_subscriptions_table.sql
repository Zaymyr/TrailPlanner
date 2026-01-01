create extension if not exists "pgcrypto";

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  price_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_stripe_subscription_id_idx on public.subscriptions(stripe_subscription_id);

create or replace function public.set_subscriptions_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_subscriptions_updated_at();

alter table public.subscriptions enable row level security;

drop policy if exists "Service role can upsert subscriptions" on public.subscriptions;
create policy "Service role can upsert subscriptions" on public.subscriptions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Users can read their subscription" on public.subscriptions;
create policy "Users can read their subscription" on public.subscriptions
  for select using (auth.uid() = user_id);
