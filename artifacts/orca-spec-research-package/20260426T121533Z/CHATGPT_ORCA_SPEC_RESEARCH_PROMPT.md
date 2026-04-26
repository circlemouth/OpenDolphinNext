# ChatGPT調査依頼: ORCA Trial-backed release readiness の残 ORCA仕様調査

あなたは OpenDolphinNext の ORCA 仕様調査担当です。添付 zip 内の repo-context を読み、現在の開発段階と未完了ゲートを把握したうえで、ORCA 公式仕様/API/公開資料から、残タスクの入力項目・業務前提・成功/失敗判定を調査してください。

## 現在の開発段階

- リポジトリ: `OpenDolphin_WebClient`
- 現在 HEAD: `ba180009b`
- 対象範囲: `web-client/` と `server-modernized/`
- legacy `client/` / `server/` は変更禁止、今回の調査でも参照不要です。
- ORCA 対象は WebORCA / ORCA Trial のみです。production ORCA は対象外です。
- S3 / MinIO / object-storage は対象外です。
- 既存 evidence は sanitized です。raw ORCA request/response body、資格情報、cookie/session、患者/保険の生データ、HAR/trace/video/screenshot/raw network は扱わないでください。

## 重要な既存状況

- `medicalmodv2` の prescription と representative treatment/generic は endpoint-specific L3 Trial business accepted 済み。ただし fullflow や broad order coverage ではありません。
- `instractionChargeOrder/130`、`baseChargeOrder/110`、`injectionOrder/310` は v2 payload の no-live 準備あり。`injectionOrder/310` は RUN_ID `20260426T112213Z` で row-role/code-shape の no-live contract preflight も通過済み。
- `surgeryOrder/500`、`testOrder/600`、`radiologyOrder/700` は v2 live が `Api_Result=80` / `businessRejected`。同一 payload の再送は禁止です。
- `subjectivesv2` は request-number 修正後も HTTP 502 transportRejected。次は no-live 仕様調査が必要です。
- `diseasev3` create は HTTP 400 transportRejected。update/delete は未検証です。
- fullflow は `acceptmodv2` duplicate acceptance / no active entry / canonical handoff 条件で止まっています。
- RWO-11 rollback rehearsal / final owner GO は人間判断待ちであり、今回の ORCA 仕様調査対象ではありません。

## 調査の禁止事項

- ORCA Trial や production ORCA に live request を送らない。
- 資格情報、cookie、Authorization header、session、CSRF、患者/保険詳細、raw ORCA body を要求・表示・保存しない。
- S3 / MinIO / object-storage の設定や資格情報を扱わない。
- 「HTTP 200」「公開マスターにコードが存在する」だけを business success としない。
- 既に businessRejected の同一 payload identity を再送すべき、とは提案しない。

## 調査してほしい項目

### 1. `medicalmodv2` 共通

調査対象:
- `Request_Number=01` 登録時の必須/任意項目
- `Medical_Information` / `Medication_info` の構造、行順、`Medication_Number` の意味
- `Api_Result=80` の仕様上の意味と、原因切り分けに使える入力条件
- `Request_Number=02/03/04` または更新/削除/取消相当の有無と入力項目

成果物:
- endpoint / request class / request number ごとの入力フィールド表
- business success 判定に使える response fields
- no-live wrapper で検査すべき contract checklist

### 2. `instractionChargeOrder/130` 指導料

候補:
- `113001810` 特定疾患療養管理料（診療所）
- fallback: `113000310`, `113000410`

調査対象:
- ORCA でこの種別を `medicalmodv2` class `130` として送る際の行構造
- 必要な病名・施設種別・月内重複・診療科・保険条件
- Trial で送信前に no-live で確認できる precondition
- live を止めるべき条件

### 3. `baseChargeOrder/110` 基本診療料

候補:
- `111000110` 初診料

調査対象:
- 初診料を `medicalmodv2` class `110` として送る条件
- 初診/再診の判定、同日重複、受付/来院状態との関係
- `112007410` 再診料が class `110` ではなく `120` に属する扱いの確認
- Trial live 前に確認すべき encounter precondition

### 4. `injectionOrder/310` 注射

候補:
- primary: `130000510` + 薬剤/材料/comment rows
- fallback: `130003510`, `130009310`

調査対象:
- `130000510` に必要な薬剤 row、材料 row、comment row、数量/単位、投与経路
- 薬剤コード `620000012`、材料コード `700000031`、comment `0085001` の使い方が Trial smoke として妥当か
- ORCA master/API から no-live で master-validity を確認する方法
- v2 no-live contract preflight 後、live 前に追加すべきチェック

### 5. `surgeryOrder/500` 手術

候補:
- changed identity based on `150003110` + official-sample-style adjunct rows
- fallback: `150001010`, `150003210`

調査対象:
- `150003110` bare payload が `Api_Result=80` になりうる仕様上の原因
- official sample-style に必要な麻酔、材料、comment、手術日、部位/サイズ条件
- `150001010` を simple smoke candidate にできるか
- changed payload identity を作る場合の no-live checklist

### 6. `testOrder/600` 検査

候補:
- changed identity around `160000310`
- fallback: `160008010`

調査対象:
- `160000310` が `Api_Result=80` になりうる仕様上の原因
- 検体、判断料、自動算定、同日重複、comment/companion row の必要性
- `160008010` のほうが Trial smoke として安全か
- changed payload identity の入力項目

### 7. `radiologyOrder/700` 画像診断

候補:
- `002000099 + 170027910 + 820181000`
- fallback: `002000099 + 170027910 + 170000410 + 820181000`

調査対象:
- body-part code、imaging fee、selection comment `820181000` の正しい行順
- `170000410` は自動算定か明示送信か
- duplicate diagnostic fee risk
- changed no-live payload identity の checklist

### 8. `subjectivesv2` SOAP / 症状詳記

調査対象:
- 正しい endpoint、XML root、query/body フィールド、Request_Number/class 相当
- create/update/delete が存在するか
- HTTP 502 が wrapper/input contract 起因で起きる可能性
- business success 判定に使う response fields
- raw body なしで確認できる no-live contract

### 9. `diseasev3` 病名 CRUD

調査対象:
- create/update/delete の request number / operation / required fields
- `Base_Month`、`Perform_Date`、病名コード、転帰、疑い、主病名、急性、保険病名等の入力仕様
- create HTTP 400 の仕様上の原因候補
- update/delete 前に必要な disease identity / sequence / target precondition
- business success 判定に使う response fields

### 10. RWO-07 user-actionable update/delete/cancel operations

調査対象:
- Web client のユーザー操作に対して、ORCA API 上の更新/削除/取消相当がどの endpoint / Request_Number に対応するか
- `medicalmodv2`、`diseasev3`、`subjectivesv2`、受付系 API の対応表
- 実行不可または業務的に危険な操作の fail-closed 方針

### 11. `acceptmodv2` / fullflow blocker

調査対象:
- duplicate acceptance `apiResult=16` の意味
- acceptance success と言える response fields
- active visit row / canonical handoff に必要な受付状態
- 受付削除/再受付/既存受付検索の安全な仕様
- fullflow の next precondition として no-live/read-only で確認できる項目

### 12. 文書料 / local-only `otherOrder`

調査対象:
- 文書料を ORCA 診療行為として扱う正式 endpoint/code/mapping があるか
- なければ current `LOCAL_OTHER:*` fail-closed 方針が妥当か
- もし mapping がある場合、どの Work Order に追加すべきか

## 期待する回答形式

以下の形式で、調査結果を Markdown で返してください。

1. Executive summary
   - 今すぐ実装/検証へ進めるもの
   - 仕様不明または human billing decision が必要なもの
   - live Trial を止めるべきもの

2. 調査対象別詳細
   - ORCA endpoint / official URL
   - request number / operation
   - 必須入力項目
   - 任意入力項目
   - 入力例を作るための sanitized field-level guidance
   - business success 判定
   - business rejection / transport rejection の切り分け
   - no-live wrapper checklist
   - live 前 stop conditions

3. 優先順位
   - RWO-06H injection
   - RWO-06G base-charge
   - RWO-06F instruction
   - RWO-06K radiology changed identity
   - RWO-06I surgery changed identity
   - RWO-06J test changed identity
   - diseasev3 / subjectivesv2 / RWO-07 / acceptmodv2 fullflow

4. 参照元
   - 公式 URL を必ず列挙
   - 推測と公式記載を明確に分離

## 添付 context の読み方

まず `PACKAGE_README.md` を読み、その後 `context/` 配下の roadmap/handoff/evidence を読んでください。payload JSON は raw ORCA body ではなく repo-local no-live identity ですが、回答に payload body を転載しないでください。必要な場合はファイル名、SHA、field-level summary のみ参照してください。

## Source Snapshot Note

The package also contains `repo-source-snapshot-open-dolphin-next-ba180009b.zip`, a curated tracked-source snapshot from HEAD `ba180009b`. Use it only if the extracted context docs are insufficient. Prefer the roadmap/handoff/evidence files first, then inspect source paths relevant to wrappers, payload identities, and ORCA route contracts.
