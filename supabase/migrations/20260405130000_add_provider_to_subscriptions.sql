alter table if exists public.subscriptions
  add column if not exists provider text not null default 'web';

update public.subscriptions
set provider = 'web'
where provider is null or btrim(provider) = '';

alter table if exists public.subscriptions
  drop constraint if exists subscriptions_provider_check;

alter table if exists public.subscriptions
  add constraint subscriptions_provider_check
  check (provider in ('web', 'google', 'apple'));
