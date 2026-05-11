# ORCA 接続情報（Certification Only / 非Legacy）

- RUN_ID: certification 実行ごとに採番し、`artifacts/orca-remediation/closeout/<RUN_ID>/git/run-id.txt` を正本にする
- 更新日: 2026-04-20
- 目的: ORCA 実環境/検証環境の接続先・認証方式と、管理画面で見える current behavior を **非Legacy の正本**として管理する。

> ⚠️ 重要: ORCA Trial を含む接続先・資格情報は、このリポジトリ、review package、実行ログ、summary、テスト fixture に具体値を書かない。
> 実値は環境変数またはローカル secret store から取得し、ログや証跡では set/unset と sanitized classification のみを残す。

## 1. 参照ルール
- 本ファイルが **非Legacy の正本**。
- ログや証跡ではユーザー名・パスワード・証明書パスを **一切出力しない**。

## 2. デフォルト開発接続（WebORCA Trial）

開発完了まで、ORCA 連携の標準接続先は WebORCA Trial とする。

| 項目 | source | 入力欄（必要に応じて更新） |
| --- | --- | --- |
| ベースURL | fixed development default | `https://weborca-trial.orca.med.or.jp/` |
| API scheme | fixed development default | `https` |
| API port | fixed development default | `443` |
| ORCA mode | fixed development default | `weborca` |
| Basic ユーザー名 | WebORCA Trial published Basic credential; inject via local secret store or `ORCA_API_USER` / `ORCA_BASIC_USER` | raw 値は repo に書かない |
| Basic パスワード | WebORCA Trial published Basic credential; inject via local secret store or `ORCA_API_PASSWORD` / `ORCA_BASIC_PASSWORD` | raw 値は repo に書かない |
| 文字コード | XML/UTF-8 | `UTF-8` |
| 証明書 | 不要 | `none` |

## 3. current behavior（管理画面）
- 接続設定 UI は **WebORCA / cloud 前提**で始まり、`useWeborca=true` が既定です。開発標準の WebORCA Trial では `https://weborca-trial.orca.med.or.jp/` + `443` を使い、server 側で `/api` 系 path を解決します。
- 管理画面では **「管理画面権限確認」** と **「ORCA 接続テスト成功」** を別ステータスとして表示します。管理画面が開けても ORCA 接続成功を意味しません。
- `接続テスト` は **保存済み設定に対する WebORCA API 到達確認のみ**です。`pushUrl` / `pushTenantId` の保存有無は表示しますが、push WebSocket の疎通はこのテスト対象外です。
- `pushUrl` は `ws://` または `wss://` のみ許可し、`pushTenantId` は `pushUrl` がある場合だけ保存します。
- ORCA ユーザ管理では、`manageusersv2` create は `User_Number` を送らず、update は `氏名 / カナ / パスワード` だけを送ります。`User_Id` / `職員区分` / `職員番号` / `管理者権限` は更新画面で表示専用です。
- administration の internal wrapper は **capability-driven な local-only contract** です。official ORCA bridge と同じものとして扱わず、院内ローカル処理や stub 応答を明示表示します。
- administration の診断チェックは readiness / capability 付き local wrapper / 権限確認済み時の WebORCA 接続テストだけを実行します。official/local を混ぜた「一括疎通」ボタンとして扱いません。
- master updates では **official 最終更新情報** と **local artifact の upload / rollback / history** を分けて表示します。official 取得の結果は local artifact 履歴へ追加されます。
- local artifact upload の filename は表示・履歴用メタデータに限定し、path separator / quote / CRLF / 制御文字を除去して basename のみを採用します。保存先や dataset 選択は server-side の datasetCode と artifact store 設定から決定します。

## 3.1 read-only wrapper の公式契約メモ
- 保険組合せ一覧は `patientlst6v2` を使い、ORCA へ送る XML root は `patientlst6req` とする。`Reqest_Number=01`（公式表記）、`Patient_ID`、`Base_Date`、`Start_Date`、`End_Date` を送る。`insurancecombinationreq` や `Perform_Date` はこの read-only wrapper の upstream payload へ送らない。
- 患者予約情報は `appointlst2v2?class=01` を使い、ORCA へ送る XML root は `appointlst2req` とする。`Patient_ID` と `Base_Date` を送る。`Department_Code` は ORCA 応答側データとして扱い、必要な絞り込みは wrapper 応答のローカル filter として行う。
- `patientlst6v2` の `Api_Result=20` は保険組合せなし、`21` は組合せ件数過多として扱う。`appointlst2v2` の `Api_Result=21` は予約なし、`91` は処理区分欠落などのリクエスト契約不備として扱う。
- read-only 診断では、raw ORCA request/response body、患者詳細、保険詳細、cookie、Authorization、JSESSIONID、CSRF、認証情報を artifact やログへ保存しない。

## 4. 接続先テンプレート（Trial 以外は `<MASKED>`）
| 環境 | ベースURL | 認証方式 | 備考 |
| --- | --- | --- | --- |
| Trial | `https://weborca-trial.orca.med.or.jp/` | Basic | XML/UTF-8（証明書不要）。開発完了まで標準接続先として使う |
| Stage | `<MASKED>` | Basic / mTLS | WebORCA cloud URL を承認後に設定 |
| Preprod | `<MASKED>` | Basic / mTLS | WebORCA cloud URL を承認後に設定 |
| Prod | `<MASKED>` | mTLS | 直接接続は承認必須 |

## 5. 設定手順（環境変数）
### server-modernized 向け
- `ORCA_TARGET_ENV=preprod`（または `prod`）を明示し、**必ずホスト/ベースURLを指定する**。
- 開発中は `ORCA_BASE_URL=https://weborca-trial.orca.med.or.jp/` または `ORCA_API_HOST=weborca-trial.orca.med.or.jp` / `ORCA_API_PORT=443` / `ORCA_API_SCHEME=https` を設定する。
- Basic 認証が必要な場合は `ORCA_API_USER` / `ORCA_API_PASSWORD` を設定する。
- ORCA が `401` / `403` を返した場合は、外部接続資格情報の設定不備として扱い、API 応答は内部詳細を出さず `503` / `orca_gateway_error` / `ORCA upstream authentication failed` に正規化する。raw Basic 値や Authorization はログ・画面・成果物に残さない。
- WebORCA 接続時は `ORCA_MODE=weborca`（オンプレは `ORCA_MODE=onprem`）を **明示**する。
- ローカルでは `./orca.env.local` を自動読込し、見つからない場合は `~/.config/opendolphin/orca.env` を読む。`ORCA_ENV_FILE` を指定した場合はそれを優先する。

#### 優先順位（server-modernized）
1. `ORCA_BASE_URL`（指定時はこれを最優先）
2. `ORCA_API_HOST` / `ORCA_API_PORT` / `ORCA_API_SCHEME`
3. 未指定の場合は local/onprem fallback のみ。開発標準は WebORCA Trial だが、誤接続を避けるため Trial endpoint も暗黙 default にはせず、起動時 env またはローカル secret store で明示する。

### Web クライアント dev proxy 向け
- 接続先: `VITE_DEV_PROXY_TARGET` は server-modernized の `/api` entrypoint へ中継するためだけに使う。
- Web クライアント dev proxy は ORCA / WebORCA の生 path (`/api21`, `/api01rv2`, `/orca22` など) を公開しない。
- Web クライアント dev proxy は ORCA Basic 認証、クライアント証明書、証明書 password、ORCA URL を読み込まない。ORCA 接続情報は server-modernized の設定または local secret store だけで扱う。
- `web-client` の `npm run dev` は ORCA env file を自動読込しない。`WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` で起動する場合も、ORCA secret は server-modernized 側の runtime 設定として扱い、Vite proxy の authority にしない。

## 6. 管理画面で確認する項目
- 管理画面権限: `/api/admin/orca/connection` が 200 を返すこと。これは **設定取得権限確認** です。
- ORCA 接続テスト: `/api/admin/orca/connection/test` が `ok=true` を返すこと。これは **API 到達確認** です。
- Push 設定: `pushUrl` / `pushTenantId` の保存済み状態を確認すること。**接続テストだけでは push 有効性は確認できません。**
- Push 入力: `pushTenantId` 単独は保存できません。UI でも `Push URL` がない場合は入力エラーとして扱います。
- capability 表示: `internal wrapper` は local-only、`connection` は `testedScope=api_only` を前提に読むこと。

## 7. ログ/証跡ポリシー
- `setup-modernized-env.sh` / `setup-modernized-env.ps1` の `ORCA_CONFIG` ログで **set/unset** のみ記録する。
- `setup-modernized-env.sh` / `setup-modernized-env.ps1` / `ops/tests/orca/api-smoke.sh` は、`./orca.env.local` と `~/.config/opendolphin/orca.env` を自動読込する。`web-client` の `npm run dev` 単体起動は ORCA env file を読まず、ORCA 通信・資格情報は server-modernized 側に閉じる。
- release validation の live Trial 実行前に `ops/tests/orca/live-trial-checklist.sh --dry-run --run-id <RUN_ID>` を実行し、同一 RUN_ID で runtime smoke、candidate discovery、exact read-only preflight、approved acceptmodv2、fullflow、Phase 4 medicalmodv2 の順序と sanitized evidence roots を確認する。この dry-run は ORCA credential 値、raw ORCA body、患者詳細、HAR/trace/video/screenshot を表示しない。
- 機微情報は `<MASKED>` で保存し、必要であれば別途共有する。
- 実環境接続を行った場合は `artifacts/orca-connectivity/<RUN_ID>/` に証跡を残す。
- release cutover で使う接続確認は `docs/releases/orca-remediation-cutover.md` の事前チェック / smoke と同じ RUN_ID に束ねる。
- `appointments/medical-information` などの runtime blocker は、direct upstream probe、app route probe、server-side transport log を current `RUN_ID` で採ってから classification する。direct probe 前に external blocker と断定しない。
- reviewer 提出用の正本は logs-only archive ではなく reviewer submission packet とし、`review-checkout/` と `closeout-packet/` の同梱検証を通す。

## 8. 注意事項
- ORCA 本番への直接接続は承認必須。
- 接続/認証の切替を行う場合は `ORCA_TARGET_ENV` と環境変数セットを必ず記録する。
- 例外的な手順が必要な場合は `docs/managerdocs/06_open_unknowns_and_evidence_gaps.md` と合わせて判断する。
- Trial で接続確認しただけでは cutover 完了扱いにしない。release 判定は runtime smoke / grep / UI semantics / rollback 準備まで揃えて行う。
- ORCA是正の受入れは remediation pair release 前提で行う。`web-client` と `server-modernized` の片側だけを current taxonomy へ進めた状態は certification 対象外とする。
- certification 中も official/master/local の境界を崩さない。`official=/api/orca/official/*`、`master=/api/orca/master/*`、`local=/api/local/*` から外れる path を使った疎通確認は証跡に採用しない。
- live ORCA send 成功がない run では live pass と書かない。`medicalmodv2.xml` は send 到達 run だけ必須であり、未到達 run は blocker classification と steps/network evidence を正本にする。
