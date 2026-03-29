# API スモークテスト（Python 非使用時の手順）

1. `test_config.manual.csv` から対象ケースを選び、`headers/` 配下のプロファイルを `PARITY_HEADER_FILE` に設定する。
2. レガシー/モダナイズ双方の URL を `BASE_URL_LEGACY` / `BASE_URL_MODERN` で指定し、`./ops/tools/send_parallel_request.sh METHOD PATH [ID]` を実行する。
3. レスポンスは `artifacts/parity-manual/<ID>/<legacy|modern>/response.json` に保存され、`meta.json` / `headers.txt` で HTTP 情報を確認できる。
4. `diff -u artifacts/parity-manual/<ID>/legacy/response.json artifacts/parity-manual/<ID>/modern/response.json` で差分を取得し、必要に応じて `tmp/manual-smoke/` や `artifacts/manual/` へ転記する。
5. 監査ログが必要なケース (`test_config.manual.csv` の expectation を参照) は `psql` で `d_audit_event` を採取し、`artifacts/manual/audit_log.txt` へ追記する。

> ℹ️ `test_config.manual.csv` の `trace-id` 列は `X-Trace-Id` ヘッダーに設定する推奨値。`headers/*.headers` をコピーして `X-Trace-Id: <trace-id>` 行を追加すると、HTTP/JMS/Session ログの突合せが容易になる。  

6. 取得結果と課題は `artifacts/parity-manual/` 配下に整理し、必要なら `docs/README.md` から辿れる current runbook / managerdocs に要約を反映する。

## ライセンス API シナリオ（`--scenario license`）

1. `tmp/license/system_license_post_body.txt` に投入するデバイス UID を 1 行で記述する（既存 UID を再利用する場合もそのまま上書きせず使用してよい）。`ops/tests/api-smoke-test/configs/system_license_post.config` が POST リクエストのボディ／ヘッダー参照先としてこのファイルを読み込む。
2. `ops/tests/api-smoke-test/run.sh --scenario license --run-id <RUN_ID> --profile modernized-dev` のように実行する。`RUN_ID` はヘッダー内 `{{RUN_ID}}`（`headers/sysad-license.headers`）および成果物ディレクトリ名に反映され、同一 RUN で `POST /dolphin/license` → `GET /dolphin/license` → `GET /system/license` の順で採取される。
3. 出力は `artifacts/parity-manual/smoke/<RUN_ID>/{legacy,modernized}/license_*` に保存される。期待される応答は `artifacts/parity-manual/license/20251118TlicenseDeployZ1/{post,get,get-system}/` を参照し、`POST`=200（body `0`）、`GET /dolphin/license`=405、`GET /system/license`=404 であることを確認する。
4. 差異が出た場合は同じ RUN_ID の再取得手順を残し、追加証跡パスを README 末尾の Appendix へ追記する。
5. **CI シナリオ実行済み（RUN_ID=`20251119TlicenseScenarioZ1`）**: helper コンテナ（`docker run --rm --network legacy-vs-modern_default -v "$PWD":/workspace mcr.microsoft.com/devcontainers/base:jammy`）から `ops/tests/api-smoke-test/run.sh --scenario license --profile modernized-dev --run-id 20251119TlicenseScenarioZ1` を実行し、`artifacts/parity-manual/license/20251119TlicenseScenarioZ1/{post,get,get-system}/` 以下に Legacy/Modern の `headers.txt` / `meta.json` / `response.json` を保存済み。`20251118TlicenseDeployZ1` と比較し、`X-Trace-Id`・`Date`・`time_total` 以外の差分が無いこと（POST=200, GET=405, GET-system=404）を確認した。

## JavaTime 手動ケースの準備

1. `ops/tests/api-smoke-test/headers/javatime-stage.headers.template` を Stage 用の Bearer トークンで編集し、同じディレクトリに `javatime-stage.headers` という名前で保存する（`.gitignore` 済みのためトークンはリポジトリへ反映されない）。  
2. `test_config.manual.csv` に追加済みの `JAVATIME_ORCA_001` / `JAVATIME_TOUCH_001` を選択し、`PARITY_HEADER_FILE=ops/tests/api-smoke-test/headers/javatime-stage.headers` を指定して `ops/tools/send_parallel_request.sh` を実行する。  
3. 取得したレスポンスと `tmp/java-time/*` に保存したサンプルは `artifacts/parity-manual/` 配下へ集約し、必要に応じて current runbook から参照できるようにする。  
4. Stage で自動採取する場合は `ops/monitoring/scripts/java-time-sample.sh --dry-run` でログを確認し、`ENV`（BASE_URL/AUTH など）をセットして本実行する。

### Stage 実行時の注意

- Bearer トークンは `headers/javatime-stage.headers` にのみ保存し、Git へコミットしない（`.gitignore` 済み）。2025-11-07 時点では Stage トークンが未共有のため Dry-Run ログ `tmp/java-time/logs/java-time-sample-20251107-dry-run.log` を Evidence へ控え、トークン取得後に同ファイルへ上書き実行する。  
- `ops/tests/api-smoke-test/payloads/javatime_*.json` の `issuedAt` は `date --iso-8601=seconds` を用いて再生成し、Stage 送付時に手動編集しない。  
- JavaTime エビデンス（`tmp/java-time/audit-YYYYMMDD.sql`, `tmp/java-time/orca-response-YYYYMMDD.json`, `tmp/java-time/touch-response-YYYYMMDD.json`）は 30 日以内に Evidence ストレージへ転記し、必要なら managerdocs / runbook 側へ要約だけ残す。

## REST 例外ハーネス（SessionOperation / TRACE）

- `test_config.manual.csv` 先頭に `trace_http_*` シナリオを追加し、200/400/401/500 の最小経路と推奨 `X-Trace-Id` を定義した。400/401/500 は `ops/tests/api-smoke-test/headers/trace-session.headers` を複製しつつ `X-Trace-Id` を書き換えて運用する。  
- `rest_error_scenarios.manual.csv` ではエラーパス専用の定義ファイルを提供し、`expected_status` と再現ノートを明記した。CLI 実行時は `PARITY_OUTPUT_DIR=artifacts/parity-manual/TRACEID_JMS/<timestamp>` を指定し、同ディレクトリ内へ証跡リンクを追記する。
- 2025-11-12 更新: RUN_ID=`20251115TresterrexZ1` の再取得では `/dolphin/activity/2025,04` が `error=invalid_activity_param`、`/touch/user/...` が `error=unauthorized`（`details.reason=authentication_failed`）、`/karte/pid/INVALID,[date]` が `error=karte_lookup_failed` を JSON で返すことを確認済み。成果物は `artifacts/parity-manual/rest-errors/20251115TresterrexZ1/` に `rest_error_{bad_request,unauthorized,internal}/` と `logs/send_parallel_request.log` を配置し、Legacy/Modern の両系統で `traceId` がボディに反映されていることを明示した。
- `ops/tools/send_parallel_request.sh --profile compose ...` を使うと `send_parallel_request.profile.env.sample` を自動読込して URL を切り替えられる。`BASE_URL_LEGACY` を一時的に Modernized 側へ上書きしたい場合は `BASE_URL_LEGACY=http://localhost:9080/openDolphin/resources` をコマンドに付与する。

### REST エラーケース再現テンプレ（RUN_ID=`20251110TnewZ` ひな形）

1. `tmp/parity-headers/<case>_<RUN_ID>.headers` を `cp tmp/parity-headers/<case>_20251110TnewZ.headers tmp/parity-headers/<case>_<new RUN_ID>.headers` で複製し、`X-Trace-Id: parity-<case>-<new RUN_ID>` へ置換する。`password: 632080fabdb968f9ac4f31fb55104648`（Legacy LogFilter の MD5）と `facilityId: 1.3.6.1.4.1.9414.72.103` は固定値のため書き換え不要。`PUT` 系は `Content-Type: application/json` を残す。  
2. `PARITY_HEADER_FILE` と（必要に応じて）`PARITY_BODY_FILE` を以下のテンプレに合わせて設定し、`PARITY_OUTPUT_DIR=artifacts/parity-manual/<case>/<RUN_ID>` を指定して `ops/tools/send_parallel_request.sh` を実行する。証跡が揃ったら `rest_error_scenarios.manual.csv` に記載の TraceId で `send_parallel_request.log` / `headers.txt` / `response.json` を保管する。

| CSV `id` | ヘッダー / TraceId | ペイロード | 期待ステータス (Legacy / Modernized) | 証跡配置（例） | メモ |
| --- | --- | --- | --- | --- | --- |
| `rest_error_letter_fk` | `PARITY_HEADER_FILE=tmp/parity-headers/letter_<RUN_ID>.headers` / `X-Trace-Id: parity-letter-<RUN_ID>` | `PARITY_BODY_FILE=tmp/parity-letter/letter_put_payload.json` | `200 / 500` (`fk_d_letter_module_karte`) | `artifacts/parity-manual/letter/<RUN_ID>/` | `d_karte.id` を揃えるまで Modern 側 500 想定。 |
| `rest_error_letter_audit` | `PARITY_HEADER_FILE=tmp/parity-headers/letter_<RUN_ID>.headers` / `X-Trace-Id: trace-letter-audit-<RUN_ID>` | `PARITY_BODY_FILE=tmp/parity-letter/letter_put_payload.json` | `200 / 200`（Legacy=200 固定／Modern=200 + Audit/JMS） | `artifacts/parity-manual/letter/<RUN_ID>/` | RUN_ID=`20251115TletterAuditZ1` で Modern `LETTER_CREATE` が `logs/d_audit_event_letter_modern.tsv` に出力され、`logs/jms_dolphinQueue_read-resource.{before,after}.txt` の `messages-added` が 0L→1L へ増分。Legacy 分は `d_audit_event` 空／JMS 変化なしを Evidence に記録。 |
| `rest_error_lab_empty` | `PARITY_HEADER_FILE=tmp/parity-headers/lab_<RUN_ID>.headers` / `X-Trace-Id: parity-lab-<RUN_ID>` | - | `200 / 200` （`list=null`） | `artifacts/parity-manual/lab/<RUN_ID>/` | `d_nlabo_module`⇔`d_nlabo_item` の紐付け調査と Audit/JMS 採取を TODO。 |
| `rest_error_lab_audit` | `PARITY_HEADER_FILE=tmp/parity-headers/lab_<RUN_ID>.headers` / `X-Trace-Id: trace-lab-audit-<RUN_ID>` | - | `200 / 200`（Legacy=200 seed 前提 / Modern=200 + Audit/JMS） | `artifacts/parity-manual/lab/<RUN_ID>/` | RUN_ID=`20251115TlabAuditZ1` で Modern `LAB_TEST_READ` が `logs/d_audit_event_lab_modern.tsv` に追加され、`messages-added` が 1L→2L となることを確認。Legacy はラボ seed 未投入時 404 となるため Evidence に理由を記載し、seed 適用後の再取得条件も併記。 |
| `rest_error_stamp_data_exception` | `PARITY_HEADER_FILE=tmp/parity-headers/stamp_<RUN_ID>.headers` / `X-Trace-Id: parity-stamp-<RUN_ID>` | `PARITY_BODY_FILE=tmp/parity-letter/stamp_tree_payload.json` | `200 / 200`（Legacy=200 with Audit/JMS, Modern=200 + Audit/JMS） | `artifacts/parity-manual/stamp/<RUN_ID>/` | RUN_ID=`20251111TstampfixZ3`（helper コンテナ + `BASE_URL_{LEGACY,MODERN}=http://opendolphin-{server,server-modernized-dev}:8080/openDolphin/resources`）。`stamp_tree_payload.json` は GET `/stamp/tree/9001`（versionNumber=11）で同期し、`ops/db/local-baseline/stamp_tree_oid_cast.sql` ＋ `CREATE TABLE d_subscribed_tree` をモダナイズ DB へ適用してから PUT を実行。HTTP/headers/meta は `stamp_tree_user9001/`, `PUT_stamp_tree/`, `rest_error_stamp_data_exception/` へ格納し、Audit/JMS は `logs/d_audit_event_stamp_{legacy,modern}.tsv`（TraceId=`parity-stamp-20251111TstampfixZ3`）と `logs/jms_dolphinQueue_read-resource.txt`（`messages-added=4L`, `message-count=0L`）で確認。Legacy 側 `STAMP_TREE_PUT` も `AuditTrailService` へ記録されるようになった。 |

> 送信例: `PARITY_HEADER_FILE=tmp/parity-headers/letter_20251110TnewZ.headers PARITY_BODY_FILE=tmp/parity-letter/letter_put_payload.json PARITY_OUTPUT_DIR=artifacts/parity-manual/letter/20251110TnewZ RUN_ID=20251110TnewZ ./ops/tools/send_parallel_request.sh --profile compose PUT /odletter/letter rest_error_letter_fk`

> ヘッダー保管メモ: `tmp/parity-headers/*_20251110T234440Z.headers` と `*_20251110TnewZ.headers` は `RUN_ID=20251110TnewZ` の比較用テンプレとして残しているが、`20251111T091717Z` で再取得済みのケースは今後 `2025Q4` 棚卸し時に削除候補へ移す。削除前に `rest_error_scenarios.manual.csv` と `artifacts/parity-manual/<case>/20251110TnewZ/` の差分確認を完了させること。  

## JMS シナリオ（廃止）

CLAIM 送信/JMS フォールバック検証は廃止済みです。`/20/adm/eht/sendClaim` など CLAIM 依存の手順・テンプレは利用しないでください。API-only の疎通確認は `/orca/*` 系エンドポイントを対象に実施してください。

### StampTree GET variations テンプレ（public/shared/published, RUN 未実行）

> **RUN_ID=`20251113TstampPublicPlanZ1` 準備メモ**  
> - Legacy/Modern DB へ [`ops/db/local-baseline/stamp_public_seed.sql`](../../ops/db/local-baseline/stamp_public_seed.sql) を適用し、`publishType in ('9001','9002','global')` の `d_published_tree` と相互 `d_subscribed_tree` が存在することを `SELECT` で確認する。  
> - 期待レスポンス: Legacy/Modern とも `200 OK` + JSON（`PublishedTreeListConverter` フォーマット）。`tmp/parity-headers/stamp_tree_<variation>_<RUN_ID>.headers` の `X-Trace-Id` は `parity-stamp-tree-<variation>-<RUN_ID>` に統一する。  
> - Audit: `logs/d_audit_event_stamp_<variation>_{legacy,modern}.tsv` に `STAMP_TREE_PUBLIC_GET` / `STAMP_TREE_SHARED_GET` / `STAMP_TREE_PUBLISHED_GET` を 1 行以上残し、`artifacts/parity-manual/stamp/20251113TstampPublicPlanZ1/logs/` へ保存する。  
> - JMS: read-only のため `messages-added` 差分は 0 が正しい。`jms_dolphinQueue_read-resource{,_legacy}.{before,after}.txt` を同 RUN_ID 配下に並べ、差分 0 である旨をコメントに記録する。  
> - 旧 404 証跡（`20251111TstampfixZ4`〜`Z6`）はテンプレ比較用に保持し、再取得済みの RUN_ID は同ディレクトリ内のメモへリンクする。

1. `tmp/parity-headers/stamp_tree_{public,shared,published}_TEMPLATE.headers` をベースに、`cp tmp/parity-headers/stamp_tree_public_TEMPLATE.headers tmp/parity-headers/stamp_tree_public_<RUN_ID>.headers` のように RUN_ID 付きファイルへ複製する。`perl -0pi -e 's/{{RUN_ID}}/<RUN_ID>/g' tmp/parity-headers/stamp_tree_public_<RUN_ID>.headers` で TraceId とコメントのプレースホルダーを一括更新する。  
2. `X-Trace-Id` は variation ごとに `parity-stamp-tree-public-<RUN_ID>` / `parity-stamp-tree-shared-<RUN_ID>` / `parity-stamp-tree-published-<RUN_ID>` を割り当てる。`PARITY_HEADER_FILE` は複製後のファイルを指定し、`ops/tools/send_parallel_request.sh --profile modernized-dev GET /stamp/tree/9001/public stamp_tree_public` などで 3 バリエーションを順番に取得する。  
3. HTTP/headers/meta は `artifacts/parity-manual/stamp/<RUN_ID>/stamp_tree_<variation>/{legacy,modern}/` へ保存し、`TRACEID_JMS_RUNBOOK.md §4.1` の要領で `logs/d_audit_event_stamp_<variation>.tsv` と `logs/jms_dolphinQueue_read-resource{,_legacy}.txt`（before/after）を同ディレクトリに配置する。Legacy `message-count=0L` が既知事象である旨を JMS ログへ併記しておく。  
4. 取得前に `PHASE2_PROGRESS.md` backlog と `SERVER_MODERNIZED_DEBUG_CHECKLIST.md` フェーズ4-2 を「テンプレ準備済み／RUN 未実行」で更新し、完了後は `domain-transaction-parity.md` 付録Aの StampTree GET 行に RUN_ID・期待ステータス・証跡を追記する。  

| variation | テンプレ | 推奨 `PARITY_HEADER_FILE` (RUN_ID=`<next>`) | 推奨 `PARITY_OUTPUT_DIR` |
| --- | --- | --- | --- |
| public | `tmp/parity-headers/stamp_tree_public_TEMPLATE.headers` | `tmp/parity-headers/stamp_tree_public_<next>.headers` | `artifacts/parity-manual/stamp/<next>/stamp_tree_public/` |
| shared | `tmp/parity-headers/stamp_tree_shared_TEMPLATE.headers` | `tmp/parity-headers/stamp_tree_shared_<next>.headers` | `artifacts/parity-manual/stamp/<next>/stamp_tree_shared/` |
| published | `tmp/parity-headers/stamp_tree_published_TEMPLATE.headers` | `tmp/parity-headers/stamp_tree_published_<next>.headers` | `artifacts/parity-manual/stamp/<next>/stamp_tree_published/` |

## Appendix A. StampTree GET variations 再取得クイックリファレンス

| variation | Header テンプレ | 実行コマンド例 (Modernized profile) | 証跡格納ルート | 追加ログ |
| --- | --- | --- | --- | --- |
| public | `tmp/parity-headers/stamp_tree_public_TEMPLATE.headers` | ``PARITY_HEADER_FILE=tmp/parity-headers/stamp_tree_public_<RUN_ID>.headers PARITY_OUTPUT_DIR=artifacts/parity-manual/stamp/<RUN_ID>/stamp_tree_public ops/tools/send_parallel_request.sh --profile modernized-dev GET /stamp/tree/9001/public stamp_tree_public`` | `artifacts/parity-manual/stamp/<RUN_ID>/stamp_tree_public/{legacy,modern}/` | `artifacts/parity-manual/stamp/<RUN_ID>/logs/d_audit_event_stamp_public_{legacy,modern}.tsv`, `logs/jms_dolphinQueue_read-resource{,_legacy}.{before,txt}` |
| shared | `tmp/parity-headers/stamp_tree_shared_TEMPLATE.headers` | ``PARITY_HEADER_FILE=tmp/parity-headers/stamp_tree_shared_<RUN_ID>.headers PARITY_OUTPUT_DIR=artifacts/parity-manual/stamp/<RUN_ID>/stamp_tree_shared ops/tools/send_parallel_request.sh --profile modernized-dev GET /stamp/tree/9001/shared stamp_tree_shared`` | `artifacts/parity-manual/stamp/<RUN_ID>/stamp_tree_shared/{legacy,modern}/` | `artifacts/parity-manual/stamp/<RUN_ID>/logs/d_audit_event_stamp_shared_{legacy,modern}.tsv`, `logs/jms_dolphinQueue_read-resource{,_legacy}.{before,txt}` |
| published | `tmp/parity-headers/stamp_tree_published_TEMPLATE.headers` | ``PARITY_HEADER_FILE=tmp/parity-headers/stamp_tree_published_<RUN_ID>.headers PARITY_OUTPUT_DIR=artifacts/parity-manual/stamp/<RUN_ID>/stamp_tree_published ops/tools/send_parallel_request.sh --profile modernized-dev GET /stamp/tree/9001/published stamp_tree_published`` | `artifacts/parity-manual/stamp/<RUN_ID>/stamp_tree_published/{legacy,modern}/` | `artifacts/parity-manual/stamp/<RUN_ID>/logs/d_audit_event_stamp_published_{legacy,modern}.tsv`, `logs/jms_dolphinQueue_read-resource{,_legacy}.{before,txt}` |

### Appendix A-1. RUN_ID 差し替え手順

1. `cp tmp/parity-headers/stamp_tree_<variation>_TEMPLATE.headers tmp/parity-headers/stamp_tree_<variation>_<RUN_ID>.headers`
2. `perl -0pi -e 's/{{RUN_ID}}/<RUN_ID>/g' tmp/parity-headers/stamp_tree_<variation>_<RUN_ID>.headers`
3. `PARITY_HEADER_FILE` と `PARITY_OUTPUT_DIR` を上記テーブルに合わせて export し、`ops/tools/send_parallel_request.sh` を実行
4. HTTP 成果物のほか Audit / JMS ログを `artifacts/parity-manual/stamp/<RUN_ID>/logs/` へ格納し、`domain-transaction-parity.md` Appendix の StampTree 行を更新

> ℹ️ GET が 404 の場合でも再取得テンプレと証跡パスだけはこの手順で即時に揃え、サーバー修正後は同じ RUN_ID 末尾 (`<next+1>`) で再実施する。
