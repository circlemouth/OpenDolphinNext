---
name: review-log-inclusive-bundle
description: Create a comprehensive review zip for OpenDolphin_WebClient that excludes historical development docs and generated outputs while keeping review-relevant logs.
---

# Review Log Inclusive Bundle

Use this skill when someone asks for a **網羅的レビュー向け zip** for this repository and wants:

- current source/config files
- current contract and code-adjacent docs
- review-relevant logs
- no historical development docs
- no generated build outputs

## What this skill should produce

- one zip file: `artifacts/review-bundles/OpenDolphin_WebClient-review-<RUN_ID>.zip`
- `REVIEW_BUNDLE_MANIFEST.txt` inside the zip
- tracked repo files except excluded historical docs and generated outputs
- log files from `artifacts/`, `tmp/`, `.playwright-cli/` when their full path matches `*.log` or `*log*.txt`

## Run script

From repository root:

```bash
./scripts/create-review-archive.sh
```

Optional:

- `--run-id 20260409T232604Z`
- `--out-dir ./artifacts/review-bundles`

## Exclusion policy

The script excludes the following from tracked files before bundling:

- `docs/working-notes/`
- `docs/implementation/`
- `docs/managerdocs/`
- `docs/web-client/product-improvement/`
- `managerdocs_seed_bundle/`
- `node_modules/`, `dist/`, `target/`, `coverage/`, `test-results/`
- `artifacts/`, `tmp/`, `.playwright-cli/` as general content
- `__MACOSX/`, `.DS_Store`, `Thumbs.db`

Logs are then added back only from the curated log roots.

## Expected verification

- the script prints file count, log count, size, and sha256
- `zipinfo -1` should not show excluded historical doc paths
- `zipinfo -1` under `artifacts/`, `tmp/`, `.playwright-cli/` should contain only log-like filenames

## Failure handling

- if `zip` or `zipinfo` is missing, fail immediately
- if forbidden historical docs or generated outputs appear in the archive, fail
- if non-log entries from `artifacts/`, `tmp/`, `.playwright-cli/` appear in the archive, fail
