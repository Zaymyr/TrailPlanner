# Database Overview

## Schema `auth`

### Table `auth.audit_log_entries`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `instance_id` | `u` | ❌ | `` |
| `id` | `u` | ✅ | `` |
| `payload` | `j` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `ip_address` | `c` | ✅ | `` |

**Primary keys**
- `audit_log_entries_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `auth.custom_oauth_providers`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `provider_type` | `t` | ✅ | `` |
| `identifier` | `t` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `client_id` | `t` | ✅ | `` |
| `client_secret` | `t` | ✅ | `` |
| `acceptable_client_ids` | `t` | ✅ | `` |
| `scopes` | `t` | ✅ | `` |
| `pkce_enabled` | `b` | ✅ | `` |
| `attribute_mapping` | `j` | ✅ | `` |
| `authorization_params` | `j` | ✅ | `` |
| `enabled` | `b` | ✅ | `` |
| `email_optional` | `b` | ✅ | `` |
| `issuer` | `t` | ❌ | `` |
| `discovery_url` | `t` | ❌ | `` |
| `skip_nonce_check` | `b` | ✅ | `` |
| `cached_discovery` | `j` | ❌ | `` |
| `discovery_cached_at` | `t` | ❌ | `` |
| `authorization_url` | `t` | ❌ | `` |
| `token_url` | `t` | ❌ | `` |
| `userinfo_url` | `t` | ❌ | `` |
| `jwks_uri` | `t` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `custom_claims_allowlist` | `t` | ✅ | `` |

**Primary keys**
- `custom_oauth_providers_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `auth.flow_state`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ❌ | `` |
| `auth_code` | `t` | ❌ | `` |
| `code_challenge_method` | `a` | ❌ | `` |
| `code_challenge` | `t` | ❌ | `` |
| `provider_type` | `t` | ✅ | `` |
| `provider_access_token` | `t` | ❌ | `` |
| `provider_refresh_token` | `t` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `authentication_method` | `t` | ✅ | `` |
| `auth_code_issued_at` | `t` | ❌ | `` |
| `invite_token` | `t` | ❌ | `` |
| `referrer` | `t` | ❌ | `` |
| `oauth_client_state_id` | `u` | ❌ | `` |
| `linking_target_id` | `u` | ❌ | `` |
| `email_optional` | `b` | ✅ | `` |

**Primary keys**
- `flow_state_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `auth.identities`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `provider_id` | `t` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `identity_data` | `j` | ✅ | `` |
| `provider` | `t` | ✅ | `` |
| `last_sign_in_at` | `t` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `email` | `t` | ❌ | `` |
| `id` | `u` | ✅ | `` |

**Primary keys**
- `identities_pkey` on (id)

**Foreign keys**
- `identities_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.instances`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `uuid` | `u` | ❌ | `` |
| `raw_base_config` | `t` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |

**Primary keys**
- `instances_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `auth.mfa_amr_claims`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `session_id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `authentication_method` | `t` | ✅ | `` |
| `id` | `u` | ✅ | `` |

**Primary keys**
- `amr_id_pk` on (id)

**Foreign keys**
- `mfa_amr_claims_session_id_fkey`: (session_id) → auth.sessions(id)

**RLS**: ❌ disabled

---

### Table `auth.mfa_challenges`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `factor_id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `verified_at` | `t` | ❌ | `` |
| `ip_address` | `i` | ✅ | `` |
| `otp_code` | `t` | ❌ | `` |
| `web_authn_session_data` | `j` | ❌ | `` |

**Primary keys**
- `mfa_challenges_pkey` on (id)

**Foreign keys**
- `mfa_challenges_auth_factor_id_fkey`: (factor_id) → auth.mfa_factors(id)

**RLS**: ❌ disabled

---

### Table `auth.mfa_factors`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `friendly_name` | `t` | ❌ | `` |
| `factor_type` | `a` | ✅ | `` |
| `status` | `a` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `secret` | `t` | ❌ | `` |
| `phone` | `t` | ❌ | `` |
| `last_challenged_at` | `t` | ❌ | `` |
| `web_authn_credential` | `j` | ❌ | `` |
| `web_authn_aaguid` | `u` | ❌ | `` |
| `last_webauthn_challenge_data` | `j` | ❌ | `` |

**Primary keys**
- `mfa_factors_pkey` on (id)

**Foreign keys**
- `mfa_factors_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.mfa_recovery_code_sets`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `mfa_factor_id` | `u` | ✅ | `` |
| `failed_verification_count` | `i` | ✅ | `` |
| `verification_locked_until` | `t` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |

**Primary keys**
- `mfa_recovery_code_sets_pkey` on (id)

**Foreign keys**
- `mfa_recovery_code_sets_mfa_factor_id_fkey`: (mfa_factor_id) → auth.mfa_factors(id)
- `mfa_recovery_code_sets_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.mfa_recovery_codes`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `mfa_recovery_code_set_id` | `u` | ✅ | `` |
| `code_hash` | `t` | ✅ | `` |
| `consumed_at` | `t` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |

**Primary keys**
- `mfa_recovery_codes_pkey` on (id)

**Foreign keys**
- `mfa_recovery_codes_mfa_recovery_code_set_id_fkey`: (mfa_recovery_code_set_id) → auth.mfa_recovery_code_sets(id)

**RLS**: ❌ disabled

---

### Table `auth.oauth_authorizations`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `authorization_id` | `t` | ✅ | `` |
| `client_id` | `u` | ✅ | `` |
| `user_id` | `u` | ❌ | `` |
| `redirect_uri` | `t` | ✅ | `` |
| `scope` | `t` | ✅ | `` |
| `state` | `t` | ❌ | `` |
| `resource` | `t` | ❌ | `` |
| `code_challenge` | `t` | ❌ | `` |
| `code_challenge_method` | `a` | ❌ | `` |
| `response_type` | `a` | ✅ | `` |
| `status` | `a` | ✅ | `` |
| `authorization_code` | `t` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |
| `expires_at` | `t` | ✅ | `` |
| `approved_at` | `t` | ❌ | `` |
| `nonce` | `t` | ❌ | `` |

**Primary keys**
- `oauth_authorizations_pkey` on (id)

**Foreign keys**
- `oauth_authorizations_client_id_fkey`: (client_id) → auth.oauth_clients(id)
- `oauth_authorizations_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.oauth_client_states`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `provider_type` | `t` | ✅ | `` |
| `code_verifier` | `t` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |

**Primary keys**
- `oauth_client_states_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `auth.oauth_clients`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `client_secret_hash` | `t` | ❌ | `` |
| `registration_type` | `a` | ✅ | `` |
| `redirect_uris` | `t` | ✅ | `` |
| `grant_types` | `t` | ✅ | `` |
| `client_name` | `t` | ❌ | `` |
| `client_uri` | `t` | ❌ | `` |
| `logo_uri` | `t` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `deleted_at` | `t` | ❌ | `` |
| `client_type` | `a` | ✅ | `` |
| `token_endpoint_auth_method` | `t` | ✅ | `` |

**Primary keys**
- `oauth_clients_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `auth.oauth_consents`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `client_id` | `u` | ✅ | `` |
| `scopes` | `t` | ✅ | `` |
| `granted_at` | `t` | ✅ | `` |
| `revoked_at` | `t` | ❌ | `` |

**Primary keys**
- `oauth_consents_pkey` on (id)

**Foreign keys**
- `oauth_consents_client_id_fkey`: (client_id) → auth.oauth_clients(id)
- `oauth_consents_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.one_time_tokens`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `token_type` | `a` | ✅ | `` |
| `token_hash` | `t` | ✅ | `` |
| `relates_to` | `t` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `expires_at` | `t` | ❌ | `` |

**Primary keys**
- `one_time_tokens_pkey` on (id)

**Foreign keys**
- `one_time_tokens_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.refresh_tokens`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `instance_id` | `u` | ❌ | `` |
| `id` | `b` | ✅ | `` |
| `token` | `c` | ❌ | `` |
| `user_id` | `c` | ❌ | `` |
| `revoked` | `b` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `parent` | `c` | ❌ | `` |
| `session_id` | `u` | ❌ | `` |

**Primary keys**
- `refresh_tokens_pkey` on (id)

**Foreign keys**
- `refresh_tokens_session_id_fkey`: (session_id) → auth.sessions(id)

**RLS**: ❌ disabled

---

### Table `auth.saml_providers`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `sso_provider_id` | `u` | ✅ | `` |
| `entity_id` | `t` | ✅ | `` |
| `metadata_xml` | `t` | ✅ | `` |
| `metadata_url` | `t` | ❌ | `` |
| `attribute_mapping` | `j` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `name_id_format` | `t` | ❌ | `` |

**Primary keys**
- `saml_providers_pkey` on (id)

**Foreign keys**
- `saml_providers_sso_provider_id_fkey`: (sso_provider_id) → auth.sso_providers(id)

**RLS**: ❌ disabled

---

### Table `auth.saml_relay_states`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `sso_provider_id` | `u` | ✅ | `` |
| `request_id` | `t` | ✅ | `` |
| `for_email` | `t` | ❌ | `` |
| `redirect_to` | `t` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `flow_state_id` | `u` | ❌ | `` |

**Primary keys**
- `saml_relay_states_pkey` on (id)

**Foreign keys**
- `saml_relay_states_flow_state_id_fkey`: (flow_state_id) → auth.flow_state(id)
- `saml_relay_states_sso_provider_id_fkey`: (sso_provider_id) → auth.sso_providers(id)

**RLS**: ❌ disabled

---

### Table `auth.schema_migrations`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `version` | `c` | ✅ | `` |

**Primary keys**
- `schema_migrations_pkey` on (version)

**RLS**: ❌ disabled

---

### Table `auth.scim_tokens`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `sso_provider_id` | `u` | ✅ | `` |
| `token_hash` | `t` | ✅ | `` |
| `prefix` | `t` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `expires_at` | `t` | ❌ | `` |
| `revoked_at` | `t` | ❌ | `` |
| `last_used_at` | `t` | ❌ | `` |

**Primary keys**
- `scim_tokens_pkey` on (id)

**Foreign keys**
- `scim_tokens_sso_provider_id_fkey`: (sso_provider_id) → auth.sso_providers(id)

**RLS**: ❌ disabled

---

### Table `auth.scim_users`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `sso_provider_id` | `u` | ✅ | `` |
| `user_id` | `u` | ❌ | `` |
| `resource` | `j` | ✅ | `` |
| `user_name` | `t` | ✅ | `` |
| `external_id` | `t` | ❌ | `` |
| `active` | `b` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `deleted_at` | `t` | ❌ | `` |

**Primary keys**
- `scim_users_pkey` on (id)

**Foreign keys**
- `scim_users_sso_provider_id_fkey`: (sso_provider_id) → auth.sso_providers(id)
- `scim_users_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.sessions`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `factor_id` | `u` | ❌ | `` |
| `aal` | `a` | ❌ | `` |
| `not_after` | `t` | ❌ | `` |
| `refreshed_at` | `t` | ❌ | `` |
| `user_agent` | `t` | ❌ | `` |
| `ip` | `i` | ❌ | `` |
| `tag` | `t` | ❌ | `` |
| `oauth_client_id` | `u` | ❌ | `` |
| `refresh_token_hmac_key` | `t` | ❌ | `` |
| `refresh_token_counter` | `b` | ❌ | `` |
| `scopes` | `t` | ❌ | `` |

**Primary keys**
- `sessions_pkey` on (id)

**Foreign keys**
- `sessions_oauth_client_id_fkey`: (oauth_client_id) → auth.oauth_clients(id)
- `sessions_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.sso_domains`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `sso_provider_id` | `u` | ✅ | `` |
| `domain` | `t` | ✅ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |

**Primary keys**
- `sso_domains_pkey` on (id)

**Foreign keys**
- `sso_domains_sso_provider_id_fkey`: (sso_provider_id) → auth.sso_providers(id)

**RLS**: ❌ disabled

---

### Table `auth.sso_providers`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `resource_id` | `t` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `disabled` | `b` | ❌ | `` |

**Primary keys**
- `sso_providers_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `auth.users`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `instance_id` | `u` | ❌ | `` |
| `id` | `u` | ✅ | `` |
| `aud` | `c` | ❌ | `` |
| `role` | `c` | ❌ | `` |
| `email` | `c` | ❌ | `` |
| `encrypted_password` | `c` | ❌ | `` |
| `email_confirmed_at` | `t` | ❌ | `` |
| `invited_at` | `t` | ❌ | `` |
| `confirmation_token` | `c` | ❌ | `` |
| `confirmation_sent_at` | `t` | ❌ | `` |
| `recovery_token` | `c` | ❌ | `` |
| `recovery_sent_at` | `t` | ❌ | `` |
| `email_change_token_new` | `c` | ❌ | `` |
| `email_change` | `c` | ❌ | `` |
| `email_change_sent_at` | `t` | ❌ | `` |
| `last_sign_in_at` | `t` | ❌ | `` |
| `raw_app_meta_data` | `j` | ❌ | `` |
| `raw_user_meta_data` | `j` | ❌ | `` |
| `is_super_admin` | `b` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `phone` | `t` | ❌ | `` |
| `phone_confirmed_at` | `t` | ❌ | `` |
| `phone_change` | `t` | ❌ | `` |
| `phone_change_token` | `c` | ❌ | `` |
| `phone_change_sent_at` | `t` | ❌ | `` |
| `confirmed_at` | `t` | ❌ | `` |
| `email_change_token_current` | `c` | ❌ | `` |
| `email_change_confirm_status` | `s` | ❌ | `` |
| `banned_until` | `t` | ❌ | `` |
| `reauthentication_token` | `c` | ❌ | `` |
| `reauthentication_sent_at` | `t` | ❌ | `` |
| `is_sso_user` | `b` | ✅ | `` |
| `deleted_at` | `t` | ❌ | `` |
| `is_anonymous` | `b` | ✅ | `` |

**Primary keys**
- `users_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `auth.webauthn_challenges`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ❌ | `` |
| `challenge_type` | `t` | ✅ | `` |
| `session_data` | `j` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `expires_at` | `t` | ✅ | `` |

**Primary keys**
- `webauthn_challenges_pkey` on (id)

**Foreign keys**
- `webauthn_challenges_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.webauthn_credentials`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `credential_id` | `b` | ✅ | `` |
| `public_key` | `b` | ✅ | `` |
| `attestation_type` | `t` | ✅ | `` |
| `aaguid` | `u` | ❌ | `` |
| `sign_count` | `b` | ✅ | `` |
| `transports` | `j` | ✅ | `` |
| `backup_eligible` | `b` | ✅ | `` |
| `backed_up` | `b` | ✅ | `` |
| `friendly_name` | `t` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `last_used_at` | `t` | ❌ | `` |

**Primary keys**
- `webauthn_credentials_pkey` on (id)

**Foreign keys**
- `webauthn_credentials_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

## Schema `public`

### Table `public.affiliate_offers`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `product_id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `merchant` | `t` | ✅ | `` |
| `country_code` | `c` | ❌ | `` |
| `affiliate_url` | `t` | ✅ | `` |
| `active` | `b` | ✅ | `` |

**Primary keys**
- `affiliate_offers_pkey` on (id)

**Foreign keys**
- `affiliate_offers_product_id_fkey`: (product_id) → public.products(id)

**RLS**: ❌ disabled

---

### Table `public.app_changelog`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `b` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `published_at` | `t` | ✅ | `` |
| `version` | `t` | ✅ | `` |
| `title` | `t` | ✅ | `` |
| `detail` | `t` | ✅ | `` |
| `is_published` | `b` | ✅ | `` |

**Primary keys**
- `app_changelog_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `public.app_feedback`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `b` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `subject` | `t` | ✅ | `` |
| `detail` | `t` | ✅ | `` |
| `user_id` | `u` | ❌ | `` |
| `kind` | `t` | ✅ | `` |
| `source` | `t` | ✅ | `` |
| `screen` | `t` | ❌ | `` |
| `app_version` | `t` | ❌ | `` |

**Primary keys**
- `app_feedback_pkey` on (id)

**Foreign keys**
- `app_feedback_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.nutrition_plans`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `distance_km` | `n` | ✅ | `` |
| `elevation_m` | `n` | ✅ | `` |
| `goal` | `t` | ✅ | `` |
| `eating_ease` | `t` | ❌ | `` |
| `sweat_level` | `t` | ❌ | `` |
| `carbs_per_hour` | `i` | ✅ | `` |
| `water_per_hour` | `i` | ✅ | `` |
| `sodium_per_hour` | `i` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |

**Primary keys**
- `nutrition_plans_pkey` on (id)

**Foreign keys**
- `nutrition_plans_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.organizer_edition_capability_grants`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `edition_id` | `u` | ✅ | `` |
| `capability_key` | `t` | ✅ | `` |
| `status` | `t` | ✅ | `` |
| `granted_by` | `u` | ❌ | `` |
| `granted_at` | `t` | ❌ | `` |
| `revoked_by` | `u` | ❌ | `` |
| `revoked_at` | `t` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |

**Primary keys**
- `organizer_edition_capability_grants_pkey` on (id)

**Foreign keys**
- `organizer_edition_capability_grants_edition_id_fkey`: (edition_id) → public.race_event_editions(id)
- `organizer_edition_capability_grants_granted_by_fkey`: (granted_by) → auth.users(id)
- `organizer_edition_capability_grants_revoked_by_fkey`: (revoked_by) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.organizer_edition_entitlements`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `edition_id` | `u` | ✅ | `` |
| `tier` | `t` | ✅ | `` |
| `source` | `t` | ✅ | `` |
| `status` | `t` | ✅ | `` |
| `activated_at` | `t` | ❌ | `` |
| `revoked_at` | `t` | ❌ | `` |
| `granted_by` | `u` | ❌ | `` |

**Primary keys**
- `organizer_edition_entitlements_pkey` on (id)

**Foreign keys**
- `organizer_edition_entitlements_edition_id_fkey`: (edition_id) → public.race_event_editions(id)
- `organizer_edition_entitlements_granted_by_fkey`: (granted_by) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.organizer_edition_payments`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `edition_id` | `u` | ✅ | `` |
| `purchaser_user_id` | `u` | ❌ | `` |
| `purchase_kind` | `t` | ✅ | `` |
| `from_tier` | `t` | ✅ | `` |
| `to_tier` | `t` | ✅ | `` |
| `status` | `t` | ✅ | `` |
| `stripe_checkout_session_id` | `t` | ❌ | `` |
| `stripe_checkout_url` | `t` | ❌ | `` |
| `stripe_payment_intent_id` | `t` | ❌ | `` |
| `stripe_customer_id` | `t` | ❌ | `` |
| `amount_subtotal` | `i` | ❌ | `` |
| `amount_tax` | `i` | ❌ | `` |
| `amount_total` | `i` | ❌ | `` |
| `currency` | `t` | ❌ | `` |
| `paid_at` | `t` | ❌ | `` |
| `invalidated_at` | `t` | ❌ | `` |
| `payment_channel` | `t` | ✅ | `` |
| `recorded_by` | `u` | ❌ | `` |
| `stripe_invoice_id` | `t` | ❌ | `` |
| `invoice_storage_path` | `t` | ❌ | `` |
| `invoice_original_name` | `t` | ❌ | `` |
| `invoice_uploaded_at` | `t` | ❌ | `` |
| `invoice_uploaded_by` | `u` | ❌ | `` |
| `invoice_number` | `t` | ❌ | `` |
| `invoice_sequence` | `i` | ❌ | `` |
| `invoice_issued_at` | `t` | ❌ | `` |
| `invoice_source` | `t` | ❌ | `` |
| `invoice_legal_snapshot` | `j` | ❌ | `` |

**Primary keys**
- `organizer_edition_payments_pkey` on (id)

**Foreign keys**
- `organizer_edition_payments_edition_id_fkey`: (edition_id) → public.race_event_editions(id)
- `organizer_edition_payments_invoice_uploaded_by_fkey`: (invoice_uploaded_by) → auth.users(id)
- `organizer_edition_payments_purchaser_user_id_fkey`: (purchaser_user_id) → auth.users(id)
- `organizer_edition_payments_recorded_by_fkey`: (recorded_by) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.organizer_import_sessions`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `event_id` | `u` | ✅ | `` |
| `edition_id` | `u` | ✅ | `` |
| `created_by` | `u` | ✅ | `` |
| `status` | `t` | ✅ | `` |
| `source_manifest` | `j` | ✅ | `` |
| `discovery_snapshot` | `j` | ✅ | `` |
| `confirmed_formats` | `j` | ✅ | `` |
| `field_snapshot` | `j` | ✅ | `` |
| `expires_at` | `t` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |

**Primary keys**
- `organizer_import_sessions_pkey` on (id)

**Foreign keys**
- `organizer_import_sessions_created_by_fkey`: (created_by) → auth.users(id)
- `organizer_import_sessions_edition_id_fkey`: (edition_id) → public.race_event_editions(id)
- `organizer_import_sessions_event_id_fkey`: (event_id) → public.race_events(id)

**RLS**: ❌ disabled

---

### Table `public.organizer_racebook_module_settings`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `edition_id` | `u` | ✅ | `` |
| `race_id` | `u` | ❌ | `` |
| `module_key` | `t` | ✅ | `` |
| `is_enabled` | `b` | ✅ | `` |
| `configured_by` | `u` | ❌ | `` |

**Primary keys**
- `organizer_racebook_module_settings_pkey` on (id)

**Foreign keys**
- `organizer_racebook_module_settings_configured_by_fkey`: (configured_by) → auth.users(id)
- `organizer_racebook_module_settings_edition_id_fkey`: (edition_id) → public.race_event_editions(id)
- `organizer_racebook_module_settings_race_id_fkey`: (race_id) → public.races(id)

**RLS**: ❌ disabled

---

### Table `public.plan_aid_stations`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `plan_id` | `u` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `km` | `n` | ✅ | `` |
| `water_available` | `b` | ✅ | `` |
| `notes` | `t` | ❌ | `` |
| `order_index` | `i` | ✅ | `` |
| `race_aid_station_id` | `u` | ❌ | `` |

**Primary keys**
- `plan_aid_stations_pkey` on (id)

**Foreign keys**
- `plan_aid_stations_plan_id_fkey`: (plan_id) → public.race_plans(id)
- `plan_aid_stations_race_aid_station_id_fkey`: (race_aid_station_id) → public.race_aid_stations(id)

**RLS**: ❌ disabled

---

### Table `public.plan_share_links`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `plan_id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `token_hash` | `t` | ✅ | `` |
| `snapshot` | `j` | ✅ | `` |
| `snapshot_schema_version` | `i` | ✅ | `` |
| `departure_time` | `t` | ❌ | `` |
| `locale` | `t` | ✅ | `` |
| `plan_updated_at` | `t` | ❌ | `` |
| `expires_at` | `t` | ❌ | `` |
| `revoked_at` | `t` | ❌ | `` |
| `crew_state` | `j` | ✅ | `` |

**Primary keys**
- `plan_share_links_pkey` on (id)

**Foreign keys**
- `plan_share_links_plan_id_fkey`: (plan_id) → public.race_plans(id)
- `plan_share_links_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.premium_grants`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `starts_at` | `t` | ✅ | `` |
| `initial_duration_days` | `i` | ✅ | `` |
| `reason` | `t` | ✅ | `` |
| `ends_at` | `t` | ❌ | `` |
| `created_by` | `u` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |

**Primary keys**
- `premium_grants_pkey` on (id)

**Foreign keys**
- `premium_grants_created_by_fkey`: (created_by) → auth.users(id)
- `premium_grants_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.products`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `slug` | `t` | ✅ | `` |
| `sku` | `t` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `calories_kcal` | `n` | ✅ | `` |
| `carbs_g` | `n` | ✅ | `` |
| `protein_g` | `n` | ✅ | `` |
| `fat_g` | `n` | ✅ | `` |
| `is_live` | `b` | ✅ | `` |
| `is_archived` | `b` | ✅ | `` |
| `sodium_mg` | `n` | ✅ | `` |
| `product_url` | `t` | ❌ | `` |
| `fuel_type` | `p` | ✅ | `` |
| `created_by` | `u` | ❌ | `` |
| `image_url` | `t` | ❌ | `` |
| `brand` | `t` | ❌ | `` |
| `is_official` | `b` | ✅ | `` |
| `official_name` | `t` | ❌ | `` |

**Primary keys**
- `products_pkey` on (id)

**Foreign keys**
- `products_created_by_fkey`: (created_by) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.push_devices`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `expo_push_token` | `t` | ✅ | `` |
| `platform` | `t` | ✅ | `` |
| `locale` | `t` | ✅ | `` |
| `app_version` | `t` | ❌ | `` |
| `notifications_enabled` | `b` | ✅ | `` |
| `last_seen_at` | `t` | ✅ | `` |

**Primary keys**
- `push_devices_pkey` on (id)

**Foreign keys**
- `push_devices_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.push_notification_events`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `push_device_id` | `u` | ✅ | `` |
| `plan_id` | `u` | ❌ | `` |
| `notification_kind` | `t` | ✅ | `` |
| `dedupe_key` | `t` | ✅ | `` |
| `payload` | `j` | ✅ | `` |
| `expo_ticket_id` | `t` | ❌ | `` |

**Primary keys**
- `push_notification_events_pkey` on (id)

**Foreign keys**
- `push_notification_events_plan_id_fkey`: (plan_id) → public.race_plans(id)
- `push_notification_events_push_device_id_fkey`: (push_device_id) → public.push_devices(id)
- `push_notification_events_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.race_aid_station_products`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `race_aid_station_id` | `u` | ✅ | `` |
| `product_id` | `u` | ✅ | `` |
| `notes` | `t` | ❌ | `` |
| `order_index` | `i` | ✅ | `` |

**Primary keys**
- `race_aid_station_products_pkey` on (id)

**Foreign keys**
- `race_aid_station_products_product_id_fkey`: (product_id) → public.products(id)
- `race_aid_station_products_race_aid_station_id_fkey`: (race_aid_station_id) → public.race_aid_stations(id)

**RLS**: ❌ disabled

---

### Table `public.race_aid_stations`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `race_id` | `u` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `km` | `n` | ✅ | `` |
| `water_available` | `b` | ✅ | `` |
| `notes` | `t` | ❌ | `` |
| `order_index` | `i` | ✅ | `` |
| `needs_review` | `b` | ✅ | `` |
| `last_gpx_import_at` | `t` | ❌ | `` |
| `solid_available` | `b` | ✅ | `` |
| `assistance_allowed` | `b` | ✅ | `` |
| `organizer_details` | `j` | ❌ | `` |

**Primary keys**
- `race_catalog_aid_stations_pkey` on (id)

**Foreign keys**
- `race_catalog_aid_stations_race_id_fkey`: (race_id) → public.races(id)

**RLS**: ❌ disabled

**Policies**
- `race_aid_stations_delete` — **DELETE** — roles: `authenticated` — USING: `(EXISTS ( SELECT 1 FROM public.races race_row WHERE ((race_row.id = race_aid_stations.race_id) AND (((race_row.created_by = ( SELECT auth.uid() AS uid)) AND (race_row.is_public = false) AND (race_row.is_live = false) AND (race_row.is_published = false) AND (race_row.event_id IS NULL) AND (race_row.edition_id IS NULL) AND (race_row.edition_group_id = race_row.id) AND (race_row.racebook_preview_is_visible = false) AND (race_row.racebook_is_live = false) AND (race_row.racebook_publication_approved_at IS NULL) AND (race_row.racebook_publication_approved_by IS NULL)) OR ( SELECT public.is_admin() AS is_admin)))))`
- `race_aid_stations_update` — **UPDATE** — roles: `authenticated` — USING: `(EXISTS ( SELECT 1 FROM public.races race_row WHERE ((race_row.id = race_aid_stations.race_id) AND (((race_row.created_by = ( SELECT auth.uid() AS uid)) AND (race_row.is_public = false) AND (race_row.is_live = false) AND (race_row.is_published = false) AND (race_row.event_id IS NULL) AND (race_row.edition_id IS NULL) AND (race_row.edition_group_id = race_row.id) AND (race_row.racebook_preview_is_visible = false) AND (race_row.racebook_is_live = false) AND (race_row.racebook_publication_approved_at IS NULL) AND (race_row.racebook_publication_approved_by IS NULL)) OR ( SELECT public.is_admin() AS is_admin)))))` | CHECK: `(EXISTS ( SELECT 1 FROM public.races race_row WHERE ((race_row.id = race_aid_stations.race_id) AND (((race_row.created_by = ( SELECT auth.uid() AS uid)) AND (race_row.is_public = false) AND (race_row.is_live = false) AND (race_row.is_published = false) AND (race_row.event_id IS NULL) AND (race_row.edition_id IS NULL) AND (race_row.edition_group_id = race_row.id) AND (race_row.racebook_preview_is_visible = false) AND (race_row.racebook_is_live = false) AND (race_row.racebook_publication_approved_at IS NULL) AND (race_row.racebook_publication_approved_by IS NULL)) OR ( SELECT public.is_admin() AS is_admin)))))`

---

### Table `public.race_awards`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `race_id` | `u` | ✅ | `` |
| `category_key` | `t` | ✅ | `` |
| `category_label` | `t` | ✅ | `` |
| `audience` | `t` | ✅ | `` |
| `place_from` | `i` | ✅ | `` |
| `place_to` | `i` | ✅ | `` |
| `podium_time` | `t` | ✅ | `` |
| `podium_location` | `t` | ❌ | `` |
| `reward_note` | `t` | ❌ | `` |
| `order_index` | `i` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |

**Primary keys**
- `race_awards_pkey` on (id)

**Foreign keys**
- `race_awards_race_id_fkey`: (race_id) → public.races(id)

**RLS**: ❌ disabled

---

### Table `public.race_edition_services`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `edition_id` | `u` | ✅ | `` |
| `service_type` | `t` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `description` | `t` | ❌ | `` |
| `address` | `t` | ❌ | `` |
| `latitude` | `n` | ❌ | `` |
| `longitude` | `n` | ❌ | `` |
| `google_maps_url` | `t` | ❌ | `` |
| `website_url` | `t` | ❌ | `` |
| `phone` | `t` | ❌ | `` |
| `order_index` | `i` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |

**Primary keys**
- `race_edition_services_pkey` on (id)

**Foreign keys**
- `race_edition_services_edition_id_fkey`: (edition_id) → public.race_event_editions(id)

**RLS**: ❌ disabled

---

### Table `public.race_event_claims`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `event_id` | `u` | ✅ | `` |
| `organization_name` | `t` | ✅ | `` |
| `role_title` | `t` | ✅ | `` |
| `contact_email` | `t` | ✅ | `` |
| `official_site_url` | `t` | ❌ | `` |
| `message` | `t` | ❌ | `` |
| `status` | `t` | ✅ | `` |
| `reviewed_by` | `u` | ❌ | `` |
| `reviewed_at` | `t` | ❌ | `` |
| `reviewer_notes` | `t` | ❌ | `` |

**Primary keys**
- `race_event_claims_pkey` on (id)

**Foreign keys**
- `race_event_claims_event_id_fkey`: (event_id) → public.race_events(id)
- `race_event_claims_reviewed_by_fkey`: (reviewed_by) → auth.users(id)
- `race_event_claims_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.race_event_edition_branding`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `edition_id` | `u` | ✅ | `` |
| `draft_logo_url` | `t` | ❌ | `` |
| `draft_primary_color` | `t` | ✅ | `` |
| `draft_accent_color` | `t` | ✅ | `` |
| `published_logo_url` | `t` | ❌ | `` |
| `published_primary_color` | `t` | ❌ | `` |
| `published_accent_color` | `t` | ❌ | `` |
| `published_at` | `t` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |

**Primary keys**
- `race_event_edition_branding_pkey` on (edition_id)

**Foreign keys**
- `race_event_edition_branding_edition_id_fkey`: (edition_id) → public.race_event_editions(id)

**RLS**: ❌ disabled

---

### Table `public.race_event_edition_requests`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `event_id` | `u` | ✅ | `` |
| `source_year` | `i` | ✅ | `` |
| `requested_start_date` | `d` | ✅ | `` |
| `status` | `t` | ✅ | `` |
| `reviewed_by` | `u` | ❌ | `` |
| `reviewed_at` | `t` | ❌ | `` |
| `reviewer_notes` | `t` | ❌ | `` |

**Primary keys**
- `race_event_edition_requests_pkey` on (id)

**Foreign keys**
- `race_event_edition_requests_event_id_fkey`: (event_id) → public.race_events(id)
- `race_event_edition_requests_reviewed_by_fkey`: (reviewed_by) → auth.users(id)
- `race_event_edition_requests_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.race_event_edition_sponsors`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `edition_id` | `u` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `logo_url` | `t` | ✅ | `` |
| `website_url` | `t` | ❌ | `` |
| `is_active` | `b` | ✅ | `` |
| `show_on_loading` | `b` | ✅ | `` |
| `show_in_banner` | `b` | ✅ | `` |
| `position` | `s` | ✅ | `` |
| `click_count` | `b` | ✅ | `` |
| `partnership_level` | `t` | ✅ | `` |
| `category` | `t` | ❌ | `` |
| `contextual_placement` | `t` | ✅ | `` |
| `impression_count` | `b` | ✅ | `` |

**Primary keys**
- `race_event_edition_sponsors_pkey` on (id)

**Foreign keys**
- `race_event_edition_sponsors_edition_id_fkey`: (edition_id) → public.race_event_editions(id)

**RLS**: ❌ disabled

---

### Table `public.race_event_editions`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `event_id` | `u` | ✅ | `` |
| `edition_year` | `s` | ✅ | `` |
| `start_date` | `d` | ✅ | `` |
| `end_date` | `d` | ✅ | `` |
| `is_current` | `b` | ✅ | `` |
| `is_visible` | `b` | ✅ | `` |
| `module_setup_completed_at` | `t` | ❌ | `` |

**Primary keys**
- `race_event_editions_pkey` on (id)

**Foreign keys**
- `race_event_editions_event_id_fkey`: (event_id) → public.race_events(id)

**RLS**: ❌ disabled

---

### Table `public.race_event_organizers`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `event_id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `claim_id` | `u` | ❌ | `` |
| `role` | `t` | ✅ | `` |
| `created_by` | `u` | ❌ | `` |
| `revoked_at` | `t` | ❌ | `` |
| `revoked_by` | `u` | ❌ | `` |
| `revoke_reason` | `t` | ❌ | `` |
| `dashboard_onboarding_completed_at` | `t` | ❌ | `` |

**Primary keys**
- `race_event_organizers_pkey` on (id)

**Foreign keys**
- `race_event_organizers_claim_id_fkey`: (claim_id) → public.race_event_claims(id)
- `race_event_organizers_created_by_fkey`: (created_by) → auth.users(id)
- `race_event_organizers_event_id_fkey`: (event_id) → public.race_events(id)
- `race_event_organizers_revoked_by_fkey`: (revoked_by) → auth.users(id)
- `race_event_organizers_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.race_event_publication_requests`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `event_id` | `u` | ✅ | `` |
| `status` | `t` | ✅ | `` |
| `reviewed_by` | `u` | ❌ | `` |
| `reviewed_at` | `t` | ❌ | `` |
| `reviewer_notes` | `t` | ❌ | `` |
| `race_id` | `u` | ❌ | `` |

**Primary keys**
- `race_event_publication_requests_pkey` on (id)

**Foreign keys**
- `race_event_publication_requests_event_id_fkey`: (event_id) → public.race_events(id)
- `race_event_publication_requests_race_id_fkey`: (race_id) → public.races(id)
- `race_event_publication_requests_reviewed_by_fkey`: (reviewed_by) → auth.users(id)
- `race_event_publication_requests_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.race_event_update_reads`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `update_id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `read_at` | `t` | ✅ | `` |

**Primary keys**
- `race_event_update_reads_pkey` on (update_id, user_id)

**Foreign keys**
- `race_event_update_reads_update_id_fkey`: (update_id) → public.race_event_updates(id)
- `race_event_update_reads_user_id_fkey`: (user_id) → public.user_profiles(user_id)

**RLS**: ❌ disabled

---

### Table `public.race_event_updates`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `event_id` | `u` | ✅ | `` |
| `created_by` | `u` | ❌ | `` |
| `message` | `t` | ✅ | `` |
| `race_id` | `u` | ❌ | `` |

**Primary keys**
- `race_event_updates_pkey` on (id)

**Foreign keys**
- `race_event_updates_created_by_fkey`: (created_by) → auth.users(id)
- `race_event_updates_event_id_fkey`: (event_id) → public.race_events(id)
- `race_event_updates_race_id_fkey`: (race_id) → public.races(id)

**RLS**: ❌ disabled

---

### Table `public.race_events`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `location` | `t` | ❌ | `` |
| `description` | `t` | ❌ | `` |
| `website_url` | `t` | ❌ | `` |
| `logo_url` | `t` | ❌ | `` |
| `race_date` | `d` | ❌ | `` |
| `is_live` | `b` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `thumbnail_url` | `t` | ❌ | `` |
| `organizer_details` | `j` | ❌ | `` |
| `location_city` | `t` | ❌ | `` |
| `location_city_code` | `t` | ❌ | `` |
| `location_department` | `t` | ❌ | `` |
| `location_department_code` | `t` | ❌ | `` |
| `location_region` | `t` | ❌ | `` |
| `location_region_code` | `t` | ❌ | `` |
| `location_country` | `t` | ❌ | `` |
| `location_country_code` | `t` | ❌ | `` |
| `location_latitude` | `d` | ❌ | `` |
| `location_longitude` | `d` | ❌ | `` |

**Primary keys**
- `race_events_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `public.race_plans`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `planner_values` | `j` | ✅ | `` |
| `elevation_profile` | `j` | ✅ | `` |
| `race_id` | `u` | ❌ | `` |
| `catalog_race_updated_at_at_import` | `t` | ❌ | `` |
| `plan_gpx_path` | `t` | ❌ | `` |
| `plan_course_stats` | `j` | ✅ | `` |

**Primary keys**
- `race_plans_pkey` on (id)

**Foreign keys**
- `race_plans_race_id_fkey`: (race_id) → public.races(id)
- `race_plans_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.race_relay_points`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `race_id` | `u` | ✅ | `` |
| `race_aid_station_id` | `u` | ❌ | `` |
| `name` | `t` | ✅ | `` |
| `km` | `n` | ✅ | `` |
| `handover_time` | `t` | ❌ | `` |
| `cutoff_time` | `t` | ❌ | `` |
| `notes` | `t` | ❌ | `` |
| `order_index` | `i` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |

**Primary keys**
- `race_relay_points_pkey` on (id)

**Foreign keys**
- `race_relay_points_race_aid_station_id_fkey`: (race_aid_station_id) → public.race_aid_stations(id)
- `race_relay_points_race_id_fkey`: (race_id) → public.races(id)

**RLS**: ❌ disabled

---

### Table `public.race_requests`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `b` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `race_name` | `t` | ✅ | `` |
| `location` | `t` | ✅ | `` |
| `requested_date` | `d` | ✅ | `` |
| `status` | `t` | ✅ | `` |

**Primary keys**
- `race_requests_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `public.race_slug_redirects`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `old_slug` | `t` | ✅ | `` |
| `race_id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |

**Primary keys**
- `race_slug_redirects_pkey` on (old_slug)

**Foreign keys**
- `race_slug_redirects_race_id_fkey`: (race_id) → public.races(id)

**RLS**: ❌ disabled

---

### Table `public.race_start_waves`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `race_id` | `u` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `start_time` | `t` | ✅ | `` |
| `eligibility_type` | `t` | ✅ | `` |
| `bib_number_min` | `i` | ❌ | `` |
| `bib_number_max` | `i` | ❌ | `` |
| `finish_minutes_min` | `i` | ❌ | `` |
| `finish_minutes_max` | `i` | ❌ | `` |
| `pace_seconds_min` | `i` | ❌ | `` |
| `pace_seconds_max` | `i` | ❌ | `` |
| `eligibility_note` | `t` | ❌ | `` |
| `order_index` | `i` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |

**Primary keys**
- `race_start_waves_pkey` on (id)

**Foreign keys**
- `race_start_waves_race_id_fkey`: (race_id) → public.races(id)

**RLS**: ❌ disabled

---

### Table `public.racebook_gear_checks`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `user_id` | `u` | ✅ | `` |
| `race_id` | `u` | ✅ | `` |
| `item_key` | `t` | ✅ | `` |
| `checked_at` | `t` | ✅ | `` |

**Primary keys**
- `racebook_gear_checks_pkey` on (user_id, race_id, item_key)

**Foreign keys**
- `racebook_gear_checks_race_id_fkey`: (race_id) → public.races(id)
- `racebook_gear_checks_user_id_fkey`: (user_id) → public.user_profiles(user_id)

**RLS**: ❌ disabled

---

### Table `public.races`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `slug` | `t` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `location` | `t` | ❌ | `` |
| `distance_km` | `n` | ✅ | `` |
| `elevation_gain_m` | `n` | ❌ | `` |
| `source_url` | `t` | ❌ | `` |
| `image_url` | `t` | ❌ | `` |
| `gpx_path` | `t` | ❌ | `` |
| `gpx_hash` | `t` | ❌ | `` |
| `is_published` | `b` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `is_live` | `b` | ✅ | `` |
| `location_text` | `t` | ❌ | `` |
| `trace_provider` | `t` | ❌ | `` |
| `trace_id` | `b` | ❌ | `` |
| `gpx_storage_path` | `t` | ❌ | `` |
| `gpx_sha256` | `t` | ❌ | `` |
| `elevation_loss_m` | `n` | ✅ | `` |
| `min_alt_m` | `n` | ❌ | `` |
| `max_alt_m` | `n` | ❌ | `` |
| `start_lat` | `n` | ❌ | `` |
| `start_lng` | `n` | ❌ | `` |
| `bounds_min_lat` | `n` | ❌ | `` |
| `bounds_min_lng` | `n` | ❌ | `` |
| `bounds_max_lat` | `n` | ❌ | `` |
| `bounds_max_lng` | `n` | ❌ | `` |
| `thumbnail_url` | `t` | ❌ | `` |
| `external_site_url` | `t` | ❌ | `` |
| `notes` | `t` | ❌ | `` |
| `race_date` | `d` | ❌ | `` |
| `created_by` | `u` | ❌ | `` |
| `is_public` | `b` | ✅ | `` |
| `has_aid_stations` | `b` | ✅ | `` |
| `event_id` | `u` | ❌ | `` |
| `organizer_details` | `j` | ❌ | `` |
| `edition_group_id` | `u` | ✅ | `` |
| `series_name` | `t` | ✅ | `` |
| `edition_id` | `u` | ❌ | `` |
| `racebook_is_live` | `b` | ✅ | `` |
| `racebook_publication_approved_at` | `t` | ❌ | `` |
| `racebook_publication_approved_by` | `u` | ❌ | `` |
| `data_status` | `t` | ✅ | `` |
| `missing_required_fields` | `t` | ✅ | `` |
| `participation_mode` | `t` | ❌ | `` |
| `racebook_preview_is_visible` | `b` | ✅ | `` |
| `web_catalog_is_live` | `b` | ✅ | `` |

**Primary keys**
- `race_catalog_pkey` on (id)

**Foreign keys**
- `races_created_by_fkey`: (created_by) → auth.users(id)
- `races_edition_id_fkey`: (edition_id) → public.race_event_editions(id)
- `races_event_id_fkey`: (event_id) → public.race_events(id)
- `races_racebook_publication_approved_by_fkey`: (racebook_publication_approved_by) → auth.users(id)

**RLS**: ❌ disabled

**Policies**
- `races_delete` — **DELETE** — roles: `authenticated` — USING: `(( SELECT public.is_admin() AS is_admin) OR ((created_by = ( SELECT auth.uid() AS uid)) AND (is_public = false) AND (is_live = false) AND (is_published = false) AND (event_id IS NULL) AND (edition_id IS NULL) AND (edition_group_id = id) AND (racebook_preview_is_visible = false) AND (racebook_is_live = false) AND (racebook_publication_approved_at IS NULL) AND (racebook_publication_approved_by IS NULL)))`
- `races_update` — **UPDATE** — roles: `authenticated` — USING: `(( SELECT public.is_admin() AS is_admin) OR ((created_by = ( SELECT auth.uid() AS uid)) AND (is_public = false) AND (is_live = false) AND (is_published = false) AND (event_id IS NULL) AND (edition_id IS NULL) AND (edition_group_id = id) AND (racebook_preview_is_visible = false) AND (racebook_is_live = false) AND (racebook_publication_approved_at IS NULL) AND (racebook_publication_approved_by IS NULL)))` | CHECK: `(( SELECT public.is_admin() AS is_admin) OR ((created_by = ( SELECT auth.uid() AS uid)) AND (is_public = false) AND (is_live = false) AND (is_published = false) AND (event_id IS NULL) AND (edition_id IS NULL) AND (edition_group_id = id) AND (racebook_preview_is_visible = false) AND (racebook_is_live = false) AND (racebook_publication_approved_at IS NULL) AND (racebook_publication_approved_by IS NULL)))`

---

### Table `public.rate_limit_entries`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `key` | `t` | ✅ | `` |
| `count` | `i` | ✅ | `` |
| `reset_at` | `t` | ✅ | `` |

**Primary keys**
- `rate_limit_entries_pkey` on (key)

**RLS**: ❌ disabled

---

### Table `public.subscriptions`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `user_id` | `u` | ✅ | `` |
| `stripe_customer_id` | `t` | ❌ | `` |
| `stripe_subscription_id` | `t` | ❌ | `` |
| `status` | `t` | ❌ | `` |
| `price_id` | `t` | ❌ | `` |
| `current_period_end` | `t` | ❌ | `` |
| `updated_at` | `t` | ✅ | `` |
| `plan_name` | `t` | ❌ | `` |
| `provider` | `t` | ✅ | `` |

**Primary keys**
- `subscriptions_pkey` on (user_id)

**Foreign keys**
- `subscriptions_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `public.user_favorite_products`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `product_id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |

**Primary keys**
- `user_favorite_products_pkey` on (id)

**Foreign keys**
- `user_favorite_products_product_id_fkey`: (product_id) → public.products(id)
- `user_favorite_products_user_id_fkey`: (user_id) → public.user_profiles(user_id)

**RLS**: ❌ disabled

---

### Table `public.user_favorite_race_events`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `event_id` | `u` | ✅ | `` |

**Primary keys**
- `user_favorite_race_events_pkey` on (id)

**Foreign keys**
- `user_favorite_race_events_event_id_fkey`: (event_id) → public.race_events(id)
- `user_favorite_race_events_user_id_fkey`: (user_id) → public.user_profiles(user_id)

**RLS**: ❌ disabled

---

### Table `public.user_profiles`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `user_id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `full_name` | `t` | ❌ | `` |
| `age` | `i` | ❌ | `` |
| `water_bag_liters` | `n` | ❌ | `` |
| `role` | `t` | ❌ | `` |
| `trial_started_at` | `t` | ❌ | `` |
| `trial_ends_at` | `t` | ❌ | `` |
| `trial_welcome_seen_at` | `t` | ❌ | `` |
| `trial_expired_seen_at` | `t` | ❌ | `` |
| `birth_date` | `d` | ❌ | `` |
| `comfortable_flat_pace_min_per_km` | `n` | ❌ | `` |
| `utmb_index` | `n` | ❌ | `` |
| `default_carbs_g_per_hour` | `i` | ❌ | `` |
| `default_water_ml_per_hour` | `i` | ❌ | `` |
| `default_sodium_mg_per_hour` | `i` | ❌ | `` |
| `weight_kg` | `n` | ❌ | `` |
| `height_cm` | `i` | ❌ | `` |
| `sign_in_count` | `i` | ✅ | `` |
| `first_sign_in_at` | `t` | ❌ | `` |
| `last_sign_in_at` | `t` | ❌ | `` |
| `onboarding_completed_at` | `t` | ❌ | `` |
| `plan_onboarding_status` | `t` | ✅ | `` |
| `racebook_onboarding_status` | `t` | ✅ | `` |

**Primary keys**
- `user_profiles_pkey` on (user_id)

**Foreign keys**
- `user_profiles_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

## Schema `realtime`

### Table `realtime.messages`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `topic` | `t` | ✅ | `` |
| `extension` | `t` | ✅ | `` |
| `payload` | `j` | ❌ | `` |
| `event` | `t` | ❌ | `` |
| `private` | `b` | ❌ | `` |
| `updated_at` | `t` | ✅ | `` |
| `inserted_at` | `t` | ✅ | `` |
| `id` | `u` | ✅ | `` |
| `binary_payload` | `b` | ❌ | `` |
| `skip_broadcast` | `b` | ✅ | `` |

**Primary keys**
- `messages_pkey` on (id, inserted_at)

**RLS**: ❌ disabled

---

### Table `realtime.schema_migrations`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `version` | `b` | ✅ | `` |
| `inserted_at` | `t` | ❌ | `` |

**Primary keys**
- `schema_migrations_pkey` on (version)

**RLS**: ❌ disabled

---

### Table `realtime.subscription`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `b` | ✅ | `` |
| `subscription_id` | `u` | ✅ | `` |
| `entity` | `r` | ✅ | `` |
| `filters` | `r` | ✅ | `` |
| `claims` | `j` | ✅ | `` |
| `claims_role` | `r` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `action_filter` | `t` | ❌ | `` |
| `selected_columns` | `t` | ❌ | `` |

**Primary keys**
- `pk_subscription` on (id)

**RLS**: ❌ disabled

---

## Schema `storage`

### Table `storage.buckets`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `t` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `owner` | `u` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `public` | `b` | ❌ | `` |
| `avif_autodetection` | `b` | ❌ | `` |
| `file_size_limit` | `b` | ❌ | `` |
| `allowed_mime_types` | `t` | ❌ | `` |
| `owner_id` | `t` | ❌ | `` |
| `type` | `s` | ✅ | `` |
| `versioning_status` | `t` | ✅ | `` |
| `lifecycle_configuration` | `j` | ❌ | `` |
| `lifecycle_configuration_generation` | `u` | ❌ | `` |

**Primary keys**
- `buckets_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `storage.buckets_analytics`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `name` | `t` | ✅ | `` |
| `type` | `s` | ✅ | `` |
| `format` | `t` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `id` | `u` | ✅ | `` |
| `deleted_at` | `t` | ❌ | `` |

**Primary keys**
- `buckets_analytics_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `storage.buckets_vectors`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `t` | ✅ | `` |
| `type` | `s` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |

**Primary keys**
- `buckets_vectors_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `storage.migrations`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `i` | ✅ | `` |
| `name` | `c` | ✅ | `` |
| `hash` | `c` | ✅ | `` |
| `executed_at` | `t` | ❌ | `` |

**Primary keys**
- `migrations_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `storage.objects`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `bucket_id` | `t` | ❌ | `` |
| `name` | `t` | ❌ | `` |
| `owner` | `u` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `last_accessed_at` | `t` | ❌ | `` |
| `metadata` | `j` | ❌ | `` |
| `path_tokens` | `t` | ❌ | `` |
| `version` | `t` | ❌ | `` |
| `owner_id` | `t` | ❌ | `` |
| `user_metadata` | `j` | ❌ | `` |
| `archived_at` | `t` | ❌ | `` |
| `is_delete_marker` | `b` | ✅ | `` |
| `is_versioned` | `b` | ✅ | `` |

**Primary keys**
- `objects_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `storage.s3_multipart_uploads`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `t` | ✅ | `` |
| `in_progress_size` | `b` | ✅ | `` |
| `upload_signature` | `t` | ✅ | `` |
| `bucket_id` | `t` | ✅ | `` |
| `key` | `t` | ✅ | `` |
| `version` | `t` | ✅ | `` |
| `owner_id` | `t` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |
| `user_metadata` | `j` | ❌ | `` |
| `metadata` | `j` | ❌ | `` |

**Primary keys**
- `s3_multipart_uploads_pkey` on (id)

**Foreign keys**
- `s3_multipart_uploads_bucket_id_fkey`: (bucket_id) → storage.buckets(id)

**RLS**: ❌ disabled

---

### Table `storage.s3_multipart_uploads_parts`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `upload_id` | `t` | ✅ | `` |
| `size` | `b` | ✅ | `` |
| `part_number` | `i` | ✅ | `` |
| `bucket_id` | `t` | ✅ | `` |
| `key` | `t` | ✅ | `` |
| `etag` | `t` | ✅ | `` |
| `owner_id` | `t` | ❌ | `` |
| `version` | `t` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |

**Primary keys**
- `s3_multipart_uploads_parts_pkey` on (id)

**Foreign keys**
- `s3_multipart_uploads_parts_bucket_id_fkey`: (bucket_id) → storage.buckets(id)
- `s3_multipart_uploads_parts_upload_id_fkey`: (upload_id) → storage.s3_multipart_uploads(id)

**RLS**: ❌ disabled

---

### Table `storage.vector_indexes`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `t` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `bucket_id` | `t` | ✅ | `` |
| `data_type` | `t` | ✅ | `` |
| `dimension` | `i` | ✅ | `` |
| `distance_metric` | `t` | ✅ | `` |
| `metadata_configuration` | `j` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |

**Primary keys**
- `vector_indexes_pkey` on (id)

**Foreign keys**
- `vector_indexes_bucket_id_fkey`: (bucket_id) → storage.buckets_vectors(id)

**RLS**: ❌ disabled

---

## Schema `supabase_migrations`

### Table `supabase_migrations.schema_migrations`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `version` | `t` | ✅ | `` |
| `statements` | `t` | ❌ | `` |
| `name` | `t` | ❌ | `` |
| `created_by` | `t` | ❌ | `` |
| `idempotency_key` | `t` | ❌ | `` |
| `rollback` | `t` | ❌ | `` |

**Primary keys**
- `schema_migrations_pkey` on (version)

**RLS**: ❌ disabled

---
