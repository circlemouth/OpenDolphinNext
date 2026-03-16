# Verification Plan: CLAIM 廃止対応

> 注: WebClient の「画面確認作業計画（新）」は `docs/verification-plan-screen-review.md` を参照。

## 目的
- `/orca/claim/outpatient` を Web クライアントから呼び出さないことを確認する。
- 受付/Charts の外来関連フローが `/api/orca/medical/outpatient` と `/api/orca/appointments/list`・`/api/orca/visits/list` に一本化されていることを確認する。
- 受付送信（`/api/orca/visits/mutation`＝`/orca11/acceptmodv2`）が必須機能として成立することを確認する。
- CLAIM 前提の UI 文言・導線が残っていないことを確認する。
- コンソール/ネットワークに不要な 404/401 が発生しないことを確認する。

## 前提
- Web クライアント起動手順は `docs/server-modernization/phase2/operations/ORCA_CERTIFICATION_ONLY.md` を参照する。
- ORCA Trial を利用する前提で、接続情報・認証情報は**作業対象ディレクトリ内**の公開情報扱い（機微不要）とする。
- ORCA Trial サーバーは**常時操作可能**である。
- MSW 有効 (`VITE_DISABLE_MSW=0`) と無効 (`VITE_DISABLE_MSW=1`) の両経路で確認する。
- Reception/Charts の詳細チェックは `docs/weborca-reception-checklist.md` を参照する。

## 残件（P0/P1/P2）: 2026-02-06
- P0（完了）: 処置オーダー（器材/薬品使用量）送信の再実測（数量/コード一致の実証）。RUN_ID=`20260206T072728Z-procedure-usage-recheck19`
  - 条件: MSW ON (server-handoff) でも `x-datasource-transition=server` で `/api/orca/order/bundles` と `/api/orca/queue` が passthrough され、server-modernized の実APIに到達すること（達成）。
  - 完了条件: `/api/orca/chart-support/medical-mod-v2` request XML に処置由来の `Medical_Information_child` / `Medication_info_child` が含まれ、`Medication_Code`/`Medication_Number` が UI 入力の数量/コードと一致する（達成: `Medication_Code=M001`, `Medication_Number=2`）。
  - 証跡: `artifacts/webclient/e2e/20260206T072728Z-procedure-usage-recheck19/fullflow/`（`network/network.json`, `fullflow-summary.json`, `steps.log`, screenshots）
- P0（完了）: 材料マスタ検索（`GET /api/orca/master/material`）の 503 ブロッカー再検証（ORCADS修正後）。RUN_ID=`20260206T183713Z-cmd_20260206_15_sub_16-material-master-reverify28`, `20260206T183833Z-cmd_20260206_15_sub_16-material-master-reverify29`
  - 実測: Procedure Usage（order-edit）で材料キーワード入力 → `GET /api/orca/master/material?keyword=<...>` が **200**（body=`[]`）で応答し、UI は「該当する材料が見つかりません。」の空表示を出すことを確認（503 は再現せず）。
  - keyword:
    - `a` → 200 / `[]`（RUN_ID=`20260206T183713Z-cmd_20260206_15_sub_16-material-master-reverify28`）
    - `ガーゼ` → 200 / `[]`（RUN_ID=`20260206T183833Z-cmd_20260206_15_sub_16-material-master-reverify29`）
  - 証跡: `artifacts/webclient/e2e/<RUN_ID>/material-master/`（`steps.log`, `network/network.json`, screenshots）
  - 追加観測: items>0 が得られず材料選択→`POST /api/orca/order/bundles`（材料 payload 反映）の実証は未達。材料データ投入待ち（DB 0件相当）として別途追跡する。
  - 切り分け（P0補足, RUN_ID=`20260206T190155Z-cmd_20260206_15_sub_18-material-items-rootcause`）:
    - ORCA DB（schema=`master`）の `tbl_material_*` が全て 0件であり、items>0 が出ない主因は「材料マスタ未投入」。
    - 併せて DEV 用の最小シード投入で items>0 を人工的に作成し、材料選択→`POST /api/orca/order/bundles` payload 保存まで実証（RUN_ID=`20260206T192539Z-cmd_20260206_15_sub_18-material-items-seeded-verify1`）。
- P0（完了）: ORDER-001 最小MVP（order-edit の editor 切替 + bundleName 自動補完）を feature flag で段階導入し、/api/orca/order/bundles まで実測で実証。RUN_ID=`20260207T065042Z-cmd_20260207_08_sub_2-order-001-mvp1`
  - flag: `VITE_ORDER_EDIT_MVP=1`
  - MVP内容（StampBoxツリーUIには非依存）:
    - Charts の `オーダー編集` で editor 種別を切替（`generalOrder`/`treatmentOrder`/`testOrder`）
    - bundleName が空のとき先頭項目名で自動補完して保存（Legacyの「束名が暗黙」の運用を最小で代替）
  - 送信側の合格観点（最低限）:
    - `ORCA送信` は disabled の場合 ActionBar に短文ガード理由が表示される / enabled の場合は送信ダイアログが開く
  - 証跡: `artifacts/verification/20260207T065042Z-cmd_20260207_08_sub_2-order-001-mvp1/order-001-mvp/`（`summary.md`, `orca-order-bundles.network.memo.md`, screenshots）
- P1（完了）: `chart-events`（SSE）系の 5xx の扱いを確定（非致命: ストリーム未提供時は停止し、dev/MSWでは console spam を抑止）。
  - 恒久対応:
    - `web-client/src/libs/sse/chartEventStream.ts`: 400/401/403/500/502/503 は `stream unavailable` としてリトライせず停止。
    - `web-client/src/features/shared/ChartEventStreamBridge.tsx`: dev/MSW では `stream unavailable` を黙殺（console warn を抑止）。
  - 再検証（unit）RUN_ID=`20260206T093750Z-chart-events-policy`
    - 証跡: `artifacts/verification/20260206T093750Z-chart-events-policy/vitest-chart-event-stream.txt`
  - 再検証（UI + MSW on/off）RUN_ID=`20260206T125233Z-cmd_20260206_15_sub_11-chart-events-msw`
    - MSW OFF（`VITE_DISABLE_MSW=1`）: `/api/chart-events` が 401 でも **無限リトライせず**停止（React StrictMode による effect 二重起動ぶんの 2 回のみ）。console に `[chart-events] stream error` は出ない。
    - MSW ON（`VITE_DISABLE_MSW=0`）: MSW mock（`x-chart-events-mode=mock`）で 200/text-event-stream を確認。mock 応答が即時 close するため 3s 間隔で再接続するが、console warn のスパムは発生しない。
    - 証跡: `artifacts/verification/20260206T125233Z-cmd_20260206_15_sub_11-chart-events-msw/`（`msw_{off,on}.results.json`, `msw_{off,on}.console.txt`, screenshots, `vitest-chart-event-stream.txt`）
- P2（要確認→方針確定）: 処置オーダー送信の unit 取り扱いを確定（現状は数量のみ送信、unit は送信しない方針）。

## REC-001 受付一覧 Status MVP（段階導入）
- 目的: 受付一覧の状態/アイコンを ORCA-queue 表現へ写像し、例外時に「原因 + 次アクション + 再送導線」を一覧上で最小提示する。
- 方針: CLAIM 前提の状態/操作は廃止方針により対象外/仕様差（受付一覧は ORCA queue 中心に寄せる）。
- feature flag:
  - `VITE_RECEPTION_STATUS_MVP=1`: 状態/アイコン + ORCA queue 状態表示（Phase1）
  - `VITE_RECEPTION_STATUS_MVP=2`: 例外分類 + 次アクション提示 + 再送ボタン（Phase2）
- 検証（MSW）:
  - RUN_ID=`20260207T070200Z-cmd_20260207_08_sub_3-rec-001-mvp`
  - 証跡: `artifacts/verification/20260207T070200Z-cmd_20260207_08_sub_3-rec-001-mvp/rec-001-mvp/`（screenshots + HAR + notes）

## acceptmodv2 再現条件/ブロッカー
- 受付登録/取消は `/api/orca/visits/mutation` → `/orca11/acceptmodv2` に接続する（MSW/実 API の切替は `VITE_DISABLE_MSW` に依存）。
- Trial（weborca-trial）では POST 405（Allow=`OPTIONS, GET`）が実測されており、Trial で 405 が出た場合は Blocker として扱う（RUN_ID=`20251116T210500Z-E2`）。
- 再検証の前提（接続/認証）: server-modernized の `ORCA_API_*`（`ORCA_API_USER/PASSWORD` など）と `ORCA_MODE`/`ORCA_API_PATH_PREFIX` の整合を確認する。Vite dev proxy を使う場合は `VITE_DEV_PROXY_TARGET` と `ORCA_PROD_BASIC_USER/ORCA_PROD_BASIC_KEY` が必要で、UI 側は `userName/password` ヘッダも併用する。
- WebORCA Trial で 405 が出る場合は `ORCA_API_PATH_PREFIX=/api` もしくは `ORCA_BASE_URL=https://weborca-trial.orca.med.or.jp/api` を明示する（`ORCA_MODE=weborca` でも host/port 経由の URL 生成時は自動で `/api` が付与されないため）。
- 再検証の前提（seed）: Dr `10000/10001` を取得できる system01lstv2 と Patient `00005` などの seed が必要。**ORCA Trial では職員コードが 0001/0003/0005/0006/0010（userId: doctor1/doctor3/doctor5/doctor6/doctor10）で提供されるが、acceptmodv2 の `physicianCode` は system01lstv2 の Code（`10001/10003/10005/10006/10010`）を使用する。職員コード(0001等)を送ると Api_Result=14（ドクターが存在しません）になりやすい。** seed 不足時は `acceptlstv2=13`/`appointlstv2=12`/`medicalmodv2=10` に加え、`acceptmodv2` が POST 405 となる記録がある。seed を整えると `acceptmodv2` が 200 で通る（RUN_ID=`20251122T132337Z`）。
- Trial 直叩きの成功条件（直近）: `patientId=01414` / `physicianCode=10001` / `insuranceCombinationNumber=0001`。同日で Api_Result=16（重複）になった場合は **翌日付で再送** するか、既存受付を取消して再実行する。

### REC-030（受付送信）成功条件（本番想定での合格判定）
- 前提（環境）:
  - MSW OFF で実経路確認（`VITE_DISABLE_MSW=1`）。
  - `/api/orca/visits/mutation` が server-modernized 経由で `/orca11/acceptmodv2` に到達し、`ORCA_BASE_URL`/`ORCA_API_PATH_PREFIX` の設定で `/api` prefix の不足/二重付与が起きない。
  - 認証/権限: Basic 認証 + facility/user が有効で 401 にならない（必要なら `X-Facility-Id` を含む）。
- 前提（入力データ）:
  - `patientId` は ORCA 側に存在し、`insuranceCombinationNumber` は患者に紐づく実番号（推測で埋めない）。
  - `physicianCode` は職員コード（0001等）ではなく system01lstv2 の physician Code（`10001/10003/10005/10006/10010`）。
- 合格（期待する戻り）:
  - `/api/orca/visits/mutation` は HTTP 200（JSON）で応答し、UI で Api_Result を表示して操作継続できる。
  - Api_Result=00 は「受付登録成功」。
  - Api_Result=16 は「当日同条件で既に受付登録済み（冪等/業務エラー）」として扱い、致命ではない。
  - Api_Result=14/24 は「入力/seed 不備の業務エラー」として UI で明示し、環境/seed を修正して再試行できる（direct/modernized/web-client で同結論）。
  - Api_Result=90 は ORCA 側排他（他端末使用中）で再現性が不定のため、仕様上の差分として許容し「時間を置いて再試行」の運用で吸収する。

### Trial で失敗しやすい原因（Webの機能不備ではない）
- ORCA Trial 上流が 502/不安定で server-modernized 側の retry 後に `/api/orca/visits/mutation` が 500（Session layer failure）になる。
- `ORCA_API_PATH_PREFIX`/`ORCA_BASE_URL` が不適切で、Trial の `/orca11/acceptmodv2` が POST 405（Allow=`OPTIONS, GET`）になる（prefix不足/二重付与）。
- seed 不足や `physicianCode` 誤り（職員コード送信）で Api_Result=14/24/16 等となる（業務エラーとして UI 表示で許容/切り分け）。

## acceptmodv2 seed/権限/データ準備（具体手順）
- 参照: `src/orca_preprod_issue_catalog_resolution_20260123/09_test_data_validation/02_ORCAデータ準備手順.md`
- ORCA 実データ準備（Local WebORCA 想定）: 02_ORCAデータ準備手順の「Local WebORCA（docker）」に従い、`patientmodv2` / `/api/orca/visits/mutation` / `/api/orca/visits/list` の順でデータを作成・確認する。
- Modernized DB の最低限 seed（UI 側の権限/施設）: `ops/db/local-baseline/local_synthetic_seed.sql` を適用し、facility=`1.3.6.1.4.1.9414.72.103` と user=`1.3.6.1.4.1.9414.72.103:doctor1`（roles=admin/doctor/user）を投入する。
- E2E 再現 seed（UI 側の患者/受付リスト）: `scripts/seed-e2e-repro.sh` を実行し、`ops/db/local-baseline/e2e_repro_seed.sql` を併用して patientId=10010/10011/10012/10013 を当日分で作成する（RUN_ID 例: `20260126T124251Z`）。
- Legacy 互換の admin/doctor 権限が必要な場合: `ops/db/local-baseline/local_synthetic_seed.sql` で `LOCAL.FACILITY.0001:dolphin` を投入（roles=system-administrator/doctor/user）。
- Trial 直叩き成功条件を採用する場合: `patientId=01414` / `physicianCode=10001` / `insuranceCombinationNumber=0001` を指定する。

### ORCA Trial 職員コード（1010: 職員情報）
- 出典: `docs/server-modernization/phase2/operations/assets/orca-trialsite/raw/trialsite.md` の「システムの設定情報 1010」。
- 受付送信の担当医コードは下記の **職員コード** を使用する（Trial 実測時の前提）。

| 種別 | 職員コード | userId | 氏名 | 用途/専門科 |
| --- | --- | --- | --- | --- |
| 事務職 | 0001 | guest | ゲスト ユーザ | 管理者ではない |
| 医師 | 0001 | doctor1 | 内科 太郎 | 内科 |
| 医師 | 0003 | doctor3 | 精神科 二郎 | 精神科 |
| 医師 | 0005 | doctor5 | 整形外科 四郎 | 整形外科 |
| 医師 | 0006 | doctor6 | 外科 五郎 | 外科 |
| 医師 | 0010 | doctor10 | 眼科 六郎 | 眼科 |

> 注: system01lstv2 の physician Code は `10001/10003/10005/10006/10010`（各 userId に対応）で、acceptmodv2 の `physicianCode` にはこちらを使用する。

### ORCA Trial 患者/保険組み合わせ（00001〜00011）
- 出典: `docs/server-modernization/phase2/operations/assets/orca-trialsite/raw/trialsite.md` の「登録されている初期データ」。
- ここに記載されているのは **保険種別・診療科の組み合わせ**。`insuranceCombinationNumber` は公開情報に含まれないため、**検証前に ORCA 側で実番号を確認してから** 送信すること（推測で埋めない）。
- 直叩き実測（RUN_ID=`20260205T114847Z-insurance-combinations`）: `POST /api01rv2/patientlst6v2`（Reqest_Number=01）で患者ごとの保険組み合わせ番号を取得。
  - 証跡: `artifacts/verification/20260205T114847Z-insurance-combinations/insurance-combination.tsv`
  - Reqest_Number は処理区分のため `01` 固定。任意文字列だと Api_Result=E91（処理区分未設定）。
- acceptmodv2 等で使用する際は、patientId と照合した **保険組み合わせ番号を事前に取得して記録** する。

| 患者ID | 事例 | 保険種別 | 診療科 | insuranceCombinationNumber（実測） |
| --- | --- | --- | --- | --- |
| 00001 | 事例一 | 国保 | 整形外科 | 0005（国保/060）、0009（自費/980） |
| 00002 | 事例二 | 社保→国保 | 内科 | 0003（協会/009）、0004（国保/060）、0005（公害保険/975） |
| 00003 | 事例三 | 社保 | 内科 | 0001（地公/032） |
| 00004 | 事例四 | 社保 | 内科 | 0001（学校/034） |
| 00005 | 事例五 | 国保 | 整形外科 | 0001（国保/060） |
| 00006 | 事例六 | 後期高齢者 | 内科 | 0001（後期高齢者/039） |
| 00007 | 事例七 | 生活保護 | 精神科 / 眼科 | 0001（公費=012:生活保護） |
| 00008 | 事例八 | 自賠責 | 整形外科 | 0001（自賠責保険/973） |
| 00009 | 事例九 | 労災 | 整形外科 | 0001（労災保険/971） |
| 00010 | 事例十 | 自費 | 外科 | 0001（自費/980） |
| 00011 | 事例十一 | 後期高齢者 | 内科 | 0001（後期高齢者/039） |

## Trial 不可時の本番想定検証計画
- Trial で POST 405 が継続する場合は、`ORCA_CERTIFICATION_ONLY.md` に従い本番相当（認証環境/ORMaster 等）で検証する。
- 前提: VPN/FW/ACL の開通、Basic/mTLS 認証の準備、facility/role 有効化、doctor/patient seed の整備。
- 証跡: RUN_ID・Network/HAR・レスポンス XML/headers・server-modernized ログ（runId/traceId）を必ず残す。

## 検証手順
1. Reception 画面を表示し、Network で `/orca/claim/outpatient` が発火しないことを確認する。
1. Reception の受付登録/取消フォームから「受付送信」を実行し、`/api/orca/visits/mutation` の HTTP 応答と Api_Result を確認する。
1. Reception 画面で `/api/orca/queue` のレスポンスが表示され、送信キューの状態が表示されることを確認する。
1. Charts 画面を表示し、Network で `/orca/claim/outpatient` が発火しないことを確認する。
1. Charts 画面で `/api/orca/medical/outpatient` と `/api/orca/appointments/list`・`/api/orca/visits/list` が正常に応答することを確認する。
1. 受付/Charts の CLAIM 依存文言が残っていないことを確認する。
1. 開発者コンソールで `/orca/claim/outpatient` に起因する 404/401 が発生しないことを確認する。
1. Charts の ORCA送信ダイアログが出ない場合、`ガード理由（短文）` が ActionBar に表示されることを確認する。

### ORCA送信ダイアログ未表示時のガード理由可視化
- sendEnabled=true でも sendDisabled=true の場合、ActionBar に `ガード理由（短文）` が表示される。
- 例: missingMaster=true のとき `ORCA送信: マスタ欠損: missingMaster=true で送信不可` と表示される。
- 実測 (RUN_ID=`20260204T121935Z-send-disabled-reason`):
  - sendDisabled=true, guardSummary が表示されることを確認
  - 証跡: `artifacts/webclient/send-disabled/20260204T121935Z-send-disabled-reason/`

### MSW 既定シナリオ（missingMaster）対策
- MSW の既定シナリオを `server-handoff` に変更し、missingMaster=false を既定にした。
- missingMaster=true を再現したい場合は `x-msw-scenario=snapshot-missing-master` を送出するか、
  `OutpatientMockPage` でシナリオを切り替える。
- 実測 (RUN_ID=`20260204T122741Z-missing-master-fix-msw`):
  - MSW 有効・シナリオ指定なしで sendDisabled=false / guardSummary 空を確認
  - 証跡: `artifacts/webclient/missing-master/20260204T122741Z-missing-master-fix-msw/`

### missingMaster 解消後の ORCA送信（MSW既定シナリオ）
- MSW 既定シナリオ (server-handoff) で Charts を開き、sendDisabled=false を確認。
- ORCA送信ダイアログを表示し「送信する」を実行、`/api/orca/chart-support/medical-mod-v2` が 200 で発火することを確認。
- 実測 (RUN_ID=`20260204T123135Z-missing-master-send-msw`):
  - sendDisabled=false
  - `http://localhost:5177/api/orca/chart-support/medical-mod-v2` HTTP 200
  - 証跡: `artifacts/webclient/missing-master-send/20260204T123135Z-missing-master-send-msw/`

### MSW無効/flagged-mock無効での ORCA送信確認
- MSW 無効 (VITE_DISABLE_MSW=1 相当) かつ flagged-mock 無効の Vite で Charts を表示し、sendDisabled=false を確認。
- ORCA送信ダイアログを表示し「送信する」を実行、`/api/orca/chart-support/medical-mod-v2` が 200 で発火することを確認。
- 実測 (RUN_ID=`20260204T123958Z-msw-off-send-check`):
  - sendDisabled=false / guardSummary は印刷のみ患者未選択
  - `http://localhost:5176/api/orca/chart-support/medical-mod-v2` HTTP 200
  - 証跡: `artifacts/webclient/msw-off-send/20260204T123958Z-msw-off-send-check/`

## 期待結果
- `/orca/claim/outpatient` の HTTP リクエストが発生しない。
- 受付送信（`/api/orca/visits/mutation`）が HTTP 200 で応答し、Api_Result が成功（00）または警告であることを確認できる。
- 受付/Charts の外来フラグと送信キューが表示され、CLAIM 廃止の影響で UI が崩れない。
- コンソールに CLAIM 関連の 404/401 が残らない。

## 記録
- Network ログのスクリーンショットまたは HAR を保存する（`/api/orca/visits/mutation` と `/api/orca/queue` を含む）。
- 受付/Charts の画面キャプチャを保存する。
- `docs/weborca-reception-checklist.md` の結果（RUN_ID/接続先/MSW 設定）を記録する。

## cmd_23: カルテ版管理（server-modernized）

### Phase1（read API）
- 履歴: `GET /openDolphin/resources/karte/revisions?karteId={karteId}&visitDate={YYYY-MM-DD}`
- 版取得: `GET /openDolphin/resources/karte/revisions/{revisionId}`
- 差分: `GET /openDolphin/resources/karte/revisions/diff?fromRevisionId={id}&toRevisionId={id}`
- curl実証: RUN_ID=`20260206T222006Z-cmd_20260206_23_sub_4-server-revision-api`
  - 証跡: `artifacts/verification/20260206T222006Z-cmd_20260206_23_sub_4-server-revision-api/server-revision-api/`

### Phase2（write API: append-only）
- 改訂（過去版を編集=新revision追加）: `POST /openDolphin/resources/karte/revisions/revise`
- restore（この版を現在として採用=新revision追加）: `POST /openDolphin/resources/karte/revisions/restore`
- payload（最小）:
  - `sourceRevisionId`（転記/編集元）
  - `baseRevisionId`（競合最小: 最新版一致の期待値。不一致は 409）
- 409 conflict:
  - `baseRevisionId != latestRevisionId` の場合 `HTTP 409`（error=`REVISION_CONFLICT`）で弾く
  - クライアントは `latestRevisionId` を見て履歴更新が必要と判断できる
- 監査details（受け皿）:
  - `operation`（revise/restore/do_copy 等）
  - `operationPhase`（edit/restore/do）
  - `baseRevisionId` / `parentRevisionId` / `sourceRevisionId` / `createdRevisionId`

### Phase2 実証（curl）
- RUN_ID=`20260207T000754Z-cmd_20260206_23_sub_10-server-revision-write-api`
- 証跡: `artifacts/verification/20260207T000754Z-cmd_20260206_23_sub_10-server-revision-write-api/server-revision-write-api/`
  - revise 成功: `revise.headers.txt`（HTTP 200）/ `revise.body.raw.json`（createdRevisionId=9204）
  - restore 成功: `restore.headers.txt`（HTTP 200）/ `restore.body.raw.json`（createdRevisionId=9206）
  - 履歴増分: `history.before.raw.json`（latest=9202）→ `history.after_revise.raw.json`（latest=9204）→ `history.after_restore.raw.json`（latest=9206）
  - conflict: `revise.conflict.http_code.txt`（409）/ `revise.conflict.body.raw.json`

## /odletter/letter API 確認
- エンドポイント:
  - 保存/更新: `PUT /odletter/letter`（JSON, 返却は pk 文字列）
  - 一覧: `GET /odletter/list/{karteId}`
  - 単体取得: `GET /odletter/letter/{id}`
  - 削除: `DELETE /odletter/letter/{id}`（物理削除）
- 500 対応メモ（2026-02-06 修正）:
  - `LetterServiceBean#saveOrUpdateLetter` で creator(UserModel) と facilityId を補完するガードを追加。
  - userModel が不完全な場合は userId / trace actorId から解決し、未解決時は例外化。
  - karte 解決時の facilityId 参照を trace actorId にフォールバック。
- 更新時の前提:
  - `linkId` に旧レコードの id を指定し、新規作成→旧レコード削除の置換方式（server 側実装）。
  - `id` は 0 または未指定を想定（JPA 採番）。
- 期待ペイロード（LetterModule/LetterItem/LetterText/LetterDate）:
  - `LetterModule` 本体: `title` / `letterType` / `handleClass` / `client*` / `consultant*` / `patient*`。
  - `letterItems`: `{ name, value }`（例: `disease`, `purpose`, `remarks`, `visitedDate`）。
  - `letterTexts`: `{ name, textValue }`（例: `clinicalCourse`, `medication`, `informedContent`）。
  - `letterDates`: `{ name, value }`（例: `visitedDate`）。
  - KarteEntryBean 必須項目: `confirmed` / `started` / `recorded` / `status` / `userModel` / `karteBean` を JSON に含める。
- 検証観点:
  - `PUT` で作成→ `GET /list` に反映、`GET /letter/{id}` で子要素（items/texts/dates）が返る。
  - `linkId` 指定の更新で旧レコードが削除され、再取得で新レコードのみ残る。
  - `DELETE` で子要素も削除される。
  - 旧事象: userModel/karte の参照不足で 500 が発生していたため、修正後に 200 を再確認する。
- 実測結果 (RUN_ID=20260205T203656Z-odletter-regression): PUT 作成 200 (id=9096) → 一覧/取得 OK → 更新 PUT 200 (id=9097) → 一覧が id=9097 のみ → 削除 204 → 一覧空。
- 印刷プレビュー: 文書印刷プレビュー画面を表示し、スクリーンショット取得（`artifacts/webclient/e2e/20260205T203656Z-odletter-regression/print-preview.png`）。
- 実測結果 (RUN_ID=20260205T210047Z-odletter-regression): PUT 作成 200 (id=9098) → 一覧/取得 OK → 更新 PUT 200 (id=9099) → 一覧が id=9099 のみ → 削除 204 → 一覧空。
- 手順: `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` で再起動 → /odletter API を実行 → `charts/print/document` で印刷プレビューを確認。
- 印刷プレビュー: 文書印刷プレビュー画面を表示し、スクリーンショット取得（`artifacts/webclient/e2e/20260205T210047Z-odletter-regression/print-preview.png`）。
- 証跡/ログ: `artifacts/webclient/e2e/20260205T210047Z-odletter-regression/`（status/response/headers, print-preview-state.json）
- 実測結果 (RUN_ID=20260205T210750Z-odletter-404-recheck): PUT 作成 200 (id=9100) → 一覧/取得 OK → 更新 PUT 200 (id=9101) → 一覧が id=9101 のみ → 削除 204 → 一覧空。
- 404 再検証（当時）: 認証あり `GET /odletter/letter/999999` は 500（Session layer failure）。認証なしは 401。
- 印刷プレビュー: 文書印刷プレビュー画面を表示し、スクリーンショット取得（`artifacts/webclient/e2e/20260205T210750Z-odletter-404-recheck/print-preview.png`）。
- 証跡/ログ: `artifacts/webclient/e2e/20260205T210750Z-odletter-404-recheck/`（status/response/headers, print-preview-state.json）
- 使用データ: facilityId=1.3.6.1.4.1.9414.10.1 / userId=dolphindev / patientId=P0002 / karteId=91012。
- 起動/ログ確認（RUN_ID=20260205T205309Z-setup-modernized-env, 2026-02-06）:
  - `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` で server-modernized を起動し、起動/コンパイルエラーなしを確認。
  - `/odletter/letter` の 500 再発ログは当該起動では未検出（既存ログに過去の GET 500 が残っている）。
  - 既存ログで WildFly 再起動に伴う `micrometer` 重複登録エラーが見えるため、再起動時の警告として把握。
- NoResultException 500 対応（RUN_ID=20260206T060020Z-odletter-404-fix, 2026-02-06）:
  - `LetterResource` で `SessionServiceException` の cause に `NoResultException` を検知した場合は 404 を返すよう修正。
  - `GET /odletter/letter/{id}` の 404 実測は RUN_ID=20260205T210750Z-odletter-404-recheck では認証ありで 500 が返り、404 が確認できなかった（認証なしは 401）。
- 404 実測（RUN_ID=20260205T212536Z-odletter-404-fix-verify, 2026-02-06）:
  - 認証あり `GET /odletter/letter/999999` が 404 を返すことを確認（`X-Facility-Id: 1.3.6.1.4.1.9414.10.1` + `dolphindev`）。
  - 応答: `{"error":"not_found","code":"not_found","message":"Letter not found: 999999",...,"status":404,"reason":"Letter not found: 999999"}`。

## カルテ：オーダー欄 文書項目モーダル
- 実装: OrderBundleEditPanel の文書項目クリックで文書操作モーダルを開く。memo/code の `documentId`/`letterId` を解釈し、未指定時は文書名でフィルタ。
- 実装: ChartsPage に FocusTrapDialog を追加し、DocumentCreatePanel をモーダル表示。
- 実装: DocumentCreatePanel に openRequest を追加し、letterId/documentId を解決して編集・プレビューを起動。
- 検証 (RUN_ID=20260205T215908Z-document-modal, 2026-02-05):
- 環境: `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` (ORCA Trial) / Vite `http://localhost:5173`
- 使用データ: facilityId=1.3.6.1.4.1.9414.10.1 / userId=dolphindev / patientId=P0002 / visitDate=2026-02-05
- 文書作成: 紹介状を保存 → `/odletter/letter` PUT 200（文書履歴へ反映）
- オーダー欄: generalOrder で「紹介状」オーダーを保存 → `/api/orca/order/bundles` POST 200（createdDocumentIds 取得）。GET は recordsReturned=0 のため、web-client 側で保存直後の行を表示するフォールバックを追加して文書項目ボタンを表示。
- 文書モーダル: オーダー欄の文書項目クリックでモーダルが開くことを確認。モーダル内の「編集」で更新 `/odletter/letter` PUT 200、 「印刷」で `charts-document-print-dialog` 表示を確認。

## STAMP-001: スタンプ閲覧（StampBox 最小MVP）

目的:
- Charts からスタンプを「ツリー閲覧（treeName分類）/検索/プレビュー」できることを確認する。
- Phase2 では「クリップボードコピー」まで確認する（貼り付けは OrderBundleEditPanel の既存機能を利用）。

Feature flag:
- Phase1: `VITE_STAMPBOX_MVP=1`
- Phase2: `VITE_STAMPBOX_MVP=2`

手順（Phase1）:
1. `VITE_STAMPBOX_MVP=1` で Web クライアントを起動する。
1. Charts を開き、右側ユーティリティで `スタンプ` タブを開く。
1. サーバースタンプが `treeName` 単位でグルーピング表示されることを確認する。
1. 検索（名称/memo）で絞り込めることを確認する。
1. スタンプを選択すると memo/項目がプレビュー表示されることを確認する。

手順（Phase2）:
1. `VITE_STAMPBOX_MVP=2` で Web クライアントを起動する。
1. Phase1 の確認に加え、`クリップボードへコピー` が実行できることを確認する。
1. （任意）患者選択後に `オーダー編集` を開き、OrderBundleEditPanel の `スタンプペースト` でフォームに反映できることを確認する。

証跡:
- RUN_ID=`20260207T065531Z-cmd_20260207_08_sub_1-stamp-001-mvp`
- `artifacts/verification/20260207T065531Z-cmd_20260207_08_sub_1-stamp-001-mvp/stamp-001-mvp/`
  - `vitest-stamp-library-panel.txt`
  - `charts-stamp-library-phase2.png`
  - `charts-stamp-library-preview.png`
  - `network-stamp-endpoints.json`
- 証跡: `artifacts/webclient/document-modal/20260205T215908Z-document-modal/`（`document-modal.png`, `document-edit.png`, `document-print-preview.png`, `odletter-network.jsonl`, `steps.txt`）
- /api/orca/order/bundles GET 空（recordsReturned=0）対策（RUN_ID=`20260206T090300Z-orca-order-bundles-empty-fix`）:
  - server-modernized の `OrcaOrderBundleResource#decodeBundle` で `module.getModel()` と `ModelUtils.decodeModule()` を優先し、`beanJson` のみでも Bundle を復元できるように修正。
  - 期待: 文書/オーダー作成直後でも `/api/orca/order/bundles` が Bundle 件数を返す。
  - 再検証: ModuleJsonConverter 修正反映後の RUN_ID=`20260205T235615Z-orca-order-bundles-retest-authfix` で `recordsReturned=10` を確認。
- /api/orca/order/bundles GET 空の再検証（RUN_ID=`20260205T233504Z-orca-order-bundles-empty-recheck`）:
  - 手順: `POST /karte/document` で beanJson-only の BundleDolphin 文書を作成（docPk=9139, module beanBytes=null, beanJson あり）し、`GET /api/orca/order/bundles?patientId=P0002` を実行。
  - 結果: `recordsReturned=0`（bundles 0 件）を確認。
  - 観測: `GET /karte/documents/9139` で beanJson-only が保存されていることは確認済み。
  - 補足: `ModuleJsonConverter` が BundleDolphin の beanJson を Map として復元するため `BundleDolphin` 判定に到達しない可能性がある（要追跡）。
  - 証跡: `artifacts/webclient/orca-order-bundles/20260205T233504Z/`（add_bundle_doc.json, post_response.txt, get_bundles_response.json, get_document_9139.json）。
- /api/orca/order/bundles GET 再検証（ModuleJsonConverter 修正反映後, RUN_ID=`20260205T235615Z-orca-order-bundles-retest-authfix`）:
  - 手順: `POST /karte/document` で beanJson-only の BundleDolphin 文書を作成（docPk=9160）し、`GET /api/orca/order/bundles?patientId=P0002` を実行。
  - 結果: `recordsReturned=10`（新規 Test Order を含む bundles 取得）を確認。
  - 認証: `userName=1.3.6.1.4.1.9414.10.1:dolphindev` / `password=MD5(dolphindev)` / `clientUUID=devclient` / `X-Facility-Id=1.3.6.1.4.1.9414.10.1`
  - 証跡: `artifacts/webclient/orca-order-bundles/20260205T235615Z-orca-order-bundles-retest-authfix/`（add_bundle_doc.json, post_response.txt, get_document_9160.json, get_bundles_response.json, doc_pk.txt）。
- ModuleJsonConverter 型復元の再検証（RUN_ID=`20260205T233749Z-modulejsonconverter-bundledolphin`）:
  - 修正: `ModuleJsonConverter` で `FAIL_ON_UNKNOWN_PROPERTIES=false` と配列型の `@class` prefix 許可を追加。
  - 結果: `ModuleJsonConverter#deserialize` が `BundleDolphin` を復元できることを確認（出力: `open.dolphin.infomodel.BundleDolphin`）。
  - 証跡: `artifacts/webclient/orca-order-bundles/20260205T233749Z/`（bundle.json, modulejsonconverter-decode.txt）。
- /api/orca/order/bundles recordsReturned=0 の原因調査（RUN_ID=`20260205T233701Z-order-bundles-records-zero`, 2026-02-06）:
  - `GET /api/orca/order/bundles?patientId=01415`（entity/from 有無）→ 200 だが `recordsReturned=0`
  - DB: `d_document`(id=9136, karte_id=9058) + `d_module`(id=9137, entity=generalOrder) は存在
  - `d_module.bean_json` は **text 列に OID 文字列(50720)** が入り、`lo_get(50720)` に JSON 本体が格納されている
  - `d_module.beanbytes` は OID(50721) で、`lo_get(50721)` に XML 本体が格納されている
  - `ModuleJsonConverter` は text の JSON / bytea の XML を前提としているため、OID 文字列から payload を復元できず bundles が 0 件になる
  - 恒久対策案: `d_module.beanbytes` を `bytea` 化し OID→bytea へ移行、`bean_json` も OID→JSON text へ移行（または decode 側で OID 解決ロジックを追加）
  - 証跡: `artifacts/verification/20260205T233701Z-order-bundles-records-zero/`（GET 応答 + db-findings.txt）
- /api/orca/order/bundles LO(OID) decode 再検証（RUN_ID=`20260205T235736Z-order-bundles-lo-decode`, 2026-02-06）:
  - `GET /api/orca/order/bundles?patientId=01415`（entity/from 有無）→ 200、`recordsReturned=5`
  - `documentId=9136`/`moduleId=9137`（OID 格納の Test Order）を含む Bundle が取得できることを確認
  - 認証: `doctor1/doctor2025` + `X-Facility-Id=1.3.6.1.4.1.9414.72.103`
  - 証跡: `artifacts/verification/20260205T235736Z-order-bundles-lo-decode/`（GET 応答）
- /api/orca/order/bundles LO(OID) decode 再検証（RUN_ID=`20260206T050757Z-ashigaru8-lo-decode-reverify`, 2026-02-06）:
  - 起動完了報告受領後の再実測。`GET /api/orca/order/bundles?patientId=01415` → 200、`recordsReturned=5` を再確認。
  - 証跡: `artifacts/verification/20260206T050757Z-ashigaru8-lo-decode-reverify/`（GET 応答）
- WEBクライアント経由の /api/orca/order/bundles 回帰再検証（作成/取得/異常系, RUN_ID=`20260206T051606Z-orca-order-bundles-webclient-regression`, 2026-02-06）:
  - 環境: web-client (docker) `http://localhost:5173` → dev proxy → server-modernized (`http://localhost:9080/openDolphin/resources`)
  - 作成: `POST /api/orca/order/bundles` → 200 / `createdDocumentIds=[9175]`
  - 取得: `GET /api/orca/order/bundles?patientId=01415` → 200 / `recordsReturned=6`（>0 を確認）
  - 異常系1: `GET /api/orca/order/bundles`（patientId 欠落）→ 400 `invalid_request` / `field=patientId` / `validationError=true`
  - 異常系2: `POST /api/orca/order/bundles`（operations 欠落）→ 400 `invalid_request` / `field=operations` / `validationError=true`
  - raw 500 は未再現（400 は構造化 JSON を返却）
  - 証跡: `artifacts/verification/20260206T051606Z-orca-order-bundles-webclient-regression/`（request/response/headers/status/summary.json）

## 通し検証：代表オーダー選定（検査/処方）
- **代表オーダー（検査）**: `medicalmodv2` で **Medical_Class=210** + **Perform_Date を翌日**（同日重複を避ける）。  
  - 参照: RUN_ID=`20251122T132337Z`（Medical_Class=210 / Perform_Date=2025-11-23 で Api_Result=00 を確認）。
- **代表オーダー（処方）**: `medicalmodv2` で **Medication_Code=620001402**（警告=M05 だが Api_Result=00）。
  - 参照: RUN_ID=`20251122T132337Z`（Medical_Class=01 + Medication_Code=620001402）。
- **帳票（処方箋）**: `prescriptionv2`（Trial では Api_Result=0001 の可能性があるため、実環境で Data_Id 取得まで確認）。

### 必要マスタ/シード/前提
- **医師/患者**: ORCA Trial は職員コード `0001/0003/0005/0006/0010`（userId: `doctor1/doctor3/doctor5/doctor6/doctor10`）が前提。その他環境では Dr `10000/10001`、Patient `00005` などの seed を想定。
- **保険**: `insuranceCombinationNumber=0001` を前提に送信（不足時は警告/失敗）。
- **診療種別/点数マスタ**: `Medical_Class=210` を扱えるマスタが前提（未整備だと Api_Result 警告/失敗）。
- **処方マスタ**: Medication_Code `620001402` が有効であること。
- **環境**: Trial で Data_Id が返らない場合は本番想定環境（認証環境/ORMaster）で再確認する。

### 実施手順（概要）
1. 受付送信（`/api/orca/visits/mutation`）で受付を作成。
2. Charts で代表オーダー（検査/処方）を入力し、`/api/orca/chart-support/medical-mod-v2` を送信。
3. 送信結果の `Api_Result/Invoice_Number/Data_Id` を確認し記録。
4. 処方箋帳票（`prescriptionv2`）で `Data_Id` が取得できるかを確認。

### 処置オーダー（器材/薬品使用量）送信検証
- 対象画面: Charts > オーダー > 処置（器材/薬品使用量入力）→ ActionBar「ORCA送信」
- RUN_ID=`20260205T215624Z-procedure-order-usage-send` (2026-02-05)
- 結果: 当時は不成立。ORCA送信は `/api/orca/chart-support/medical-mod-v2`（server-modernized 経由）に送るが、リクエストは固定XML（基本診療料のみ）で、処置/器材/薬品の数量・単位が含まれなかった。
- 証跡: `web-client/src/features/charts/orcaClaimApi.ts` の `buildMedicalModV2RequestXml` が Medical_Class=11 / Medication_Code=110000010 の固定送信のみで、オーダー内容を参照していない。
- RUN_ID=`20260205T222536Z-procedure-usage-recheck3` (2026-02-06)
  - 再検証（WEB_CLIENT_MODE=npm / ORCA Trial / server-modernized 経由）
  - 受付送信 `/api/orca/visits/mutation` が HTTP 500（レスポンス空）、Reception 行が生成されず患者未選択。
  - `/api/orca/order/bundles` が HTTP 500（リクエスト: `quantity=2` を含む処置オーダー送信）。
  - ORCA送信ダイアログは表示されるが `/api/orca/chart-support/medical-mod-v2` の request は捕捉できず（request/response none）。
  - 証跡: `artifacts/webclient/e2e/20260205T222536Z-procedure-usage-recheck3/fullflow/`（`network/requests.json`, `network/network.json`, `fullflow-summary.json`, `steps.log`, screenshots）
  - server-modernized 側の原因候補（コード起因で 500 を返しうる箇所）
    - `/api/orca/visits/mutation`: `OrcaVisitResource.mutateVisit` が `wrapperService.mutateVisit` の `RuntimeException` をそのまま再送出するため、`RestOrcaTransport` の `OrcaGatewayException`（設定不備・必須XML欠落・上流ORCA通信失敗）が発生すると JSON ではなく空の 500 になりやすい。`RestOrcaTransport.invokeDetailed` のログ/`ExternalServiceAuditLogger` で traceId=`103bd0e5-b2b7-456f-9daa-2b1b317a7f0b` を確認するのが最短。
    - `/api/orca/order/bundles`: `OrcaOrderBundleResource` で `KarteServiceBean.getKarte` が `NoResultException` や `kartes.get(0)` の `IndexOutOfBoundsException` を投げうる（患者は存在するがカルテが未作成のケース）。このパスは例外ハンドリングがないため 500 になる。patientId=`00005` のカルテ/文書シード欠落が疑わしい。
  - NoResult/IndexOutOfBounds 対応（RUN_ID=20260205T224338Z-orca-order-bundles-nokarte-404, 2026-02-06）:
    - `KarteServiceBean#getKarte`（String/long）でカルテ未作成時に `kartes.get(0)` を行わず null を返すようガードを追加し、例外を 404 (`karte_not_found`) で処理できるよう修正。
    - 検証: DB にカルテ未作成患者 `NO_KARTE_0001` を追加し、認証あり `GET /api/orca/order/bundles?patientId=NO_KARTE_0001` が 404 `karte_not_found` となることを確認（500 再現なし）。
- RUN_ID=`20260205T225548Z-procedure-usage-recheck4` (2026-02-06)
  - 再検証（WEB_CLIENT_MODE=npm / ORCA Trial / server-modernized 経由 / QA_SKIP_SW=1）
  - 受付送信 `/api/orca/visits/mutation` が HTTP 500（レスポンス空、`requestNumber` 正規化で `OrcaGatewayException` 発生ログあり）。
  - `/api/orca/order/bundles` が HTTP 500（GET/POST ともレスポンス空）。POST payload は `generalOrder` のみ（`quantity=1`）、材料マスタ検索が timeout して材料アイテムは付与できず。
  - ORCA送信ダイアログは表示されるが `/api/orca/chart-support/medical-mod-v2` の request は捕捉できず（request/response none）。`/api/orca/medical/outpatient` のみ複数回発火。
  - 証跡: `artifacts/webclient/e2e/20260205T225548Z-procedure-usage-recheck4/fullflow/`（`network/requests.json`, `network/network.json`, `steps.log`, screenshots）
  - 追加ログ確認（2026-02-06）:
    - `steps.log` では **material selection** が `locator.waitFor` の 10s timeout（検索ボタンが可視にならない）で停止。
    - `network/network.json` には `/api/orca/master/material` が **出現しない**（リクエスト自体が発火していない）。
    - したがって「材料マスタ timeout」は **API遅延ではなく UI 要素未表示**に起因する可能性が高い。
  - server-modernized 側の確認（コード静的確認）:
    - `/api/orca/master/material` は `OrcaMasterDao.searchMaterial` の SQLException を `null` で返し、`OrcaMasterResource` が 503 (`MASTER_MATERIAL_UNAVAILABLE`) で返却する。明示的な retry/timeout 制御は実装されていない（DataSource 側に依存）。
    - `/api/orca/order/bundles` は `patientId`/`operations`/`entity` などのバリデーションを 400/404 で返すが、**永続化層の RuntimeException は未捕捉**のため空の 500 になり得る。恒久対策として `OrcaOrderBundleResource` の create/update/delete を try/catch し、`order_bundle_unavailable` などのエラーコードで 4xx/5xx を返す構造化レスポンスを検討。

### 再検証（材料マスタ + /api/orca/order/bundles）
- RUN_ID=`20260205T233500Z-procedure-usage-recheck5` (2026-02-06)（当該RUNは実行せず。後続RUNで代替済み）
  - 目的: `/api/orca/master/material` が実際に発火する条件を再確認し、`/api/orca/order/bundles` が 4xx/構造化エラーで返ることを確認。
  - 確認事項:
    - `/api/orca/master/material?keyword=...` が Network に出現し、成功 or 503 でレスポンス本文があること。
    - `/api/orca/order/bundles` GET/POST の失敗時に `error`/`message` などが返ること（空 500 の回避）。

- RUN_ID=`20260206T052300Z-procedure-usage-recheck5-material-master-2` (2026-02-06)
  - 目的: 材料検索 UI 未表示（検索結果行が出ない）と `/api/orca/master/material` 未発火の再切り分け。
  - 変更（恒久）:
    - `web-client/scripts/qa-fullflow-weborca.mjs` の Network 記録対象に `/api/orca/master/material` を追加（従来は監視対象外で「未発火」と誤判定し得た）。
    - 同スクリプトの材料選択ステップを「検索結果行の可視化」依存から「HTTP 応答 or notice 表示」依存に変更（items=0 / 503 時でも誤って UI 未表示と判定しない）。
    - `web-client/vite.config.ts` を `loadEnv()` 対応し、`.env.local` の `VITE_DEV_PROXY_TARGET` 等が Vite 起動経路に依らず反映されるよう修正（proxy の ECONNREFUSED→空 500 を回避）。
  - 結果:
    - `GET /api/orca/master/material?keyword=ガーゼ` が **発火**し、HTTP 200（`items=[]` / `totalCount=0`）を確認。
    - UI は材料セクションが表示され、結果 0 件のため「該当する材料が見つかりません。」の空表示となる（検索結果行が出ないのは正常）。
    - `/api/orca/order/bundles` も HTTP 200 を確認（Order 保存まで到達）。
  - 証跡: `artifacts/webclient/e2e/20260206T052300Z-procedure-usage-recheck5-material-master-2/fullflow/`（`network/`, `steps.log`, screenshots）

- RUN_ID=`20260206T053729Z-procedure-usage-recheck8` (2026-02-06)
  - 目的: 再ビルド/再起動後の server-modernized で、処置オーダー（材料）を保存し、`/api/orca/chart-support/medical-mod-v2` の **送信XMLに数量/コードが入るか**を再検証。
  - 結果: 当時は阻害。`/api/orca/chart-support/medical-mod-v2` 自体の送信/捕捉には成功したが、処置オーダー由来の `Medical_Information_child` は追加されなかった。
  - 観測（重要）:
    - `POST /api/orca/order/bundles` は `apiResult=00` で `createdDocumentIds` を返すが、直後の `GET /api/orca/order/bundles?patientId=01415&entity=generalOrder` が `recordsReturned=0` / `bundles=[]` を返し、**保存結果が一覧に反映されない**。
    - ORCA送信では `GET /api/orca/order/bundles?patientId=01415&entity=...&from=2026-02-06` が全 entity で `bundles=[]` となり、送信XMLは **基本診療料（Medical_Class=11 / Medication_Code=110000010 / Medication_Number=1）のみ**。
    - `GET /api/orca/master/material?keyword=ガーゼ` は HTTP 200 だが `items=[]`（UI: 「該当する材料が見つかりません。」）。材料コードをUI経由で付与できない。
    - `/api/orca/queue` 応答ヘッダに `x-orca-queue-mode: mock`（`source=mock`）が付与されており、Trial（live）想定と挙動が一致していない可能性がある。
  - 原因切り分け（恒久対応により解消）:
    - `artifacts/.../network/network.json` の `POST /api/orca/order/bundles` の `createdDocumentIds` が `1770356286987` のような **timestamp系の巨大値**で、server-modernized の採番（例: 9xxx）と一致しない。
    - `web-client/src/mocks/handlers/orcaOrderBundles.ts` が **常に recordsReturned=0/bundles=[] を返すMSWハンドラ**になっており、
      `X-DataSource-Transition: server`（request header `x-datasource-transition=server`）でも passthrough せず **MSW が persistence を偽装できていない**のが根因。
  - 恒久対応（2026-02-06）:
    - `web-client/src/mocks/handlers/orcaOrderBundles.ts`:
      `x-datasource-transition=server` の場合は MSW を `passthrough()` し、server-modernized の実APIに到達させる（POST→即GET不整合を解消）。
    - `web-client/src/mocks/handlers/orcaOrderBundles.test.ts`:
      server transition は passthrough / 未指定は mock となることをローカルHTTPサーバで unit test 化。
    - `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleResource.java`:
      Web Client が呼ぶ order entities（`treatmentOrder` 等 + `laboTest`）を許可し、MSW passthrough 時に 400 で落ちないよう拡張。
  - 証跡: `artifacts/webclient/e2e/20260206T053729Z-procedure-usage-recheck8/fullflow/`（`network/network.json` に `POST /api/orca/order/bundles` / `GET /api/orca/order/bundles` / `POST /api/orca/chart-support/medical-mod-v2?class=01` の request XML、`steps.log`, `fullflow-summary.json`, screenshots）

- RUN_ID=`20260206T072728Z-procedure-usage-recheck19` (2026-02-06)
  - 条件: MSW ON (server-handoff) + `x-datasource-transition=server`（passthrough）
  - `POST /api/orca/order/bundles` の payload に `items[code=M001, quantity=2]` を含み、`GET /api/orca/order/bundles?patientId=01415&entity=generalOrder` で当該アイテムが返る（保存→取得の整合を確認）。
  - `POST /api/orca/chart-support/medical-mod-v2?class=01` request XML に `Medication_Code=M001` / `Medication_Number=2` が含まれ、UI 入力（数量=2/コード=M001）と一致（P0 完了条件を達成）。
  - 証跡: `artifacts/webclient/e2e/20260206T072728Z-procedure-usage-recheck19/fullflow/`
  - 補足（恒久対応）:
    - `web-client/src/features/charts/ChartsActionBar.tsx`: generalOrder bundle は classCode を持たないため、medicalmodv2 export 用に `generalOrder` を `Medical_Class=01` へフォールバックし、`OrderBundleItem.code/quantity` を送信XMLへ反映できるようにした。

### /api/orca/order/bundles 空 500 対策（例外マッピング）
- 修正内容（2026-02-06）:
  - `OrcaOrderBundleResource` の create/update/delete で RuntimeException を捕捉し、503 + `order_bundle_unavailable` を返すよう例外マッピングを追加。
  - ログに `patientId`/`karteId`/`documentId`/`operation`/`runId` を出力。
- 再検証 RUN_ID=`20260205T234500Z-order-bundles-exception-map` (2026-02-06)（当該RUNは実行せず。後続RUNで検証済み）
  - 目的: `/api/orca/order/bundles` の失敗時に空 500 が返らず、構造化 JSON が返ることを確認。
- 再検証 RUN_ID=`20260205T233339Z-order-bundles-exception-map-verify` (2026-02-06)（server-modernized 未起動で中断）
  - server-modernized が未起動で疎通できず（curl http://localhost:8080/openDolphin/resources/api/orca/order/bundles → HTTP 000）。
  - 証跡: `artifacts/verification/20260205T233339Z-order-bundles-exception-map-verify/verification-note.txt`
- 再検証 RUN_ID=`20260205T234051Z-order-bundles-exception-map-recheck` (2026-02-05)
  - `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` で server-modernized を起動後に再試行。
  - `POST /openDolphin/resources/api/orca/order/bundles` (patientId=`P0002`, operation=`create`, bundleName=300 chars, items 1件) を送信。
  - 結果: この時点では HTTP 500 (`internal_server_error`, message=`ARJUNA016053: Could not commit transaction.`) だった。
  - X-Trace-Id=`9c2fde8d-a7d0-43ba-bb12-68379550663f`、X-Run-Id=`20260205T234051Z`。
  - server log はリクエスト行のみで、patientId/karteId/documentId/operation/runId を含む構造化ログは未確認。
  - 証跡: `artifacts/verification/20260205T234051Z-order-bundles-exception-map-recheck/`
- 再検証 RUN_ID=`20260206T050757Z-ashigaru8-arjuna016053-reverify` (2026-02-06)
  - 条件: bundleName=300 chars（DB `varchar(255)` 超過）で `ARJUNA016053` を再現。
  - 結果: HTTP 503 (`order_bundle_unavailable`, message=`Failed to mutate order bundle`) を返却し、500→503 の例外マッピングが有効であることを確認。
  - 原因ログ: `ERROR: value too long for type character varying(255)` → `org.hibernate.exception.DataException` → `ARJUNA016053`（traceId=`47fee8da-cda7-40f1-b596-595ad9e3fb9e`）。
  - 証跡: `artifacts/verification/20260206T050757Z-ashigaru8-arjuna016053-reverify/`（response + server-log-excerpt）
- RUN_ID=`20260206T050900Z-orca-order-bundles-get` (2026-02-06)
  - `GET /openDolphin/resources/api/orca/order/bundles?patientId=P0002` を server-modernized に向けて実行。`recordsReturned=10` を返し、moduleId=9158/9161 など `beanbytes` を持たないエントリも含まれていたことから、`decodeBundleFromJson` フォールバックが動作していることを確認（artifacts/verification/20260206T050900Z-cmd_20260206_04_sub_2/get-response-body.json）。
- RUN_ID=`20260206T051000Z-orca-order-bundles-exception-map` (2026-02-06)
  - `d_module` に `name='FORCE_FAILURE'` で INSERT すると例外を投げる一時トリガを導入し、`bundleName=FORCE_FAILURE` の create 操作で `PersistenceException` を誘発。
  - POST の応答は HTTP 503 + `order_bundle_unavailable`（traceId=`2f3892e7-7290-4a32-b58d-27322ce7b5ca`、patientId=`P0002`、karteId=`91012`、runId=`20260206T051000Z-cmd_20260206_04_sub_2-failure`）となり、`buildOrderBundleFailure`→`RestExceptionMapper` で構造化レスポンスが返ることを確認した（artifacts/verification/20260206T050900Z-cmd_20260206_04_sub_2/post-response-body.json）。
  - 恒久対応方針: `order_bundle_unavailable` が今後も発生する場合は該当 traceId/runId を元に DB persistence 層やカルテ/文書の状態を調査し、このトリガ手順を再実行して再検証証跡を取得する。

### 処置オーダー（器材/薬品使用量）送信 - 実装方針案（最小）
1. **データ導線**: `/api/orca/order/bundles` → `server-modernized` の `OrcaOrderBundleResource` → `BundleDolphin` → `ClaimItem` → `OrderBundleItem`。
1. **order→request マッピング**: `OrderBundleItem.code` → `Medication_Code`, `OrderBundleItem.name` → `Medication_Name`, `OrderBundleItem.quantity` → `Medication_Number`。`bundle.classCode`/`className`/`bundleNumber` を `Medical_Class`/`Medical_Class_Name`/`Medical_Class_Number` にマップ。
1. **web-client 実装ポイント**:
1. `web-client/src/features/charts/orcaClaimApi.ts` の `buildMedicalModV2RequestXml` を `Medical_Information_child` + `Medication_info_child` 構造へ変更し、動的配列を受け取れる API に拡張する。
1. `web-client/src/features/charts/ChartsActionBar.tsx` の send 処理で `fetchOrderBundles({ patientId, entity?, from? })` を呼び、処置系エンティティ（`treatmentOrder`, `surgeryOrder`, `injectionOrder`, `otherOrder`, `radiologyOrder`, `physiologyOrder`, `bacteriaOrder`, `baseChargeOrder`, `instractionChargeOrder`, `generalOrder` など）から `Medical_Information` を構築する。
1. **サーバー側提案（任意）**: `server-modernized/src/main/java/open/dolphin/rest/OrcaMedicalApiResource.java` で受信 XML の `Medical_Information` 件数・`Medication_Number` 欠落件数をログ化（過不足確認用）。

### 処置オーダー（器材/薬品使用量）送信 - 実装反映
- 変更点:
  - `buildMedicalModV2RequestXml` を固定XMLから拡張し、`Medical_Information_child` + `Medication_info_child` を動的生成するよう変更。
  - `ChartsActionBar` の ORCA送信時に `/api/orca/order/bundles` を entity + `from=visitDate` で取得し、`bundle.classCode/className/bundleNumber` と `item.code/name/quantity` を XML にマッピング。
- 影響範囲:
  - ORCA送信時に `/api/orca/order/bundles` が追加で発火する（処置系エンティティ分）。
  - medicalmodv2 の送信XMLに、処置オーダー由来の `Medical_Information_child` が追加される。
  - unit は現状送信しない（後述）。
- 再検証手順:
  1. Charts > オーダー > 処置で器材/薬品使用量を入力し保存。
  1. ActionBar の「ORCA送信」を実行し、Network で `/api/orca/order/bundles?patientId=...&entity=...&from=YYYY-MM-DD` の応答を確認。
  1. `/api/orca/chart-support/medical-mod-v2` の request XML に `Medical_Information_child` / `Medication_info_child` が含まれ、`Medication_Code`/`Medication_Number` が処置オーダーの内容に一致することを確認。
  1. RUN_ID=`20260206T000000Z-procedure-order-usage-send-update`（要再計測）

### 処置オーダー送信 - Unit 取り扱いの前提と論点
- 現状実装: `Medication_Number=quantity` のみ送信し、unit は送信しない（仕様未確定のため）。
- `Xml_medicalv2req.Medication_info` には Unit フィールドが定義されていないため、unit は送信しない方針とする（数量のみ送信）。
- 実装案の候補:
1. **数量のみ送信**: `Medication_Number=quantity`、unit は未送信（最も互換性が高いが、unit 情報が失われる）。
1. **数量+単位の結合**: `Medication_Number=quantity+unit`（例: `2本`）で送信し、ORCA の厳格パースに注意。
1. **単位を別タグで送信**: ORCA 仕様で許容される追加タグ（例: `Medication_Unit_Code`）がある場合のみ追加（要仕様確認）。

### 処置オーダー送信 - リスク/注意点
- **ORCA 仕様の差異**: `Medical_Information_child`/`Medication_info_child` 構造に統一しないと ORCA 側で解釈されない可能性。
- **unit 受理不可リスク**: 追加タグが不正扱いされると Api_Result が警告/エラーになりうる。
- **対象バンドルの選定**: `/api/orca/order/bundles` は直近 30 日分の文書を返すため、**対象日・entity でフィルタ**しないと過去オーダーが混入する。

- 実測ログ:
  - RUN_ID=`20260204T052600Z-acceptmodv2-webclient` (2026-02-04)
    - MSW OFF / Vite 5173 → server-modernized → WebORCA Trial
    - `/api/orca/visits/mutation` が HTTP 500 (Session layer failure) で失敗
    - server-modernized ログで ORCA HTTP 405 (`/orca11/acceptmodv2`) を確認
    - 証跡: `artifacts/webclient/e2e/20260204T052600Z-acceptmodv2-webclient/reception-send/`
  - RUN_ID=`20260204T054200Z-acceptmodv2-webclient` (2026-02-04)
    - ORCA_API_PATH_PREFIX=/api 設定後の再検証（MSW OFF / Vite 5173 → server-modernized → WebORCA Trial）
    - `/api/orca/visits/mutation` は HTTP 200 だが Api_Result=30（PUSH通知区分エラー）
    - 405 は解消、次のブロッカーは Acceptance_Push 送信
    - 証跡: `artifacts/webclient/e2e/20260204T054200Z-acceptmodv2-webclient/reception-send/`
  - RUN_ID=`20260204T055600Z-acceptmodv2-webclient` (2026-02-04)
    - Acceptance_Push 抑止後の再検証（MSW OFF / Vite 5173 → server-modernized → WebORCA Trial）
    - `/api/orca/visits/mutation` が HTTP 200 / Api_Result=00（受付登録成功）
    - 受付送信 UI も成功バナー表示
    - 証跡: `artifacts/webclient/e2e/20260204T055600Z-acceptmodv2-webclient/reception-send/`
  - RUN_ID=`20260204T064501Z` (2026-02-04)
    - 通し検証（Reception → Charts → Order → 診療終了 → ORCA送信）を試行（MSW OFF / Vite 5173 → server-modernized → WebORCA Trial）
    - `/api/orca/visits/mutation` は Api_Result=00（患者ID=01417 / physician=10001）
    - ただし `/api/orca/appointments/list` = Api_Result=21 / `/api/orca/visits/list` = Api_Result=13 で一覧が空、Reception 行が生成されず Charts で選択患者の診療科が取得できない
    - `ORCA 送信` は Department_Code 未解決のため発火せず（/api/orca/chart-support/medical-mod-v2 リクエスト未送信）
    - `/api/orca/order/bundles` と `/api/orca/disease/import/{patientId}` は patient_not_found（ローカルDB未登録）
    - `/api/orca/patient/mutation` でローカルDB登録を試行 → StubEndpointExposureFilter により 404（OPENDOLPHIN_STUB_ENDPOINTS_MODE=block）
    - `/api/orca/appointments/mutation` は Api_Result=12（予約時間設定誤り）で予約作成できず
    - 証跡: `artifacts/webclient/e2e/20260204T064501Z/fullflow/`
  - RUN_ID=`20260204T124520Z-order-timeout-msw-off` (2026-02-04)
    - 通し検証（MSW OFF / Vite 5176 → server-modernized → WebORCA Trial）を実行
    - `qa-fullflow-weborca.mjs` 実行が Reception 画面遷移で停止し、`order` ステップに到達できず
    - `steps.log` は `goto reception` のみ（Order 保存の DOM detach 再現できず）
    - 証跡: `artifacts/webclient/e2e/20260204T124520Z-order-timeout-msw-off/fullflow/`
  - RUN_ID=`20260204T125430Z-order-timeout-repro` (2026-02-04)
    - MSW OFF / Vite 5176 で Order 保存のみを再現する最小スクリプトを実行
    - `button[type="submit"]` で保存クリックし DOM detach の TimeoutError は再現せず
    - ただし `/api/orca/order/bundles` と `/api/orca/appointments/list` `/api/orca/visits/list` は HTTP 500（server-modernized 側未整備）
    - 証跡: `artifacts/webclient/order-timeout/20260204T125430Z-order-timeout-repro/`
  - RUN_ID=`20260204T125700Z-order-timeout-repro2` (2026-02-04)
    - 既存フローと同条件で Order 保存の再現を再試行（MSW OFF / Vite 5176）
    - DOM detach の TimeoutError は再現せず（保存クリックは完了）
    - `/api/orca/order/bundles` と `/api/orca/appointments/list` `/api/orca/visits/list` は HTTP 500 を継続
    - 証跡: `artifacts/webclient/order-timeout/20260204T125700Z-order-timeout-repro2/`
  - RUN_ID=`20260204T233300Z-orca-order-bundles-500-triage` (2026-02-04)
    - Vite 5176 で `/api/orca/order/bundles` を確認 → HTTP 500 (bodyなし)
    - Vite ログに `http proxy error: /api/orca/order/bundles` + `ECONNREFUSED` を確認
      - `artifacts/webclient/update-depth/20260204T111053Z-update-depth-scan/vite.log`
    - 直接 `http://localhost:9080/openDolphin/resources/api/orca/order/bundles` へは 404 `patient_not_found` で応答（上流は生存）
    - 結論: Vite 5176 の proxy target が接続拒否（旧設定/8080 を参照している可能性）。Vite を `setup-modernized-env.sh` で再起動し、`VITE_DEV_PROXY_TARGET=http://localhost:9080/openDolphin/resources` を反映する必要あり。
    - 証跡: `artifacts/webclient/orca-order-bundles-500/20260204T233300Z-orca-order-bundles-500-triage/`
  - RUN_ID=`20260204T233600Z-orca-order-bundles-retry` (2026-02-04)
    - `WEB_CLIENT_MODE=npm` で `setup-modernized-env.sh` を再実行し、`VITE_DEV_PROXY_TARGET=http://localhost:9080/openDolphin/resources` を再反映（Vite 5176 再起動）
    - `/api/orca/order/bundles` は HTTP 404 `patient_not_found`（上流に到達、500 は解消）
    - Vite ログに `proxy error: /api/orca/order/bundles` は出力されず
    - 証跡: `artifacts/webclient/orca-order-bundles-500/20260204T233600Z-orca-order-bundles-retry/`
  - RUN_ID=`20260204T233700Z-orca-order-bundles-5175` (2026-02-04)
    - Vite 5175 でも `/api/orca/order/bundles` を確認 → HTTP 404 `patient_not_found`
    - 5175 側も 500/ECONNREFUSED は解消済み
    - 証跡: `artifacts/webclient/orca-order-bundles-500/20260204T233700Z-orca-order-bundles-5175/`
  - RUN_ID=`20260204T234000Z-order-bundles-patient-not-found` (2026-02-04)
    - `/api/orca/order/bundles` の `patient_not_found` を DB で切り分け
    - `d_patient` に patientId=01415 が存在しない（0 rows）
    - `d_karte` は既存 seed のみ（patientId=00001 等）
    - `ops/db/local-baseline/local_synthetic_seed.sql` は facility `1.3.6.1.4.1.9414.72.103` の patientId を `00001` のみ作成
    - 対策案: `01415` 用の patient + karte を seed に追加、または QA_PATIENT_ID を `00001` に切替
    - 証跡: `artifacts/webclient/orca-order-bundles-500/20260204T234000Z-order-bundles-patient-not-found/`
  - RUN_ID=`20260204T234600Z-order-bundles-01415-seeded` (2026-02-04)
    - `ops/db/local-baseline/local_synthetic_seed.sql` に 01415 の patient + karte seed を追加し、DBへ反映
    - `/api/orca/order/bundles?patientId=01415` が HTTP 200（bundles 空、recordsReturned=0）で応答
    - 証跡: `artifacts/webclient/orca-order-bundles-500/20260204T234600Z-order-bundles-01415-seeded/`
  - RUN_ID=`20260205T010800Z-order-bundle-ui-blocked` (2026-02-05)
    - Reception で `受付送信` を実行するが、`/api/orca/appointments/list` と `/api/orca/visits/mutation` が 401 Unauthorized
    - Reception 行が生成されず（rowCount=0）、Charts へ遷移しても患者未選択のため `オーダー編集` が無効
    - UI で `/api/orca/order/bundles` の 200→表示反映の再検証は **認証 401 により停止**
    - 証跡: `artifacts/webclient/order-bundle-save/20260205T010800Z-order-bundle-ui-blocked/`
  - RUN_ID=`20260205T013000Z-orca-401-auth` (2026-02-05)
    - `/api/orca/appointments/list` と `/api/orca/visits/mutation` が 401、`WWW-Authenticate: Basic realm="OpenDolphin"` を返却
    - Vite dev proxy は `ORCA_BASIC_USER/ORCA_BASIC_PASSWORD`（または `ORCA_API_USER/ORCA_API_PASSWORD`）が未設定だと `Authorization` を付与しないため、Basic 認証欠落が原因
    - 対応案: `ORCA_TRIAL_USER/ORCA_TRIAL_PASS` もしくは `ORCA_BASIC_USER/ORCA_BASIC_PASSWORD` を設定して `setup-modernized-env.sh` を再起動し、dev proxy に Basic を付与
    - 証跡: `artifacts/webclient/orca-401/20260205T013000Z-orca-401-auth/`
  - RUN_ID=`20260205T020800Z-orca-401-resolved-body` (2026-02-05)
    - `ORCA_BASIC_USER=doctor1` / `ORCA_BASIC_PASSWORD=doctor2025` を反映して再起動
    - `X-Facility-Id=1.3.6.1.4.1.9414.72.103` 付きで `/api/orca/appointments/list` / `/api/orca/visits/mutation` を POST → 401 は消失（400: body不足）
    - 401 は **dev proxy の Basic ヘッダ未設定が原因**であり、app ユーザー（doctor1）で解消
    - 証跡: `artifacts/webclient/orca-401/20260205T020800Z-orca-401-resolved-body/`
  - RUN_ID=`20260205T021500Z-orca-400fix` (2026-02-05)
    - `Content-Type: application/json` と必須フィールドを含む body を送ると 200 を確認
    - `/api/orca/appointments/list` 必須: `appointmentDate`（または `fromDate/toDate`）
    - `/api/orca/visits/mutation` 必須: `requestNumber` / `patientId` / `acceptanceDate` / `acceptanceTime`
    - `X-Facility-Id` を付与し、dev proxy 経由で Basic が付与される前提
    - 証跡: `artifacts/webclient/orca-401/20260205T021500Z-orca-400fix/`
  - RUN_ID=`20260205T023500Z-ui-accept-200` (2026-02-05)
    - UI（Reception 受付送信）経由で `/api/orca/appointments/list` と `/api/orca/visits/mutation` が 200 を確認
    - dev auth（doctor1/doctor2025 + X-Facility-Id）反映後の UI 送信で 400/415 は再現せず
    - 証跡: `artifacts/webclient/orca-401/20260205T023500Z-ui-accept-200/`
  - RUN_ID=`20260205T031500Z-orca-send-stability-a` (2026-02-05)
    - ORCA送信ダイアログ/会計ボタン安定性の複数回検証（QA_SKIP_SW=1 で実行）
    - Reception 行が not-found となり、Charts 側で患者未選択 → ORCA送信ダイアログは表示されず（ガード: patient_not_selected）
    - 会計ボタンはクリックで Reception 遷移を確認
    - 証跡: `artifacts/webclient/e2e/20260205T031500Z-orca-send-stability-a/fullflow/`
  - RUN_ID=`20260205T062000Z-orca-send-stability-b` (2026-02-05)
    - 再実行でも Reception 行が not-found、ORCA送信は同様にガードで未表示
    - 会計ボタン遷移は再現
    - 証跡: `artifacts/webclient/e2e/20260205T062000Z-orca-send-stability-b/fullflow/`
  - RUN_ID=`20260205T090119Z-claim404-mswoff` (2026-02-05)
    - MSW OFF / Vite 5173 → server-modernized → WebORCA Trial
    - `qa-claim-deprecation.mjs` で Reception/Charts を巡回し、`/orca/claim/outpatient` は検知されず（CLAIM 404 再現なし）
    - `/api/orca/queue` `/api/orca/deptinfo` `/api/orca/medical/outpatient` は 200、`/api/orca/appointments/list` `/api/orca/visits/list` は HTTP 500
    - 証跡: `artifacts/webclient/claim-deprecation/20260205T090119Z-claim404-mswoff/`
  - RUN_ID=`20260205T071500Z-accept-body-ui` (2026-02-05)
    - acceptmodv2 相当の payload（patientId/department/physician/insurance 付与）でも apiResult=15
    - `診療内容情報が存在しません` が返り、受付情報が ORCA 側に生成されない
    - 証跡: `artifacts/webclient/orca-401/20260205T071500Z-accept-body-ui/`
  - RUN_ID=`20260205T070000Z-orca-visits-list` (2026-02-05)
    - `/api/orca/visits/list` が apiResult=13（対象なし）、visits 空のため Reception 行が生成されない
    - 証跡: `artifacts/webclient/orca-401/20260205T070000Z-orca-visits-list/`
  - RUN_ID=`20260205T071019Z` (2026-02-05)
    - MSW OFF / Vite 5173 → server-modernized → WebORCA Trial で Reception 実測
    - `/api/orca/appointments/list` 200 / `/api/orca/visits/list` 200 / `/api/orca/visits/mutation` 200 / `/api/orca/queue` 200
    - `/orca/claim/outpatient` 不発、Reception の CLAIM 文言 0 件
    - 受付送信は Api_Result=14（ドクター不存在）
    - 証跡: `artifacts/webclient/e2e/20260205T071019Z/reception-msw-off/`
  - RUN_ID=`20260205T070641Z-msw-on-reception-charts` (2026-02-05)
    - MSW ON / Vite 4173（`msw=1` / cache-hit）で Reception→Charts を実測
    - `/orca/claim/outpatient` は不発、CLAIM 文言なし
    - `/api/orca/appointments/list/mock`・`/api/orca/visits/list/mock` が 200
    - `/api/orca/medical/outpatient` が 200
    - 401/404 なし（console: font CORS preflight, `Maximum update depth exceeded` 警告）
    - 証跡: `artifacts/webclient/e2e/20260205T070641Z/msw-on/`
  - RUN_ID=`20260205T101740Z` (2026-02-05)
    - UI 受付送信（MSW OFF / Vite 5173 → server-modernized → WebORCA Trial）
    - 条件: patientId=01414 / physicianCode=10001 / insurance=0001
    - `/api/orca/visits/mutation` 200 だが Api_Result=16（診療科・保険組合せで受付登録済み）
    - `/api/orca/queue` 200
    - 証跡: `artifacts/webclient/e2e/20260205T101740Z/reception-send/`
  - RUN_ID=`20260206T123144Z-orca-queue-live` (2026-02-06)
    - MSW OFF / Vite 5176 → server-modernized で `/api/orca/queue` が 200（x-orca-queue-mode=live）
    - Administration 画面で ORCA queue 表示が `live` で反映されることを確認
    - 証跡: `artifacts/webclient/e2e/20260206T123144Z-orca-queue-live/admin-orca-queue/`（har/screenshots/logs/requests.json）
  - RUN_ID=`20260205T101957Z` (2026-02-05)
    - 直叩きで acceptmodv2 成功を再確認（server-modernized 経由 / Vite 5173）
    - 条件: patientId=01414 / physicianCode=10001 / insurance=0001 / acceptanceDate=2026-02-06
    - `/api/orca/visits/mutation` 200 / Api_Result=00
    - 証跡: `artifacts/webclient/e2e/20260205T101957Z-direct-acceptmodv2/`
  - RUN_ID=`20260205T114759Z-acceptmodv2-reverify` (2026-02-05)
    - 二重 /api 修正後の設定で再検証（ORCA_BASE_URL=https://weborca-trial.orca.med.or.jp / ORCA_API_PATH_PREFIX=/api）
    - 条件: patientId=01414 / physicianCode=10001 / insurance=0001 / acceptanceDate=2026-02-06
    - `/api/orca/visits/mutation` 200 だが Api_Result=16（診療科・保険組合せで受付登録済み）
    - 既に 2026-02-06 受付が存在する可能性があるため、**受付取消 or 別日での再検証が必要**
    - 証跡: `artifacts/webclient/e2e/20260205T114759Z-direct-acceptmodv2/`
  - RUN_ID=`20260205T085918Z-accept-guest-0001` (2026-02-05)
    - ORCA Trial 職員コード（0001/0003/0005/0006/0010）で Reception 受付送信を再実行
    - Api_Result=14（ドクターが存在しません）: 0001/0010
    - Api_Result=13（診療科が存在しません）: 0003/0005/0006（dept=13/07/05）
    - UI 選択肢は dept=01 / physician=0001 のみ（他コードは DOM へ注入して送信）
    - 証跡: `artifacts/webclient/e2e/20260205T085918Z-accept-guest-0001/reception-send/` ほか同系列（`20260205T085923Z-accept-doctor3-0003` / `20260205T085928Z-accept-doctor5-0005` / `20260205T085933Z-accept-doctor6-0006` / `20260205T085938Z-accept-doctor10-0010`）
  - RUN_ID=`20260205T090121Z-accept-doctor1-10001` (2026-02-05)
    - system01lstv2 Code（10001/10003/10005/10006/10010）＋ dept=01/02/11/10/26 で再試行
    - ORCA Trial が `/orca11/acceptmodv2` と `/api01rv2/{visitptlstv2,appointlstv2}` で HTTP 502 を返却
    - server-modernized は Session layer failure（Api_Result 未取得）
    - 証跡: `artifacts/webclient/e2e/20260205T090121Z-accept-doctor1-10001/reception-send/` ほか同系列（`20260205T090129Z-accept-doctor3-10003` / `20260205T090138Z-accept-doctor5-10005` / `20260205T090146Z-accept-doctor6-10006` / `20260205T090155Z-accept-doctor10-10010`）
  - RUN_ID=`20260205T095826Z-accept-doctor1-0001` (2026-02-05)
    - ORCA Trial 登録済み医師コード（0001/0003/0005/0006/0010）＋ dept=01/02/11/10/26 で再検証
    - `/api/orca/visits/mutation` は 500（Session layer failure）、ORCA Trial が `/orca11/acceptmodv2` と `/api01rv2/{visitptlstv2,appointlstv2}` で HTTP 502
    - Api_Result は取得できず（UI では Api_Result: — 表示）
    - 証跡: `artifacts/webclient/e2e/20260205T095826Z-accept-doctor1-0001/reception-send/` ほか同系列（`20260205T095836Z-accept-doctor3-0003` / `20260205T095845Z-accept-doctor5-0005` / `20260205T095853Z-accept-doctor6-0006` / `20260205T095902Z-accept-doctor10-0010`）
  - RUN_ID=`20260205T070802Z` (2026-02-05)
    - MSW OFF / Vite 5173 → server-modernized → WebORCA Trial（QA_SKIP_SW=1 / QA_PATIENT_ID=00001）
    - `/api/orca/visits/mutation` は HTTP 200 だが Api_Result=90（他端末使用中）で受付行が生成されず
    - 原因: ORCA acceptmodv2 仕様の「該当患者の排他チェック（他端末で展開中の有無）」に該当（acceptmod.md 手順3 / Api_Result=90）
    - 回避: 受付対象の患者を変更 or 時間を空けて再試行 / ORCA UI 側で該当患者のセッションを終了（Trial は共有環境のためロック発生が不定）
    - `/api/orca/appointments/list` Api_Result=21 / `/api/orca/visits/list` Api_Result=13（recordsReturned=0）
    - `/api/orca/medical/outpatient` が 200（recordsReturned=1, patientId=01415）
    - ORCA送信ダイアログは表示されるが送信リクエスト未捕捉（guardSummary: 患者未選択）
    - `/orca/claim/outpatient` 不発、401/404 なし（/api/orca/order/bundles と /api/orca/disease/import は 404）
    - 証跡: `artifacts/webclient/e2e/20260205T070802Z/fullflow/`（summary/network/har/screenshots）
  - RUN_ID=`20260205T085849Z-api-result-90` (2026-02-05)
    - MSW OFF / server-modernized → WebORCA Trial を curl で再検証（patientId=00001/00002, physicianCode=0001）
    - `/api/orca/visits/mutation` は Api_Result=14（ドクター不存在）になり、Api_Result=90 は再現せず
    - 回避: ORCA Trial で有効な医師コード（例: 10001）へ変更して再試行
    - 90 の再現は Trial 共有環境の同一患者ロック発生タイミング依存と判断
    - 証跡: `artifacts/verification/20260205T085849Z-api-result-90/api-result-90/`
  - RUN_ID=`20260205T085937Z-api-result-90b` (2026-02-05)
    - MSW OFF / server-modernized → WebORCA Trial を curl で再検証（patientId=00001, physicianCode=10001, insuranceCombination=0001）
    - `/api/orca/visits/mutation` は Api_Result=24（保険組合せ番号がありません）
    - 受付行生成の前提として「患者ごとの保険組合せ番号が Trial 側に存在すること」が必要
    - 回避: 保険組合せが登録済みの患者へ変更、または ORCA 側で保険組合せを登録して再試行
    - 証跡: `artifacts/verification/20260205T085937Z-api-result-90b/api-result-90/`
  - RUN_ID=`20260205T100055Z-acceptmodv2-direct` (2026-02-05)
    - ORCA Trial へ acceptmodv2 を直叩き（XML + Basic）で実測
    - `https://weborca-trial.orca.med.or.jp/api/orca11/acceptmodv2?class=01`
    - Patient_ID=01414 / Physician_Code=10001 / Insurance_Combination=0001 → Api_Result=00（受付登録終了）
    - 証跡: `artifacts/verification/20260205T100055Z-acceptmodv2-direct/acceptmodv2-direct/`
  - RUN_ID=`20260205T100136Z-acceptmodv2-direct-doctor3` (2026-02-05)
    - Patient_ID=01414 / Physician_Code=0003 → Api_Result=14（ドクターが存在しません）
    - Trial 登録済み医師（10001）以外は 14 になりやすい
    - 証跡: `artifacts/verification/20260205T100136Z-acceptmodv2-direct-doctor3/acceptmodv2-direct/`
  - RUN_ID=`20260205T105842Z-acceptmodv2-proxy` (2026-02-05)
    - server-modernized 経由で `/api/orca/visits/mutation` を再実行
    - ORCA_HTTP_LOG_MODE=detail / ORCA_BASE_URL=https://weborca-trial.orca.med.or.jp/api / ORCA_API_PATH_PREFIX=/api を明示
    - patientId=01414 / physician=10001 / insurance=0001 / acceptanceDate=2026-02-06
    - 結果: HTTP 500（Session layer failure）
    - server-modernized ログで ORCA upstream 502 を確認（/orca11/acceptmodv2 を 4 回リトライ → 502）
    - 証跡: `artifacts/verification/20260205T105842Z-acceptmodv2-proxy/acceptmodv2-proxy/`
  - RUN_ID=`20260205T110330Z-acceptmodv2-doubleapi` (2026-02-05)
    - ORCA Trial へ `https://weborca-trial.orca.med.or.jp/api/orca11/acceptmodv2`（/api を二重付与）で直叩き
    - HTTP 502 を再現（proxy 失敗と同じステータス）
    - 502 の原因が「ORCA_BASE_URL に /api を含めた状態で ORCA_API_PATH_PREFIX=/api を追加」した二重 prefix である可能性を補強
    - 証跡: `artifacts/verification/20260205T110330Z-acceptmodv2-doubleapi/acceptmodv2-doubleapi/`
  - RUN_ID=`20260205T112403Z-502-doubleapi-lists` (2026-02-05)
    - ORCA Trial へ `https://weborca-trial.orca.med.or.jp/api/api01rv2/{visitptlstv2,appointlstv2}`（/api 二重付与）を直叩き
    - 両方とも HTTP 200 / Api_Result=91（処理区分未設定）で 502 は再現せず
    - 502 は「/api 二重付与」だけでは再現しない可能性が高く、Trial 側の一時障害 or server-modernized 経由の差分要因を疑う
    - 証跡: `artifacts/verification/20260205T112403Z-502-doubleapi-lists/orca-502-direct/`
  - FIX=`double-api-prefix-guard` (2026-02-05)
    - setup-modernized-env.sh: ORCA_BASE_URL に `/api` を含む場合、ORCA_API_PATH_PREFIX を `off` に強制して二重付与を回避
    - server-modernized: baseUrl に `/api` が含まれる場合は `/api` を二重付与しないガードを追加
    - 影響: `ORCA_BASE_URL=https://.../api` + `ORCA_API_PATH_PREFIX=/api` の組合せでも `/api` は 1 回のみ
    - 証跡: `setup-modernized-env.sh`, `server-modernized/src/main/java/open/dolphin/orca/transport/OrcaTransportSettings.java`
  - RUN_ID=`20260205T110841Z-accept-00001-11-0005` (2026-02-05)
    - ORCA Trial 初期患者 00001〜00011 の保険組み合わせ（国保/社保/後期高齢者/生活保護/自賠責/労災/自費）で受付送信を再検証
    - 医師コード 0001/0003/0005/0006/0010 を診療科に合わせて選択（内科/精神科/整形外科/外科/眼科）
    - `/api/orca/visits/mutation` は 500（Session layer failure）、ORCA Trial が `/orca11/acceptmodv2` と `/api01rv2/{visitptlstv2,appointlstv2}` で HTTP 502
    - Api_Result は取得できず（UI では Api_Result: — 表示）
    - 証跡: `artifacts/webclient/e2e/20260205T110841Z-accept-00001-11-0005/reception-send/` ほか同系列（`20260205T110841Z-accept-00002-01-0001` / `20260205T110841Z-accept-00003-01-0001` / `20260205T110841Z-accept-00004-01-0001` / `20260205T110841Z-accept-00005-11-0005` / `20260205T110841Z-accept-00006-01-0001` / `20260205T110841Z-accept-00007-02-0003` / `20260205T110841Z-accept-00007-26-0010` / `20260205T110841Z-accept-00008-11-0005` / `20260205T110841Z-accept-00009-11-0005` / `20260205T110841Z-accept-00010-10-0006` / `20260205T110841Z-accept-00011-01-0001`）
    - server-modernized ログ: `artifacts/webclient/e2e/20260205T110841Z-accept-trial-physicians/server-log-snippet.txt`（traceId 一覧: `artifacts/webclient/e2e/20260205T110841Z-accept-trial-physicians/trace-ids.tsv`）
  - RUN_ID=`20260205T102404Z-orca-502-triage` (2026-02-05)
    - server-modernized ログで `/orca11/acceptmodv2`・`/api01rv2/{visitptlstv2,appointlstv2}` が HTTP 502 → Session layer failure を確認
    - ORCA Trial 直叩き（Basic: trial/weborcatrial）では同一エンドポイントが HTTP 200（Api_Result=12/13）で応答
    - 502 は ORCA Trial 側の不可ではなく、server-modernized 経由のリクエスト差分が原因の可能性が高い
    - 証跡: `artifacts/verification/20260205T102404Z-orca-502-triage/`
  - 再検証まとめ（証跡レビュー, 2026-02-06）
    - Api_Result=14: 職員コード 0001/0010 を送ると `apiResult=14` を確認（`20260205T085849Z-api-result-90` / `20260205T085918Z-accept-guest-0001`）
    - Api_Result=24: physicianCode=10001 でも保険組合せ番号未取得だと `apiResult=24`（`20260205T085937Z-api-result-90b`）
    - Api_Result=90: Trial 共有ロック条件で `Api_Result=90` を再現（`20260205T070802Z`）
    - 直叩き vs server-modernized 差分:
      - 直叩き（ORCA Trial へ XML/BASIC）: `/orca11/acceptmodv2` は `Api_Result=00` で成功（`20260205T100055Z-acceptmodv2-direct`）
      - server-modernized 経由: `/api/orca/visits/mutation` が 500（Session layer failure）、上流 `/orca11/acceptmodv2` は HTTP 502（`20260205T105842Z-acceptmodv2-proxy`）
      - 直叩きで `/api/orca11/acceptmodv2`（二重 prefix）を送ると HTTP 502 を再現（`20260205T110330Z-acceptmodv2-doubleapi`）
    - 証跡: `artifacts/verification/20260205T085849Z-api-result-90/`, `artifacts/verification/20260205T085937Z-api-result-90b/`, `artifacts/webclient/e2e/20260205T070802Z/fullflow/`, `artifacts/verification/20260205T100055Z-acceptmodv2-direct/`, `artifacts/verification/20260205T105842Z-acceptmodv2-proxy/`, `artifacts/verification/20260205T110330Z-acceptmodv2-doubleapi/`
  - RUN_ID=`20260206T045324Z-api-result-retest` (2026-02-06)
    - 直叩き（ORCA Trial 直送, acceptmodv2）:
      - patientId=01414 / insurance=0001 / physician=10001 → Api_Result=16（重複）
      - physician=0001 → Api_Result=14（ドクター不存在）
      - insurance=9999 → Api_Result=24（保険組合せ番号なし）
      - physician=10003/10005/10006/10010 → Api_Result=16（重複）
    - server-modernized（/api/orca/visits/mutation, userName/password ヘッダ）:
      - patientId=01414 / insurance=0001 / physician=10001 → Api_Result=16
      - physician=0001 → Api_Result=14
      - insurance=9999 → Api_Result=24
      - patientId=00001 / insurance=0005 / physician=10001 → Api_Result=00
      - physician=10003/10005/10006/10010 → Api_Result=16
    - web-client 経由（Vite dev server 5173, /api/orca/visits/mutation）:
      - `VITE_DEV_PROXY_TARGET=http://localhost:9080` / `VITE_ORCA_API_PATH_PREFIX=off` で起動したが、HTTP 404（HTML）を返却し Api_Result 未取得（proxy 404 の疑い）
    - Api_Result=90/502 は本 RUN では再現せず
    - 証跡: `artifacts/verification/20260206T045324Z-api-result-retest/`
  - FIX=`vite-dev-proxy-resource-prefix-weborca` (2026-02-06)
    - web-client の `vite.config.ts` で、`VITE_DEV_PROXY_TARGET=http://localhost:9080` のように target が origin の場合でも、
      WebORCA mode (`VITE_ORCA_MODE=weborca`) で `/orca/*` や `/orca21/*` 等が `/openDolphin/resources/*` へ rewrite されるよう修正。
    - これにより `VITE_DEV_PROXY_TARGET` に `/openDolphin/resources` を含めない設定でも Vite dev proxy 経由で 404(HTML) を回避できる。
    - 対象: `web-client/vite.config.ts`
  - RUN_ID=`20260206T052731Z-vite-proxy-target-root-fix` (2026-02-06)
    - web-client 経由（Vite dev server 5173, /api/orca/visits/mutation）:
      - 起動: `VITE_DEV_PROXY_TARGET=http://localhost:9080` / `VITE_ORCA_MODE=weborca` / `VITE_ORCA_API_PATH_PREFIX=off`
      - `POST /api/orca/visits/mutation` が HTTP 200 / JSON で応答し、Api_Result を取得できることを確認（Api_Result=16: 二重登録疑い）
    - 証跡: `artifacts/verification/20260206T052731Z-vite-proxy-target-root-fix/vite-proxy-orca-visits-mutation.txt`
  - RUN_ID=`20260204T133500Z` (2026-02-04)
    - 通し検証（Reception → Charts → Order → 診療終了 → ORCA送信）再実行（MSW OFF / Vite 5175 → server-modernized → WebORCA Trial）
    - ORCA送信ダイアログ表示を確認し、送信トーストで `Api_Result=00` / `Invoice_Number=INV-000001` / `Data_Id=DATA-000001` を表示
    - `/api/orca/chart-support/medical-mod-v2` が 200 で複数回応答（Networkログで確認）
    - 受付送信は完了バナー表示だが Reception 行は `not-found`
    - オーダーパネルは DOM detach により `order` ステップが TimeoutError（保存ボタンの再描画）
    - 証跡: `artifacts/webclient/e2e/20260204T133500Z/fullflow/`（summary/network/screenshots/steps.log）
  - RUN_ID=`20260204T140500Z` (2026-02-04)
    - missing_master 解消後の通し検証（MSW OFF / Vite 5175 → server-modernized → WebORCA Trial）
    - `QA_PATIENT_ID=01415` を指定すると Reception 行が `found` になり、`/api/orca/order/bundles` は 200 で保存成功
    - 診療終了トーストは表示されるが、ORCA送信ダイアログは表示されず、/api21 発火も未捕捉（send request none）
    - `会計へ` ボタンは DOM が安定せずクリックがタイムアウト
    - 証跡: `artifacts/webclient/e2e/20260204T140500Z/fullflow/`（summary/network/screenshots/steps.log）
  - RUN_ID=`20260204T145002Z` (2026-02-04)
    - URL 同期の安定化（search 正規化）後の通し検証（MSW OFF / Vite 5175 → server-modernized）
    - ORCA送信ダイアログが表示され、`Api_Result=00`/`Invoice_Number=INV-000001`/`Data_Id=DATA-000001` を含む送信完了トーストを確認
    - `会計へ` ボタンが Reception 画面へ遷移（`/reception?sort=time&date=2026-02-04`）
    - Console error は 5 件残（`Maximum update depth exceeded` の警告）
    - 証跡: `artifacts/webclient/e2e/20260204T145002Z/fullflow/`（summary/network/screenshots/steps.log）
  - RUN_ID=`20260204T153900Z-update-depth-fix5` (2026-02-04)
    - `useChartsTabLock.refreshFromStorage` の state 更新を差分比較して抑制（BroadcastChannel 連鎖での再描画ループを抑止）
    - `Maximum update depth exceeded` の警告は再現せず（0 件）
    - `chart-events` の 500 は継続（既知）
    - 証跡: `artifacts/webclient/update-depth/20260204T153900Z-update-depth-fix5/`（console.json/screen.png）
  - RUN_ID=`20260204T211536Z` (2026-02-04)
    - MSW OFF / flagged-mock OFF / Vite 5173 → server-modernized → WebORCA Trial
    - 受付送信 `/api/orca/visits/mutation` は HTTP 200 だが Api_Result=16（診療科・保険組合せで受付登録済み / 二重登録疑い）
    - `/api/orca/appointments/list` Api_Result=21（予約なし）、`/api/orca/visits/list` も患者ID空のレコードで Reception 行が生成されず（reception row not-found）
    - Charts: `ORCA 送信` は `patient_not_selected` でガード、/api21 未発火、診療終了は outcome=MISSING
    - 切り分け: Api_Result=16 は「同一受付日で同一診療科・保険組合せが既登録」の重複判定。受付取消（Request_Number=02）か、別患者/別診療科/別保険組合せで再試行が必要。
    - 証跡: `artifacts/webclient/e2e/20260204T211536Z/fullflow/`
  - RUN_ID=`20260204T212400Z` (2026-02-04)
    - QA_PATIENT_ID=00001 / physician=0001 で再試行
    - `/api/orca/visits/mutation` が HTTP 500 (Session layer failure)
    - 切り分け: server-modernized ログで `/orca11/acceptmodv2` が HTTP 405（Trial で /api prefix 未付与）→ Session layer failure。`ORCA_API_PATH_PREFIX=/api` または `ORCA_BASE_URL=https://weborca-trial.orca.med.or.jp/api` を設定して再起動が必要。
    - Reception 行が生成されず、ORCA送信は `patient_not_selected`
    - 証跡: `artifacts/webclient/e2e/20260204T212400Z/fullflow/`
  - RUN_ID=`20260204T213722Z` (2026-02-04)
    - ORCA_API_PATH_PREFIX=/api を反映して再試行（MSW OFF / flagged-mock OFF / Vite 5173 → server-modernized）
    - `/api/orca/visits/mutation` は HTTP 200（405/500 は解消）だが Api_Result=30（PUSH通知区分エラー）が継続
    - Api_Result=16（二重登録疑い）は発生せず（重複受付回避できた）
    - Reception 行 not-found、Charts ORCA送信は dialog 表示だが /api21 は未捕捉（outcome=MISSING）
    - 切り分け:
      - Api_Result=30: `acceptancePush=1` を送信しており、WebORCA Trial では PUSH通知区分が不正。`VITE_SUPPRESS_ACCEPTANCE_PUSH=1` 等で抑止が必要。
      - Api_Result=15: `sendDirectAcceptMinimal()` が `medicalInformation='外来受付'` を送信 → ORCA 側「診療内容情報が存在しません」。正しいコード値（例: `01`）へ変換 or 直送信を無効化。
      - Api_Result=03: `handleAcceptSubmit` の direct fetch (`directBody`) が `physicianCode` を含まないためドクター未設定。directBody に `physicianCode` を追加 or 直送信を無効化。
    - 証跡: `artifacts/webclient/e2e/20260204T213722Z/fullflow/`
  - RUN_ID=`20260204T215604Z` (2026-02-04)
    - Api_Result=30/15/03 の恒久修正後に再試行（VITE_SUPPRESS_ACCEPTANCE_PUSH=1）
    - `/api/orca/visits/mutation` は Api_Result=00（受付登録完了）を確認
    - ただし Reception 行 not-found のため Charts で患者未確定 → /api21 未発火（outcome=MISSING）
    - 証跡: `artifacts/webclient/e2e/20260204T215604Z/fullflow/`
  - RUN_ID=`20260204T220450Z` (2026-02-04)
    - local DB に patientId=00005 を seed 追加後の再試行
    - `/api/orca/visits/mutation` は Api_Result=16（二重登録疑い）に戻る（当日受付済み）
    - ORCA送信は `approval_locked` で /api21 未発火
    - 証跡: `artifacts/webclient/e2e/20260204T220450Z/fullflow/`
  - RUN_ID=`20260204T224200Z-accept-row-fix4` (2026-02-04)
    - QA_SKIP_SW=1 / QA_PATIENT_ID=00005
    - `/api/orca/visits/mutation` が HTTP 500（text/plain, body empty）で受付失敗 → Reception row not-found 継続
    - Charts ORCA送信後も `approval_locked` にはならず（dataDisabledReason=null を確認）
    - 証跡: `artifacts/webclient/e2e/20260204T224200Z-accept-row-fix4/fullflow/`
  - RUN_ID=`20260204T224700Z-accept-row-fix5` (2026-02-04)
    - QA_SKIP_SW=1 / QA_PATIENT_ID=01415
    - `/api/orca/visits/mutation` が HTTP 500（text/plain, body empty）で受付失敗 → Reception row not-found 継続
    - Charts ORCA送信後も `approval_locked` にはならず（dataDisabledReason=null を確認）
    - 証跡: `artifacts/webclient/e2e/20260204T224700Z-accept-row-fix5/fullflow/`
  - RUN_ID=`20260204T234800Z-fullflow-01417` (2026-02-04)
    - Vite proxy を `VITE_DEV_PROXY_TARGET=http://localhost:9080/openDolphin/resources` で再起動（proxy 500 を解消）
    - QA_SKIP_SW=1 / QA_PATIENT_ID=01417
    - `/api/orca/visits/mutation` Api_Result=00 → Reception row found を確認
    - `/api/orca/medical/outpatient` HTTP 200 を確認（/api21 発火）
    - 証跡: `artifacts/webclient/e2e/20260204T234800Z-fullflow-01417/fullflow/`
  - RUN_ID=`20260204T235200Z-fullflow-01418` (2026-02-04)
    - QA_SKIP_SW=1 / QA_PATIENT_ID=01418
    - `/api/orca/visits/mutation` Api_Result=00 → Reception row found を確認
    - `/api/orca/medical/outpatient` HTTP 200 を確認（/api21 発火）
    - 証跡: `artifacts/webclient/e2e/20260204T235200Z-fullflow-01418/fullflow/`
  - RUN_ID=`20260204T235700Z-fullflow-01417-dept02` (2026-02-04)
    - QA_SKIP_SW=1 / QA_PATIENT_ID=01417 / QA_DEPARTMENT_CODE=02
    - `/api/orca/visits/mutation` Api_Result=00 → Reception row found を確認
    - `/api/orca/medical/outpatient` HTTP 200 を確認（/api21 発火）
    - 証跡: `artifacts/webclient/e2e/20260204T235700Z-fullflow-01417-dept02/fullflow/`
  - RUN_ID=`20260205T055951Z-orca-trial-dummy` (2026-02-05)
    - ORCA Trial: `patientmodv2` でダミー患者登録を試行（保険あり）
    - Api_Result=H1（保険者番号検証エラー）で失敗、最小登録に切替
    - Api_Result=00 / Patient_ID=01448 を採番（保険なし）
    - 証跡: `artifacts/orca-preprod/20260205T055951Z-orca-trial-dummy/`
  - RUN_ID=`20260205T060500Z-orca-trial-dummy2` (2026-02-05)
    - ORCA Trial: `patientmodv2` alt で保険付きダミー患者登録
    - Api_Result=00 / Patient_ID=01449 を採番
    - 証跡: `artifacts/orca-preprod/20260205T060500Z-orca-trial-dummy2/`
  - RUN_ID=`20260205T061000Z-fullflow-01449` (2026-02-05)
    - QA_SKIP_SW=1 / QA_PATIENT_ID=01449（Trial で登録した保険付きダミー患者）
    - `/api/orca/visits/mutation` Api_Result=00 → Reception row found を確認
    - `/api/orca/medical/outpatient` HTTP 200 を確認（/api21 発火）
    - 証跡: `artifacts/webclient/e2e/20260205T061000Z-fullflow-01449/fullflow/`

## 薬剤/処置マスタ検索の原因切り分け
### 対象 API
- `GET /api/orca/master/generic-class`（薬効分類）
- `GET /api/orca/master/youhou`（用法）
- `GET /api/orca/master/material`（特定器材）
- `GET /api/orca/master/kensa-sort`（検査分類）
- `GET /api/orca/master/etensu`（点数/部位、旧 `/api/api/orca/tensu/etensu` は alias）
- `GET /api/orca/master/*`（/api 付き alias）

### 実測（外部ブロック: /api/orca/master/material 503 固定）
- cmd_20260206_15_sub_12 (2026-02-06)
  - 環境: web-client `http://127.0.0.1:5173`（docker, `VITE_DISABLE_MSW=1` 想定: `serviceWorker controlled=false`）/ server-modernized 健全
  - 目的: 503 ブロック中の `/api/orca/master/material` が keyword を変えることで 200（items=[] or items>0）へ回復するかを 1〜3 回だけ再実測し、回復した場合は材料選択→`/api/orca/order/bundles` POST payload 反映まで実証する。
  - 結果: keyword を変えても **503 が継続**し、UI は「特定器材マスタを取得できませんでした」を表示。200 成功経路は観測できず（外部要因ブロックとして扱う）。
    - RUN_ID=`20260206T131817Z-cmd_20260206_15_sub_12-material-master-1` keyword=`包帯`
    - RUN_ID=`20260206T131921Z-cmd_20260206_15_sub_12-material-master-2` keyword=`シリンジ`
    - RUN_ID=`20260206T132023Z-cmd_20260206_15_sub_12-material-master-3` keyword=`注射針`
  - 証跡:
    - `artifacts/webclient/e2e/20260206T131817Z-cmd_20260206_15_sub_12-material-master-1/material-master/`（`network/network.json`, `network/requests.json`, `steps.log`, screenshots）
    - `artifacts/webclient/e2e/20260206T131921Z-cmd_20260206_15_sub_12-material-master-2/material-master/`（同上）
    - `artifacts/webclient/e2e/20260206T132023Z-cmd_20260206_15_sub_12-material-master-3/material-master/`（同上）
  - 補足（恒久整備）:
    - `web-client/scripts/qa-procedure-usage-material-master.mjs` を拡張し、材料検索結果が 200(items>0) で行が表示された場合は、材料行クリック→数量入力→保存（`POST /api/orca/order/bundles`）まで実行し、`order-bundles-posts.json` に POST payload を残せるようにした（本件は 503 継続のため未到達）。

### 切り分けチェックリスト
1. UI 側の検索条件を確認する。`keyword` が空だと検索リクエスト自体が飛ばない。部位検索は放射線/リハビリ系オーダーのみ有効で、`category=2` が既定。
2. ルーティング/Prefix を確認する。`VITE_ORCA_MODE=weborca` だと `/api/orca/master/*` は `/api/orca/master/*` に書き換わり、Trial では 404/502 になるため server-modernized 経由に切り替える。
3. 認証を確認する。`/api/orca/master/*` は `userName/password` ヘッダ or Basic 認証が必須。`VITE_ORCA_MASTER_USER/PASSWORD` と server 側の `ORCA_MASTER_BASIC_USER/PASSWORD` が一致しているか確認する。
4. ORCA DB 接続を確認する。`ORCADS` JNDI が解決できない場合は 503（`MASTER_*_UNAVAILABLE`）になる。server-modernized ログの `ORCA datasource lookup failure`/`Failed to load ORCA-05 * master` を確認する。
5. データ欠落を確認する。Trial や未シード環境では 503/0件が起きる。レスポンス `meta` の `missingMaster/fallbackUsed/dataSource` と `runId/traceId` を確認する。
6. 旧ビルドの 404/503 を疑う。`/orca/master` の Path 分離と etensu 列名修正（2026-01-27 反映済み）が未適用だと 404/503 が再発する。
7. 証跡は Network/HAR と `runId/traceId` を保存し、`docs/web-client/operations/orca-master-bodypart-trial-issue-20260121.md` と突合する。

## SOAP保存（/api/orca/chart/subjectives） upstream 未応答の切り分け
- RUN_ID=`20260204T132521Z` (2026-02-04)
- Vite proxy 先は `VITE_DEV_PROXY_TARGET=http://localhost:9080/openDolphin/resources` を確認（`web-client/.env.local`）。
- 9080 への直接アクセス（`/openDolphin/resources/dolphin`）が 5s でタイムアウトし応答なし。
- `POST /openDolphin/resources/api/orca/chart/subjectives` も同様にタイムアウト（上記と同じ 9080 経路）。
- コンテナ内部 (`docker exec`) から `localhost:8080` でもタイムアウトし、server-modernized HTTP リスナー自体が応答しない状態を確認。
- 証跡: `artifacts/webclient/subjectives-upstream/20260204T132521Z/curl-9080.log`
- 追加対応案:
  - server-modernized の再起動/再作成で HTTP リスナーの復旧を確認（`/openDolphin/resources/dolphin` が即時 200/401 を返すか）。
  - WildFly の bind/listener 設定とコンテナ起動ログを確認（起動完了ログ/HTTP listener 有無）。

## SOAP保存（/api/orca/chart/subjectives） FK制約違反の恒久修正
- 事象: `d_document.karte_id` が `public.d_karte` を参照する FK で失敗（`fk6s9ifrm58t6jr9qamv7ey83lm` / `fk_d_module_karte`）。
- 恒久修正:
  - `OrcaSubjectiveResource` で `patientServiceBean.ensureKarteByPatientPk` を呼び、カルテ未生成を事前解消。
  - `V0234__fix_fk_schema_opendolphin.sql` を追加し、`opendolphin` スキーマの `d_document` / `d_module` FK を `opendolphin.d_karte` / `opendolphin.d_users` に寄せる（`NOT VALID` で既存不整合を温存しつつ新規挿入を保護）。
- RUN_ID=`20260204T141203Z-soap-fk-fix` (2026-02-04)
  - `POST /openDolphin/resources/api/orca/chart/subjectives` が 200 / `apiResult=00` を返却。
  - `d_document` に `title=主訴` のレコードが追加されることを DB で確認。
  - 証跡: `artifacts/verification/20260204T141203Z-soap-fk-fix/soap-persistence/`（`post-subjectives*.json` / `db-document-latest.txt` / `server-modernized.log`）

## SOAP保存（/api/orca/chart/subjectives） UI経由回帰確認
- RUN_ID=`20260204T141740Z-soap-ui-regression` (2026-02-04)
  - Web-client UI（Charts > SOAP記載）から保存を実行し、`/api/orca/chart/subjectives` が 200。
  - `d_document` に `title=主訴` のレコードが追加されることを DB で確認。
  - 証跡:
    - `artifacts/verification/20260204T141740Z-soap-ui-regression/soap-persistence/qa-soap-persistence.md`
    - `artifacts/verification/20260204T141740Z-soap-ui-regression/soap-persistence/network/soap-responses.json`
    - `artifacts/verification/20260204T141740Z-soap-ui-regression/soap-persistence/db-document-latest.txt`
- RUN_ID=`20260204T212600Z-soap-ui-restart-fixed` (2026-02-05)
  - `setup-modernized-env.sh` 再起動直後に再検証（`ORCA_MODE=server` / `VITE_DEV_PROXY_TARGET=http://localhost:9080/openDolphin/resources`）。
  - Web-client UI から `/api/orca/chart/subjectives` が 200 で保存完了（server-modernized 側で `d_document` / `d_module` INSERT を確認）。
  - SOAP履歴の再表示は NG（履歴 count=0）だが、保存自体は成功。
  - 証跡:
    - `artifacts/verification/20260204T212600Z-soap-ui-restart-fixed/soap-persistence/qa-soap-persistence.md`
    - `artifacts/verification/20260204T212600Z-soap-ui-restart-fixed/soap-persistence/network/soap-responses.json`
    - `artifacts/verification/20260204T212600Z-soap-ui-restart-fixed/soap-persistence/db-karte.txt`
    - `artifacts/verification/20260204T212600Z-soap-ui-restart-fixed/soap-persistence/db-document-latest.txt`
    - `artifacts/verification/20260204T212600Z-soap-ui-restart-fixed/soap-persistence/db-module-latest.txt`
    - `artifacts/verification/20260204T212600Z-soap-ui-restart-fixed/soap-persistence/server-modernized.log`

## SOAP履歴（DocumentTimeline）0件表示の原因と修正
- 原因: `ChartsPage` の auto-resolve が発火し、`encounterContext.patientId` が空に更新されるため `soapEncounterKey` が変化。SOAP履歴は `01415::none::none::none` に保存済みでも、UI側は `::...` のキーを参照し履歴が 0 件になる。
- 証跡（原因切り分け）:
  - RUN_ID=`20260204T213700Z-soap-history-debug`
  - `location.search` が `?visitDate=2026-02-04&runId=...`（patientId 消失）になり、`encounterRaw` は `patientId=""`。
  - `soapEncounterKeys=["01415::none::none::none"]` / SOAP履歴 count=0。
  - 証跡: `artifacts/verification/20260204T213700Z-soap-history-debug/soap-history-debug/soap-history-debug.json`
- 修正:
  - `encounterContext.patientId` が存在する場合は auto-resolve で先頭患者へ切替えず、指定患者のまま保持するよう変更。
  - 変更ファイル: `web-client/src/features/charts/pages/ChartsPage.tsx`
- 再検証:
  - RUN_ID=`20260204T214100Z-soap-history-fix`
  - SOAP履歴 count=1（DocumentTimeline に再表示）。
  - 証跡:
    - `artifacts/verification/20260204T214100Z-soap-history-fix/soap-persistence/qa-soap-persistence.md`
    - `artifacts/verification/20260204T214100Z-soap-history-fix/soap-persistence/network/soap-responses.json`
- 最終再検証:
  - RUN_ID=`20260204T214600Z-soap-history-final`
  - SOAP履歴 count=1（DocumentTimeline に再表示）。
  - 証跡:
    - `artifacts/verification/20260204T214600Z-soap-history-final/soap-persistence/qa-soap-persistence.md`
    - `artifacts/verification/20260204T214600Z-soap-history-final/soap-persistence/network/soap-responses.json`

## cmd_20260206_21: Charts Past Panel / Do転記（Phase1）
目的: 左パネル（Past Panel）から過去参照を集約し、最小スコープで「現在カルテへの転記（プレビュー+Undo）」を成立させる。

### Phase1: Past Panel（参照集約のみ）
- flag: `VITE_CHARTS_PAST_PANEL=1`
- RUN_ID=`20260206T145916Z-cmd_20260206_21_sub_7-past-hub-phase1`
- 証跡: `artifacts/verification/20260206T145916Z-cmd_20260206_21_sub_7-past-hub-phase1/`（`flag-off.png`, `flag-on.png`, `capture-past-hub.mjs`）

### Phase1: Do転記（SOAP最小）= Past Panel → プレビュー → 適用 → Undo(1回)
- flag: `VITE_CHARTS_PAST_PANEL=1` + `VITE_CHARTS_DO_COPY=1`
- スコープ: SOAP の 1セクション（Subjective など）を「履歴（転記元）→現在ドラフト（転記先）」へ反映（server保存はしない）
- 要件:
  - プレビューで転記元/転記先を明示
  - 適用で現在ドラフトを上書き
  - Undo で 1回だけ元に戻せる
- RUN_ID=`20260207T000617Z-cmd_20260206_21_sub_10-do-copy-phase1` (2026-02-07)
- 証跡:
  - `artifacts/verification/20260207T000617Z-cmd_20260206_21_sub_10-do-copy-phase1/charts-do-copy-phase1/`
    - `notes.md`（手順）
    - `meta.json`（`draftAfterUndo` でUndo成立を機械確認）
    - `screenshots/`（プレビュー/適用/Undo）
- 手動回帰（flag off/on + Do転記）:
  - RUN_ID=`20260207T103755Z-cmd_20260206_21_sub_10-do-copy-manual-regression2` (2026-02-07)
  - 証跡:
    - `artifacts/verification/20260207T103755Z-cmd_20260206_21_sub_10-do-copy-manual-regression2/charts-do-copy-manual-regression/`
      - `flag-off/`（入力/ドラフト保存/印刷/左右パネル）
      - `flag-on/`（入力/ドラフト保存/印刷/左右パネル）
      - `flag-on/do-copy-steps/`（プレビュー→適用→Undo）

## Charts: カルテ版管理（Revision Drawer）

### Phase1: 閲覧（履歴/差分）+ server unavailable でも落ちない
- RUN_ID=`20260206T154532Z-cmd_20260206_23_sub_7-charts-revision-history-screenshots` (2026-02-07)
  - 証跡:
    - `artifacts/verification/20260206T154532Z-cmd_20260206_23_sub_7-charts-revision-history-screenshots/charts-revision-history-screenshots/`
      - `00-flag-off.png`（flag OFF: 入口なし）
      - `01-flag-on.png`（flag ON: 入口あり）
      - `02-drawer-open-diff.png`（Drawer open + changed/delta）
      - `03-server-unavailable.png`（503/非JSONでも落ちず `server unavailable`）
      - `notes.md`（network/console 最小メモ）

### Phase1: server-modernized read API 接続（HTTP200 経路）
- RUN_ID=`20260206T233436Z-cmd_20260206_23_sub_9-charts-revision-history-server` (2026-02-07)
  - Drawer open で `source: server` / `server: N件` を表示し、Network で `/karte/pid` + `/karte/revisions*` の 200 を確認。
  - 証跡:
    - `artifacts/verification/20260206T233436Z-cmd_20260206_23_sub_9-charts-revision-history-server/charts-revision-history-server/`
      - `drawer-server-200.png`
      - `notes.md`

### Phase2: UI revise/restore 導線（feature flag）+ server write 統合（HTTP200 経路）
- RUN_ID=`20260207T001030Z-cmd_20260206_23_sub_11-charts-revision-edit-restore` (2026-02-07)
  - `VITE_CHARTS_REVISION_HISTORY=1` + `VITE_CHARTS_REVISION_EDIT=1` で Drawer に改訂/restore ボタンを表示。
  - revise/restore を各1回実行し、暫定の `POST /karte/document` が 200 を返し、read API で履歴件数が増えることを追認。
  - 証跡:
    - `artifacts/verification/20260207T001030Z-cmd_20260206_23_sub_11-charts-revision-edit-restore/charts-revision-edit-restore/`
      - `01-before.png`
      - `02-after-revise.png`
      - `03-after-restore.png`
      - `notes.md`（network memo: `/karte/document` POST 200 を含む）

### Phase2: write API を /karte/revisions/revise|restore へ移行 + 409(REVISION_CONFLICT) UI 実証
- RUN_ID=`20260207T002441Z-cmd_20260206_23_sub_12-charts-revision-edit-restore-v2` (2026-02-07)
  - `VITE_CHARTS_REVISION_EDIT=1` で revise/restore を有効化し、write を `POST /karte/revisions/revise|restore` に切替。
  - revise/restore を各1回実行し、Network で `/karte/revisions/revise|restore` が 200 を返すことを確認。
  - `VITE_CHARTS_REVISION_CONFLICT=1` の 409 テスト導線で、意図的に stale な `baseRevisionId` を送って `HTTP 409`（error=`REVISION_CONFLICT`）を再現し、Drawer 上で「履歴の更新が必要」+ 更新ボタンを表示できることを実証。
  - 証跡:
    - `artifacts/verification/20260207T002441Z-cmd_20260206_23_sub_12-charts-revision-edit-restore-v2/charts-revision-edit-restore-v2/`
      - `01-before.png`
      - `02-after-revise-200.png`
      - `03-after-restore-200.png`
      - `04-conflict-409.png`
      - `notes.md`（network memo: `/karte/revisions/revise|restore` 200 と 409 を含む）

### NOT VALID 制約の注意点（運用）
- `NOT VALID` は **既存行を検証しない**。新規 INSERT/UPDATE には適用されるが、過去データの参照整合性は担保されない。
- 既存データの補正後に `ALTER TABLE opendolphin.d_document VALIDATE CONSTRAINT fk_d_document_karte` 等を実行して完全適用する。
- 先に `public`/`opendolphin` 双方の同名テーブルの混在解消（不要データ削除 or 移行）を行うこと。検証前に整合確認が必須。

### NOT VALID 制約のリリース注意点
- リリース手順（最小）:
  1. `V0234__fix_fk_schema_opendolphin.sql` を適用（FK は NOT VALID のため即時ロック影響を最小化）。
  2. 監視: `/api/orca/chart/subjectives` などの保存系が 500 になっていないかログ/監査を確認。
  3. 既存データ補正（`public`/`opendolphin` の重複・不整合を整理）。
  4. メンテナンス時間に `VALIDATE CONSTRAINT` を実行し完全適用。
- 影響範囲:
  - `d_document` / `d_module` の FK 参照先が `public` → `opendolphin` に変わるため、**既存不整合があると VALIDATE は失敗**する。
  - NOT VALID の間は **新規 INSERT/UPDATE のみ保護**され、既存データの整合は保証されない。
- VALIDATE 例（補正後に実行）:
  - `ALTER TABLE opendolphin.d_document VALIDATE CONSTRAINT fk_d_document_karte;`
  - `ALTER TABLE opendolphin.d_document VALIDATE CONSTRAINT fk_d_document_creator;`
  - `ALTER TABLE opendolphin.d_module VALIDATE CONSTRAINT fk_d_module_karte;`
  - `ALTER TABLE opendolphin.d_module VALIDATE CONSTRAINT fk_d_module_creator;`

### NOT VALID 制約の VALIDATE 実施可否チェック（dev環境）
- RUN_ID=`20260205T092200Z-not-valid-check` (2026-02-05)
  - 証跡: `artifacts/verification/20260205T092200Z-not-valid-check/not-valid-check.txt`
- 結果:
  - `convalidated=false`（4件すべて未VALIDATE）
  - `d_document.karte` で **1件の参照欠落**（`d_document.id=16` が `karte_id=10` を参照）
  - `public.d_karte` に `id=10` が存在し、`opendolphin.d_karte` には存在しない（public 側にだけ残っている）。
  - `d_document.creator` / `d_module.*` は欠落なし。
- 解釈:
  - 現状のまま `VALIDATE CONSTRAINT` を実行すると `fk_d_document_karte` で失敗する可能性が高い。
  - 既存データ補正（public → opendolphin の移行 or 対象行修正/削除）が **必須**。
- 本番手順案（最小）:
  1. 事前チェックSQLを実行して欠落件数を把握。
     - 例: `SELECT COUNT(*) FROM opendolphin.d_document d LEFT JOIN opendolphin.d_karte k ON d.karte_id=k.id WHERE d.karte_id IS NOT NULL AND k.id IS NULL;`
  2. 欠落行があれば **public側に残っている同IDの移行**または **参照先補正/削除** を実施。
  3. 欠落が 0 になったことを再確認後、メンテナンス枠で `VALIDATE CONSTRAINT` を実行。
  4. `VALIDATE` 実行後に `convalidated=true` を確認。
  5. 影響/注意: `VALIDATE` はテーブル全走査を伴うため、件数が多い場合は夜間メンテ枠を推奨。

### NOT VALID 制約の VALIDATE 実行（dev環境）
- RUN_ID=`20260205T061354Z-not-valid-validate-fix` (2026-02-05)
  - 証跡: `artifacts/verification/20260205T061354Z-not-valid-validate-fix/sql-log.txt`
- 実施内容:
  - 欠落行に紐づく `d_image` を削除（`d_image.doc_id=16`）。
  - `d_document.id=16` を削除。
  - `VALIDATE CONSTRAINT` を 4件実行。
- 結果:
  - 欠落件数は 0 に解消。
  - `fk_d_document_karte` / `fk_d_document_creator` / `fk_d_module_karte` / `fk_d_module_creator` が `convalidated=true`。
  - dev DB に限った実施（本番は事前補正＋メンテ枠が必須）。

### SOAP保存修正まとめ（短報）
- 原因: `d_document` / `d_module` が `public.d_karte` を参照するFKにより、`opendolphin` 側で保存すると 500（FK違反）。
- 修正: `OrcaSubjectiveResource` で `ensureKarteByPatientPk` によりカルテ生成保証。`V0234__fix_fk_schema_opendolphin.sql` で FK を `opendolphin` 参照へ変更（NOT VALID）。
- 証跡: RUN_ID `20260204T141203Z-soap-fk-fix`（API保存 200 + DB 追記）、`20260204T141740Z-soap-ui-regression`（UI保存 200 + DB 追記）。
- NOT VALID 注意点: 既存データは検証されず新規のみ保護。補正後に `VALIDATE CONSTRAINT` を実行して完全適用。

## /api/orca/visits/mutation 500 改善（Session layer failure 対策）
- 修正内容1: `RestExceptionMapper` が `SessionServiceException` の cause を遡り `OrcaGatewayException` を検知し、400/502/503 を返すように変更（`settings`/`missing required fields` などは 400/503 へ振り分け）。
- 修正内容2: `Session layer failure` メッセージは ORCA 由来メッセージに置換。
- 影響範囲: `OrcaGatewayException` 起因の ORCA ラッパー系 API（`/api/orca/visits/mutation` など）が 500 → 適切な 400/502/503 で返る。
- 再検証RUN_ID: `20260205T225518Z-orca-visits-mutation-500-fix`
- 再検証1: `requestNumber=99`（不正値）→ HTTP 400 (`orca_gateway_error`、`field=requestNumber`) を確認。
- 再検証2: `requestNumber=01`（正常）→ HTTP 200 / Api_Result=00 を確認。
- 証跡: `artifacts/verification/20260205T225518Z-orca-visits-mutation-500-fix/mutate_visit_success.json`,
  `artifacts/verification/20260205T225518Z-orca-visits-mutation-500-fix/mutate_visit_invalid_request.json`
- 追加再検証RUN_ID: `20260205T233121Z-orca-visit-order-500-recheck` (2026-02-06)
  - `/api/orca/visits/mutation`: `requestNumber=01` + patientId=`00006` → HTTP 200 / Api_Result=00 を確認
  - `/api/orca/visits/mutation`: `requestNumber=99` → HTTP 400 (`orca_gateway_error`) を確認
  - `/api/orca/order/bundles` GET: patientId=`NO_KARTE_0001` → 404 `karte_not_found`（karte 未作成検証用に患者を追加）
  - `/api/orca/order/bundles` GET: patientId=`01415` → HTTP 200（recordsReturned=0）
  - `/api/orca/order/bundles` POST: patientId=`01415` → HTTP 200（createdDocumentIds=9136）
  - 証跡: `artifacts/verification/20260205T233121Z-orca-visit-order-500-recheck/`（status/headers/body/json）

### server-modernized 再ビルド・再起動ゲート報告（足軽3）
- RUN_ID=`20260206T045948Z-cmd_20260206_04_sub_1-startup`（2026-02-06）
- 実施内容:
  - `docker compose -f docker-compose.modernized.dev.yml -f docker-compose.override.dev.yml build server-modernized-dev` を完了
  - `docker compose -f docker-compose.modernized.dev.yml -f docker-compose.override.dev.yml up -d --force-recreate server-modernized-dev` で新イメージ反映
- 起動時刻:
  - container startedAt=`2026-02-06T04:59:34.092062511Z`（UTC）
  - health healthy確認=`2026-02-06T05:00:14Z`（UTC）
- 確認方法:
  - `docker inspect`（status/health/startedAt）
  - `curl http://localhost:9080/actuator/health` -> 200
  - 主要 ORCA エンドポイント（`/openDolphin/resources/api/orca/master/etensu`, `/openDolphin/resources/api/orca/order/bundles`）は認証要求を返すこと（401）を確認（経路到達確認）
- 証跡:
  - `artifacts/verification/20260206T045948Z-cmd_20260206_04_sub_1-startup/server-modernized-startup-check.txt`

## cmd_20260207_10: PhaseA/統合（manual smoke + 画像アップロード）

### manual smoke（STAMP-001 / ORDER-001 / REC-001, CLAIM不発）
- 目的: STAMP/ORDER/REC の P0 実装が flag on/off で期待どおりに露出し、かつ `/orca/claim/outpatient` が呼ばれないことを **HAR + network-summary** で証明する。
- 前提:
  - MSW: enabled（`VITE_DISABLE_MSW=0`）
  - CLAIM は廃止方針のため対象外。ただし「不発（呼ばれない）」は証跡で根拠化する。
- RUN_ID: `20260207T083550Z-cmd_20260207_10_sub_1-manual-smoke`
- 証跡:
  - `artifacts/verification/20260207T083550Z-cmd_20260207_10_sub_1-manual-smoke/manual-smoke/notes.md`
  - baseline:
    - `artifacts/verification/20260207T083550Z-cmd_20260207_10_sub_1-manual-smoke/manual-smoke/baseline/network-summary.json`（`claimOutpatientCalled=false`）
    - `artifacts/verification/20260207T083550Z-cmd_20260207_10_sub_1-manual-smoke/manual-smoke/baseline/network.har`
    - `artifacts/verification/20260207T083550Z-cmd_20260207_10_sub_1-manual-smoke/manual-smoke/baseline/steps.md`
  - mvp1（Phase1）:
    - `artifacts/verification/20260207T083550Z-cmd_20260207_10_sub_1-manual-smoke/manual-smoke/mvp1/network-summary.json`（`claimOutpatientCalled=false`）
    - `artifacts/verification/20260207T083550Z-cmd_20260207_10_sub_1-manual-smoke/manual-smoke/mvp1/network.har`
    - `artifacts/verification/20260207T083550Z-cmd_20260207_10_sub_1-manual-smoke/manual-smoke/mvp1/steps.md`
  - mvp2（Phase2）:
    - `artifacts/verification/20260207T083550Z-cmd_20260207_10_sub_1-manual-smoke/manual-smoke/mvp2/network-summary.json`（`claimOutpatientCalled=false`）
    - `artifacts/verification/20260207T083550Z-cmd_20260207_10_sub_1-manual-smoke/manual-smoke/mvp2/network.har`
    - `artifacts/verification/20260207T083550Z-cmd_20260207_10_sub_1-manual-smoke/manual-smoke/mvp2/steps.md`
- 結果（要点, notes/summary準拠）:
  - baseline: flags off で MVP UI は露出しない（期待通り）。
  - mvp1: REC/ STAMP は露出確認。ORDER は dataset 依存で `/api/orca/order/bundles` 未観測のため smoke 不完全（follow-up 要）。
  - mvp2: STAMP Phase2（copy + order-edit導線）と ORDER entity selector + `/api/orca/order/bundles` 観測を確認。

### 画像アップロード PhaseA（web-client / MSW）
- 目的: Charts ユーティリティに「画像/スキャン」を追加し、画像のアップロード -> 一覧反映 -> SOAP へのリンク貼付までの導線を最小で成立させる。
- 前提:
  - feature flag: `VITE_PATIENT_IMAGES_MVP=1`
  - MSW: enabled（`VITE_DISABLE_MSW=0`）
  - CLAIM は廃止方針のため対象外（本節では `/orca/claim/outpatient` 等は扱わない）。
- 検証結果:
  - flag OFF: ユーティリティの「画像」エントリが表示されない。
  - flag ON: PNG をアップロード（MSW）し、一覧へ反映される。
  - 「SOAPへ貼付」で `[画像:...](attachment:...)` が SOAP Free に挿入される。
- RUN_ID: `20260207T084506Z-cmd_20260207_10_sub_3-images-phaseA-web`
- 証跡:
  - `artifacts/verification/20260207T084506Z-cmd_20260207_10_sub_3-images-phaseA-web/images-phaseA-web/notes.md`
  - `artifacts/verification/20260207T084506Z-cmd_20260207_10_sub_3-images-phaseA-web/images-phaseA-web/00-flag-off.png`
  - `artifacts/verification/20260207T084506Z-cmd_20260207_10_sub_3-images-phaseA-web/images-phaseA-web/01-images-panel-after-upload.png`
  - `artifacts/verification/20260207T084506Z-cmd_20260207_10_sub_3-images-phaseA-web/images-phaseA-web/02-soap-note-with-image-link.png`
  - `artifacts/verification/20260207T084506Z-cmd_20260207_10_sub_3-images-phaseA-web/images-phaseA-web/03-flag-on-entry.png`

### 画像アップロード PhaseA（server / server-modernized）
- 目的: server 側の upload/list/download API を提供し、feature gate と監査 payload（operation=image_upload|image_download）を含めて HTTP 200 + sha 一致まで実証する。
- 前提:
  - feature gate:
    - header: `X-Feature-Images: 1`
    - or env: `OPENDOLPHIN_FEATURE_IMAGES_PHASEA=true`
- API:
  - `POST /openDolphin/resources/patients/{patientId}/images`（multipart file）
  - `GET  /openDolphin/resources/patients/{patientId}/images`（list）
  - `GET  /openDolphin/resources/patients/{patientId}/images/{imageId}`（download）
- RUN_ID: `20260207T085759Z-cmd_20260207_10_sub_2-images-phaseA-server`
- 検証結果（要点, notes/http_codes.summary/sha256.match 準拠）:
  - no_auth: 401
  - feature_off: 404（`feature_disabled`）
  - upload/list/download: 200
  - download sha256: match=true（upload 元の sha と一致）
  - 監査: payload.operation が `image_upload` / `image_download` として記録される。
- 証跡:
  - `artifacts/verification/20260207T085759Z-cmd_20260207_10_sub_2-images-phaseA-server/images-phaseA-server/notes.txt`
  - `artifacts/verification/20260207T085759Z-cmd_20260207_10_sub_2-images-phaseA-server/images-phaseA-server/http_codes.summary.txt`
  - `artifacts/verification/20260207T085759Z-cmd_20260207_10_sub_2-images-phaseA-server/images-phaseA-server/sha256.match.txt`
  - `artifacts/verification/20260207T085759Z-cmd_20260207_10_sub_2-images-phaseA-server/images-phaseA-server/02_upload.body.json`
  - `artifacts/verification/20260207T085759Z-cmd_20260207_10_sub_2-images-phaseA-server/images-phaseA-server/03_list.body.json`
  - `artifacts/verification/20260207T085759Z-cmd_20260207_10_sub_2-images-phaseA-server/images-phaseA-server/04_downloaded.bin.sha256.txt`
  - `artifacts/verification/20260207T085759Z-cmd_20260207_10_sub_2-images-phaseA-server/images-phaseA-server/05_audit_latest.txt`

## cmd_20260207_11: Images Phase1（mobile専用UI + server-hardening + 実機相当検証）

目的:
- モバイル端末相当の操作で「患者特定 -> 画像アップロード」を成立させる（mobile専用入口）。
- server 側の制限（feature gate / auth / エラー）と監査（operation）を含めて収束させる。
- CLAIM は廃止方針のため対象外。ただし不発（呼ばれない）であることは Phase1 の network/ログで根拠化する。

### 患者特定 Phase1（mobile patient picker）
- 目的: mobile image upload 専用UIの前段として、患者IDを「当日候補から1-tap」または「手入力+存在確認」で特定できるようにする。
- RUN_ID: `20260207T092856Z-cmd_20260207_11_sub_2-mobile-patient-pick-phase1`
- 証跡:
  - `artifacts/verification/20260207T092856Z-cmd_20260207_11_sub_2-mobile-patient-pick-phase1/mobile-patient-pick-phase1/notes.md`
  - `artifacts/verification/20260207T092856Z-cmd_20260207_11_sub_2-mobile-patient-pick-phase1/mobile-patient-pick-phase1/screenshots/mobile-patient-picker-phase1.png`
- Phase1 要点（notes 準拠）:
  - 当日候補: source=`GET /api/orca/queue`（Receptionでも利用済み。`queue[].patientId` を候補にする）
  - 手入力: digits-only、最大12桁、6桁未満は0埋め、存在確認は `POST /api/orca/patients/local-search`（`fetchPatients({ keyword })`）の exact match で判定
  - 障害時: fetch error はメッセージ + retry
  - 緊急導線: 存在確認をスキップする「そのまま選択」（emergency-only）
- 合流点（mobile UI側）:
  - `web-client/src/features/images/components/MobilePatientPicker.tsx`（`onSelect(patientId: string)`）
  - debug page: `/f/:facilityId/debug/mobile-patient-picker?msw=1`（要 `VITE_ENABLE_DEBUG_PAGES=1` + system_admin）

### Mobile専用UI Phase1（mobile upload page）
- 目的: モバイル端末相当で「患者特定 -> upload -> 一覧反映」までの最低限の導線を用意し、エラー時の復帰（Retry）を担保する。
- RUN_ID: `20260207T094618Z-cmd_20260207_11_sub_1-mobile-images-ui-phase1`
- flags/gate:
  - `VITE_PATIENT_IMAGES_MOBILE_UI=1`
  - server gate header: `X-Feature-Images: 1`
- route:
  - `/f/:facilityId/m/images`
  - router: `web-client/src/AppRouter.tsx`（`m/images` -> `MobileImagesUploadPage`）
- 検証シナリオ（notes 準拠）:
  - success: upload -> 完了 -> 一覧反映
  - error: 404(feature gate) / 413 / 415 / network_error をシミュレートし、文言 + Retry を確認
- 証跡:
  - `artifacts/verification/20260207T094618Z-cmd_20260207_11_sub_1-mobile-images-ui-phase1/mobile-images-ui-phase1/notes.md`
  - `artifacts/verification/20260207T094618Z-cmd_20260207_11_sub_1-mobile-images-ui-phase1/mobile-images-ui-phase1/network.json`（`X-Feature-Images: 1` 送信のメモ）
  - screenshots: `00-success.png`, `10-error-404.png`, `11-error-413.png`, `12-error-415.png`, `13-error-network.png`
  - HAR: `success.har`, `error-404.har`, `error-413.har`, `error-415.har`, `error-network.har`

### Server hardening（gate / auth / error / audit）
- 目的: Phase1 で必要になる server 側の gating とエラー系（authz, content-type, payload size）を、body と監査を含めて根拠化する。
- RUN_ID: `20260207T094018Z-cmd_20260207_11_sub_3-img-hard`
- API:
  - `POST /openDolphin/resources/patients/{patientId}/images`（multipart file）
  - `GET  /openDolphin/resources/patients/{patientId}/images`（list）
  - `GET  /openDolphin/resources/patients/{patientId}/images/{imageId}`（download）
- 結果（http_codes.summary / body 準拠）:
  - 401: no auth（`authentication_failed`）
  - 404: feature_off（`feature_disabled`）
    - requiredHeader: `X-Feature-Images`
    - requiredEnv: `OPENDOLPHIN_FEATURE_IMAGES_PHASEA`
  - 403: forbidden（other facility）
  - 415: unsupported_media_type（allowed: `image/jpeg`, `image/png`）
  - 413: payload_too_large（`OPENDOLPHIN_IMAGES_MAX_BYTES`）
  - 200: upload/list/download
- 監査（audit lookup by request id）:
  - SUCCESS の upload/download は監査行が存在する
  - failure（401/403/404/413/415）は監査行が存在しない（failure audit absent）
- 証跡:
  - `artifacts/verification/20260207T094018Z-cmd_20260207_11_sub_3-img-hard/images-mobile-server-hardening/notes.txt`
  - `artifacts/verification/20260207T094018Z-cmd_20260207_11_sub_3-img-hard/images-mobile-server-hardening/http_codes.summary.txt`
  - error bodies:
    - `02_404_feature_off.body.json`（requiredHeader/requiredEnv）
    - `04_415_unsupported.body.json`（allowed/contentType）
    - `05_413_too_large.body.json`（env/size/maxBytes）
  - audit:
    - `12_audit_lookup_by_request_ids.txt`（SUCCESS audit rows）
    - `13_audit_count_by_request_id.txt`（request_id ごとの audit row 数）

### 実機相当検証
- 目的: 端末相当（スマホ/タブレット相当）の画面サイズで、mobile 専用UIが成立することを根拠化する（スクショ+HAR+notes）。
- RUN_ID: `20260207T095205Z-cmd_20260207_11_sub_4-mobile-images-ui-verify`
- 検証環境（notes 準拠）:
  - MSW: ON（`VITE_DISABLE_MSW=0`）
  - flags:
    - `VITE_PATIENT_IMAGES_MOBILE_UI=1`
    - `VITE_PATIENT_IMAGES_MVP=1`
  - URL: `http://127.0.0.1:5173/f/1.3.6.1.4.1.9414.72.103/m/images`
- 端末相当マトリクス（Playwright device profiles）:
  - iPhone: iPhone 13
  - Android: Pixel 5
  - iPad: iPad (gen 7)
- 実証（要点）:
  - success: patientId input -> upload -> list refresh -> download popup
  - 413 + Retry: 大容量アップロードで 413 を誘発し、Retry から小さい画像へ差し替えて成功まで到達（iPhone）
  - file input attrs: `accept="image/*"` / `capture="environment"` を確認（capture input）
  - CLAIM不発: `/orca/claim/outpatient` は呼ばれない（notes の rg + HAR）
- 証跡:
  - `artifacts/verification/20260207T095205Z-cmd_20260207_11_sub_4-mobile-images-ui-verify/mobile-images-ui-verify/notes.md`
  - `artifacts/verification/20260207T095205Z-cmd_20260207_11_sub_4-mobile-images-ui-verify/mobile-images-ui-verify/summary.json`（device matrix / injected runId）
  - `artifacts/verification/20260207T095205Z-cmd_20260207_11_sub_4-mobile-images-ui-verify/mobile-images-ui-verify/network.har`
  - `artifacts/verification/20260207T095205Z-cmd_20260207_11_sub_4-mobile-images-ui-verify/mobile-images-ui-verify/network-android.har`
  - `artifacts/verification/20260207T095205Z-cmd_20260207_11_sub_4-mobile-images-ui-verify/mobile-images-ui-verify/network-ipad.har`
  - screenshots:
    - `artifacts/verification/20260207T095205Z-cmd_20260207_11_sub_4-mobile-images-ui-verify/mobile-images-ui-verify/screenshots/iphone/05-error-413.png`
    - `artifacts/verification/20260207T095205Z-cmd_20260207_11_sub_4-mobile-images-ui-verify/mobile-images-ui-verify/screenshots/iphone/06-retry-ready.png`
    - `artifacts/verification/20260207T095205Z-cmd_20260207_11_sub_4-mobile-images-ui-verify/mobile-images-ui-verify/screenshots/*/07-upload-success-list.png`

## cmd_20260207_13: Charts UI Optimization（UI only）

目的:
- Charts UI の最適化を「機能変更なし」で段階導入するため、最小回帰チェックと証跡（RUN_ID/パス）を固定する。

非対象（禁止）:
- API仕様/データ構造/業務ロジック/サーバー挙動の変更。

関連ドキュメント:
- `docs/web-client/charts-ui-optimization-plan.md`

### 最小UI回帰チェック（flag off/on）

前提:
- 同一ユーザー/同一facilityで、flag OFF/ON の2回を実施する（画面・操作は同一）。
- 可能なら 1366x768 と 1440x900 の2解像度でスクショを残す（片方でも可）。

チェック項目（最小）:
- 入力:
  - SOAP/紹介状/文書など、テキスト入力が成立する（IME/改行/カーソル移動）。
- 保存:
  - 保存ボタン/ショートカットで保存でき、保存結果が画面に反映される。
- 送信:
  - 送信（ORCA連携）導線が維持され、成功/失敗が判別できる（必要なら監査/ネットワーク証跡）。
- 印刷:
  - 印刷導線（プレビュー/別タブ/印刷ページ）が動作し、主要情報が欠けない。
- 文書モーダル:
  - 文書作成/閲覧モーダルが開閉でき、フォーカス/スクロールが破綻しない。
- 左右パネル:
  - 左パネル（Past等）/右パネル（患者情報等）の開閉ができ、主編集領域が実用的に確保される。

### RUN_ID / 証跡置き場（テンプレ）

| 目的 | flag | 画面/条件 | RUN_ID | 証跡パス（artifacts/verification/...） | 備考 |
| --- | --- | --- | --- | --- | --- |
| baseline（比較の基準） | OFF | 1366x768 | 20260207T130447Z-cmd_20260207_13_sub_6-charts-ui-opt-b-regression3 | `artifacts/verification/20260207T130447Z-cmd_20260207_13_sub_6-charts-ui-opt-b-regression3/charts-ui-opt-b-regression/flag-off/screenshots/1366x768-01-initial.png` | MSW gate ON（VITE_ENABLE_MSW=1, VITE_DISABLE_MSW=0, ?msw=1） |
| baseline（比較の基準） | OFF | 1440x900 | 20260207T130447Z-cmd_20260207_13_sub_6-charts-ui-opt-b-regression3 | `artifacts/verification/20260207T130447Z-cmd_20260207_13_sub_6-charts-ui-opt-b-regression3/charts-ui-opt-b-regression/flag-off/screenshots/1440x900-01-initial.png` | 同上 |
| UI最適化（候補） | ON | 1366x768 | 20260207T130447Z-cmd_20260207_13_sub_6-charts-ui-opt-b-regression3 | `artifacts/verification/20260207T130447Z-cmd_20260207_13_sub_6-charts-ui-opt-b-regression3/charts-ui-opt-b-regression/flag-on/screenshots/1366x768-01-initial.png` | 同上（flag on: VITE_CHARTS_UI_OPT_B=1） |
| UI最適化（候補） | ON | 1440x900 | 20260207T130447Z-cmd_20260207_13_sub_6-charts-ui-opt-b-regression3 | `artifacts/verification/20260207T130447Z-cmd_20260207_13_sub_6-charts-ui-opt-b-regression3/charts-ui-opt-b-regression/flag-on/screenshots/1440x900-01-initial.png` | 同上 |

## cmd_20260207_14: 仮データ/モック表示の排除（P0=prod混入防止）

目的:
- 本番相当（MSW OFF / 実経路）で仮データ（mock/sample/seed/fixture）が UI に混入しないことを根拠化する。
- MSW は検証用途として使うが、誤設定で本番相当に混入しないための恒久対策（gate/隔離/空状態）を収束させる。

用語:
- MSW OFF: `VITE_DISABLE_MSW=1`（本番相当）
- MSW ON: `VITE_DISABLE_MSW=0`（開発/検証用途。デモ表示や seed が出てもよいが “明示” と gate が必須）

### 入力RUN（受領済み）

#### 静的洗い出し（P0候補）
- RUN_ID: `20260207T124033Z-cmd_20260207_14_sub_1-mock-data-inventory`
- P0（要対応）:
  - MSW worker auto-start（`VITE_DISABLE_MSW != '1'` のとき `web-client/src/main.tsx` で MSW start）
  - `SAMPLE_PATIENTS` fallback（APIが empty かつ error なしの場合に sample を表示しうる: `web-client/src/features/patients/api.ts`）
- 証跡:
  - `artifacts/verification/20260207T124033Z-cmd_20260207_14_sub_1-mock-data-inventory/mock-data-inventory/notes.md`

#### 実表示スモーク（MSW ON/OFF）
- RUN_ID: `20260207T124047Z-cmd_20260207_14_sub_2-mock-visibility-smoke`
- 要点:
  - MSW OFF（本番相当）では、点検対象画面で「モック/仮データ」明示表示や seed/fixture 常時表示は検出されず（P0なし）。
  - MSW ON では Reception/Charts に `電子カルテデモシェル` が表示され、Reception の行が seed で出現（P2: 開発用途として妥当。ただし誤設定対策は必要）。
- 証跡:
  - `artifacts/verification/20260207T124047Z-cmd_20260207_14_sub_2-mock-visibility-smoke/mock-visibility-smoke/notes.md`
  - `artifacts/verification/20260207T124047Z-cmd_20260207_14_sub_2-mock-visibility-smoke/mock-visibility-smoke/run-msw-off.json`
  - `artifacts/verification/20260207T124047Z-cmd_20260207_14_sub_2-mock-visibility-smoke/mock-visibility-smoke/run-msw-on.json`
  - HAR:
    - `artifacts/verification/20260207T124047Z-cmd_20260207_14_sub_2-mock-visibility-smoke/mock-visibility-smoke/har/network-msw-off.har`
    - `artifacts/verification/20260207T124047Z-cmd_20260207_14_sub_2-mock-visibility-smoke/mock-visibility-smoke/har/network-msw-on.har`

#### server点検/エラー分類（server-no-mock-audit）
- RUN_ID: `20260207T124248Z-cmd_20260207_14_sub_5-server-no-mock-audit`
- 要点（curl.summary 準拠）:
  - 認証なしは 401（`unauthorized`）で統一され、固定seed/dummy応答は返さない。
  - ORCA queue は 200 で `source="live"` を返す（空データは `queue: []`）。
  - 「mock/stub header」を付与しても queue は 200 / `x-orca-queue-mode: live` で返却され、mock応答に切り替わらない（混入防止の根拠）。
  - master API は:
    - validation 422（`validation_error`）を返し、OK時は `meta.dataSource="server"` を返す（mock固定ではない）。
- 恒久対策（sub_5 実装要点, notes 準拠）:
  - env gate（デフォルト無効=live/スタブ無効）:
    - `/resources/api/orca/queue` の mock 応答は `OPENDOLPHIN_ALLOW_MOCK_ORCA_QUEUE` が truthy の場合のみ許可（既定は常に live）。
    - `OrcaAdditionalApiResource` の stub transport は `OPENDOLPHIN_ALLOW_STUB_ORCA_TRANSPORT` が truthy の場合のみ許可（既定は無効）。
  - エラー分類の正規化（additive / 互換維持）:
    - error body に `errorCode` / `errorCategory` / `details` を追加（既存フィールドは維持）。
    - ORCA master 独自エラー（`OrcaMasterErrorResponse`）も上記フィールドを追加し、フロントで一貫表示できる形へ拡張。
- 証跡:
  - `artifacts/verification/20260207T124248Z-cmd_20260207_14_sub_5-server-no-mock-audit/server-no-mock-audit/curl.summary.txt`
  - queue:
    - `.../08_queue_ok_with_orca_basic_headers.body.txt`（`source="live"`, `queue: []`）
    - `.../09_queue_mock_header_but_disabled.headers.txt`（`x-orca-queue-mode: live`）
    - `.../09_queue_mock_header_but_disabled.body.txt`（`source="live"`）
  - master:
    - `.../04_orca_master_validation_422.body.txt`（422 + `validation_error`）
    - `.../05_orca_master_ok.body.txt`（`meta.dataSource="server"`）
  - notes:
    - `artifacts/verification/20260207T124248Z-cmd_20260207_14_sub_5-server-no-mock-audit/server-no-mock-audit/notes.md`

#### 表示置換/空状態（mock-data-replacements）
- RUN_ID: `20260207T124102Z-cmd_20260207_14_sub_4-mock-data-replacements`
- P0（対応）:
  - Patients: `SAMPLE_PATIENTS` fallback を撤廃（APIが `200 + patients=[] + errorなし` でも sample 患者を表示しない）。
  - Patients: 空状態を status/error/filter に応じて分類し、次アクション（再取得 / Receptionへ）を表示:
    - 403: 権限不足（管理者へ）
    - 404: API未検出（設定確認）
    - 422: 入力不備（条件見直し）
    - 通信断: 通信エラー（再取得）
    - 0件: 未登録 or 該当なし（Receptionへ/条件見直し）
  - Charts: PatientsTab の「このデモでは…」文言を撤去し、次アクション文言へ置換（表示のみ、機能不変）。
- 証跡:
  - `artifacts/verification/20260207T124102Z-cmd_20260207_14_sub_4-mock-data-replacements/mock-data-replacements/notes.md`
  - screenshots:
    - `.../screenshots/before/patients-*.png`
    - `.../screenshots/after/patients-*.png`
  - HAR:
    - `.../har/before/patients-*.har`
    - `.../har/after/patients-*.har`

### 入力RUN（未受領: TBDで追記予定）

（なし）

### 入力RUN（追加受領: MSW gate強化）

#### MSW gate強化（msw-gate-hardening）
- RUN_ID: `20260207T124128Z-cmd_20260207_14_sub_3-msw-gate-hardening`
- P0（対策）:
  - MSW worker auto-start を排除し、MSW 起動条件を厳格化（DEV + env + URL param の AND 必須）。
  - MSW が有効な場合は UI に明示バナー（MockModeBanner）を表示し、実運用と混同されないようにする。
  - production dist に mock/MSW 参照がバンドルされないことを dist スキャンで根拠化する。
- Gate仕様（AND 必須, notes 準拠）:
  - `import.meta.env.DEV === true`
  - `VITE_ENABLE_MSW=1`
  - URL に `?msw=1`
  - `VITE_DISABLE_MSW!=1`（kill switch）
  - 備考: `?msw=1` 追加後は bootstrap されないため、MSW を使う場合は `?msw=1` でリロードが必要。
- 実装（要点）:
  - `web-client/src/main.tsx`: 上記 gate を満たす時のみ dynamic import で worker start
  - `web-client/src/features/shared/MockModeBanner.tsx`: MSW ON バナー表示
  - `web-client/scripts/verify-prod-dist-no-mocks.mjs`: dist に MSW/mock 参照が含まれないことを検査
- 証跡:
  - `artifacts/verification/20260207T124128Z-cmd_20260207_14_sub_3-msw-gate-hardening/msw-gate-hardening/notes.md`
  - `.../screenshots/msw-on-banner.png`
  - `.../dist-scan.txt`
  - `.../vite-build.log`

### 洗い出し結果（P0/P1/P2, 先行骨子）

- P0:
  - MSW auto-start: 誤設定でMSWが起動して seed/fixture が混入しないよう、MSW 起動条件を gate で厳格化（sub_3 で対策）。
  - `SAMPLE_PATIENTS` fallback: 本番相当での sample 表示を禁止（sub_4 で撤廃済み）。
- P1: (TBD) 受領後に追加
- P2:
  - MSW ON 時の `電子カルテデモシェル` と seed 行（開発/検証用途として許容。ただし “明示 + gate” が前提）

### 恒久対策（骨子: 受領後に確定）

- MSW gate:
  - sub_3: MSW worker は `DEV && VITE_ENABLE_MSW=1 && ?msw=1 && VITE_DISABLE_MSW!=1` の AND 条件を満たす場合のみ起動（auto-start排除）。
  - sub_3: MSW ON 時は MockModeBanner を表示し、実運用と混同されないよう明示する。
  - sub_3: production dist に mock/MSW 参照が含まれないことを `verify-prod-dist-no-mocks` で検査（heuristic scan）。
  - 既存: fault injection headers は debug/env/role で制限（`header-flags.ts`）。
- fixture隔離:
  - (TBD) fixtures は debug/test でのみ参照し、runtime からの到達を断つ
- 本番混入防止:
  - sub_3: dist スキャン（`verify-prod-dist-no-mocks`）を CI に組み込む候補（TBD）
- 空状態の表示方針:
  - Patients の空状態/エラー分類（sub_4）:
    - empty / 未登録 / 該当なし / 403 / 404 / 422 / 通信断 を UI で明示し、次アクション（再取得 / Receptionへ）を提示

### 「仮データ混入なし」確認手順（RUNテンプレ）

前提:
- 1回の検証で MSW OFF と MSW ON を両方実施する（MSW ON は “明示表示が出ること” を確認）。
- 画面:
  - Reception / Charts / Patients / Administration / Print / Images / Mobile（最低限）

手順（最小）:
1. MSW OFF（`VITE_DISABLE_MSW=1`）で起動し、対象画面を巡回して “mock/sample/seed/fixture/dummy” が表示されないことを確認。
2. Network: HAR を保存し、MSW OFF の har に `msw` や fixture が混入していないことを確認。
3. MSW ON（`VITE_DISABLE_MSW=0`）で起動し、デモ/seed 表示が “明示” されること（例: `電子カルテデモシェル`）を確認。

RUN_ID / 証跡置き場（テンプレ）:

| RUN | MSW | RUN_ID | artifacts | 備考 |
| --- | --- | --- | --- | --- |
| inventory | - | (TBD) | `artifacts/verification/<RUN_ID>/.../notes.md` | rg/静的洗い出し |
| smoke | OFF | (TBD) | `artifacts/verification/<RUN_ID>/.../har/` + `.../screenshots/` | P0が無いこと |
| smoke | ON | (TBD) | `artifacts/verification/<RUN_ID>/.../har/` + `.../screenshots/` | “明示” が出ること |
