---
name: package-modernized-source-zip-windows
description: Create the reviewer package zip for OpenDolphin_WebClient using tracked source/config/docs only, excluding legacy client sources and generated outputs.
---

# Reviewer Package Bundle

Use this skill when you need a **軽量な外部レビュー用 zip** for this repository.

## What this skill produces

- one zip file: `artifacts/review-bundles/OpenDolphin_WebClient-review-package-<RUN_ID>.zip`
- `REVIEW_PACKAGE_MANIFEST.txt` inside the zip
- tracked repo files only, with legacy and generated paths excluded

## Run script

From the repository root, run:

```bash
./scripts/create-review-package.sh
```

Optional:

- `--run-id 20260414T080812Z`
- `--out-dir ./artifacts/review-bundles`

## Exclusion policy

The packaging script excludes tracked files under:

- `client/`
- `artifacts/`
- `web-client/artifacts/`
- `node_modules/`, `dist/`, `target/`, `build/`, `out/`
- `tmp/`, `output/`, `coverage/`, `test-results/`
- cache directories such as `.cache/`, `.vite/`, `.parcel-cache/`, `.turbo/`, `.nyc_output/`
- `.DS_Store`, `Thumbs.db`, `*.log`, `*.tsbuildinfo`

## Verification

- the script prints file count, size, and sha256
- `zipinfo -1` must not show `client/`, `artifacts/`, or generated directories
- the package must fail if no tracked files remain after exclusions

## Notes

- This skill is the repository-local counterpart to the reviewer package workflow.
- Keep the bundle source-only and review-oriented; do not include build outputs, caches, or legacy client sources.
