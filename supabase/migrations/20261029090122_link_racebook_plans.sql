-- One durable plan per runner and catalog format. Preserve every historical
-- plan by detaching older duplicates before the partial unique index is added.
with ranked_plans as (
  select
    id,
    row_number() over (
      partition by user_id, race_id
      order by updated_at desc nulls last, created_at desc, id desc
    ) as duplicate_rank
  from public.race_plans
  where race_id is not null
)
update public.race_plans as plan_row
set race_id = null
from ranked_plans
where ranked_plans.id = plan_row.id
  and ranked_plans.duplicate_rank > 1;

create unique index if not exists race_plans_user_race_unique_idx
  on public.race_plans (user_id, race_id)
  where race_id is not null;

comment on index public.race_plans_user_race_unique_idx is
  'Allows at most one catalog-format plan per Supabase user while preserving unlinked personal plans.';

