# Access Control Domain

## Scope

Covers Hub login, authorization, user linking, personal iTop token handling, and runtime session rules.

## Current Intent

- iTop remains the identity source for username/password validation.
- The Hub adds its own authorization layer, roles, module permissions, and personal token registration.
- Runtime access to iTop must always use the authenticated user's own personal token.

## Business Rules

- Login flow:
  - first validate username and password against iTop
  - the normal Hub login does not accept a personal iTop token as a replacement for the password
  - the personal token is not a primary login credential for `/v1/auth/login`
  - if iTop login fails, deny access
  - if iTop login succeeds, evaluate the Hub user record, role, and personal token state
  - if the user already has a personal token stored in Hub, backend validates that stored token after the password-based iTop login succeeds
- Initial bootstrap flow:
  - if the Hub has no local users yet, the login page must switch to an initial setup wizard
  - the wizard must request:
    - iTop base URL
    - iTop administrator username/password
    - personal iTop token for that administrator
  - the backend must validate those values against iTop before creating any Hub user
  - if validation succeeds, the backend must:
    - persist the iTop integration settings
    - create the first Hub user with role `administrator`
    - persist the personal token encrypted
    - start the session immediately
  - once at least one Hub user exists, the bootstrap wizard must no longer be available
- Non-admin user without personal token:
  - cannot log in to iTop-Hub
  - must see a message instructing them to contact their administrator
- Administrator without personal token:
  - can log in
  - access is limited to `Configuracion` and `Usuarios`
  - must register their own personal token from `Usuarios` before using Hub features that call iTop
- Administrator with invalid personal token:
  - can still log in in limited mode
  - must correct their own token from `Usuarios`
- User linking:
  - the Hub does not create iTop identities
  - `Vincular usuario` only links accounts that already exist in iTop
  - the lookup must query iTop user classes, not `Person`

## Roles And Permissions

- Roles/profiles are managed by the Hub database.
- Module access is driven by Hub role configuration, not by iTop profiles.
- The session payload returned to the frontend must contain the effective module permissions for the current user.

## Token Rules

- The personal iTop token must be persisted encrypted in MariaDB.
- Tokens written as comments or test notes in `.env.dev` are not consumed by the normal Hub login flow.
- The login endpoint `/v1/auth/login` only receives `username` and `password`.
- The bootstrap endpoint `/v1/auth/bootstrap` is the only auth entrypoint that accepts a raw token directly from the UI.
- The personal iTop token used by Hub must be created in iTop with scope `REST/JSON`.
- The source iTop instance must have REST token authentication enabled in its configuration. If `allowed_login_types` is configured, it must include `rest-token`.
- The source iTop instance must allow personal token usage for profile `REST Services User`, so normal linked users can authenticate through their own tokens without becoming iTop administrators.
- When token authentication fails, validate these iTop-side entries before changing Hub code:
  - `conf/production/config-itop.php`: `allowed_login_types` includes `rest-token`.
  - `env-production/core/main.php`: `authent-token.personal_tokens_allowed_profiles` includes `REST Services User`.
  - iTop user profile assignment: the user has profile `REST Services User`.
  - iTop personal token record: the token belongs to that user and includes scope `REST/JSON`.
  - iTop `log/error.log`: `No personal token allowed profile` points to profile policy, while `invalid_token` points to an incorrect or revoked token value.
- The token must never be returned to the browser.
- The token must only be decrypted in backend memory immediately before an iTop call.
- The token shown in `Usuarios` must be masked:
  - first 3 characters
  - 10 asterisks
  - last 3 characters
- Editing a user without changing the token field must not overwrite the stored token.
- Clearing the token field after editing it must remove the stored token.

## Runtime Session Rules

- Redis is runtime cache only, not the source of truth.
- Current Redis keys:
  - `hub:session:{session_id}:meta`
  - `hub:session:{session_id}:token`
- Session inactivity TTL:
  - currently 4 hours in `dev`
- Runtime decrypted token TTL:
  - currently 1 hour in `dev`
- The frontend warning must use the configured `warningSeconds` returned by the backend, but it should open 10 seconds earlier than that threshold as a safety margin. Example: if `warningSeconds` is 40, the modal opens 50 seconds before expiry and keeps a visible 40-second countdown.
- If a request needs iTop and the runtime token is no longer in Redis, the frontend must ask for the user's password to revalidate and reload the token into Redis.
- Async jobs that depend on the session runtime token must use the same Redis-backed token contract as direct API calls. If they cannot recover a valid runtime token, they must return a `TOKEN_REVALIDATION_REQUIRED` error to the UI instead of downgrading it to a generic processing failure.
- Any service that needs to decode the Redis runtime token outside the main backend process must share the same token-encryption settings (`HUB_TOKEN_KEK` and `HUB_TOKEN_KEK_VERSION`), or the token cache becomes unreadable even if the session metadata is still valid.

## Notes

- The browser should keep only the session cookie, never passwords or tokens.
- The Hub session and token cache may expire independently.
- Token revalidation is part of normal runtime behavior, not a failure by itself.
