-- Cover publication foreign keys used by retention, user deletion, and event cleanup.

create index if not exists racebook_publication_states_current_publication_idx
  on public.racebook_publication_states (current_publication_id)
  where current_publication_id is not null;

create index if not exists racebook_publication_states_last_published_by_idx
  on public.racebook_publication_states (last_published_by)
  where last_published_by is not null;

create index if not exists racebook_publications_event_idx
  on public.racebook_publications (event_id);

create index if not exists racebook_publications_published_by_idx
  on public.racebook_publications (published_by)
  where published_by is not null;
