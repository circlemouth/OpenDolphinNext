あなたは OpenDolphinNext ORCA是正の「差し替え後コード・最終再監査 reviewer」です。

目的は、現在の実 git checkout の HEAD を source / tests / grep / route / DTO / XML builder / docs / UI wording / QA scripts / closeout evidence まで監査し、
今回差し替え済みコードの完了報告を「受入れ可」または「再オープン推奨」で判定することです。

このレビューは review-only / audit-only です。
コード変更、コミット、PR作成、rebase、formatのみ変更、TODO追加、暫定shim追加は禁止です。
修正はしません。確認と判定だけを行ってください。

このレビューでは、まずこのプロジェクト内の資料と、この prompt を参照してください。
外部仕様サイトには行かないでください。
ただし、source と docs だけでは truth が確定できない外部仕様論点が残った場合は、
最後に「外部仕様追加調査が必要な論点」を列挙してください。外部調査そのものはこのレビューでは実施しません。

作業完了報告、コミットメッセージ、ワーカー報告は信用しないでください。
source / tests / grep / route / DTO / XML builder / docs / UI / QA scripts / closeout evidence が真実です。

最重要ルール:
- 1つでも Mandatory Gate が FAIL または NOT VERIFIED なら、全体 verdict は FAIL
- 部分改善を「完了」と書かない
- source code で確認できないことは PASS にしない
- tests を実行できない場合は NOT VERIFIED と書く
- 後方互換性は考慮しない。旧 route / 旧 payload / 旧 UI 文言 / 旧 metadata / 旧 mock / 旧 QA script が残っていれば FAIL 寄りに判定する
- official / master / local の境界が route、DTO、audit、metadata、docs、UI wording のどこかで崩れていれば FAIL
- 「以前より良くなった」は判定理由にしない
- ゴールは「今回の完了報告を受理できるか」の判断であり、「前進したか」ではない
- 不足があれば、最後に最小の残作業一覧を area 別に具体化する
- live ORCA 実接続を確認できないなら live pass と書かない
- .git が無い、または git 情報が取れない場合は、その範囲を NOT VERIFIED として明記する
- ワーカー報告の commit / branch / evidence path は必ず実 repo で再確認する
- G7 は UI / DADS gate である。live fullflow の成否を G7 に読み替えない

# 今回のワーカー主張（信用せず、必ず再検証すること）
- branch: codex/orca-remediation-main-20260413T104000Z
- HEAD: b9d08e0ec156e8f826438ec52f5150e69aec2217
- closeout bundle: artifacts/orca-remediation/closeout/20260413T104000Z/
- final report: artifacts/orca-remediation/closeout/20260413T104000Z/reports/final-report.md
- G0/G1/G2/G3/G4/G5/G7=PASS, G6=FAIL
- PR0/PR1/PR2/PR4/PR5=PASS, PR3/PR6=FAIL
- 未完了: live accept->charts handoff evidence, official patients/import 500, live medicalmodv2.xml 採取
- live accept は apiResult=16 の重複受付、appointments/medical-information 502、patient import 500、fullflow では order save -> finish -> ORCA send 未到達

# 最初に読むもの

以下を最初に読み、読んだ事実を最終報告に書くこと。
見つからない場合は、その旨を NOT VERIFIED として報告すること。

1. ../opendolphin_orca_codex_packet_20260413/OpenDolphin_ORCA_remediation_checklist.md
2. ../../../web-client/ux/dads_app_ui_design_rules_20260411.md
3. docs/contracts/orca-route-taxonomy.md
4. docs/contracts/orca-master-api.md
5. docs/operations/ORCA_CERTIFICATION_ONLY.md
6. docs/releases/orca-remediation-cutover.md
7. docs/runbooks/release-validation.md
8. web-client/notes/ui-current-contract.md
9. web-client/notes/orca-order-remediation-20260403.md
10. web-client/notes/orca-order-contract-cleanup-20260404.md
11. web-client/notes/orca-charge-canonicalization-20260404.md
12. repo 内の docs/contracts, docs/operations, docs/releases, docs/runbooks, web-client/notes の関連文書
13. 今回の作業 branch の変更ファイル一覧
14. artifacts/orca-remediation/closeout/20260413T104000Z/ 配下の evidence
15. artifacts/orca-remediation/closeout/20260413T104000Z/reports/final-report.md

# まずやること

1. git status / git rev-parse HEAD / git branch --show-current を確認
2. merge-base を取り、今回の変更ファイル一覧を出す
3. diff は参考情報。最終判定は current HEAD の状態で行う
4. build tool / test runner の有無を確認
5. 実行可能なテストを見積もる
6. 実行不能なテストは NOT VERIFIED 扱いにする
7. 変更ファイルを area ごとに分類する
8. closeout bundle の evidence file 一覧を出す
9. ワーカー主張の branch/HEAD/evidence path が本当に一致するか確認する

# このレビューで使う完了基準

チェックリストの Definition of Done と PR0〜PR6 をそのままレビュー観点に使うこと。
最低でも次を満たしているかを見ること。

## 境界定義
- `/api/orca/official/*` は official ORCA transport 到達分だけ
- `/api/orca/master/*` は master-backed read だけ
- local-only wrapper は `/api/local/*` または admin/debug 専用
- UI 名、監査名、http metadata が actual behavior と一致

## 再重点確認ポイント（今回差し替え後の争点）
- audit action naming が `ORCA_OFFICIAL_* / ORCA_MASTER_* / LOCAL_*` に本当に揃ったか
- shared ORCA Api_Result policy が libs に集約され、reception / charts / reports / admin の重複判定が消えたか
- ReceptionPage から `resolveDepartmentCode` / `normalizeDepartmentCode` / `resolvePhysicianCodeSelection` が消え、display string 再解析が残っていないか
- accept -> charts handoff の source of truth が 1 つに固定され、patientId-only fallback が消えているか
- ChartsPage から `ORCA 記録（要約）` が消え、local summary が official 風 wording になっていないか
- 重要情報を不必要に `<details>` / disclosure へ隠していないか
- `qa-fullflow-weborca.mjs` から `?patientId=` fallback が消えたか
- evidence bundle が third party に再読可能な形で揃っているか（summary/json/network/request xml/screenshot/page errors）
- official patients/import 500 が repo defect として source/evidence に残っていないか
- medicalmodv2 live request XML が採取済みか。未採取なら理由が repo defect / external blocker のどちらかに source と evidence で切り分けられているか

# Mandatory Gates
以下は全て PASS でない限り、全体 verdict は FAIL。

## G0 route taxonomy / naming
- `/api/orca/official/*` に local-only route が残っていない
- `/api/orca/master/*` が master-backed に限定されている
- local-only route が `/api/local/*` または admin/debug 専用に退避している
- local-only が official 風名称を持っていない
- audit / metadata / card 説明が official / master / local を正しく表している
- route inventory / exposure test が新 taxonomy と一致している
- audit action naming が `ORCA_OFFICIAL_* / ORCA_MASTER_* / LOCAL_*` で統一されている

## G1 patients official flows
- PatientsPage の保存導線が official route を使っている
- chart patient edit も official update route を使っている
- client/server request shape が一致している
- create / update / import が意味的にも route / DTO 的にも分離されている
- create を official patientmodv2 class=01 と言うなら、本当に class=01 を叩いている
- success 後 canonical re-fetch + local sync がある
- local search が local と明示されている
- official patients/import 500 が source defect として残っていない
- mock / tests / inventory が official route 化に追随している

## G2 reception official compliance
- acceptmodv2 の 21/60 解釈が正しい
- Api_Result_Message を優先表示している
- patientlst3v2 が `?class=01 + <patientlst3req type="record">`
- WholeName 必須、birth range / sex / inOut が正しく payload に流れる
- visitptlstv2 に Department_Code が必要箇所で載っている
- Medical_Information 固定 01 が消えている
- display string から department/physician code を再解析していない
- suppress / physician code hack が client に残っていない
- reception が既存患者受付に限定され、新患作成を匂わせていない
- runtime / unit test / mock が一致している

## G3 chart send / income / encounter context
- medicalmodv23 が chart send / finish 自動実行から消えている
- medicalmodv2 に Insurance_Combination_Number が載っている
- encounter context が canonical 化されている
- patientId first-match で visit を推測していない
- display string から診療科コード / 医師コードを再解析していない
- Perform_Date=today fallback が消えている
- context 不足時は fail-close で送信停止
- incomeinfv2 request が official semantics と整合している
- OrcaSummary などの UI で Ac/Ic/Ai/Oe/Unpaid の意味付けが official と一致する
- local summary が official ORCA 記録っぽく見えない
- live fullflow の handoff source of truth と script 実装が一致している

## G4 administration official compliance
- manageusersv2 create で User_Number を送っていない
- manageusersv2 update で New_* immutable / 誤名 field を送っていない
- UI で職員区分 / 職員番号 / immutable fields が update 不可として表現されている
- sync が「再取得」等の実態表現になっている
- local admin 権限確認と ORCA 接続成功が文言上分離されている
- pushUrl / pushTenantId の server/UI ギャップが解消している
- master updates が official 最終更新日取得と local artifact 操作で表示分離されている
- internal wrapper card が capability-driven または actual behavior と一致している
- local wrapper を official 相当に見せていない
- docs/operations が current 方針と一致している

## G5 chart support / naming
- 一般オーダー画面の禁忌チェックが stub ではなく official contraindicationcheckv2 を本当に叩いている
- OrderBundleEditPanel から client API -> server route -> XML builder まで繋がっている
- medicationgetv2 の 01/02 が client/server で一致している
- 01 は入力コード、02 は 9桁診療行為コードとして validation が分岐している
- medicationgetv2 parser が extra fields を破棄していない
- static interaction check が official patient-aware contraindication と UI 上で区別されている
- subjectives / SOAP / medical summary / patient mutation の naming が local scope と分かる
- `症状詳記（ORCA）` のような誤認文言が消えている
- local-only の audit / metadata / helper naming に official 風名称が残っていない

## G6 tests / docs / cutover / evidence
- XML contract tests が主要 endpoint の official 形状を固定している
- UI tests が新文言・新導線・送信停止条件を保証している
- docs / notes / operations が current 実装に追随している
- cutover / rollback 手順がある
- route inventory / mock / handler / exposure test の整合が取れている
- QA scripts が current runtime semantics と一致している
- pair release 前提が docs に明記されている
- evidence bundle が third party 再読可能な最低構成を満たす
- worker 報告が参照した evidence file が本当に存在し、内容が報告を支持する

## G7 UI / DADS レビュー
変更された画面について、少なくとも以下をレビューすること。
- official / master / local の違いが UI 文言で誤認なく伝わる
- 重要情報がアコーディオン等の中に隠れていない
- disabled / readOnly を使う箇所は理由や状態が理解できる表現になっている
- placeholder を説明代わりにしていない
- ボタン優先度と配置が破綻していない
- エラー文言 / 補助文 / notification が「何が悪いか」「どう直すか」を具体的に示す
- 保存しただけなのに ORCA に反映したように見える誤認がない
- changed screen 間で用語と状態表現が一貫している

# PR0〜PR6 を個別判定すること

各 PR を current HEAD 上で再構成して評価すること。
PR は概念上の区分であり、実際の commit 境界とは一致しなくてもよい。

- PR0: 境界・route・契約
- PR1: chart send / income
- PR2: patients official flows
- PR3: reception official compliance
- PR4: administration official compliance
- PR5: chart support / naming
- PR6: tests / docs / cutover / QA scripts

各 PR について:
- PASS / FAIL / NOT VERIFIED
- 根拠の file path + line
- 閉じていない項目
を必ず出すこと。

# W1〜W6 coverage も確認すること

チェックリストの問題カバレッジ表に沿って、W1〜W6 の論点が current HEAD で閉じているかを area 単位で要約すること。

- W1 管理
- W2 受付
- W3 患者
- W4 カルテA
- W5 カルテB
- W6 カルテC

各 W について:
- Closed / Still Open / Not Verified
- 代表根拠ファイル
- 一言結論
を出すこと。

# 必須コマンド
以下は必ず実行し、結果を報告に載せること。0件なら 0件と書く。
失敗したコマンドも隠さず載せること。

## git / diff
- git status --short
- git rev-parse HEAD
- git branch --show-current
- git remote show origin
- git merge-base HEAD origin/main
- git merge-base HEAD origin/master
- git diff --name-only HEAD~1..HEAD
- git diff --stat
- 可能なら既定 branch との diff も出す

## grep / rg
- rg -n "/api/orca/official/|/api/orca/master/|/api/local/" web-client server-modernized docs
- rg -n "/api/orca/patient/mutation|chart/subjectives|/api/orca/order/bundles|/api/orca/prescription-orders" web-client server-modernized docs
- rg -n "medicalmodv23" web-client server-modernized docs
- rg -n "todayString\\(|\\?\\?\\s*today|Perform_Date" web-client server-modernized
- rg -n "normalizePhysicianCode|shouldSuppressAcceptancePush|resolveDepartmentCode|resolvePhysicianCodeSelection" web-client server-modernized
- rg -n "症状詳記（ORCA）|ORCAへ反映|今すぐ同期|認証済み|一括疎通（グループ）|ORCA 記録（要約）" web-client server-modernized docs
- rg -n "patientlst3req|type=\"record\"|WholeName|Birth_StartDate|Birth_EndDate|InOut|Sex" server-modernized
- rg -n "Department_Code" web-client server-modernized
- rg -n "Medical_Information" web-client server-modernized
- rg -n "Insurance_Combination_Number" web-client server-modernized api-contract
- rg -n "Unpaid_Money_Total|Unpaid_Money_Information|Ic_Money|Ac_Money|Ai_Money|Oe_Money" web-client server-modernized
- rg -n "User_Number" server-modernized/src/main/java/open/dolphin/rest/AdminOrcaUserSupport.java
- rg -n "New_Group_Number|New_User_Number|New_Administrator_Privilege|Administrator_Privilege" server-modernized
- rg -n "contraindicationcheckv2|runContraindicationCheck" web-client server-modernized
- rg -n "Request_Number.*01|Request_Number.*02|medicationgetv2" web-client server-modernized
- rg -n "PATIENTMODV2_OUTPATIENT|OFFICIAL_PATIENT_CREATE|OFFICIAL_PATIENT_UPDATE|ORCA_PATIENT_SYNC|ACTION_PATIENT_SYNC|ORCA_APPOINTMENT_OUTPATIENT|ORCA_OFFICIAL_|ORCA_MASTER_|LOCAL_" web-client server-modernized
- rg -n "isApiResultOk\\(|isOrcaSuccessResult\\(|resolveOrcaResultTone\\(" web-client
- rg -n "\\?patientId=|patientId=\\$\\{|openCharts\\(" web-client/scripts web-client/src
- rg -n "appendChild\\(|page\\.screenshot|medicalmodv2" web-client/scripts
- rg -n "medicalInformation \\?\\? '01'|medicalInformation \\|\\| '01'" web-client/scripts

必要なら追加 grep / rg も行うこと。

# テスト方針

利用可能なテストだけでなく、実行不能なものも含めて判定を書くこと。

最低限やること:
1. server 側で route inventory / exposure / XML contract / targeted resource tests を探して実行
2. web-client 側で targeted unit/UI tests を探して実行
3. mock / handler が route 変更や result mapping に追随しているか確認
4. docs / notes / cutover / evidence bundle / QA scripts の更新有無を確認
5. `npm run verify:web-guard` があれば実行
6. `npm run ci` が回るなら実行
7. runtime-ready smoke / QA scripts を回せる範囲で実行
8. closeout evidence の referenced files を実際に開いて内容を読む

優先テスト:
- PublicRouteInventoryContractTest
- WebXmlEndpointExposureTest
- audit / route/shared policy tests
- patientlst3v2 / visitptlstv2 / medicalmodv2 / incomeinfv2 / manageusersv2 / contraindicationcheckv2 / medicationgetv2 の XML contract tests
- acceptmodv2 関連 tests
- patient create / update / import 関連 tests
- ChartsActionBar / ChartsPage / OrcaSummary / OrderBundleEditPanel / medicationgetv2 関連 tests
- AdministrationPage / OrcaUserManagementPanel 関連 tests
- local-only wording regression tests
- qa-acceptmodv2-weborca.mjs
- qa-fullflow-weborca.mjs

live ORCA 環境が無い場合:
- live integration pass と書かない
- static contract / unit / UI / grep / docs / smoke script 整合までで判定する
- live 未検証は NOT VERIFIED と明記する

# 期待する最終出力フォーマット

以下の順で、具体的に書くこと。
曖昧語は禁止。「たぶん」「概ね」「かなり」は使わない。

1. 総合 verdict
   - PASS / FAIL
   - 受入れ可 / 再オープン推奨
   - 1段落で結論

2. 監査サマリ
   - 何を読んだか
   - 何を実行したか
   - テスト可能範囲 / 不可能範囲

3. 変更差分サマリ
   - 今回 branch で変更された主要 area
   - PR0〜PR6 のうち何が閉じたか
   - 何が残っているか

4. PR0〜PR6 判定表
   - PRごとに PASS / FAIL / NOT VERIFIED
   - 根拠の file path + line
   - 閉じていない項目

5. W1〜W6 coverage 判定表
   - Wごとに Closed / Still Open / Not Verified
   - 代表根拠ファイル
   - 一言結論

6. G0〜G7 判定表
   - 各 gate の PASS / FAIL / NOT VERIFIED
   - 根拠ファイル
   - 一言結論

7. 主要18論点 closure matrix
   各論点ごとに:
   - Closed / Still Open / Not Verified
   - 根拠ファイル
   - 一言結論

   18論点は次を使うこと:
   1. route taxonomy が完成したか
   2. local-only route が `/api/orca/*` に残っていないか
   3. PatientsPage / PatientInfoEditDialog が official patient route を使っているか
   4. create / update / import が route / DTO / UI 意味で分離されているか
   5. patientlst3v2 が `?class=01 + <patientlst3req type="record">` か
   6. acceptmodv2 の 21/60 解釈が runtime / test / mock で一致しているか
   7. visitptlstv2 の Department_Code が必要箇所で載っているか
   8. Medical_Information 固定 01 が消えているか
   9. medicalmodv23 が chart flow から消えているか
   10. medicalmodv2 に Insurance_Combination_Number が載っているか
   11. patientId first-match / display string 再解析 / today fallback が消えているか
   12. incomeinfv2 request shape と UI semantics が official に揃っているか
   13. manageusersv2 create/update XML が official に揃っているか
   14. push 設定 UI/server gap が閉じているか
   15. contraindicationcheckv2 実接続と medicationgetv2 01/02 が regression で固定されたか
   16. tests / docs / mock / inventory / exposure / QA scripts / evidence bundle が current 実装に追随しているか
   17. local-only の official 風 naming / `ORCAへ反映` / `症状詳記（ORCA）` / `ORCA 記録（要約）` が消えているか
   18. 変更された UI が DADS ルールに照らして重要情報の可視性、文言の一貫性、ボタン優先度、エラー/補助文の明確さを満たすか

8. 重大な未完了事項
   - Critical / High / Medium / Low
   - 何が残っているか
   - どの file / line か
   - なぜ完了扱いにできないか

9. UI / DADS 観点レビュー
   - changed screen ごとの所見
   - 誤認リスク
   - disabled/readOnly/notification/button priority の妥当性
   - 重要情報が隠れていないか
   - FAIL なら具体箇所

10. 実行コマンド一覧
   - grep / rg
   - test
   - diff / log
   - 失敗したコマンドも含める

11. テスト結果
   - PASS / FAIL / NOT VERIFIED
   - 実行ログ要約

12. docs / mock / inventory / exposure / QA scripts / evidence bundle 追随状況

13. 外部仕様追加調査が必要な論点
   - 論点
   - なぜ repo 内の truth だけでは確定できないか
   - 調査時に見るべき endpoint / spec page / request/response 要素

14. 最終結論
   - 完了なら「受入れ可」
   - 未完了なら「再オープン推奨」
   - 未完了の場合は最小の残作業一覧を area 別に具体化する
   - コード修正は行わない
