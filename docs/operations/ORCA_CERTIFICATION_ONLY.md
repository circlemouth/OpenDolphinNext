# ORCA 接続情報（Certification Only / 非Legacy）

- RUN_ID: 20260411T224524Z
- 更新日: 2026-04-12
- 目的: ORCA 実環境/検証環境の接続先・認証方式と、管理画面で見える current behavior を **非Legacy の正本**として管理する。

> ⚠️ 重要: 接続情報・資格情報は機微情報のため、このリポジトリには **原則として具体値を記載しない**。
> ただし、**WebORCA Trial の公開情報は秘匿不要**のため、本ファイルに既定値として記載する。
> それ以外の環境はすべて `<MASKED>` とし、実値は社内の承認済み共有手段（Secrets 管理/安全な共有）から取得する。
>
> ✅ 現行の作業前提: ORCA Trial の接続情報・認証情報は**作業対象ディレクトリ内**に置き、公開情報扱いとする（機微情報ではない）。
> ORCA Trial サーバーは**常時操作可能**な前提で運用する。

## 1. 参照ルール
- 本ファイルが **非Legacy の正本**。
- ログや証跡ではユーザー名・パスワード・証明書パスを **一切出力しない**。

## 2. デフォルト開発接続（WebORCA Trial / 公開）
| 項目 | 既定値（公開） | 入力欄（必要に応じて更新） |
| --- | --- | --- |
| ベースURL | `https://weborca-trial.orca.med.or.jp` | `<<FILL_BASE_URL>>` |
| Basic ユーザー名 | `trial` | `<<FILL_BASIC_USER>>` |
| Basic パスワード | `weborcatrial` | `<<FILL_BASIC_PASS>>` |
| 文字コード | XML/UTF-8 | `<<FILL_ENCODING>>` |
| 証明書 | 不要 | `<<FILL_CERT_POLICY>>` |

## 3. current behavior（管理画面）
- 接続設定 UI は **WebORCA / cloud 前提**で始まり、`useWeborca=true` が既定です。WebORCA では `https://...` + `443` を既定とし、server 側で `/api` 系 path を解決します。
- 管理画面では **「管理画面権限確認」** と **「ORCA 接続テスト成功」** を別ステータスとして表示します。管理画面が開けても ORCA 接続成功を意味しません。
- `接続テスト` は **保存済み設定に対する WebORCA API 到達確認のみ**です。`pushUrl` / `pushTenantId` の保存有無は表示しますが、push WebSocket の疎通はこのテスト対象外です。
- `pushUrl` は `ws://` または `wss://` のみ許可し、`pushTenantId` は `pushUrl` がある場合だけ保存します。
- administration の internal wrapper は **capability-driven な local-only contract** です。official ORCA bridge と同じものとして扱わず、院内ローカル処理や stub 応答を明示表示します。

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
3. 未指定の場合は `setup-modernized-env` の既定値（local/Trial 想定）

### Web クライアント dev proxy 向け
- 接続先: `VITE_DEV_PROXY_TARGET=https://weborca-trial.orca.med.or.jp`（公開 Trial 既定）
- 認証方式:
  - mTLS: `ORCA_CERT_PATH=<MASKED>` / `ORCA_CERT_PASS=<MASKED>`
  - Basic: `ORCA_BASIC_USER=trial` / `ORCA_BASIC_PASSWORD=weborcatrial`（公開 Trial 既定）

## 6. 管理画面で確認する項目
- 管理画面権限: `/api/admin/orca/connection` が 200 を返すこと。これは **設定取得権限確認** です。
- ORCA 接続テスト: `/api/admin/orca/connection/test` が `ok=true` を返すこと。これは **API 到達確認** です。
- Push 設定: `pushUrl` / `pushTenantId` の保存済み状態を確認すること。**接続テストだけでは push 有効性は確認できません。**
- capability 表示: `internal wrapper` は local-only、`connection` は `testedScope=api_only` を前提に読むこと。

## 7. ログ/証跡ポリシー
- `setup-modernized-env.sh` / `setup-modernized-env.ps1` の `ORCA_CONFIG` ログで **set/unset** のみ記録する。
- 機微情報は `<MASKED>` で保存し、必要であれば別途共有する。
- 実環境接続を行った場合は `artifacts/orca-connectivity/<RUN_ID>/` に証跡を残す。
- release cutover で使う接続確認は `docs/releases/orca-remediation-cutover.md` の事前チェック / smoke と同じ RUN_ID に束ねる。

## 8. 注意事項
- ORCA 本番への直接接続は承認必須。
- 接続/認証の切替を行う場合は `ORCA_TARGET_ENV` と環境変数セットを必ず記録する。
- 例外的な手順が必要な場合は `docs/managerdocs/06_open_unknowns_and_evidence_gaps.md` と合わせて判断する。
- Trial で接続確認しただけでは cutover 完了扱いにしない。release 判定は runtime smoke / grep / UI semantics / rollback 準備まで揃えて行う。
