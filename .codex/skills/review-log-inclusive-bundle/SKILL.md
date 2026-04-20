---
name: review-log-inclusive-bundle
description: Create a reviewer package zip for OpenDolphin_WebClient using tracked source/config/docs plus browser manual QA summary files when present, and include current review-relevant worktree edits when this thread has recent local changes, excluding artifacts, the legacy client, and generated outputs.
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
- when the current thread has recent review-relevant edits in the worktree, include those edits as well even if they are not yet tracked by git
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

If the current thread has recent local edits that must be reviewed and they are not fully covered by `git ls-files`:

1. run `./scripts/create-review-package.sh` first to create the base package
2. inspect `git status --short` and identify review-relevant edited or untracked files from the current task
3. update the zip to add those files explicitly
4. add a small manifest such as `CURRENT_WORKTREE_ADDITIONS_MANIFEST.txt` that records which current-worktree files were appended and why

Do not add unrelated local junk, generated outputs, caches, or personal scratch files just because they are untracked.

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

When recent current-thread edits exist, you may append review-relevant worktree files after the script completes, including untracked test helpers or QA support files, as long as they are source/doc/config assets and still respect the exclusion policy.

## Expected verification

- the script prints file count, size, and sha256
- the manifest records `optional_includes` when those QA files were added
- if current worktree files were appended after packaging, the zip must also contain a manifest entry or companion manifest describing those appended files
- `zipinfo -1` should not show `client/` or `artifacts/`
- generated directories such as `node_modules/`, `dist/`, `target/`, `build/` must be absent

## Failure handling

- if `zip` or `zipinfo` is missing, fail immediately
- if no tracked files remain after exclusions, fail
- if excluded paths appear in the archive, fail
- generated reviewer ZIPs and sidecar package artifacts are external handoff artifacts. Do not `git add` or commit them; commit only source, docs, scripts, or skill changes needed to produce or validate the package.
