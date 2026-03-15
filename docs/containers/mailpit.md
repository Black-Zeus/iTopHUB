# Mailpit Container

## Role

Captures outgoing email in development environments so the system can test mail flows without real delivery.

## Runtime

- Service name: `mailpit`
- UI port in dev: `MAILPIT_UI_PORT -> 8025`
- SMTP port in dev: `MAILPIT_SMTP_PORT -> 1025`

## Current Intent

- Use only as a development/testing SMTP sink.
- Do not model production email behavior around Mailpit-specific assumptions.
