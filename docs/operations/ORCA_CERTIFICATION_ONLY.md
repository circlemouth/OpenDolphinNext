# ORCA 接続情報（Certification Only / 非Legacy）

- RUN_ID: certification 実行ごとに採番し、`artifacts/orca-remediation/closeout/<RUN_ID>/git/run-id.txt` を正本にする
- 更新日: 2026-04-14
- 目的: ORCA 実環境/検証環境の接続先・認証方式と、管理画面で見える current behavior を **非Legacy の正本**として管理する。

> ⚠️ 重要: ORCA Trial を含む接続先・資格情報は、このリポジトリ、review package、実行ログ、summary、テスト fixture に具体値を書かない。
> 実値は環境変数またはローカル secret store から取得し、ログや証跡では set/unset と sanitized classification のみを残す。

## 1. 参照ルール
- 本ファイルが **非Legacy の正本**。
- ログや証跡ではユーザー名・パスワード・証明書パスを **一切出力しない**。

## 2. デフォルト開発接続（WebORCA Trial）
| 項目 | source | 入力欄（必要に応じて更新） |
| --- | --- | --- |
| ベースURL | local secret store or `ORCA_BASE_URL` / `ORCA_API_HOST` | `<<FILL_BASE_URL>>` |
| Basic ユーザー名 | local secret store or `ORCA_API_USER` / `ORCA_BASIC_USER` | `<<FILL_BASIC_USER>>` |
| Basic パスワード | local secret store or `ORCA_API_PASSWORD` / `ORCA_BASIC_PASSWORD` | `<<FILL_BASIC_PASS>>` |
| 文字コード | XML/UTF-8 | `<<FILL_ENCODING>>` |
| 証明書 | 不要 | `<<FILL_CERT_POLICY>>` |

## 3. current behavior（管理画面）
- 接続設定 UI は **WebORCA / cloud 前提**で始まり、`useWeborca=true` が既定です。WebORCA では `https://...` + `443` を既定とし、server 側で `/api` 系 path を解決します。
- 管理画面では **「管理画面権限確認」** と **「ORCA 接続テスト成功」** を別ステータスとして表示します。管理画面が開けても ORCA 接続成功を意味しません。
- `接続テスト` は **保存済み設定に対する WebORCA API 到達確認のみ**です。`pushUrl` / `pushTenantId` の保存有無は表示しますが、push WebSocket の疎通はこのテスト対象外です。
- `pushUrl` は `ws://` または `wss://` のみ許可し、`pushTenantId` は `pushUrl` がある場合だけ保存します。
- ORCA ユーザ管理では、`manageusersv2` create は `User_Number` を送らず、update は `氏名 / カナ / パスワード` だけを送ります。`User_Id` / `職員区分` / `職員番号` / `管理者権限` は更新画面で表示専用です。
- administration の internal wrapper は **capability-driven な local-only contract** です。official ORCA bridge と同じものとして扱わず、院内ローカル処理や stub 応答を明示表示します。
- administration の診断チェックは readiness / capability 付き local wrapper / 権限確認済み時の WebORCA 接続テストだけを実行します。official/local を混ぜた「一括疎通」ボタンとして扱いません。
- master updates では **official 最終更新情報** と **local artifact の upload / rollback / history** を分けて表示します。official 取得の結果は local artifact 履歴へ追加されます。

## 4. 接続先テンプレート（Trial 以外は `<MASKED>`）
| 環境 | ベースURL | 認証方式 | 備考 |
| --- | --- | --- | --- |
| Trial | 参照: §2 | Basic | XML/UTF-8（証明書不要） |
| Stage | `<MASKED>` | Basic / mTLS | WebORCA cloud URL を承認後に設定 |
| Preprod | `<MASKED>` | Basic / mTLS | WebORCA cloud URL を承認後に設定 |
| Prod | `<MASKED>` | mTLS | 直接接続は承認必須 |

## 5. 設定手順（環境変数）
### server-modernized 向け
- `ORCA_TARGET_ENV=preprod`（または `prod`）を明示し、**必ずホスト/ベースURLを指定する**。
- `ORCA_API_HOST` / `ORCA_API_PORT` / `ORCA_API_SCHEME` または `ORCA_BASE_URL` を設定する。
- Basic 認証が必要な場合は `ORCA_API_USER` / `ORCA_API_PASSWORD` を設定する。
- WebORCA 接続時は `ORCA_MODE=weborca`（オンプレは `ORCA_MODE=onprem`）を **明示**する。

#### 優先順位（server-modernized）
1. `ORCA_BASE_URL`（指定時はこれを最優先）
2. `ORCA_API_HOST` / `ORCA_API_PORT` / `ORCA_API_SCHEME`
3. 未指定の場合は local/onprem fallback のみ。Trial endpoint は暗黙 default にしない。

### Web クライアント dev proxy 向け
- 接続先: `VITE_DEV_PROXY_TARGET` をローカル secret store または環境変数から設定する。
- 認証方式:
  - mTLS: `ORCA_CERT_PATH=<MASKED>` / `ORCA_CERT_PASS=<MASKED>`
  - Basic: `ORCA_BASIC_USER` / `ORCA_BASIC_PASSWORD` をローカル secret store または環境変数から設定する。

## 6. 管理画面で確認する項目
- 管理画面権限: `/api/admin/orca/connection` が 200 を返すこと。これは **設定取得権限確認** です。
- ORCA 接続テスト: `/api/admin/orca/connection/test` が `ok=true` を返すこと。これは **API 到達確認** です。
- Push 設定: `pushUrl` / `pushTenantId` の保存済み状態を確認すること。**接続テストだけでは push 有効性は確認できません。**
- Push 入力: `pushTenantId` 単独は保存できません。UI でも `Push URL` がない場合は入力エラーとして扱います。
- capability 表示: `internal wrapper` は local-only、`connection` は `testedScope=api_only` を前提に読むこと。

## 7. ログ/証跡ポリシー
- `setup-modernized-env.sh` / `setup-modernized-env.ps1` の `ORCA_CONFIG` ログで **set/unset** のみ記録する。
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
