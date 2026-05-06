---
name: open-modernized-web-client-browser
description: Start the OpenDolphin_WebClient modernized local stack with WEB_CLIENT_MODE=npm, repair browser-incompatible Vite HTTPS/localhost binding when needed, and display the web client in the Codex in-app browser. Use when the user asks to launch, start, open, show, or fix the Web client screen/browser for this repository.
---

# Open Modernized Web Client

Use this repository-local workflow to start `server-modernized` with Docker and `web-client` with npm, then open the app in the Codex in-app browser.

## Constraints

- Work from the repository root.
- Do not modify `client/` or `server/`.
- Do not run Python scripts; this repository forbids them unless explicitly requested.
- Prefer `http://localhost:5173/` for Codex browser display. Do not bypass a self-signed HTTPS browser warning; restart the web client with `VITE_DEV_USE_HTTPS=0`.
- Bind the npm Vite server to `0.0.0.0` for Codex browser compatibility. A `localhost` bind can appear as IPv6-only (`[::1]:5173`) and fail from the browser/sandbox.
- Do not print raw ORCA credentials or other secrets. Report only set/unset or sanitized status.

## Standard Startup

Use the repo script when a full local stack startup or refresh is appropriate. Add the HTTP and host overrides even when the user mentions only `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`; these are the browser-compatible defaults for Codex:

```bash
WEB_CLIENT_MODE=npm WEB_CLIENT_DEV_HOST=0.0.0.0 VITE_DEV_USE_HTTPS=0 ./setup-modernized-env.sh
```

This starts `server-modernized` through Docker Compose and starts `web-client` via `npm run dev` on port `5173`.

The expected Vite log contains:

```text
Local:   http://localhost:5173/
```

If the log says `https://localhost:5173/`, the app is not ready for Codex browser display; use the fast restart below.

If the server is already healthy and only the browser-compatible web-client endpoint needs to be repaired, use the fast restart below instead of rebuilding containers.

## Fast Web-Client HTTP Restart

Use this when `opendolphin-server-modernized-dev` is already healthy but the web client is on `https://localhost:5173/`, bound only to `[::1]:5173`, or port `5173` is stale:

```bash
tmux kill-session -t opendolphin-web-client-dev 2>/dev/null || true
rm -f tmp/web-client-dev.pid
kill $(lsof -t -iTCP:5173 -sTCP:LISTEN 2>/dev/null) 2>/dev/null || true
tmux new-session -d \
  -s opendolphin-web-client-dev \
  -c "$PWD/web-client" \
  "VITE_DEV_USE_HTTPS=0 VITE_DISABLE_MSW=1 VITE_ENABLE_TELEMETRY=0 VITE_DISABLE_SECURITY=0 VITE_DISABLE_AUDIT=0 VITE_ENABLE_FACILITY_HEADER=1 VITE_API_BASE_URL=/api VITE_DEV_PROXY_TARGET=http://localhost:9080/openDolphin WEB_CLIENT_DEV_PROXY_TARGET=http://localhost:9080/openDolphin npm run dev -- --host 0.0.0.0 --port 5173 > ../tmp/web-client-dev.log 2>&1"
```

## Verification

Confirm the server, web client, Vite proxy, and process state. Use `127.0.0.1` for curl checks to avoid localhost IPv6 ambiguity:

```bash
docker ps --filter name=opendolphin-server-modernized-dev --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
curl -fsS -o /tmp/opendolphin-health.json -w 'server_health_http=%{http_code}\n' http://127.0.0.1:9080/openDolphin/api/health
curl -fsS -o /tmp/opendolphin-web.html -w 'web_client_http=%{http_code}\n' http://127.0.0.1:5173/
curl -fsS -o /tmp/opendolphin-proxy-health.json -w 'proxy_health_http=%{http_code}\n' http://127.0.0.1:5173/api/health
tmux ls 2>/dev/null | sed -n '1,20p'
lsof -nP -iTCP:5173 -sTCP:LISTEN 2>/dev/null || true
tail -80 tmp/web-client-dev.log
```

Expected:

- `opendolphin-server-modernized-dev` is `healthy`.
- server health returns `200`.
- web client returns `200`.
- Vite `/api` proxy health returns `200`.
- `opendolphin-web-client-dev` tmux session exists.
- `lsof` shows `*:5173` or another IPv4-compatible listener, not only `[::1]:5173`.
- `tmp/web-client-dev.log` shows `http://localhost:5173/`, not `https://localhost:5173/`.

If `curl http://127.0.0.1:5173/` returns `000`, first inspect `tmp/web-client-dev.log`. If Vite is serving HTTPS or only listening on IPv6 localhost, run the fast restart.

## Open in Codex Browser

Use the Browser plugin skill (`browser-use:browser`) and open:

```text
http://localhost:5173/
```

Wait for `domcontentloaded`, then verify the page title and current URL. A successful load normally redirects to the facility login route:

```text
http://localhost:5173/f/1.3.6.1.4.1.9414.72.103/login
```

Confirm the title is `OpenDolphin Web Client` and the visible screen is the login screen. If the page stays at `セッションを確認中…`, verify `http://127.0.0.1:5173/api/health` returns `200`, then reload the browser tab.

## Development Login Account

After the browser is open, report the local development smoke account that can log in. Use the effective startup environment if the user overrode these values; otherwise use the defaults from `setup-modernized-env.sh`:

```text
Login URL: http://localhost:5173/f/1.3.6.1.4.1.9414.72.103/login
Facility ID: 1.3.6.1.4.1.9414.72.103
User ID: doctor1
Password: doctor2025
```

If `OPENDOLPHIN_FACILITY_ID`, `DEV_SMOKE_USER_ID`, or `DEV_SMOKE_USER_PASS` were set for this startup, report those effective values instead. This account is only the local development smoke login; do not output raw ORCA credentials, object storage secrets, Basic auth values, certificates, or other integration credentials.

## Reporting

Report in Japanese with:

- RUN_ID
- server container status
- server health HTTP code
- web client URL and HTTP code
- Codex browser URL/title or visible screen
- development login URL, facility ID, user ID, and password
- whether HTTPS was changed to HTTP for browser compatibility
- final `git status --short` if files were changed
