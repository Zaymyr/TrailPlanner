revoke all on function public.enforce_race_event_edition_visibility() from public, anon, authenticated;
revoke all on function public.sync_race_event_edition_visibility() from public, anon, authenticated;
revoke all on function public.delete_race_event_edition(uuid) from public, anon, authenticated;

grant execute on function public.delete_race_event_edition(uuid) to service_role;
