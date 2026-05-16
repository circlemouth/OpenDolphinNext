# CSRF Login Refresh Contract

RUN_ID: 20260516T090905Z

This note extends `web-client/notes/security-spec.md` for the login screen.

- Login submit must fail closed when `meta[name="csrf-token"]` is missing, blank, or `__CSRF_TOKEN__`.
- Before sending credentials, the login screen may issue one same-origin `GET` for the current login document with `Accept: text/html`, `credentials: include`, and `cache: no-store`.
- The client may update only the CSRF meta tag from the server-issued HTML token. It must not accept the placeholder token.
- If the refresh cannot obtain a non-placeholder token, credential POST must still be blocked by the normal CSRF guard.
- This recovery is limited to same-origin login HTML bootstrap and must not fetch arbitrary URLs or expose credentials.
