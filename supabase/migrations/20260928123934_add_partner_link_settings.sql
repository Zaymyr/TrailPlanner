create table public.partner_link_settings (
  partner_key text primary key,
  standard_url text not null,
  affiliate_url text,
  affiliate_enabled boolean not null default false,
  is_enabled boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id) on delete set null,
  constraint partner_link_settings_partner_key_check
    check (partner_key in ('booking', 'decathlon')),
  constraint partner_link_settings_standard_url_check
    check (standard_url ~ '^https://[^[:space:]]+$'),
  constraint partner_link_settings_affiliate_url_check
    check (affiliate_url is null or affiliate_url ~ '^https://[^[:space:]]+$'),
  constraint partner_link_settings_affiliate_enabled_check
    check (not affiliate_enabled or affiliate_url is not null)
);

comment on table public.partner_link_settings is
  'Service-managed outbound partner URLs. Clients resolve active links through application routes.';

alter table public.partner_link_settings enable row level security;

revoke all on table public.partner_link_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.partner_link_settings to service_role;

insert into public.partner_link_settings (
  partner_key,
  standard_url,
  affiliate_url,
  affiliate_enabled,
  is_enabled
)
values
  ('booking', 'https://www.booking.com/', null, false, false),
  ('decathlon', 'https://www.decathlon.fr/', null, false, false)
on conflict (partner_key) do nothing;
