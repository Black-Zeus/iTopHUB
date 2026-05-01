# iTop Container

## Role

Runs the iTop platform used as the ITSM/CMDB base of the solution.

## Runtime

- Service name: `itop`
- Main port in dev: `ITOP_PORT -> 80`
- Data volume: `${PROJECT_NAME}_itop_data`
- Logs mount: `APP/logs/<env>/itop`
- Shared MariaDB server with dedicated application database name: `ITOP_DB_NAME`

## Current Intent

- iTop is a platform dependency, not the place for all custom business logic.
- The custom Hub should sit beside it, not inside it unless extension work is truly needed.
- In `dev`, it is exposed behind `nginx` as a temporary local dependency.
- In `qa` and `prd`, the target is the original iTop site, not a local iTop container.
- The current image is a pinned PHP/Apache runtime prepared for manual iTop installation, not an official Combodo image.

## Notes

- Uses non-root database credentials.
- The container is intentionally version-pinned and does not use `latest`.
- If the named Docker volume is empty, the container can auto-bootstrap iTop `3.2.2-1`.
- If the automatic bootstrap fails, the container creates a minimal PHP landing page so the service can start cleanly.
- A read-only installer toolbox is mounted from `APP/config/itop-installer` into `/opt/itop-installer`.
- Manual bootstrap of iTop files can be triggered with `sh /opt/itop-installer/install_itop.sh`.
- The PHP runtime includes `apcu` and an explicit writable `session.save_path` to keep the installation wizard clean.
- The image also includes the MariaDB client so iTop scheduled/manual backups can execute `mysqldump` from inside the `itop` container.
- For Hub authentication with personal iTop tokens, the token created in iTop must use scope `REST/JSON`.
- In the Hub, a personal iTop token is not a substitute for the normal username/password login. It is validated after the password-based login succeeds, or captured directly only during the first-admin bootstrap wizard.
- The iTop instance must also allow REST token authentication in its configuration. If `allowed_login_types` is defined in the iTop config, it must include `rest-token` in addition to the other enabled methods, for example: `form|basic|external|rest-token`.
- The `authent-token` module must allow personal tokens for profile `REST Services User`, not only `Administrator`, because Hub runtime operations use each user's own token.
- If the token scope is correct but `rest-token` is not enabled in iTop configuration, Hub bootstrap and later REST calls may fail with token-invalid or invalid-login errors even when the username and password are correct.

## Hub Token Validation Checklist

- Runtime iTop config: validate `APP/config/itop-installer/html/conf/production/config-itop.php`.
  - `allowed_login_types` must include `rest-token`.
- Runtime compiled module config: validate `APP/config/itop-installer/html/env-production/core/main.php`.
  - `authent-token.personal_tokens_allowed_profiles` must include `REST Services User`.
- Module source/defaults: validate `APP/config/itop-installer/html/datamodels/2.x/authent-token/datamodel.authent-token.xml`.
  - Keep `REST Services User` under `personal_tokens_allowed_profiles` so future recompilation does not revert the runtime policy.
- Current environment module copy: validate `APP/config/itop-installer/html/env-production/authent-token/datamodel.authent-token.xml`.
  - Keep the same `personal_tokens_allowed_profiles` values as the source module.
- Compiled datamodel snapshot: validate `APP/config/itop-installer/html/data/datamodel-production.xml`.
  - Keep `REST Services User` under the `authent-token` module parameters if the runtime compiled data is versioned or restored from this tree.
- User/profile data in iTop:
  - The user must be enabled.
  - The user must have profile `REST Services User` at minimum.
  - The personal token must be created for that user with scope `REST/JSON`.
- Diagnostic logs:
  - Check `APP/config/itop-installer/html/log/error.log`.
  - `No personal token allowed profile` means the token exists but the user's iTop profiles are not allowed by `authent-token.personal_tokens_allowed_profiles`.
  - `invalid_token` means the token value sent by the Hub does not match a valid personal token record.
