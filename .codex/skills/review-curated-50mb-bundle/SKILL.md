---
name: review-curated-50mb-bundle
description: Create a sub-50MB review zip for OpenDolphin_WebClient that supports code review of both server-modernized and web-client by keeping current docs, implementation source, tests, workflows, and selected doc-reorg reports/logs while excluding legacy trees and generated outputs.
---

# Curated Review Bundle

Use this skill when someone asks for a **50MB 以内のレビュー用 zip** that should preserve:

- current implementation source
- server-modernized / web-client のコードレビュー入口
- current / workflow / reference docs
- ops / tests / scripts / GitHub workflow context
- small review evidence from `artifacts/doc-reorg/`

Use the existing reviewer submission packet flow instead when the user needs a canonical accepted-HEAD packet with `review-checkout/` and full closeout evidence.

## Run script

From repository root:

```bash
./scripts/create-review-package-curated.sh
```

Common options:

- `--run-id 20260415T010203Z`
- `--out-dir ./artifacts/review-bundles`
- `--size-limit-mb 50`
- `--include-archive-docs`

## Default content model

- include:
  - `README.md`, `AGENTS.md`, root build and setup entry files
  - `.github/workflows/`
  - `.codex/skills/`
  - `docs/`, except `docs/archive/` by default
  - `web-client/`, `server-modernized/`, `domain/`, `api-contract/`, `persistence/`, `reporting/`
  - `ops/`, `tests/`, `scripts/`
  - text-based review evidence under `artifacts/doc-reorg/`
- exclude:
  - `client/`, `server/`, `ext_lib/`, `docker/orca/jma-receipt-docker/`
  - generated outputs and caches
  - nested zip artifacts
  - large review-irrelevant binary assets such as `ops/assets/fonts/NotoSansCJKjp-Regular.otf`
  - `docs/archive/` unless explicitly requested
- always include reviewer-requested exceptions:
  - `docs/archive/README.md`
  - `docs/archive/orca-order-alignment/README.md`
  - `artifacts/README.md`
  - `docs/reference/repository-history/minagawa署名git履歴調査_20260310.md`
  - `docs/reference/repository-history/LICENSE_git履歴調査_20260310.md`
  - `docs/reference/repository-history/ライセンス_コード著者アカウント同一性時系列調査_20260313.md`
  - `docs/reference/repository-history/OpenDolphin-Lab-A4.pdf`

## Required checks

- package size must stay at or below the configured limit
- `zipinfo -1` must include:
  - `docs/README.md`
  - `docs/architecture/server-modernization-overview.md`
  - `docs/archive/README.md`
  - `docs/archive/orca-order-alignment/README.md`
  - `docs/runbooks/reviewer-submission-packet.md`
  - `artifacts/README.md`
  - `web-client/README.md`
  - `web-client/notes/ui-current-contract.md`
  - `docs/reference/repository-history/minagawa署名git履歴調査_20260310.md`
  - `docs/reference/repository-history/LICENSE_git履歴調査_20260310.md`
  - `docs/reference/repository-history/ライセンス_コード著者アカウント同一性時系列調査_20260313.md`
  - `docs/reference/repository-history/OpenDolphin-Lab-A4.pdf`
  - `.github/workflows/web-client-test-shards.yml`
  - `.github/workflows/server-modernized-static-analysis-gate.yml`
  - latest `artifacts/doc-reorg/*/final-report.md` if present
  - latest `artifacts/doc-reorg/*-addendum/addendum-report.md` if present
- `zipinfo -1` must not show:
  - `client/`, `server/`, `ext_lib/`, `docker/orca/jma-receipt-docker/`
  - `node_modules/`, `dist/`, `target/`, `artifacts/review-bundles/`
  - nested `.zip`

## Failure handling

- if the size cap is exceeded, inspect the script's largest-file list before widening scope
- prefer `--include-archive-docs` only when the reviewer explicitly needs dated packet history
- do not re-include `artifacts/review-bundles/*.zip` or reviewer packet zips inside the bundle
- treat this bundle as a code review pack for `server-modernized/` and `web-client/`, not as an accepted-HEAD evidence packet
