---
name: open-modernized-web-client-browser
description: Start the OpenDolphin_WebClient modernized local development stack with server-modernized in Docker and web-client via npm, then display the web client in the Codex in-app browser. Use when the user asks to launch, start, open, or show the Web client screen/browser for this repository.
---

# Open Modernized Web Client

Use this repository-local workflow to start `server-modernized` with Docker and `web-client` with npm, then open the app in the Codex in-app browser.

## Constraints

- Work from the repository root.
- Do not modify `client/` or `server/`.
- Do not run Python scripts; this repository forbids them unless explicitly requested.
- Prefer `http://localhost:5173/` for Codex browser display. If Vite is running on self-signed HTTPS and the browser reports a certificate authority error, do not bypass the browser warning; restart the web client with `VITE_DEV_USE_HTTPS=0`.
- Do not print raw ORCA credentials or other secrets. Report only set/unset or sanitized status.

## Standard Startup

Use the repo script when a full local stack startup or refresh is appropriate:

```bash
WEB_CLIENT_MODE=npm VITE_DEV_USE_HTTPS=0 ./setup-modernized-env.sh
```

This starts `server-modernized` through Docker Compose and starts `web-client` via `npm run dev` on port `5173`.

If the server is already healthy and only the browser-compatible web-client endpoint needs to be repaired, use the fast restart below instead of rebuilding containers.

## Fast Web-Client HTTP Restart

Use this when `opendolphin-server-modernized-dev` is already healthy but the web client is on `https://localhost:5173/` or port `5173` is stale:

```bash
tmux kill-session -t opendolphin-web-client-dev 2>/dev/null || true
rm -f tmp/web-client-dev.pid
kill $(lsof -t -iTCP:5173 -sTCP:LISTEN 2>/dev/null) 2>/dev/null || true
tmux new-session -d \
  -s opendolphin-web-client-dev \
  -c "$PWD/web-client" \
  "VITE_DEV_USE_HTTPS=0 VITE_DISABLE_MSW=1 VITE_ENABLE_TELEMETRY=0 VITE_DISABLE_SECURITY=0 VITE_DISABLE_AUDIT=0 VITE_ENABLE_FACILITY_HEADER=1 VITE_API_BASE_URL=/api VITE_DEV_PROXY_TARGET=http://localhost:9080/openDolphin WEB_CLIENT_DEV_PROXY_TARGET=http://localhost:9080/openDolphin npm run dev -- --host localhost --port 5173 > ../tmp/web-client-dev.log 2>&1"
```

## Verification

Confirm the server, web client, and process state:

```bash
docker ps --filter name=opendolphin-server-modernized-dev --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
curl -fsS -o /tmp/opendolphin-health.json -w 'server_health_http=%{http_code}\n' http://localhost:9080/openDolphin/api/health
curl -fsS -o /tmp/opendolphin-web.html -w 'web_client_http=%{http_code}\n' http://localhost:5173/
tmux ls 2>/dev/null | sed -n '1,20p'
lsof -nP -iTCP:5173 -sTCP:LISTEN 2>/dev/null || true
```

Expected:

- `opendolphin-server-modernized-dev` is `healthy`.
- server health returns `200`.
- web client returns `200`.
- `opendolphin-web-client-dev` tmux session exists.

If `curl http://localhost:5173/` returns an empty response, Vite is probably serving HTTPS. Restart with `VITE_DEV_USE_HTTPS=0`.

## Open in Codex Browser

Use the Browser plugin skill (`browser-use:browser`) and open:

```text
http://localhost:5173/
```

Wait for `domcontentloaded`, then verify the page title and current URL. A successful load normally redirects to a facility login route such as:

```text
http://localhost:5173/f/1.3.6.1.4.1.9414.72.103/login
```

Take a screenshot or DOM snapshot to confirm the login screen is visible.

## Reporting

Report in Japanese with:

- RUN_ID
- server container status
- server health HTTP code
- web client URL and HTTP code
- Codex browser URL/title or visible screen
- whether HTTPS was changed to HTTP for browser compatibility
- final `git status --short` if files were changed
