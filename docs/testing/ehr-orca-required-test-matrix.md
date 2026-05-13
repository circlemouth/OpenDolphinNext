# EHR / ORCA Required Test Matrix

## GUI Handoff Closeout Boundary

RUN_ID `20260513T225000Z` の backend / contract / ops closeout は、GUI 改修へ渡すための gate 整理であり、release-ready 判定ではない。詳細は [../validation/backend-contract-gui-handoff-closeout.md](../validation/backend-contract-gui-handoff-closeout.md) を参照する。

GUI 改修前 closeout の判定:

- backend / contract / ops の P0/P1/P2 領域は current docs と focused gate entrypoint に接続済みとして扱う。
- P1-H の DADS 医療安全 UI は GUI 改修へ移管する。患者取り違え防止 UI、重大操作モーダル、placeholder / disabled / focus / contrast は GUI 改修後に検証する。
- P3-L の live ORCA validation、operator approval、repo-external secret/config sign-off、full gate、reviewer packet validation は release-ready 前の未完了 gate として残す。
- GUI 改修前に `GO` と書かない。report 判定は原則 `PENDING` とし、security / medical safety / secret / PHI / source-of-truth / UNKNOWN / audit / idempotency の失敗があれば `NO-GO` とする。

GUI 改修前 closeout の追加 misuse case:

- GUI 改修前なのに release-ready `GO` と誤記する。
- UNKNOWN / ORCA失敗 / warning / unmatch / reconciliation pending を成功扱いしない検証が final gate から漏れる。
- export / PDF / CSV / JSON / validation evidence / reviewer packet に secret、実在患者情報、ORCA認証情報、raw ORCA body、HAR、trace、video、screenshot が残る。

## 1. 正本境界

- ORCA正本領域のlocal CRUDが存在しないこと
- local患者作成・更新APIが本番到達不能であること
- local病名作成・更新・削除APIが本番到達不能であること
- ORCA送信失敗時にlocalで反映済み扱いしないこと
- cache更新がORCA正本更新として扱われないこと
- snapshotが過去診療録で上書きされないこと

## 2. 患者・受付・保険

- ORCA患者取得
- ORCA患者作成
- ORCA患者更新
- ORCA患者不在
- ORCA受付取得
- ORCA受付取消
- ORCA保険情報取得
- 保険変更後に過去snapshotが上書きされないこと
- facilityId header偽装で患者更新できないこと

## 3. 病名

- ORCA病名取得
- ORCA病名追加
- ORCA病名変更
- ORCA病名削除
- ORCA病名転帰更新
- ORCA病名警告
- ORCA病名不一致
- ORCAにのみ存在する病名
- diseasev3 response重要フィールド保存
- ORCA送信失敗時に登録済み扱いしないこと

## 4. 診療録

- 下書き
- 確定
- 訂正
- 追記
- 取消
- 無効化
- 確定済み診療録の直接上書き禁止
- 確定済み診療録タイトルの直接更新禁止
- 代行入力者と医師確定者の区別
- 診療録確定時snapshot
- 診療録確定時 snapshot が患者・受付・保険・病名・処方指示・medical candidate・ORCA operation metadata を含むこと
- `patientSnapshotStatus=IDENTIFIER_ONLY` と `PENDING_WORKER_INTEGRATION` が本番 snapshot / export に出ないこと
- ORCA snapshot 欠落時に `chart_revision_snapshot_incomplete` で確定を拒否すること
- ORCA 取得不能を `NO_ACCEPTANCE_REASON` として成功扱いしないこと
- PDF
- 印刷
- 患者単位export
- 診療日単位export
- 期間export

## 5. 処方

- 処方指示作成
- 処方指示確定
- 処方変更
- 処方中止
- 処方取消
- 処方再発行
- 確定済み処方指示の直接上書き禁止
- ORCA送信成功
- ORCA送信失敗
- ORCA送信失敗時に反映済み扱いしないこと
- 二重送信防止
- 同一 idempotency key の再試行で `orca_operation` が1件に保たれ、`orca_transmission` だけが追加されること
- 再送
- 取消
- 差分照合
- 処方event hash chain

## 6. 診療行為・会計

- ORCA診療行為送信
- ORCA会計結果取得
- ORCA会計済み情報を未送信候補で上書きしないこと
- UNKNOWN状態の扱い
- `NETWORK_FAILED`、`AUTH_FAILED`、`CERT_FAILED`、`BUSINESS_ERROR`、`WARNING_NEEDS_REVIEW`、`UNMATCHED`、`UNKNOWN` の分類保存
- `reconciliation_status=PENDING|BLOCKED|UNKNOWN|NEEDS_REVIEW|CONFLICT|UNMATCHED` を成功扱いしないこと
- 他端末使用中
- 通信断
- 証明書異常
- 認証失敗

## 7. 監査ログ

- 診療録確定監査
- 訂正・追記・取消監査
- 処方確定・変更・中止・取消監査
- ORCA送信監査
- ORCA送信失敗監査
- ORCA再送監査
- ORCA警告・不一致の監査保存
- ORCA operation ledger と central audit trace id の相互参照
- request/response hash が保存され、raw ORCA body / credential / ORCA URL が保存されないこと
- hash chainまたは改ざん検知
- 一般ユーザーが監査ログを更新・削除できないこと

## 8. UI

- 患者ヘッダー常時表示
- 重大操作確認
- ORCA警告表示
- ORCAエラー表示
- ORCA不一致表示
- ORCA側のみ情報表示
- disabled理由表示
- form label
- support text
- concrete error text
- placeholder非依存
- 重要情報がaccordion/details/disclosure内だけに隠されていないこと
- button priority
- keyboard operation
- focus visibility
- contrast

## 9. セキュリティ

- ORCA認証情報がブラウザbundleに含まれないこと
- ORCA接続URLがブラウザへ露出しないこと
- フロントから生ORCA pathへ到達できないこと
- サーバーログ・監査ログ・ブラウザログにORCA認証情報が出ないこと
- 権限なしユーザーが診療録確定、処方確定、ORCA送信、監査ログ閲覧をできないこと

Round 3 時点の横断 guard:

- source/config/docs の公開 `VITE_` secret 名検査: `cd web-client && npm run verify:no-public-secrets`
- web-client raw ORCA path / taxonomy drift 検査: `cd web-client && npm run verify:no-blocked-orca-route-strings`
- web-client dev proxy の生 ORCA / credential config 検査: `cd web-client && npm run verify:no-direct-orca-proxy-config`
- production bundle の ORCA URL / Basic / 証明書 / 証明書パスワード / secret 混入検査: `cd web-client && npm run verify:prod-bundle-secrets`
- `npm run build` は `vite build` 後に `verify:prod-bundle-secrets` を実行してから production artifact pruning へ進む。

## 10. route inventory

- public mutation routeがtaxonomyに分類されていること
- `/api/prescriptions` のようなtaxonomy外routeがないこと
- local patient/disease CRUDが本番到達不能であること
- raw ORCA pathがweb-client runtime sourceにないこと

Round 3 時点の横断 guard:

- server public route inventory: `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest test`
- `PublicRouteInventoryContractTest` は `/api/orca/*` が `official` / `master` だけに収まること、`karte/document` 書込系、local patient CRUD、local disease mutation、`/api/prescriptions`、`/api/orca/queue`、`/api/orca/pusheventgetv2` が本番 route inventory に存在しないことを検査する。
- `WebXmlEndpointExposureTest` は `/api/*` 以外の REST exposure と legacy resource 登録を拒否する。
- 横断入口: `scripts/ci/verify-ehr-orca-round3-guards.sh`
- Round 4 final gate entrypoint dry-run: `bash scripts/ci/verify-release-validation-entrypoints.sh --dry-run`
- E 担当 UNKNOWN / retry / ledger の追加 hook は `OrcaOperationLedgerSchemaTest`、`OrcaHttpClientResilienceTest`、`PatientModV2OutpatientResourceIdempotencyTest`、および今後の `*Unknown*` / `*Resend*` focused test を上記横断入口または release-validation の focused Maven command に追加する。
- G 担当 DADS / 医療安全 UI の追加 hook は `cd web-client && npm run verify:medical-safety-ui-copy` と `*medical-safety*` / `*dads*` Vitest 命名の focused test を `verify:web-guard` または release-validation の targeted UI command に追加する。
- H 担当 export security / readability hook は `docs/contracts/protected-export-authorization-matrix.md`、`OrcaReportDocumentResourceTest`、`web-client/src/features/charts/__tests__/chartsPrintAudit.test.ts`、`web-client/src/features/charts/print/__tests__/useOrcaReportPrint.test.tsx` を final gate に接続する。raw ORCA body、帳票本文、storage key/digest、患者情報、HAR、trace、video、screenshot を validation evidence に含めない。
- J 担当 backup/restore / live ORCA hook は `server-modernized/tools/ci/check-backup-restore-runbook.sh`、`server-modernized/tools/ci/check-live-orca-trial-harness.sh`、`ops/tests/orca/live-trial-checklist.sh --dry-run --run-id <RUN_ID>` を release validation に接続する。restore 後の自動再送禁止、sanitize 済み evidence、operator approval を検査する。
- K 担当 backend / contract safety closeout hook は `docs/validation/backend-contract-gui-handoff-closeout.md` を参照する。route inventory、public route guard、production bundle secret scan、ORCA ledger / UNKNOWN / snapshot / disease / prescription / export / backup focused entrypoint が current repo と矛盾しないことを確認し、GUI 改修前 closeout を release-ready `GO` と扱わない。

## 11. 実ORCA接続試験

静的テストとは別に、検証環境またはTrial環境で次を確認する。

- patientgetv2
- patientmodv2
- acceptlstv2
- acceptmodv2
- diseasegetv2 class=01
- diseasev3 add/update/delete/outcome
- medicalmodv2
- tmedicalgetv2
- incomeinfv2
- warning
- unmatch
- network failure
- auth failure
- certificate failure
- UNKNOWN recovery

実在患者情報、実在医療機関情報、raw認証情報を証跡に残さない。
