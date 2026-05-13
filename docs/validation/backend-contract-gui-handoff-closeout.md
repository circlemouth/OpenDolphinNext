# Backend / Contract GUI Handoff Closeout

RUN_ID: `20260513T225000Z`

この closeout は GUI 改修工程へ渡すための backend / contract / ops 棚卸しであり、release-ready 判定ではない。GUI 全面改修、UI 網羅テスト、live ORCA operator approval、full gate、reviewer packet 生成が未完了のため、この文書を `GO` 判定または本番投入承認として扱ってはならない。

## Scope

対象は current repo の docs / contract / runbook / focused guard entrypoint である。

- backend / contract / ops 正本: `docs/contracts/`, `docs/architecture/`, `docs/operations/`, `docs/runbooks/`
- test gate 正本: `docs/testing/ehr-orca-required-test-matrix.md`, `docs/runbooks/release-validation.md`, `docs/validation/release-validation-report.md`
- focused verification entrypoints: route inventory, public route guard, bundle secret scan, ORCA ledger / UNKNOWN / snapshot / disease / prescription / export / backup guards

`client/` と `server/` は legacy reference として扱い、この closeout では変更しない。

## Safety Preflight

| Item | Closeout judgment |
| --- | --- |
| 触る正本境界 | OpenDolphinNext 正本の診療録・処方 authority、ORCA / WebORCA 正本の cache / snapshot / candidate / audit / ledger 境界、release validation gate |
| ORCA / WebORCA 正本 | 患者、受付、保険、病名、診療行為、会計、収納、領収、帳票、レセプトは ORCA / WebORCA 正本として維持する |
| OpenDolphinNext 正本 | 診療録本文、SOAP、処方指示、chart / prescription event、audit は OpenDolphinNext 正本として維持する |
| cache / snapshot / candidate / audit log | ORCA 由来情報は表示 cache、診療時点 snapshot、送信候補、operation ledger、audit summary としてのみ保持する |
| 信頼境界 | client-provided `facilityId`, `ownerId`, `role`, `uri`, `digest`, `objectKey`, voucher, sequential, insurance, `Medical_Uid`, raw XML は authority にしない |
| 攻撃面 | taxonomy 外 route 再混入、UNKNOWN 成功扱い、二重送信、secret/PHI/raw ORCA body の evidence 混入、GUI 改修前の release-ready 誤判定 |

Misuse cases:

- GUI 改修前の closeout を release-ready `GO` と誤記する。
- UNKNOWN、ORCA warning、unmatch、reconciliation pending/block を final gate から漏らし、成功扱いにする。
- export、validation report、reviewer packet、bundle scan evidence に ORCA credential、raw ORCA body、実在患者情報、HAR/trace/video/screenshot を残す。
- client-provided facility / patient / voucher / storage key / digest を server authority として採用する。

## Classification

| Priority | Area | Status | Evidence / handoff note |
| --- | --- | --- | --- |
| P0-A | 旧 `karte/document` write route 廃止 / chart authority | backend / contract 完了として扱う | `docs/contracts/chart-authority-api.md`, `docs/architecture/ehr-chart-prescription-authority.md`, `PublicRouteInventoryContractTest`, `check-finalized-write-guards.sh` が final gate に接続済み |
| P0-B | chart finalize ORCA snapshot | backend / contract 完了として扱う | `docs/contracts/chart-finalize-snapshot.md` と `ChartFinalizeSnapshotResolverTest`, `KarteRevisionSnapshotContractTest`, `KarteDocumentSnapshotContractTest` が final gate に接続済み |
| P0-C | patient facility boundary | backend / contract 完了として扱う | `docs/contracts/orca-route-taxonomy.md` の patientmodv2 route contract と `PatientModV2OutpatientResourceIdempotencyTest` が focused gate に接続済み |
| P0-D | prescription authority / hash chain | backend / contract 完了として扱う | `docs/contracts/prescription-authority.md`, `docs/contracts/prescription-authority-api.md`, `PrescriptionAuthorityResourceTest`, `PrescriptionAuthoritySchemaTest` が final gate に接続済み |
| P1-E | ORCA operation ledger | backend / contract 完了として扱う | `docs/contracts/orca-ledger-and-unknown-state.md`, `OrcaOperationLedgerSchemaTest`, `OrcaOperationLedgerRepositoryTest` が final gate に接続済み |
| P1-F | UNKNOWN / retry / duplicate prevention | backend / contract 完了として扱う | `docs/operations/orca-unknown-state-runbook.md`, `docs/runbooks/orca-unknown-resolution.md`, `OrcaHttpClientResilienceTest`, `PatientModV2OutpatientResourceIdempotencyTest`, `OrcaBillingCorrectionScenarioSupportTest` が final gate に接続済み |
| P1-G | disease boundary | backend / contract 完了として扱う | `docs/contracts/disease-boundary.md`, `check-no-legacy-disease-authority.sh`, `OrcaDiseaseOperationStoreTest`, `OrcaDiseaseCacheStoreTest`, `OrcaDiseaseQuerySupportTest` が final gate に接続済み |
| P1-H | DADS medical safety UI | GUI 改修へ移管 | backend contract は status / warning / UNKNOWN DTO 境界を固定済み。患者取り違え防止 UI、重大操作モーダル、placeholder / disabled / focus / contrast の実装・網羅テストは GUI 工程の blocker |
| P2-I | readability / export | backend / contract 完了、GUI 表示は移管 | `docs/contracts/export-readability.md`, `docs/contracts/protected-export-authorization-matrix.md`, `OrcaReportDocumentResourceTest`, print/export Vitest hook が final gate に接続済み。GUI の見読性確認は GUI 工程で実施 |
| P2-J | accounting cache boundary | backend / contract 完了、GUI 表示は移管 | `docs/contracts/accounting-cache-boundary.md`, `OrcaReportDocumentResourceTest`, `OperationsHealthResourceTest` が final gate に接続済み。会計表示の source/fetchedAt/受付 ID 常時表示は GUI 工程で確認 |
| P2-K | backup / restore / outage runbook | ops contract 完了 | `docs/runbooks/backup-restore.md`, `docs/runbooks/backup-restore-hash-verification.md`, `docs/runbooks/orca-outage.md`, `docs/runbooks/orca-outage-recovery.md`, `check-backup-restore-runbook.sh`, `check-production-operations-runbook.sh` が final gate に接続済み |
| P3-L | live ORCA validation | release-ready 前の未完了 gate | `docs/validation/orca-live-validation.md`, `ops/tests/orca/live-trial-checklist.sh --dry-run --run-id <RUN_ID>`, operator approval、sanitized evidence が必要。GUI 改修前には実施済み扱いにしない |

## Current Docs Consistency

| Boundary | Current docs | Closeout result |
| --- | --- | --- |
| ORCA source-of-truth | `docs/architecture/ehr-orca-source-of-truth-boundary.md`, `docs/contracts/orca-route-taxonomy.md` | ORCA 正本情報は local authority ではなく cache / snapshot / candidate / ledger として整理済み |
| Chart authority / snapshot | `docs/architecture/ehr-chart-prescription-authority.md`, `docs/contracts/chart-authority-api.md`, `docs/contracts/chart-finalize-snapshot.md` | FINAL 以降の直接更新禁止、snapshot v2、不完全 snapshot の fail-closed が整合 |
| Prescription authority | `docs/contracts/prescription-authority.md`, `docs/contracts/prescription-authority-api.md` | `/api/local/prescription-orders/authority*` に taxonomy 内配置し、旧 `/api/prescriptions` は public route として禁止 |
| Facility boundary | `docs/contracts/orca-route-taxonomy.md` | patientmodv2 は server-side request context で facility 解決し、`X-Facility-Id` fallback を authority にしない |
| Disease boundary | `docs/contracts/disease-boundary.md`, `docs/architecture/ehr-orca-source-of-truth-boundary.md` | ORCA disease は diseasegetv2 / diseasev3 正本、local は candidate / draftCandidate として分離 |
| ORCA ledger / UNKNOWN | `docs/contracts/orca-ledger-and-unknown-state.md`, `docs/operations/orca-unknown-state-runbook.md`, `docs/runbooks/orca-unknown-resolution.md` | UNKNOWN / warning / unmatch / reconciliation pending は success に変換しない。再送は server-side snapshot と照合後に限定 |
| Export / accounting cache | `docs/contracts/export-readability.md`, `docs/contracts/accounting-cache-boundary.md`, `docs/contracts/protected-export-authorization-matrix.md` | export / validation evidence は sanitized summary、hash、count、status に限定し、raw ORCA body / secret / PHI を含めない |
| Backup / restore | `docs/runbooks/backup-restore.md`, `docs/runbooks/backup-restore-hash-verification.md`, `docs/runbooks/production-operations-readiness.md` | restore 後は ORCA-derived local rows を正本化せず、hash verification と read-only解除前 gate を要求 |

## Verification Entry Points

今回の closeout で確認対象とする current repo の入口:

```bash
bash server-modernized/tools/ci/check-doc-links.sh
bash scripts/ci/verify-release-validation-entrypoints.sh --dry-run
bash scripts/ci/verify-ehr-orca-round3-guards.sh
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest test
cd web-client && npm run build
cd web-client && npm run verify:prod-bundle-secrets
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaOperationLedgerSchemaTest,OrcaHttpClientResilienceTest,PatientModV2OutpatientResourceIdempotencyTest,OrcaBillingCorrectionScenarioSupportTest test
```

`npm run build` は `verify:prod-bundle-secrets` を内包している。`verify-ehr-orca-round3-guards.sh` は `web-client/dist` が存在しない場合、bundle secret scan を skip して明示メッセージを出すため、GUI 改修後の final gate では `npm run build` または `npm run ci` 後に bundle scan を必ず実行する。

## Executed Verification

RUN_ID `20260513T225000Z` で実行した closeout verification:

| Command | Result | Note |
| --- | --- | --- |
| `bash server-modernized/tools/ci/check-doc-links.sh` | PASS | output なしで終了 |
| `bash scripts/ci/verify-release-validation-entrypoints.sh --dry-run` | PASS | final gate command order と required entrypoint を確認 |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest test` | PASS | 5 tests, 0 failures, 0 errors |
| `npm ci` | PASS | `node_modules` が無い worktree で依存復元。audit は 0 vulnerabilities |
| `cd web-client && npm run build` | PASS | `verify:web-guard`、Vite build、`verify:prod-bundle-secrets`、artifact pruning まで成功 |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=OrcaOperationLedgerSchemaTest,OrcaHttpClientResilienceTest,PatientModV2OutpatientResourceIdempotencyTest,OrcaBillingCorrectionScenarioSupportTest test` | PASS | 27 tests, 0 failures, 0 errors |
| `bash scripts/ci/verify-ehr-orca-round3-guards.sh` | PASS | route inventory、web guard、既存 `dist` の production bundle secret scan が成功 |

未実行 verification:

| Command / gate | Not run reason | Residual risk |
| --- | --- | --- |
| `cd web-client && npm run ci` | GUI 改修前 closeout のため full web CI は対象外。`npm run build` と guard / bundle scan を focused verification として実行 | GUI 改修後 final gate で必須 |
| `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` | 重い full verify は今回の対象外。route inventory と ORCA ledger / UNKNOWN focused Maven を実行 | GUI 改修後 final gate で必須 |
| `cd web-client && node scripts/runtime-ready-smoke.mjs` | GUI 改修前 closeout であり runtime / live readiness 判定は対象外 | GUI 改修後、release validation RUN_ID で必須 |
| `ops/tests/orca/live-trial-checklist.sh --dry-run --run-id <RUN_ID>` | live ORCA validation は operator approval / secret config sign-off 後の final gate | release-ready 前に必須 |
| reviewer packet create / validate | release-ready package 作成工程ではない | release-ready 前に必須 |

## GUI Handoff Items

GUI 改修へ移管する項目:

- 患者ヘッダーの常時表示、重大操作モーダルでの患者番号・氏名・生年月日・性別・年齢・受付日・診療科・担当医・保険組合せの再掲。
- ORCA warning / error / unmatch / ORCA-only / UNKNOWN / send failure を初期表示で隠さない UI。
- placeholder 依存、disabled 理由未表示、details / accordion への重要情報退避、曖昧な「失敗しました」通知の是正。
- 診療録確定、処方確定、診察終了、ORCA送信、会計送信の confirm flow 統一。
- 会計 / 帳票 / export 表示で ORCA 由来、取得日時、受付 ID、診療日、診療科、保険組合せ、snapshot / cache / ledger 境界を表示すること。
- GUI 改修後に `verify:medical-safety-ui-copy`、targeted Vitest、browser 目視確認、full gate を再実行すること。

## Release-Ready Hold

この closeout では release-ready を保留する。理由:

- GUI 医療安全改修と UI 網羅テストが未完了。
- live ORCA validation は operator approval、secret/config sign-off、sanitized evidence mode、exact preflight が揃ってから実行する必要がある。
- full gate (`web-client npm run ci`, `mvn ... -Pstatic-analysis verify`, `runtime-ready-smoke`, reviewer packet create/validate) は GUI 改修後の final gate で実行する必要がある。
- production secrets / config / branch protection など repo-external sign-off はこの closeout の対象外。

## Critical / High Residual Risk

この closeout 時点で backend / contract / ops 文書上の未整理 Critical / High リスクは見つけていない。

ただし、次は GUI 改修前または release-ready 前の blocker として残す。

| Risk | Severity | Owner / next action |
| --- | --- | --- |
| GUI が UNKNOWN / warning / unmatch を隠す、または成功表示へ丸める | High | GUI 改修で DADS / medical safety UI を実装し、targeted tests と `verify:medical-safety-ui-copy` を通す |
| GUI 改修前の closeout を release-ready `GO` と誤読する | High | `docs/runbooks/release-validation.md`, `docs/testing/ehr-orca-required-test-matrix.md`, この closeout で `release-ready ではない` と明記 |
| live ORCA evidence に secret / PHI / raw ORCA body が混入する | High | live checklist dry-run、sensitive evidence redaction、reviewer packet validation を final gate で必須実行 |

## Final Handoff Decision

Backend / contract / ops の GUI handoff 土台は整っている。GUI 改修へ進めてよい。

この判断は release-ready `GO` ではない。GUI 改修後、`docs/runbooks/release-validation.md` の final gate と `docs/validation/release-validation-report.md` の RUN_ID 別 report を使って、PENDING / NO-GO / GO を改めて記録する。
