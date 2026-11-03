-- Match the composite current-publication foreign key with a covering index.

drop index if exists public.racebook_publication_states_current_publication_idx;

create index if not exists racebook_publication_states_current_publication_parent_idx
  on public.racebook_publication_states (current_publication_id, race_id, event_id, edition_id)
  where current_publication_id is not null;
