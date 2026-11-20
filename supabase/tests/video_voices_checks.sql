-- Admin reel voice pool checks.
-- Run in a privileged SQL session after 20261120090000_add_video_voices.sql.

begin;

do $$
declare
  first_id uuid;
begin
  if not (select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'video_voices') then
    raise exception 'video_voices must have RLS enabled.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'video_voices') then
    raise exception 'video_voices must have no client policy.';
  end if;
  if has_table_privilege('anon', 'public.video_voices', 'SELECT')
    or has_table_privilege('authenticated', 'public.video_voices', 'SELECT')
    or has_table_privilege('authenticated', 'public.video_voices', 'INSERT')
    or has_table_privilege('authenticated', 'public.video_voices', 'UPDATE')
    or has_table_privilege('authenticated', 'public.video_voices', 'DELETE') then
    raise exception 'Client roles must not access video_voices.';
  end if;
  if not has_table_privilege('service_role', 'public.video_voices', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'The service role must manage video_voices.';
  end if;
  if has_function_privilege('anon', 'public.set_video_voices_updated_at()', 'execute')
    or has_function_privilege('authenticated', 'public.set_video_voices_updated_at()', 'execute') then
    raise exception 'Client roles must not execute the updated_at trigger function.';
  end if;

  -- Defaults and the updated_at trigger.
  insert into public.video_voices (elevenlabs_voice_id, name, created_at, updated_at)
  values ('pNInz6obpgDQGcFmaJgB', 'Adam', '2020-01-01', '2020-01-01')
  returning id into first_id;
  if not (select active from public.video_voices where id = first_id) then
    raise exception 'A new voice must be active by default.';
  end if;
  update public.video_voices set name = 'Adam posé' where id = first_id;
  if (select updated_at from public.video_voices where id = first_id) <= '2020-01-01' then
    raise exception 'The updated_at trigger must refresh updated_at.';
  end if;

  -- Unique ElevenLabs id.
  begin
    insert into public.video_voices (elevenlabs_voice_id, name) values ('pNInz6obpgDQGcFmaJgB', 'Doublon');
    raise exception 'A duplicate ElevenLabs voice id must be rejected.';
  exception when unique_violation then
    null;
  end;

  -- Id pattern and name length.
  begin
    insert into public.video_voices (elevenlabs_voice_id, name) values ('short', 'Trop court');
    raise exception 'An implausible ElevenLabs voice id must be rejected.';
  exception when check_violation then
    null;
  end;
  begin
    insert into public.video_voices (elevenlabs_voice_id, name) values ('abcdefgh12345678', '');
    raise exception 'An empty name must be rejected.';
  exception when check_violation then
    null;
  end;
  begin
    insert into public.video_voices (elevenlabs_voice_id, name) values ('abcdefgh12345678', repeat('x', 41));
    raise exception 'A name longer than 40 characters must be rejected.';
  exception when check_violation then
    null;
  end;
end;
$$;

rollback;
