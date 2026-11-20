-- Automatic reel pipeline (admin): one settings row (both switches off by default) and one item per
-- planned race and edition, advanced by the cron route /api/cron/reel-automation. Admin-only like
-- video_render_jobs: RLS on, no client policy, service role only. Additive: no existing object changes.

begin;

create or replace function public.set_reel_automation_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.set_reel_automation_updated_at() from public, anon, authenticated;

create table public.reel_automation_settings (
  id boolean primary key default true check (id),
  generation_enabled boolean not null default false,
  auto_publish_enabled boolean not null default false,
  max_per_week integer not null default 3 check (max_per_week between 1 and 7),
  max_per_day integer not null default 1 check (max_per_day between 1 and 3),
  lead_days integer not null default 3 check (lead_days between 1 and 14),
  publish_time time not null default '18:00',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  -- Publishing without review only makes sense while generation runs.
  constraint reel_automation_settings_publish_needs_generation check (not auto_publish_enabled or generation_enabled)
);

create index reel_automation_settings_updated_by_idx on public.reel_automation_settings (updated_by);

insert into public.reel_automation_settings (id) values (true) on conflict (id) do nothing;

create trigger set_reel_automation_settings_updated_at
before update on public.reel_automation_settings
for each row execute function public.set_reel_automation_updated_at();

create table public.reel_automation_items (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  edition_key text not null check (char_length(edition_key) between 1 and 200),
  mode text not null check (mode in ('full', 'highlights')),
  planned_publish_date date not null,
  status text not null default 'planned'
    check (status in ('planned', 'generating', 'rendering', 'drafted', 'scheduled', 'skipped', 'failed')),
  -- Next step of the executor while generating: content, voice, render.
  step text check (step is null or step in ('content', 'voice', 'render')),
  attempts integer not null default 0 check (attempts >= 0),
  error text check (error is null or char_length(error) <= 1000),
  -- Why the item is skipped: too_late, duplicate (automatic, recomputed) or excluded (admin, kept).
  reason text check (reason is null or reason in ('too_late', 'duplicate', 'excluded', 'ineligible')),
  -- Data handed from one step to the next (reel text, place names, landmarks, voice).
  work jsonb check (work is null or jsonb_typeof(work) = 'object'),
  render_job_id uuid references public.video_render_jobs(id) on delete set null,
  social_post_id uuid references public.social_posts(id) on delete set null,
  locked_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  -- Never two automation items for the same race and edition.
  constraint reel_automation_items_race_edition_key unique (race_id, edition_key)
);

create index reel_automation_items_status_date_idx on public.reel_automation_items (status, planned_publish_date);
create index reel_automation_items_render_job_idx on public.reel_automation_items (render_job_id);
create index reel_automation_items_social_post_idx on public.reel_automation_items (social_post_id);

create trigger set_reel_automation_items_updated_at
before update on public.reel_automation_items
for each row execute function public.set_reel_automation_updated_at();

alter table public.reel_automation_settings enable row level security;
alter table public.reel_automation_items enable row level security;

revoke all on table public.reel_automation_settings from public, anon, authenticated;
revoke all on table public.reel_automation_items from public, anon, authenticated;
grant select, insert, update, delete on table public.reel_automation_settings to service_role;
grant select, insert, update, delete on table public.reel_automation_items to service_role;

commit;
