---
name: review-log-inclusive-bundle
description: Create a reviewer package zip for OpenDolphin_WebClient using tracked source/config/docs plus browser manual QA summary files when present, excluding artifacts, the legacy client, and generated outputs.
---

# Reviewer Package Bundle

Use this skill when someone asks for a **レビュワー提出向けの軽量 zip** for this repository and wants:

- current source/config files
- current contract and code-adjacent docs
- no `artifacts/`
- no legacy Swing client sources
- no generated build outputs

## What this skill should produce

- one zip file: `artifacts/review-bundles/OpenDolphin_WebClient-review-package-<RUN_ID>.zip`
- `REVIEW_PACKAGE_MANIFEST.txt` inside the zip
- tracked repo files except excluded legacy/generated paths
- if present, also include:
  - `qa/browser-manual-qa-progress.json`
  - `qa/browser-manual-qa-report.md`
- no artifact or log re-inclusion step

## Run script

From repository root:

```bash
./scripts/create-review-package.sh
```

Optional:

- `--run-id 20260409T232604Z`
- `--out-dir ./artifacts/review-bundles`

## Exclusion policy

The script excludes the following from tracked files before bundling:

- `client/`
- `artifacts/`
- `node_modules/`, `dist/`, `target/`, `build/`, `out/`
- `tmp/`, `output/`, `coverage/`, `test-results/`
- cache directories such as `.cache/`, `.vite/`, `.parcel-cache/`, `.turbo/`, `.nyc_output/`
- `__MACOSX/`, `.DS_Store`, `Thumbs.db`

The script also appends these QA summary files when they exist in the working tree:

- `qa/browser-manual-qa-progress.json`
- `qa/browser-manual-qa-report.md`

## Expected verification

- the script prints file count, size, and sha256
- the manifest records `optional_includes` when those QA files were added
- `zipinfo -1` should not show `client/` or `artifacts/`
- generated directories such as `node_modules/`, `dist/`, `target/`, `build/` must be absent

## Failure handling

- if `zip` or `zipinfo` is missing, fail immediately
- if no tracked files remain after exclusions, fail
- if excluded paths appear in the archive, fail
