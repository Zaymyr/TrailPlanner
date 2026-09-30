create table public.organizer_social_proofs (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null unique references public.race_event_editions(id) on delete cascade,
  status text not null default 'draft',
  display_order smallint not null default 0,
  quote_text text,
  quote_author_name text,
  quote_author_role text,
  consent_confirmed_at timestamptz,
  unique_readers integer not null default 0,
  total_opens integer not null default 0,
  analytics_from date,
  analytics_to date,
  analytics_captured_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint organizer_social_proofs_status_check
    check (status in ('draft', 'published')),
  constraint organizer_social_proofs_display_order_check
    check (display_order between 0 and 999),
  constraint organizer_social_proofs_quote_text_check
    check (quote_text is null or char_length(quote_text) between 1 and 1000),
  constraint organizer_social_proofs_quote_author_name_check
    check (quote_author_name is null or char_length(quote_author_name) between 1 and 160),
  constraint organizer_social_proofs_quote_author_role_check
    check (quote_author_role is null or char_length(quote_author_role) between 1 and 160),
  constraint organizer_social_proofs_quote_attribution_check
    check (quote_text is not null or (quote_author_name is null and quote_author_role is null)),
  constraint organizer_social_proofs_analytics_window_check
    check (
      (analytics_from is null and analytics_to is null and analytics_captured_at is null)
      or (
        analytics_from is not null
        and analytics_to is not null
        and analytics_captured_at is not null
        and analytics_to >= analytics_from
      )
    ),
  constraint organizer_social_proofs_publishable_check
    check (
      status = 'draft'
      or (
        consent_confirmed_at is not null
        and analytics_captured_at is not null
        and published_at is not null
      )
    ),
  constraint organizer_social_proofs_metrics_check
    check (unique_readers >= 0 and total_opens >= 0 and total_opens >= unique_readers)
);

comment on table public.organizer_social_proofs is
  'Admin-curated edition social proof with immutable-at-display aggregate RaceBook analytics snapshots.';

create index organizer_social_proofs_published_order_idx
  on public.organizer_social_proofs (display_order asc, published_at desc)
  where status = 'published';

alter table public.organizer_social_proofs enable row level security;

revoke all on table public.organizer_social_proofs from public, anon, authenticated;
grant select, insert, update, delete on table public.organizer_social_proofs to service_role;
