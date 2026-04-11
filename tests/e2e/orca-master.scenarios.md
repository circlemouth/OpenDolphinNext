# ORCA-05/06/08 Playwright E2E シナリオ（MSW/Live 並列表記）
- RUN_ID: `20251124T181500Z`（親 `20251124T000000Z`）
- 参照: AGENTS → web-client/README.md → docs/README.md → docs/managerdocs/README.md → docs/contracts/orca-master-api.md
- プロファイル: MSW（既定: dataSource=snapshot, runId=20251124T090000Z 前提）/ Live（`VITE_DEV_PROXY_TARGET` 指定時、リクエストヘッダに `X-Run-Id=20251124T181500Z` を送る想定）。
- 監査メタ共通期待: `meta.runId`=RUN_ID、`dataSource`=snapshot|server、`cacheHit`=true/false をレスポンスから取得し、UI/PerfLog に転記。422 時は `validationError=true`、404 時は `missingMaster=true`。

## MSW 正常系
| ID | API/ケース | 前提 (MSW ハンドラ) | 操作 | 期待 UI | 監査メタ | Live 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| MSW-N-01 | `/api/orca/master/generic-class` 薬効ツリー | `__mswSetFault('none')` | カルテ検索モーダルで薬効検索に `降圧` を入力 | ツリー2件表示、バナーなし、暫定バッジ非表示 | runId=20251124T090000Z, dataSource=snapshot, cacheHit=false, missingMaster=false, fallbackUsed=false | Live も同操作（取得可なら dataSource=server, cacheHit 任意）。未実施: Stage URL 未提供。 |
| MSW-N-02 | `/api/orca/master/generic-price` 最低薬価 | fault なし | 「薬価」タブを開きコード `699999999` を検索 | 未収載薬が1件、金額欄 `—`、警告無し | missingMaster=true, fallbackUsed=true | Live: 未実施（proxy 未設定）。 |
| MSW-N-03 | `/api/orca/master/youhou` 用法 | fault なし | 用法検索に `朝食` | 「1日1回 朝食後」が表示、選択可 | cacheHit=false, fallbackUsed=false | Live: 同操作。未実施。 |
| MSW-N-04 | `/api/orca/master/material` 特定器材 | fault なし | 特材検索に `PTCA` | 該当1件、カテゴリ=material、警告なし | dataSource=snapshot | Live: 未実施。 |
| MSW-N-05 | `/api/orca/master/kensa-sort` 検査分類 | fault なし | 検査分類検索に `血液` | 「血液検査」表示、選択可 | cacheHit=true | Live: 未実施。 |
| MSW-N-06 | `/api/orca/master/hokenja` 保険者 | fault なし | 住所検索で都道府県=01, keyword=`札幌` | payerName=札幌市国保 が1件、住所/電話表示 | prefCode=01, dataSource=snapshot | Live: 未実施。 |
| MSW-N-07 | `/api/orca/master/address` 住所 | fault なし | 郵便番号 `1000001` を入力 | 住所フィールドに千代田区千代田が自動入力 | missingMaster=false | Live: 未実施。 |
| MSW-N-08 | `/orca/tensu/etensu` 電子点数表 | fault なし | 点数検索に keyword=`初診`, category=`11` | 初診料がリスト表示、金額=288、警告なし | tensuVersion=202404, cacheHit=true | Live: 未実施。 |

## MSW 422 / 入力バリデーション（regex 追加分）
| ID | API/ケース | 前提 (MSW fault) | 操作 | 期待 UI | 期待ステータス | 監査メタ | Live 備考 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MSW-E-01 | `/api/orca/master/generic-price` SRYCD 桁不足 | fault=`validationError` で 422 を返す | SRYCD フィールドに `12345` で検索 | 検索結果領域にエラーアラート「SRYCD は数字 9 桁で指定してください」表示、リスト空 | HTTP 422 | validationError=true, missingMaster=false, fallbackUsed=false | Live 実施時も同期待。未実施。 |
| MSW-E-02 | `/api/orca/master/hokenja` 都道府県不一致 | fault=`payerPrefMismatch` で 422 | pref=02 で payerCode 先頭 `06` を入力 | エラーアラート「保険者番号の先頭2桁は都道府県コードと一致させてください」 | HTTP 422 | validationError=true | Live: 未実施。 |
| MSW-E-03 | `/api/orca/master/address` 郵便番号形式不正 | fault=`invalidZip` で 422 | 郵便番号 `12-3456` を入力 | バナー「郵便番号は数字7桁で指定してください」表示、住所フィールド空 | HTTP 422 | validationError=true | Live: 未実施。 |
| MSW-E-04 | `/orca/tensu/etensu` tensuVersion フォーマット不正 | fault=`invalidVersion` で 422 | tensuVersion に `2024-04` を指定し検索 | エラーアラート「tensuVersion は YYYYMM（6 桁）で指定してください」 | HTTP 422 | validationError=true | Live: 未実施。 |

## フォールト（レジリエンス計画インライン要約）
- fault id はこのシナリオ表の ID を正本とする。MSW では `window.__mswSetFault('<id>')` で切替。
- `db-down`: MSW abort(0)→ UI バナー「ORCA マスター取得に失敗→スナップショット表示」、`fallbackUsed=true`。
- `slow-query`: MSW delay(4000)→ 2 回バックオフ後 snapshot へ。バナー「タイムアウト→キャッシュ/スナップショット」。
- `server-500` / `server-503`: 2 回リトライ後 snapshot。`fallbackUsed=true`。
- `rate-limit`: status=429 + Retry-After 5→ カウントダウン表示後再試行1回、以降 snapshot。
- `dns-fail`: resolve 失敗→即 snapshot、`missingMaster=true`。バナー「名前解決失敗」。
- `tls-fail`: 証明書検証失敗→即 snapshot。バナー「TLS 検証失敗」。
- Live 実行時は `curl-faults.example.sh` に倣って `VITE_DEV_PROXY_TARGET` 経由で再現、不可の場合は未実施と記録。

## Live プロファイルメモ
- 期待手順: `.env` または CLI で `VITE_DEV_PROXY_TARGET=http://<stage-host>:8000` を指定し `npm run dev` 起動。Playwright では `process.env.VITE_DEV_PROXY_TARGET` がセットされた状態で同シナリオを `test.skip` 解除して実行する。
- 現状: Stage /dev proxy 未提供のため Live シナリオはすべて「未実施 (待ち条件: stage URL と認証情報)」として扱う。実施後は表の Live 備考欄を更新する。
