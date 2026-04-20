# Reviewer Submission Packet

## 目的

reviewer 提出物を logs-only archive ではなく、同一 `RUN_ID` / 同一 accepted `HEAD` に固定した `review-checkout/` と `closeout-packet/` の組として生成・検証する。

## 入口

- 生成: `./scripts/create-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <BRANCH>`
- 検証: `./scripts/validate-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <BRANCH>`

既定の出力先は `artifacts/reviewer-submission-packets/`。必要なら `--output <DIR>` を付ける。

## Canonical Flow
- canonical: `docs/runbooks/reviewer-submission-packet.md` + `scripts/create-reviewer-submission-packet.sh` + `scripts/validate-reviewer-submission-packet.sh` + `tests/review-packet/`
- support: `scripts/create-review-package.sh` + `tests/review-package/` + `artifacts/review-bundles/`
- deprecated: `scripts/create-review-archive.sh`

この runbook でいう reviewer 提出物は常に `reviewer submission packet` を指す。`review package` は軽量 source bundle の補助用途としてのみ扱う。

## 必須オプション

- `--run-id`: closeout evidence の `RUN_ID`
- `--accepted-ref`: accepted source of truth とみなす branch/ref

## サポートオプション

- `--output`: packet 出力先ディレクトリ
- `--accepted-head`: accepted branch/ref が evidence freeze 後に進んだ場合に、packet を固定したい commit
- `--dry-run`: 入力検証と出力予定パスの表示だけを行い、書き込みしない
- `--validate-only`: 既に生成済み packet を再検証する

`--accepted-head` は通常不要だが、`git/accepted-branch.txt` の branch 名は固定しつつ、`git/git-head-current.txt` の accepted HEAD を明示したい場合に使う。

## 入力契約

- closeout evidence は `artifacts/orca-remediation/closeout/<RUN_ID>/` に揃っていること
- `git/run-id.txt`、`git/accepted-branch.txt`、`git/git-head-current.txt` が現在の `RUN_ID` / accepted ref / accepted HEAD と一致すること
- accepted branch/ref が既に別 commit を指している場合でも、`--accepted-head` を使って current accepted HEAD を固定できること
- `reports/final-report.md`、`reports/command-log.md`、`reports/blocker-classification.md` が存在すること
- `qa/acceptmodv2/`、`qa/fullflow/`、`evidence/patients-import/`、`evidence/medical-information-probe/`、`evidence/runtime-blockers/` の required file が欠けていないこと
- `qa/fullflow/summary.json` が send 到達を示す場合、`qa/fullflow/request-xml/medicalmodv2.xml` が存在すること
- Phase 3 handoff を示す evidence は exact selected-candidate `qa/weborca-readonly-preflight/summary.json` だけを正本とする。candidate discovery summary、local selectable のみ、HTTP 200 のみ、not-run / not-verified result、old RUN_ID evidence を handoff artifact にしない。`acceptedForPhase3Attempt` は boolean `true` でなければならない。

## Evidence Extraction / Sanitization

- packet に含める live evidence は、closeout evidence から reviewer が再読するための extracted subset に限定する。
- `qa/weborca-candidate-discovery/` は sanitized selected-candidate proposal と rejected reason / classification だけを含め、raw official patient detail を含めない。ORCA Trial 公式初期患者 `00001`〜`00011` は official initial data として存在するが、accepted candidate が 0 件の場合は current evidence では mutation-ready ではないとだけ書く。公式初期患者の不在とは書かず、`PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER` として harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria の未充足を示す。
- `qa/weborca-readonly-preflight/summary.json` は `source=qa-weborca-readonly-preflight`、`flowMode=exact-readonly-preflight`、`acceptedForPhase3Attempt`、`phase3AttemptPatientId`、artifact path/hash/input identity、sanitized readiness classification を含める。official patient existence は `/api/orca/official/patientgetv2?id=<patientId>&format=json` の parsed ORCA body 由来の `Api_Result`、`Patient_Information`、完全一致 `Patient_ID` で判定し、batch DTO は exact preflight official patient evidence として扱わない。`officialPatientExistence` / `officialPatientEvidence` は `httpStatus`、`parsedOrcaBody`、`apiResult`、`apiResultAccepted`、`patientInformationPresent`、`exactIdMatched`、`notFoundMessage`、`responseCategory`、`rejectionReason`、`evidenceHash`、`rawSensitiveFieldsExcluded=true` だけを含める。氏名、住所、電話番号、保険記号番号、credential-bearing URL、Cookie、Authorization、JSESSIONID、CSRF、raw password は含めない。
- accept / fullflow evidence は sanitized summary、redacted selected id、classification、artifact-relative path、必要な hash に限定する。HTTP 200、`apiResult=10/60`、`apiResult=00` with `Request_Number=00`、K1/K2/K3 warning message、not-run / not-verified status だけから mutation success を推定しない。`apiResult=10` は `patient_not_found` rejection、`apiResult=60` は no-existing-acceptance diagnostic、`apiResult=00` with `Request_Number=00` は existing-acceptance diagnostic である。
- `closeout-packet/` にコピーする docs / reports / evidence は packet-relative path で参照し、絶対ローカルパスや credentials を含んだ raw log を入れない。
- C7 dynamic evidence は target mutation request capture が存在する場合だけ verified とする。`targetMutationRequestCount=0` / `checkedRequests=0` の summary を accepted にしない。
- MSW/local/static tests は live ORCA fullflow success と混ぜない。

## 出力レイアウト

`submission-packet-<RUN_ID>/`

- `README_REVIEW.md`
- `manifest.json`
- `manifest.sha256`
- `review-checkout/`
  - `.git/`
  - accepted HEAD の clean checkout
- `closeout-packet/`
  - `git/`
  - `reports/`
  - `qa/`
  - `evidence/`
  - `docs/`

同じ出力先に `submission-packet-<RUN_ID>.zip` も生成する。

## 強制ルール

- `review-checkout/` の `git status --short` は空でなければならない
- `review-checkout/` には `origin/master` ref が存在しなければならない
- `review-checkout/HEAD`、`closeout-packet/git/git-head-current.txt`、`manifest.json` の HEAD はすべて一致しなければならない
- `node_modules`、`target`、`dist`、`coverage`、`artifacts`、`tmp` などの生成物は `review-checkout/` に入れない
- report / manifest / copied evidence 内に絶対ローカルパスが残っていたら fail する
- `full_source_secret_scan_claim=not_claimed` は full clean ではない。`worktree_clean=not_verified` は clean checkout truth ではない。

## 旧方式

`scripts/create-review-archive.sh` は reviewer submission packet の正本ではない。実行すると fail し、新 tool へ誘導する。
