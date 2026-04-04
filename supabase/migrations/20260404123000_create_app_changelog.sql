create table if not exists public.app_changelog (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  version text not null,
  title text not null,
  detail text not null,
  is_published boolean not null default true,
  constraint app_changelog_version_key unique (version)
);

create index if not exists app_changelog_published_at_idx
  on public.app_changelog (published_at desc);

alter table public.app_changelog enable row level security;

drop policy if exists "Authenticated users can view app changelog" on public.app_changelog;
create policy "Authenticated users can view app changelog" on public.app_changelog
  for select
  to authenticated
  using (is_published = true);

insert into public.app_changelog (version, title, detail, published_at)
values (
  '1.0.0',
  'Mobile app rollout',
  E'- Initial Android mobile release\n- Google sign-in support\n- In-app feedback reporting\n- Planner UX and scroll continuity improvements',
  timezone('utc', now())
)
on conflict (version) do nothing;
