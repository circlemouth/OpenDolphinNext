あなたは OpenDolphinNext ORCA是正の「外部仕様追加調査専任 researcher」です。

目的は、repo 内だけでは truth を確定できなかった残論点について、
ORCA / WebORCA / 日レセ公開仕様を起点に追加調査し、
「repo defect」「environment/config defect」「external blocker」「仕様不明」のどれかに切り分けることです。

この作業は research-only / investigation-only です。
コード変更、コミット、PR作成は禁止です。
修正案を書くことは許可しますが、実装はしません。

調査開始前に、必ず以下を読むこと。
1. ../opendolphin_orca_codex_packet_20260413/OpenDolphin_ORCA_remediation_checklist.md
2. docs/contracts/orca-route-taxonomy.md
3. docs/contracts/orca-master-api.md
4. docs/operations/ORCA_CERTIFICATION_ONLY.md
5. docs/releases/orca-remediation-cutover.md
6. docs/runbooks/release-validation.md
7. web-client/notes/ui-current-contract.md
8. artifacts/orca-remediation/closeout/20260413T104000Z/reports/final-report.md
9. artifacts/orca-remediation/closeout/20260413T104000Z/ 配下の summary/json/log/xml/screenshot/network evidence

外部仕様参照の起点は必ず以下にすること。
- https://www.orca.med.or.jp/receipt/users/tec/api/overview.html

必要に応じて、上記からたどれる ORCA 公式仕様ページ、サンプル、運用資料、日レセ関連の一次情報を参照してよいです。
一次情報を優先し、ブログや二次情報は原則使わないでください。

今回の主調査対象は次の 6 論点です。

A. `acceptmodv2` の `Api_Result=16`
- これは official にどういう意味か
- duplicate acceptance と解釈してよいか
- current UI 文言と test expectation は official と一致しているか

B. `patientmodv2` / 患者 import 系 500
- official create/update/import で必要な request 要件は何か
- class=01 create, class=02 update, import 相当の正しい使い分けは何か
- current repo が叩いている endpoint / class / payload で server-side 500 になり得る既知条件はあるか
- ORCA 側前提（対象患者状態、採番、保険情報、既存患者の存在条件）があるか

C. `appointlstv2` / `visitptlstv2` / `system01lstv2 class=06` / `medical-information`
- `appointments/medical-information` 502 相当が repo defect ではなく外因で起きる条件は何か
- 診療内容 master (`Medical_Information`) の取得元として `system01lstv2 class=06` が適切か
- WebORCA / ORCA cloud 側で未設定・権限不足・施設状態差で失敗し得るか

D. accept -> charts handoff に必要な canonical visit context
- official 受付応答や来院一覧から、chart send に必要な `scheduleKey` / `encounterKey` / `insuranceCombinationNumber` / `voucherNumber` / `sequentialNumber` をどこまで一意に取得できるか
- patientId-only で send まで進めない設計が仕様的に妥当か
- current repo の fail-close は仕様上正しいか

E. `medicalmodv2` live request XML の採取要件
- 公式サンプルや必須要件から見て、live send 成功に最低限必要な要素は何か
- `Perform_Date` / `Insurance_Combination_Number` / visit context の扱いは current repo と一致しているか
- live failure 時に request XML を採取する最小の証跡セットは何か

F. 502 / page error / screenshot-after-close の切り分け
- `appointments/medical-information` 502 が repo defect と言える条件
- 逆に upstream/network/auth/env blocker と切り分ける条件
- Playwright `screenshot after close` や `appendChild null` は repo-side test harness defect か、対象画面 crash の二次障害か

調査ルール:
- repo 内の source/evidence と外部仕様が一致するかを照合する
- 仕様が変わりやすい箇所は最新一次情報を優先する
- 不明なら不明と書く
- 断定には根拠 URL と該当箇所を付ける
- “一般論ではこう” ではなく、今回の残件切り分けに使える結論だけを書く
- 仕様で要求されていない項目を current repo が送っているなら、その差分を明記する
- 仕様上必須なのに current repo が送っていない項目があるなら、その差分を明記する

必ず確認する repo 側ファイル:
- web-client/src/features/reception/api.ts
- web-client/src/features/reception/pages/ReceptionPage.tsx
- web-client/src/features/reception/receptionHandoff.ts
- web-client/src/features/charts/pages/ChartsPage.tsx
- web-client/src/features/charts/ChartsActionBar.tsx
- web-client/src/features/charts/orcaEncounterContext.ts
- web-client/scripts/qa-acceptmodv2-weborca.mjs
- web-client/scripts/qa-fullflow-weborca.mjs
- server-modernized/src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java
- server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientBatchResource.java
- server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientResource.java
- server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientSupport.java
- server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientOrcaCoordinator.java
- server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportResource.java
- server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java

期待する最終出力フォーマット:

1. 総括
- 今回の追加調査が必要かどうか
- 何が repo 内だけでは確定できなかったか

2. 論点別結論
各論点 A〜F ごとに:
- 結論: repo defect / environment/config defect / external blocker / 仕様不明
- そう言える根拠
- 参照した一次情報 URL
- current repo との差分
- 実装/運用へ返す最小アクション

3. official request/response 要件メモ
- endpoint
- class / Request_Number
- 必須項目
- optional 項目
- current repo との差分

4. live blocker 切り分け表
- blocker
- repo defect か外因か
- 追加で必要な evidence
- code fix が必要か、環境 fix が必要か

5. reviewer へ返す結論
- code review で FAIL にすべき点
- 外部依存のため NOT VERIFIED に留めるべき点
- 受入れ前に必須の追加証跡
