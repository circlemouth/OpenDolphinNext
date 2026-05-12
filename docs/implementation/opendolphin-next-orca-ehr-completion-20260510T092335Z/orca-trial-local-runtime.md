# WebORCA Trial Local Runtime Handoff

- Status: active local handoff
- RUN_ID: `20260511T151412Z`
- Owner: Integrator G
- Scope: local checkout runtime setup for subsequent A/D live ORCA evidence reruns

## What is already prepared

Integrator G prepared a repo-root `orca.env.local` in this checkout for WebORCA Trial runs.

- Path: `./orca.env.local`
- Git state: ignored by `.gitignore`; must remain untracked
- File mode: `600`
- Intended consumers: `setup-modernized-env.sh`, ORCA smoke/QA scripts, and web-client dev runtime paths that already auto-load the local ORCA env file
- Endpoint class: WebORCA Trial over HTTPS on port `443`
- Credential handling: values are available locally in `orca.env.local`; do not print, copy, commit, or restate the raw Basic values

## Worker instructions

Before live ORCA Trial work, run only non-printing checks:

```bash
test -r ./orca.env.local
git check-ignore -v ./orca.env.local
git status --short --untracked-files=all
```

Expected result:

- `test -r ./orca.env.local` exits `0`
- `git check-ignore -v ./orca.env.local` reports an ignore rule
- `git status --short --untracked-files=all` does not list `orca.env.local`

Then use the existing runners instead of copying env values:

```bash
WEB_CLIENT_MODE=npm ./setup-modernized-env.sh
```

For targeted ORCA scripts, let the script auto-load `./orca.env.local` or pass `ORCA_ENV_FILE=./orca.env.local` when the script requires an explicit env file.

## Prohibited actions

- Do not commit `orca.env.local`.
- Do not add Trial Basic raw values to tracked docs, source, tests, fixtures, manifests, review packets, summaries, or artifacts.
- Do not echo the env file or include its values in logs.
- Do not retain raw ORCA XML, HAR, traces, videos, screenshots, cookies, CSRF tokens, Authorization headers, patient names, addresses, phone numbers, or insurance details.
- Do not replace the sanitized evidence policy with a convenience shortcut.

## If the file is missing

Stop and report a local environment blocker. Do not recreate tracked credentials in source control. The acceptable local repair is to restore an ignored repo-root `orca.env.local` or set `ORCA_ENV_FILE` to an equivalent untracked local env file.
