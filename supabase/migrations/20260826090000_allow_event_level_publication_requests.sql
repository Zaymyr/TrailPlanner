-- Organizers request publication once for the whole event/current edition again;
-- admin approval (review_race_event_publication_request) already publishes every
-- complete format of the current edition at once when race_id is null.
drop policy if exists "Users can create own race event publication requests"
  on public.race_event_publication_requests;

create policy "Users can create own race event publication requests"
on public.race_event_publication_requests
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and exists (
    select 1
    from public.race_event_organizers organizer_row
    where organizer_row.event_id = race_event_publication_requests.event_id
      and organizer_row.user_id = (select auth.uid())
      and organizer_row.revoked_at is null
  )
  and (
    race_id is null
    or exists (
      select 1
      from public.races race_row
      where race_row.id = race_event_publication_requests.race_id
        and race_row.event_id = race_event_publication_requests.event_id
    )
  )
);
