-- Run in a migrated disposable database as postgres. Every fixture rolls back.
begin;

do $$
declare
  first_user uuid := gen_random_uuid();
  second_user uuid := gen_random_uuid();
  first_intent uuid := gen_random_uuid();
  second_intent uuid := gen_random_uuid();
  purchase_time timestamptz := now();
  duplicate_rejected boolean := false;
  subscription_count bigint;
  unlock_count bigint;
begin
  if has_table_privilege('authenticated', 'public.runner_support_purchases', 'SELECT')
     or has_table_privilege('authenticated', 'public.runner_support_purchase_intents', 'INSERT')
     or has_table_privilege('anon', 'public.runner_support_events', 'SELECT') then
    raise exception 'Support billing tables must remain service-only';
  end if;
  if has_function_privilege('authenticated', 'public.claim_runner_support_purchase(uuid,text,text,text,timestamptz,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.record_runner_support_event(uuid,text,text,text,text,timestamptz,timestamptz,text)', 'EXECUTE') then
    raise exception 'Support billing RPCs must remain service-only';
  end if;

  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (first_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', first_user || '@test.invalid', 'x', '{}', '{}', now(), now()),
    (second_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', second_user || '@test.invalid', 'x', '{}', '{}', now(), now());

  select count(*) into subscription_count from public.subscriptions;
  select count(*) into unlock_count from public.runner_plan_unlocks;

  insert into public.runner_support_purchase_intents(id, user_id, provider, product_id, expires_at)
  values(first_intent, first_user, 'apple', 'runner_app_support', purchase_time + interval '1 day');

  begin
    insert into public.runner_support_purchase_intents(id, user_id, provider, product_id, expires_at)
    values(second_intent, first_user, 'google', 'runner_app_support', purchase_time + interval '1 day');
  exception when unique_violation then
    duplicate_rejected := true;
  end;
  if not duplicate_rejected then raise exception 'Cross-provider pending intent was accepted'; end if;

  if not public.claim_runner_support_purchase(first_user, 'apple', 'runner_app_support', 'support-transaction', purchase_time, first_intent) then
    raise exception 'Verified support purchase was not claimed';
  end if;
  if public.claim_runner_support_purchase(first_user, 'apple', 'runner_app_support', 'second-support-transaction', purchase_time, null) then
    raise exception 'One account accepted a second support transaction';
  end if;
  if public.claim_runner_support_purchase(second_user, 'apple', 'runner_app_support', 'support-transaction', purchase_time, null) then
    raise exception 'A transaction was reused by another account';
  end if;
  if exists(select 1 from public.runner_support_purchases where user_id = second_user) then
    raise exception 'Duplicate transaction granted support to another account';
  end if;

  if not public.record_runner_support_event(
    first_user, 'apple', 'runner_app_support', 'support-transaction', 'refunded', purchase_time,
    purchase_time + interval '2 minutes', 'support-refund'
  ) then raise exception 'Support refund was not recorded'; end if;
  if public.claim_runner_support_purchase(first_user, 'apple', 'runner_app_support', 'support-transaction', purchase_time, first_intent) then
    raise exception 'Receipt reconciliation overrode a newer refund';
  end if;
  if not public.record_runner_support_event(
    first_user, 'apple', 'runner_app_support', 'support-transaction', 'active', purchase_time,
    purchase_time + interval '3 minutes', 'support-refund-reversed'
  ) then raise exception 'Support refund reversal was not recorded'; end if;
  if not exists(select 1 from public.runner_support_purchases where user_id = first_user and status = 'active') then
    raise exception 'Support refund reversal did not restore the marker';
  end if;

  if (select count(*) from public.subscriptions) <> subscription_count
     or (select count(*) from public.runner_plan_unlocks) <> unlock_count then
    raise exception 'Support purchase changed subscription or plan rights';
  end if;
end;
$$;

rollback;
