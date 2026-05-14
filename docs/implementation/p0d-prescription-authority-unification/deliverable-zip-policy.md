# P0-D Deliverable ZIP Policy

RUN_ID: `20260514T202715Z`

## Goal

P0-D reviewer deliverable ZIP には、処方 authority route 一本化と hash chain 検証に必要な source / docs / tests / reports だけを含める。生成物、秘密情報、raw ORCA/患者情報、古い review ZIP の入れ子を持ち込まない。

## Include

- `web-client/` の tracked source と targeted tests
- `server-modernized/` の tracked source、focused tests、CI guards、Flyway migration
- `docs/contracts/`、`docs/architecture/`、`docs/testing/`、`docs/runbooks/` の current source of truth
- `docs/implementation/p0d-prescription-authority-unification/` の README、inventory、checklist、report
- 必要なら sibling module の tracked source:
  - `domain/`
  - `api-contract/`
  - `persistence/`
  - `reporting/`

## Exclude

- `client/`, `server/` legacy trees
- `node_modules/`, `target/`, `dist/`, `build/`, `coverage/`, `test-results/`, `tmp/`, `.cache/`
- `.git/`, IDE settings, `.DS_Store`, `Thumbs.db`, `__MACOSX`
- nested `.zip`
- old review package ZIP / reviewer submission packet ZIP
- HAR, trace, video, screenshot, raw network JSON, raw request/response dump
- raw ORCA body/XML, ORCA credential, certificate, certificate password, Basic auth, Cookie, JSESSIONID, CSRF
- raw patient detail, raw insurance detail, raw report body, storage key, digest, absolute local path

## Required Validation

```bash
bash server-modernized/tools/ci/check-doc-links.sh
bash server-modernized/tools/ci/check-config-contract.sh
bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root "$(git rev-parse --show-toplevel)"
zipinfo -1 <deliverable.zip> | rg '(^|/)(client|server|node_modules|target|dist|build|coverage|test-results|tmp|\\.git)(/|$)|\\.zip$|\\.har$|trace|video|screenshot|__MACOSX|\\.DS_Store|Thumbs\\.db'
```

`zipinfo` / `rg` の forbidden-path scan は 0 hit でなければならない。

## Deliverable Notes

- reviewer が読む current contract は `docs/contracts/`、`docs/architecture/`、`docs/testing/`、`docs/runbooks/` を優先する。
- `docs/implementation/p0d-prescription-authority-unification/` は closeout / inventory / checklist 用であり、current contract の正本を置き換えない。
- この ZIP は source review と focused validation 証跡のためのもので、live ORCA success evidence や raw diagnostic artifact の搬送手段ではない。
