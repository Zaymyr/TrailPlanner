-- Optional short event name for the admin reel hook (« Nom court (vidéo) »): the reel shows it
-- over the opening shot instead of deriving one from race_events.name. Additive and nullable:
-- RLS, grants, policies and every existing read are unchanged; only admin server routes (service
-- role) read and write it.

alter table public.race_events
  add column if not exists short_name text;

alter table public.race_events
  drop constraint if exists race_events_short_name_check,
  add constraint race_events_short_name_check
    check (
      short_name is null
      or (
        char_length(btrim(short_name)) between 1 and 40
        and position('…' in short_name) = 0
      )
    );

comment on column public.race_events.short_name is
  'Optional short event name shown by the admin reel hook (1-40 characters once trimmed, never truncated with an ellipsis). Null: the reel derives it from name.';
