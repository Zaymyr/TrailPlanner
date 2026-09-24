--
-- PostgreSQL database dump
--

\restrict oLMiu8EU402qgYpbz1ujDKP8LqRs9MEMrXTGYKwbYyW7cwUdYIuPgzPySyFN2ru

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION pg_cron; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_net; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_net IS 'Async HTTP';


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: pgmq; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgmq;


--
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA private;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: pgmq; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgmq WITH SCHEMA pgmq;


--
-- Name: EXTENSION pgmq; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgmq IS 'A lightweight message queue. Like AWS SQS and RSMQ but on Postgres.';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: wrappers; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS wrappers WITH SCHEMA extensions;


--
-- Name: EXTENSION wrappers; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION wrappers IS 'Foreign data wrappers developed by Supabase';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone',
    'recovery_code'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: fuel_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fuel_type AS ENUM (
    'gel',
    'drink_mix',
    'electrolyte',
    'capsule',
    'bar',
    'real_food',
    'other'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in',
    'like',
    'ilike',
    'is',
    'match',
    'imatch',
    'isdistinct'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text,
	negate boolean
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
    revoke trigger on cron.job_run_details from postgres;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
begin
    if not exists (
        select 1
        from pg_catalog.pg_event_trigger_ddl_commands() ev
        join pg_catalog.pg_extension e on ev.objid = e.oid
        where e.extname = 'pg_graphql'
    ) then
        return;
    end if;

    drop function if exists graphql_public.graphql;
    create or replace function graphql_public.graphql(
        "operationName" text default null,
        query text default null,
        variables jsonb default null,
        extensions jsonb default null
    )
        returns jsonb
        language sql
    as $$
        select graphql.resolve(
            query := query,
            variables := coalesce(variables, '{}'),
            "operationName" := "operationName",
            extensions := extensions
        );
    $$;

    -- Attach the wrapper to the extension so DROP EXTENSION cascades to it,
    -- which in turn triggers set_graphql_placeholder to reinstall the "not enabled" stub.
    alter extension pg_graphql add function graphql_public.graphql(text, text, jsonb, jsonb);

    grant usage on schema graphql to postgres, anon, authenticated, service_role;
    grant execute on function graphql.resolve to postgres, anon, authenticated, service_role;
    grant usage on schema graphql to postgres with grant option;
    grant usage on schema graphql_public to postgres with grant option;
end;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8.0', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
            set search_path to ''
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: graphql(text, text, jsonb, jsonb); Type: FUNCTION; Schema: graphql_public; Owner: -
--

CREATE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


--
-- Name: organizer_edition_is_pro(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.organizer_edition_is_pro(p_edition_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1 from public.organizer_edition_entitlements entitlement_row
    where entitlement_row.edition_id = p_edition_id
      and entitlement_row.status = 'active'
      and entitlement_row.tier = 'signature'
  );
$$;


--
-- Name: FUNCTION organizer_edition_is_pro(p_edition_id uuid); Type: COMMENT; Schema: private; Owner: -
--

COMMENT ON FUNCTION private.organizer_edition_is_pro(p_edition_id uuid) IS 'Returns only the non-sensitive Pro capability state used by public mobile RLS policies.';


--
-- Name: organizer_tier_rank(text); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.organizer_tier_rank(p_tier text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case p_tier
    when 'signature' then 3
    when 'complete' then 2
    when 'essential' then 1
    else 0
  end;
$$;


--
-- Name: protect_issued_organizer_invoice(); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.protect_issued_organizer_invoice() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if tg_op = 'DELETE' and old.invoice_number is not null then
    raise exception 'An issued organizer invoice cannot be deleted.';
  end if;
  if tg_op = 'UPDATE' and old.invoice_number is not null and (
    new.invoice_number is distinct from old.invoice_number
    or new.invoice_sequence is distinct from old.invoice_sequence
    or new.invoice_issued_at is distinct from old.invoice_issued_at
    or new.invoice_source is distinct from old.invoice_source
    or new.invoice_legal_snapshot is distinct from old.invoice_legal_snapshot
    or new.edition_id is distinct from old.edition_id
    or new.amount_subtotal is distinct from old.amount_subtotal
    or new.amount_tax is distinct from old.amount_tax
    or new.amount_total is distinct from old.amount_total
    or new.currency is distinct from old.currency
    or new.paid_at is distinct from old.paid_at
  ) then
    raise exception 'Issued organizer invoice facts are immutable.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


--
-- Name: FUNCTION protect_issued_organizer_invoice(); Type: COMMENT; Schema: private; Owner: -
--

COMMENT ON FUNCTION private.protect_issued_organizer_invoice() IS 'Prevents deletion or mutation of the legal facts of an issued organizer invoice while allowing its private PDF attachment metadata to be repaired.';


--
-- Name: race_is_in_visible_catalog(uuid, uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.race_is_in_visible_catalog(p_event_id uuid, p_edition_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.race_events event_row
    where event_row.id = p_event_id
      and event_row.is_live = true
      and (
        p_edition_id is null
        or exists (
          select 1
          from public.race_event_editions edition_row
          where edition_row.id = p_edition_id
            and edition_row.event_id = p_event_id
            and edition_row.is_visible = true
        )
      )
  );
$$;


--
-- Name: FUNCTION race_is_in_visible_catalog(p_event_id uuid, p_edition_id uuid); Type: COMMENT; Schema: private; Owner: -
--

COMMENT ON FUNCTION private.race_is_in_visible_catalog(p_event_id uuid, p_edition_id uuid) IS 'Returns whether a race parent event and optional edition are runner-catalog visible without exposing edition rows.';


--
-- Name: racebook_module_is_enabled(uuid, text); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.racebook_module_is_enabled(p_race_id uuid, p_module_key text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'private', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.races race_row
    join public.organizer_edition_entitlements entitlement_row on entitlement_row.edition_id = race_row.edition_id
    join public.organizer_racebook_module_settings setting_row
      on setting_row.edition_id = race_row.edition_id
      and setting_row.module_key = p_module_key
      and (setting_row.race_id = race_row.id or setting_row.race_id is null)
    where race_row.id = p_race_id
      and setting_row.is_enabled
      and entitlement_row.status = 'active'
      and private.organizer_tier_rank(entitlement_row.tier) >= case p_module_key
        when 'start_waves' then 2
        when 'awards' then 2
        when 'services' then 2
        when 'relay' then 3
        when 'official_products' then 3
        when 'sponsors' then 3
        when 'branding' then 3
        else 1
      end
  );
$$;


--
-- Name: user_has_trusted_admin_role(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.user_has_trusted_admin_role(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from auth.users user_row
    where user_row.id = p_user_id
      and (
        coalesce(user_row.raw_app_meta_data ->> 'role', '') = 'admin'
        or coalesce(user_row.raw_app_meta_data -> 'roles', '[]'::jsonb) ? 'admin'
      )
  );
$$;


--
-- Name: FUNCTION user_has_trusted_admin_role(p_user_id uuid); Type: COMMENT; Schema: private; Owner: -
--

COMMENT ON FUNCTION private.user_has_trusted_admin_role(p_user_id uuid) IS 'Returns whether one server-authorized actor has a trusted Auth app-metadata admin role.';


--
-- Name: apply_organizer_import_field_patches(uuid, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_organizer_import_field_patches(p_session_id uuid, p_event_patch jsonb DEFAULT '{}'::jsonb, p_race_patches jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
declare
  import_session public.organizer_import_sessions;
  race_patch jsonb;
  patch_fields jsonb;
  station_item jsonb;
  station_position bigint;
  target_race_id uuid;
  next_missing_fields text[];
  next_data_status text;
  updated_race public.races;
  updated_count integer := 0;
  drafts_remaining integer := 0;
  formats_completed integer := 0;
begin
  if jsonb_typeof(p_event_patch) is distinct from 'object' then
    raise exception 'p_event_patch must be a JSON object.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_race_patches) is distinct from 'array' or jsonb_array_length(p_race_patches) > 100 then
    raise exception 'p_race_patches must be an array containing at most 100 patches.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_event_patch) as supplied(key)
    where supplied.key not in ('name', 'location', 'thumbnailUrl', 'organizerDetails')
  ) then
    raise exception 'The event patch contains an unsupported key.' using errcode = '22023';
  end if;

  if (p_event_patch ? 'name') and (
    jsonb_typeof(p_event_patch -> 'name') is distinct from 'string'
    or nullif(btrim(p_event_patch ->> 'name'), '') is null
    or char_length(btrim(p_event_patch ->> 'name')) > 300
  ) then
    raise exception 'Event name must be a non-empty string of at most 300 characters.'
      using errcode = '22023';
  end if;
  if (p_event_patch ? 'location')
    and jsonb_typeof(p_event_patch -> 'location') not in ('string', 'null') then
    raise exception 'Event location must be a string or null.' using errcode = '22023';
  end if;
  if (p_event_patch ? 'thumbnailUrl')
    and jsonb_typeof(p_event_patch -> 'thumbnailUrl') not in ('string', 'null') then
    raise exception 'Event thumbnailUrl must be a string or null.' using errcode = '22023';
  end if;
  if (p_event_patch ? 'organizerDetails')
    and jsonb_typeof(p_event_patch -> 'organizerDetails') not in ('object', 'null') then
    raise exception 'Event organizerDetails must be an object or null.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_race_patches) as item(value)
    where jsonb_typeof(item.value) is distinct from 'object'
  ) then
    raise exception 'Every race patch must be a JSON object.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_race_patches) as item(value),
         lateral jsonb_object_keys(item.value) as supplied(key)
    where supplied.key not in ('raceId', 'fields', 'missingRequiredFields')
  ) then
    raise exception 'A race patch contains an unsupported key.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_race_patches) as item(value)
    where jsonb_typeof(item.value -> 'raceId') is distinct from 'string'
      or coalesce(item.value ->> 'raceId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or jsonb_typeof(item.value -> 'fields') is distinct from 'object'
      or jsonb_typeof(item.value -> 'missingRequiredFields') is distinct from 'array'
      or exists (
        select 1
        from jsonb_array_elements(item.value -> 'missingRequiredFields') as missing(value)
        where jsonb_typeof(missing.value) <> 'string'
          or missing.value #>> '{}' not in ('race_date', 'distance_km', 'elevation_gain_m')
      )
  ) then
    raise exception 'A race patch has an invalid shape.' using errcode = '22023';
  end if;

  if (
    select count(*) from jsonb_array_elements(p_race_patches)
  ) <> (
    select count(distinct item.value ->> 'raceId')
    from jsonb_array_elements(p_race_patches) as item(value)
  ) then
    raise exception 'Each race can be patched only once.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_race_patches) as item(value),
         lateral jsonb_object_keys(item.value -> 'fields') as supplied(key)
    where supplied.key not in (
      'name', 'seriesName', 'raceDate', 'distanceKm', 'elevationGainM', 'elevationLossM',
      'externalSiteUrl', 'locationText', 'thumbnailUrl', 'gpxPath', 'gpxHash',
      'gpxStoragePath', 'gpxSha256', 'minAltM', 'maxAltM', 'startLat', 'startLng',
      'boundsMinLat', 'boundsMinLng', 'boundsMaxLat', 'boundsMaxLng', 'organizerDetails',
      'aidStations'
    )
  ) then
    raise exception 'Race fields contain an unsupported key.' using errcode = '22023';
  end if;

  select session_row.*
  into import_session
  from public.organizer_import_sessions as session_row
  where session_row.id = p_session_id
  for update;

  if import_session.id is null then
    raise exception 'Organizer import session not found.' using errcode = 'P0002';
  end if;
  if import_session.expires_at <= timezone('utc', now()) then
    raise exception 'Organizer import session has expired.' using errcode = '22023';
  end if;
  if import_session.status not in ('formats_confirmed', 'fields_analyzed') then
    raise exception 'Organizer import fields cannot be applied in the current session state.'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.race_event_editions as edition_row
    where edition_row.id = import_session.edition_id
      and edition_row.event_id = import_session.event_id
  ) then
    raise exception 'Organizer import edition does not belong to the event.' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.race_events as event_row
    where event_row.id = import_session.event_id
  ) then
    raise exception 'Organizer import event not found.' using errcode = 'P0002';
  end if;

  if p_event_patch <> '{}'::jsonb then
    update public.race_events as event_row
    set name = case
          when p_event_patch ? 'name' then btrim(p_event_patch ->> 'name')
          else event_row.name
        end,
        location = case
          when p_event_patch ? 'location' then nullif(btrim(p_event_patch ->> 'location'), '')
          else event_row.location
        end,
        thumbnail_url = case
          when p_event_patch ? 'thumbnailUrl' then nullif(btrim(p_event_patch ->> 'thumbnailUrl'), '')
          else event_row.thumbnail_url
        end,
        organizer_details = case
          when p_event_patch ? 'organizerDetails' then nullif(p_event_patch -> 'organizerDetails', 'null'::jsonb)
          else event_row.organizer_details
        end
    where event_row.id = import_session.event_id;
  end if;

  for race_patch in
    select item.value
    from jsonb_array_elements(p_race_patches) with ordinality as item(value, position)
    order by item.position
  loop
    target_race_id := (race_patch ->> 'raceId')::uuid;
    patch_fields := race_patch -> 'fields';

    if not exists (
      select 1
      from jsonb_array_elements(import_session.confirmed_formats) as confirmed(value)
      where confirmed.value ->> 'raceId' = target_race_id::text
    ) then
      raise exception 'Race patch target was not confirmed in this import session.'
        using errcode = '23514';
    end if;

    if (patch_fields ? 'name') and (
      jsonb_typeof(patch_fields -> 'name') is distinct from 'string'
      or nullif(btrim(patch_fields ->> 'name'), '') is null
      or char_length(btrim(patch_fields ->> 'name')) > 300
    ) then
      raise exception 'Race name must be a non-empty string of at most 300 characters.'
        using errcode = '22023';
    end if;
    if (patch_fields ? 'seriesName') and (
      jsonb_typeof(patch_fields -> 'seriesName') is distinct from 'string'
      or nullif(btrim(patch_fields ->> 'seriesName'), '') is null
      or char_length(btrim(patch_fields ->> 'seriesName')) > 300
    ) then
      raise exception 'Race seriesName must be a non-empty string of at most 300 characters.'
        using errcode = '22023';
    end if;
    if (patch_fields ? 'raceDate') and (
      jsonb_typeof(patch_fields -> 'raceDate') not in ('string', 'null')
      or (
        jsonb_typeof(patch_fields -> 'raceDate') = 'string'
        and (patch_fields ->> 'raceDate') !~ '^\d{4}-\d{2}-\d{2}$'
      )
    ) then
      raise exception 'Race raceDate must be an ISO date string or null.' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_object_keys(patch_fields) as supplied(key)
      where supplied.key in (
        'minAltM', 'maxAltM', 'startLat', 'startLng',
        'boundsMinLat', 'boundsMinLng', 'boundsMaxLat', 'boundsMaxLng'
      )
        and jsonb_typeof(patch_fields -> supplied.key) not in ('number', 'null')
    ) then
      raise exception 'Race numeric fields must contain numbers or null.' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_object_keys(patch_fields) as supplied(key)
      where supplied.key in ('distanceKm', 'elevationGainM', 'elevationLossM')
        and jsonb_typeof(patch_fields -> supplied.key) is distinct from 'number'
    ) then
      raise exception 'Race distance and elevation fields must contain numbers.' using errcode = '22023';
    end if;
    if (patch_fields ? 'distanceKm')
      and jsonb_typeof(patch_fields -> 'distanceKm') = 'number'
      and (patch_fields ->> 'distanceKm')::numeric <= 0 then
      raise exception 'Race distanceKm must be greater than zero when known.' using errcode = '22023';
    end if;
    if (patch_fields ? 'elevationGainM')
      and jsonb_typeof(patch_fields -> 'elevationGainM') = 'number'
      and (patch_fields ->> 'elevationGainM')::numeric < 0 then
      raise exception 'Race elevationGainM cannot be negative.' using errcode = '22023';
    end if;
    if (patch_fields ? 'elevationLossM')
      and jsonb_typeof(patch_fields -> 'elevationLossM') = 'number'
      and (patch_fields ->> 'elevationLossM')::numeric < 0 then
      raise exception 'Race elevationLossM cannot be negative.' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_object_keys(patch_fields) as supplied(key)
      where supplied.key in (
        'externalSiteUrl', 'locationText', 'thumbnailUrl', 'gpxStoragePath', 'gpxSha256'
      )
        and jsonb_typeof(patch_fields -> supplied.key) not in ('string', 'null')
    ) then
      raise exception 'Optional race text fields must contain strings or null.' using errcode = '22023';
    end if;
    if (patch_fields ? 'gpxPath') and (
      jsonb_typeof(patch_fields -> 'gpxPath') is distinct from 'string'
      or nullif(btrim(patch_fields ->> 'gpxPath'), '') is null
    ) then
      raise exception 'Race gpxPath must be a non-empty string.' using errcode = '22023';
    end if;
    if (patch_fields ? 'gpxHash') and (
      jsonb_typeof(patch_fields -> 'gpxHash') is distinct from 'string'
      or nullif(btrim(patch_fields ->> 'gpxHash'), '') is null
    ) then
      raise exception 'Race gpxHash must be a non-empty string.' using errcode = '22023';
    end if;
    if (patch_fields ? 'organizerDetails')
      and jsonb_typeof(patch_fields -> 'organizerDetails') not in ('object', 'null') then
      raise exception 'Race organizerDetails must be an object or null.' using errcode = '22023';
    end if;
    if (patch_fields ? 'aidStations') and (
      jsonb_typeof(patch_fields -> 'aidStations') is distinct from 'array'
      or jsonb_array_length(patch_fields -> 'aidStations') > 200
    ) then
      raise exception 'Race aidStations must be an array containing at most 200 stations.'
        using errcode = '22023';
    end if;
    if (patch_fields ? 'aidStations') and exists (
      select 1
      from jsonb_array_elements(patch_fields -> 'aidStations') as station(value)
      where jsonb_typeof(station.value) is distinct from 'object'
        or exists (
          select 1
          from jsonb_object_keys(station.value) as supplied(key)
          where supplied.key not in (
            'name', 'distanceKm', 'waterRefill', 'solidRefill', 'assistanceAllowed',
            'notes', 'orderIndex', 'organizerDetails'
          )
        )
        or jsonb_typeof(station.value -> 'name') is distinct from 'string'
        or nullif(btrim(station.value ->> 'name'), '') is null
        or char_length(btrim(station.value ->> 'name')) > 200
        or jsonb_typeof(station.value -> 'distanceKm') is distinct from 'number'
        or (station.value ->> 'distanceKm')::numeric < 0
        or (
          station.value ? 'waterRefill'
          and jsonb_typeof(station.value -> 'waterRefill') is distinct from 'boolean'
        )
        or (
          station.value ? 'solidRefill'
          and jsonb_typeof(station.value -> 'solidRefill') is distinct from 'boolean'
        )
        or (
          station.value ? 'assistanceAllowed'
          and jsonb_typeof(station.value -> 'assistanceAllowed') is distinct from 'boolean'
        )
        or (
          station.value ? 'notes'
          and jsonb_typeof(station.value -> 'notes') not in ('string', 'null')
        )
        or (
          station.value ? 'orderIndex'
          and (
            jsonb_typeof(station.value -> 'orderIndex') is distinct from 'number'
            or coalesce(station.value ->> 'orderIndex', '') !~ '^\d+$'
            or (station.value ->> 'orderIndex')::numeric > 2147483647
          )
        )
        or (
          station.value ? 'organizerDetails'
          and jsonb_typeof(station.value -> 'organizerDetails') not in ('object', 'null')
        )
    ) then
      raise exception 'A race aid station has an invalid shape.' using errcode = '22023';
    end if;

    select coalesce(array_agg(distinct missing.value #>> '{}' order by missing.value #>> '{}'), array[]::text[])
    into next_missing_fields
    from jsonb_array_elements(race_patch -> 'missingRequiredFields') as missing(value);

    next_data_status := case when cardinality(next_missing_fields) = 0 then 'complete' else 'draft' end;

    update public.races as race_row
    set name = case when patch_fields ? 'name' then btrim(patch_fields ->> 'name') else race_row.name end,
        series_name = case
          when patch_fields ? 'seriesName' then btrim(patch_fields ->> 'seriesName')
          when patch_fields ? 'name' then btrim(patch_fields ->> 'name')
          else race_row.series_name
        end,
        race_date = case
          when 'race_date' = any(next_missing_fields) then null
          when patch_fields ? 'raceDate' then (patch_fields ->> 'raceDate')::date
          else race_row.race_date
        end,
        distance_km = case
          when 'distance_km' = any(next_missing_fields) then 0
          when patch_fields ? 'distanceKm' then (patch_fields ->> 'distanceKm')::numeric
          else race_row.distance_km
        end,
        elevation_gain_m = case
          when 'elevation_gain_m' = any(next_missing_fields) then 0
          when patch_fields ? 'elevationGainM' then (patch_fields ->> 'elevationGainM')::numeric
          else race_row.elevation_gain_m
        end,
        elevation_loss_m = case when patch_fields ? 'elevationLossM' then (patch_fields ->> 'elevationLossM')::numeric else race_row.elevation_loss_m end,
        external_site_url = case when patch_fields ? 'externalSiteUrl' then nullif(btrim(patch_fields ->> 'externalSiteUrl'), '') else race_row.external_site_url end,
        location_text = case when patch_fields ? 'locationText' then nullif(btrim(patch_fields ->> 'locationText'), '') else race_row.location_text end,
        thumbnail_url = case when patch_fields ? 'thumbnailUrl' then nullif(btrim(patch_fields ->> 'thumbnailUrl'), '') else race_row.thumbnail_url end,
        gpx_path = case when patch_fields ? 'gpxPath' then btrim(patch_fields ->> 'gpxPath') else race_row.gpx_path end,
        gpx_hash = case when patch_fields ? 'gpxHash' then btrim(patch_fields ->> 'gpxHash') else race_row.gpx_hash end,
        gpx_storage_path = case when patch_fields ? 'gpxStoragePath' then nullif(btrim(patch_fields ->> 'gpxStoragePath'), '') else race_row.gpx_storage_path end,
        gpx_sha256 = case when patch_fields ? 'gpxSha256' then nullif(btrim(patch_fields ->> 'gpxSha256'), '') else race_row.gpx_sha256 end,
        min_alt_m = case when patch_fields ? 'minAltM' then (patch_fields ->> 'minAltM')::numeric else race_row.min_alt_m end,
        max_alt_m = case when patch_fields ? 'maxAltM' then (patch_fields ->> 'maxAltM')::numeric else race_row.max_alt_m end,
        start_lat = case when patch_fields ? 'startLat' then (patch_fields ->> 'startLat')::numeric else race_row.start_lat end,
        start_lng = case when patch_fields ? 'startLng' then (patch_fields ->> 'startLng')::numeric else race_row.start_lng end,
        bounds_min_lat = case when patch_fields ? 'boundsMinLat' then (patch_fields ->> 'boundsMinLat')::numeric else race_row.bounds_min_lat end,
        bounds_min_lng = case when patch_fields ? 'boundsMinLng' then (patch_fields ->> 'boundsMinLng')::numeric else race_row.bounds_min_lng end,
        bounds_max_lat = case when patch_fields ? 'boundsMaxLat' then (patch_fields ->> 'boundsMaxLat')::numeric else race_row.bounds_max_lat end,
        bounds_max_lng = case when patch_fields ? 'boundsMaxLng' then (patch_fields ->> 'boundsMaxLng')::numeric else race_row.bounds_max_lng end,
        organizer_details = case when patch_fields ? 'organizerDetails' then nullif(patch_fields -> 'organizerDetails', 'null'::jsonb) else race_row.organizer_details end,
        missing_required_fields = next_missing_fields,
        data_status = next_data_status,
        is_live = case
          when next_data_status = 'draft' then false
          when race_row.data_status = 'draft' then true
          else race_row.is_live
        end,
        racebook_is_live = case
          when next_data_status = 'draft' or race_row.data_status = 'draft' then false
          else race_row.racebook_is_live
        end
    where race_row.id = target_race_id
      and race_row.event_id = import_session.event_id
      and race_row.edition_id = import_session.edition_id
    returning race_row.* into updated_race;

    if not found then
      raise exception 'Race patch target does not belong to the import event and edition.'
        using errcode = '23514';
    end if;

    if next_data_status = 'complete' and (
      updated_race.race_date is null
      or updated_race.distance_km <= 0
      or updated_race.elevation_gain_m < 0
      or nullif(btrim(updated_race.name), '') is null
    ) then
      raise exception 'A complete race must have name, date, positive distance, and known elevation gain.'
        using errcode = '23514';
    end if;

    if patch_fields ? 'aidStations' then
      delete from public.race_aid_stations as station_row
      where station_row.race_id = target_race_id;

      for station_item, station_position in
        select station.value, station.position
        from jsonb_array_elements(patch_fields -> 'aidStations')
          with ordinality as station(value, position)
        order by station.position
      loop
        insert into public.race_aid_stations (
          race_id,
          name,
          km,
          water_available,
          solid_available,
          assistance_allowed,
          notes,
          order_index,
          organizer_details
        )
        values (
          target_race_id,
          btrim(station_item ->> 'name'),
          (station_item ->> 'distanceKm')::numeric,
          coalesce((station_item ->> 'waterRefill')::boolean, true),
          coalesce((station_item ->> 'solidRefill')::boolean, true),
          coalesce((station_item ->> 'assistanceAllowed')::boolean, true),
          nullif(btrim(station_item ->> 'notes'), ''),
          coalesce((station_item ->> 'orderIndex')::integer, (station_position - 1)::integer),
          nullif(station_item -> 'organizerDetails', 'null'::jsonb)
        );
      end loop;
    end if;

    updated_count := updated_count + 1;
  end loop;

  select
    count(*) filter (where race_row.data_status = 'draft'),
    count(*) filter (where race_row.data_status = 'complete')
  into drafts_remaining, formats_completed
  from public.races as race_row
  where race_row.id in (
    select (confirmed.value ->> 'raceId')::uuid
    from jsonb_array_elements(import_session.confirmed_formats) as confirmed(value)
  );

  if drafts_remaining + formats_completed <> jsonb_array_length(import_session.confirmed_formats) then
    raise exception 'One or more confirmed import formats no longer exist in the session scope.'
      using errcode = '23514';
  end if;

  update public.organizer_import_sessions
  set status = 'applied'
  where id = p_session_id;

  return jsonb_build_object(
    'sessionId', p_session_id,
    'formatsUpdated', updated_count,
    'draftsRemaining', drafts_remaining,
    'formatsCompleted', formats_completed
  );
end;
$_$;


--
-- Name: assign_race_event_edition(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_race_event_edition() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  target_edition_id uuid;
  target_year smallint;
begin
  if new.edition_id is not null or new.event_id is null or new.race_date is null then
    return new;
  end if;

  target_year := extract(year from new.race_date)::smallint;

  -- Serialize edition creation per event so concurrent imports cannot both
  -- attempt to create the first current edition.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.event_id::text, 0)
  );

  insert into public.race_event_editions (
    event_id,
    edition_year,
    start_date,
    end_date,
    is_current
  ) values (
    new.event_id,
    target_year,
    new.race_date::date,
    new.race_date::date,
    false
  )
  on conflict (event_id, edition_year) do update
  set start_date = least(public.race_event_editions.start_date, excluded.start_date),
      end_date = greatest(public.race_event_editions.end_date, excluded.end_date)
  returning id into target_edition_id;

  if not exists (
    select 1
    from public.race_event_editions edition_row
    where edition_row.event_id = new.event_id
      and edition_row.is_current = true
  ) then
    update public.race_event_editions
    set is_current = true
    where id = target_edition_id;
  end if;

  new.edition_id := target_edition_id;
  return new;
end;
$$;


--
-- Name: FUNCTION assign_race_event_edition(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_race_event_edition() IS 'Assigns a dated event format to its canonical yearly edition, creating that edition atomically when missing.';


--
-- Name: check_and_increment_rate_limit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_and_increment_rate_limit(p_key text, p_limit integer, p_window_ms integer) RETURNS TABLE(allowed boolean, remaining integer, retry_after_ms bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_now         timestamptz := now();
  v_reset_at    timestamptz := v_now + (p_window_ms * '1 millisecond'::interval);
  v_count       integer;
  v_entry_reset timestamptz;
BEGIN
  INSERT INTO public.rate_limit_entries(key, count, reset_at)
    VALUES (p_key, 1, v_reset_at)
  ON CONFLICT (key) DO UPDATE
    SET count    = CASE
                     WHEN rate_limit_entries.reset_at <= v_now THEN 1
                     ELSE rate_limit_entries.count + 1
                   END,
        reset_at = CASE
                     WHEN rate_limit_entries.reset_at <= v_now THEN v_reset_at
                     ELSE rate_limit_entries.reset_at
                   END
  RETURNING rate_limit_entries.count, rate_limit_entries.reset_at
  INTO v_count, v_entry_reset;

  RETURN QUERY SELECT
    (v_count <= p_limit),
    greatest(0, p_limit - v_count),
    CASE
      WHEN v_count > p_limit
        THEN (extract(epoch FROM (v_entry_reset - v_now)) * 1000)::bigint
      ELSE 0::bigint
    END;
END;
$$;


--
-- Name: clear_stale_race_event_geography(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clear_stale_race_event_geography() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.location is distinct from old.location
    and row(
      new.location_city,
      new.location_city_code,
      new.location_department,
      new.location_department_code,
      new.location_region,
      new.location_region_code,
      new.location_country,
      new.location_country_code,
      new.location_latitude,
      new.location_longitude
    ) is not distinct from row(
      old.location_city,
      old.location_city_code,
      old.location_department,
      old.location_department_code,
      old.location_region,
      old.location_region_code,
      old.location_country,
      old.location_country_code,
      old.location_latitude,
      old.location_longitude
    )
  then
    new.location_city := null;
    new.location_city_code := null;
    new.location_department := null;
    new.location_department_code := null;
    new.location_region := null;
    new.location_region_code := null;
    new.location_country := null;
    new.location_country_code := null;
    new.location_latitude := null;
    new.location_longitude := null;
  end if;

  return new;
end;
$$;


--
-- Name: FUNCTION clear_stale_race_event_geography(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.clear_stale_race_event_geography() IS 'Clears curated geography when a location label changes without a matching normalized update.';


--
-- Name: configure_organizer_import_cleanup_cron(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.configure_organizer_import_cleanup_cron() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  job_name constant text := 'organizer-import-cleanup-hourly';
  job_schedule constant text := '17 * * * *';
  web_app_url text;
  cron_secret text;
  existing_job_id bigint;
begin
  select secret.decrypted_secret
  into web_app_url
  from vault.decrypted_secrets as secret
  where secret.name = 'web_app_url'
  order by secret.created_at desc
  limit 1;

  select secret.decrypted_secret
  into cron_secret
  from vault.decrypted_secrets as secret
  where secret.name = 'cron_secret'
  order by secret.created_at desc
  limit 1;

  if nullif(btrim(web_app_url), '') is null or nullif(btrim(cron_secret), '') is null then
    raise notice
      'Skipping organizer import cleanup schedule because Vault secrets web_app_url or cron_secret are missing.';
    return;
  end if;

  web_app_url := rtrim(web_app_url, '/');

  for existing_job_id in
    select job.jobid
    from cron.job as job
    where job.jobname = job_name
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    job_name,
    job_schedule,
    format(
      $job$
        select net.http_get(
          url := %L,
          headers := jsonb_build_object('Authorization', 'Bearer ' || %L),
          timeout_milliseconds := 10000
        ) as request_id;
      $job$,
      web_app_url || '/api/cron/organizer-import-cleanup',
      cron_secret
    )
  );
end;
$_$;


--
-- Name: configure_push_reminders_cron(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.configure_push_reminders_cron() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_job_name constant text := 'push-reminders-daily';
  v_schedule constant text := '0 9 * * *';
  v_project_url text;
  v_anon_key text;
  v_cron_secret text;
  v_job_id bigint;
begin
  select ds.decrypted_secret
  into v_project_url
  from vault.decrypted_secrets as ds
  where ds.name = 'project_url'
  order by ds.created_at desc
  limit 1;

  select ds.decrypted_secret
  into v_anon_key
  from vault.decrypted_secrets as ds
  where ds.name = 'anon_key'
  order by ds.created_at desc
  limit 1;

  select ds.decrypted_secret
  into v_cron_secret
  from vault.decrypted_secrets as ds
  where ds.name = 'push_cron_secret'
  order by ds.created_at desc
  limit 1;

  if v_project_url is null or v_anon_key is null or v_cron_secret is null then
    raise notice
      'Skipping push reminder cron schedule because Vault secrets project_url, anon_key, or push_cron_secret are missing.';
    return;
  end if;

  v_project_url := rtrim(v_project_url, '/');

  for v_job_id in
    select job.jobid
    from cron.job as job
    where job.jobname = v_job_name
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    v_job_name,
    v_schedule,
    format(
      $job$
        select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L,
            'x-cron-secret', %L
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 10000
        ) as request_id;
      $job$,
      v_project_url || '/functions/v1/push-reminders',
      v_anon_key,
      v_cron_secret
    )
  );
end;
$_$;


--
-- Name: confirm_organizer_import_formats(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_organizer_import_formats(p_session_id uuid, p_formats jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
declare
  import_session public.organizer_import_sessions;
  edition_start_date date;
  format_item jsonb;
  format_mode text;
  format_key text;
  confirmed_name text;
  target_race_id uuid;
  confirmed_row public.races;
  confirmed_payload jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_formats) is distinct from 'array'
    or jsonb_array_length(p_formats) = 0
    or jsonb_array_length(p_formats) > 100 then
    raise exception 'p_formats must be an array containing between 1 and 100 formats.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_formats) as item(value)
    where jsonb_typeof(item.value) is distinct from 'object'
  ) then
    raise exception 'Every format must be a JSON object.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_formats) as item(value),
         lateral jsonb_object_keys(item.value) as supplied(key)
    where supplied.key not in ('formatKey', 'candidateKeys', 'mode', 'raceId', 'name')
  ) then
    raise exception 'A format contains an unsupported key.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_formats) as item(value)
    where jsonb_typeof(item.value -> 'formatKey') is distinct from 'string'
      or nullif(btrim(item.value ->> 'formatKey'), '') is null
      or jsonb_typeof(item.value -> 'mode') is distinct from 'string'
      or item.value ->> 'mode' not in ('create', 'bind-existing')
      or jsonb_typeof(item.value -> 'name') is distinct from 'string'
      or nullif(btrim(item.value ->> 'name'), '') is null
      or char_length(btrim(item.value ->> 'name')) > 300
      or jsonb_typeof(item.value -> 'candidateKeys') is distinct from 'array'
      or jsonb_array_length(item.value -> 'candidateKeys') > 30
      or exists (
        select 1
        from jsonb_array_elements(item.value -> 'candidateKeys') as candidate_key(value)
        where jsonb_typeof(candidate_key.value) is distinct from 'string'
          or nullif(btrim(candidate_key.value #>> '{}'), '') is null
          or char_length(btrim(candidate_key.value #>> '{}')) > 300
      )
      or (
        item.value ->> 'mode' = 'create'
        and item.value ? 'raceId'
      )
      or (
        item.value ->> 'mode' = 'bind-existing'
        and (
          jsonb_typeof(item.value -> 'raceId') is distinct from 'string'
          or coalesce(item.value ->> 'raceId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        )
      )
  ) then
    raise exception 'A confirmed format has an invalid shape.' using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_formats)
  ) <> (
    select count(distinct btrim(item.value ->> 'formatKey'))
    from jsonb_array_elements(p_formats) as item(value)
  ) then
    raise exception 'formatKey values must be unique.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_formats) as first_item(value)
    join jsonb_array_elements(p_formats) as second_item(value)
      on first_item.value ->> 'mode' = 'bind-existing'
     and second_item.value ->> 'mode' = 'bind-existing'
     and first_item.value ->> 'formatKey' < second_item.value ->> 'formatKey'
     and first_item.value ->> 'raceId' = second_item.value ->> 'raceId'
  ) then
    raise exception 'An existing race can be bound only once.' using errcode = '22023';
  end if;

  select session_row.*
  into import_session
  from public.organizer_import_sessions as session_row
  where session_row.id = p_session_id
  for update;

  if import_session.id is null then
    raise exception 'Organizer import session not found.' using errcode = 'P0002';
  end if;
  if import_session.expires_at <= timezone('utc', now()) then
    raise exception 'Organizer import session has expired.' using errcode = '22023';
  end if;
  if import_session.status <> 'discovered' then
    raise exception 'Organizer import formats have already been confirmed.' using errcode = '55000';
  end if;

  select edition_row.start_date
  into edition_start_date
  from public.race_event_editions as edition_row
  where edition_row.id = import_session.edition_id
    and edition_row.event_id = import_session.event_id;

  if edition_start_date is null then
    raise exception 'Organizer import edition does not belong to the event.' using errcode = '23514';
  end if;

  for format_item in
    select item.value
    from jsonb_array_elements(p_formats) with ordinality as item(value, position)
    order by item.position
  loop
    format_mode := format_item ->> 'mode';
    format_key := btrim(format_item ->> 'formatKey');
    confirmed_name := btrim(format_item ->> 'name');

    if format_mode = 'create' then
      target_race_id := gen_random_uuid();

      insert into public.races (
        id,
        slug,
        name,
        distance_km,
        elevation_gain_m,
        elevation_loss_m,
        gpx_path,
        gpx_hash,
        is_published,
        is_live,
        created_by,
        event_id,
        edition_id,
        edition_group_id,
        series_name,
        race_date,
        racebook_is_live,
        data_status,
        missing_required_fields
      )
      values (
        target_race_id,
        'organizer-import-' || replace(target_race_id::text, '-', ''),
        confirmed_name,
        0,
        0,
        0,
        'organizer/' || import_session.event_id::text || '/' || target_race_id::text || '.gpx',
        'pending:' || target_race_id::text,
        false,
        false,
        import_session.created_by,
        import_session.event_id,
        import_session.edition_id,
        target_race_id,
        confirmed_name,
        edition_start_date,
        false,
        'draft',
        array['distance_km', 'elevation_gain_m']::text[]
      )
      returning * into confirmed_row;
    else
      target_race_id := (format_item ->> 'raceId')::uuid;

      update public.races as race_row
      set name = confirmed_name,
          series_name = confirmed_name
      where race_row.id = target_race_id
        and race_row.event_id = import_session.event_id
        and race_row.edition_id = import_session.edition_id
      returning race_row.* into confirmed_row;

      if confirmed_row.id is null then
        raise exception 'Bound race does not belong to the import event and edition.'
          using errcode = '23514';
      end if;
    end if;

    confirmed_payload := confirmed_payload || jsonb_build_array(
      jsonb_build_object(
        'formatKey', format_key,
        'candidateKeys', format_item -> 'candidateKeys',
        'raceId', confirmed_row.id,
        'name', confirmed_row.name,
        'mode', format_mode,
        'dataStatus', confirmed_row.data_status,
        'missingRequiredFields', to_jsonb(confirmed_row.missing_required_fields)
      )
    );
  end loop;

  update public.organizer_import_sessions
  set confirmed_formats = confirmed_payload,
      status = 'formats_confirmed'
  where id = p_session_id;

  return jsonb_build_object(
    'sessionId', p_session_id,
    'formats', confirmed_payload,
    'createdCount', (
      select count(*)
      from jsonb_array_elements(confirmed_payload) as item(value)
      where item.value ->> 'mode' = 'create'
    ),
    'boundExistingCount', (
      select count(*)
      from jsonb_array_elements(confirmed_payload) as item(value)
      where item.value ->> 'mode' = 'bind-existing'
    )
  );
end;
$_$;


--
-- Name: create_organizer_aid_station_product(uuid, uuid, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_organizer_aid_station_product(p_race_id uuid, p_aid_station_id uuid, p_product jsonb, p_notes text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  locked_race_id uuid;
  locked_station_id uuid;
  product_row public.products%rowtype;
  link_row public.race_aid_station_products%rowtype;
begin
  if jsonb_typeof(p_product) <> 'object' then
    raise exception 'Product must be a JSON object.' using errcode = '22023';
  end if;

  select race_row.id
  into locked_race_id
  from public.races as race_row
  where race_row.id = p_race_id
  for update;

  if locked_race_id is null then
    raise exception 'Race not found.' using errcode = 'P0002';
  end if;

  select station.id
  into locked_station_id
  from public.race_aid_stations as station
  where station.id = p_aid_station_id
    and station.race_id = p_race_id
  for update;

  if locked_station_id is null then
    raise exception 'Aid station does not belong to this race.' using errcode = '23503';
  end if;

  insert into public.products (
    id,
    slug,
    sku,
    name,
    brand,
    fuel_type,
    product_url,
    calories_kcal,
    carbs_g,
    sodium_mg,
    protein_g,
    fat_g,
    is_live,
    is_archived,
    is_official,
    official_name,
    created_by
  ) values (
    (p_product ->> 'id')::uuid,
    p_product ->> 'slug',
    p_product ->> 'sku',
    p_product ->> 'name',
    nullif(p_product ->> 'brand', ''),
    (p_product ->> 'fuel_type')::public.fuel_type,
    nullif(p_product ->> 'product_url', ''),
    (p_product ->> 'calories_kcal')::numeric,
    (p_product ->> 'carbs_g')::numeric,
    (p_product ->> 'sodium_mg')::numeric,
    (p_product ->> 'protein_g')::numeric,
    (p_product ->> 'fat_g')::numeric,
    false,
    false,
    false,
    null,
    (p_product ->> 'created_by')::uuid
  )
  returning * into product_row;

  insert into public.race_aid_station_products (
    race_aid_station_id,
    product_id,
    notes,
    order_index
  ) values (
    p_aid_station_id,
    product_row.id,
    p_notes,
    999
  )
  returning * into link_row;

  return jsonb_build_object(
    'product', to_jsonb(product_row),
    'stationProduct', to_jsonb(link_row)
  );
end;
$$;


--
-- Name: FUNCTION create_organizer_aid_station_product(p_race_id uuid, p_aid_station_id uuid, p_product jsonb, p_notes text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_organizer_aid_station_product(p_race_id uuid, p_aid_station_id uuid, p_product jsonb, p_notes text) IS 'Atomically creates an organizer-scoped product and attaches it to one aid station.';


--
-- Name: delete_race_event_edition(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_race_event_edition(p_edition_id uuid) RETURNS TABLE(deleted_edition_id uuid, next_edition_id uuid, next_edition_year smallint)
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  edition_row public.race_event_editions;
  replacement_row public.race_event_editions;
begin
  select *
  into edition_row
  from public.race_event_editions
  where id = p_edition_id;

  if edition_row.id is null then
    raise exception 'Edition not found.';
  end if;

  perform 1
  from public.race_events
  where id = edition_row.event_id
  for update;

  select *
  into edition_row
  from public.race_event_editions
  where id = p_edition_id
  for update;

  if edition_row.id is null then
    raise exception 'Edition not found.';
  end if;

  if (
    select count(*)
    from public.race_event_editions
    where event_id = edition_row.event_id
  ) <= 1 then
    raise exception 'The only edition cannot be deleted.';
  end if;

  select *
  into replacement_row
  from public.race_event_editions
  where event_id = edition_row.event_id
    and id <> edition_row.id
  order by start_date desc, created_at desc
  limit 1;

  delete from public.race_event_editions
  where id = edition_row.id;

  if edition_row.is_current then
    update public.race_event_editions
    set is_current = true
    where id = replacement_row.id;
  end if;

  return query
  select edition_row.id, replacement_row.id, replacement_row.edition_year;
end;
$$;


--
-- Name: enforce_race_catalog_completeness(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_race_catalog_completeness() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  computed_missing text[] := array[]::text[];
begin
  if 'elevation_gain_m' = any(coalesce(new.missing_required_fields, array[]::text[])) then
    new.elevation_gain_m := null;
  end if;
  if new.gpx_storage_path is null and coalesce(new.gpx_hash, '') like 'pending:%' then
    new.gpx_path := null;
    new.gpx_hash := null;
  end if;
  if new.race_date is null then computed_missing := array_append(computed_missing, 'race_date'); end if;
  if new.distance_km is null or new.distance_km <= 0 then computed_missing := array_append(computed_missing, 'distance_km'); end if;
  if coalesce(nullif(btrim(new.location_text), ''), nullif(btrim(new.location), '')) is null then
    computed_missing := array_append(computed_missing, 'location');
  end if;
  if coalesce(nullif(btrim(new.source_url), ''), nullif(btrim(new.external_site_url), '')) is null then
    computed_missing := array_append(computed_missing, 'source_url');
  end if;

  new.missing_required_fields := computed_missing;
  if cardinality(computed_missing) > 0 then
    new.data_status := 'draft';
    new.is_live := false;
    new.racebook_is_live := false;
  end if;
  return new;
end;
$$;


--
-- Name: enforce_race_event_edition_visibility(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_race_event_edition_visibility() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  edition_is_visible boolean;
begin
  if new.edition_id is null then
    return new;
  end if;

  select ree.is_visible
  into edition_is_visible
  from public.race_event_editions ree
  where ree.id = new.edition_id;

  if edition_is_visible = false then
    new.is_live := false;
    new.racebook_is_live := false;
  end if;

  return new;
end;
$$;


--
-- Name: enforce_racebook_sponsor_limits(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_racebook_sponsor_limits() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.edition_id::text, 0));

  if (
    select count(*)
    from public.race_event_edition_sponsors sponsor
    where sponsor.edition_id = new.edition_id
      and sponsor.id <> new.id
  ) >= 10 then
    raise exception 'An edition can have at most 10 sponsors.' using errcode = '23514';
  end if;

  if new.is_active and new.show_on_loading and (
    select count(*)
    from public.race_event_edition_sponsors sponsor
    where sponsor.edition_id = new.edition_id
      and sponsor.id <> new.id
      and sponsor.is_active
      and sponsor.show_on_loading
  ) >= 2 then
    raise exception 'Only two active sponsors can appear on the loading screen.' using errcode = '23514';
  end if;

  return new;
end;
$$;


--
-- Name: ensure_organizer_edition_entitlement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_organizer_edition_entitlement() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  insert into public.organizer_edition_entitlements (edition_id)
  values (new.id)
  on conflict (edition_id) do nothing;
  return new;
end;
$$;


--
-- Name: get_admin_growth_metrics(date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_growth_metrics(p_start_date date, p_end_date date, p_timezone text DEFAULT 'Europe/Paris'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_now timestamptz := now();
  v_result jsonb;
begin
  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date then
    raise exception 'Invalid reporting range';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception 'Reporting range cannot exceed 366 days';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown reporting timezone';
  end if;

  v_start := p_start_date::timestamp at time zone p_timezone;
  v_end := p_end_date::timestamp at time zone p_timezone;

  with
  non_admin_users as (
    select u.id, u.email, u.created_at, u.last_sign_in_at
    from auth.users u
    where not (
      coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
      or coalesce(u.raw_app_meta_data -> 'roles', '[]'::jsonb) ? 'admin'
    )
  ),
  mature_account_cohort as (
    select u.id, u.created_at
    from non_admin_users u
    where u.email is not null
      and u.created_at >= v_start
      and u.created_at < v_end
      and u.created_at <= v_now - interval '24 hours'
  ),
  activated_accounts as (
    select cohort.id, cohort.created_at
    from mature_account_cohort cohort
    where exists (
      select 1
      from public.race_plans plan
      where plan.user_id = cohort.id
        and plan.created_at >= cohort.created_at
        and plan.created_at <= cohort.created_at + interval '24 hours'
    )
  ),
  active_subscriptions as (
    select subscription.user_id, subscription.provider
    from public.subscriptions subscription
    join non_admin_users u on u.id = subscription.user_id
    where lower(coalesce(subscription.status, '')) in ('active', 'trialing')
      and (subscription.current_period_end is null or subscription.current_period_end > v_now)
  ),
  paid_subscriptions as (
    select user_id, provider
    from active_subscriptions subscription
    where exists (
      select 1 from public.subscriptions source
      where source.user_id = subscription.user_id
        and lower(coalesce(source.status, '')) = 'active'
    )
  ),
  active_trials as (
    select profile.user_id
    from public.user_profiles profile
    join non_admin_users u on u.id = profile.user_id
    where profile.trial_started_at <= v_now and profile.trial_ends_at > v_now
  ),
  active_grants as (
    select distinct grant_row.user_id
    from public.premium_grants grant_row
    join non_admin_users u on u.id = grant_row.user_id
    where grant_row.starts_at <= v_now
      and coalesce(grant_row.ends_at, grant_row.starts_at + make_interval(days => grant_row.initial_duration_days)) > v_now
  ),
  effective_premium as (
    select user_id from active_subscriptions
    union select user_id from active_trials
    union select user_id from active_grants
  ),
  memberships as (
    select membership.*
    from public.race_event_organizers membership
    join non_admin_users u on u.id = membership.user_id
    where membership.revoked_at is null
  ),
  event_cohort as (
    select distinct membership.event_id
    from memberships membership
    where membership.role = 'owner'
      and membership.created_by = membership.user_id
      and membership.created_at >= v_start
      and membership.created_at < v_end
  ),
  cohort_progress as (
    select
      cohort.event_id,
      exists (select 1 from public.race_event_editions edition where edition.event_id = cohort.event_id) as has_edition,
      exists (
        select 1 from public.races race
        where race.event_id = cohort.event_id
          and (race.data_status = 'complete' or (coalesce(race.data_status, '') <> 'draft' and cardinality(coalesce(race.missing_required_fields, '{}'::text[])) = 0))
      ) as has_complete_format,
      exists (select 1 from public.races race where race.event_id = cohort.event_id and race.racebook_is_live) as has_published_racebook
    from event_cohort cohort
  ),
  organizer_counts as (
    select
      count(distinct membership.user_id) filter (
        where membership.created_by = membership.user_id
          and membership.created_at >= v_start and membership.created_at < v_end
      )::integer as new_organizers,
      count(distinct membership.user_id) filter (
        where u.last_sign_in_at >= v_start and u.last_sign_in_at < v_end
      )::integer as active_organizers,
      count(distinct membership.user_id) filter (
        where u.last_sign_in_at >= v_start and u.last_sign_in_at < v_end
          and u.last_sign_in_at >= membership.created_at + interval '7 days'
      )::integer as returning_organizers
    from memberships membership
    join non_admin_users u on u.id = membership.user_id
  ),
  entitled_editions as (
    select entitlement.edition_id, entitlement.source
    from public.organizer_edition_entitlements entitlement
    join public.race_event_editions edition on edition.id = entitlement.edition_id
    where entitlement.status = 'active'
      and entitlement.tier in ('essential', 'complete', 'signature')
      and exists (select 1 from memberships membership where membership.event_id = edition.event_id)
  ),
  commercial_activity as (
    select
      count(*) filter (
        where payment.created_at >= v_start and payment.created_at < v_end
      )::integer as checkouts_started,
      count(*) filter (
        where payment.created_at >= v_start and payment.created_at < v_end
          and payment.paid_at is not null
      )::integer as checkout_cohort_paid,
      count(*) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
      )::integer as paid_transactions,
      coalesce(sum(payment.amount_total) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
      ), 0)::bigint as gross_revenue_minor,
      count(*) filter (
        where payment.invalidated_at >= v_start and payment.invalidated_at < v_end
          and payment.status in ('refunded', 'disputed')
      )::integer as invalidated_transactions,
      coalesce(sum(payment.amount_total) filter (
        where payment.invalidated_at >= v_start and payment.invalidated_at < v_end
          and payment.status in ('refunded', 'disputed')
      ), 0)::bigint as invalidated_revenue_minor,
      count(*) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
          and payment.purchase_kind in ('racebook', 'essential_direct', 'complete_direct', 'signature_direct')
      )::integer as racebook_sales,
      count(*) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
          and payment.purchase_kind in ('pro_direct', 'signature_direct')
      )::integer as pro_direct_sales,
      count(*) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
          and payment.purchase_kind in ('pro_upgrade', 'essential_to_complete', 'essential_to_signature', 'complete_to_signature')
      )::integer as pro_upgrade_sales
    from public.organizer_edition_payments payment
    where payment.purchaser_user_id is null
      or exists (select 1 from non_admin_users u where u.id = payment.purchaser_user_id)
  ),
  trend_days as (
    select day::date as day
    from generate_series(p_start_date, p_end_date - 1, interval '1 day') day
  ),
  trend as (
    select jsonb_agg(jsonb_build_object(
      'date', to_char(days.day, 'YYYY-MM-DD'),
      'newAccounts', (select count(*) from non_admin_users u where u.email is not null and (u.created_at at time zone p_timezone)::date = days.day),
      'activationEligibleAccounts', (select count(*) from mature_account_cohort u where (u.created_at at time zone p_timezone)::date = days.day),
      'activatedUsers', (select count(*) from activated_accounts u where (u.created_at at time zone p_timezone)::date = days.day),
      'activePlanUsers', (select count(distinct plan.user_id) from public.race_plans plan join non_admin_users u on u.id = plan.user_id where (plan.updated_at at time zone p_timezone)::date = days.day),
      'newPlans', (select count(*) from public.race_plans plan join non_admin_users u on u.id = plan.user_id where (plan.created_at at time zone p_timezone)::date = days.day)
    ) order by days.day) as value
    from trend_days days
  ),
  follow_ups as (
    select coalesce(jsonb_agg(item.value order by item.days_inactive desc), '[]'::jsonb) as value
    from (
      select jsonb_build_object(
        'eventId', event.id,
        'eventName', event.name,
        'organizerEmail', coalesce(u.email, membership.user_id::text),
        'lastActivityAt', coalesce(u.last_sign_in_at, membership.created_at),
        'status', case
          when exists (select 1 from public.races race where race.event_id = event.id and race.racebook_is_live) then 'published'
          when not exists (select 1 from public.races race where race.event_id = event.id) then 'no_format'
          when not exists (
            select 1 from public.races race where race.event_id = event.id
              and (race.data_status = 'complete' or (coalesce(race.data_status, '') <> 'draft' and cardinality(coalesce(race.missing_required_fields, '{}'::text[])) = 0))
          ) then 'incomplete'
          else 'ready_to_publish'
        end,
        'daysInactive', greatest(0, floor(extract(epoch from (v_now - coalesce(u.last_sign_in_at, membership.created_at))) / 86400)::integer)
      ) as value,
      greatest(0, floor(extract(epoch from (v_now - coalesce(u.last_sign_in_at, membership.created_at))) / 86400)::integer) as days_inactive
      from memberships membership
      join auth.users u on u.id = membership.user_id
      join public.race_events event on event.id = membership.event_id
      where membership.role = 'owner'
        and not exists (select 1 from public.races race where race.event_id = event.id and race.racebook_is_live)
        and v_now - coalesce(u.last_sign_in_at, membership.created_at) >= interval '3 days'
      order by days_inactive desc
      limit 20
    ) item
  )
  select jsonb_build_object(
    'overview', jsonb_build_object(
      'newAccounts', (select count(*) from non_admin_users u where u.email is not null and u.created_at >= v_start and u.created_at < v_end),
      'activationEligibleAccounts', (select count(*) from mature_account_cohort),
      'activatedUsers', (select count(*) from activated_accounts),
      'activePlanUsers', (select count(distinct plan.user_id) from public.race_plans plan join non_admin_users u on u.id = plan.user_id where plan.updated_at >= v_start and plan.updated_at < v_end),
      'newPlans', (select count(*) from public.race_plans plan join non_admin_users u on u.id = plan.user_id where plan.created_at >= v_start and plan.created_at < v_end),
      'activePremiumUsers', (select count(*) from effective_premium),
      'premium', jsonb_build_object(
        'paidSubscriptions', (select count(*) from paid_subscriptions),
        'appTrials', (select count(*) from active_trials),
        'grants', (select count(*) from active_grants),
        'effectiveUsers', (select count(*) from effective_premium),
        'providers', jsonb_build_object(
          'web', (select count(*) from paid_subscriptions where provider = 'web'),
          'apple', (select count(*) from paid_subscriptions where provider = 'apple'),
          'google', (select count(*) from paid_subscriptions where provider = 'google')
        )
      )
    ),
    'trend', (select value from trend),
    'organizers', jsonb_build_object(
      'newOrganizers', (select new_organizers from organizer_counts),
      'activeOrganizers', (select active_organizers from organizer_counts),
      'returningOrganizers', (select returning_organizers from organizer_counts),
      'eventsCreated', (select count(*) from event_cohort),
      'editionsCreated', (select count(*) from public.race_event_editions edition where edition.created_at >= v_start and edition.created_at < v_end and exists (select 1 from memberships membership where membership.event_id = edition.event_id)),
      'formatsCreated', (select count(*) from public.races race where race.created_at >= v_start and race.created_at < v_end and exists (select 1 from memberships membership where membership.event_id = race.event_id)),
      'publishedRacebooks', (select count(*) from public.races race where race.racebook_publication_approved_at >= v_start and race.racebook_publication_approved_at < v_end and exists (select 1 from memberships membership where membership.event_id = race.event_id)),
      'activatedRacebooks', (select count(*) from entitled_editions),
      'giftedRacebooks', (select count(*) from entitled_editions where source in ('admin', 'legacy_admin')),
      'paidRacebooks', (select count(*) from entitled_editions where source = 'stripe'),
      'commercial', jsonb_build_object(
        'checkoutsStarted', (select checkouts_started from commercial_activity),
        'checkoutCohortPaid', (select checkout_cohort_paid from commercial_activity),
        'checkoutConversion', case
          when (select checkouts_started from commercial_activity) = 0 then null
          else round(100.0 * (select checkout_cohort_paid from commercial_activity) / (select checkouts_started from commercial_activity), 1)
        end,
        'paidTransactions', (select paid_transactions from commercial_activity),
        'grossRevenueMinor', (select gross_revenue_minor from commercial_activity),
        'invalidatedTransactions', (select invalidated_transactions from commercial_activity),
        'invalidatedRevenueMinor', (select invalidated_revenue_minor from commercial_activity),
        'netRevenueMinor', (select gross_revenue_minor - invalidated_revenue_minor from commercial_activity),
        'currency', 'eur',
        'racebookSales', (select racebook_sales from commercial_activity),
        'proDirectSales', (select pro_direct_sales from commercial_activity),
        'proUpgradeSales', (select pro_upgrade_sales from commercial_activity)
      ),
      'funnel', jsonb_build_array(
        jsonb_build_object('step', 'Événements de la cohorte', 'count', (select count(*) from cohort_progress), 'conversionFromPrevious', null),
        jsonb_build_object('step', 'Avec une édition', 'count', (select count(*) from cohort_progress where has_edition), 'conversionFromPrevious', case when (select count(*) from cohort_progress) = 0 then null else round(100.0 * (select count(*) from cohort_progress where has_edition) / (select count(*) from cohort_progress), 1) end),
        jsonb_build_object('step', 'Avec un format complet', 'count', (select count(*) from cohort_progress where has_edition and has_complete_format), 'conversionFromPrevious', case when (select count(*) from cohort_progress where has_edition) = 0 then null else round(100.0 * (select count(*) from cohort_progress where has_edition and has_complete_format) / (select count(*) from cohort_progress where has_edition), 1) end),
        jsonb_build_object('step', 'Avec un RaceBook publié', 'count', (select count(*) from cohort_progress where has_edition and has_complete_format and has_published_racebook), 'conversionFromPrevious', case when (select count(*) from cohort_progress where has_edition and has_complete_format) = 0 then null else round(100.0 * (select count(*) from cohort_progress where has_edition and has_complete_format and has_published_racebook) / (select count(*) from cohort_progress where has_edition and has_complete_format), 1) end)
      ),
      'followUps', (select value from follow_ups)
    )
  ) into v_result;

  return v_result;
end;
$$;


--
-- Name: FUNCTION get_admin_growth_metrics(p_start_date date, p_end_date date, p_timezone text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_admin_growth_metrics(p_start_date date, p_end_date date, p_timezone text) IS 'Service-only aggregate KPI snapshot. Date bounds are interpreted in the supplied business timezone and activation uses only fully matured 24-hour cohorts.';


--
-- Name: get_admin_user_rows(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_user_rows() RETURNS TABLE(user_id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, plan_count bigint, has_profile boolean, subscription_status text, subscription_period_end timestamp with time zone, grant_reason text, app_metadata jsonb)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  select
    u.id as user_id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    count(rp.id) as plan_count,
    exists (
      select 1
      from public.user_profiles up
      where up.user_id = u.id
        and up.water_bag_liters is not null
    ) as has_profile,
    coalesce(
      (
        select s.status
        from public.subscriptions s
        where s.user_id = u.id
          and lower(coalesce(s.status, '')) in ('active', 'trialing')
          and (s.current_period_end is null or s.current_period_end > now())
        limit 1
      ),
      (
        select s.status
        from public.subscriptions s
        where s.user_id = u.id
        limit 1
      )
    ) as subscription_status,
    (
      select s.current_period_end
      from public.subscriptions s
      where s.user_id = u.id
        and lower(coalesce(s.status, '')) in ('active', 'trialing')
      limit 1
    ) as subscription_period_end,
    (
      select pg.reason
      from public.premium_grants pg
      where pg.user_id = u.id
        and pg.starts_at <= now()
        and coalesce(
          pg.ends_at,
          pg.starts_at + (pg.initial_duration_days || ' days')::interval
        ) >= now()
      order by pg.starts_at desc
      limit 1
    ) as grant_reason,
    u.raw_app_meta_data as app_metadata
  from auth.users u
  left join public.race_plans rp on rp.user_id = u.id
  group by
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.raw_app_meta_data
  order by u.created_at desc;
$$;


--
-- Name: get_signups_by_day(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_signups_by_day() RETURNS TABLE(day text, count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT
    to_char(created_at, 'YYYY-MM-DD') AS day,
    count(*) AS count
  FROM auth.users
  WHERE created_at >= now() - interval '90 days'
  GROUP BY day
  ORDER BY day;
$$;


--
-- Name: get_signups_by_month(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_signups_by_month() RETURNS TABLE(month text, count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT
    to_char(created_at, 'YYYY-MM') AS month,
    count(*) AS count
  FROM auth.users
  GROUP BY month
  ORDER BY month;
$$;


--
-- Name: get_trial_users_enriched(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_trial_users_enriched(p_start timestamp with time zone, p_end timestamp with time zone) RETURNS TABLE(user_id uuid, full_name text, trial_ends_at timestamp with time zone, email text, plans jsonb, favorites jsonb)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    up.user_id,
    up.full_name,
    up.trial_ends_at,
    au.email,

    -- Plans de course (max 3, avec nom de la course associée)
    coalesce((
      select jsonb_agg(p)
      from (
        select jsonb_build_object(
          'name', rp.name,
          'race_name', rc.name,
          'race_location', rc.location_text,
          'distance_km', rc.distance_km,
          'elevation_gain_m', rc.elevation_gain_m
        ) as p
        from public.race_plans rp
        left join public.race_catalog rc on rc.id = rp.catalog_race_id
        where rp.user_id = up.user_id
        order by rp.updated_at desc
        limit 3
      ) sub
    ), '[]'::jsonb) as plans,

    -- Produits favoris (max 4)
    coalesce((
      select jsonb_agg(f)
      from (
        select jsonb_build_object(
          'name', pr.name,
          'fuel_type', pr.fuel_type,
          'calories_kcal', pr.calories_kcal,
          'carbs_g', pr.carbs_g,
          'sodium_mg', pr.sodium_mg
        ) as f
        from public.user_favorite_products ufp
        join public.products pr on pr.id = ufp.product_id
        where ufp.user_id = up.user_id
        limit 4
      ) sub
    ), '[]'::jsonb) as favorites

  from public.user_profiles up
  join auth.users au on au.id = up.user_id
  where up.trial_ends_at between p_start and p_end
$$;


--
-- Name: get_trial_users_for_reminder(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_trial_users_for_reminder(p_start timestamp with time zone, p_end timestamp with time zone) RETURNS TABLE(user_id uuid, full_name text, trial_ends_at timestamp with time zone, email text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    up.user_id,
    up.full_name,
    up.trial_ends_at,
    au.email
  from public.user_profiles up
  join auth.users au on au.id = up.user_id
  where
    up.trial_ends_at between p_start and p_end
$$;


--
-- Name: handle_new_user_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  trial_start timestamptz := coalesce(new.created_at, timezone('utc', now()));
  profile_name text := nullif(
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')),
    ''
  );
begin
  insert into public.user_profiles (user_id, full_name, trial_started_at, trial_ends_at)
  values (new.id, profile_name, trial_start, trial_start + interval '15 days')
  on conflict (user_id) do update
  set
    full_name = coalesce(public.user_profiles.full_name, excluded.full_name),
    trial_started_at = coalesce(public.user_profiles.trial_started_at, excluded.trial_started_at),
    trial_ends_at = coalesce(
      public.user_profiles.trial_ends_at,
      coalesce(public.user_profiles.trial_started_at, excluded.trial_started_at) + interval '15 days'
    );

  return new;
end;
$$;


--
-- Name: increment_racebook_sponsor_click(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_racebook_sponsor_click(p_sponsor_id uuid, p_race_id uuid) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  target_url text;
begin
  update public.race_event_edition_sponsors sponsor
  set click_count = sponsor.click_count + 1
  from public.races race
  where sponsor.id = p_sponsor_id
    and race.id = p_race_id
    and race.edition_id = sponsor.edition_id
    and sponsor.is_active
    and sponsor.website_url is not null
  returning sponsor.website_url into target_url;

  if target_url is null then
    raise exception 'Sponsor link not found.';
  end if;

  return target_url;
end;
$$;


--
-- Name: FUNCTION increment_racebook_sponsor_click(p_sponsor_id uuid, p_race_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.increment_racebook_sponsor_click(p_sponsor_id uuid, p_race_id uuid) IS 'Atomically increments an active sponsor click after verifying that the requested race belongs to the same edition.';


--
-- Name: increment_racebook_sponsor_impression(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_racebook_sponsor_impression(p_sponsor_id uuid, p_race_id uuid, p_placement text) RETURNS bigint
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  updated_count bigint;
begin
  if p_placement not in ('loading', 'hero', 'aid_stations', 'equipment', 'access', 'services') then
    raise exception 'Invalid sponsor impression placement.' using errcode = '22023';
  end if;

  update public.race_event_edition_sponsors as sponsor
  set impression_count = sponsor.impression_count + 1
  from public.races as race,
       public.race_events as event_row
  where sponsor.id = p_sponsor_id
    and sponsor.is_active
    and race.id = p_race_id
    and race.edition_id = sponsor.edition_id
    and race.event_id = event_row.id
    and race.is_live
    and race.racebook_is_live
    and coalesce(race.racebook_preview_is_visible, true)
    and event_row.is_live
    and (
      (p_placement = 'loading' and sponsor.show_on_loading)
      or (p_placement = 'hero' and sponsor.show_in_banner)
      or sponsor.contextual_placement = p_placement
    )
  returning sponsor.impression_count into updated_count;

  if updated_count is null then
    raise exception 'Sponsor impression target not found.' using errcode = 'P0002';
  end if;

  return updated_count;
end;
$$;


--
-- Name: FUNCTION increment_racebook_sponsor_impression(p_sponsor_id uuid, p_race_id uuid, p_placement text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.increment_racebook_sponsor_impression(p_sponsor_id uuid, p_race_id uuid, p_placement text) IS 'Atomically counts one eligible sponsor impression for a published RaceBook and validated placement.';


--
-- Name: increment_user_sign_in(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_user_sign_in(p_user_id uuid, p_signed_in_at timestamp with time zone DEFAULT timezone('utc'::text, now())) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.user_profiles
  set
    sign_in_count = coalesce(sign_in_count, 0) + 1,
    first_sign_in_at = coalesce(first_sign_in_at, p_signed_in_at),
    last_sign_in_at = p_signed_in_at
  where user_id = p_user_id;
end;
$$;


--
-- Name: infer_product_brand(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.infer_product_brand(raw_name text, raw_slug text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare
  source_name text;
  cleaned_slug text;
  first_token text;
begin
  source_name := trim(coalesce(nullif(split_part(coalesce(raw_name, ''), ' - ', 1), ''), raw_name, ''));
  source_name := regexp_replace(source_name, '\s+', ' ', 'g');

  if source_name <> '' then
    first_token := public.normalize_product_brand(source_name);
    if first_token is not null then
      return first_token;
    end if;
  end if;

  cleaned_slug := lower(trim(coalesce(raw_slug, '')));

  case
    when cleaned_slug like 'maurten-%' then return 'Maurten';
    when cleaned_slug like 'gu-%' then return 'GU';
    when cleaned_slug like 'sis-%' or cleaned_slug like 'science-in-sport-%' then return 'SiS';
    when cleaned_slug like 'naak-%' then return 'NAAK';
    when cleaned_slug like 'precision-fuel-%' or cleaned_slug like 'precision-hydration-%' then return 'Precision Fuel & Hydration';
    when cleaned_slug like 'tailwind-%' then return 'Tailwind';
    when cleaned_slug like 'neversecond-%' then return 'Neversecond';
    when cleaned_slug like 'overstims-%' or cleaned_slug like 'overstim-s-%' then return 'Overstims';
    when cleaned_slug like 'powerbar-%' then return 'Powerbar';
    when cleaned_slug like 'clif-%' then return 'Clif';
    when cleaned_slug like 'high5-%' then return 'HIGH5';
    when cleaned_slug like 'aptonia-%' then return 'Aptonia';
    when cleaned_slug like 'huma-%' then return 'Huma';
    when cleaned_slug like '226ers-%' then return '226ERS';
    when cleaned_slug like 'skratch-%' then return 'Skratch Labs';
    when cleaned_slug like 'saltstick-%' then return 'SaltStick';
    else null;
  end case;

  first_token := split_part(source_name, ' ', 1);
  return public.normalize_product_brand(first_token);
end;
$$;


--
-- Name: initialize_organizer_edition_modules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_organizer_edition_modules() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  insert into public.organizer_racebook_module_settings (edition_id, module_key, is_enabled)
  values
    (new.id, 'equipment', true),
    (new.id, 'bib_pickup', true),
    (new.id, 'access', true)
  on conflict do nothing;
  return new;
end;
$$;


--
-- Name: initialize_organizer_race_modules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_organizer_race_modules() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.edition_id is not null then
    insert into public.organizer_racebook_module_settings (edition_id, race_id, module_key, is_enabled)
    values (new.edition_id, new.id, 'aid_stations', true)
    on conflict do nothing;
  end if;
  return new;
end;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select
    coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce((select auth.jwt()) -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin';
$$;


--
-- Name: FUNCTION is_admin(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_admin() IS 'Checks only trusted Auth app_metadata for an administrator role.';


--
-- Name: is_valid_push_cron_secret(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_valid_push_cron_secret(candidate_secret text) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'vault'
    AS $$
  select exists (
    select 1
    from vault.decrypted_secrets as ds
    where ds.name = 'push_cron_secret'
      and ds.decrypted_secret = candidate_secret
  );
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: organizer_edition_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizer_edition_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    edition_id uuid NOT NULL,
    purchaser_user_id uuid,
    purchase_kind text NOT NULL,
    from_tier text NOT NULL,
    to_tier text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    stripe_checkout_session_id text,
    stripe_checkout_url text,
    stripe_payment_intent_id text,
    stripe_customer_id text,
    amount_subtotal integer,
    amount_tax integer,
    amount_total integer,
    currency text,
    paid_at timestamp with time zone,
    invalidated_at timestamp with time zone,
    payment_channel text DEFAULT 'stripe'::text NOT NULL,
    recorded_by uuid,
    stripe_invoice_id text,
    invoice_storage_path text,
    invoice_original_name text,
    invoice_uploaded_at timestamp with time zone,
    invoice_uploaded_by uuid,
    invoice_number text,
    invoice_sequence integer,
    invoice_issued_at timestamp with time zone,
    invoice_source text,
    invoice_legal_snapshot jsonb,
    CONSTRAINT organizer_edition_payments_amount_subtotal_check CHECK (((amount_subtotal IS NULL) OR (amount_subtotal >= 0))),
    CONSTRAINT organizer_edition_payments_amount_tax_check CHECK (((amount_tax IS NULL) OR (amount_tax >= 0))),
    CONSTRAINT organizer_edition_payments_amount_total_check CHECK (((amount_total IS NULL) OR (amount_total >= 0))),
    CONSTRAINT organizer_edition_payments_bank_transfer_check CHECK (((payment_channel <> 'bank_transfer'::text) OR ((status = 'paid'::text) AND (currency = 'eur'::text) AND (paid_at IS NOT NULL) AND (recorded_by IS NOT NULL) AND (amount_subtotal IS NOT NULL) AND (amount_tax IS NOT NULL) AND (amount_total = (amount_subtotal + amount_tax)) AND (stripe_checkout_session_id IS NULL) AND (stripe_checkout_url IS NULL) AND (stripe_payment_intent_id IS NULL) AND (stripe_customer_id IS NULL) AND (stripe_invoice_id IS NULL)))),
    CONSTRAINT organizer_edition_payments_channel_check CHECK ((payment_channel = ANY (ARRAY['stripe'::text, 'bank_transfer'::text]))),
    CONSTRAINT organizer_edition_payments_from_tier_check CHECK ((from_tier = ANY (ARRAY['visibility'::text, 'racebook'::text, 'essential'::text, 'complete'::text]))),
    CONSTRAINT organizer_edition_payments_generated_invoice_check CHECK ((((invoice_number IS NULL) AND (invoice_sequence IS NULL) AND (invoice_issued_at IS NULL) AND (invoice_source IS NULL) AND (invoice_legal_snapshot IS NULL)) OR ((invoice_number IS NOT NULL) AND (invoice_sequence IS NOT NULL) AND (invoice_sequence > 0) AND (invoice_issued_at IS NOT NULL) AND (invoice_source = 'generated'::text) AND (jsonb_typeof(invoice_legal_snapshot) = 'object'::text) AND (((invoice_storage_path IS NULL) AND (invoice_original_name IS NULL) AND (invoice_uploaded_at IS NULL) AND (invoice_uploaded_by IS NULL)) OR ((invoice_storage_path IS NOT NULL) AND (invoice_original_name IS NOT NULL) AND (invoice_uploaded_at IS NOT NULL) AND (invoice_uploaded_by IS NOT NULL)))) OR ((invoice_number IS NULL) AND (invoice_sequence IS NULL) AND (invoice_issued_at IS NULL) AND (invoice_source = 'uploaded'::text) AND (invoice_legal_snapshot IS NULL) AND (invoice_storage_path IS NOT NULL)))),
    CONSTRAINT organizer_edition_payments_invoice_metadata_check CHECK ((((invoice_storage_path IS NULL) AND (invoice_original_name IS NULL) AND (invoice_uploaded_at IS NULL) AND (invoice_uploaded_by IS NULL)) OR ((invoice_storage_path IS NOT NULL) AND (invoice_original_name IS NOT NULL) AND (invoice_uploaded_at IS NOT NULL) AND (invoice_uploaded_by IS NOT NULL)))),
    CONSTRAINT organizer_edition_payments_purchase_kind_check CHECK ((purchase_kind = ANY (ARRAY['racebook'::text, 'pro_direct'::text, 'pro_upgrade'::text, 'essential_direct'::text, 'complete_direct'::text, 'signature_direct'::text, 'essential_to_complete'::text, 'essential_to_signature'::text, 'complete_to_signature'::text]))),
    CONSTRAINT organizer_edition_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'expired'::text, 'refunded'::text, 'disputed'::text]))),
    CONSTRAINT organizer_edition_payments_to_tier_check CHECK ((to_tier = ANY (ARRAY['racebook'::text, 'pro'::text, 'essential'::text, 'complete'::text, 'signature'::text])))
);


--
-- Name: TABLE organizer_edition_payments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organizer_edition_payments IS 'Immutable-ish Stripe payment attempt ledger used to derive an edition commercial tier.';


--
-- Name: COLUMN organizer_edition_payments.payment_channel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizer_edition_payments.payment_channel IS 'Commercial channel shown to organizers: Stripe checkout or direct bank transfer.';


--
-- Name: COLUMN organizer_edition_payments.invoice_storage_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizer_edition_payments.invoice_storage_path IS 'Private organizer-invoices object path for an administrator-uploaded PDF.';


--
-- Name: COLUMN organizer_edition_payments.invoice_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizer_edition_payments.invoice_number IS 'Immutable chronological invoice identifier allocated when an automatic PDF is issued.';


--
-- Name: COLUMN organizer_edition_payments.invoice_legal_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizer_edition_payments.invoice_legal_snapshot IS 'Exact seller, customer, service, payment and amount facts rendered into the issued PDF.';


--
-- Name: issue_admin_organizer_invoice(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.issue_admin_organizer_invoice(p_payment_id uuid, p_admin_id uuid, p_invoice_legal_snapshot jsonb) RETURNS public.organizer_edition_payments
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  payment_row public.organizer_edition_payments;
  issued_at timestamptz := now();
  issued_year integer := extract(year from timezone('Europe/Paris', now()))::integer;
  next_sequence integer;
begin
  if p_admin_id is null
    or p_invoice_legal_snapshot is null
    or jsonb_typeof(p_invoice_legal_snapshot) <> 'object'
  then
    raise exception 'Incomplete generated invoice metadata.';
  end if;

  select * into payment_row
  from public.organizer_edition_payments
  where id = p_payment_id
  for update;

  if payment_row.id is null
    or payment_row.payment_channel <> 'bank_transfer'
    or payment_row.status <> 'paid'
  then
    raise exception 'A paid bank transfer is required.';
  end if;
  if payment_row.invoice_number is not null then
    raise exception 'This payment already has an issued invoice.';
  end if;

  perform pg_advisory_xact_lock(hashtext('organizer_invoice_' || issued_year::text));
  select coalesce(max(invoice_sequence), 0) + 1
  into next_sequence
  from public.organizer_edition_payments
  where invoice_issued_at >= make_timestamptz(issued_year, 1, 1, 0, 0, 0, 'Europe/Paris')
    and invoice_issued_at < make_timestamptz(issued_year + 1, 1, 1, 0, 0, 0, 'Europe/Paris');

  update public.organizer_edition_payments
  set invoice_number = 'PY-' || issued_year::text || '-' || lpad(next_sequence::text, 6, '0'),
      invoice_sequence = next_sequence,
      invoice_issued_at = issued_at,
      invoice_source = 'generated',
      invoice_legal_snapshot = p_invoice_legal_snapshot,
      updated_at = issued_at
  where id = payment_row.id
  returning * into payment_row;

  return payment_row;
end;
$$;


--
-- Name: FUNCTION issue_admin_organizer_invoice(p_payment_id uuid, p_admin_id uuid, p_invoice_legal_snapshot jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.issue_admin_organizer_invoice(p_payment_id uuid, p_admin_id uuid, p_invoice_legal_snapshot jsonb) IS 'Allocates a gap-free yearly invoice number under an advisory lock and stores the immutable legal snapshot before the private PDF is rendered.';


--
-- Name: normalize_product_brand(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_product_brand(raw_brand text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
declare
  cleaned text;
begin
  if raw_brand is null then
    return null;
  end if;

  cleaned := lower(trim(raw_brand));
  cleaned := replace(cleaned, chr(8217), '''');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');
  cleaned := regexp_replace(cleaned, '(^[^[:alnum:]]+|[^[:alnum:]]+$)', '', 'g');

  if cleaned = '' then
    return null;
  end if;

  case
    when cleaned in ('maurten') or cleaned like 'maurten %' then return 'Maurten';
    when cleaned in ('gu', 'gu energy', 'gu energy labs') or cleaned like 'gu %' then return 'GU';
    when cleaned in ('sis', 'science in sport', 'science-in-sport') or cleaned like 'sis %' or cleaned like 'science in sport %' then return 'SiS';
    when cleaned in ('naak') or cleaned like 'naak %' then return 'NAAK';
    when cleaned in ('precision fuel & hydration', 'precision fuel and hydration', 'precision fuel', 'precision hydration', 'pf&h', 'pfh')
      or cleaned like 'precision fuel & hydration %'
      or cleaned like 'precision fuel and hydration %'
      or cleaned like 'precision fuel %'
      or cleaned like 'precision hydration %'
      then return 'Precision Fuel & Hydration';
    when cleaned in ('tailwind', 'tailwind nutrition') or cleaned like 'tailwind %' then return 'Tailwind';
    when cleaned in ('neversecond') or cleaned like 'neversecond %' then return 'Neversecond';
    when cleaned in ('overstims', 'overstim.s') or cleaned like 'overstims %' or cleaned like 'overstim.s %' then return 'Overstims';
    when cleaned in ('powerbar') or cleaned like 'powerbar %' then return 'Powerbar';
    when cleaned in ('clif', 'clif bar') or cleaned like 'clif %' then return 'Clif';
    when cleaned in ('high5') or cleaned like 'high5 %' then return 'HIGH5';
    when cleaned in ('aptonia') or cleaned like 'aptonia %' then return 'Aptonia';
    when cleaned in ('huma', 'huma chia') or cleaned like 'huma %' then return 'Huma';
    when cleaned in ('226ers') or cleaned like '226ers %' then return '226ERS';
    when cleaned in ('skratch', 'skratch labs') or cleaned like 'skratch %' then return 'Skratch Labs';
    when cleaned in ('saltstick') or cleaned like 'saltstick %' then return 'SaltStick';
    else null;
  end case;

  if cleaned = any (
    array[
      'gel',
      'gels',
      'energy gel',
      'bar',
      'bars',
      'drink',
      'drink mix',
      'drink mixes',
      'mix',
      'mixes',
      'boisson',
      'boissons',
      'electrolyte',
      'electrolytes',
      'electrolytes mix',
      'capsule',
      'capsules',
      'chew',
      'chews',
      'food',
      'decathlon',
      'nutrition',
      'sport nutrition',
      'sports nutrition',
      'energy',
      'fuel',
      'hydration',
      'product',
      'products',
      'autre',
      'other',
      'unknown',
      'sample',
      'samples',
      'test',
      'tests',
      'demo',
      'example'
    ]
  ) then
    return null;
  end if;

  return initcap(cleaned);
end;
$_$;


--
-- Name: protect_server_managed_profile_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_server_managed_profile_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') then
    return new;
  end if;

  if (
    tg_op = 'INSERT'
    and (
      new.role is not null
      or new.trial_started_at is not null
      or new.trial_ends_at is not null
      or new.sign_in_count is distinct from 0
      or new.first_sign_in_at is not null
      or new.last_sign_in_at is not null
    )
  ) or (
    tg_op = 'UPDATE'
    and (
      new.role is distinct from old.role
      or new.trial_started_at is distinct from old.trial_started_at
      or new.trial_ends_at is distinct from old.trial_ends_at
      or new.sign_in_count is distinct from old.sign_in_count
      or new.first_sign_in_at is distinct from old.first_sign_in_at
      or new.last_sign_in_at is distinct from old.last_sign_in_at
    )
  ) then
    raise exception 'user_profiles server-managed fields cannot be changed by clients'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


--
-- Name: races; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.races (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    location text,
    distance_km numeric DEFAULT 0 NOT NULL,
    elevation_gain_m numeric,
    source_url text,
    image_url text,
    gpx_path text,
    gpx_hash text,
    is_published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_live boolean DEFAULT true NOT NULL,
    location_text text,
    trace_provider text,
    trace_id bigint,
    gpx_storage_path text,
    gpx_sha256 text,
    elevation_loss_m numeric DEFAULT 0 NOT NULL,
    min_alt_m numeric,
    max_alt_m numeric,
    start_lat numeric,
    start_lng numeric,
    bounds_min_lat numeric,
    bounds_min_lng numeric,
    bounds_max_lat numeric,
    bounds_max_lng numeric,
    thumbnail_url text,
    external_site_url text,
    notes text,
    race_date date,
    created_by uuid,
    is_public boolean DEFAULT true NOT NULL,
    has_aid_stations boolean DEFAULT false NOT NULL,
    event_id uuid,
    organizer_details jsonb,
    edition_group_id uuid NOT NULL,
    series_name text NOT NULL,
    edition_id uuid,
    racebook_is_live boolean DEFAULT false NOT NULL,
    racebook_publication_approved_at timestamp with time zone,
    racebook_publication_approved_by uuid,
    data_status text DEFAULT 'complete'::text NOT NULL,
    missing_required_fields text[] DEFAULT ARRAY[]::text[] NOT NULL,
    participation_mode text,
    racebook_preview_is_visible boolean DEFAULT true NOT NULL,
    web_catalog_is_live boolean DEFAULT false NOT NULL,
    CONSTRAINT races_complete_has_no_missing_required_fields CHECK (((data_status <> 'complete'::text) OR (cardinality(missing_required_fields) = 0))),
    CONSTRAINT races_data_status_check CHECK ((data_status = ANY (ARRAY['draft'::text, 'complete'::text]))),
    CONSTRAINT races_draft_is_hidden CHECK (((data_status <> 'draft'::text) OR ((is_live = false) AND (racebook_is_live = false)))),
    CONSTRAINT races_live_racebook_requires_preview_check CHECK (((racebook_is_live = false) OR (racebook_preview_is_visible = true))),
    CONSTRAINT races_missing_date_is_null CHECK (((NOT ('race_date'::text = ANY (missing_required_fields))) OR (race_date IS NULL))),
    CONSTRAINT races_missing_distance_uses_sentinel CHECK (((NOT ('distance_km'::text = ANY (missing_required_fields))) OR (distance_km = (0)::numeric))),
    CONSTRAINT races_missing_required_fields_check CHECK (((array_position(missing_required_fields, NULL::text) IS NULL) AND (missing_required_fields <@ ARRAY['race_date'::text, 'location'::text, 'distance_km'::text, 'source_url'::text]))),
    CONSTRAINT races_participation_mode_check CHECK (((participation_mode IS NULL) OR (participation_mode = ANY (ARRAY['solo'::text, 'relay'::text, 'solo_and_relay'::text])))),
    CONSTRAINT races_racebook_live_requires_approval CHECK (((racebook_is_live = false) OR (racebook_publication_approved_at IS NOT NULL)))
);


--
-- Name: COLUMN races.elevation_gain_m; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.races.elevation_gain_m IS 'Optional published elevation gain in metres. NULL means unknown and must never be replaced by a fabricated zero.';


--
-- Name: COLUMN races.organizer_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.races.organizer_details IS 'Organizer-managed progressive format details such as start time, finish cutoff, shuttle schedule, cutoff notes, and format notes.';


--
-- Name: COLUMN races.edition_group_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.races.edition_group_id IS 'Stable organizer format/series identifier shared by annual editions of the same race under one event.';


--
-- Name: COLUMN races.series_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.races.series_name IS 'Stable organizer format label shared by annual editions of the same race under one event.';


--
-- Name: COLUMN races.edition_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.races.edition_id IS 'Canonical yearly event edition for this format; nullable only for legacy undated rows.';


--
-- Name: COLUMN races.racebook_is_live; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.races.racebook_is_live IS 'Runner-facing Racebook visibility, independent from catalog race visibility.';


--
-- Name: COLUMN races.racebook_publication_approved_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.races.racebook_publication_approved_at IS 'Durable admin approval timestamp after which an organizer may publish or hide this Racebook.';


--
-- Name: COLUMN races.racebook_publication_approved_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.races.racebook_publication_approved_by IS 'Trusted admin who first approved this Racebook for organizer-controlled publication.';


--
-- Name: COLUMN races.data_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.races.data_status IS 'Catalog completeness marker. Complete formats require name, slug, date, location, positive distance, and a source; elevation and GPX remain optional.';


--
-- Name: COLUMN races.missing_required_fields; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.races.missing_required_fields IS 'Unknown fields from the source-backed catalog minimum: race_date, location, distance_km, or source_url. Elevation and GPX are optional.';


--
-- Name: COLUMN races.participation_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.races.participation_mode IS 'Runner-facing participation availability. Null means the organizer has not confirmed the mode for this historical format.';


--
-- Name: COLUMN races.racebook_preview_is_visible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.races.racebook_preview_is_visible IS 'Whether this format appears in the private organizer RaceBook preview. Disabling it also excludes the format from publication.';


--
-- Name: COLUMN races.web_catalog_is_live; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.races.web_catalog_is_live IS 'Whether this public course remains discoverable on the web catalog and SEO routes, independently from mobile catalog and RaceBook visibility.';


--
-- Name: publish_organizer_edition_racebooks(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.publish_organizer_edition_racebooks(p_edition_id uuid, p_actor_id uuid) RETURNS SETOF public.races
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  entitlement_tier text;
begin
  if not exists (
    select 1
    from public.race_event_editions edition_row
    where edition_row.id = p_edition_id
      and edition_row.is_visible = true
  ) then
    raise exception 'Visible event edition required.';
  end if;

  select entitlement_row.tier
  into entitlement_tier
  from public.organizer_edition_entitlements entitlement_row
  where entitlement_row.edition_id = p_edition_id
    and entitlement_row.status = 'active';

  if entitlement_tier not in ('essential', 'complete', 'signature') then
    raise exception 'RaceBook entitlement required.';
  end if;

  return query
  update public.races race_row
  set is_live = true,
      racebook_preview_is_visible = true,
      racebook_is_live = true,
      racebook_publication_approved_at = coalesce(
        race_row.racebook_publication_approved_at,
        timezone('utc', now())
      ),
      racebook_publication_approved_by = coalesce(
        race_row.racebook_publication_approved_by,
        p_actor_id
      )
  where race_row.edition_id = p_edition_id
    and race_row.racebook_preview_is_visible = true
    and race_row.is_public = true
    and coalesce(race_row.data_status, 'complete') = 'complete'
  returning race_row.*;
end;
$$;


--
-- Name: race_event_edition_branding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_event_edition_branding (
    edition_id uuid NOT NULL,
    draft_logo_url text,
    draft_primary_color text DEFAULT '#2D5016'::text NOT NULL,
    draft_accent_color text DEFAULT '#B45309'::text NOT NULL,
    published_logo_url text,
    published_primary_color text,
    published_accent_color text,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT race_event_edition_branding_draft_accent_check CHECK ((draft_accent_color ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT race_event_edition_branding_draft_logo_check CHECK (((draft_logo_url IS NULL) OR (draft_logo_url ~ '^https://'::text))),
    CONSTRAINT race_event_edition_branding_draft_primary_check CHECK ((draft_primary_color ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT race_event_edition_branding_published_accent_check CHECK (((published_accent_color IS NULL) OR (published_accent_color ~ '^#[0-9A-Fa-f]{6}$'::text))),
    CONSTRAINT race_event_edition_branding_published_logo_check CHECK (((published_logo_url IS NULL) OR (published_logo_url ~ '^https://'::text))),
    CONSTRAINT race_event_edition_branding_published_primary_check CHECK (((published_primary_color IS NULL) OR (published_primary_color ~ '^#[0-9A-Fa-f]{6}$'::text))),
    CONSTRAINT race_event_edition_branding_published_state_check CHECK ((((published_at IS NULL) AND (published_logo_url IS NULL) AND (published_primary_color IS NULL) AND (published_accent_color IS NULL)) OR ((published_at IS NOT NULL) AND (published_primary_color IS NOT NULL) AND (published_accent_color IS NOT NULL))))
);


--
-- Name: TABLE race_event_edition_branding; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.race_event_edition_branding IS 'Service-managed draft and published RaceBook branding for one canonical event edition.';


--
-- Name: COLUMN race_event_edition_branding.published_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_event_edition_branding.published_at IS 'Null until the organizer explicitly publishes the current branding draft.';


--
-- Name: publish_racebook_edition_branding(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.publish_racebook_edition_branding(p_edition_id uuid) RETURNS public.race_event_edition_branding
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  published public.race_event_edition_branding;
begin
  update public.race_event_edition_branding
  set published_logo_url = draft_logo_url,
      published_primary_color = draft_primary_color,
      published_accent_color = draft_accent_color,
      published_at = timezone('utc', now())
  where edition_id = p_edition_id
  returning * into published;

  if published.edition_id is null then
    raise exception 'RaceBook edition branding not found.';
  end if;

  return published;
end;
$$;


--
-- Name: purge_expired_rate_limit_entries(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_expired_rate_limit_entries() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  DELETE FROM public.rate_limit_entries WHERE reset_at < now();
$$;


--
-- Name: organizer_edition_entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizer_edition_entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    edition_id uuid NOT NULL,
    tier text DEFAULT 'visibility'::text NOT NULL,
    source text DEFAULT 'system'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    activated_at timestamp with time zone,
    revoked_at timestamp with time zone,
    granted_by uuid,
    CONSTRAINT organizer_edition_entitlements_activation_check CHECK ((((tier = 'visibility'::text) AND (activated_at IS NULL)) OR ((tier <> 'visibility'::text) AND (activated_at IS NOT NULL)))),
    CONSTRAINT organizer_edition_entitlements_source_check CHECK ((source = ANY (ARRAY['system'::text, 'stripe'::text, 'manual_payment'::text, 'admin'::text, 'complimentary'::text, 'legacy_admin'::text]))),
    CONSTRAINT organizer_edition_entitlements_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text]))),
    CONSTRAINT organizer_edition_entitlements_tier_check CHECK ((tier = ANY (ARRAY['visibility'::text, 'essential'::text, 'complete'::text, 'signature'::text])))
);


--
-- Name: TABLE organizer_edition_entitlements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organizer_edition_entitlements IS 'Current organizer commercial tier for one event edition. Human membership remains event-scoped.';


--
-- Name: COLUMN organizer_edition_entitlements.source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizer_edition_entitlements.source IS 'Effective publication origin: system, Stripe, bank transfer, admin operation, complimentary grant, or legacy admin grant.';


--
-- Name: recalculate_organizer_edition_entitlement(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_organizer_edition_entitlement(p_edition_id uuid) RETURNS public.organizer_edition_entitlements
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  entitlement_row public.organizer_edition_entitlements;
  next_tier text := 'visibility';
  next_channel text;
  has_essential boolean := false;
  has_complete boolean := false;
  has_signature boolean := false;
begin
  select * into entitlement_row
  from public.organizer_edition_entitlements
  where edition_id = p_edition_id
  for update;

  if entitlement_row.id is null then
    insert into public.organizer_edition_entitlements (edition_id)
    values (p_edition_id)
    returning * into entitlement_row;
  end if;

  if entitlement_row.status = 'active'
    and entitlement_row.source in ('admin', 'complimentary', 'legacy_admin') then
    return entitlement_row;
  end if;

  select exists (
    select 1 from public.organizer_edition_payments
    where edition_id = p_edition_id and status = 'paid'
      and purchase_kind = 'essential_direct'
  ) into has_essential;

  select
    exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind in ('complete_direct', 'racebook'))
    or (has_essential and exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'essential_to_complete'))
  into has_complete;

  select
    exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind in ('signature_direct', 'pro_direct'))
    or (
      exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'racebook')
      and exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'pro_upgrade')
    )
    or (has_essential and exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'essential_to_signature'))
    or (has_complete and exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'complete_to_signature'))
  into has_signature;

  next_tier := case when has_signature then 'signature' when has_complete then 'complete' when has_essential then 'essential' else 'visibility' end;

  if next_tier <> 'visibility' then
    select payment_channel into next_channel
    from public.organizer_edition_payments
    where edition_id = p_edition_id
      and status = 'paid'
      and case next_tier
        when 'essential' then to_tier = 'essential'
        when 'complete' then to_tier in ('complete', 'racebook')
        when 'signature' then to_tier in ('signature', 'pro')
        else false
      end
    order by paid_at desc nulls last, created_at desc
    limit 1;
  end if;

  update public.organizer_edition_entitlements
  set tier = next_tier,
      source = case
        when next_tier = 'visibility' then 'system'
        when next_channel = 'bank_transfer' then 'manual_payment'
        else 'stripe'
      end,
      status = 'active',
      activated_at = case when next_tier = 'visibility' then null else coalesce(activated_at, timezone('utc', now())) end,
      revoked_at = case when next_tier = 'visibility' then timezone('utc', now()) else null end,
      updated_at = timezone('utc', now()),
      granted_by = null
  where edition_id = p_edition_id
  returning * into entitlement_row;

  if next_tier = 'visibility' then
    update public.races set racebook_is_live = false
    where edition_id = p_edition_id and racebook_is_live = true;
  end if;
  return entitlement_row;
end;
$$;


--
-- Name: record_admin_organizer_bank_transfer(uuid, uuid, text, timestamp with time zone, integer, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_admin_organizer_bank_transfer(p_edition_id uuid, p_admin_id uuid, p_tier text, p_paid_at timestamp with time zone, p_amount_subtotal integer, p_amount_tax integer, p_invoice_storage_path text DEFAULT NULL::text, p_invoice_original_name text DEFAULT NULL::text) RETURNS public.organizer_edition_payments
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  current_entitlement public.organizer_edition_entitlements;
  created_payment public.organizer_edition_payments;
  replaces_manual_grant boolean := false;
begin
  if p_tier not in ('essential', 'complete', 'signature') then
    raise exception 'Invalid paid organizer edition tier.';
  end if;
  if p_paid_at is null or p_paid_at > timezone('utc', now()) + interval '1 minute' then
    raise exception 'Invalid bank transfer date.';
  end if;
  if p_amount_subtotal is null or p_amount_tax is null or p_amount_subtotal < 0 or p_amount_tax < 0
    or p_amount_subtotal::bigint + p_amount_tax::bigint > 2147483647 then
    raise exception 'Invalid bank transfer amounts.';
  end if;
  if (p_invoice_storage_path is null) <> (p_invoice_original_name is null) then
    raise exception 'Incomplete invoice metadata.';
  end if;

  select * into current_entitlement
  from public.organizer_edition_entitlements
  where edition_id = p_edition_id
  for update;

  if current_entitlement.id is null then
    insert into public.organizer_edition_entitlements (edition_id)
    values (p_edition_id)
    returning * into current_entitlement;
  end if;

  replaces_manual_grant := current_entitlement.status = 'active'
    and current_entitlement.source in ('admin', 'complimentary', 'legacy_admin');

  if not replaces_manual_grant
    and private.organizer_tier_rank(current_entitlement.tier) > private.organizer_tier_rank(p_tier) then
    raise exception 'A bank transfer cannot downgrade a paid organizer edition.';
  end if;
  if not replaces_manual_grant
    and current_entitlement.tier = p_tier
    and current_entitlement.status = 'active' then
    raise exception 'This organizer edition tier is already active.';
  end if;

  insert into public.organizer_edition_payments (
    edition_id, purchase_kind, from_tier, to_tier, status, payment_channel, recorded_by,
    amount_subtotal, amount_tax, amount_total, currency, paid_at,
    invoice_storage_path, invoice_original_name, invoice_uploaded_at, invoice_uploaded_by
  ) values (
    p_edition_id, p_tier || '_direct', 'visibility', p_tier, 'paid', 'bank_transfer', p_admin_id,
    p_amount_subtotal, p_amount_tax, p_amount_subtotal + p_amount_tax, 'eur', p_paid_at,
    p_invoice_storage_path, p_invoice_original_name,
    case when p_invoice_storage_path is null then null else timezone('utc', now()) end,
    case when p_invoice_storage_path is null then null else p_admin_id end
  ) returning * into created_payment;

  if replaces_manual_grant then
    update public.organizer_edition_entitlements
    set tier = 'visibility', source = 'system', status = 'active', activated_at = null,
        revoked_at = timezone('utc', now()), granted_by = null,
        updated_at = timezone('utc', now())
    where edition_id = p_edition_id;
  end if;

  perform public.recalculate_organizer_edition_entitlement(p_edition_id);
  return created_payment;
end;
$$;


--
-- Name: FUNCTION record_admin_organizer_bank_transfer(p_edition_id uuid, p_admin_id uuid, p_tier text, p_paid_at timestamp with time zone, p_amount_subtotal integer, p_amount_tax integer, p_invoice_storage_path text, p_invoice_original_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.record_admin_organizer_bank_transfer(p_edition_id uuid, p_admin_id uuid, p_tier text, p_paid_at timestamp with time zone, p_amount_subtotal integer, p_amount_tax integer, p_invoice_storage_path text, p_invoice_original_name text) IS 'Records a paid direct organizer offer by bank transfer and atomically recalculates its edition entitlement.';


--
-- Name: record_admin_organizer_bank_transfer_invoice(uuid, uuid, text, timestamp with time zone, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_admin_organizer_bank_transfer_invoice(p_edition_id uuid, p_admin_id uuid, p_tier text, p_paid_at timestamp with time zone, p_amount_subtotal integer, p_invoice_legal_snapshot jsonb) RETURNS public.organizer_edition_payments
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  payment_row public.organizer_edition_payments;
begin
  payment_row := public.record_admin_organizer_bank_transfer(
    p_edition_id,
    p_admin_id,
    p_tier,
    p_paid_at,
    p_amount_subtotal,
    0,
    null,
    null
  );
  return public.issue_admin_organizer_invoice(payment_row.id, p_admin_id, p_invoice_legal_snapshot);
end;
$$;


--
-- Name: FUNCTION record_admin_organizer_bank_transfer_invoice(p_edition_id uuid, p_admin_id uuid, p_tier text, p_paid_at timestamp with time zone, p_amount_subtotal integer, p_invoice_legal_snapshot jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.record_admin_organizer_bank_transfer_invoice(p_edition_id uuid, p_admin_id uuid, p_tier text, p_paid_at timestamp with time zone, p_amount_subtotal integer, p_invoice_legal_snapshot jsonb) IS 'Atomically records a VAT-exempt paid bank transfer, recalculates its entitlement, and issues its immutable invoice number and legal snapshot.';


--
-- Name: record_race_slug_redirect(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_race_slug_redirect() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
declare
  candidate_slug text;
begin
  if new.slug is null
    or new.slug <> lower(btrim(new.slug))
    or char_length(new.slug) > 160
    or new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using
      errcode = '22023',
      message = 'New race slug must contain only lowercase letters, digits, and single hyphen separators (160 characters maximum).';
  end if;

  if tg_op = 'UPDATE' then
    if new.slug is not distinct from old.slug then
      return new;
    end if;

    -- Serialize reservations for both names so concurrent inserts and renames
    -- cannot pass the redirect check between the check and the row write.
    for candidate_slug in
      select distinct slug_value
      from unnest(array[old.slug, new.slug]) as slug_values(slug_value)
      order by slug_value
    loop
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(candidate_slug, 731104)
      );
    end loop;
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.slug, 731104));
  end if;

  if exists (
    select 1
    from public.race_slug_redirects as redirect_row
    where redirect_row.old_slug = new.slug
  ) then
    raise exception using
      errcode = '23505',
      message = format('Race slug "%s" is reserved by an existing redirect.', new.slug);
  end if;

  if tg_op = 'UPDATE' then
    insert into public.race_slug_redirects (old_slug, race_id)
    values (old.slug, old.id);
  end if;

  return new;
end;
$_$;


--
-- Name: FUNCTION record_race_slug_redirect(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.record_race_slug_redirect() IS 'Invoker trigger: reserves the former slug in the same transaction as a races.slug update.';


--
-- Name: rename_race_slug(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rename_race_slug(p_race_id uuid, p_new_slug text) RETURNS TABLE(race_id uuid, old_slug text, new_slug text)
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
declare
  locked_race public.races;
  normalized_slug text := lower(btrim(p_new_slug));
begin
  if p_new_slug is null
    or normalized_slug = ''
    or char_length(normalized_slug) > 160
    or normalized_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using
      errcode = '22023',
      message = 'New race slug must contain only lowercase letters, digits, and single hyphen separators (160 characters maximum).';
  end if;

  select race_row.*
  into locked_race
  from public.races as race_row
  where race_row.id = p_race_id
  for update;

  if locked_race.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Race not found.';
  end if;

  if locked_race.slug = normalized_slug then
    return query select locked_race.id, locked_race.slug, locked_race.slug;
    return;
  end if;

  if exists (
    select 1
    from public.race_slug_redirects as redirect_row
    where redirect_row.old_slug = normalized_slug
  ) then
    raise exception using
      errcode = '23505',
      message = format('Race slug "%s" is reserved by an existing redirect.', normalized_slug);
  end if;

  update public.races
  set slug = normalized_slug
  where id = locked_race.id;

  return query select locked_race.id, locked_race.slug, normalized_slug;
end;
$_$;


--
-- Name: FUNCTION rename_race_slug(p_race_id uuid, p_new_slug text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.rename_race_slug(p_race_id uuid, p_new_slug text) IS 'Atomically renames a race and records its former slug. Service-role invocation only.';


--
-- Name: race_event_edition_sponsors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_event_edition_sponsors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    edition_id uuid NOT NULL,
    name text NOT NULL,
    logo_url text NOT NULL,
    website_url text,
    is_active boolean DEFAULT true NOT NULL,
    show_on_loading boolean DEFAULT false NOT NULL,
    show_in_banner boolean DEFAULT true NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    click_count bigint DEFAULT 0 NOT NULL,
    partnership_level text DEFAULT 'official'::text NOT NULL,
    category text,
    contextual_placement text DEFAULT 'none'::text NOT NULL,
    impression_count bigint DEFAULT 0 NOT NULL,
    CONSTRAINT race_event_edition_sponsors_active_placement_check CHECK (((NOT is_active) OR show_on_loading OR show_in_banner OR (contextual_placement <> 'none'::text))),
    CONSTRAINT race_event_edition_sponsors_category_check CHECK (((category IS NULL) OR ((category = btrim(category)) AND ((char_length(category) >= 1) AND (char_length(category) <= 60))))),
    CONSTRAINT race_event_edition_sponsors_click_count_check CHECK ((click_count >= 0)),
    CONSTRAINT race_event_edition_sponsors_contextual_placement_check CHECK ((contextual_placement = ANY (ARRAY['none'::text, 'aid_stations'::text, 'equipment'::text, 'access'::text, 'services'::text]))),
    CONSTRAINT race_event_edition_sponsors_impression_count_check CHECK ((impression_count >= 0)),
    CONSTRAINT race_event_edition_sponsors_logo_url_check CHECK ((logo_url ~* '^https?://'::text)),
    CONSTRAINT race_event_edition_sponsors_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 80))),
    CONSTRAINT race_event_edition_sponsors_partnership_level_check CHECK ((partnership_level = ANY (ARRAY['principal'::text, 'official'::text, 'service'::text]))),
    CONSTRAINT race_event_edition_sponsors_position_check CHECK ((("position" >= 0) AND ("position" <= 9))),
    CONSTRAINT race_event_edition_sponsors_website_url_check CHECK (((website_url IS NULL) OR (website_url ~* '^https?://'::text)))
);


--
-- Name: TABLE race_event_edition_sponsors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.race_event_edition_sponsors IS 'Edition-scoped sponsor presentation for the mobile Racebook. Reads and writes are mediated by service routes.';


--
-- Name: COLUMN race_event_edition_sponsors.click_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_event_edition_sponsors.click_count IS 'Aggregate redirect count only; no runner identity or impression history is stored.';


--
-- Name: COLUMN race_event_edition_sponsors.partnership_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_event_edition_sponsors.partnership_level IS 'Presentation hierarchy: principal, official, or service.';


--
-- Name: COLUMN race_event_edition_sponsors.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_event_edition_sponsors.category IS 'Optional short organizer-authored partner category shown with the sponsor.';


--
-- Name: COLUMN race_event_edition_sponsors.contextual_placement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_event_edition_sponsors.contextual_placement IS 'Optional RaceBook section where the sponsor may be presented contextually.';


--
-- Name: COLUMN race_event_edition_sponsors.impression_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_event_edition_sponsors.impression_count IS 'Aggregate count of accepted viewable presentations; no runner identity or individual history is stored.';


--
-- Name: reorder_racebook_sponsors(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reorder_racebook_sponsors(p_edition_id uuid, p_items jsonb) RETURNS SETOF public.race_event_edition_sponsors
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  locked_edition_id uuid;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Sponsor positions must be a JSON array.' using errcode = '22023';
  end if;

  select edition.id
  into locked_edition_id
  from public.race_event_editions as edition
  where edition.id = p_edition_id
  for update;

  if locked_edition_id is null then
    raise exception 'Edition not found.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid, position integer)
    group by item.id
    having item.id is null or count(*) > 1
  ) then
    raise exception 'A sponsor id may only be submitted once.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid, position integer)
    where item.position is null or item.position < 0 or item.position > 9
  ) then
    raise exception 'Sponsor positions must be between 0 and 9.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid, position integer)
    group by item.position
    having count(*) > 1
  ) then
    raise exception 'Sponsor positions must be unique.' using errcode = '23514';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) <> (
    select count(*)
    from public.race_event_edition_sponsors as sponsor
    where sponsor.edition_id = p_edition_id
  ) then
    raise exception 'The complete edition sponsor list is required for reordering.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid, position integer)
    where not exists (
      select 1
      from public.race_event_edition_sponsors as sponsor
      where sponsor.id = item.id
        and sponsor.edition_id = p_edition_id
    )
  ) then
    raise exception 'A sponsor does not belong to this edition.' using errcode = '23503';
  end if;

  update public.race_event_edition_sponsors as sponsor
  set position = item.position
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid, position integer)
  where sponsor.id = item.id
    and sponsor.edition_id = p_edition_id;

  return query
  select sponsor.*
  from public.race_event_edition_sponsors as sponsor
  where sponsor.edition_id = p_edition_id
  order by sponsor.position, sponsor.created_at, sponsor.id;
end;
$$;


--
-- Name: FUNCTION reorder_racebook_sponsors(p_edition_id uuid, p_items jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.reorder_racebook_sponsors(p_edition_id uuid, p_items jsonb) IS 'Atomically updates a validated subset of sponsor positions within one edition.';


--
-- Name: race_aid_station_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_aid_station_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    race_aid_station_id uuid NOT NULL,
    product_id uuid NOT NULL,
    notes text,
    order_index integer DEFAULT 0 NOT NULL
);


--
-- Name: replace_race_aid_station_products(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_race_aid_station_products(p_race_id uuid, p_aid_station_id uuid, p_items jsonb) RETURNS SETOF public.race_aid_station_products
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  locked_race_id uuid;
  locked_station_id uuid;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Aid station product items must be a JSON array.' using errcode = '22023';
  end if;

  select race_row.id
  into locked_race_id
  from public.races as race_row
  where race_row.id = p_race_id
  for update;

  if locked_race_id is null then
    raise exception 'Race not found.' using errcode = 'P0002';
  end if;

  select station.id
  into locked_station_id
  from public.race_aid_stations as station
  where station.id = p_aid_station_id
    and station.race_id = p_race_id
  for update;

  if locked_station_id is null then
    raise exception 'Aid station does not belong to this race.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(product_id uuid)
    group by item.product_id
    having item.product_id is null or count(*) > 1
  ) then
    raise exception 'A product may only be submitted once and must have an id.' using errcode = '22023';
  end if;

  delete from public.race_aid_station_products
  where race_aid_station_id = p_aid_station_id;

  insert into public.race_aid_station_products (
    race_aid_station_id,
    product_id,
    notes,
    order_index
  )
  select
    p_aid_station_id,
    item.product_id,
    item.notes,
    item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    product_id uuid,
    notes text,
    order_index integer
  );

  return query
  select link.*
  from public.race_aid_station_products as link
  where link.race_aid_station_id = p_aid_station_id
  order by link.order_index, link.id;
end;
$$;


--
-- Name: FUNCTION replace_race_aid_station_products(p_race_id uuid, p_aid_station_id uuid, p_items jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.replace_race_aid_station_products(p_race_id uuid, p_aid_station_id uuid, p_items jsonb) IS 'Atomically replaces the ordered product links for one aid station after validating its race.';


--
-- Name: race_aid_stations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_aid_stations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    race_id uuid NOT NULL,
    name text NOT NULL,
    km numeric NOT NULL,
    water_available boolean DEFAULT true NOT NULL,
    notes text,
    order_index integer DEFAULT 0 NOT NULL,
    needs_review boolean DEFAULT false NOT NULL,
    last_gpx_import_at timestamp with time zone,
    solid_available boolean DEFAULT true NOT NULL,
    assistance_allowed boolean DEFAULT true NOT NULL,
    organizer_details jsonb
);


--
-- Name: COLUMN race_aid_stations.needs_review; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_aid_stations.needs_review IS 'true si la station nétait pas dans le dernier import GPX mais a des plans liés — à réviser manuellement';


--
-- Name: COLUMN race_aid_stations.last_gpx_import_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_aid_stations.last_gpx_import_at IS 'Timestamp du dernier import GPX qui a créé/mis à jour cette station';


--
-- Name: COLUMN race_aid_stations.solid_available; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_aid_stations.solid_available IS 'Whether official solid food is available at this source aid station.';


--
-- Name: COLUMN race_aid_stations.assistance_allowed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_aid_stations.assistance_allowed IS 'Whether personal crew assistance is allowed at this source aid station.';


--
-- Name: COLUMN race_aid_stations.organizer_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_aid_stations.organizer_details IS 'Organizer-managed progressive aid-station details such as station type, cumulative elevation, altitude, cutoff time, drop bag availability, and organizer notes.';


--
-- Name: replace_race_aid_stations(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_race_aid_stations(p_race_id uuid, p_items jsonb) RETURNS SETOF public.race_aid_stations
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  locked_race_id uuid;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Aid station items must be a JSON array.' using errcode = '22023';
  end if;

  select race_row.id
  into locked_race_id
  from public.races as race_row
  where race_row.id = p_race_id
  for update;

  if locked_race_id is null then
    raise exception 'Race not found.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid)
    where item.id is not null
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'An aid station id may only be submitted once.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid)
    where item.id is not null
      and not exists (
        select 1
        from public.race_aid_stations as station
        where station.id = item.id
          and station.race_id = p_race_id
      )
  ) then
    raise exception 'An aid station does not belong to this race.' using errcode = '23503';
  end if;

  update public.race_aid_stations as station
  set name = item.name,
      km = item.km,
      water_available = item.water_available,
      solid_available = item.solid_available,
      assistance_allowed = item.assistance_allowed,
      notes = item.notes,
      organizer_details = item.organizer_details,
      order_index = item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    id uuid,
    name text,
    km numeric,
    water_available boolean,
    solid_available boolean,
    assistance_allowed boolean,
    notes text,
    organizer_details jsonb,
    order_index integer
  )
  where item.id is not null
    and station.id = item.id
    and station.race_id = p_race_id;

  delete from public.race_aid_stations as station
  where station.race_id = p_race_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid)
      where item.id = station.id
    );

  insert into public.race_aid_stations (
    id,
    race_id,
    name,
    km,
    water_available,
    solid_available,
    assistance_allowed,
    notes,
    organizer_details,
    order_index
  )
  select
    gen_random_uuid(),
    p_race_id,
    item.name,
    item.km,
    item.water_available,
    item.solid_available,
    item.assistance_allowed,
    item.notes,
    item.organizer_details,
    item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    id uuid,
    name text,
    km numeric,
    water_available boolean,
    solid_available boolean,
    assistance_allowed boolean,
    notes text,
    organizer_details jsonb,
    order_index integer
  )
  where item.id is null;

  return query
  select station.*
  from public.race_aid_stations as station
  where station.race_id = p_race_id
  order by station.order_index, station.km, station.id;
end;
$$;


--
-- Name: FUNCTION replace_race_aid_stations(p_race_id uuid, p_items jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.replace_race_aid_stations(p_race_id uuid, p_items jsonb) IS 'Atomically replaces one race ordered aid-station collection while preserving submitted row ids.';


--
-- Name: race_awards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_awards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    race_id uuid NOT NULL,
    category_key text NOT NULL,
    category_label text NOT NULL,
    audience text NOT NULL,
    place_from integer DEFAULT 1 NOT NULL,
    place_to integer NOT NULL,
    podium_time time without time zone NOT NULL,
    podium_location text,
    reward_note text,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT race_awards_audience_check CHECK ((audience = ANY (ARRAY['women'::text, 'men'::text, 'mixed'::text]))),
    CONSTRAINT race_awards_category_key_check CHECK ((category_key = ANY (ARRAY['scratch'::text, 'u18'::text, 'u20'::text, 'u23'::text, 'senior'::text, 'master'::text, 'custom'::text]))),
    CONSTRAINT race_awards_category_label_check CHECK ((btrim(category_label) <> ''::text)),
    CONSTRAINT race_awards_check CHECK ((place_to >= place_from)),
    CONSTRAINT race_awards_order_index_check CHECK ((order_index >= 0)),
    CONSTRAINT race_awards_place_from_check CHECK ((place_from > 0))
);


--
-- Name: TABLE race_awards; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.race_awards IS 'Runner-facing award categories, rewarded places, and podium schedule for a race format.';


--
-- Name: replace_race_awards(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_race_awards(p_race_id uuid, p_items jsonb) RETURNS SETOF public.race_awards
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  delete from public.race_awards where race_id = p_race_id;
  insert into public.race_awards (id, race_id, category_key, category_label, audience, place_from, place_to, podium_time, podium_location, reward_note, order_index)
  select coalesce(x.id, gen_random_uuid()), p_race_id, x.category_key, x.category_label, x.audience, x.place_from, x.place_to, x.podium_time, x.podium_location, x.reward_note, x.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id uuid, category_key text, category_label text, audience text, place_from integer, place_to integer, podium_time time, podium_location text, reward_note text, order_index integer);
  return query select * from public.race_awards where race_id = p_race_id order by podium_time, order_index;
end $$;


--
-- Name: race_edition_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_edition_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    edition_id uuid NOT NULL,
    service_type text NOT NULL,
    name text NOT NULL,
    description text,
    address text,
    latitude numeric,
    longitude numeric,
    google_maps_url text,
    website_url text,
    phone text,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT race_edition_services_address_check CHECK (((service_type <> ALL (ARRAY['restaurant'::text, 'accommodation'::text])) OR (NULLIF(btrim(address), ''::text) IS NOT NULL))),
    CONSTRAINT race_edition_services_coordinates_check CHECK ((((latitude IS NULL) AND (longitude IS NULL)) OR (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)) AND ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))))),
    CONSTRAINT race_edition_services_geocode_check CHECK (((service_type <> ALL (ARRAY['restaurant'::text, 'accommodation'::text])) OR ((latitude IS NOT NULL) AND (longitude IS NOT NULL)))),
    CONSTRAINT race_edition_services_name_check CHECK ((btrim(name) <> ''::text)),
    CONSTRAINT race_edition_services_order_index_check CHECK ((order_index >= 0)),
    CONSTRAINT race_edition_services_service_type_check CHECK ((service_type = ANY (ARRAY['restaurant'::text, 'accommodation'::text, 'recovery'::text, 'other'::text])))
);


--
-- Name: TABLE race_edition_services; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.race_edition_services IS 'Structured practical places shared by all formats of one event edition.';


--
-- Name: replace_race_edition_services(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_race_edition_services(p_edition_id uuid, p_items jsonb) RETURNS SETOF public.race_edition_services
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  delete from public.race_edition_services where edition_id = p_edition_id;
  insert into public.race_edition_services (id, edition_id, service_type, name, description, address, latitude, longitude, google_maps_url, website_url, phone, order_index)
  select coalesce(x.id, gen_random_uuid()), p_edition_id, x.service_type, x.name, x.description, x.address, x.latitude, x.longitude, x.google_maps_url, x.website_url, x.phone, x.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id uuid, service_type text, name text, description text, address text, latitude numeric, longitude numeric, google_maps_url text, website_url text, phone text, order_index integer);
  return query select * from public.race_edition_services where edition_id = p_edition_id order by service_type, order_index;
end $$;


--
-- Name: race_relay_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_relay_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    race_id uuid NOT NULL,
    race_aid_station_id uuid,
    name text NOT NULL,
    km numeric NOT NULL,
    handover_time text,
    cutoff_time text,
    notes text,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT race_relay_points_km_check CHECK ((km > (0)::numeric)),
    CONSTRAINT race_relay_points_name_check CHECK ((btrim(name) <> ''::text)),
    CONSTRAINT race_relay_points_order_index_check CHECK ((order_index >= 0))
);


--
-- Name: TABLE race_relay_points; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.race_relay_points IS 'Ordered relay handover points for a race. They may reference an aid station without becoming nutrition-plan aid stations.';


--
-- Name: COLUMN race_relay_points.race_aid_station_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_relay_points.race_aid_station_id IS 'Optional source aid station used as the handover location. Name and km remain copied on the relay point so deleting the station does not erase relay information.';


--
-- Name: replace_race_relay_points(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_race_relay_points(p_race_id uuid, p_items jsonb) RETURNS SETOF public.race_relay_points
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  race_distance numeric;
  race_participation_mode text;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Relay point items must be a JSON array.' using errcode = '22023';
  end if;

  select race_row.distance_km, race_row.participation_mode
  into race_distance, race_participation_mode
  from public.races as race_row
  where race_row.id = p_race_id
  for update;

  if not found then
    raise exception 'Race not found.' using errcode = 'P0002';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 0
    and race_participation_mode = 'solo' then
    raise exception 'Relay participation must be enabled before adding relay points.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid)
    where item.id is not null
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'A relay point id may only be submitted once.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid)
    where item.id is not null
      and not exists (
        select 1
        from public.race_relay_points as point
        where point.id = item.id
          and point.race_id = p_race_id
      )
  ) then
    raise exception 'A relay point does not belong to this race.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(race_aid_station_id uuid)
    where item.race_aid_station_id is not null
      and not exists (
        select 1
        from public.race_aid_stations as station
        where station.id = item.race_aid_station_id
          and station.race_id = p_race_id
      )
  ) then
    raise exception 'A relay point references an aid station from another race.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(km numeric)
    where item.km is null or item.km <= 0 or item.km >= race_distance
  ) then
    raise exception 'Every relay point must be after the start and before the finish.' using errcode = '23514';
  end if;

  update public.race_relay_points as point
  set race_aid_station_id = item.race_aid_station_id,
      name = item.name,
      km = item.km,
      handover_time = item.handover_time,
      cutoff_time = item.cutoff_time,
      notes = item.notes,
      order_index = item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    id uuid,
    race_aid_station_id uuid,
    name text,
    km numeric,
    handover_time text,
    cutoff_time text,
    notes text,
    order_index integer
  )
  where item.id is not null
    and point.id = item.id
    and point.race_id = p_race_id;

  delete from public.race_relay_points as point
  where point.race_id = p_race_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid)
      where item.id = point.id
    );

  insert into public.race_relay_points (
    id,
    race_id,
    race_aid_station_id,
    name,
    km,
    handover_time,
    cutoff_time,
    notes,
    order_index
  )
  select
    gen_random_uuid(),
    p_race_id,
    item.race_aid_station_id,
    item.name,
    item.km,
    item.handover_time,
    item.cutoff_time,
    item.notes,
    item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    id uuid,
    race_aid_station_id uuid,
    name text,
    km numeric,
    handover_time text,
    cutoff_time text,
    notes text,
    order_index integer
  )
  where item.id is null;

  return query
  select point.*
  from public.race_relay_points as point
  where point.race_id = p_race_id
  order by point.order_index, point.km, point.id;
end;
$$;


--
-- Name: FUNCTION replace_race_relay_points(p_race_id uuid, p_items jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.replace_race_relay_points(p_race_id uuid, p_items jsonb) IS 'Atomically replaces one race ordered relay-point collection while preserving submitted row ids.';


--
-- Name: race_start_waves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_start_waves (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    race_id uuid NOT NULL,
    name text NOT NULL,
    start_time time without time zone NOT NULL,
    eligibility_type text DEFAULT 'all'::text NOT NULL,
    bib_number_min integer,
    bib_number_max integer,
    finish_minutes_min integer,
    finish_minutes_max integer,
    pace_seconds_min integer,
    pace_seconds_max integer,
    eligibility_note text,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT race_start_waves_eligibility_check CHECK ((((eligibility_type = 'all'::text) AND (bib_number_min IS NULL) AND (bib_number_max IS NULL) AND (finish_minutes_min IS NULL) AND (finish_minutes_max IS NULL) AND (pace_seconds_min IS NULL) AND (pace_seconds_max IS NULL) AND (eligibility_note IS NULL)) OR ((eligibility_type = 'bib_range'::text) AND (bib_number_min >= 0) AND (bib_number_max >= bib_number_min) AND (finish_minutes_min IS NULL) AND (finish_minutes_max IS NULL) AND (pace_seconds_min IS NULL) AND (pace_seconds_max IS NULL) AND (eligibility_note IS NULL)) OR ((eligibility_type = 'estimated_finish_time'::text) AND (finish_minutes_min >= 0) AND (finish_minutes_max >= finish_minutes_min) AND (bib_number_min IS NULL) AND (bib_number_max IS NULL) AND (pace_seconds_min IS NULL) AND (pace_seconds_max IS NULL) AND (eligibility_note IS NULL)) OR ((eligibility_type = 'pace'::text) AND (pace_seconds_min > 0) AND (pace_seconds_max >= pace_seconds_min) AND (bib_number_min IS NULL) AND (bib_number_max IS NULL) AND (finish_minutes_min IS NULL) AND (finish_minutes_max IS NULL) AND (eligibility_note IS NULL)) OR ((eligibility_type = 'custom'::text) AND (NULLIF(btrim(eligibility_note), ''::text) IS NOT NULL) AND (bib_number_min IS NULL) AND (bib_number_max IS NULL) AND (finish_minutes_min IS NULL) AND (finish_minutes_max IS NULL) AND (pace_seconds_min IS NULL) AND (pace_seconds_max IS NULL)))),
    CONSTRAINT race_start_waves_eligibility_type_check CHECK ((eligibility_type = ANY (ARRAY['all'::text, 'bib_range'::text, 'estimated_finish_time'::text, 'pace'::text, 'custom'::text]))),
    CONSTRAINT race_start_waves_name_check CHECK ((btrim(name) <> ''::text)),
    CONSTRAINT race_start_waves_order_index_check CHECK ((order_index >= 0))
);


--
-- Name: TABLE race_start_waves; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.race_start_waves IS 'Ordered start corrals/waves and machine-readable eligibility criteria for a race format.';


--
-- Name: replace_race_start_waves(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_race_start_waves(p_race_id uuid, p_items jsonb) RETURNS SETOF public.race_start_waves
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  first_time time;
begin
  delete from public.race_start_waves where race_id = p_race_id;

  insert into public.race_start_waves (
    id,
    race_id,
    name,
    start_time,
    eligibility_type,
    bib_number_min,
    bib_number_max,
    finish_minutes_min,
    finish_minutes_max,
    pace_seconds_min,
    pace_seconds_max,
    eligibility_note,
    order_index
  )
  select
    coalesce(x.id, gen_random_uuid()),
    p_race_id,
    x.name,
    x.start_time,
    x.eligibility_type,
    x.bib_number_min,
    x.bib_number_max,
    x.finish_minutes_min,
    x.finish_minutes_max,
    x.pace_seconds_min,
    x.pace_seconds_max,
    x.eligibility_note,
    x.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(
    id uuid,
    name text,
    start_time time,
    eligibility_type text,
    bib_number_min integer,
    bib_number_max integer,
    finish_minutes_min integer,
    finish_minutes_max integer,
    pace_seconds_min integer,
    pace_seconds_max integer,
    eligibility_note text,
    order_index integer
  );

  select min(start_time)
  into first_time
  from public.race_start_waves
  where race_id = p_race_id;

  if first_time is not null then
    update public.races
    set organizer_details = jsonb_set(
      coalesce(organizer_details, '{}'::jsonb)
        || jsonb_build_object('schedule', coalesce(organizer_details -> 'schedule', '{}'::jsonb)),
      '{schedule,startTime}',
      to_jsonb(first_time::text),
      true
    )
    where id = p_race_id;
  end if;

  return query
  select *
  from public.race_start_waves
  where race_id = p_race_id
  order by order_index;
end;
$$;


--
-- Name: race_event_publication_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_event_publication_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id uuid NOT NULL,
    event_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    reviewer_notes text,
    race_id uuid,
    CONSTRAINT race_event_publication_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: TABLE race_event_publication_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.race_event_publication_requests IS 'Organizer requests requiring admin review before an event and its complete formats become live.';


--
-- Name: COLUMN race_event_publication_requests.race_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_event_publication_requests.race_id IS 'Exact Racebook format requested by the organizer. Nullable only for legacy event-level requests.';


--
-- Name: review_race_event_publication_request(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_race_event_publication_request(p_request_id uuid, p_reviewer_id uuid, p_status text, p_reviewer_notes text DEFAULT NULL::text) RETURNS public.race_event_publication_requests
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  publication_request public.race_event_publication_requests;
  reviewed_request public.race_event_publication_requests;
  current_edition_id uuid;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid publication review status.';
  end if;

  select * into publication_request
  from public.race_event_publication_requests
  where id = p_request_id
  for update;

  if publication_request.id is null then
    raise exception 'Publication request not found.';
  end if;
  if publication_request.status <> 'pending' then
    raise exception 'Publication request has already been reviewed.';
  end if;

  if p_status = 'approved' then
    if not exists (
      select 1
      from public.race_events event_row
      where event_row.id = publication_request.event_id
        and nullif(btrim(event_row.name), '') is not null
        and nullif(btrim(coalesce(event_row.location, '')), '') is not null
    ) then
      raise exception 'Event publication fields are incomplete.';
    end if;

    if publication_request.race_id is not null then
      if not exists (
        select 1
        from public.races race_row
        join public.race_event_editions edition_row
          on edition_row.id = race_row.edition_id
         and edition_row.event_id = publication_request.event_id
         and edition_row.end_date >= edition_row.start_date
        where race_row.id = publication_request.race_id
          and race_row.event_id = publication_request.event_id
          and nullif(btrim(race_row.name), '') is not null
          and race_row.distance_km > 0
          and race_row.elevation_gain_m >= 0
      ) then
        raise exception 'Requested format publication fields are incomplete.';
      end if;

      update public.races
      set is_live = true,
          racebook_is_live = true,
          racebook_publication_approved_at = coalesce(racebook_publication_approved_at, timezone('utc', now())),
          racebook_publication_approved_by = coalesce(racebook_publication_approved_by, p_reviewer_id)
      where id = publication_request.race_id
        and event_id = publication_request.event_id;
    else
      select edition_row.id into current_edition_id
      from public.race_event_editions edition_row
      where edition_row.event_id = publication_request.event_id
        and edition_row.is_current
        and edition_row.end_date >= edition_row.start_date
      limit 1;

      if current_edition_id is null or not exists (
        select 1
        from public.races race_row
        where race_row.edition_id = current_edition_id
          and nullif(btrim(race_row.name), '') is not null
          and race_row.distance_km > 0
          and race_row.elevation_gain_m >= 0
      ) then
        raise exception 'No publishable format exists for the current edition.';
      end if;

      update public.races
      set is_live = true,
          racebook_is_live = true,
          racebook_publication_approved_at = coalesce(racebook_publication_approved_at, timezone('utc', now())),
          racebook_publication_approved_by = coalesce(racebook_publication_approved_by, p_reviewer_id)
      where edition_id = current_edition_id
        and nullif(btrim(name), '') is not null
        and distance_km > 0
        and elevation_gain_m >= 0;
    end if;

    update public.race_events
    set is_live = true
    where id = publication_request.event_id;
  end if;

  update public.race_event_publication_requests
  set status = p_status,
      reviewed_by = p_reviewer_id,
      reviewed_at = timezone('utc', now()),
      reviewer_notes = nullif(btrim(coalesce(p_reviewer_notes, '')), '')
  where id = p_request_id
  returning * into reviewed_request;

  return reviewed_request;
end;
$$;


--
-- Name: organizer_edition_capability_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizer_edition_capability_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    edition_id uuid NOT NULL,
    capability_key text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid,
    granted_at timestamp with time zone,
    revoked_by uuid,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT organizer_edition_capability_grants_capability_key_check CHECK ((capability_key = 'racebook_analytics.view'::text)),
    CONSTRAINT organizer_edition_capability_grants_lifecycle_check CHECK ((((status = 'active'::text) AND (granted_at IS NOT NULL) AND (revoked_by IS NULL) AND (revoked_at IS NULL)) OR ((status = 'revoked'::text) AND (revoked_at IS NOT NULL)))),
    CONSTRAINT organizer_edition_capability_grants_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text])))
);


--
-- Name: TABLE organizer_edition_capability_grants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organizer_edition_capability_grants IS 'Service-only edition-scoped complimentary module grants that supplement, but never replace, the commercial tier.';


--
-- Name: COLUMN organizer_edition_capability_grants.capability_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizer_edition_capability_grants.capability_key IS 'Stable application capability identifier. Only explicitly supported complimentary modules are accepted.';


--
-- Name: set_admin_organizer_edition_capability_grant(uuid, uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_admin_organizer_edition_capability_grant(p_edition_id uuid, p_admin_id uuid, p_capability_key text, p_enabled boolean) RETURNS public.organizer_edition_capability_grants
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  grant_row public.organizer_edition_capability_grants;
  changed_at timestamptz := timezone('utc', now());
begin
  if p_capability_key is distinct from 'racebook_analytics.view' then
    raise exception 'Invalid organizer edition capability.' using errcode = '22023';
  end if;

  if p_enabled is null then
    raise exception 'Capability enabled state is required.' using errcode = '22023';
  end if;

  if p_admin_id is null then
    raise exception 'Administrator attribution is required.' using errcode = '22023';
  end if;

  select *
  into grant_row
  from public.organizer_edition_capability_grants
  where edition_id = p_edition_id
    and capability_key = p_capability_key
  for update;

  -- Repeated requests must not rewrite the administrator or timestamp that
  -- actually performed the transition. Revoking a capability that has never
  -- been granted is likewise a no-op, rather than a fabricated audit event.
  if found and grant_row.status = (case when p_enabled then 'active' else 'revoked' end) then
    return grant_row;
  end if;

  if not found and not p_enabled then
    return null;
  end if;

  insert into public.organizer_edition_capability_grants (
    edition_id,
    capability_key,
    status,
    granted_by,
    granted_at,
    revoked_by,
    revoked_at,
    updated_at
  ) values (
    p_edition_id,
    p_capability_key,
    case when p_enabled then 'active' else 'revoked' end,
    case when p_enabled then p_admin_id else null end,
    case when p_enabled then changed_at else null end,
    case when p_enabled then null else p_admin_id end,
    case when p_enabled then null else changed_at end,
    changed_at
  )
  on conflict (edition_id, capability_key) do update set
    status = excluded.status,
    granted_by = case
      when excluded.status = 'active' then excluded.granted_by
      else public.organizer_edition_capability_grants.granted_by
    end,
    granted_at = case
      when excluded.status = 'active' then excluded.granted_at
      else public.organizer_edition_capability_grants.granted_at
    end,
    revoked_by = excluded.revoked_by,
    revoked_at = excluded.revoked_at,
    updated_at = excluded.updated_at
  where public.organizer_edition_capability_grants.status is distinct from excluded.status
  returning * into grant_row;

  return grant_row;
end;
$$;


--
-- Name: FUNCTION set_admin_organizer_edition_capability_grant(p_edition_id uuid, p_admin_id uuid, p_capability_key text, p_enabled boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_admin_organizer_edition_capability_grant(p_edition_id uuid, p_admin_id uuid, p_capability_key text, p_enabled boolean) IS 'Activates or revokes a supported complimentary edition capability while retaining grant/revoke attribution.';


--
-- Name: set_admin_organizer_edition_entitlement(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_admin_organizer_edition_entitlement(p_edition_id uuid, p_admin_id uuid, p_tier text) RETURNS public.organizer_edition_entitlements
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare updated_entitlement public.organizer_edition_entitlements;
begin
  if p_tier not in ('visibility', 'essential', 'complete', 'signature') then raise exception 'Invalid organizer edition tier.'; end if;
  insert into public.organizer_edition_entitlements (edition_id, tier, source, status, activated_at, revoked_at, granted_by)
  values (
    p_edition_id, p_tier, 'admin', 'active',
    case when p_tier = 'visibility' then null else timezone('utc', now()) end,
    case when p_tier = 'visibility' then timezone('utc', now()) else null end,
    p_admin_id
  )
  on conflict (edition_id) do update set
    tier = excluded.tier, source = excluded.source, status = 'active',
    activated_at = excluded.activated_at, revoked_at = excluded.revoked_at,
    granted_by = excluded.granted_by, updated_at = timezone('utc', now())
  returning * into updated_entitlement;
  if p_tier = 'visibility' then
    update public.races set racebook_is_live = false where edition_id = p_edition_id and racebook_is_live = true;
  end if;
  return updated_entitlement;
end;
$$;


--
-- Name: set_admin_organizer_edition_grant(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_admin_organizer_edition_grant(p_edition_id uuid, p_admin_id uuid, p_tier text, p_origin text) RETURNS public.organizer_edition_entitlements
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  entitlement_row public.organizer_edition_entitlements;
begin
  if p_tier not in ('visibility', 'essential', 'complete', 'signature') then
    raise exception 'Invalid organizer edition tier.';
  end if;
  if p_origin not in ('admin', 'complimentary', 'stripe', 'manual_payment') then
    raise exception 'Invalid organizer edition grant origin.';
  end if;

  if p_tier = 'visibility' then
    insert into public.organizer_edition_entitlements (edition_id, tier, source, status, activated_at, revoked_at, granted_by)
    values (p_edition_id, 'visibility', 'system', 'active', null, timezone('utc', now()), p_admin_id)
    on conflict (edition_id) do update set
      tier = 'visibility', source = 'system', status = 'active', activated_at = null,
      revoked_at = timezone('utc', now()), granted_by = p_admin_id,
      updated_at = timezone('utc', now())
    returning * into entitlement_row;

    update public.races set racebook_is_live = false
    where edition_id = p_edition_id and racebook_is_live = true;
    return entitlement_row;
  end if;

  if p_origin in ('admin', 'complimentary') then
    insert into public.organizer_edition_entitlements (edition_id, tier, source, status, activated_at, revoked_at, granted_by)
    values (p_edition_id, p_tier, p_origin, 'active', timezone('utc', now()), null, p_admin_id)
    on conflict (edition_id) do update set
      tier = excluded.tier, source = excluded.source, status = 'active',
      activated_at = excluded.activated_at, revoked_at = null,
      granted_by = excluded.granted_by, updated_at = timezone('utc', now())
    returning * into entitlement_row;
    return entitlement_row;
  end if;

  insert into public.organizer_edition_entitlements (edition_id)
  values (p_edition_id)
  on conflict (edition_id) do update set
    source = 'system', tier = 'visibility', status = 'active', activated_at = null,
    revoked_at = timezone('utc', now()), granted_by = null,
    updated_at = timezone('utc', now());

  entitlement_row := public.recalculate_organizer_edition_entitlement(p_edition_id);
  if entitlement_row.tier <> p_tier or entitlement_row.source <> p_origin then
    raise exception 'No matching paid organizer transaction exists for this tier and origin.';
  end if;
  return entitlement_row;
end;
$$;


--
-- Name: FUNCTION set_admin_organizer_edition_grant(p_edition_id uuid, p_admin_id uuid, p_tier text, p_origin text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_admin_organizer_edition_grant(p_edition_id uuid, p_admin_id uuid, p_tier text, p_origin text) IS 'Lets a trusted admin set an operational or complimentary grant, or restore a ledger-backed Stripe/bank-transfer entitlement.';


--
-- Name: set_affiliate_offers_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_affiliate_offers_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN new.updated_at = timezone('utc', now()); RETURN new; END; $$;


--
-- Name: set_organizer_import_sessions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_organizer_import_sessions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_organizer_racebook_visibility(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_organizer_racebook_visibility(p_user_id uuid, p_race_id uuid, p_is_live boolean) RETURNS public.races
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  race_row public.races;
  entitlement_tier text;
  updated_race public.races;
begin
  select *
  into race_row
  from public.races
  where id = p_race_id
  for update;

  if race_row.id is null then
    raise exception 'Race not found.';
  end if;

  if not exists (
    select 1
    from public.race_event_organizers organizer_row
    where organizer_row.event_id = race_row.event_id
      and organizer_row.user_id = p_user_id
      and organizer_row.revoked_at is null
  ) and not private.user_has_trusted_admin_role(p_user_id) then
    raise exception 'Organizer access required.';
  end if;

  if p_is_live then
    if coalesce(race_row.data_status, 'complete') = 'draft' then
      raise exception 'Race format is incomplete.';
    end if;

    if race_row.edition_id is null then
      raise exception 'Race edition is required.';
    end if;

    if not exists (
      select 1
      from public.race_event_editions edition_row
      where edition_row.id = race_row.edition_id
        and edition_row.is_visible
    ) then
      raise exception 'Race edition is hidden.';
    end if;

    select entitlement_row.tier
    into entitlement_tier
    from public.organizer_edition_entitlements entitlement_row
    where entitlement_row.edition_id = race_row.edition_id
      and entitlement_row.status = 'active';

    if entitlement_tier is null or entitlement_tier not in ('essential', 'complete', 'signature') then
      raise exception 'RaceBook entitlement required.';
    end if;
  end if;

  update public.races
  set is_live = p_is_live,
      racebook_preview_is_visible = true,
      racebook_is_live = p_is_live,
      racebook_publication_approved_at = case
        when p_is_live then coalesce(racebook_publication_approved_at, timezone('utc', now()))
        else racebook_publication_approved_at
      end,
      racebook_publication_approved_by = case
        when p_is_live then coalesce(racebook_publication_approved_by, p_user_id)
        else racebook_publication_approved_by
      end
  where id = p_race_id
  returning * into updated_race;

  return updated_race;
end;
$$;


--
-- Name: set_plan_share_links_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_plan_share_links_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_premium_grants_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_premium_grants_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN new.updated_at = timezone('utc', now()); RETURN new; END; $$;


--
-- Name: set_product_brand(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_product_brand() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.brand := public.normalize_product_brand(
    coalesce(
      nullif(new.brand, ''),
      public.infer_product_brand(new.name, new.slug)
    )
  );
  return new;
end;
$$;


--
-- Name: set_products_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_products_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN new.updated_at = timezone('utc', now()); RETURN new; END; $$;


--
-- Name: set_push_devices_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_push_devices_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_race_aid_station_products_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_race_aid_station_products_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_race_catalog_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_race_catalog_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN new.updated_at = timezone('utc', now()); RETURN new; END; $$;


--
-- Name: set_race_event_claims_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_race_event_claims_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_race_event_edition_branding_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_race_event_edition_branding_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_race_event_edition_requests_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_race_event_edition_requests_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_race_event_edition_sponsors_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_race_event_edition_sponsors_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_race_event_editions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_race_event_editions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_race_event_publication_requests_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_race_event_publication_requests_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_race_event_racebook_visibility(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_race_event_racebook_visibility(p_event_id uuid, p_reviewer_id uuid, p_is_live boolean) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  current_edition_id uuid;
  changed_count integer := 0;
begin
  if p_is_live then
    select edition_row.id into current_edition_id
    from public.race_event_editions edition_row
    where edition_row.event_id = p_event_id
      and edition_row.is_current
      and edition_row.end_date >= edition_row.start_date
    limit 1;

    if current_edition_id is null or not exists (
      select 1
      from public.race_events event_row
      where event_row.id = p_event_id
        and nullif(btrim(event_row.name), '') is not null
        and nullif(btrim(coalesce(event_row.location, '')), '') is not null
    ) then
      raise exception 'Event publication fields are incomplete.';
    end if;

    update public.races
    set is_live = true,
        racebook_is_live = true,
        racebook_publication_approved_at = coalesce(racebook_publication_approved_at, timezone('utc', now())),
        racebook_publication_approved_by = coalesce(racebook_publication_approved_by, p_reviewer_id)
    where edition_id = current_edition_id
      and nullif(btrim(name), '') is not null
      and distance_km > 0
      and elevation_gain_m >= 0;
    get diagnostics changed_count = row_count;

    if changed_count = 0 then
      raise exception 'No publishable format exists for the current edition.';
    end if;

    update public.race_events
    set is_live = true
    where id = p_event_id;

    update public.race_event_publication_requests request_row
    set status = 'approved',
        reviewed_by = p_reviewer_id,
        reviewed_at = timezone('utc', now()),
        reviewer_notes = coalesce(request_row.reviewer_notes, 'Publication validée depuis le contrôle admin des Racebooks.')
    where request_row.event_id = p_event_id
      and request_row.status = 'pending'
      and (
        request_row.race_id is null
        or exists (
          select 1
          from public.races race_row
          where race_row.id = request_row.race_id
            and race_row.edition_id = current_edition_id
            and race_row.racebook_publication_approved_at is not null
        )
      );
  else
    update public.races
    set racebook_is_live = false
    where event_id = p_event_id
      and racebook_is_live = true;
    get diagnostics changed_count = row_count;
  end if;

  return changed_count;
end;
$$;


--
-- Name: set_race_plans_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_race_plans_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN new.updated_at = timezone('utc', now()); RETURN new; END; $$;


--
-- Name: set_races_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_races_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN new.updated_at = timezone('utc', now()); RETURN new; END; $$;


--
-- Name: set_structured_racebook_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_structured_racebook_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin new.updated_at = timezone('utc', now()); return new; end;
$$;


--
-- Name: set_subscriptions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_subscriptions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN new.updated_at = timezone('utc', now()); RETURN new; END; $$;


--
-- Name: set_user_profiles_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_profiles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN new.updated_at = timezone('utc', now()); RETURN new; END; $$;


--
-- Name: sync_current_race_event_edition_dates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_current_race_event_edition_dates() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.is_current then
    update public.race_events
    set race_date = new.start_date,
        organizer_details = coalesce(organizer_details, '{}'::jsonb)
          || jsonb_build_object(
            'dateRange',
            coalesce(organizer_details -> 'dateRange', '{}'::jsonb)
              || jsonb_build_object('endDate', new.end_date::text)
          )
    where id = new.event_id;
  end if;
  return new;
end;
$$;


--
-- Name: sync_race_event_edition_visibility(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_race_event_edition_visibility() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.is_visible is not distinct from old.is_visible then
    return new;
  end if;

  if not new.is_visible then
    update public.races
    set is_live = false,
        racebook_is_live = false
    where edition_id = new.id;
  end if;

  return new;
end;
$$;


--
-- Name: sync_race_has_aid_stations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_race_has_aid_stations() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.races SET has_aid_stations = true WHERE id = NEW.race_id;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE public.races
    SET has_aid_stations = EXISTS (
      SELECT 1 FROM public.race_aid_stations WHERE race_id = OLD.race_id
    )
    WHERE id = OLD.race_id;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: sync_race_web_catalog_visibility(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_race_web_catalog_visibility() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if not new.is_public then
    new.web_catalog_is_live := false;
  elsif new.is_live then
    new.web_catalog_is_live := true;
  elsif tg_op = 'UPDATE' then
    new.web_catalog_is_live := old.web_catalog_is_live;
  end if;

  return new;
end;
$$;


--
-- Name: FUNCTION sync_race_web_catalog_visibility(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sync_race_web_catalog_visibility() IS 'Promotes public mobile courses to the durable web catalog without letting later mobile hiding remove their web pages.';


--
-- Name: validate_organizer_import_session_scope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_organizer_import_session_scope() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if not exists (
    select 1
    from public.race_event_editions as edition_row
    where edition_row.id = new.edition_id
      and edition_row.event_id = new.event_id
  ) then
    raise exception 'Organizer import session edition must belong to its event.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;


--
-- Name: validate_organizer_racebook_module_setting(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_organizer_racebook_module_setting() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.race_id is not null and not exists (
    select 1 from public.races race_row
    where race_row.id = new.race_id and race_row.edition_id = new.edition_id
  ) then
    raise exception 'Race does not belong to the selected edition.';
  end if;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;


--
-- Name: validate_race_edition_membership(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_race_edition_membership() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  edition_event_id uuid;
  edition_start_date date;
  edition_end_date date;
begin
  if new.edition_id is null then
    return new;
  end if;

  select event_id, start_date, end_date
  into edition_event_id, edition_start_date, edition_end_date
  from public.race_event_editions
  where id = new.edition_id;

  if edition_event_id is null or new.event_id is distinct from edition_event_id then
    raise exception 'Race and edition must belong to the same event.';
  end if;
  if new.race_date is not null
    and (new.race_date::date < edition_start_date or new.race_date::date > edition_end_date) then
    raise exception 'Race date must be inside its edition date range.';
  end if;
  return new;
end;
$$;


--
-- Name: validate_race_event_edition_range(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_race_event_edition_range() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if exists (
    select 1
    from public.races r
    where r.edition_id = new.id
      and r.race_date is not null
      and (r.race_date::date < new.start_date or r.race_date::date > new.end_date)
  ) then
    raise exception 'Edition date range excludes an attached format.';
  end if;
  return new;
end;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
    -- Regclass of the table e.g. public.notes
    entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

    -- I, U, D, T: insert, update ...
    action realtime.action = (
        case wal ->> 'action'
            when 'I' then 'INSERT'
            when 'U' then 'UPDATE'
            when 'D' then 'DELETE'
            else 'ERROR'
        end
    );

    -- Is row level security enabled for the table
    is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

    subscriptions realtime.subscription[] = array_agg(subs)
        from
            realtime.subscription subs
        where
            subs.entity = entity_
            -- Filter by action early - only get subscriptions interested in this action
            -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
            and (subs.action_filter = '*' or subs.action_filter = action::text);

    -- Subscription vars
    working_role regrole;
    working_selected_columns text[];
    claimed_role regrole;
    claims jsonb;

    subscription_id uuid;
    subscription_has_access bool;
    visible_to_subscription_ids uuid[] = '{}';

    -- structured info for wal's columns
    columns realtime.wal_column[];
    -- previous identity values for update/delete
    old_columns realtime.wal_column[];

    error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

    -- Primary jsonb output for record
    output jsonb;

    -- Loop record for iterating unique roles (outer loop)
    role_record record;
    -- Loop record for iterating unique selected_columns within a role (inner loop)
    cols_record record;
    -- Subscription ids visible at the role level (before fanning out by selected_columns)
    visible_role_sub_ids uuid[] = '{}';

begin
    perform set_config('role', null, true);

    columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'columns') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    old_columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'identity') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    for role_record in
        select claims_role
        from (select distinct claims_role from unnest(subscriptions)) t
        order by claims_role::text
    loop
        working_role := role_record.claims_role;

        -- Update `is_selectable` for columns and old_columns (once per role)
        columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(columns) c;

        old_columns =
                array_agg(
                    (
                        c.name,
                        c.type_name,
                        c.type_oid,
                        c.value,
                        c.is_pkey,
                        pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                    )::realtime.wal_column
                )
                from
                    unnest(old_columns) c;

        if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
            -- Fan out 400 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 400: Bad Request, no primary key']
                )::realtime.wal_rls;
            end loop;

        -- The claims role does not have SELECT permission to the primary key of entity
        elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
            -- Fan out 401 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 401: Unauthorized']
                )::realtime.wal_rls;
            end loop;

        else
            -- Create the prepared statement (once per role)
            if is_rls_enabled and action <> 'DELETE' then
                if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                    deallocate walrus_rls_stmt;
                end if;
                execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
            end if;

            -- Collect all visible subscription IDs for this role (filter check + RLS check)
            visible_role_sub_ids = '{}';

            for subscription_id, claims in (
                    select
                        subs.subscription_id,
                        subs.claims
                    from
                        unnest(subscriptions) subs
                    where
                        subs.entity = entity_
                        and subs.claims_role = working_role
                        and (
                            realtime.is_visible_through_filters(columns, subs.filters)
                            or (
                              action = 'DELETE'
                              and realtime.is_visible_through_filters(old_columns, subs.filters)
                            )
                        )
            ) loop

                if not is_rls_enabled or action = 'DELETE' then
                    visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                else
                    -- Check if RLS allows the role to see the record
                    perform
                        -- Trim leading and trailing quotes from working_role because set_config
                        -- doesn't recognize the role as valid if they are included
                        set_config('role', trim(both '"' from working_role::text), true),
                        set_config('request.jwt.claims', claims::text, true);

                    execute 'execute walrus_rls_stmt' into subscription_has_access;

                    -- Reset the role on every FOR..LOOP batch execution.
                    -- The first batch of 10 rows is pre-fetched using the current connection role (PG internal behaviour)
                    -- then we have to reset it again otherwise it would use the role defined in the `set_config` above
                    -- to fetch the remaining rows when rows>10, which could be a user-defined role that lacks execution grants.
                    -- The flow is:
                    --   1. run batch with conn role
                    --   2. set_config working_role
                    --   3. execute walrus
                    --   4. reset role (revert)
                    --   5. repeat
                    perform set_config('role', null, true);

                    if subscription_has_access then
                        visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                    end if;
                end if;
            end loop;

            perform set_config('role', null, true);

            -- Inner loop: per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;

                output = jsonb_build_object(
                    'schema', wal ->> 'schema',
                    'table', wal ->> 'table',
                    'type', action,
                    'commit_timestamp', to_char(
                        ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                    ),
                    'columns', (
                        select
                            jsonb_agg(
                                jsonb_build_object(
                                    'name', pa.attname,
                                    'type', pt.typname
                                )
                                order by pa.attnum asc
                            )
                        from
                            pg_attribute pa
                            join pg_type pt
                                on pa.atttypid = pt.oid
                            left join (
                                select unnest(conkey) as pkey_attnum
                                from pg_constraint
                                where conrelid = entity_ and contype = 'p'
                            ) pk on pk.pkey_attnum = pa.attnum
                        where
                            attrelid = entity_
                            and attnum > 0
                            and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
                            and (working_selected_columns is null or pa.attname = any(working_selected_columns) or pk.pkey_attnum is not null)
                    )
                )
                -- Add "record" key for insert and update
                || case
                    when action in ('INSERT', 'UPDATE') then
                        jsonb_build_object(
                            'record',
                            (
                                select
                                    jsonb_object_agg(
                                        -- if unchanged toast, get column name and value from old record
                                        coalesce((c).name, (oc).name),
                                        case
                                            when (c).name is null then (oc).value
                                            else (c).value
                                        end
                                    )
                                from
                                    unnest(columns) c
                                    full outer join unnest(old_columns) oc
                                        on (c).name = (oc).name
                                where
                                    coalesce((c).is_selectable, (oc).is_selectable)
                                    and (working_selected_columns is null or coalesce((c).name, (oc).name) = any(working_selected_columns) or coalesce((c).is_pkey, (oc).is_pkey))
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            )
                        )
                    else '{}'::jsonb
                end
                -- Add "old_record" key for update and delete
                || case
                    when action = 'UPDATE' then
                        jsonb_build_object(
                                'old_record',
                                (
                                    select jsonb_object_agg((c).name, (c).value)
                                    from unnest(old_columns) c
                                    where
                                        (c).is_selectable
                                        and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                        and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                )
                            )
                    when action = 'DELETE' then
                        jsonb_build_object(
                            'old_record',
                            (
                                select jsonb_object_agg((c).name, (c).value)
                                from unnest(old_columns) c
                                where
                                    (c).is_selectable
                                    and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                    and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                            )
                        )
                    else '{}'::jsonb
                end;

                -- Filter visible_role_sub_ids to those matching the current selected_columns group
                visible_to_subscription_ids = coalesce(
                    (
                        select array_agg(s.subscription_id)
                        from unnest(subscriptions) s
                        where s.claims_role = working_role
                          and (s.selected_columns is not distinct from working_selected_columns)
                          and s.subscription_id = any(visible_role_sub_ids)
                    ),
                    '{}'::uuid[]
                );

                return next (
                    output,
                    is_rls_enabled,
                    visible_to_subscription_ids,
                    case
                        when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                        else '{}'
                    end
                )::realtime.wal_rls;
            end loop;

        end if;
    end loop;

    perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
/*
Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
*/
declare
    op_symbol text = (
        case
            when op = 'eq' then '='
            when op = 'neq' then '!='
            when op = 'lt' then '<'
            when op = 'lte' then '<='
            when op = 'gt' then '>'
            when op = 'gte' then '>='
            when op = 'in' then '= any'
            else 'UNKNOWN OP'
        end
    );
    res boolean;
begin
    execute format(
        'select %L::'|| type_::text || ' ' || op_symbol
        || ' ( %L::'
        || (
            case
                when op = 'in' then type_::text || '[]'
                else type_::text end
        )
        || ')', val_1, val_2) into res;
    return res;
end;
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
declare
    op_symbol text;
    res boolean;
begin
    -- IS DISTINCT FROM / IS NOT DISTINCT FROM: infix, both sides typed literals
    if op = 'isdistinct' then
        execute format(
            'select %L::%s %s %L::%s',
            val_1,
            type_::text,
            case when negate then 'IS NOT DISTINCT FROM' else 'IS DISTINCT FROM' end,
            val_2,
            type_::text
        ) into res;
        return res;
    end if;

    -- IS requires a keyword RHS (NULL, TRUE, FALSE, UNKNOWN), not a typed literal
    if op = 'is' then
        if val_2 not in ('null', 'true', 'false', 'unknown') then
            raise exception 'invalid value for is filter: must be null, true, false, or unknown';
        end if;
        execute format(
            'select %L::%s %s %s',
            val_1,
            type_::text,
            case when negate then 'IS NOT' else 'IS' end,
            upper(val_2)
        ) into res;
        return res;
    end if;

    op_symbol = case
        when op = 'eq'    then '='
        when op = 'neq'   then '!='
        when op = 'lt'    then '<'
        when op = 'lte'   then '<='
        when op = 'gt'    then '>'
        when op = 'gte'   then '>='
        when op = 'in'    then '= any'
        when op = 'like'   then 'LIKE'
        when op = 'ilike'  then 'ILIKE'
        when op = 'match'  then '~'
        when op = 'imatch' then '~*'
        else null
    end;

    if op_symbol is null then
        raise exception 'unsupported equality operator: %', op::text;
    end if;

    execute format(
        'select %L::%s %s (%L::%s)',
        val_1,
        type_::text,
        op_symbol,
        val_2,
        case when op = 'in' then type_::text || '[]' else type_::text end
    ) into res;

    return case when negate then not res else res end;
end;
$$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select
        filters is null
        or array_length(filters, 1) is null
        or coalesce(
            count(col.name) = count(1)
            and sum(
                realtime.check_equality_op(
                    op:=f.op,
                    type_:=coalesce(col.type_oid::regtype, col.type_name::regtype),
                    val_1:=col.value #>> '{}',
                    val_2:=f.value,
                    negate:=coalesce(f.negate, false)
                )::int
            ) filter (where col.name is not null) = count(col.name),
            false
        )
    from
        unnest(filters) f
        left join unnest(columns) col
            on f.column_name = col.name;
$$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS TABLE(wal jsonb, is_rls_enabled boolean, subscription_ids uuid[], errors text[], slot_changes_count bigint)
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
  WITH pub AS (
    SELECT
      concat_ws(
        ',',
        CASE WHEN bool_or(pubinsert) THEN 'insert' ELSE NULL END,
        CASE WHEN bool_or(pubupdate) THEN 'update' ELSE NULL END,
        CASE WHEN bool_or(pubdelete) THEN 'delete' ELSE NULL END
      ) AS w2j_actions,
      coalesce(
        string_agg(
          realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
          ','
        ) filter (WHERE ppt.tablename IS NOT NULL),
        ''
      ) AS w2j_add_tables
    FROM pg_publication pp
    LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE pp.pubname = publication
    GROUP BY pp.pubname
    LIMIT 1
  ),
  -- MATERIALIZED ensures pg_logical_slot_get_changes is called exactly once
  w2j AS MATERIALIZED (
    SELECT x.*, pub.w2j_add_tables
    FROM pub,
         pg_logical_slot_get_changes(
           slot_name, null, max_changes,
           'include-pk', 'true',
           'include-transaction', 'false',
           'include-timestamp', 'true',
           'include-type-oids', 'true',
           'format-version', '2',
           'actions', pub.w2j_actions,
           'add-tables', pub.w2j_add_tables
         ) x
  ),
  slot_count AS (
    SELECT count(*)::bigint AS cnt
    FROM w2j
    WHERE w2j.w2j_add_tables <> ''
  ),
  rls_filtered AS (
    SELECT xyz.wal, xyz.is_rls_enabled, xyz.subscription_ids, xyz.errors
    FROM w2j,
         realtime.apply_rls(
           wal := w2j.data::jsonb,
           max_record_bytes := max_record_bytes
         ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    WHERE w2j.w2j_add_tables <> ''
      AND xyz.subscription_ids[1] IS NOT NULL
  )
  SELECT rf.wal, rf.is_rls_enabled, rf.subscription_ids, rf.errors, sc.cnt
  FROM rls_filtered rf, slot_count sc

  UNION ALL

  SELECT null, null, null, null, sc.cnt
  FROM slot_count sc
  WHERE NOT EXISTS (SELECT 1 FROM rls_filtered)
$$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  SELECT
    realtime.wal2json_escape_identifier(nsp.nspname::text)
    || '.'
    || realtime.wal2json_escape_identifier(pc.relname::text)
  FROM pg_class pc
  JOIN pg_namespace nsp ON pc.relnamespace = nsp.oid
  WHERE pc.oid = entity
$$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: send_binary(bytea, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, binary_payload, event, topic, private, extension)
    VALUES (generated_id, payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
    col_names text[] = coalesce(
            array_agg(a.attname order by a.attnum),
            '{}'::text[]
        )
        from
            pg_catalog.pg_attribute a
        where
            a.attrelid = new.entity
            and a.attnum > 0
            and not a.attisdropped
            and pg_catalog.has_column_privilege(
                (new.claims ->> 'role'),
                a.attrelid,
                a.attnum,
                'SELECT'
            );
    filter realtime.user_defined_filter;
    col_type regtype;
    in_val jsonb;
    selected_col text;
begin
    for filter in select * from unnest(new.filters) loop
        if not filter.column_name = any(col_names) then
            raise exception 'invalid column for filter %', filter.column_name;
        end if;

        col_type = (
            select atttypid::regtype
            from pg_catalog.pg_attribute
            where attrelid = new.entity
                  and attname = filter.column_name
        );
        if col_type is null then
            raise exception 'failed to lookup type for column %', filter.column_name;
        end if;

        if filter.op = 'in'::realtime.equality_op then
            in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
            if coalesce(jsonb_array_length(in_val), 0) > 100 then
                raise exception 'too many values for `in` filter. Maximum 100';
            end if;
        elsif filter.op = 'is'::realtime.equality_op then
            -- `is` requires a keyword RHS rather than a typed literal
            if filter.value not in ('null', 'true', 'false', 'unknown') then
                raise exception 'invalid value for is filter: must be null, true, false, or unknown';
            end if;
            -- IS NULL works for any type, but IS TRUE/FALSE/UNKNOWN require a boolean
            -- operand. Reject the non-null keywords on non-boolean columns here so they
            -- don't abort apply_rls at WAL time.
            if filter.value <> 'null' and col_type <> 'boolean'::regtype then
                raise exception 'is % filter requires a boolean column, got %', filter.value, col_type::text;
            end if;
        elsif filter.op in ('like'::realtime.equality_op, 'ilike'::realtime.equality_op) then
            -- like/ilike apply the text pattern operator (~~); reject column types that
            -- have no such operator instead of failing at WAL time
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = '~~' and oprleft = col_type
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
        elsif filter.op in ('match'::realtime.equality_op, 'imatch'::realtime.equality_op) then
            -- match/imatch apply the regex operators ~ / ~*; reject column types that have
            -- no such operator (e.g. integer) instead of failing at WAL time, mirroring the
            -- like/ilike guard above.
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = case when filter.op = 'imatch'::realtime.equality_op then '~*' else '~' end
                  and oprleft = col_type
                  and oprright = col_type
                  and oprresult = 'boolean'::regtype
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
            -- validate the regex eagerly so a bad pattern is rejected here, not inside
            -- apply_rls where it would abort the WAL stream for the entity
            begin
                perform '' ~ filter.value;
            exception when others then
                raise exception 'invalid regular expression for % filter: %', filter.op::text, sqlerrm;
            end;
        else
            -- eq/neq/lt/lte/gt/gte: value must be coercable to the type
            perform realtime.cast(filter.value, col_type);
        end if;
    end loop;

    if new.selected_columns is not null then
        for selected_col in select * from unnest(new.selected_columns) loop
            if not selected_col = any(col_names) then
                raise exception 'invalid column for select %', selected_col;
            end if;
        end loop;
    end if;

    -- Apply consistent order to filters so the unique constraint can't be tricked by a
    -- different filter order. negate is part of the sort key.
    new.filters = coalesce(
        array_agg(f order by f.column_name, f.op, f.value, f.negate),
        '{}'
    ) from unnest(new.filters) f;

    -- Normalize selected_columns order so ARRAY['a','b'] and ARRAY['b','a'] are treated
    -- as the same subscription group in apply_rls. Preserve an empty array as '{}'
    -- ("primary keys only") so it stays distinct from NULL ("all columns"); array_agg
    -- over an empty set would otherwise collapse '{}' back to NULL.
    if new.selected_columns is not null then
        new.selected_columns = coalesce(
            (
                select array_agg(c order by c)
                from unnest(new.selected_columns) c
            ),
            '{}'::text[]
        );
    end if;

    return new;
end;
$$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: wal2json_escape_identifier(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.wal2json_escape_identifier(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  -- Prefix `\`, `,`, `.`, and any whitespace with `\`
  SELECT regexp_replace(name, '([\\,.[:space:]])', '\\\1', 'g')
$$;


--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_lifecycle_service_role(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_lifecycle_service_role() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  IF current_user::text IS DISTINCT FROM TG_ARGV[0]
     AND (
       OLD.lifecycle_configuration IS DISTINCT FROM NEW.lifecycle_configuration
       OR OLD.lifecycle_configuration_generation IS DISTINCT FROM NEW.lifecycle_configuration_generation
     ) THEN
    -- AFTER runs only after caller RLS has accepted the proposed row. The API
    -- recognizes this specific error after rolling back its permission probe;
    -- direct non-service writes still fail and cannot persist the change.
    RAISE EXCEPTION 'bucket control columns may only be changed by the configured storage service role'
      USING ERRCODE = 'PST01',
            SCHEMA = TG_TABLE_SCHEMA,
            TABLE = TG_TABLE_NAME,
            CONSTRAINT = TG_NAME;
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[array_length(_parts, 1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN p_delimiter <> ''
         AND position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(
        p_key,
        length(p_prefix)
            + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1))
            + length(p_delimiter) - 1
    )
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket(noncurrent_versions text DEFAULT 'include'::text, delete_markers text DEFAULT 'include'::text) RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'include');
    delete_markers := COALESCE(delete_markers, 'include');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'include';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'include';
    END IF;

    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        where (noncurrent_versions != 'exclude' OR obj.archived_at IS NULL)
          and (noncurrent_versions != 'only' OR obj.archived_at IS NOT NULL)
          and (delete_markers != 'exclude' OR NOT obj.is_delete_marker)
          and (delete_markers != 'only' OR obj.is_delete_marker)
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text, raw_prefix_param text DEFAULT NULL::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE sql STABLE
    AS $_$
WITH candidates AS (
    SELECT
        upload.key AS object_key,
        CASE
            WHEN position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1)) > 0
            THEN left(
                upload.key,
                length(coalesce($7, $2))
                    + position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1))
                    + length($3) - 1
            )
            ELSE upload.key
        END AS result_key,
        upload.id,
        upload.created_at,
        position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1)) > 0 AS is_common_prefix
    FROM storage.s3_multipart_uploads AS upload
    WHERE upload.bucket_id = $1
      AND upload.key COLLATE "C" LIKE $2 || '%'
), filtered AS (
    SELECT candidate.*
    FROM candidates AS candidate
    WHERE $5 = ''
       OR candidate.result_key COLLATE "C" > $5
       OR (
           candidate.result_key COLLATE "C" = $5
           AND NOT candidate.is_common_prefix
           AND $6 <> ''
           -- A completed or aborted marker repeats the remaining same-key uploads.
           AND COALESCE(
               (candidate.created_at, candidate.id COLLATE "C") > (
                   SELECT marker.created_at, marker.id COLLATE "C"
                   FROM storage.s3_multipart_uploads AS marker
                   WHERE marker.bucket_id = $1
                     AND marker.key COLLATE "C" = $5
                     AND marker.id = $6
               ),
               TRUE
           )
       )
), ranked AS (
    SELECT
        filtered.*,
        row_number() OVER (
            PARTITION BY filtered.result_key COLLATE "C"
            ORDER BY filtered.created_at, filtered.id COLLATE "C"
        ) AS prefix_rank
    FROM filtered
)
SELECT ranked.result_key, ranked.id, ranked.created_at
FROM ranked
WHERE NOT ranked.is_common_prefix OR ranked.prefix_rank = 1
ORDER BY ranked.result_key COLLATE "C", ranked.created_at, ranked.id COLLATE "C"
LIMIT $4;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text, text, text, timestamp with time zone, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text, next_token_archived_at timestamp with time zone DEFAULT NULL::timestamp with time zone, next_token_version text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_start_relative TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;
    v_version_filter TEXT;

    -- true when noncurrent_versions can return >1 row per name; keeps them
    -- ordered most-recent-first and lets pagination resume mid-key
    v_multi_row BOOLEAN;
    v_name_order TEXT;
    v_exact_range_predicate TEXT;
    v_strict_range_predicate TEXT;
    v_inclusive_range_predicate TEXT;

    -- Seek state for the current name. archived_at is normalized to JavaScript's
    -- millisecond precision and version breaks ties within the same millisecond.
    -- Current rows use 'infinity'; NULL means no tiebreak has been established.
    v_next_seek TEXT;
    v_next_seek_at TIMESTAMPTZ;
    v_next_seek_version TEXT;
    v_next_seek_strict BOOLEAN := false;
    v_cursor_is_folder BOOLEAN;
    v_count INT := 0;
    v_previous_seek TEXT;
    v_previous_seek_at TIMESTAMPTZ;
    v_previous_seek_version TEXT;
    v_previous_count INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;
    v_batch_query_strict TEXT;
    v_delete_marker_peek_query TEXT;
    v_delete_marker_peek_query_strict TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);
    v_next_seek_at := NULL;
    v_next_seek_version := '';

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    v_multi_row := noncurrent_versions IN ('only', 'include');
    v_name_order := CASE WHEN v_is_asc THEN 'ASC' ELSE 'DESC' END;

    v_version_filter := '';
    IF noncurrent_versions = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NULL';
    ELSIF noncurrent_versions = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NOT NULL';
    END IF;
    IF delete_markers = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND NOT o.is_delete_marker';
    ELSIF delete_markers = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.is_delete_marker';
    END IF;

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Keep caller-provided cursors inside the requested prefix range.
    IF v_start <> '' AND v_upper_bound IS NOT NULL THEN
        IF v_is_asc THEN
            IF v_start COLLATE "C" < v_prefix COLLATE "C" THEN
                v_start := '';
            ELSIF v_start COLLATE "C" >= v_upper_bound COLLATE "C" THEN
                RETURN;
            END IF;
        ELSE
            IF v_start COLLATE "C" < v_prefix COLLATE "C" THEN
                RETURN;
            ELSIF v_start COLLATE "C" >= v_upper_bound COLLATE "C" THEN
                v_start := '';
            END IF;
        END IF;
    END IF;

    v_start_relative := substring(v_start FROM length(v_prefix) + 1);

    -- Direction affects only the indexed name range and its ordering. Cursor
    -- state transitions and within-key version ordering stay shared.
    IF v_is_asc THEN
        v_exact_range_predicate := 'TRUE';
        v_strict_range_predicate := 'o.name COLLATE "C" > $2';
        v_inclusive_range_predicate := 'o.name COLLATE "C" >= $2';
        IF v_upper_bound IS NOT NULL THEN
            v_exact_range_predicate := 'o.name COLLATE "C" < $3';
            v_strict_range_predicate := v_strict_range_predicate || ' AND o.name COLLATE "C" < $3';
            v_inclusive_range_predicate := v_inclusive_range_predicate || ' AND o.name COLLATE "C" < $3';
        END IF;
    ELSE
        v_exact_range_predicate := 'TRUE';
        v_strict_range_predicate := 'o.name COLLATE "C" < $2';
        v_inclusive_range_predicate := 'o.name COLLATE "C" < $2';
        IF v_prefix <> '' THEN
            v_exact_range_predicate := 'o.name COLLATE "C" >= $3';
            v_strict_range_predicate := v_strict_range_predicate || ' AND o.name COLLATE "C" >= $3';
            v_inclusive_range_predicate := v_inclusive_range_predicate || ' AND o.name COLLATE "C" >= $3';
        END IF;
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    -- The multi-row order matches the externally serialized cursor exactly:
    -- archived_at at millisecond precision, then version as the final tiebreak.
    --
    -- When v_multi_row, the seek is a keyset tuple comparison ("name > $2 OR
    -- (name = $2 AND tiebreak)") - Postgres won't split that OR into indexable
    -- form (confirmed even with fully literal values), so as one WHERE clause
    -- it forces a full bucket scan filtered row-by-row. Splitting it into two
    -- independently-indexable branches (exact name match with the tiebreak
    -- filter, vs. strictly-past names) combined with UNION ALL lets each
    -- branch keep name as a real index condition; the outer ORDER BY/LIMIT
    -- re-merges them into the same page the single query used to produce.
    IF v_multi_row THEN
        v_batch_query := format(
            $sql$
            SELECT *
            FROM (
                (
                    SELECT o.name, o.id, o.updated_at, o.created_at,
                           o.last_accessed_at, o.metadata, o.version,
                           o.archived_at, o.is_delete_marker, o.is_versioned
                    FROM storage.objects o
                    WHERE o.bucket_id = $1
                      AND o.name COLLATE "C" = $2
                      AND %s
                      AND NOT $7::boolean
                      AND (
                          $5::timestamptz IS NULL
                          OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < $5
                          OR (
                              COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = $5
                              AND COALESCE(o.version, '') > $6
                          )
                      )
                      %s
                    ORDER BY
                        COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC,
                        COALESCE(o.version, '') ASC
                    LIMIT $4
                )
                UNION ALL
                (
                    SELECT o.name, o.id, o.updated_at, o.created_at,
                           o.last_accessed_at, o.metadata, o.version,
                           o.archived_at, o.is_delete_marker, o.is_versioned
                    FROM storage.objects o
                    WHERE o.bucket_id = $1
                      AND %s
                      %s
                    ORDER BY
                        o.name COLLATE "C" %s,
                        COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC,
                        COALESCE(o.version, '') ASC
                    LIMIT $4
                )
            ) sub
            ORDER BY
                sub.name COLLATE "C" %s,
                COALESCE(date_trunc('milliseconds', sub.archived_at), 'infinity'::timestamptz) DESC,
                COALESCE(sub.version, '') ASC
            LIMIT $4
            $sql$,
            v_exact_range_predicate,
            v_version_filter,
            v_strict_range_predicate,
            v_version_filter,
            v_name_order,
            v_name_order
        );
    ELSE
        v_batch_query := format(
            $sql$
            SELECT o.name, o.id, o.updated_at, o.created_at,
                   o.last_accessed_at, o.metadata, o.version,
                   o.archived_at, o.is_delete_marker, o.is_versioned
            FROM storage.objects o
            WHERE o.bucket_id = $1
              AND %s
              %s
            ORDER BY o.name COLLATE "C" %s, o.archived_at DESC
            LIMIT $4
            $sql$,
            v_inclusive_range_predicate,
            v_version_filter,
            v_name_order
        );

        -- Strict counterpart of the query above: used once the single-row
        -- ASC batch advance (below) has left v_next_seek pointing at the
        -- last row already emitted, so an inclusive predicate would
        -- re-match it forever. Only single-row mode ever sets strict mode,
        -- so this variant is never needed when v_multi_row.
        v_batch_query_strict := format(
            $sql$
            SELECT o.name, o.id, o.updated_at, o.created_at,
                   o.last_accessed_at, o.metadata, o.version,
                   o.archived_at, o.is_delete_marker, o.is_versioned
            FROM storage.objects o
            WHERE o.bucket_id = $1
              AND %s
              %s
            ORDER BY o.name COLLATE "C" %s, o.archived_at DESC
            LIMIT $4
            $sql$,
            v_strict_range_predicate,
            v_version_filter,
            v_name_order
        );
    END IF;

    -- The static peek predicates cannot use the partial delete-marker index
    -- once PL/pgSQL switches to a generic plan because whether
    -- is_delete_marker is required remains parameter-dependent. Reuse the
    -- already-specialized batch query with a one-row limit for this sparse
    -- filter so the plan sees a literal `o.is_delete_marker` predicate.
    IF delete_markers = 'only' THEN
        v_delete_marker_peek_query :=
            'SELECT marker_page.name FROM (' || v_batch_query || ') marker_page LIMIT 1';
        IF NOT v_multi_row THEN
            v_delete_marker_peek_query_strict :=
                'SELECT marker_page.name FROM (' || v_batch_query_strict || ') marker_page LIMIT 1';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor performs one specialized initial seek so
            -- partial current-version and delete-marker indexes remain available.
            EXECUTE format(
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1%s%s ORDER BY o.name COLLATE "C" DESC LIMIT 1',
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND o.name COLLATE "C" >= $2 AND o.name COLLATE "C" < $3'
                    ELSE ''
                END,
                v_version_filter
            )
            INTO v_next_seek
            USING _bucket_id, v_prefix, v_upper_bound;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Folder continuation tokens retain their trailing delimiter. A
        -- delimiter-less startAfter is always a literal key boundary.
        v_cursor_is_folder := delimiter_param <> ''
            AND v_start_relative <> ''
            AND right(v_start_relative, length(delimiter_param)) = delimiter_param;

        IF v_cursor_is_folder THEN
            v_next_seek := CASE
                WHEN right(v_start, length(delimiter_param)) = delimiter_param
                    THEN v_start
                ELSE v_start || delimiter_param
            END;
            IF v_is_asc THEN
                v_next_seek := left(v_next_seek, -1)
                    || chr(ascii(right(v_next_seek, 1)) + 1);
            END IF;
            v_next_seek_strict := NOT v_is_asc;
        ELSE
            -- leaf object: when v_multi_row, stay on v_start with the
            -- caller-supplied tiebreak so a page boundary mid-key resumes
            -- that key's remaining rows instead of skipping them. Truncate
            -- to milliseconds like every other v_next_seek_at assignment -
            -- harmless today since object.ts's cursor always round-trips
            -- through JS Date first, but this shouldn't rely on that.
            IF v_multi_row THEN
                v_next_seek := v_start;
                v_next_seek_at := date_trunc('milliseconds', next_token_archived_at);
                v_next_seek_version := coalesce(next_token_version, '');
                v_next_seek_strict := coalesce(next_token, '') = '';
            ELSIF v_is_asc THEN
                v_next_seek := v_start;
                v_next_seek_strict := true;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        v_previous_seek := v_next_seek;
        v_previous_seek_at := v_next_seek_at;
        v_previous_seek_version := v_next_seek_version;
        v_previous_count := v_count;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        -- v_multi_row is branched here (rather than folded into the WHERE
        -- clause as a bound parameter) so each concrete query keeps an
        -- unconditional seek predicate - once PL/pgSQL switches to its
        -- cached generic plan (after 5 calls), a parameter-gated
        -- "(NOT v_multi_row AND name >= $x) OR (v_multi_row AND ...)"
        -- predicate stops the planner from using name as an index
        -- condition at all, degrading every subsequent peek to a full
        -- index scan filtered row-by-row instead of a bounded range scan.
        -- v_multi_row's seek predicate is a keyset tuple comparison
        -- ("name > x OR (name = x AND tiebreak)") - Postgres does not
        -- split this OR into indexable form even with fully literal
        -- values, so it falls back to a full scan filtered row-by-row.
        -- Splitting it into two independently-indexable branches (exact
        -- name match with the tiebreak filter, vs. strictly-past name)
        -- combined with UNION ALL lets each branch keep name as a real
        -- index condition; the outer ORDER BY/LIMIT picks whichever of
        -- the (at most 2) rows sorts first.
        IF delete_markers = 'only' THEN
            EXECUTE CASE WHEN v_next_seek_strict AND NOT v_multi_row
                THEN v_delete_marker_peek_query_strict
                ELSE v_delete_marker_peek_query
            END
                INTO v_peek_name
                USING _bucket_id, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END,
                    1, v_next_seek_at, v_next_seek_version, v_next_seek_strict;
        ELSIF v_multi_row THEN
            IF v_is_asc THEN
                IF v_upper_bound IS NOT NULL THEN
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND o.name COLLATE "C" < v_upper_bound
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" > v_next_seek AND o.name COLLATE "C" < v_upper_bound
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" ASC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" > v_next_seek
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" ASC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSE
                IF v_upper_bound IS NOT NULL THEN
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND o.name COLLATE "C" >= v_prefix
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" DESC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" DESC LIMIT 1;
                ELSE
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" DESC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" DESC LIMIT 1;
                END IF;
            END IF;
        ELSE
            -- Single-row mode is always noncurrent_versions='exclude'. Keep
            -- this predicate literal so generic plans use the current index.
            IF v_is_asc THEN
                IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" > v_next_seek
                      AND o.name COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSIF v_next_seek_strict THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" > v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSIF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" >= v_next_seek
                      AND o.name COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" >= v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSE
                IF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" < v_next_seek
                      AND o.name COLLATE "C" >= v_prefix
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" DESC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" < v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" DESC LIMIT 1;
                END IF;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := v_common_prefix;
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            version := NULL;
            archived_at := NULL;
            is_delete_marker := NULL;
            is_versioned := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1)
                    || chr(ascii(right(v_common_prefix, 1)) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
            v_next_seek_at := NULL;
            v_next_seek_version := '';
            v_next_seek_strict := NOT v_is_asc;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE CASE WHEN v_next_seek_strict AND NOT v_multi_row THEN v_batch_query_strict ELSE v_batch_query END
                USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size, v_next_seek_at, v_next_seek_version,
                v_next_seek_strict
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it. Reset
                    -- strict mode too it may have been set by an earlier
                    -- row in this same batch (see the single-row ASC advance
                    -- below), and v_next_seek here is the folder-triggering
                    -- row's own name, which the next peek must find inclusively.
                    v_next_seek := CASE
                        WHEN v_is_asc THEN v_current.name
                        ELSE v_current.name || delimiter_param
                    END;
                    v_next_seek_at := NULL;
                    v_next_seek_version := '';
                    v_next_seek_strict := false;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                version := v_current.version;
                archived_at := v_current.archived_at;
                is_delete_marker := v_current.is_delete_marker;
                is_versioned := v_current.is_versioned;
                RETURN NEXT;
                v_count := v_count + 1;

                -- when v_multi_row, stay on this name and record its
                -- archived_at as the new tiebreak so remaining rows for the
                -- same key are picked up before moving to the next name
                IF v_multi_row THEN
                    v_next_seek := v_current.name;
                    v_next_seek_at := COALESCE(date_trunc('milliseconds', v_current.archived_at), 'infinity'::timestamptz);
                    v_next_seek_version := COALESCE(v_current.version, '');
                    v_next_seek_strict := false;
                ELSIF v_is_asc THEN
                    -- Appending the delimiter as a fake lexical successor
                    -- would skip a real key like `name || '!'` (or any
                    -- character sorting below the delimiter), which sorts
                    -- between `name` and `name || delimiter`. Track the real
                    -- name and mark the next comparison strict instead.
                    v_next_seek := v_current.name;
                    v_next_seek_strict := true;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;

        IF v_count = v_previous_count
           AND v_next_seek IS NOT DISTINCT FROM v_previous_seek
           AND v_next_seek_at IS NOT DISTINCT FROM v_previous_seek_at
           AND v_next_seek_version IS NOT DISTINCT FROM v_previous_seek_version THEN
            RAISE EXCEPTION 'storage.list_objects_with_delimiter made no progress at seek (%, %, %)',
                v_next_seek, v_next_seek_at, v_next_seek_version;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_bucket_control_columns(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_bucket_control_columns() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  configuration_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lifecycle_configuration IS NOT NULL
       OR NEW.lifecycle_configuration_generation IS NOT NULL THEN
      IF NOT pg_has_role(current_user, TG_ARGV[0], 'MEMBER') THEN
        RAISE EXCEPTION 'only members of the configured storage service role may insert lifecycle policy state'
          USING ERRCODE = '42501',
                HINT = format(
                  'Insert with both lifecycle columns NULL and configure lifecycle through the Storage API afterward, or insert as a member of %I.',
                  TG_ARGV[0]
                );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  configuration_changed =
    OLD.lifecycle_configuration IS DISTINCT FROM NEW.lifecycle_configuration
    OR OLD.lifecycle_configuration_generation IS DISTINCT FROM NEW.lifecycle_configuration_generation;

  IF NOT configuration_changed THEN
    RETURN NEW;
  END IF;

  IF NEW.type IS DISTINCT FROM 'STANDARD' THEN
    RAISE EXCEPTION 'bucket versioning and lifecycle controls require a Standard bucket'
      USING ERRCODE = '0A000';
  END IF;

  IF NEW.lifecycle_configuration IS NULL
     AND NEW.lifecycle_configuration_generation IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.lifecycle_configuration IS NULL
     OR NEW.lifecycle_configuration_generation IS NULL
     OR OLD.lifecycle_configuration IS NOT DISTINCT FROM NEW.lifecycle_configuration
     OR OLD.lifecycle_configuration_generation IS NOT DISTINCT FROM NEW.lifecycle_configuration_generation THEN
    RAISE EXCEPTION 'a changed lifecycle policy requires a new non-null generation'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_prefix_len INT;
    v_prefix_start INT;
    v_combined_levels INT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;
    v_version_filter TEXT;
    v_multi_row BOOLEAN;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;
    v_delete_marker_peek_query TEXT;
    v_delete_marker_peek_query_strict TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_next_seek_at TIMESTAMPTZ;
    v_next_seek_version TEXT;
    v_next_seek_strict BOOLEAN := false;
    v_count INT := 0;
    v_skipped INT := 0;
    v_previous_seek TEXT;
    v_previous_seek_at TIMESTAMPTZ;
    v_previous_seek_version TEXT;
    v_previous_count INT;
    v_previous_skipped INT;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_prefix_len := length(coalesce(prefix, ''));
    v_prefix_start := coalesce(array_length(string_to_array(coalesce(prefix, ''), v_delimiter), 1), 1);
    v_combined_levels := coalesce(array_length(string_to_array(v_prefix, v_delimiter), 1), 1);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);
    v_next_seek_at := NULL;
    v_next_seek_version := '';

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    v_multi_row := noncurrent_versions IN ('only', 'include');

    v_version_filter := '';
    IF noncurrent_versions = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NULL';
    ELSIF noncurrent_versions = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NOT NULL';
    END IF;
    IF delete_markers = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND NOT o.is_delete_marker';
    ELSIF delete_markers = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.is_delete_marker';
    END IF;

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT array_to_string(path_tokens[$1:$2], '/') AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $3 || '%%'
                  AND bucket_id = $4
                  AND array_length(objects.path_tokens, 1) <> $2
                  AND ($7 != 'exclude' OR objects.archived_at IS NULL)
                  AND ($7 != 'only' OR objects.archived_at IS NOT NULL)
                  AND ($8 != 'exclude' OR NOT objects.is_delete_marker)
                  AND ($8 != 'only' OR objects.is_delete_marker)
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata,
                   NULL::text AS version,
                   NULL::timestamptz AS archived_at,
                   NULL::boolean AS is_delete_marker,
                   NULL::boolean AS is_versioned FROM folders)
            UNION ALL
            (SELECT array_to_string(path_tokens[$1:$2], '/') AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata,
                   version, archived_at, is_delete_marker, is_versioned
             FROM storage.objects
             WHERE objects.name ILIKE $3 || '%%'
               AND bucket_id = $4
               AND array_length(objects.path_tokens, 1) = $2
               AND ($7 != 'exclude' OR objects.archived_at IS NULL)
               AND ($7 != 'only' OR objects.archived_at IS NOT NULL)
               AND ($8 != 'exclude' OR NOT objects.is_delete_marker)
               AND ($8 != 'only' OR objects.is_delete_marker)
             -- name, then version, as tiebreaks so two versions of the same
             -- key tying on the sort column still sort deterministically
             ORDER BY %I %s, name COLLATE "C" %s, COALESCE(version, '') %s)
            LIMIT $5 OFFSET $6
            $sql$, v_sort_order, v_order_by, v_sort_order, v_sort_order, v_sort_order
        ) USING v_prefix_start, v_combined_levels, v_prefix, bucketname, v_limit, offsets, noncurrent_versions, delete_markers;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build a resume-safe batch query. The exact-name branch returns remaining
    -- versions after the current (archived_at, version) boundary; the strict
    -- name branch returns subsequent keys. UNION ALL keeps both predicates
    -- independently indexable.
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" > $2 AND lower(o.name) COLLATE "C" < $3' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" ASC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" > $2' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" ASC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 AND lower(o.name) COLLATE "C" >= $3' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" DESC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" DESC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        END IF;
    END IF;

    -- Keep the delete-marker predicate literal so the cached generic
    -- plan can use idx_objects_delete_markers during the main-loop peek.
    IF delete_markers = 'only' THEN
        IF v_multi_row THEN
            v_delete_marker_peek_query :=
                'SELECT marker_page.name FROM (' || v_batch_query || ') marker_page LIMIT 1';
        ELSIF v_is_asc THEN
            -- Two separate literal query strings, not one gated by a bound
            -- boolean: folding "$n AND op1 OR NOT $n AND op2" into a single
            -- query defeats the generic plan's ability to push either
            -- comparison into the index. Branching in PL/pgSQL control flow
            -- instead keeps each query's index condition intact.
            v_delete_marker_peek_query :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" >= $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" < $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1';
            -- Strict variant: used once the single-row ASC batch advance
            -- (below) has left v_next_seek pointing at the last row already
            -- emitted, so a plain >= would re-match it forever.
            v_delete_marker_peek_query_strict :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" > $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" < $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1';
        ELSE
            v_delete_marker_peek_query :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" < $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" >= $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC performs one specialized initial seek so partial current-version
        -- and delete-marker indexes remain available.
        EXECUTE format(
            'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1%s%s ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1',
            CASE WHEN v_upper_bound IS NOT NULL
                THEN ' AND lower(o.name) COLLATE "C" >= $2 AND lower(o.name) COLLATE "C" < $3'
                ELSE ''
            END,
            v_version_filter
        )
        INTO v_peek_name
        USING bucketname, v_prefix_lower, v_upper_bound;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch and
    -- the delete-marker-only path
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        v_previous_seek := v_next_seek;
        v_previous_seek_at := v_next_seek_at;
        v_previous_seek_version := v_next_seek_version;
        v_previous_count := v_count;
        v_previous_skipped := v_skipped;

        -- STEP 1: PEEK
        v_peek_name := NULL;
        IF delete_markers = 'only' THEN
            EXECUTE CASE WHEN v_next_seek_strict
                THEN v_delete_marker_peek_query_strict
                ELSE v_delete_marker_peek_query
            END
                INTO v_peek_name
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END,
                    1, v_next_seek_at, v_next_seek_version;
        ELSIF v_multi_row AND v_next_seek_at IS NOT NULL THEN
            SELECT o.name INTO v_peek_name
            FROM storage.objects o
            WHERE o.bucket_id = bucketname
              AND lower(o.name) COLLATE "C" = v_next_seek
              AND (COALESCE(o.archived_at, 'infinity'::timestamptz) < v_next_seek_at
                   OR (COALESCE(o.archived_at, 'infinity'::timestamptz) = v_next_seek_at
                       AND COALESCE(o.version, '') > v_next_seek_version))
              AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
              AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
              AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
              AND (delete_markers != 'only' OR o.is_delete_marker)
            ORDER BY COALESCE(o.archived_at, 'infinity'::timestamptz) DESC,
                     COALESCE(o.version, '') ASC
            LIMIT 1;

            -- The current key is exhausted. Clear its version boundary and
            -- make the following ASC name peek strict. Appending '/' is not a
            -- valid lexical successor because keys ending in characters such
            -- as '!' sort between the exhausted name and name || '/'.
            IF v_peek_name IS NULL THEN
                IF v_is_asc THEN
                    v_next_seek_strict := true;
                END IF;
                v_next_seek_at := NULL;
                v_next_seek_version := '';
            END IF;
        END IF;

        -- Single-row mode is always noncurrent_versions='exclude'. Keep the
        -- current-row predicate literal so generic plans use the current index.
        IF delete_markers != 'only' AND v_peek_name IS NULL AND NOT v_multi_row THEN
            IF v_is_asc THEN
                IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSIF v_next_seek_strict THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSIF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSIF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                  AND o.archived_at IS NULL
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                  AND o.archived_at IS NULL
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        ELSIF delete_markers != 'only' AND v_peek_name IS NULL AND v_is_asc THEN
            IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSIF v_next_seek_strict THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSIF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSIF delete_markers != 'only' AND v_peek_name IS NULL THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- If the peek landed on a different key than we were tracking, any
        -- version boundary belongs to the OLD key and must not leak into the
        -- new one - e.g. the deleteMarkers='only' peek doesn't know or care
        -- whether it's continuing the same key or jumping to a new one, so
        -- it never clears these itself.
        IF lower(v_peek_name) IS DISTINCT FROM v_next_seek THEN
            v_next_seek_at := NULL;
            v_next_seek_version := '';
        END IF;

        -- The peek is authoritative for the next key to process. This is
        -- especially important after exhausting a multi-version key: the
        -- version boundary has been cleared, so executing the batch against
        -- a stale v_next_seek would replay every version of that old key.
        v_next_seek := lower(v_peek_name);
        v_next_seek_strict := false;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := substring(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter) from v_prefix_len + 1);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                version := NULL;
                archived_at := NULL;
                is_delete_marker := NULL;
                is_versioned := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
            v_next_seek_at := NULL;
            v_next_seek_version := '';
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size,
                    v_next_seek_at, v_next_seek_version
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it. Reset
                    -- strict mode too - it may have been set by an earlier
                    -- row in this same batch (see the single-row ASC advance
                    -- below), and v_next_seek here is the folder-triggering
                    -- row's own name, which the next peek must find inclusively.
                    v_next_seek := CASE
                        WHEN v_is_asc THEN lower(v_current.name)
                        ELSE lower(v_current.name) || v_delimiter
                    END;
                    v_next_seek_at := NULL;
                    v_next_seek_version := '';
                    v_next_seek_strict := false;
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := substring(v_current.name from v_prefix_len + 1);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    version := v_current.version;
                    archived_at := v_current.archived_at;
                    is_delete_marker := v_current.is_delete_marker;
                    is_versioned := v_current.is_versioned;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Multi-row mode must remain on this key until all of its
                -- versions have crossed the internal batch boundary.
                IF v_multi_row THEN
                    v_next_seek := lower(v_current.name);
                    v_next_seek_at := COALESCE(v_current.archived_at, 'infinity'::timestamptz);
                    v_next_seek_version := COALESCE(v_current.version, '');
                ELSIF v_is_asc THEN
                    -- Appending the delimiter as a fake lexical successor would
                    -- skip a real key like `name || '!'` (or any character
                    -- sorting below the delimiter), which sorts between `name`
                    -- and `name || delimiter`. Track the real name and mark the
                    -- next comparison strict instead - same fix as the
                    -- exhausted-key case above.
                    v_next_seek := lower(v_current.name);
                    v_next_seek_strict := true;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;

        IF v_count = v_previous_count
           AND v_skipped = v_previous_skipped
           AND v_next_seek IS NOT DISTINCT FROM v_previous_seek
           AND v_next_seek_at IS NOT DISTINCT FROM v_previous_seek_at
           AND v_next_seek_version IS NOT DISTINCT FROM v_previous_seek_version THEN
            RAISE EXCEPTION 'storage.search made no progress at seek (%, %, %)',
                v_next_seek, v_next_seek_at, v_next_seek_version;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text, p_start_after_version text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
    v_prefix_pattern text;
    v_sort_order text;
    v_sort_column text;
    v_version_tiebreak text;
BEGIN
    v_prefix := coalesce(p_prefix, '');
    -- Keep the raw prefix for common-prefix calculations and escape only LIKE metacharacters.
    v_prefix_pattern := replace(v_prefix, chr(92), chr(92) || chr(92));
    v_prefix_pattern := replace(v_prefix_pattern, '%', chr(92) || '%');
    v_prefix_pattern := replace(v_prefix_pattern, '_', chr(92) || '_');

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    -- $9 is only populated in multi-row mode; it's always '' otherwise, so
    -- only use each row's real version as a tiebreak in multi-row mode.
    v_version_tiebreak := CASE WHEN noncurrent_versions IN ('only', 'include') THEN 'COALESCE(version, '''')' ELSE '''''' END;

    -- Defense-in-depth: this function is independently reachable and must
    -- not trust p_sort_order/p_sort_column to already be validated by a
    -- caller. Normalize to the same strict allow-list storage.search_v2
    -- uses before interpolating anything into dynamic SQL below.
    v_sort_order := lower(coalesce(p_sort_order, 'asc'));
    IF v_sort_order NOT IN ('asc', 'desc') THEN
        v_sort_order := 'asc';
    END IF;

    v_sort_column := lower(coalesce(p_sort_column, 'updated_at'));
    IF v_sort_column NOT IN ('updated_at', 'created_at') THEN
        v_sort_column := 'updated_at';
    END IF;

    IF v_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                o.version AS obj_version,
                o.archived_at AS obj_archived_at,
                o.is_delete_marker AS obj_is_delete_marker,
                o.is_versioned AS obj_is_versioned,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $10 || '%%'
              AND ($7 != 'exclude' OR o.archived_at IS NULL)
              AND ($7 != 'only' OR o.archived_at IS NOT NULL)
              AND ($8 != 'exclude' OR NOT o.is_delete_marker)
              AND ($8 != 'only' OR o.is_delete_marker)
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                common_prefix AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                NULL::text AS version,
                NULL::timestamptz AS archived_at,
                NULL::boolean AS is_delete_marker,
                NULL::boolean AS is_versioned,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                obj_version AS version,
                obj_archived_at AS archived_at,
                obj_is_delete_marker AS is_delete_marker,
                obj_is_versioned AS is_versioned,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz),
                    name COLLATE "C",
                    %s
                ) %s ROW(
                    -- truncated the same way as the stored value above
                    date_trunc('milliseconds', COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz)),
                    $5,
                    $9
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata,
            version,
            archived_at,
            is_delete_marker,
            is_versioned
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s,
            COALESCE(version, '') %s
        LIMIT $4
    $sql$,
        v_sort_column,
        v_version_tiebreak,
        v_cursor_op,
        v_sort_column,
        v_sort_order,
        v_sort_order,
        v_sort_order
    );

    -- version is the third tiebreak component for two versions of the same
    -- key tying on both timestamp and name (see filtered CTE / ORDER BY above)
    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after, noncurrent_versions, delete_markers, coalesce(p_start_after_version, ''), v_prefix_pattern;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text, text, text, timestamp with time zone, text, boolean); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text, start_after_archived_at timestamp with time zone DEFAULT NULL::timestamp with time zone, start_after_version text DEFAULT ''::text, start_after_is_continuation boolean DEFAULT false) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata,
            l.version,
            l.archived_at,
            l.is_delete_marker,
            l.is_versioned
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            CASE WHEN start_after_is_continuation THEN '' ELSE start_after END,
            CASE WHEN start_after_is_continuation THEN start_after ELSE '' END,
            v_sort_ord,
            noncurrent_versions,
            delete_markers,
            start_after_archived_at,
            start_after_version
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after,
            noncurrent_versions, delete_markers, start_after_version
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_claims_allowlist text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: mfa_recovery_code_sets; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_recovery_code_sets (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    mfa_factor_id uuid NOT NULL,
    failed_verification_count integer DEFAULT 0 NOT NULL,
    verification_locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mfa_recovery_code_sets_failed_verification_count_check CHECK ((failed_verification_count >= 0))
);


--
-- Name: mfa_recovery_codes; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_recovery_codes (
    id uuid NOT NULL,
    mfa_recovery_code_set_id uuid NOT NULL,
    code_hash text NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: scim_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.scim_tokens (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    token_hash text NOT NULL,
    prefix text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    last_used_at timestamp with time zone,
    CONSTRAINT scim_tokens_expires_at_future CHECK (((expires_at IS NULL) OR (expires_at > created_at))),
    CONSTRAINT scim_tokens_revoked_after_created CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at))),
    CONSTRAINT scim_tokens_token_hash_check CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: scim_users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.scim_users (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    user_id uuid,
    resource jsonb NOT NULL,
    user_name text GENERATED ALWAYS AS (lower((resource ->> 'userName'::text))) STORED NOT NULL,
    external_id text GENERATED ALWAYS AS ((resource ->> 'externalId'::text)) STORED,
    active boolean GENERATED ALWAYS AS (COALESCE(((resource ->> 'active'::text))::boolean, true)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: affiliate_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    merchant text NOT NULL,
    country_code character(2),
    affiliate_url text NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: app_changelog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_changelog (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    version text NOT NULL,
    title text NOT NULL,
    detail text NOT NULL,
    is_published boolean DEFAULT true NOT NULL
);


--
-- Name: app_changelog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.app_changelog ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.app_changelog_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: app_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_feedback (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    subject text NOT NULL,
    detail text NOT NULL,
    user_id uuid,
    kind text DEFAULT 'feedback'::text NOT NULL,
    source text DEFAULT 'unknown'::text NOT NULL,
    screen text,
    app_version text,
    CONSTRAINT app_feedback_kind_check CHECK ((kind = ANY (ARRAY['bug'::text, 'feedback'::text]))),
    CONSTRAINT app_feedback_source_check CHECK ((source = ANY (ARRAY['mobile'::text, 'web'::text, 'unknown'::text])))
);


--
-- Name: app_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.app_feedback ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.app_feedback_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: nutrition_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nutrition_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    distance_km numeric NOT NULL,
    elevation_m numeric NOT NULL,
    goal text NOT NULL,
    eating_ease text,
    sweat_level text,
    carbs_per_hour integer NOT NULL,
    water_per_hour integer NOT NULL,
    sodium_per_hour integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT nutrition_plans_eating_ease_check CHECK ((eating_ease = ANY (ARRAY['hard'::text, 'ok'::text, 'easy'::text]))),
    CONSTRAINT nutrition_plans_goal_check CHECK ((goal = ANY (ARRAY['comfort'::text, 'good_time'::text, 'performance'::text]))),
    CONSTRAINT nutrition_plans_sweat_level_check CHECK ((sweat_level = ANY (ARRAY['a_lot'::text, 'normal'::text, 'little'::text])))
);


--
-- Name: organizer_import_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizer_import_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    edition_id uuid NOT NULL,
    created_by uuid NOT NULL,
    status text DEFAULT 'discovered'::text NOT NULL,
    source_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    discovery_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    confirmed_formats jsonb DEFAULT '[]'::jsonb NOT NULL,
    field_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone DEFAULT (timezone('utc'::text, now()) + '02:00:00'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT organizer_import_sessions_confirmed_formats_check CHECK ((jsonb_typeof(confirmed_formats) = 'array'::text)),
    CONSTRAINT organizer_import_sessions_discovery_snapshot_check CHECK ((jsonb_typeof(discovery_snapshot) = 'object'::text)),
    CONSTRAINT organizer_import_sessions_expiry_check CHECK ((expires_at > created_at)),
    CONSTRAINT organizer_import_sessions_field_snapshot_check CHECK ((jsonb_typeof(field_snapshot) = 'object'::text)),
    CONSTRAINT organizer_import_sessions_source_manifest_check CHECK ((jsonb_typeof(source_manifest) = 'object'::text)),
    CONSTRAINT organizer_import_sessions_status_check CHECK ((status = ANY (ARRAY['discovered'::text, 'formats_confirmed'::text, 'fields_analyzed'::text, 'applied'::text, 'cancelled'::text])))
);


--
-- Name: TABLE organizer_import_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organizer_import_sessions IS 'Temporary service-only state for the two-pass organizer import review. Expired rows are cleaned through the web cron route after Storage cleanup.';


--
-- Name: COLUMN organizer_import_sessions.source_manifest; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizer_import_sessions.source_manifest IS 'Bounded source metadata, including temporary Storage object paths needed by cleanup.';


--
-- Name: COLUMN organizer_import_sessions.confirmed_formats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizer_import_sessions.confirmed_formats IS 'Canonical formatKey/raceId mappings produced by atomic format confirmation.';


--
-- Name: organizer_racebook_module_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizer_racebook_module_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    edition_id uuid NOT NULL,
    race_id uuid,
    module_key text NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    configured_by uuid,
    CONSTRAINT organizer_racebook_module_settings_scope_check CHECK ((((race_id IS NULL) AND (module_key = ANY (ARRAY['equipment'::text, 'bib_pickup'::text, 'access'::text, 'services'::text, 'branding'::text, 'sponsors'::text]))) OR ((race_id IS NOT NULL) AND (module_key = ANY (ARRAY['aid_stations'::text, 'start_waves'::text, 'awards'::text, 'relay'::text, 'official_products'::text])))))
);


--
-- Name: TABLE organizer_racebook_module_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organizer_racebook_module_settings IS 'Edition and format module activation without deleting organizer-authored RaceBook content.';


--
-- Name: plan_aid_stations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_aid_stations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    name text NOT NULL,
    km numeric NOT NULL,
    water_available boolean DEFAULT true NOT NULL,
    notes text,
    order_index integer DEFAULT 0 NOT NULL,
    race_aid_station_id uuid
);


--
-- Name: plan_share_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_share_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    plan_id uuid NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    token_hash text NOT NULL,
    snapshot jsonb NOT NULL,
    snapshot_schema_version integer DEFAULT 1 NOT NULL,
    departure_time text,
    locale text DEFAULT 'fr'::text NOT NULL,
    plan_updated_at timestamp with time zone,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    crew_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT plan_share_links_crew_state_size_check CHECK ((octet_length((crew_state)::text) <= 20000)),
    CONSTRAINT plan_share_links_departure_time_check CHECK (((departure_time IS NULL) OR (departure_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text))),
    CONSTRAINT plan_share_links_locale_check CHECK ((locale = ANY (ARRAY['fr'::text, 'en'::text]))),
    CONSTRAINT plan_share_links_snapshot_schema_version_check CHECK ((snapshot_schema_version = 1)),
    CONSTRAINT plan_share_links_snapshot_size_check CHECK ((octet_length((snapshot)::text) <= 120000)),
    CONSTRAINT plan_share_links_token_hash_check CHECK ((token_hash ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: premium_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.premium_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    initial_duration_days integer NOT NULL,
    reason text NOT NULL,
    ends_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    slug text NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    calories_kcal numeric DEFAULT 0 NOT NULL,
    carbs_g numeric DEFAULT 0 NOT NULL,
    protein_g numeric DEFAULT 0 NOT NULL,
    fat_g numeric DEFAULT 0 NOT NULL,
    is_live boolean DEFAULT false NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    sodium_mg numeric DEFAULT 0 NOT NULL,
    product_url text,
    fuel_type public.fuel_type DEFAULT 'other'::public.fuel_type NOT NULL,
    created_by uuid,
    image_url text,
    brand text,
    is_official boolean DEFAULT false NOT NULL,
    official_name text
);


--
-- Name: COLUMN products.brand; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.brand IS 'Canonical brand label used to group nutrition products consistently across imports and clients.';


--
-- Name: COLUMN products.is_official; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.is_official IS 'Explicit flag for Pace Yourself official/shared catalog products. Do not infer this from created_by being null.';


--
-- Name: COLUMN products.official_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.official_name IS 'Exact source label from the official brand site/import before Pace Yourself display-name harmonization.';


--
-- Name: product_brand_review; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.product_brand_review WITH (security_invoker='true') AS
 SELECT id,
    slug,
    sku,
    name,
    official_name,
    brand,
    fuel_type,
    created_by,
    is_official,
    is_live,
    is_archived,
    updated_at
   FROM public.products
  WHERE ((is_official = true) AND (is_archived = false) AND (brand IS NULL))
  ORDER BY updated_at DESC, name;


--
-- Name: push_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id uuid NOT NULL,
    expo_push_token text NOT NULL,
    platform text NOT NULL,
    locale text DEFAULT 'en'::text NOT NULL,
    app_version text,
    notifications_enabled boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT push_devices_locale_check CHECK ((locale = ANY (ARRAY['fr'::text, 'en'::text]))),
    CONSTRAINT push_devices_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text])))
);


--
-- Name: push_notification_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_notification_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id uuid NOT NULL,
    push_device_id uuid NOT NULL,
    plan_id uuid,
    notification_kind text NOT NULL,
    dedupe_key text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    expo_ticket_id text
);


--
-- Name: race_event_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_event_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id uuid NOT NULL,
    event_id uuid NOT NULL,
    organization_name text NOT NULL,
    role_title text NOT NULL,
    contact_email text NOT NULL,
    official_site_url text,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    reviewer_notes text,
    CONSTRAINT race_event_claims_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: race_event_edition_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_event_edition_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id uuid NOT NULL,
    event_id uuid NOT NULL,
    source_year integer NOT NULL,
    requested_start_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    reviewer_notes text,
    CONSTRAINT race_event_edition_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: TABLE race_event_edition_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.race_event_edition_requests IS 'Organizer requests to open a new yearly event edition after admin validation.';


--
-- Name: COLUMN race_event_edition_requests.source_year; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_event_edition_requests.source_year IS 'The currently selected event edition year that the organizer wants to renew.';


--
-- Name: COLUMN race_event_edition_requests.requested_start_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_event_edition_requests.requested_start_date IS 'Requested start date for the new event edition, used for billing/review before any race rows are cloned.';


--
-- Name: race_event_editions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_event_editions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    event_id uuid NOT NULL,
    edition_year smallint NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    module_setup_completed_at timestamp with time zone,
    CONSTRAINT race_event_editions_date_order_check CHECK ((end_date >= start_date)),
    CONSTRAINT race_event_editions_start_year_check CHECK ((edition_year = (EXTRACT(year FROM start_date))::smallint)),
    CONSTRAINT race_event_editions_year_check CHECK (((edition_year >= 2000) AND (edition_year <= 2100)))
);


--
-- Name: TABLE race_event_editions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.race_event_editions IS 'Canonical yearly date ranges for organizer-managed race events.';


--
-- Name: COLUMN race_event_editions.is_current; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_event_editions.is_current IS 'The edition mirrored to legacy race_events date fields and targeted by the next publication review.';


--
-- Name: COLUMN race_event_editions.is_visible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_event_editions.is_visible IS 'Whether formats in this edition may appear in the public catalog. Hiding an edition also hides all attached Racebooks.';


--
-- Name: COLUMN race_event_editions.module_setup_completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_event_editions.module_setup_completed_at IS 'Set when the organizer completes or skips the module setup assistant.';


--
-- Name: race_event_organizers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_event_organizers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    claim_id uuid,
    role text DEFAULT 'owner'::text NOT NULL,
    created_by uuid,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revoke_reason text,
    dashboard_onboarding_completed_at timestamp with time zone
);


--
-- Name: COLUMN race_event_organizers.dashboard_onboarding_completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_event_organizers.dashboard_onboarding_completed_at IS 'When this organizer completed or skipped the dashboard guide for this event membership.';


--
-- Name: race_event_update_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_event_update_reads (
    update_id uuid NOT NULL,
    user_id uuid NOT NULL,
    read_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: race_event_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_event_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    event_id uuid NOT NULL,
    created_by uuid,
    message text NOT NULL,
    race_id uuid,
    CONSTRAINT race_event_updates_message_check CHECK (((char_length(btrim(message)) > 0) AND (char_length(message) <= 280)))
);


--
-- Name: race_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    location text,
    description text,
    website_url text,
    logo_url text,
    race_date date,
    is_live boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    thumbnail_url text,
    organizer_details jsonb,
    location_city text,
    location_city_code text,
    location_department text,
    location_department_code text,
    location_region text,
    location_region_code text,
    location_country text,
    location_country_code text,
    location_latitude double precision,
    location_longitude double precision,
    CONSTRAINT race_events_location_coordinates_pair_check CHECK (((location_latitude IS NULL) = (location_longitude IS NULL))),
    CONSTRAINT race_events_location_country_code_check CHECK (((location_country_code IS NULL) OR (location_country_code ~ '^[A-Z]{2}$'::text))),
    CONSTRAINT race_events_location_latitude_check CHECK (((location_latitude IS NULL) OR ((location_latitude >= ('-90'::integer)::double precision) AND (location_latitude <= (90)::double precision)))),
    CONSTRAINT race_events_location_longitude_check CHECK (((location_longitude IS NULL) OR ((location_longitude >= ('-180'::integer)::double precision) AND (location_longitude <= (180)::double precision))))
);


--
-- Name: COLUMN race_events.organizer_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_events.organizer_details IS 'Organizer-managed progressive dashboard details such as mandatory equipment, bib pickup, access, services, partners, and runner-facing notes.';


--
-- Name: COLUMN race_events.location_city; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_events.location_city IS 'Normalized anchor-city name used for geographic catalog filters.';


--
-- Name: COLUMN race_events.location_city_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_events.location_city_code IS 'Stable locality identifier; French events use the INSEE commune code.';


--
-- Name: COLUMN race_events.location_department; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_events.location_department IS 'Normalized second-level administrative area; department for French events.';


--
-- Name: COLUMN race_events.location_department_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_events.location_department_code IS 'Stable second-level administrative-area code; department code for French events.';


--
-- Name: COLUMN race_events.location_region; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_events.location_region IS 'Normalized first-level administrative area; region for French events.';


--
-- Name: COLUMN race_events.location_region_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_events.location_region_code IS 'Stable first-level administrative-area code; region code for French events.';


--
-- Name: COLUMN race_events.location_country; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_events.location_country IS 'Normalized country display name.';


--
-- Name: COLUMN race_events.location_country_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_events.location_country_code IS 'ISO 3166-1 alpha-2 country code.';


--
-- Name: COLUMN race_events.location_latitude; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_events.location_latitude IS 'Latitude of the event anchor city, used for approximate nearby-city discovery.';


--
-- Name: COLUMN race_events.location_longitude; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_events.location_longitude IS 'Longitude of the event anchor city, used for approximate nearby-city discovery.';


--
-- Name: race_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    name text NOT NULL,
    planner_values jsonb NOT NULL,
    elevation_profile jsonb DEFAULT '[]'::jsonb NOT NULL,
    race_id uuid,
    catalog_race_updated_at_at_import timestamp with time zone,
    plan_gpx_path text,
    plan_course_stats jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: race_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_requests (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    race_name text NOT NULL,
    location text NOT NULL,
    requested_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    CONSTRAINT race_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: race_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.race_requests ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.race_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: race_slug_redirects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_slug_redirects (
    old_slug text NOT NULL,
    race_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT race_slug_redirects_old_slug_format_check CHECK (((old_slug = lower(btrim(old_slug))) AND ((char_length(old_slug) >= 1) AND (char_length(old_slug) <= 160)) AND (old_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)))
);


--
-- Name: TABLE race_slug_redirects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.race_slug_redirects IS 'Durable mappings from former public course slugs to the current race row.';


--
-- Name: COLUMN race_slug_redirects.old_slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.race_slug_redirects.old_slug IS 'Former canonical slug. A slug in this table is reserved and cannot become canonical again.';


--
-- Name: racebook_gear_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.racebook_gear_checks (
    user_id uuid NOT NULL,
    race_id uuid NOT NULL,
    item_key text NOT NULL,
    checked_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT racebook_gear_checks_item_key_check CHECK (((char_length(item_key) >= 1) AND (char_length(item_key) <= 320)))
);


--
-- Name: rate_limit_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_entries (
    key text NOT NULL,
    count integer DEFAULT 1 NOT NULL,
    reset_at timestamp with time zone NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    user_id uuid NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    status text,
    price_id text,
    current_period_end timestamp with time zone,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    plan_name text,
    provider text DEFAULT 'web'::text NOT NULL,
    CONSTRAINT subscriptions_provider_check CHECK ((provider = ANY (ARRAY['web'::text, 'google'::text, 'apple'::text])))
);


--
-- Name: user_favorite_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_favorite_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: user_favorite_race_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_favorite_race_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id uuid NOT NULL,
    event_id uuid NOT NULL
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    user_id uuid DEFAULT auth.uid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    full_name text,
    age integer,
    water_bag_liters numeric,
    role text,
    trial_started_at timestamp with time zone,
    trial_ends_at timestamp with time zone,
    trial_welcome_seen_at timestamp with time zone,
    trial_expired_seen_at timestamp with time zone,
    birth_date date,
    comfortable_flat_pace_min_per_km numeric,
    utmb_index numeric,
    default_carbs_g_per_hour integer,
    default_water_ml_per_hour integer,
    default_sodium_mg_per_hour integer,
    weight_kg numeric,
    height_cm integer,
    sign_in_count integer DEFAULT 0 NOT NULL,
    first_sign_in_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    onboarding_completed_at timestamp with time zone,
    plan_onboarding_status text DEFAULT 'pending'::text NOT NULL,
    racebook_onboarding_status text DEFAULT 'pending'::text NOT NULL,
    CONSTRAINT user_profiles_age_check CHECK (((age IS NULL) OR (age >= 0))),
    CONSTRAINT user_profiles_comfortable_flat_pace_check CHECK (((comfortable_flat_pace_min_per_km IS NULL) OR (comfortable_flat_pace_min_per_km > (0)::numeric))),
    CONSTRAINT user_profiles_default_carbs_g_per_hour_check CHECK (((default_carbs_g_per_hour IS NULL) OR (default_carbs_g_per_hour >= 0))),
    CONSTRAINT user_profiles_default_sodium_mg_per_hour_check CHECK (((default_sodium_mg_per_hour IS NULL) OR (default_sodium_mg_per_hour >= 0))),
    CONSTRAINT user_profiles_default_water_ml_per_hour_check CHECK (((default_water_ml_per_hour IS NULL) OR (default_water_ml_per_hour >= 0))),
    CONSTRAINT user_profiles_height_cm_check CHECK (((height_cm IS NULL) OR ((height_cm >= 100) AND (height_cm <= 250)))),
    CONSTRAINT user_profiles_plan_onboarding_status_check CHECK ((plan_onboarding_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'skipped'::text, 'completed'::text]))),
    CONSTRAINT user_profiles_racebook_onboarding_status_check CHECK ((racebook_onboarding_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'skipped'::text, 'completed'::text]))),
    CONSTRAINT user_profiles_utmb_index_check CHECK (((utmb_index IS NULL) OR ((utmb_index >= (0)::numeric) AND (utmb_index <= (2000)::numeric)))),
    CONSTRAINT user_profiles_water_bag_check CHECK (((water_bag_liters IS NULL) OR (water_bag_liters >= (0)::numeric))),
    CONSTRAINT user_profiles_weight_kg_check CHECK (((weight_kg IS NULL) OR ((weight_kg >= (20)::numeric) AND (weight_kg <= (250)::numeric))))
);


--
-- Name: COLUMN user_profiles.onboarding_completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.onboarding_completed_at IS 'When the runner completed or explicitly skipped the required mobile onboarding.';


--
-- Name: COLUMN user_profiles.plan_onboarding_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.plan_onboarding_status IS 'Runner-facing mobile plan onboarding state: pending, in_progress, skipped, or completed.';


--
-- Name: COLUMN user_profiles.racebook_onboarding_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.racebook_onboarding_status IS 'Runner-facing mobile RaceBook onboarding state: pending, in_progress, skipped, or completed.';


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    skip_broadcast boolean DEFAULT false NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    selected_columns text[],
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL,
    versioning_status text DEFAULT 'DISABLED'::text NOT NULL,
    lifecycle_configuration jsonb,
    lifecycle_configuration_generation uuid,
    CONSTRAINT buckets_lifecycle_configuration_pair_check CHECK (((lifecycle_configuration IS NULL) = (lifecycle_configuration_generation IS NULL))),
    CONSTRAINT buckets_lifecycle_configuration_shape_check CHECK (((lifecycle_configuration IS NULL) OR ((jsonb_typeof(lifecycle_configuration) = 'object'::text) AND (lifecycle_configuration ? 'rules'::text) AND
CASE
    WHEN (jsonb_typeof((lifecycle_configuration -> 'rules'::text)) = 'array'::text) THEN ((jsonb_array_length((lifecycle_configuration -> 'rules'::text)) >= 1) AND (jsonb_array_length((lifecycle_configuration -> 'rules'::text)) <= 1000))
    ELSE false
END))),
    CONSTRAINT buckets_lifecycle_configuration_standard_only_check CHECK (((type = 'STANDARD'::storage.buckettype) OR ((lifecycle_configuration IS NULL) AND (lifecycle_configuration_generation IS NULL)))),
    CONSTRAINT buckets_versioning_dark_check CHECK ((versioning_status = 'DISABLED'::text)),
    CONSTRAINT buckets_versioning_standard_only_check CHECK (((type = 'STANDARD'::storage.buckettype) OR (versioning_status = 'DISABLED'::text))),
    CONSTRAINT buckets_versioning_status_check CHECK ((versioning_status = ANY (ARRAY['DISABLED'::text, 'ENABLED'::text, 'SUSPENDED'::text])))
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    archived_at timestamp with time zone,
    is_delete_marker boolean DEFAULT false NOT NULL,
    is_versioned boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text,
    created_by text,
    idempotency_key text,
    rollback text[]
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_mfa_factor_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_mfa_factor_id_key UNIQUE (mfa_factor_id);


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_pkey PRIMARY KEY (id);


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_user_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_user_id_key UNIQUE (user_id);


--
-- Name: mfa_recovery_codes mfa_recovery_codes_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_codes
    ADD CONSTRAINT mfa_recovery_codes_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: scim_tokens scim_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.scim_tokens
    ADD CONSTRAINT scim_tokens_pkey PRIMARY KEY (id);


--
-- Name: scim_users scim_users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.scim_users
    ADD CONSTRAINT scim_users_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: affiliate_offers affiliate_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_offers
    ADD CONSTRAINT affiliate_offers_pkey PRIMARY KEY (id);


--
-- Name: affiliate_offers affiliate_offers_product_country_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_offers
    ADD CONSTRAINT affiliate_offers_product_country_key UNIQUE (product_id, merchant, country_code);


--
-- Name: app_changelog app_changelog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_changelog
    ADD CONSTRAINT app_changelog_pkey PRIMARY KEY (id);


--
-- Name: app_changelog app_changelog_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_changelog
    ADD CONSTRAINT app_changelog_version_key UNIQUE (version);


--
-- Name: app_feedback app_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_feedback
    ADD CONSTRAINT app_feedback_pkey PRIMARY KEY (id);


--
-- Name: nutrition_plans nutrition_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_plans
    ADD CONSTRAINT nutrition_plans_pkey PRIMARY KEY (id);


--
-- Name: organizer_edition_capability_grants organizer_edition_capability_grants_edition_capability_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_capability_grants
    ADD CONSTRAINT organizer_edition_capability_grants_edition_capability_key UNIQUE (edition_id, capability_key);


--
-- Name: organizer_edition_capability_grants organizer_edition_capability_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_capability_grants
    ADD CONSTRAINT organizer_edition_capability_grants_pkey PRIMARY KEY (id);


--
-- Name: organizer_edition_entitlements organizer_edition_entitlements_edition_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_entitlements
    ADD CONSTRAINT organizer_edition_entitlements_edition_id_key UNIQUE (edition_id);


--
-- Name: organizer_edition_entitlements organizer_edition_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_entitlements
    ADD CONSTRAINT organizer_edition_entitlements_pkey PRIMARY KEY (id);


--
-- Name: organizer_edition_payments organizer_edition_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_payments
    ADD CONSTRAINT organizer_edition_payments_pkey PRIMARY KEY (id);


--
-- Name: organizer_edition_payments organizer_edition_payments_stripe_checkout_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_payments
    ADD CONSTRAINT organizer_edition_payments_stripe_checkout_session_id_key UNIQUE (stripe_checkout_session_id);


--
-- Name: organizer_edition_payments organizer_edition_payments_stripe_payment_intent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_payments
    ADD CONSTRAINT organizer_edition_payments_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);


--
-- Name: organizer_import_sessions organizer_import_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_import_sessions
    ADD CONSTRAINT organizer_import_sessions_pkey PRIMARY KEY (id);


--
-- Name: organizer_racebook_module_settings organizer_racebook_module_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_racebook_module_settings
    ADD CONSTRAINT organizer_racebook_module_settings_pkey PRIMARY KEY (id);


--
-- Name: plan_aid_stations plan_aid_stations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_aid_stations
    ADD CONSTRAINT plan_aid_stations_pkey PRIMARY KEY (id);


--
-- Name: plan_share_links plan_share_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_share_links
    ADD CONSTRAINT plan_share_links_pkey PRIMARY KEY (id);


--
-- Name: plan_share_links plan_share_links_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_share_links
    ADD CONSTRAINT plan_share_links_token_hash_key UNIQUE (token_hash);


--
-- Name: premium_grants premium_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_grants
    ADD CONSTRAINT premium_grants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: push_devices push_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_pkey PRIMARY KEY (id);


--
-- Name: push_notification_events push_notification_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_notification_events
    ADD CONSTRAINT push_notification_events_pkey PRIMARY KEY (id);


--
-- Name: race_aid_station_products race_aid_station_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_aid_station_products
    ADD CONSTRAINT race_aid_station_products_pkey PRIMARY KEY (id);


--
-- Name: race_aid_station_products race_aid_station_products_station_product_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_aid_station_products
    ADD CONSTRAINT race_aid_station_products_station_product_key UNIQUE (race_aid_station_id, product_id);


--
-- Name: race_awards race_awards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_awards
    ADD CONSTRAINT race_awards_pkey PRIMARY KEY (id);


--
-- Name: race_aid_stations race_catalog_aid_stations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_aid_stations
    ADD CONSTRAINT race_catalog_aid_stations_pkey PRIMARY KEY (id);


--
-- Name: races race_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.races
    ADD CONSTRAINT race_catalog_pkey PRIMARY KEY (id);


--
-- Name: races race_catalog_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.races
    ADD CONSTRAINT race_catalog_slug_key UNIQUE (slug);


--
-- Name: race_edition_services race_edition_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_edition_services
    ADD CONSTRAINT race_edition_services_pkey PRIMARY KEY (id);


--
-- Name: race_event_claims race_event_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_claims
    ADD CONSTRAINT race_event_claims_pkey PRIMARY KEY (id);


--
-- Name: race_event_edition_branding race_event_edition_branding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_edition_branding
    ADD CONSTRAINT race_event_edition_branding_pkey PRIMARY KEY (edition_id);


--
-- Name: race_event_edition_requests race_event_edition_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_edition_requests
    ADD CONSTRAINT race_event_edition_requests_pkey PRIMARY KEY (id);


--
-- Name: race_event_edition_sponsors race_event_edition_sponsors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_edition_sponsors
    ADD CONSTRAINT race_event_edition_sponsors_pkey PRIMARY KEY (id);


--
-- Name: race_event_editions race_event_editions_event_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_editions
    ADD CONSTRAINT race_event_editions_event_year_key UNIQUE (event_id, edition_year);


--
-- Name: race_event_editions race_event_editions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_editions
    ADD CONSTRAINT race_event_editions_pkey PRIMARY KEY (id);


--
-- Name: race_event_organizers race_event_organizers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_organizers
    ADD CONSTRAINT race_event_organizers_pkey PRIMARY KEY (id);


--
-- Name: race_event_publication_requests race_event_publication_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_publication_requests
    ADD CONSTRAINT race_event_publication_requests_pkey PRIMARY KEY (id);


--
-- Name: race_event_update_reads race_event_update_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_update_reads
    ADD CONSTRAINT race_event_update_reads_pkey PRIMARY KEY (update_id, user_id);


--
-- Name: race_event_updates race_event_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_updates
    ADD CONSTRAINT race_event_updates_pkey PRIMARY KEY (id);


--
-- Name: race_events race_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_events
    ADD CONSTRAINT race_events_pkey PRIMARY KEY (id);


--
-- Name: race_plans race_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_plans
    ADD CONSTRAINT race_plans_pkey PRIMARY KEY (id);


--
-- Name: race_relay_points race_relay_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_relay_points
    ADD CONSTRAINT race_relay_points_pkey PRIMARY KEY (id);


--
-- Name: race_requests race_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_requests
    ADD CONSTRAINT race_requests_pkey PRIMARY KEY (id);


--
-- Name: race_slug_redirects race_slug_redirects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_slug_redirects
    ADD CONSTRAINT race_slug_redirects_pkey PRIMARY KEY (old_slug);


--
-- Name: race_start_waves race_start_waves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_start_waves
    ADD CONSTRAINT race_start_waves_pkey PRIMARY KEY (id);


--
-- Name: racebook_gear_checks racebook_gear_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racebook_gear_checks
    ADD CONSTRAINT racebook_gear_checks_pkey PRIMARY KEY (user_id, race_id, item_key);


--
-- Name: rate_limit_entries rate_limit_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_entries
    ADD CONSTRAINT rate_limit_entries_pkey PRIMARY KEY (key);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (user_id);


--
-- Name: user_favorite_products user_favorite_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorite_products
    ADD CONSTRAINT user_favorite_products_pkey PRIMARY KEY (id);


--
-- Name: user_favorite_products user_favorite_products_user_product_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorite_products
    ADD CONSTRAINT user_favorite_products_user_product_key UNIQUE (user_id, product_id);


--
-- Name: user_favorite_race_events user_favorite_race_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorite_race_events
    ADD CONSTRAINT user_favorite_race_events_pkey PRIMARY KEY (id);


--
-- Name: user_favorite_race_events user_favorite_race_events_user_event_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorite_race_events
    ADD CONSTRAINT user_favorite_race_events_user_event_key UNIQUE (user_id, event_id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: messages messages_payload_exclusive; Type: CHECK CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages
    ADD CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL))) NOT VALID;


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_idempotency_key_key; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: mfa_recovery_codes_set_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_recovery_codes_set_id_idx ON auth.mfa_recovery_codes USING btree (mfa_recovery_code_set_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: scim_tokens_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_tokens_expires_at_idx ON auth.scim_tokens USING btree (expires_at);


--
-- Name: scim_tokens_revoked_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_tokens_revoked_at_idx ON auth.scim_tokens USING btree (revoked_at);


--
-- Name: scim_tokens_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_tokens_sso_provider_id_idx ON auth.scim_tokens USING btree (sso_provider_id);


--
-- Name: scim_tokens_token_hash_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX scim_tokens_token_hash_key ON auth.scim_tokens USING btree (token_hash);


--
-- Name: scim_users_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_created_at_idx ON auth.scim_users USING btree (sso_provider_id, created_at, id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_deleted_at_idx ON auth.scim_users USING btree (deleted_at);


--
-- Name: scim_users_external_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX scim_users_external_id_key ON auth.scim_users USING btree (sso_provider_id, external_id) WHERE ((external_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: scim_users_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_id_idx ON auth.scim_users USING btree (sso_provider_id, id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_sso_provider_id_idx ON auth.scim_users USING btree (sso_provider_id);


--
-- Name: scim_users_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_updated_at_idx ON auth.scim_users USING btree (sso_provider_id, updated_at, id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_user_id_idx ON auth.scim_users USING btree (user_id);


--
-- Name: scim_users_user_name_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX scim_users_user_name_idx ON auth.scim_users USING btree (sso_provider_id, user_name COLLATE "C", id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_user_name_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX scim_users_user_name_key ON auth.scim_users USING btree (sso_provider_id, user_name) WHERE (deleted_at IS NULL);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: affiliate_offers_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_offers_active_idx ON public.affiliate_offers USING btree (active);


--
-- Name: affiliate_offers_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_offers_product_id_idx ON public.affiliate_offers USING btree (product_id);


--
-- Name: app_changelog_published_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_changelog_published_at_idx ON public.app_changelog USING btree (published_at DESC);


--
-- Name: app_feedback_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_feedback_created_at_idx ON public.app_feedback USING btree (created_at DESC);


--
-- Name: app_feedback_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_feedback_user_id_idx ON public.app_feedback USING btree (user_id);


--
-- Name: idx_races_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_races_event_id ON public.races USING btree (event_id);


--
-- Name: nutrition_plans_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nutrition_plans_user_id_idx ON public.nutrition_plans USING btree (user_id);


--
-- Name: organizer_edition_capability_grants_granted_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_edition_capability_grants_granted_by_idx ON public.organizer_edition_capability_grants USING btree (granted_by) WHERE (granted_by IS NOT NULL);


--
-- Name: organizer_edition_capability_grants_revoked_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_edition_capability_grants_revoked_by_idx ON public.organizer_edition_capability_grants USING btree (revoked_by) WHERE (revoked_by IS NOT NULL);


--
-- Name: organizer_edition_entitlements_granted_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_edition_entitlements_granted_by_idx ON public.organizer_edition_entitlements USING btree (granted_by) WHERE (granted_by IS NOT NULL);


--
-- Name: organizer_edition_payments_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_edition_payments_created_at_idx ON public.organizer_edition_payments USING btree (created_at DESC);


--
-- Name: organizer_edition_payments_edition_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_edition_payments_edition_created_idx ON public.organizer_edition_payments USING btree (edition_id, created_at DESC);


--
-- Name: organizer_edition_payments_invalidated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_edition_payments_invalidated_at_idx ON public.organizer_edition_payments USING btree (invalidated_at DESC) WHERE (invalidated_at IS NOT NULL);


--
-- Name: organizer_edition_payments_invoice_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organizer_edition_payments_invoice_number_idx ON public.organizer_edition_payments USING btree (invoice_number) WHERE (invoice_number IS NOT NULL);


--
-- Name: organizer_edition_payments_invoice_uploaded_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_edition_payments_invoice_uploaded_by_idx ON public.organizer_edition_payments USING btree (invoice_uploaded_by) WHERE (invoice_uploaded_by IS NOT NULL);


--
-- Name: organizer_edition_payments_paid_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_edition_payments_paid_at_idx ON public.organizer_edition_payments USING btree (paid_at DESC) WHERE (paid_at IS NOT NULL);


--
-- Name: organizer_edition_payments_payment_intent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_edition_payments_payment_intent_idx ON public.organizer_edition_payments USING btree (stripe_payment_intent_id) WHERE (stripe_payment_intent_id IS NOT NULL);


--
-- Name: organizer_edition_payments_pending_edition_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organizer_edition_payments_pending_edition_idx ON public.organizer_edition_payments USING btree (edition_id) WHERE (status = 'pending'::text);


--
-- Name: organizer_edition_payments_purchaser_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_edition_payments_purchaser_user_id_idx ON public.organizer_edition_payments USING btree (purchaser_user_id) WHERE (purchaser_user_id IS NOT NULL);


--
-- Name: organizer_edition_payments_recorded_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_edition_payments_recorded_by_idx ON public.organizer_edition_payments USING btree (recorded_by) WHERE (recorded_by IS NOT NULL);


--
-- Name: organizer_edition_payments_stripe_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organizer_edition_payments_stripe_invoice_idx ON public.organizer_edition_payments USING btree (stripe_invoice_id) WHERE (stripe_invoice_id IS NOT NULL);


--
-- Name: organizer_import_sessions_active_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_import_sessions_active_event_idx ON public.organizer_import_sessions USING btree (event_id, edition_id, created_at DESC) WHERE (status = ANY (ARRAY['discovered'::text, 'formats_confirmed'::text, 'fields_analyzed'::text]));


--
-- Name: organizer_import_sessions_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_import_sessions_created_by_idx ON public.organizer_import_sessions USING btree (created_by);


--
-- Name: organizer_import_sessions_edition_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_import_sessions_edition_id_idx ON public.organizer_import_sessions USING btree (edition_id);


--
-- Name: organizer_import_sessions_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_import_sessions_event_id_idx ON public.organizer_import_sessions USING btree (event_id);


--
-- Name: organizer_import_sessions_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_import_sessions_expires_at_idx ON public.organizer_import_sessions USING btree (expires_at);


--
-- Name: organizer_racebook_module_settings_edition_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizer_racebook_module_settings_edition_idx ON public.organizer_racebook_module_settings USING btree (edition_id);


--
-- Name: organizer_racebook_module_settings_edition_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organizer_racebook_module_settings_edition_key_idx ON public.organizer_racebook_module_settings USING btree (edition_id, module_key) WHERE (race_id IS NULL);


--
-- Name: organizer_racebook_module_settings_race_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organizer_racebook_module_settings_race_key_idx ON public.organizer_racebook_module_settings USING btree (race_id, module_key) WHERE (race_id IS NOT NULL);


--
-- Name: plan_aid_stations_plan_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_aid_stations_plan_order_idx ON public.plan_aid_stations USING btree (plan_id, order_index);


--
-- Name: plan_share_links_active_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_share_links_active_token_idx ON public.plan_share_links USING btree (token_hash) WHERE (revoked_at IS NULL);


--
-- Name: plan_share_links_plan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_share_links_plan_idx ON public.plan_share_links USING btree (plan_id, created_at DESC);


--
-- Name: plan_share_links_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_share_links_user_idx ON public.plan_share_links USING btree (user_id, created_at DESC);


--
-- Name: premium_grants_starts_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX premium_grants_starts_at_idx ON public.premium_grants USING btree (starts_at);


--
-- Name: premium_grants_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX premium_grants_user_id_idx ON public.premium_grants USING btree (user_id);


--
-- Name: products_brand_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_brand_idx ON public.products USING btree (lower(brand)) WHERE ((brand IS NOT NULL) AND (brand <> ''::text));


--
-- Name: products_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_created_by_idx ON public.products USING btree (created_by);


--
-- Name: products_fuel_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_fuel_type_idx ON public.products USING btree (fuel_type);


--
-- Name: products_is_live_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_is_live_idx ON public.products USING btree (is_live);


--
-- Name: products_is_official_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_is_official_idx ON public.products USING btree (is_official) WHERE (is_official = true);


--
-- Name: products_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_slug_idx ON public.products USING btree (slug);


--
-- Name: push_devices_expo_push_token_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX push_devices_expo_push_token_uidx ON public.push_devices USING btree (expo_push_token);


--
-- Name: push_devices_last_seen_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_devices_last_seen_at_idx ON public.push_devices USING btree (last_seen_at) WHERE (notifications_enabled = true);


--
-- Name: push_devices_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_devices_user_id_idx ON public.push_devices USING btree (user_id);


--
-- Name: push_notification_events_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_notification_events_created_at_idx ON public.push_notification_events USING btree (created_at DESC);


--
-- Name: push_notification_events_device_dedupe_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX push_notification_events_device_dedupe_uidx ON public.push_notification_events USING btree (push_device_id, dedupe_key);


--
-- Name: push_notification_events_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_notification_events_kind_idx ON public.push_notification_events USING btree (notification_kind);


--
-- Name: push_notification_events_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_notification_events_user_id_idx ON public.push_notification_events USING btree (user_id);


--
-- Name: race_aid_station_products_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_aid_station_products_product_idx ON public.race_aid_station_products USING btree (product_id);


--
-- Name: race_aid_station_products_station_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_aid_station_products_station_idx ON public.race_aid_station_products USING btree (race_aid_station_id, order_index);


--
-- Name: race_aid_stations_race_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_aid_stations_race_order_idx ON public.race_aid_stations USING btree (race_id, order_index);


--
-- Name: race_awards_race_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_awards_race_order_idx ON public.race_awards USING btree (race_id, podium_time, order_index);


--
-- Name: race_catalog_race_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_catalog_race_date_idx ON public.races USING btree (race_date);


--
-- Name: race_edition_services_edition_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_edition_services_edition_order_idx ON public.race_edition_services USING btree (edition_id, service_type, order_index);


--
-- Name: race_event_claims_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_claims_event_idx ON public.race_event_claims USING btree (event_id, status);


--
-- Name: race_event_claims_open_user_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX race_event_claims_open_user_event_idx ON public.race_event_claims USING btree (user_id, event_id) WHERE (status = ANY (ARRAY['pending'::text, 'approved'::text]));


--
-- Name: race_event_claims_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_claims_user_idx ON public.race_event_claims USING btree (user_id, created_at DESC);


--
-- Name: race_event_edition_requests_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_edition_requests_event_idx ON public.race_event_edition_requests USING btree (event_id, status, requested_start_date DESC);


--
-- Name: race_event_edition_requests_open_event_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX race_event_edition_requests_open_event_date_idx ON public.race_event_edition_requests USING btree (event_id, requested_start_date) WHERE (status = ANY (ARRAY['pending'::text, 'approved'::text]));


--
-- Name: race_event_edition_requests_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_edition_requests_user_idx ON public.race_event_edition_requests USING btree (user_id, created_at DESC);


--
-- Name: race_event_edition_sponsors_edition_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_edition_sponsors_edition_position_idx ON public.race_event_edition_sponsors USING btree (edition_id, "position", created_at);


--
-- Name: race_event_editions_current_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX race_event_editions_current_event_idx ON public.race_event_editions USING btree (event_id) WHERE is_current;


--
-- Name: race_event_editions_event_start_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_editions_event_start_idx ON public.race_event_editions USING btree (event_id, start_date DESC);


--
-- Name: race_event_organizers_active_user_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX race_event_organizers_active_user_event_idx ON public.race_event_organizers USING btree (user_id, event_id) WHERE (revoked_at IS NULL);


--
-- Name: race_event_organizers_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_organizers_event_idx ON public.race_event_organizers USING btree (event_id);


--
-- Name: race_event_organizers_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_organizers_user_idx ON public.race_event_organizers USING btree (user_id);


--
-- Name: race_event_publication_requests_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_publication_requests_event_idx ON public.race_event_publication_requests USING btree (event_id, status, created_at DESC);


--
-- Name: race_event_publication_requests_pending_legacy_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX race_event_publication_requests_pending_legacy_event_idx ON public.race_event_publication_requests USING btree (event_id) WHERE ((status = 'pending'::text) AND (race_id IS NULL));


--
-- Name: race_event_publication_requests_pending_race_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX race_event_publication_requests_pending_race_idx ON public.race_event_publication_requests USING btree (race_id) WHERE ((status = 'pending'::text) AND (race_id IS NOT NULL));


--
-- Name: race_event_publication_requests_race_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_publication_requests_race_idx ON public.race_event_publication_requests USING btree (race_id, status, created_at DESC);


--
-- Name: race_event_publication_requests_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_publication_requests_user_idx ON public.race_event_publication_requests USING btree (user_id, created_at DESC);


--
-- Name: race_event_update_reads_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_update_reads_user_idx ON public.race_event_update_reads USING btree (user_id, read_at DESC);


--
-- Name: race_event_updates_event_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_updates_event_created_idx ON public.race_event_updates USING btree (event_id, created_at DESC);


--
-- Name: race_event_updates_race_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_event_updates_race_created_idx ON public.race_event_updates USING btree (race_id, created_at DESC) WHERE (race_id IS NOT NULL);


--
-- Name: race_events_location_city_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_events_location_city_code_idx ON public.race_events USING btree (location_city_code) WHERE (location_city_code IS NOT NULL);


--
-- Name: race_events_location_coordinates_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_events_location_coordinates_idx ON public.race_events USING btree (location_latitude, location_longitude) WHERE ((location_latitude IS NOT NULL) AND (location_longitude IS NOT NULL));


--
-- Name: race_events_location_department_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_events_location_department_code_idx ON public.race_events USING btree (location_department_code) WHERE (location_department_code IS NOT NULL);


--
-- Name: race_events_location_region_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_events_location_region_code_idx ON public.race_events USING btree (location_region_code) WHERE (location_region_code IS NOT NULL);


--
-- Name: race_plans_created_at_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_plans_created_at_user_id_idx ON public.race_plans USING btree (created_at, user_id);


--
-- Name: race_plans_updated_at_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_plans_updated_at_user_id_idx ON public.race_plans USING btree (updated_at, user_id);


--
-- Name: race_plans_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_plans_user_id_idx ON public.race_plans USING btree (user_id);


--
-- Name: race_relay_points_aid_station_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_relay_points_aid_station_idx ON public.race_relay_points USING btree (race_aid_station_id) WHERE (race_aid_station_id IS NOT NULL);


--
-- Name: race_relay_points_race_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_relay_points_race_order_idx ON public.race_relay_points USING btree (race_id, order_index);


--
-- Name: race_requests_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_requests_created_at_idx ON public.race_requests USING btree (created_at DESC);


--
-- Name: race_requests_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_requests_user_id_idx ON public.race_requests USING btree (user_id);


--
-- Name: race_slug_redirects_race_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_slug_redirects_race_id_idx ON public.race_slug_redirects USING btree (race_id);


--
-- Name: race_start_waves_race_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX race_start_waves_race_order_idx ON public.race_start_waves USING btree (race_id, order_index);


--
-- Name: racebook_gear_checks_race_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX racebook_gear_checks_race_idx ON public.racebook_gear_checks USING btree (race_id);


--
-- Name: races_edition_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX races_edition_id_idx ON public.races USING btree (edition_id);


--
-- Name: races_event_edition_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX races_event_edition_group_idx ON public.races USING btree (event_id, edition_group_id, race_date DESC);


--
-- Name: races_is_live_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX races_is_live_idx ON public.races USING btree (is_live);


--
-- Name: races_is_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX races_is_public_idx ON public.races USING btree (is_public);


--
-- Name: races_web_catalog_date_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX races_web_catalog_date_name_idx ON public.races USING btree (race_date, name) WHERE ((is_public = true) AND (web_catalog_is_live = true));


--
-- Name: subscriptions_stripe_subscription_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscriptions_stripe_subscription_id_idx ON public.subscriptions USING btree (stripe_subscription_id);


--
-- Name: subscriptions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscriptions_user_id_idx ON public.subscriptions USING btree (user_id);


--
-- Name: user_favorite_products_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_favorite_products_product_idx ON public.user_favorite_products USING btree (product_id);


--
-- Name: user_favorite_products_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_favorite_products_user_idx ON public.user_favorite_products USING btree (user_id);


--
-- Name: user_favorite_race_events_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_favorite_race_events_event_idx ON public.user_favorite_race_events USING btree (event_id, created_at DESC);


--
-- Name: user_favorite_race_events_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_favorite_race_events_user_idx ON public.user_favorite_race_events USING btree (user_id, created_at DESC);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_selec; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_selec ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter, COALESCE(selected_columns, '{}'::text[]));


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: idx_objects_current_version; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_objects_current_version ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE (archived_at IS NULL);


--
-- Name: idx_objects_delete_markers; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_delete_markers ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE is_delete_marker;


--
-- Name: idx_objects_null_version; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_objects_null_version ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE (NOT is_versioned);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_name_version_key; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_name_version_key ON storage.objects USING btree (bucket_id, name COLLATE "C", version) NULLS NOT DISTINCT;


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: users on_auth_user_created_create_profile; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created_create_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();


--
-- Name: races assign_race_event_edition_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER assign_race_event_edition_trigger BEFORE INSERT OR UPDATE OF event_id, edition_id, race_date ON public.races FOR EACH ROW EXECUTE FUNCTION public.assign_race_event_edition();


--
-- Name: race_events clear_stale_race_event_geography; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clear_stale_race_event_geography BEFORE UPDATE OF location ON public.race_events FOR EACH ROW EXECUTE FUNCTION public.clear_stale_race_event_geography();


--
-- Name: races enforce_race_catalog_completeness; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_race_catalog_completeness BEFORE INSERT OR UPDATE OF name, slug, race_date, location, location_text, distance_km, source_url, external_site_url, data_status, missing_required_fields, is_live, racebook_is_live ON public.races FOR EACH ROW EXECUTE FUNCTION public.enforce_race_catalog_completeness();


--
-- Name: races enforce_race_event_edition_visibility; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_race_event_edition_visibility BEFORE INSERT OR UPDATE OF edition_id, is_live, racebook_is_live ON public.races FOR EACH ROW EXECUTE FUNCTION public.enforce_race_event_edition_visibility();


--
-- Name: race_event_edition_sponsors enforce_racebook_sponsor_limits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_racebook_sponsor_limits BEFORE INSERT OR UPDATE ON public.race_event_edition_sponsors FOR EACH ROW EXECUTE FUNCTION public.enforce_racebook_sponsor_limits();


--
-- Name: race_event_editions ensure_organizer_edition_entitlement_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ensure_organizer_edition_entitlement_trigger AFTER INSERT ON public.race_event_editions FOR EACH ROW EXECUTE FUNCTION public.ensure_organizer_edition_entitlement();


--
-- Name: race_event_editions initialize_organizer_edition_modules_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER initialize_organizer_edition_modules_trigger AFTER INSERT ON public.race_event_editions FOR EACH ROW EXECUTE FUNCTION public.initialize_organizer_edition_modules();


--
-- Name: races initialize_organizer_race_modules_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER initialize_organizer_race_modules_trigger AFTER INSERT OR UPDATE OF edition_id ON public.races FOR EACH ROW EXECUTE FUNCTION public.initialize_organizer_race_modules();


--
-- Name: organizer_edition_payments protect_issued_organizer_invoice_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_issued_organizer_invoice_trigger BEFORE DELETE OR UPDATE ON public.organizer_edition_payments FOR EACH ROW EXECUTE FUNCTION private.protect_issued_organizer_invoice();


--
-- Name: user_profiles protect_server_managed_profile_fields_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_server_managed_profile_fields_insert BEFORE INSERT ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.protect_server_managed_profile_fields();


--
-- Name: user_profiles protect_server_managed_profile_fields_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_server_managed_profile_fields_update BEFORE UPDATE OF role, trial_started_at, trial_ends_at, sign_in_count, first_sign_in_at, last_sign_in_at ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.protect_server_managed_profile_fields();


--
-- Name: races record_race_slug_redirect; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER record_race_slug_redirect BEFORE INSERT OR UPDATE OF slug ON public.races FOR EACH ROW EXECUTE FUNCTION public.record_race_slug_redirect();


--
-- Name: affiliate_offers set_affiliate_offers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_affiliate_offers_updated_at BEFORE UPDATE ON public.affiliate_offers FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_offers_updated_at();


--
-- Name: organizer_import_sessions set_organizer_import_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_organizer_import_sessions_updated_at BEFORE UPDATE ON public.organizer_import_sessions FOR EACH ROW EXECUTE FUNCTION public.set_organizer_import_sessions_updated_at();


--
-- Name: plan_share_links set_plan_share_links_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_plan_share_links_updated_at BEFORE UPDATE ON public.plan_share_links FOR EACH ROW EXECUTE FUNCTION public.set_plan_share_links_updated_at();


--
-- Name: premium_grants set_premium_grants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_premium_grants_updated_at BEFORE UPDATE ON public.premium_grants FOR EACH ROW EXECUTE FUNCTION public.set_premium_grants_updated_at();


--
-- Name: products set_product_brand; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_product_brand BEFORE INSERT OR UPDATE OF brand, name, slug ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_product_brand();


--
-- Name: products set_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_products_updated_at();


--
-- Name: push_devices set_push_devices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_push_devices_updated_at BEFORE UPDATE ON public.push_devices FOR EACH ROW EXECUTE FUNCTION public.set_push_devices_updated_at();


--
-- Name: race_aid_station_products set_race_aid_station_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_race_aid_station_products_updated_at BEFORE UPDATE ON public.race_aid_station_products FOR EACH ROW EXECUTE FUNCTION public.set_race_aid_station_products_updated_at();


--
-- Name: race_awards set_race_awards_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_race_awards_updated_at BEFORE UPDATE ON public.race_awards FOR EACH ROW EXECUTE FUNCTION public.set_structured_racebook_updated_at();


--
-- Name: race_edition_services set_race_edition_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_race_edition_services_updated_at BEFORE UPDATE ON public.race_edition_services FOR EACH ROW EXECUTE FUNCTION public.set_structured_racebook_updated_at();


--
-- Name: race_event_claims set_race_event_claims_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_race_event_claims_updated_at BEFORE UPDATE ON public.race_event_claims FOR EACH ROW EXECUTE FUNCTION public.set_race_event_claims_updated_at();


--
-- Name: race_event_edition_branding set_race_event_edition_branding_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_race_event_edition_branding_updated_at BEFORE UPDATE ON public.race_event_edition_branding FOR EACH ROW EXECUTE FUNCTION public.set_race_event_edition_branding_updated_at();


--
-- Name: race_event_edition_requests set_race_event_edition_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_race_event_edition_requests_updated_at BEFORE UPDATE ON public.race_event_edition_requests FOR EACH ROW EXECUTE FUNCTION public.set_race_event_edition_requests_updated_at();


--
-- Name: race_event_edition_sponsors set_race_event_edition_sponsors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_race_event_edition_sponsors_updated_at BEFORE UPDATE ON public.race_event_edition_sponsors FOR EACH ROW EXECUTE FUNCTION public.set_race_event_edition_sponsors_updated_at();


--
-- Name: race_event_editions set_race_event_editions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_race_event_editions_updated_at BEFORE UPDATE ON public.race_event_editions FOR EACH ROW EXECUTE FUNCTION public.set_race_event_editions_updated_at();


--
-- Name: race_event_publication_requests set_race_event_publication_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_race_event_publication_requests_updated_at BEFORE UPDATE ON public.race_event_publication_requests FOR EACH ROW EXECUTE FUNCTION public.set_race_event_publication_requests_updated_at();


--
-- Name: race_plans set_race_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_race_plans_updated_at BEFORE UPDATE ON public.race_plans FOR EACH ROW EXECUTE FUNCTION public.set_race_plans_updated_at();


--
-- Name: race_start_waves set_race_start_waves_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_race_start_waves_updated_at BEFORE UPDATE ON public.race_start_waves FOR EACH ROW EXECUTE FUNCTION public.set_structured_racebook_updated_at();


--
-- Name: races set_races_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_races_updated_at BEFORE UPDATE ON public.races FOR EACH ROW EXECUTE FUNCTION public.set_races_updated_at();


--
-- Name: subscriptions set_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_subscriptions_updated_at();


--
-- Name: user_profiles set_user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.set_user_profiles_updated_at();


--
-- Name: race_event_editions sync_current_race_event_edition_dates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_current_race_event_edition_dates AFTER INSERT OR UPDATE OF start_date, end_date, is_current ON public.race_event_editions FOR EACH ROW EXECUTE FUNCTION public.sync_current_race_event_edition_dates();


--
-- Name: race_event_editions sync_race_event_edition_visibility; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_race_event_edition_visibility AFTER UPDATE OF is_visible ON public.race_event_editions FOR EACH ROW EXECUTE FUNCTION public.sync_race_event_edition_visibility();


--
-- Name: races sync_race_web_catalog_visibility; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_race_web_catalog_visibility BEFORE INSERT OR UPDATE OF is_public, is_live, web_catalog_is_live ON public.races FOR EACH ROW EXECUTE FUNCTION public.sync_race_web_catalog_visibility();


--
-- Name: race_aid_stations trg_sync_race_has_aid_stations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_race_has_aid_stations AFTER INSERT OR DELETE OR UPDATE ON public.race_aid_stations FOR EACH ROW EXECUTE FUNCTION public.sync_race_has_aid_stations();


--
-- Name: organizer_import_sessions validate_organizer_import_session_scope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_organizer_import_session_scope BEFORE INSERT OR UPDATE OF event_id, edition_id ON public.organizer_import_sessions FOR EACH ROW EXECUTE FUNCTION public.validate_organizer_import_session_scope();


--
-- Name: organizer_racebook_module_settings validate_organizer_racebook_module_setting_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_organizer_racebook_module_setting_trigger BEFORE INSERT OR UPDATE ON public.organizer_racebook_module_settings FOR EACH ROW EXECUTE FUNCTION public.validate_organizer_racebook_module_setting();


--
-- Name: races validate_race_edition_membership; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_race_edition_membership BEFORE INSERT OR UPDATE OF event_id, edition_id, race_date ON public.races FOR EACH ROW EXECUTE FUNCTION public.validate_race_edition_membership();


--
-- Name: race_event_editions validate_race_event_edition_range; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_race_event_edition_range BEFORE UPDATE OF start_date, end_date ON public.race_event_editions FOR EACH ROW EXECUTE FUNCTION public.validate_race_event_edition_range();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_bucket_control_insert; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns('service_role');


--
-- Name: buckets protect_bucket_control_update; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns();


--
-- Name: buckets protect_bucket_control_update_role; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('service_role');


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_mfa_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_mfa_factor_id_fkey FOREIGN KEY (mfa_factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_recovery_codes mfa_recovery_codes_mfa_recovery_code_set_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_recovery_codes
    ADD CONSTRAINT mfa_recovery_codes_mfa_recovery_code_set_id_fkey FOREIGN KEY (mfa_recovery_code_set_id) REFERENCES auth.mfa_recovery_code_sets(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: scim_tokens scim_tokens_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.scim_tokens
    ADD CONSTRAINT scim_tokens_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: scim_users scim_users_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.scim_users
    ADD CONSTRAINT scim_users_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: scim_users scim_users_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.scim_users
    ADD CONSTRAINT scim_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: affiliate_offers affiliate_offers_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_offers
    ADD CONSTRAINT affiliate_offers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: app_feedback app_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_feedback
    ADD CONSTRAINT app_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: nutrition_plans nutrition_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_plans
    ADD CONSTRAINT nutrition_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organizer_edition_capability_grants organizer_edition_capability_grants_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_capability_grants
    ADD CONSTRAINT organizer_edition_capability_grants_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.race_event_editions(id) ON DELETE CASCADE;


--
-- Name: organizer_edition_capability_grants organizer_edition_capability_grants_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_capability_grants
    ADD CONSTRAINT organizer_edition_capability_grants_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: organizer_edition_capability_grants organizer_edition_capability_grants_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_capability_grants
    ADD CONSTRAINT organizer_edition_capability_grants_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: organizer_edition_entitlements organizer_edition_entitlements_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_entitlements
    ADD CONSTRAINT organizer_edition_entitlements_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.race_event_editions(id) ON DELETE CASCADE;


--
-- Name: organizer_edition_entitlements organizer_edition_entitlements_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_entitlements
    ADD CONSTRAINT organizer_edition_entitlements_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: organizer_edition_payments organizer_edition_payments_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_payments
    ADD CONSTRAINT organizer_edition_payments_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.race_event_editions(id) ON DELETE CASCADE;


--
-- Name: organizer_edition_payments organizer_edition_payments_invoice_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_payments
    ADD CONSTRAINT organizer_edition_payments_invoice_uploaded_by_fkey FOREIGN KEY (invoice_uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: organizer_edition_payments organizer_edition_payments_purchaser_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_payments
    ADD CONSTRAINT organizer_edition_payments_purchaser_user_id_fkey FOREIGN KEY (purchaser_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: organizer_edition_payments organizer_edition_payments_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_edition_payments
    ADD CONSTRAINT organizer_edition_payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: organizer_import_sessions organizer_import_sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_import_sessions
    ADD CONSTRAINT organizer_import_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organizer_import_sessions organizer_import_sessions_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_import_sessions
    ADD CONSTRAINT organizer_import_sessions_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.race_event_editions(id) ON DELETE CASCADE;


--
-- Name: organizer_import_sessions organizer_import_sessions_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_import_sessions
    ADD CONSTRAINT organizer_import_sessions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.race_events(id) ON DELETE CASCADE;


--
-- Name: organizer_racebook_module_settings organizer_racebook_module_settings_configured_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_racebook_module_settings
    ADD CONSTRAINT organizer_racebook_module_settings_configured_by_fkey FOREIGN KEY (configured_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: organizer_racebook_module_settings organizer_racebook_module_settings_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_racebook_module_settings
    ADD CONSTRAINT organizer_racebook_module_settings_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.race_event_editions(id) ON DELETE CASCADE;


--
-- Name: organizer_racebook_module_settings organizer_racebook_module_settings_race_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizer_racebook_module_settings
    ADD CONSTRAINT organizer_racebook_module_settings_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id) ON DELETE CASCADE;


--
-- Name: plan_aid_stations plan_aid_stations_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_aid_stations
    ADD CONSTRAINT plan_aid_stations_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.race_plans(id) ON DELETE CASCADE;


--
-- Name: plan_aid_stations plan_aid_stations_race_aid_station_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_aid_stations
    ADD CONSTRAINT plan_aid_stations_race_aid_station_id_fkey FOREIGN KEY (race_aid_station_id) REFERENCES public.race_aid_stations(id) ON DELETE SET NULL;


--
-- Name: plan_share_links plan_share_links_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_share_links
    ADD CONSTRAINT plan_share_links_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.race_plans(id) ON DELETE CASCADE;


--
-- Name: plan_share_links plan_share_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_share_links
    ADD CONSTRAINT plan_share_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: premium_grants premium_grants_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_grants
    ADD CONSTRAINT premium_grants_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: premium_grants premium_grants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_grants
    ADD CONSTRAINT premium_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: products products_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: push_devices push_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: push_notification_events push_notification_events_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_notification_events
    ADD CONSTRAINT push_notification_events_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.race_plans(id) ON DELETE CASCADE;


--
-- Name: push_notification_events push_notification_events_push_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_notification_events
    ADD CONSTRAINT push_notification_events_push_device_id_fkey FOREIGN KEY (push_device_id) REFERENCES public.push_devices(id) ON DELETE CASCADE;


--
-- Name: push_notification_events push_notification_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_notification_events
    ADD CONSTRAINT push_notification_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: race_aid_station_products race_aid_station_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_aid_station_products
    ADD CONSTRAINT race_aid_station_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: race_aid_station_products race_aid_station_products_race_aid_station_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_aid_station_products
    ADD CONSTRAINT race_aid_station_products_race_aid_station_id_fkey FOREIGN KEY (race_aid_station_id) REFERENCES public.race_aid_stations(id) ON DELETE CASCADE;


--
-- Name: race_awards race_awards_race_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_awards
    ADD CONSTRAINT race_awards_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id) ON DELETE CASCADE;


--
-- Name: race_aid_stations race_catalog_aid_stations_race_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_aid_stations
    ADD CONSTRAINT race_catalog_aid_stations_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id) ON DELETE CASCADE;


--
-- Name: race_edition_services race_edition_services_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_edition_services
    ADD CONSTRAINT race_edition_services_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.race_event_editions(id) ON DELETE CASCADE;


--
-- Name: race_event_claims race_event_claims_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_claims
    ADD CONSTRAINT race_event_claims_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.race_events(id) ON DELETE CASCADE;


--
-- Name: race_event_claims race_event_claims_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_claims
    ADD CONSTRAINT race_event_claims_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: race_event_claims race_event_claims_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_claims
    ADD CONSTRAINT race_event_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: race_event_edition_branding race_event_edition_branding_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_edition_branding
    ADD CONSTRAINT race_event_edition_branding_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.race_event_editions(id) ON DELETE CASCADE;


--
-- Name: race_event_edition_requests race_event_edition_requests_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_edition_requests
    ADD CONSTRAINT race_event_edition_requests_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.race_events(id) ON DELETE CASCADE;


--
-- Name: race_event_edition_requests race_event_edition_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_edition_requests
    ADD CONSTRAINT race_event_edition_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: race_event_edition_requests race_event_edition_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_edition_requests
    ADD CONSTRAINT race_event_edition_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: race_event_edition_sponsors race_event_edition_sponsors_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_edition_sponsors
    ADD CONSTRAINT race_event_edition_sponsors_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.race_event_editions(id) ON DELETE CASCADE;


--
-- Name: race_event_editions race_event_editions_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_editions
    ADD CONSTRAINT race_event_editions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.race_events(id) ON DELETE CASCADE;


--
-- Name: race_event_organizers race_event_organizers_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_organizers
    ADD CONSTRAINT race_event_organizers_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.race_event_claims(id) ON DELETE SET NULL;


--
-- Name: race_event_organizers race_event_organizers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_organizers
    ADD CONSTRAINT race_event_organizers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: race_event_organizers race_event_organizers_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_organizers
    ADD CONSTRAINT race_event_organizers_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.race_events(id) ON DELETE CASCADE;


--
-- Name: race_event_organizers race_event_organizers_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_organizers
    ADD CONSTRAINT race_event_organizers_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: race_event_organizers race_event_organizers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_organizers
    ADD CONSTRAINT race_event_organizers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: race_event_publication_requests race_event_publication_requests_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_publication_requests
    ADD CONSTRAINT race_event_publication_requests_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.race_events(id) ON DELETE CASCADE;


--
-- Name: race_event_publication_requests race_event_publication_requests_race_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_publication_requests
    ADD CONSTRAINT race_event_publication_requests_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id) ON DELETE CASCADE;


--
-- Name: race_event_publication_requests race_event_publication_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_publication_requests
    ADD CONSTRAINT race_event_publication_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: race_event_publication_requests race_event_publication_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_publication_requests
    ADD CONSTRAINT race_event_publication_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: race_event_update_reads race_event_update_reads_update_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_update_reads
    ADD CONSTRAINT race_event_update_reads_update_id_fkey FOREIGN KEY (update_id) REFERENCES public.race_event_updates(id) ON DELETE CASCADE;


--
-- Name: race_event_update_reads race_event_update_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_update_reads
    ADD CONSTRAINT race_event_update_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;


--
-- Name: race_event_updates race_event_updates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_updates
    ADD CONSTRAINT race_event_updates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: race_event_updates race_event_updates_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_updates
    ADD CONSTRAINT race_event_updates_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.race_events(id) ON DELETE CASCADE;


--
-- Name: race_event_updates race_event_updates_race_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_event_updates
    ADD CONSTRAINT race_event_updates_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id) ON DELETE SET NULL;


--
-- Name: race_plans race_plans_race_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_plans
    ADD CONSTRAINT race_plans_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id) ON DELETE SET NULL;


--
-- Name: race_plans race_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_plans
    ADD CONSTRAINT race_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: race_relay_points race_relay_points_race_aid_station_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_relay_points
    ADD CONSTRAINT race_relay_points_race_aid_station_id_fkey FOREIGN KEY (race_aid_station_id) REFERENCES public.race_aid_stations(id) ON DELETE SET NULL;


--
-- Name: race_relay_points race_relay_points_race_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_relay_points
    ADD CONSTRAINT race_relay_points_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id) ON DELETE CASCADE;


--
-- Name: race_slug_redirects race_slug_redirects_race_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_slug_redirects
    ADD CONSTRAINT race_slug_redirects_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id) ON DELETE CASCADE;


--
-- Name: race_start_waves race_start_waves_race_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_start_waves
    ADD CONSTRAINT race_start_waves_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id) ON DELETE CASCADE;


--
-- Name: racebook_gear_checks racebook_gear_checks_race_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racebook_gear_checks
    ADD CONSTRAINT racebook_gear_checks_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id) ON DELETE CASCADE;


--
-- Name: racebook_gear_checks racebook_gear_checks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racebook_gear_checks
    ADD CONSTRAINT racebook_gear_checks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;


--
-- Name: races races_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.races
    ADD CONSTRAINT races_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: races races_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.races
    ADD CONSTRAINT races_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.race_event_editions(id) ON DELETE CASCADE;


--
-- Name: races races_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.races
    ADD CONSTRAINT races_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.race_events(id) ON DELETE SET NULL;


--
-- Name: races races_racebook_publication_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.races
    ADD CONSTRAINT races_racebook_publication_approved_by_fkey FOREIGN KEY (racebook_publication_approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_favorite_products user_favorite_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorite_products
    ADD CONSTRAINT user_favorite_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: user_favorite_products user_favorite_products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorite_products
    ADD CONSTRAINT user_favorite_products_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_favorite_race_events user_favorite_race_events_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorite_race_events
    ADD CONSTRAINT user_favorite_race_events_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.race_events(id) ON DELETE CASCADE;


--
-- Name: user_favorite_race_events user_favorite_race_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorite_race_events
    ADD CONSTRAINT user_favorite_race_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: race_event_organizers Admins can manage organizer memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage organizer memberships" ON public.race_event_organizers TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)) WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));


--
-- Name: race_event_claims Admins can update race event claims; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update race event claims" ON public.race_event_claims FOR UPDATE TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)) WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));


--
-- Name: race_event_edition_requests Admins can update race event edition requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update race event edition requests" ON public.race_event_edition_requests FOR UPDATE TO authenticated USING ((COALESCE(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text)) WITH CHECK ((COALESCE(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text));


--
-- Name: products Anon can read live products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anon can read live products" ON public.products FOR SELECT TO anon USING (((is_live = true) AND (is_archived = false)));


--
-- Name: affiliate_offers Authenticated can read active affiliate offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can read active affiliate offers" ON public.affiliate_offers FOR SELECT USING ((((auth.role() = 'authenticated'::text) AND (active = true) AND (EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = affiliate_offers.product_id) AND (p.is_live = true) AND (p.is_archived = false))))) OR (auth.role() = 'service_role'::text)));


--
-- Name: products Authenticated can read live products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can read live products" ON public.products FOR SELECT USING ((((auth.role() = 'authenticated'::text) AND (is_live = true) AND (is_archived = false)) OR (auth.role() = 'service_role'::text)));


--
-- Name: app_feedback Authenticated users can insert app feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert app feedback" ON public.app_feedback FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: app_changelog Authenticated users can view app changelog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view app changelog" ON public.app_changelog FOR SELECT TO authenticated USING ((is_published = true));


--
-- Name: race_event_updates Live race event updates are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Live race event updates are viewable" ON public.race_event_updates FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.race_events re
  WHERE ((re.id = race_event_updates.event_id) AND (re.is_live = true)))));


--
-- Name: race_awards Managed awards are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managed awards are viewable" ON public.race_awards FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.races r
  WHERE ((r.id = race_awards.race_id) AND ((r.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.race_event_organizers o
          WHERE ((o.event_id = r.event_id) AND (o.user_id = ( SELECT auth.uid() AS uid)) AND (o.revoked_at IS NULL)))))))) OR (((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));


--
-- Name: race_edition_services Managed edition services are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managed edition services are viewable" ON public.race_edition_services FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.races race_row
  WHERE ((race_row.edition_id = race_edition_services.edition_id) AND ((race_row.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.race_event_organizers organizer_row
          WHERE ((organizer_row.event_id = race_row.event_id) AND (organizer_row.user_id = ( SELECT auth.uid() AS uid)) AND (organizer_row.revoked_at IS NULL)))))))) OR (((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));


--
-- Name: race_start_waves Managed start waves are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managed start waves are viewable" ON public.race_start_waves FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.races r
  WHERE ((r.id = race_start_waves.race_id) AND ((r.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.race_event_organizers o
          WHERE ((o.event_id = r.event_id) AND (o.user_id = ( SELECT auth.uid() AS uid)) AND (o.revoked_at IS NULL)))))))) OR (((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));


--
-- Name: race_slug_redirects Public race slug redirects are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public race slug redirects are viewable" ON public.race_slug_redirects FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.races race_row
  WHERE ((race_row.id = race_slug_redirects.race_id) AND (race_row.is_live = true) AND (race_row.is_public = true) AND ((race_row.event_id IS NULL) OR (EXISTS ( SELECT 1
           FROM public.race_events event_row
          WHERE ((event_row.id = race_row.event_id) AND (event_row.is_live = true)))))))));


--
-- Name: race_events Public read race_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read race_events" ON public.race_events FOR SELECT USING ((is_live = true));


--
-- Name: race_awards Published awards are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Published awards are viewable" ON public.race_awards FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.races race_row
  WHERE ((race_row.id = race_awards.race_id) AND private.racebook_module_is_enabled(race_row.id, 'awards'::text) AND ((race_row.is_public AND race_row.is_live AND race_row.racebook_is_live) OR (race_row.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.race_event_organizers organizer_row
          WHERE ((organizer_row.event_id = race_row.event_id) AND (organizer_row.user_id = ( SELECT auth.uid() AS uid)) AND (organizer_row.revoked_at IS NULL)))) OR (((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))))));


--
-- Name: race_edition_services Published edition services are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Published edition services are viewable" ON public.race_edition_services FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.races race_row
  WHERE ((race_row.edition_id = race_edition_services.edition_id) AND private.racebook_module_is_enabled(race_row.id, 'services'::text) AND ((race_row.is_public AND race_row.is_live AND race_row.racebook_is_live) OR (race_row.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.race_event_organizers organizer_row
          WHERE ((organizer_row.event_id = race_row.event_id) AND (organizer_row.user_id = ( SELECT auth.uid() AS uid)) AND (organizer_row.revoked_at IS NULL)))) OR (((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))))));


--
-- Name: race_start_waves Published start waves are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Published start waves are viewable" ON public.race_start_waves FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.races race_row
  WHERE ((race_row.id = race_start_waves.race_id) AND private.racebook_module_is_enabled(race_row.id, 'start_waves'::text) AND ((race_row.is_public AND race_row.is_live AND race_row.racebook_is_live) OR (race_row.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.race_event_organizers organizer_row
          WHERE ((organizer_row.event_id = race_row.event_id) AND (organizer_row.user_id = ( SELECT auth.uid() AS uid)) AND (organizer_row.revoked_at IS NULL)))) OR (((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))))));


--
-- Name: affiliate_offers Service role can manage affiliate offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage affiliate offers" ON public.affiliate_offers USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: products Service role can manage products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage products" ON public.products USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: push_devices Service role can manage push devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage push devices" ON public.push_devices USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: push_notification_events Service role can manage push notification events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage push notification events" ON public.push_notification_events USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: subscriptions Service role can upsert subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can upsert subscriptions" ON public.subscriptions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: premium_grants Service role or admins can manage premium grants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role or admins can manage premium grants" ON public.premium_grants TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: racebook_gear_checks Users can add own RaceBook gear checks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add own RaceBook gear checks" ON public.racebook_gear_checks FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_favorite_race_events Users can add own favorite race events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add own favorite race events" ON public.user_favorite_race_events FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: plan_share_links Users can create own plan share links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own plan share links" ON public.plan_share_links FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM public.race_plans
  WHERE ((race_plans.id = plan_share_links.plan_id) AND (race_plans.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: race_event_claims Users can create own race event claims; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own race event claims" ON public.race_event_claims FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (status = 'pending'::text)));


--
-- Name: race_event_publication_requests Users can create own race event publication requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own race event publication requests" ON public.race_event_publication_requests FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (status = 'pending'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.race_event_organizers organizer_row
  WHERE ((organizer_row.event_id = race_event_publication_requests.event_id) AND (organizer_row.user_id = ( SELECT auth.uid() AS uid)) AND (organizer_row.revoked_at IS NULL)))) AND ((race_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.races race_row
  WHERE ((race_row.id = race_event_publication_requests.race_id) AND (race_row.event_id = race_event_publication_requests.event_id)))))));


--
-- Name: user_favorite_race_events Users can delete own favorite race events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own favorite race events" ON public.user_favorite_race_events FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: plan_share_links Users can delete own plan share links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own plan share links" ON public.plan_share_links FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: plan_aid_stations Users can delete their plan aid stations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their plan aid stations" ON public.plan_aid_stations FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.race_plans
  WHERE ((race_plans.id = plan_aid_stations.plan_id) AND (race_plans.user_id = auth.uid())))));


--
-- Name: push_devices Users can delete their push devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their push devices" ON public.push_devices FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: race_plans Users can delete their race plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their race plans" ON public.race_plans FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: race_requests Users can insert race requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert race requests" ON public.race_requests FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: nutrition_plans Users can insert their own nutrition plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own nutrition plans" ON public.nutrition_plans FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: plan_aid_stations Users can insert their plan aid stations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their plan aid stations" ON public.plan_aid_stations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.race_plans
  WHERE ((race_plans.id = plan_aid_stations.plan_id) AND (race_plans.user_id = auth.uid())))));


--
-- Name: push_devices Users can insert their push devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their push devices" ON public.push_devices FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: race_plans Users can insert their race plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their race plans" ON public.race_plans FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_favorite_products Users can manage their favorite products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their favorite products" ON public.user_favorite_products USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: race_event_update_reads Users can mark own race event updates read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can mark own race event updates read" ON public.race_event_update_reads FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM (public.race_event_updates update_row
     JOIN public.race_events event_row ON ((event_row.id = update_row.event_id)))
  WHERE ((update_row.id = race_event_update_reads.update_id) AND (event_row.is_live = true))))));


--
-- Name: products Users can read own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own products" ON public.products FOR SELECT TO authenticated USING ((auth.uid() = created_by));


--
-- Name: premium_grants Users can read their active premium grants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their active premium grants" ON public.premium_grants FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) AND (starts_at <= now()) AND (COALESCE(ends_at, (starts_at + ((initial_duration_days || ' days'::text))::interval)) >= now())));


--
-- Name: subscriptions Users can read their subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their subscription" ON public.subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: racebook_gear_checks Users can remove own RaceBook gear checks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove own RaceBook gear checks" ON public.racebook_gear_checks FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: plan_share_links Users can update own plan share links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own plan share links" ON public.plan_share_links FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM public.race_plans
  WHERE ((race_plans.id = plan_share_links.plan_id) AND (race_plans.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: plan_aid_stations Users can update their plan aid stations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their plan aid stations" ON public.plan_aid_stations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.race_plans
  WHERE ((race_plans.id = plan_aid_stations.plan_id) AND (race_plans.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.race_plans
  WHERE ((race_plans.id = plan_aid_stations.plan_id) AND (race_plans.user_id = auth.uid())))));


--
-- Name: user_profiles Users can update their profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their profile" ON public.user_profiles FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: push_devices Users can update their push devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their push devices" ON public.push_devices FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: race_plans Users can update their race plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their race plans" ON public.race_plans FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_profiles Users can upsert their profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can upsert their profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: racebook_gear_checks Users can view own RaceBook gear checks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own RaceBook gear checks" ON public.racebook_gear_checks FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_favorite_race_events Users can view own favorite race events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own favorite race events" ON public.user_favorite_race_events FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: race_event_organizers Users can view own organizer memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own organizer memberships" ON public.race_event_organizers FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));


--
-- Name: plan_share_links Users can view own plan share links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own plan share links" ON public.plan_share_links FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: race_event_claims Users can view own race event claims; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own race event claims" ON public.race_event_claims FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));


--
-- Name: race_event_edition_requests Users can view own race event edition requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own race event edition requests" ON public.race_event_edition_requests FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR (COALESCE(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text)));


--
-- Name: race_event_publication_requests Users can view own race event publication requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own race event publication requests" ON public.race_event_publication_requests FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR (COALESCE(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text)));


--
-- Name: race_event_update_reads Users can view own race event update reads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own race event update reads" ON public.race_event_update_reads FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_favorite_products Users can view their favorite products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their favorite products" ON public.user_favorite_products FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: nutrition_plans Users can view their own nutrition plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own nutrition plans" ON public.nutrition_plans FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: plan_aid_stations Users can view their plan aid stations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their plan aid stations" ON public.plan_aid_stations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.race_plans
  WHERE ((race_plans.id = plan_aid_stations.plan_id) AND (race_plans.user_id = auth.uid())))));


--
-- Name: user_profiles Users can view their profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their profile" ON public.user_profiles FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: push_devices Users can view their push devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their push devices" ON public.push_devices FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: push_notification_events Users can view their push notification events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their push notification events" ON public.push_notification_events FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: race_plans Users can view their race plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their race plans" ON public.race_plans FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: race_requests Users can view their race requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their race requests" ON public.race_requests FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: race_aid_station_products Visible race aid station products are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Visible race aid station products are viewable" ON public.race_aid_station_products FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM (public.race_aid_stations station_row
     JOIN public.races race_row ON ((race_row.id = station_row.race_id)))
  WHERE ((station_row.id = race_aid_station_products.race_aid_station_id) AND private.racebook_module_is_enabled(race_row.id, 'official_products'::text) AND ((race_row.is_public AND race_row.is_live AND race_row.racebook_is_live) OR (race_row.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.race_event_organizers organizer_row
          WHERE ((organizer_row.event_id = race_row.event_id) AND (organizer_row.user_id = ( SELECT auth.uid() AS uid)) AND (organizer_row.revoked_at IS NULL)))) OR (((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))))));


--
-- Name: race_relay_points Visible race relay points are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Visible race relay points are viewable" ON public.race_relay_points FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.races race_row
  WHERE ((race_row.id = race_relay_points.race_id) AND private.racebook_module_is_enabled(race_row.id, 'relay'::text) AND ((race_row.is_public AND race_row.is_live AND race_row.racebook_is_live) OR (race_row.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.race_event_organizers organizer_row
          WHERE ((organizer_row.event_id = race_row.event_id) AND (organizer_row.user_id = ( SELECT auth.uid() AS uid)) AND (organizer_row.revoked_at IS NULL)))) OR (((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))))));


--
-- Name: affiliate_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: app_changelog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_changelog ENABLE ROW LEVEL SECURITY;

--
-- Name: app_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: nutrition_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: organizer_edition_capability_grants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizer_edition_capability_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: organizer_edition_entitlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizer_edition_entitlements ENABLE ROW LEVEL SECURITY;

--
-- Name: organizer_edition_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizer_edition_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: organizer_import_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizer_import_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: organizer_racebook_module_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizer_racebook_module_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_aid_stations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_aid_stations ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_share_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_share_links ENABLE ROW LEVEL SECURITY;

--
-- Name: premium_grants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.premium_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: push_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: push_notification_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_notification_events ENABLE ROW LEVEL SECURITY;

--
-- Name: race_aid_station_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_aid_station_products ENABLE ROW LEVEL SECURITY;

--
-- Name: race_aid_stations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_aid_stations ENABLE ROW LEVEL SECURITY;

--
-- Name: race_aid_stations race_aid_stations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY race_aid_stations_delete ON public.race_aid_stations FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.races race_row
  WHERE ((race_row.id = race_aid_stations.race_id) AND (((race_row.created_by = ( SELECT auth.uid() AS uid)) AND (race_row.is_public = false) AND (race_row.is_live = false) AND (race_row.is_published = false) AND (race_row.event_id IS NULL) AND (race_row.edition_id IS NULL) AND (race_row.edition_group_id = race_row.id) AND (race_row.racebook_preview_is_visible = false) AND (race_row.racebook_is_live = false) AND (race_row.racebook_publication_approved_at IS NULL) AND (race_row.racebook_publication_approved_by IS NULL)) OR ( SELECT public.is_admin() AS is_admin))))));


--
-- Name: race_aid_stations race_aid_stations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY race_aid_stations_insert ON public.race_aid_stations FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.races race_row
  WHERE ((race_row.id = race_aid_stations.race_id) AND (((race_row.created_by = ( SELECT auth.uid() AS uid)) AND (race_row.is_public = false) AND (race_row.is_live = false) AND (race_row.is_published = false) AND (race_row.event_id IS NULL) AND (race_row.edition_id IS NULL) AND (race_row.edition_group_id = race_row.id) AND (race_row.racebook_preview_is_visible = false) AND (race_row.racebook_is_live = false) AND (race_row.racebook_publication_approved_at IS NULL) AND (race_row.racebook_publication_approved_by IS NULL)) OR ( SELECT public.is_admin() AS is_admin))))));


--
-- Name: race_aid_stations race_aid_stations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY race_aid_stations_select ON public.race_aid_stations FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.races race_row
  WHERE ((race_row.id = race_aid_stations.race_id) AND private.racebook_module_is_enabled(race_row.id, 'aid_stations'::text) AND ((race_row.is_public AND race_row.is_live AND race_row.racebook_is_live) OR (race_row.created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.race_event_organizers organizer_row
          WHERE ((organizer_row.event_id = race_row.event_id) AND (organizer_row.user_id = ( SELECT auth.uid() AS uid)) AND (organizer_row.revoked_at IS NULL)))) OR (((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))))));


--
-- Name: race_aid_stations race_aid_stations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY race_aid_stations_update ON public.race_aid_stations FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.races race_row
  WHERE ((race_row.id = race_aid_stations.race_id) AND (((race_row.created_by = ( SELECT auth.uid() AS uid)) AND (race_row.is_public = false) AND (race_row.is_live = false) AND (race_row.is_published = false) AND (race_row.event_id IS NULL) AND (race_row.edition_id IS NULL) AND (race_row.edition_group_id = race_row.id) AND (race_row.racebook_preview_is_visible = false) AND (race_row.racebook_is_live = false) AND (race_row.racebook_publication_approved_at IS NULL) AND (race_row.racebook_publication_approved_by IS NULL)) OR ( SELECT public.is_admin() AS is_admin)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.races race_row
  WHERE ((race_row.id = race_aid_stations.race_id) AND (((race_row.created_by = ( SELECT auth.uid() AS uid)) AND (race_row.is_public = false) AND (race_row.is_live = false) AND (race_row.is_published = false) AND (race_row.event_id IS NULL) AND (race_row.edition_id IS NULL) AND (race_row.edition_group_id = race_row.id) AND (race_row.racebook_preview_is_visible = false) AND (race_row.racebook_is_live = false) AND (race_row.racebook_publication_approved_at IS NULL) AND (race_row.racebook_publication_approved_by IS NULL)) OR ( SELECT public.is_admin() AS is_admin))))));


--
-- Name: race_awards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_awards ENABLE ROW LEVEL SECURITY;

--
-- Name: race_edition_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_edition_services ENABLE ROW LEVEL SECURITY;

--
-- Name: race_event_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_event_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: race_event_edition_branding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_event_edition_branding ENABLE ROW LEVEL SECURITY;

--
-- Name: race_event_edition_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_event_edition_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: race_event_edition_sponsors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_event_edition_sponsors ENABLE ROW LEVEL SECURITY;

--
-- Name: race_event_editions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_event_editions ENABLE ROW LEVEL SECURITY;

--
-- Name: race_event_organizers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_event_organizers ENABLE ROW LEVEL SECURITY;

--
-- Name: race_event_publication_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_event_publication_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: race_event_update_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_event_update_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: race_event_updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_event_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: race_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_events ENABLE ROW LEVEL SECURITY;

--
-- Name: race_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: race_relay_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_relay_points ENABLE ROW LEVEL SECURITY;

--
-- Name: race_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: race_slug_redirects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_slug_redirects ENABLE ROW LEVEL SECURITY;

--
-- Name: race_start_waves; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_start_waves ENABLE ROW LEVEL SECURITY;

--
-- Name: racebook_gear_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.racebook_gear_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: races; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;

--
-- Name: races races_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY races_delete ON public.races FOR DELETE TO authenticated USING ((( SELECT public.is_admin() AS is_admin) OR ((created_by = ( SELECT auth.uid() AS uid)) AND (is_public = false) AND (is_live = false) AND (is_published = false) AND (event_id IS NULL) AND (edition_id IS NULL) AND (edition_group_id = id) AND (racebook_preview_is_visible = false) AND (racebook_is_live = false) AND (racebook_publication_approved_at IS NULL) AND (racebook_publication_approved_by IS NULL))));


--
-- Name: races races_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY races_insert ON public.races FOR INSERT TO authenticated WITH CHECK ((( SELECT public.is_admin() AS is_admin) OR ((created_by = ( SELECT auth.uid() AS uid)) AND (is_public = false) AND (is_live = false) AND (is_published = false) AND (event_id IS NULL) AND (edition_id IS NULL) AND (edition_group_id = id) AND (racebook_preview_is_visible = false) AND (racebook_is_live = false) AND (racebook_publication_approved_at IS NULL) AND (racebook_publication_approved_by IS NULL))));


--
-- Name: races races_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY races_select ON public.races FOR SELECT TO authenticated, anon USING ((((is_public = true) AND (is_live = true)) OR ((is_public = true) AND (racebook_preview_is_visible = true) AND (event_id IS NOT NULL) AND private.race_is_in_visible_catalog(event_id, edition_id)) OR (created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.race_event_organizers organizer_row
  WHERE ((organizer_row.event_id = races.event_id) AND (organizer_row.user_id = ( SELECT auth.uid() AS uid)) AND (organizer_row.revoked_at IS NULL)))) OR (COALESCE(((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text), ''::text) = 'admin'::text) OR (COALESCE(((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) -> 'roles'::text), '[]'::jsonb) ? 'admin'::text)));


--
-- Name: races races_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY races_update ON public.races FOR UPDATE TO authenticated USING ((( SELECT public.is_admin() AS is_admin) OR ((created_by = ( SELECT auth.uid() AS uid)) AND (is_public = false) AND (is_live = false) AND (is_published = false) AND (event_id IS NULL) AND (edition_id IS NULL) AND (edition_group_id = id) AND (racebook_preview_is_visible = false) AND (racebook_is_live = false) AND (racebook_publication_approved_at IS NULL) AND (racebook_publication_approved_by IS NULL)))) WITH CHECK ((( SELECT public.is_admin() AS is_admin) OR ((created_by = ( SELECT auth.uid() AS uid)) AND (is_public = false) AND (is_live = false) AND (is_published = false) AND (event_id IS NULL) AND (edition_id IS NULL) AND (edition_group_id = id) AND (racebook_preview_is_visible = false) AND (racebook_is_live = false) AND (racebook_publication_approved_at IS NULL) AND (racebook_publication_approved_by IS NULL))));


--
-- Name: rate_limit_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limit_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_favorite_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_favorite_products ENABLE ROW LEVEL SECURITY;

--
-- Name: user_favorite_race_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_favorite_race_events ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Admin delete race images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admin delete race images" ON storage.objects FOR DELETE USING (((bucket_id = 'race-images'::text) AND (((auth.jwt() ->> 'user_role'::text) = 'admin'::text) OR ((auth.jwt() -> 'user_roles'::text) ? 'admin'::text))));


--
-- Name: objects Admin update race images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admin update race images" ON storage.objects FOR UPDATE USING (((bucket_id = 'race-images'::text) AND (((auth.jwt() ->> 'user_role'::text) = 'admin'::text) OR ((auth.jwt() -> 'user_roles'::text) ? 'admin'::text))));


--
-- Name: objects Admin write race images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admin write race images" ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'race-images'::text) AND (((auth.jwt() ->> 'user_role'::text) = 'admin'::text) OR ((auth.jwt() -> 'user_roles'::text) ? 'admin'::text))));


--
-- Name: objects Organizers delete temporary imports; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Organizers delete temporary imports" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'organizer-imports'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));


--
-- Name: objects Organizers upload temporary imports; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Organizers upload temporary imports" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'organizer-imports'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));


--
-- Name: objects Public read product images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read product images" ON storage.objects FOR SELECT USING ((bucket_id = 'product-images'::text));


--
-- Name: objects Public read race images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read race images" ON storage.objects FOR SELECT USING ((bucket_id = 'race-images'::text));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- Name: SCHEMA cron; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA cron TO postgres WITH GRANT OPTION;


--
-- Name: SCHEMA extensions; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT ALL ON SCHEMA extensions TO dashboard_user;


--
-- Name: SCHEMA net; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA net TO supabase_functions_admin;
GRANT USAGE ON SCHEMA net TO postgres;
GRANT USAGE ON SCHEMA net TO anon;
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT USAGE ON SCHEMA net TO service_role;


--
-- Name: SCHEMA private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA private TO anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: SCHEMA realtime; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA realtime TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT USAGE ON SCHEMA realtime TO service_role;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;


--
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA storage TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON SCHEMA storage TO dashboard_user;


--
-- Name: SCHEMA vault; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA vault TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA vault TO service_role;


--
-- Name: FUNCTION embd_in(input cstring); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.embd_in(input cstring) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION embd_out(input extensions.embd); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.embd_out(input extensions.embd) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- Name: FUNCTION alter_job(job_id bigint, schedule text, command text, database text, username text, active boolean); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.alter_job(job_id bigint, schedule text, command text, database text, username text, active boolean) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION job_cache_invalidate(); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.job_cache_invalidate() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION schedule(schedule text, command text); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.schedule(schedule text, command text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION schedule(job_name text, schedule text, command text); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.schedule(job_name text, schedule text, command text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION schedule_in_database(job_name text, schedule text, command text, database text, username text, active boolean); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.schedule_in_database(job_name text, schedule text, command text, database text, username text, active boolean) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION unschedule(job_id bigint); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.unschedule(job_id bigint) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION unschedule(job_name text); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.unschedule(job_name text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION airtable_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.airtable_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION airtable_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.airtable_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION airtable_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.airtable_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION armor(bytea); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.armor(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO dashboard_user;


--
-- Name: FUNCTION armor(bytea, text[], text[]); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.armor(bytea, text[], text[]) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO dashboard_user;


--
-- Name: FUNCTION auth0_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.auth0_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION auth0_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.auth0_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION auth0_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.auth0_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION big_query_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.big_query_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION big_query_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.big_query_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION big_query_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.big_query_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION click_house_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.click_house_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION click_house_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.click_house_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION click_house_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.click_house_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION cognito_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.cognito_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION cognito_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.cognito_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION cognito_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.cognito_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION crypt(text, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.crypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION dearmor(text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.dearmor(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO dashboard_user;


--
-- Name: FUNCTION decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION decrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(bytea, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.digest(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(text, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.digest(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO dashboard_user;


--
-- Name: FUNCTION duckdb_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.duckdb_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION duckdb_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.duckdb_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION duckdb_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.duckdb_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION embd_distance(embd extensions.embd); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.embd_distance(embd extensions.embd) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION embd_knn(_left extensions.embd, _right extensions.embd); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.embd_knn(_left extensions.embd, _right extensions.embd) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION encrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION encrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION firebase_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.firebase_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION firebase_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.firebase_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION firebase_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.firebase_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION gen_random_bytes(integer); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.gen_random_bytes(integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO dashboard_user;


--
-- Name: FUNCTION gen_random_uuid(); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.gen_random_uuid() FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text, integer); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text, integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO dashboard_user;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.grant_pg_cron_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO dashboard_user;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.grant_pg_graphql_access() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION grant_pg_net_access(); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.grant_pg_net_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO dashboard_user;


--
-- Name: FUNCTION hello_world_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.hello_world_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hello_world_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.hello_world_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hello_world_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.hello_world_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hmac(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.hmac(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION hmac(text, text, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.hmac(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION iceberg_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.iceberg_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION iceberg_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.iceberg_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION iceberg_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.iceberg_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION logflare_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.logflare_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION logflare_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.logflare_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION logflare_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.logflare_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION metadata_filter(_left jsonb, _right jsonb); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.metadata_filter(_left jsonb, _right jsonb) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION mssql_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.mssql_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION mssql_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.mssql_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION mssql_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.mssql_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO dashboard_user;


--
-- Name: FUNCTION pgp_armor_headers(text, OUT key text, OUT value text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO dashboard_user;


--
-- Name: FUNCTION pgp_key_id(bytea); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_key_id(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgrst_ddl_watch(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgrst_ddl_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgrst_drop_watch(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgrst_drop_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION redis_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.redis_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION redis_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.redis_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION redis_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.redis_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION s3_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.s3_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION s3_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.s3_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION s3_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.s3_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION s3_vectors_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.s3_vectors_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION s3_vectors_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.s3_vectors_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION s3_vectors_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.s3_vectors_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.set_graphql_placeholder() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION stripe_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.stripe_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION stripe_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.stripe_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION stripe_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.stripe_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_generate_v1(); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v1mc(); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1mc() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v3(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v4(); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v4() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v5(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_nil(); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.uuid_nil() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_dns(); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_dns() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_oid(); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_oid() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_url(); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_url() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_x500(); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_x500() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO dashboard_user;


--
-- Name: FUNCTION wasm_fdw_handler(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.wasm_fdw_handler() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION wasm_fdw_meta(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.wasm_fdw_meta() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION wasm_fdw_validator(options text[], catalog oid); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.wasm_fdw_validator(options text[], catalog oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb); Type: ACL; Schema: graphql_public; Owner: -
--

GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO postgres;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO anon;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;


--
-- Name: FUNCTION pg_reload_conf(); Type: ACL; Schema: pg_catalog; Owner: -
--

GRANT ALL ON FUNCTION pg_catalog.pg_reload_conf() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION get_auth(p_usename text); Type: ACL; Schema: pgbouncer; Owner: -
--

REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename text) FROM PUBLIC;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;


--
-- Name: FUNCTION organizer_edition_is_pro(p_edition_id uuid); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.organizer_edition_is_pro(p_edition_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.organizer_edition_is_pro(p_edition_id uuid) TO anon;
GRANT ALL ON FUNCTION private.organizer_edition_is_pro(p_edition_id uuid) TO authenticated;
GRANT ALL ON FUNCTION private.organizer_edition_is_pro(p_edition_id uuid) TO service_role;


--
-- Name: FUNCTION organizer_tier_rank(p_tier text); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.organizer_tier_rank(p_tier text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.organizer_tier_rank(p_tier text) TO service_role;


--
-- Name: FUNCTION protect_issued_organizer_invoice(); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.protect_issued_organizer_invoice() FROM PUBLIC;
GRANT ALL ON FUNCTION private.protect_issued_organizer_invoice() TO service_role;


--
-- Name: FUNCTION race_is_in_visible_catalog(p_event_id uuid, p_edition_id uuid); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.race_is_in_visible_catalog(p_event_id uuid, p_edition_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.race_is_in_visible_catalog(p_event_id uuid, p_edition_id uuid) TO anon;
GRANT ALL ON FUNCTION private.race_is_in_visible_catalog(p_event_id uuid, p_edition_id uuid) TO authenticated;


--
-- Name: FUNCTION racebook_module_is_enabled(p_race_id uuid, p_module_key text); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.racebook_module_is_enabled(p_race_id uuid, p_module_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.racebook_module_is_enabled(p_race_id uuid, p_module_key text) TO anon;
GRANT ALL ON FUNCTION private.racebook_module_is_enabled(p_race_id uuid, p_module_key text) TO authenticated;
GRANT ALL ON FUNCTION private.racebook_module_is_enabled(p_race_id uuid, p_module_key text) TO service_role;


--
-- Name: FUNCTION user_has_trusted_admin_role(p_user_id uuid); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.user_has_trusted_admin_role(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.user_has_trusted_admin_role(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION apply_organizer_import_field_patches(p_session_id uuid, p_event_patch jsonb, p_race_patches jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.apply_organizer_import_field_patches(p_session_id uuid, p_event_patch jsonb, p_race_patches jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.apply_organizer_import_field_patches(p_session_id uuid, p_event_patch jsonb, p_race_patches jsonb) TO service_role;


--
-- Name: FUNCTION assign_race_event_edition(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_race_event_edition() FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_race_event_edition() TO service_role;


--
-- Name: FUNCTION check_and_increment_rate_limit(p_key text, p_limit integer, p_window_ms integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(p_key text, p_limit integer, p_window_ms integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_and_increment_rate_limit(p_key text, p_limit integer, p_window_ms integer) TO service_role;


--
-- Name: FUNCTION clear_stale_race_event_geography(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.clear_stale_race_event_geography() FROM PUBLIC;
GRANT ALL ON FUNCTION public.clear_stale_race_event_geography() TO service_role;


--
-- Name: FUNCTION configure_organizer_import_cleanup_cron(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.configure_organizer_import_cleanup_cron() FROM PUBLIC;
GRANT ALL ON FUNCTION public.configure_organizer_import_cleanup_cron() TO service_role;


--
-- Name: FUNCTION configure_push_reminders_cron(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.configure_push_reminders_cron() FROM PUBLIC;
GRANT ALL ON FUNCTION public.configure_push_reminders_cron() TO service_role;


--
-- Name: FUNCTION confirm_organizer_import_formats(p_session_id uuid, p_formats jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirm_organizer_import_formats(p_session_id uuid, p_formats jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirm_organizer_import_formats(p_session_id uuid, p_formats jsonb) TO service_role;


--
-- Name: FUNCTION create_organizer_aid_station_product(p_race_id uuid, p_aid_station_id uuid, p_product jsonb, p_notes text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_organizer_aid_station_product(p_race_id uuid, p_aid_station_id uuid, p_product jsonb, p_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_organizer_aid_station_product(p_race_id uuid, p_aid_station_id uuid, p_product jsonb, p_notes text) TO service_role;


--
-- Name: FUNCTION delete_race_event_edition(p_edition_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_race_event_edition(p_edition_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_race_event_edition(p_edition_id uuid) TO service_role;


--
-- Name: FUNCTION enforce_race_catalog_completeness(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_race_catalog_completeness() TO anon;
GRANT ALL ON FUNCTION public.enforce_race_catalog_completeness() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_race_catalog_completeness() TO service_role;


--
-- Name: FUNCTION enforce_race_event_edition_visibility(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_race_event_edition_visibility() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_race_event_edition_visibility() TO service_role;


--
-- Name: FUNCTION enforce_racebook_sponsor_limits(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_racebook_sponsor_limits() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_racebook_sponsor_limits() TO service_role;


--
-- Name: FUNCTION ensure_organizer_edition_entitlement(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ensure_organizer_edition_entitlement() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ensure_organizer_edition_entitlement() TO service_role;


--
-- Name: FUNCTION get_admin_growth_metrics(p_start_date date, p_end_date date, p_timezone text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_admin_growth_metrics(p_start_date date, p_end_date date, p_timezone text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_admin_growth_metrics(p_start_date date, p_end_date date, p_timezone text) TO service_role;


--
-- Name: FUNCTION get_admin_user_rows(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_admin_user_rows() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_admin_user_rows() TO service_role;


--
-- Name: FUNCTION get_signups_by_day(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_signups_by_day() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_signups_by_day() TO service_role;


--
-- Name: FUNCTION get_signups_by_month(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_signups_by_month() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_signups_by_month() TO service_role;


--
-- Name: FUNCTION get_trial_users_enriched(p_start timestamp with time zone, p_end timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_trial_users_enriched(p_start timestamp with time zone, p_end timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_trial_users_enriched(p_start timestamp with time zone, p_end timestamp with time zone) TO service_role;


--
-- Name: FUNCTION get_trial_users_for_reminder(p_start timestamp with time zone, p_end timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_trial_users_for_reminder(p_start timestamp with time zone, p_end timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_trial_users_for_reminder(p_start timestamp with time zone, p_end timestamp with time zone) TO service_role;


--
-- Name: FUNCTION handle_new_user_profile(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user_profile() TO service_role;


--
-- Name: FUNCTION increment_racebook_sponsor_click(p_sponsor_id uuid, p_race_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_racebook_sponsor_click(p_sponsor_id uuid, p_race_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_racebook_sponsor_click(p_sponsor_id uuid, p_race_id uuid) TO service_role;


--
-- Name: FUNCTION increment_racebook_sponsor_impression(p_sponsor_id uuid, p_race_id uuid, p_placement text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_racebook_sponsor_impression(p_sponsor_id uuid, p_race_id uuid, p_placement text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_racebook_sponsor_impression(p_sponsor_id uuid, p_race_id uuid, p_placement text) TO service_role;


--
-- Name: FUNCTION increment_user_sign_in(p_user_id uuid, p_signed_in_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_user_sign_in(p_user_id uuid, p_signed_in_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_user_sign_in(p_user_id uuid, p_signed_in_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION infer_product_brand(raw_name text, raw_slug text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.infer_product_brand(raw_name text, raw_slug text) TO anon;
GRANT ALL ON FUNCTION public.infer_product_brand(raw_name text, raw_slug text) TO authenticated;
GRANT ALL ON FUNCTION public.infer_product_brand(raw_name text, raw_slug text) TO service_role;


--
-- Name: FUNCTION initialize_organizer_edition_modules(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.initialize_organizer_edition_modules() FROM PUBLIC;
GRANT ALL ON FUNCTION public.initialize_organizer_edition_modules() TO service_role;


--
-- Name: FUNCTION initialize_organizer_race_modules(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.initialize_organizer_race_modules() FROM PUBLIC;
GRANT ALL ON FUNCTION public.initialize_organizer_race_modules() TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_valid_push_cron_secret(candidate_secret text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_valid_push_cron_secret(candidate_secret text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_valid_push_cron_secret(candidate_secret text) TO service_role;


--
-- Name: TABLE organizer_edition_payments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organizer_edition_payments TO service_role;


--
-- Name: FUNCTION issue_admin_organizer_invoice(p_payment_id uuid, p_admin_id uuid, p_invoice_legal_snapshot jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.issue_admin_organizer_invoice(p_payment_id uuid, p_admin_id uuid, p_invoice_legal_snapshot jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.issue_admin_organizer_invoice(p_payment_id uuid, p_admin_id uuid, p_invoice_legal_snapshot jsonb) TO service_role;


--
-- Name: FUNCTION normalize_product_brand(raw_brand text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.normalize_product_brand(raw_brand text) TO anon;
GRANT ALL ON FUNCTION public.normalize_product_brand(raw_brand text) TO authenticated;
GRANT ALL ON FUNCTION public.normalize_product_brand(raw_brand text) TO service_role;


--
-- Name: FUNCTION protect_server_managed_profile_fields(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_server_managed_profile_fields() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_server_managed_profile_fields() TO service_role;


--
-- Name: TABLE races; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.races TO anon;
GRANT ALL ON TABLE public.races TO authenticated;
GRANT ALL ON TABLE public.races TO service_role;


--
-- Name: FUNCTION publish_organizer_edition_racebooks(p_edition_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.publish_organizer_edition_racebooks(p_edition_id uuid, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.publish_organizer_edition_racebooks(p_edition_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: TABLE race_event_edition_branding; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_event_edition_branding TO service_role;


--
-- Name: FUNCTION publish_racebook_edition_branding(p_edition_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.publish_racebook_edition_branding(p_edition_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.publish_racebook_edition_branding(p_edition_id uuid) TO service_role;


--
-- Name: FUNCTION purge_expired_rate_limit_entries(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_expired_rate_limit_entries() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_expired_rate_limit_entries() TO service_role;


--
-- Name: TABLE organizer_edition_entitlements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organizer_edition_entitlements TO service_role;


--
-- Name: FUNCTION recalculate_organizer_edition_entitlement(p_edition_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recalculate_organizer_edition_entitlement(p_edition_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recalculate_organizer_edition_entitlement(p_edition_id uuid) TO service_role;


--
-- Name: FUNCTION record_admin_organizer_bank_transfer(p_edition_id uuid, p_admin_id uuid, p_tier text, p_paid_at timestamp with time zone, p_amount_subtotal integer, p_amount_tax integer, p_invoice_storage_path text, p_invoice_original_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_admin_organizer_bank_transfer(p_edition_id uuid, p_admin_id uuid, p_tier text, p_paid_at timestamp with time zone, p_amount_subtotal integer, p_amount_tax integer, p_invoice_storage_path text, p_invoice_original_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_admin_organizer_bank_transfer(p_edition_id uuid, p_admin_id uuid, p_tier text, p_paid_at timestamp with time zone, p_amount_subtotal integer, p_amount_tax integer, p_invoice_storage_path text, p_invoice_original_name text) TO service_role;


--
-- Name: FUNCTION record_admin_organizer_bank_transfer_invoice(p_edition_id uuid, p_admin_id uuid, p_tier text, p_paid_at timestamp with time zone, p_amount_subtotal integer, p_invoice_legal_snapshot jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_admin_organizer_bank_transfer_invoice(p_edition_id uuid, p_admin_id uuid, p_tier text, p_paid_at timestamp with time zone, p_amount_subtotal integer, p_invoice_legal_snapshot jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_admin_organizer_bank_transfer_invoice(p_edition_id uuid, p_admin_id uuid, p_tier text, p_paid_at timestamp with time zone, p_amount_subtotal integer, p_invoice_legal_snapshot jsonb) TO service_role;


--
-- Name: FUNCTION record_race_slug_redirect(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_race_slug_redirect() FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_race_slug_redirect() TO service_role;


--
-- Name: FUNCTION rename_race_slug(p_race_id uuid, p_new_slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rename_race_slug(p_race_id uuid, p_new_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rename_race_slug(p_race_id uuid, p_new_slug text) TO service_role;


--
-- Name: TABLE race_event_edition_sponsors; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_event_edition_sponsors TO service_role;


--
-- Name: FUNCTION reorder_racebook_sponsors(p_edition_id uuid, p_items jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reorder_racebook_sponsors(p_edition_id uuid, p_items jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reorder_racebook_sponsors(p_edition_id uuid, p_items jsonb) TO service_role;


--
-- Name: TABLE race_aid_station_products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_aid_station_products TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.race_aid_station_products TO authenticated;
GRANT ALL ON TABLE public.race_aid_station_products TO service_role;


--
-- Name: FUNCTION replace_race_aid_station_products(p_race_id uuid, p_aid_station_id uuid, p_items jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace_race_aid_station_products(p_race_id uuid, p_aid_station_id uuid, p_items jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.replace_race_aid_station_products(p_race_id uuid, p_aid_station_id uuid, p_items jsonb) TO service_role;


--
-- Name: TABLE race_aid_stations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_aid_stations TO anon;
GRANT ALL ON TABLE public.race_aid_stations TO authenticated;
GRANT ALL ON TABLE public.race_aid_stations TO service_role;


--
-- Name: FUNCTION replace_race_aid_stations(p_race_id uuid, p_items jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace_race_aid_stations(p_race_id uuid, p_items jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.replace_race_aid_stations(p_race_id uuid, p_items jsonb) TO service_role;


--
-- Name: TABLE race_awards; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_awards TO service_role;
GRANT SELECT ON TABLE public.race_awards TO anon;
GRANT SELECT ON TABLE public.race_awards TO authenticated;


--
-- Name: FUNCTION replace_race_awards(p_race_id uuid, p_items jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace_race_awards(p_race_id uuid, p_items jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.replace_race_awards(p_race_id uuid, p_items jsonb) TO service_role;


--
-- Name: TABLE race_edition_services; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_edition_services TO service_role;
GRANT SELECT ON TABLE public.race_edition_services TO anon;
GRANT SELECT ON TABLE public.race_edition_services TO authenticated;


--
-- Name: FUNCTION replace_race_edition_services(p_edition_id uuid, p_items jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace_race_edition_services(p_edition_id uuid, p_items jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.replace_race_edition_services(p_edition_id uuid, p_items jsonb) TO service_role;


--
-- Name: TABLE race_relay_points; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_relay_points TO service_role;
GRANT SELECT ON TABLE public.race_relay_points TO anon;
GRANT SELECT ON TABLE public.race_relay_points TO authenticated;


--
-- Name: FUNCTION replace_race_relay_points(p_race_id uuid, p_items jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace_race_relay_points(p_race_id uuid, p_items jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.replace_race_relay_points(p_race_id uuid, p_items jsonb) TO service_role;


--
-- Name: TABLE race_start_waves; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_start_waves TO service_role;
GRANT SELECT ON TABLE public.race_start_waves TO anon;
GRANT SELECT ON TABLE public.race_start_waves TO authenticated;


--
-- Name: FUNCTION replace_race_start_waves(p_race_id uuid, p_items jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace_race_start_waves(p_race_id uuid, p_items jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.replace_race_start_waves(p_race_id uuid, p_items jsonb) TO service_role;


--
-- Name: TABLE race_event_publication_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_event_publication_requests TO anon;
GRANT ALL ON TABLE public.race_event_publication_requests TO authenticated;
GRANT ALL ON TABLE public.race_event_publication_requests TO service_role;


--
-- Name: FUNCTION review_race_event_publication_request(p_request_id uuid, p_reviewer_id uuid, p_status text, p_reviewer_notes text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.review_race_event_publication_request(p_request_id uuid, p_reviewer_id uuid, p_status text, p_reviewer_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.review_race_event_publication_request(p_request_id uuid, p_reviewer_id uuid, p_status text, p_reviewer_notes text) TO anon;
GRANT ALL ON FUNCTION public.review_race_event_publication_request(p_request_id uuid, p_reviewer_id uuid, p_status text, p_reviewer_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.review_race_event_publication_request(p_request_id uuid, p_reviewer_id uuid, p_status text, p_reviewer_notes text) TO service_role;


--
-- Name: TABLE organizer_edition_capability_grants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organizer_edition_capability_grants TO service_role;


--
-- Name: FUNCTION set_admin_organizer_edition_capability_grant(p_edition_id uuid, p_admin_id uuid, p_capability_key text, p_enabled boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_admin_organizer_edition_capability_grant(p_edition_id uuid, p_admin_id uuid, p_capability_key text, p_enabled boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_admin_organizer_edition_capability_grant(p_edition_id uuid, p_admin_id uuid, p_capability_key text, p_enabled boolean) TO service_role;


--
-- Name: FUNCTION set_admin_organizer_edition_entitlement(p_edition_id uuid, p_admin_id uuid, p_tier text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_admin_organizer_edition_entitlement(p_edition_id uuid, p_admin_id uuid, p_tier text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_admin_organizer_edition_entitlement(p_edition_id uuid, p_admin_id uuid, p_tier text) TO service_role;


--
-- Name: FUNCTION set_admin_organizer_edition_grant(p_edition_id uuid, p_admin_id uuid, p_tier text, p_origin text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_admin_organizer_edition_grant(p_edition_id uuid, p_admin_id uuid, p_tier text, p_origin text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_admin_organizer_edition_grant(p_edition_id uuid, p_admin_id uuid, p_tier text, p_origin text) TO service_role;


--
-- Name: FUNCTION set_affiliate_offers_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_affiliate_offers_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_affiliate_offers_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_affiliate_offers_updated_at() TO service_role;


--
-- Name: FUNCTION set_organizer_import_sessions_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_organizer_import_sessions_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_organizer_import_sessions_updated_at() TO service_role;


--
-- Name: FUNCTION set_organizer_racebook_visibility(p_user_id uuid, p_race_id uuid, p_is_live boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_organizer_racebook_visibility(p_user_id uuid, p_race_id uuid, p_is_live boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_organizer_racebook_visibility(p_user_id uuid, p_race_id uuid, p_is_live boolean) TO service_role;


--
-- Name: FUNCTION set_plan_share_links_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_plan_share_links_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_plan_share_links_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_plan_share_links_updated_at() TO service_role;


--
-- Name: FUNCTION set_premium_grants_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_premium_grants_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_premium_grants_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_premium_grants_updated_at() TO service_role;


--
-- Name: FUNCTION set_product_brand(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_product_brand() TO anon;
GRANT ALL ON FUNCTION public.set_product_brand() TO authenticated;
GRANT ALL ON FUNCTION public.set_product_brand() TO service_role;


--
-- Name: FUNCTION set_products_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_products_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_products_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_products_updated_at() TO service_role;


--
-- Name: FUNCTION set_push_devices_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_push_devices_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_push_devices_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_push_devices_updated_at() TO service_role;


--
-- Name: FUNCTION set_race_aid_station_products_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_race_aid_station_products_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_race_aid_station_products_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_race_aid_station_products_updated_at() TO service_role;


--
-- Name: FUNCTION set_race_catalog_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_race_catalog_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_race_catalog_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_race_catalog_updated_at() TO service_role;


--
-- Name: FUNCTION set_race_event_claims_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_race_event_claims_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_race_event_claims_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_race_event_claims_updated_at() TO service_role;


--
-- Name: FUNCTION set_race_event_edition_branding_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_race_event_edition_branding_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_race_event_edition_branding_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_race_event_edition_branding_updated_at() TO service_role;


--
-- Name: FUNCTION set_race_event_edition_requests_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_race_event_edition_requests_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_race_event_edition_requests_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_race_event_edition_requests_updated_at() TO service_role;


--
-- Name: FUNCTION set_race_event_edition_sponsors_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_race_event_edition_sponsors_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_race_event_edition_sponsors_updated_at() TO service_role;


--
-- Name: FUNCTION set_race_event_editions_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_race_event_editions_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_race_event_editions_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_race_event_editions_updated_at() TO service_role;


--
-- Name: FUNCTION set_race_event_publication_requests_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_race_event_publication_requests_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_race_event_publication_requests_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_race_event_publication_requests_updated_at() TO service_role;


--
-- Name: FUNCTION set_race_event_racebook_visibility(p_event_id uuid, p_reviewer_id uuid, p_is_live boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_race_event_racebook_visibility(p_event_id uuid, p_reviewer_id uuid, p_is_live boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_race_event_racebook_visibility(p_event_id uuid, p_reviewer_id uuid, p_is_live boolean) TO anon;
GRANT ALL ON FUNCTION public.set_race_event_racebook_visibility(p_event_id uuid, p_reviewer_id uuid, p_is_live boolean) TO authenticated;
GRANT ALL ON FUNCTION public.set_race_event_racebook_visibility(p_event_id uuid, p_reviewer_id uuid, p_is_live boolean) TO service_role;


--
-- Name: FUNCTION set_race_plans_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_race_plans_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_race_plans_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_race_plans_updated_at() TO service_role;


--
-- Name: FUNCTION set_races_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_races_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_races_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_races_updated_at() TO service_role;


--
-- Name: FUNCTION set_structured_racebook_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_structured_racebook_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_structured_racebook_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_structured_racebook_updated_at() TO service_role;


--
-- Name: FUNCTION set_subscriptions_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_subscriptions_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_subscriptions_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_subscriptions_updated_at() TO service_role;


--
-- Name: FUNCTION set_user_profiles_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_user_profiles_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_user_profiles_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_user_profiles_updated_at() TO service_role;


--
-- Name: FUNCTION sync_current_race_event_edition_dates(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_current_race_event_edition_dates() TO anon;
GRANT ALL ON FUNCTION public.sync_current_race_event_edition_dates() TO authenticated;
GRANT ALL ON FUNCTION public.sync_current_race_event_edition_dates() TO service_role;


--
-- Name: FUNCTION sync_race_event_edition_visibility(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_race_event_edition_visibility() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_race_event_edition_visibility() TO service_role;


--
-- Name: FUNCTION sync_race_has_aid_stations(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_race_has_aid_stations() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_race_has_aid_stations() TO service_role;


--
-- Name: FUNCTION sync_race_web_catalog_visibility(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_race_web_catalog_visibility() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_race_web_catalog_visibility() TO service_role;


--
-- Name: FUNCTION validate_organizer_import_session_scope(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_organizer_import_session_scope() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_organizer_import_session_scope() TO service_role;


--
-- Name: FUNCTION validate_organizer_racebook_module_setting(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_organizer_racebook_module_setting() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_organizer_racebook_module_setting() TO service_role;


--
-- Name: FUNCTION validate_race_edition_membership(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_race_edition_membership() TO anon;
GRANT ALL ON FUNCTION public.validate_race_edition_membership() TO authenticated;
GRANT ALL ON FUNCTION public.validate_race_edition_membership() TO service_role;


--
-- Name: FUNCTION validate_race_event_edition_range(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_race_event_edition_range() TO anon;
GRANT ALL ON FUNCTION public.validate_race_event_edition_range() TO authenticated;
GRANT ALL ON FUNCTION public.validate_race_event_edition_range() TO service_role;


--
-- Name: FUNCTION apply_rls(wal jsonb, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;


--
-- Name: FUNCTION broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;


--
-- Name: FUNCTION build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;


--
-- Name: FUNCTION "cast"(val text, type_ regtype); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO service_role;


--
-- Name: FUNCTION is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;


--
-- Name: FUNCTION list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;


--
-- Name: FUNCTION quote_wal2json(entity regclass); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;


--
-- Name: FUNCTION send(payload jsonb, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION send_binary(payload bytea, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION subscription_check_filters(); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;


--
-- Name: FUNCTION to_regrole(role_name text); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;


--
-- Name: FUNCTION topic(); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.topic() TO postgres;
GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;


--
-- Name: FUNCTION wal2json_escape_identifier(name text); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.wal2json_escape_identifier(name text) TO postgres;
GRANT ALL ON FUNCTION realtime.wal2json_escape_identifier(name text) TO dashboard_user;


--
-- Name: FUNCTION _crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea); Type: ACL; Schema: vault; Owner: -
--

GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;


--
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: -
--

GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: FUNCTION update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: -
--

GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- Name: TABLE custom_oauth_providers; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.custom_oauth_providers TO postgres;
GRANT ALL ON TABLE auth.custom_oauth_providers TO dashboard_user;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.flow_state TO dashboard_user;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;


--
-- Name: TABLE mfa_recovery_code_sets; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.mfa_recovery_code_sets TO postgres;
GRANT ALL ON TABLE auth.mfa_recovery_code_sets TO dashboard_user;


--
-- Name: TABLE mfa_recovery_codes; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.mfa_recovery_codes TO postgres;
GRANT ALL ON TABLE auth.mfa_recovery_codes TO dashboard_user;


--
-- Name: TABLE oauth_authorizations; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.oauth_authorizations TO postgres;
GRANT ALL ON TABLE auth.oauth_authorizations TO dashboard_user;


--
-- Name: TABLE oauth_client_states; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.oauth_client_states TO postgres;
GRANT ALL ON TABLE auth.oauth_client_states TO dashboard_user;


--
-- Name: TABLE oauth_clients; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.oauth_clients TO postgres;
GRANT ALL ON TABLE auth.oauth_clients TO dashboard_user;


--
-- Name: TABLE oauth_consents; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.oauth_consents TO postgres;
GRANT ALL ON TABLE auth.oauth_consents TO dashboard_user;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- Name: TABLE scim_tokens; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.scim_tokens TO postgres;
GRANT ALL ON TABLE auth.scim_tokens TO dashboard_user;


--
-- Name: TABLE scim_users; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.scim_users TO postgres;
GRANT ALL ON TABLE auth.scim_users TO dashboard_user;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sessions TO dashboard_user;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- Name: TABLE webauthn_challenges; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.webauthn_challenges TO postgres;
GRANT ALL ON TABLE auth.webauthn_challenges TO dashboard_user;


--
-- Name: TABLE webauthn_credentials; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.webauthn_credentials TO postgres;
GRANT ALL ON TABLE auth.webauthn_credentials TO dashboard_user;


--
-- Name: TABLE job; Type: ACL; Schema: cron; Owner: -
--

GRANT SELECT ON TABLE cron.job TO postgres WITH GRANT OPTION;


--
-- Name: TABLE job_run_details; Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON TABLE cron.job_run_details TO postgres WITH GRANT OPTION;


--
-- Name: TABLE pg_stat_statements; Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON TABLE extensions.pg_stat_statements FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements TO dashboard_user;


--
-- Name: TABLE pg_stat_statements_info; Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON TABLE extensions.pg_stat_statements_info FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO dashboard_user;


--
-- Name: TABLE wrappers_fdw_stats; Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON TABLE extensions.wrappers_fdw_stats TO postgres WITH GRANT OPTION;


--
-- Name: TABLE affiliate_offers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliate_offers TO anon;
GRANT ALL ON TABLE public.affiliate_offers TO authenticated;
GRANT ALL ON TABLE public.affiliate_offers TO service_role;


--
-- Name: TABLE app_changelog; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.app_changelog TO anon;
GRANT ALL ON TABLE public.app_changelog TO authenticated;
GRANT ALL ON TABLE public.app_changelog TO service_role;


--
-- Name: SEQUENCE app_changelog_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.app_changelog_id_seq TO anon;
GRANT ALL ON SEQUENCE public.app_changelog_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.app_changelog_id_seq TO service_role;


--
-- Name: TABLE app_feedback; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.app_feedback TO anon;
GRANT ALL ON TABLE public.app_feedback TO authenticated;
GRANT ALL ON TABLE public.app_feedback TO service_role;


--
-- Name: SEQUENCE app_feedback_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.app_feedback_id_seq TO anon;
GRANT ALL ON SEQUENCE public.app_feedback_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.app_feedback_id_seq TO service_role;


--
-- Name: TABLE nutrition_plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.nutrition_plans TO anon;
GRANT ALL ON TABLE public.nutrition_plans TO authenticated;
GRANT ALL ON TABLE public.nutrition_plans TO service_role;


--
-- Name: TABLE organizer_import_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organizer_import_sessions TO service_role;


--
-- Name: TABLE organizer_racebook_module_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organizer_racebook_module_settings TO service_role;


--
-- Name: TABLE plan_aid_stations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_aid_stations TO anon;
GRANT ALL ON TABLE public.plan_aid_stations TO authenticated;
GRANT ALL ON TABLE public.plan_aid_stations TO service_role;


--
-- Name: TABLE plan_share_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_share_links TO anon;
GRANT ALL ON TABLE public.plan_share_links TO authenticated;
GRANT ALL ON TABLE public.plan_share_links TO service_role;


--
-- Name: TABLE premium_grants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.premium_grants TO anon;
GRANT ALL ON TABLE public.premium_grants TO authenticated;
GRANT ALL ON TABLE public.premium_grants TO service_role;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;


--
-- Name: TABLE product_brand_review; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_brand_review TO anon;
GRANT ALL ON TABLE public.product_brand_review TO authenticated;
GRANT ALL ON TABLE public.product_brand_review TO service_role;


--
-- Name: TABLE push_devices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.push_devices TO anon;
GRANT ALL ON TABLE public.push_devices TO authenticated;
GRANT ALL ON TABLE public.push_devices TO service_role;


--
-- Name: TABLE push_notification_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.push_notification_events TO anon;
GRANT ALL ON TABLE public.push_notification_events TO authenticated;
GRANT ALL ON TABLE public.push_notification_events TO service_role;


--
-- Name: TABLE race_event_claims; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_event_claims TO anon;
GRANT ALL ON TABLE public.race_event_claims TO authenticated;
GRANT ALL ON TABLE public.race_event_claims TO service_role;


--
-- Name: TABLE race_event_edition_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_event_edition_requests TO anon;
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.race_event_edition_requests TO authenticated;
GRANT ALL ON TABLE public.race_event_edition_requests TO service_role;


--
-- Name: TABLE race_event_editions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_event_editions TO service_role;


--
-- Name: TABLE race_event_organizers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_event_organizers TO anon;
GRANT ALL ON TABLE public.race_event_organizers TO authenticated;
GRANT ALL ON TABLE public.race_event_organizers TO service_role;


--
-- Name: TABLE race_event_update_reads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_event_update_reads TO anon;
GRANT ALL ON TABLE public.race_event_update_reads TO authenticated;
GRANT ALL ON TABLE public.race_event_update_reads TO service_role;


--
-- Name: TABLE race_event_updates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_event_updates TO anon;
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.race_event_updates TO authenticated;
GRANT ALL ON TABLE public.race_event_updates TO service_role;


--
-- Name: TABLE race_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_events TO anon;
GRANT ALL ON TABLE public.race_events TO authenticated;
GRANT ALL ON TABLE public.race_events TO service_role;


--
-- Name: TABLE race_plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_plans TO anon;
GRANT ALL ON TABLE public.race_plans TO authenticated;
GRANT ALL ON TABLE public.race_plans TO service_role;


--
-- Name: TABLE race_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_requests TO anon;
GRANT ALL ON TABLE public.race_requests TO authenticated;
GRANT ALL ON TABLE public.race_requests TO service_role;


--
-- Name: SEQUENCE race_requests_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.race_requests_id_seq TO anon;
GRANT ALL ON SEQUENCE public.race_requests_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.race_requests_id_seq TO service_role;


--
-- Name: TABLE race_slug_redirects; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.race_slug_redirects TO service_role;
GRANT SELECT ON TABLE public.race_slug_redirects TO anon;
GRANT SELECT ON TABLE public.race_slug_redirects TO authenticated;


--
-- Name: TABLE racebook_gear_checks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.racebook_gear_checks TO service_role;
GRANT SELECT,INSERT,DELETE ON TABLE public.racebook_gear_checks TO authenticated;


--
-- Name: TABLE rate_limit_entries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rate_limit_entries TO anon;
GRANT ALL ON TABLE public.rate_limit_entries TO authenticated;
GRANT ALL ON TABLE public.rate_limit_entries TO service_role;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subscriptions TO anon;
GRANT ALL ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;


--
-- Name: TABLE user_favorite_products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_favorite_products TO anon;
GRANT ALL ON TABLE public.user_favorite_products TO authenticated;
GRANT ALL ON TABLE public.user_favorite_products TO service_role;


--
-- Name: TABLE user_favorite_race_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_favorite_race_events TO anon;
GRANT ALL ON TABLE public.user_favorite_race_events TO authenticated;
GRANT ALL ON TABLE public.user_favorite_race_events TO service_role;


--
-- Name: TABLE user_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_profiles TO anon;
GRANT ALL ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: realtime; Owner: -
--

GRANT REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE realtime.messages TO postgres;
GRANT SELECT,INSERT ON TABLE realtime.messages TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE realtime.messages TO dashboard_user;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO service_role;


--
-- Name: TABLE subscription; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.subscription TO postgres;
GRANT ALL ON TABLE realtime.subscription TO dashboard_user;
GRANT SELECT ON TABLE realtime.subscription TO anon;
GRANT SELECT ON TABLE realtime.subscription TO authenticated;
GRANT SELECT ON TABLE realtime.subscription TO service_role;


--
-- Name: SEQUENCE subscription_id_seq; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO postgres;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO dashboard_user;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO anon;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO service_role;


--
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: -
--

REVOKE ALL ON TABLE storage.buckets FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.buckets TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.buckets TO anon;
GRANT ALL ON TABLE storage.buckets TO authenticated;
GRANT ALL ON TABLE storage.buckets TO service_role;
GRANT ALL ON TABLE storage.buckets TO postgres WITH GRANT OPTION;


--
-- Name: TABLE buckets_analytics; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.buckets_analytics TO service_role;
GRANT ALL ON TABLE storage.buckets_analytics TO authenticated;
GRANT ALL ON TABLE storage.buckets_analytics TO anon;


--
-- Name: TABLE buckets_vectors; Type: ACL; Schema: storage; Owner: -
--

GRANT SELECT ON TABLE storage.buckets_vectors TO service_role;
GRANT SELECT ON TABLE storage.buckets_vectors TO authenticated;
GRANT SELECT ON TABLE storage.buckets_vectors TO anon;


--
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: -
--

REVOKE ALL ON TABLE storage.objects FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.objects TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.objects TO anon;
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT ALL ON TABLE storage.objects TO postgres WITH GRANT OPTION;


--
-- Name: TABLE s3_multipart_uploads; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.s3_multipart_uploads TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO anon;


--
-- Name: TABLE s3_multipart_uploads_parts; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.s3_multipart_uploads_parts TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO anon;


--
-- Name: TABLE vector_indexes; Type: ACL; Schema: storage; Owner: -
--

GRANT SELECT ON TABLE storage.vector_indexes TO service_role;
GRANT SELECT ON TABLE storage.vector_indexes TO authenticated;
GRANT SELECT ON TABLE storage.vector_indexes TO anon;


--
-- Name: TABLE secrets; Type: ACL; Schema: vault; Owner: -
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.secrets TO service_role;


--
-- Name: TABLE decrypted_secrets; Type: ACL; Schema: vault; Owner: -
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.decrypted_secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.decrypted_secrets TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: cron; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA cron GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: cron; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA cron GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: cron; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA cron GRANT ALL ON TABLES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: extensions; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: extensions; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: extensions; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON TABLES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql_public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql_public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql_public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: pgmq; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA pgmq GRANT SELECT ON SEQUENCES TO pg_monitor;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: pgmq; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA pgmq GRANT SELECT ON TABLES TO pg_monitor;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: realtime; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: realtime; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: realtime; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT SELECT,INSERT ON TABLES TO postgres WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO service_role;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict oLMiu8EU402qgYpbz1ujDKP8LqRs9MEMrXTGYKwbYyW7cwUdYIuPgzPySyFN2ru

