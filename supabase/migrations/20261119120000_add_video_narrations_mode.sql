-- One saved reel narration per race and story mode: the "full" flyover and the "highlights"
-- (temps forts) reel have different beat ids, so each keeps its own texts, settings and voice.
-- Existing rows are full narrations. The full voice clips stay in video-narrations/<race_id>.json;
-- highlights clips use <race_id>.highlights.json. RLS, grants and the bucket are unchanged.

alter table public.video_narrations
  add column mode text not null default 'full';

alter table public.video_narrations
  add constraint video_narrations_mode_check check (mode in ('full', 'highlights'));

-- The key widens from (race_id) to (race_id, mode); race_id stays the leading column, so lookups
-- and the on-delete-cascade foreign key keep using the primary key index.
alter table public.video_narrations
  drop constraint video_narrations_pkey;

alter table public.video_narrations
  add constraint video_narrations_pkey primary key (race_id, mode);
