alter table if exists public.app_feedback
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists kind text not null default 'feedback',
  add column if not exists source text not null default 'unknown',
  add column if not exists screen text,
  add column if not exists app_version text;

create index if not exists app_feedback_user_id_idx on public.app_feedback(user_id);
create index if not exists app_feedback_created_at_idx on public.app_feedback(created_at desc);

alter table if exists public.app_feedback
  drop constraint if exists app_feedback_kind_check;

alter table if exists public.app_feedback
  add constraint app_feedback_kind_check
  check (kind in ('bug', 'feedback'));

alter table if exists public.app_feedback
  drop constraint if exists app_feedback_source_check;

alter table if exists public.app_feedback
  add constraint app_feedback_source_check
  check (source in ('mobile', 'web', 'unknown'));

update public.app_feedback
set kind = 'bug'
where lower(coalesce(subject, '')) like '[bug] %';

update public.app_feedback
set kind = 'feedback'
where lower(coalesce(subject, '')) like '[feedback] %';

update public.app_feedback
set source = case
    when detail ~* '(^|[\r\n])Source:\s*mobile([\r\n]|$)' then 'mobile'
    when detail ~* '(^|[\r\n])Source:\s*web([\r\n]|$)' then 'web'
    else source
  end,
  screen = coalesce(
    nullif(substring(detail from '(?:^|[\r\n])(?:Screen|.cran):\s*([^\r\n]+)'), ''),
    screen
  )
where source = 'unknown'
   or screen is null;

drop policy if exists "Authenticated users can insert app feedback" on public.app_feedback;

create policy "Authenticated users can insert app feedback" on public.app_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);
