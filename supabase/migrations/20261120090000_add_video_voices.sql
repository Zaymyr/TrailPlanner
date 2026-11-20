-- Shared pool of ElevenLabs voices of the admin reel generator: each new reel picks one active
-- voice at random. Admin-only: the admin API routes use the service role, no client policy.

begin;

create or replace function public.set_video_voices_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.set_video_voices_updated_at() from public, anon, authenticated;

create table public.video_voices (
  id uuid primary key default gen_random_uuid(),
  elevenlabs_voice_id text not null unique
    check (elevenlabs_voice_id ~ '^[A-Za-z0-9]{8,64}$'),
  name text not null check (char_length(name) between 1 and 40),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index video_voices_created_by_idx on public.video_voices (created_by);

create trigger set_video_voices_updated_at
before update on public.video_voices
for each row execute function public.set_video_voices_updated_at();

alter table public.video_voices enable row level security;

revoke all on table public.video_voices from public, anon, authenticated;
grant select, insert, update, delete on table public.video_voices to service_role;

commit;
