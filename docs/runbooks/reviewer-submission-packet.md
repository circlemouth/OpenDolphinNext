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
`--dry-run` は `packetDir` / `zipPath` に加えて `requiredCloseoutFiles` / `requiredPacketFiles` を JSON で出力する。operator result flow を含む current closeout では `qa/billing-report-live-result/result.sanitized.json` が `requiredCloseoutFiles` に含まれていなければならない。dry-run は出力先へ書き込まず、欠落した required file、HEAD 不一致、sanitized evidence contract 違反を packet 生成前に fail させる。

## 入力契約

- closeout evidence は `artifacts/orca-remediation/closeout/<RUN_ID>/` に揃っていること
- `git/run-id.txt`、`git/accepted-branch.txt`、`git/git-head-current.txt` が現在の `RUN_ID` / accepted ref / accepted HEAD と一致すること
- accepted branch/ref が既に別 commit を指している場合でも、`--accepted-head` を使って current accepted HEAD を固定できること
- `reports/final-report.md`、`reports/command-log.md`、`reports/blocker-classification.md` が存在すること
- `qa/acceptmodv2/accept-summary.sanitized.json`、`qa/fullflow/summary.json`、`qa/billing-report-live-profile/summary.sanitized.json`、`qa/billing-report-live-result/result.sanitized.json`、`evidence/patients-import/import-summary.json`、`evidence/medical-information-probe/probe-summary.json`、`evidence/runtime-blockers/*.json` などの allowlist 済み sanitized subset が欠けていないこと
- packet tool は closeout evidence 全体を丸ごと複製せず、allowlist 済み sanitized subset だけを `closeout-packet/` へコピーすること
- Phase 3 handoff を示す evidence は exact selected-candidate `qa/weborca-readonly-preflight/summary.json` だけを正本とする。candidate discovery summary、local selectable のみ、HTTP 200 のみ、not-run / not-verified result、old RUN_ID evidence を handoff artifact にしない。`acceptedForPhase3Attempt` は boolean `true` でなければならない。

## Evidence Extraction / Sanitization

- packet に含める live evidence は、closeout evidence から reviewer が再読するための extracted subset に限定する。
- `qa/weborca-candidate-discovery/` は sanitized selected-candidate proposal と rejected reason / classification だけを含め、raw official patient detail を含めない。ORCA Trial 公式初期患者 `00001`〜`00011` は official initial data として存在するが、accepted candidate が 0 件の場合は current evidence では mutation-ready ではないとだけ書く。公式初期患者の不在とは書かず、`PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER` として harness / endpoint / auth / parser / insurance / appointment / selector / local selectable / exact preflight criteria の未充足を示す。
- `qa/weborca-readonly-preflight/summary.json` は `source=qa-weborca-readonly-preflight`、`flowMode=exact-readonly-preflight`、`acceptedForPhase3Attempt`、`phase3AttemptPatientId`、artifact path/hash/input identity、sanitized readiness classification を含める。official patient existence は `/api/orca/official/patientgetv2?id=<patientId>&format=json` の parsed ORCA body 由来の `Api_Result`、`Patient_Information`、完全一致 `Patient_ID` で判定し、batch DTO は exact preflight official patient evidence として扱わない。`officialPatientExistence` / `officialPatientEvidence` は `httpStatus`、`parsedOrcaBody`、`apiResult`、`apiResultAccepted`、`patientInformationPresent`、`exactIdMatched`、`notFoundMessage`、`responseCategory`、`rejectionReason`、`evidenceHash`、`rawSensitiveFieldsExcluded=true` だけを含める。氏名、住所、電話番号、保険記号番号、credential-bearing URL、Cookie、Authorization、JSESSIONID、CSRF、raw password は含めない。
- accept / fullflow evidence は sanitized summary、redacted selected id、classification、artifact-relative path、必要な hash に限定する。HTTP 200、`apiResult=10/60`、`apiResult=00` with `Request_Number=00`、K1/K2/K3 warning message、not-run / not-verified status だけから mutation success を推定しない。`apiResult=10` は `patient_not_found` rejection、`apiResult=60` は no-existing-acceptance diagnostic、`apiResult=00` with `Request_Number=00` は existing-acceptance diagnostic である。
- billing/report live profile evidence は `qa/billing-report-live-profile/summary.sanitized.json` だけを packet へ含める。これは dry-run gate / sanitized readiness summary であり、live ORCA 実行済み、会計済み、収納済み、レセプト正本化の証跡ではない。packet validation は `dryRun=true`、`liveTrialOrca.executed=false`、`rawSensitiveFieldsExcluded=true`、server-generated storage key/digest boundary を要求し、raw patient key、raw invoice / `Data_Id` / `Medical_Uid`、request XML、HAR、raw network、credential 参照を拒否する。
- billing/report live result evidence は `qa/billing-report-live-result/result.sanitized.json` だけを packet へ含める。これは operator が live Trial 実行後に作る sanitized result record であり、`source_system=ORCA`、request/response hash、row count、invoice/data id hash、server-generated storage key/digest presence、`storageUploadStatus`、`reportBinaryAvailable` だけを accepted evidence にする。packet validation は ready handoff summary hash、`rawSensitiveFieldsExcluded=true`、`liveTrialOrca.executed=true`、`acceptedAsBillingReportEvidence=true`、upload failure / expired / blocker なしを要求し、会計済み・収納済み・帳票本文正本化の証跡として扱わない。
- billing/report operator input は `cd web-client && node scripts/qa-orca-billing-report-live-result.mjs --print-operator-result-template` の no-write JSON template を元に作る。template の dummy hash を server-derived hash へ置き換えるだけに留め、raw ORCA body、帳票本文、raw patient / invoice / `Data_Id` / `Medical_Uid`、storage key/digest、credential、HAR、trace、video、screenshot、raw network は operator input に追加しない。
- RWO-08B RUN_ID `20260430T020641Z` の Trial diagnostic Fullflow completion を reviewer packet へ参照する場合は、`docs/implementation/rwo08b-fullflow-complete-20260430T020641Z/summary.sanitized.json` と `FINAL_REPORT.md` の sanitized subset のみを使う。`artifacts/diagnostic-fullflow/20260430T020641Z/` 配下の screenshot / HAR / trace / video / raw network / request XML / raw body は local-only diagnostic artifact であり、同梱・転記・成功判定材料にしない。
- accept / fullflow / billing-report-live-profile / billing-report-live-result / report / probe summary が `raw-*.xml`、`raw-*.json`、`raw-*.txt`、`server-stacktrace.log`、`har/`、`*.har`、`trace*.zip`、`*.webm`、`*.mp4`、`*.png`、`*.jpg`、`*.jpeg`、`error-context.md`、`request-xml/medicalmodv2.xml`、`network/network.json`、`network/requests.json` を参照していたら packet validate は fail する。
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
- copied report / QA / evidence に raw XML、stacktrace、HAR、request XML、raw network dump 参照が残っていたら fail する
- `full_source_secret_scan_claim=not_claimed` は full clean ではない。`worktree_clean=not_verified` は clean checkout truth ではない。

## 旧方式

`scripts/create-review-archive.sh` は reviewer submission packet の正本ではない。実行すると fail し、新 tool へ誘導する。
