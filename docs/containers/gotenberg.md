# Gotenberg Container

## Role

Provides the rendering engine used by the PDF worker to produce documents.

## Runtime

- Service name: `gotenberg`
- Internal service consumed by `pdf-worker`

## Current Intent

- Keep document rendering isolated from the backend and from iTop.
- Centralize heavy PDF generation in the dedicated document pipeline.
