-- Run in a migrated disposable database as postgres. Every fixture rolls back.
begin;

do $$
declare
  u uuid := gen_random_uuid(); other_u uuid := gen_random_uuid(); sid uuid := gen_random_uuid();
  p uuid := gen_random_uuid(); second_plan uuid := gen_random_uuid(); third_plan uuid := gen_random_uuid();
  course uuid; edition uuid; v jsonb; changed integer; rejected boolean;
  store text; deleted_plan uuid; intent uuid; transaction_ref text; preserved_key text;
begin
  if not has_function_privilege('authenticated', 'public.runner_plan_is_unlocked(uuid,uuid)', 'EXECUTE') then raise exception 'RLS predicate must be executable by authenticated'; end if;
  if has_function_privilege('authenticated', 'public.runner_user_is_premium(uuid)', 'EXECUTE') then raise exception 'Internal premium helper must not be exposed'; end if;
  if has_table_privilege('authenticated', 'public.runner_plan_unlocks', 'INSERT') then raise exception 'Clients must not write paid unlocks'; end if;
  if has_table_privilege('anon', 'public.runner_billing_events', 'SELECT') then raise exception 'Billing journal must remain private'; end if;

  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values (u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',u||'@test.invalid','x','{}','{}',now(),now());
  insert into public.user_profiles(user_id,full_name,comfortable_flat_pace_min_per_km,water_bag_liters,default_carbs_g_per_hour)
    values (u,'Runner',7.5,1.5,60) on conflict(user_id) do update set full_name='Runner',comfortable_flat_pace_min_per_km=7.5,water_bag_liters=1.5,default_carbs_g_per_hour=60;
  update public.runner_monetization_config set monetization_enabled=true where id;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false,'session_id',sid)::text,true);
  execute 'set local role authenticated';
  insert into public.race_plans(id,user_id,name,planner_values) values (p,u,'free',
    '{"aidStations":[{"name":"Official","distanceKm":10,"waterRefill":true,"supplies":[{"productId":"x","quantity":1}],"pauseMinutes":20}],"segments":{},"sectionSegments":{},"finishPlan":{"pauseMinutes":5},"startSupplies":[]}'::jsonb)
    returning planner_values into v;
  if v ? 'segments' or v ? 'sectionSegments' or v ? 'finishPlan' or v ? 'startSupplies' then raise exception 'Free paid fields persisted'; end if;
  if v->'aidStations'->0->>'name' <> 'Official' or v->'aidStations'->0 ? 'supplies' or v->'aidStations'->0 ? 'pauseMinutes' then raise exception 'Official context or premium station sanitization failed'; end if;
  update public.race_plans set planner_values=planner_values||'{"segments":{"x":[]}}'::jsonb where id=p;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Unpaid update unexpectedly succeeded'; end if;
  if public.runner_plan_is_unlocked(p, other_u) then raise exception 'Cross-owner predicate leaked authorization'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',true,'session_id',sid)::text,true);
  rejected := false;
  begin insert into public.race_plans(user_id,name,planner_values) values(u,'guest','{}'); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Anonymous account inserted plan'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false,'session_id',sid)::text,true);
  insert into public.runner_plan_unlocks(user_id,plan_id,plan_key,provider,provider_transaction_id) values(u,p,'plan:'||p,'admin','test-'||p);
  execute 'set local role authenticated';
  update public.race_plans set planner_values=planner_values||'{"segments":{"x":[]}}'::jsonb where id=p returning planner_values into v;
  get diagnostics changed = row_count;
  if changed <> 1 or not v ? 'segments' then raise exception 'Purchased plan update failed'; end if;
  if (select detailed_access_granted from public.runner_plan_history where plan_id=p) then raise exception 'One-time purchase created permanent historical access'; end if;

  execute 'reset role';
  insert into public.runner_subscription_accounts(user_id,provider,provider_subscription_id,status,current_period_end) values(u,'stripe','test-'||u,'active',now()+interval '1 day');
  execute 'set local role authenticated';
  update public.race_plans set name='prepared during subscription' where id=p;
  if not (select detailed_access_granted from public.runner_plan_history where plan_id=p) then raise exception 'Subscription preparation history missing'; end if;
  execute 'reset role';
  update public.runner_subscription_accounts set status='expired',current_period_end=now()-interval '1 day' where user_id=u;
  update public.runner_plan_unlocks set status='refunded' where user_id=u;
  execute 'set local role authenticated';
  update public.race_plans set name='must stay readonly' where id=p;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Expired plan remained editable'; end if;
  if not (select detailed_access_granted from public.runner_plan_history where plan_id=p) then raise exception 'Expired subscription lost read history'; end if;

  execute 'reset role';
  update auth.users set raw_app_meta_data='{"role":"admin"}'::jsonb where id=u;
  update public.runner_subscription_accounts set status='active',current_period_end=now()+interval '1 day' where user_id=u;
  insert into public.runner_admin_access_modes(session_id,user_id,mode) values(sid,u,'free');
  execute 'set local role authenticated';
  if public.runner_plan_is_unlocked(p,u) then raise exception 'Admin Free failed to override real subscription'; end if;
  execute 'reset role';
  delete from public.runner_admin_access_modes where session_id=sid;
  update public.runner_subscription_accounts set status='expired' where user_id=u;

  select id,edition_id into course,edition from public.races where edition_id is not null limit 1;
  if course is null then raise notice 'Canonical recreation scenario requires one seeded edition-backed course';
  else
    execute 'set local role authenticated';
    insert into public.race_plans(id,user_id,race_id,name,planner_values) values(second_plan,u,course,'course A','{}');
    execute 'reset role';
    insert into public.runner_plan_unlocks(user_id,plan_id,plan_key,provider,provider_transaction_id)
      values(u,second_plan,'race:'||course||':edition:'||edition,'admin','canonical-'||second_plan);
    execute 'set local role authenticated';
    insert into public.race_plans(id,user_id,race_id,name,planner_values) values(third_plan,u,course,'course A recreated','{}');
    if not public.runner_plan_is_unlocked(third_plan,u) then raise exception 'Recreated course lost its canonical unlock'; end if;
  end if;
  execute 'reset role';
  -- A charged purchase must remain fulfillable if the plan was deleted while
  -- the store sheet or Stripe checkout was open. Scope survives in the intent.
  foreach store in array array['stripe','google','apple'] loop
    deleted_plan := gen_random_uuid(); intent := gen_random_uuid(); transaction_ref := 'deleted-plan-' || deleted_plan;
    preserved_key := case when course is null then 'plan:' || deleted_plan else 'race:' || course || ':edition:' || edition end;
    insert into public.race_plans(id,user_id,race_id,name,planner_values) values(deleted_plan,u,course,'delete before payment','{}');
    insert into public.runner_purchase_intents(id,user_id,plan_id,plan_key,provider,product_id,created_at,expires_at)
      values(intent,u,deleted_plan,preserved_key,store,'test-product',now()-interval '1 second',now()+interval '1 day');
    delete from public.race_plans where id=deleted_plan;
    if not public.claim_runner_plan_unlock(u,deleted_plan,store,transaction_ref,'test-product',now(),intent) then raise exception 'Deleted plan payment could not be fulfilled for %',store; end if;
    if not exists(select 1 from public.runner_plan_unlocks where provider=store and provider_transaction_id=transaction_ref and plan_key=preserved_key and plan_id is null) then raise exception 'Durable purchase scope lost after deletion'; end if;
    insert into public.runner_billing_events(provider,provider_event_id,event_type,transaction_id,transaction_status,event_at)
      values(store,'refund-'||transaction_ref,'refund',transaction_ref,'refunded',now()+interval '1 second');
    if not public.revoke_runner_payment_transaction(store,transaction_ref,'refunded') then raise exception 'Refund failed'; end if;
    if public.claim_runner_plan_unlock(u,deleted_plan,store,transaction_ref,'test-product',now(),intent) then raise exception 'Refund replay reactivated purchase'; end if;
    insert into public.runner_billing_events(provider,provider_event_id,event_type,transaction_id,transaction_status,event_at)
      values(store,'reverse-'||transaction_ref,'reversal',transaction_ref,'active',now()+interval '2 seconds');
    if not public.restore_runner_payment_transaction(store,transaction_ref) or not public.restore_runner_payment_transaction(store,transaction_ref) then raise exception 'Reversal retries are not idempotent'; end if;
    if not public.revoke_runner_payment_transaction(store,transaction_ref,'refunded') then raise exception 'Stale refund should be acknowledged'; end if;
    if not exists(select 1 from public.runner_plan_unlocks where provider=store and provider_transaction_id=transaction_ref and status='active') then raise exception 'Stale refund overrode newer reversal'; end if;
  end loop;
end;
$$;
rollback;
