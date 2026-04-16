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
  - if iTop login fails, deny access
  - if iTop login succeeds, evaluate the Hub user record, role, and personal token state
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
- The personal iTop token used by Hub must be created in iTop with scope `REST/JSON`.
- The source iTop instance must have REST token authentication enabled in its configuration. If `allowed_login_types` is configured, it must include `rest-token`.
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

## Notes

- The browser should keep only the session cookie, never passwords or tokens.
- The Hub session and token cache may expire independently.
- Token revalidation is part of normal runtime behavior, not a failure by itself.
