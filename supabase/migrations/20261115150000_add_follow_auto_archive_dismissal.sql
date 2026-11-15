alter table public.plan_share_follows
  add column if not exists auto_archive_dismissed_at timestamptz;

comment on column public.plan_share_follows.auto_archive_dismissed_at is
  'Set when a follower explicitly restores a completed race so calculated auto-archive does not immediately reapply.';
