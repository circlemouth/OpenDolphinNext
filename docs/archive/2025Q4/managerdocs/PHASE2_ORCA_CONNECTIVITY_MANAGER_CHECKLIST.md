# Phase2 ORCA Connectivity Run マネージャーチェックリスト（Trial 環境接続プラン）

> **参照開始順**
> 1. `AGENTS.md`
> 2. `docs/web-client/README.md`（Web Client Hub）
> 3. `docs/server-modernization/phase2/operations/ORCA_CONNECTIVITY_VALIDATION.md`
> 4. `docs/managerdocs/PHASE2_ORCA_CONNECTIVITY_MANAGER_CHECKLIST.md`
>
> **報告テンプレ（RUN_ID / 証跡パス / DOC_STATUS 行）**
> - RUN_ID: `RUN_ID=<ID>`（ドキュメントのみは `RUN_ID=NA`）
> - 証跡パス: `docs/server-modernization/phase2/operations/logs/...`, `artifacts/orca-connectivity/<RUN_ID>/...` など保存先を列挙
> - DOC_STATUS 行: `docs/web-client/planning/phase2/DOC_STATUS.md`「モダナイズ/外部連携（ORCA 接続）」行の更新内容
>
> **Archive 移行チェック（担当: Codex, 期限: 2025-11-29）**
> - [ ] Dormant 判定記録（棚卸し済メモを残す）
> - [ ] `docs/archive/2025Q4/` への移行とスタブ差し替え
> - [ ] `PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` / `DOC_STATUS.md` 備考へアーカイブ結果を反映
>
- **開発端末手順の現行/Legacy 判定**
- [ ] `docs/server-modernization/phase2/operations/ORCA_CERTIFICATION_ONLY.md` = 現行手順（Trial 接続資格情報の参照用）
- [ ] `mac-dev-login.local.md` = Legacy / Archive（Archive 化時は DOC_STATUS と同期）

## 1. 背景と基本方針

> ⚠️ **【2026-01-04 更新】**
> 標準接続先は WebORCA Trial（`https://weborca-trial.orca.med.or.jp`）とする。
> 認証は Basic のみ、リクエスト/レスポンスは XML(UTF-8) を標準とする。

- 接続先は `docs/server-modernization/phase2/operations/ORCA_CERTIFICATION_ONLY.md` 記載の Trial サーバーのみ。Basic 認証を使用し、公式 API 仕様（`docs/server-modernization/phase2/operations/assets/orca-api-spec/raw/*.md`）に基づき、API を XML payload で実行する。
- CRUD 証跡は必ず `docs/server-modernization/phase2/operations/logs/<RUN_ID>-orca-connectivity.md` と `artifacts/orca-connectivity/<RUN_ID>/` に保存し、`docs/web-client/planning/phase2/DOC_STATUS.md` を更新する。
- 認証情報は環境変数経由で使用し、ログ・ドキュメントへは `<MASKED>` 表記で保存する。

## 2. タスクボード
- [x] **タスクA: seed / データ健全性確認**  
  - トライアル UI（スター → 01 医事業務）の seed 情報（患者 `00000001`、医師 `00001`、保険 `06123456`、直近日受付・予約・診療行為）を確認し、結果を `artifacts/orca-connectivity/<RUN_ID>/data-check/` に残す。CLI で UI を開けない場合は試行日時・再開条件のみ記録。
  - seed が欠落していたら trialsite で許可されている UI 操作（外来受付登録など）で補完し、補完不可な場合は Blocker（trialsite 該当節）としてログへ記載。
  - 実績: RUN_ID=`20251115T134513Z`（2025-11-15 22:50 JST）で `curl -u user:pass <URL>` の HTML を `ui/login.html` に取得。GUI 端末が無いため `data-check/20251115T134513Z-data-check.md` に「CLI のため seed 追加入力不可／Chrome 端末確保後に再開」および必要 seed（患者 `00000001`, 医師 `0001`, 保険 `06123456`）を明示。
  - 実績: RUN_ID=`20251115TrialConnectivityCodexZ1`（2025-11-15 22:45 JST）で `patientgetv2?id=00001` を取得し、5 桁患者番号のみ有効であることと `Physician_Code=0001` が API から参照できない点を `data-check/README.md` と `blocked/README.md`（データギャップ）へ記録。GUI 未取得の旨と再開条件（GUI 端末確保）も追記。

- [x] **タスクB: API カバレッジ設計（firecrawl 仕様 ↔ Trial サーバー）**  
  - firecrawl 仕様一覧（`docs/server-modernization/phase2/operations/assets/orca-api-spec/raw/*.md`）を走査し、公開 API を「Trial 提供」「Trial 非提供（trialsite で禁止）」に区分する。結果は `artifacts/orca-connectivity/<RUN_ID>/coverage/coverage_matrix.md` と `docs/server-modernization/phase2/operations/logs/2025-11-20-orca-trial-crud.md` 冒頭へ貼付。
  - 「Trial 提供」カテゴリはすべてタスクCで実測する。「Trial 非提供」は Blocker リストへ追加し、trialsite の引用節・firecrawl 仕様の更新日を併記する。
  - 実績: `artifacts/orca-connectivity/20251115T134513Z/coverage/coverage_matrix.md` へ 60 API を自動整列し、`Trial 提供=51` / `Trial 非提供=9`・`Status={Executed,Planned,Blocked}` を付与。`acceptancelst` / `appointlst` / `medicalmod` 行を `Executed (curl XML)` に設定し、非提供 API は `trialsite.md#limit` を根拠に `Blocked` 扱い。概要を `docs/server-modernization/phase2/operations/logs/2025-11-20-orca-trial-crud.md` へ追記。
  - 実績: RUN_ID=`20251115TrialConnectivityCodexZ1` で firecrawl 仕様 79 本を `Trial提供(実測/未実測)` / `Trial非提供(trialsite#limit, HTTP405)` に分類し、`coverage/coverage_matrix.md` に Evidence パス込みで出力。Blocker 行へ `report_print/systemkanri/userkanri` と `acceptmod/appointmod`（HTTP405）を追加し、ログ + DOC_STATUS 備考に貼付。

- [x] **タスクC: Trial 環境 CRUD 実測（XML）**  
  - DNS/TLS 事前確認: `openssl s_client -connect weborca-trial.orca.med.or.jp:443 -servername weborca-trial.orca.med.or.jp` を RUN_ID ごとに取得し、`artifacts/.../{dns,tls}` とログへ保存。
  - `ORCA_CERTIFICATION_ONLY.md` §4 記載の手順に従って API を実行し、HTTP ステータス、`Api_Result`, レスポンス XML を `artifacts/.../crud/<api>/` に保存してログへ反映する。
  - 過去の本番/証明書接続ログは歴史的経緯として参照可能だが、新規実測は **Trial 環境** を標準とする。
  - `curl -vv -u user:pass -H 'Accept: application/xml' -H 'Content-Type: application/xml' --data-binary @payloads/<api>_trial.xml <endpoint>` で firecrawl 仕様に記載された API (例: `/api01rv2/acceptlstv2?class=01`, `/api01rv2/appointlstv2?class=01`, `/api/api21/medicalmodv2?class=01`) を実行。HTTP ステータス、`Api_Result`, `Allow` ヘッダー、レスポンス XML を `artifacts/.../crud/<api>/` に保存し、ログへ反映する。
  - Endpoint が HTTP 404/405 を返した場合も Trial サーバー結果としてログ化し、タスクDへ Blocker として引き継ぐ（ローカル ORCA での再検証は行わない）。
  - 実績: `artifacts/orca-connectivity/20251115T134513Z/dns/nslookup_2025-11-15T22:50:38+09:00.txt`, `tls/openssl_s_client_2025-11-15T22:50:42+09:00.txt` で DNS/TLS 正常性を採取。`crud/{acceptlst,appointlst,medicalmod}/` に XML ペイロード・レスポンス・`curl.log` を保存し、`Api_Result={13,12,10}`（doctor/patient seed 欠落）を `docs/server-modernization/phase2/operations/logs/2025-11-20-orca-trial-crud.md` へ記録。UI HTML (`ui/login.html`) も CLI で保存済み。
  - 実績: `artifacts/orca-connectivity/20251115TrialConnectivityCodexZ1/{dns/nslookup_2025-11-15T13-48-30Z.txt,tls/openssl_s_client_2025-11-15T13-48-52Z.txt}` で事前チェックを取得し、`crud/acceptlstv2`（`Api_Result=13`）, `crud/appointlstv2`（`Api_Result=12`）, `crud/medicalmodv2`（`Api_Result=14`）, `crud/acceptmodv2`/`crud/appointmodv2`（HTTP405, Allow=OPTIONS,GET）を保存。すべて `logs/2025-11-20-orca-trial-crud.md` RUN_ID セクションへ反映。
  - 実績: RUN_ID=`20251116T164300Z`。`dns/nslookup_2025-11-16T02-04-36Z.txt` / `tls/openssl_s_client_2025-11-16T02-04-43Z.txt` を採取後、`curl -vv -u user:pass --data-binary @payloads/{acceptlst,appointlst,medicalmod,acceptmod,appointmod}_trial.xml` を再実測。`acceptlstv2`=HTTP200/`Api_Result=13`, `appointlstv2`=HTTP200/`Api_Result=12`, `medicalmodv2`=HTTP200/`Api_Result=10`, `acceptmodv2`/`appointmodv2`=HTTP405 (Allow=OPTIONS,GET)。証跡は `artifacts/orca-connectivity/20251116T164300Z/crud/<api>/` と `docs/server-modernization/phase2/operations/logs/2025-11-20-orca-trial-crud.md` に保存。

- [x] **タスクD: Trial 非提供（Blocker）管理**  
  - trialsite「お使いいただけない機能一覧」および firecrawl 仕様の未提供記載を根拠に、Trial 上で利用できない API 一覧を `artifacts/orca-connectivity/<RUN_ID>/blocked/README.md` にまとめる。
  - Blocker 登録時は (1) Endpoint, (2) HTTP ステータス／メッセージ, (3) 引用した trialsite 節 or firecrawl 節, (4) 再開条件（「Trial サーバー側で提供開始」など）をログと DOC_STATUS に記載する。
  - 実績: `artifacts/orca-connectivity/20251115T134513Z/blocked/README.md` に `TrialSeedMissing`（doctor/patient seed 欠落）と `TrialLocalOnly`（`/orca11`,`/orca14` POST 未開放, `report_print` 等の禁止 API）を整理。各行に HTTP ステータス/Api_Result・`trialsite.md#limit` 引用・再開条件（GUI で seed 再投入 or trialsite 機能開放）を付記し、ログ + DOC_STATUS 備考にリンクした。
  - 実績: `artifacts/orca-connectivity/20251115TrialConnectivityCodexZ1/blocked/README.md` へ HTTP405 API と trialsite 由来の禁止機能（帳票・システム管理）を追記し、「データギャップ」欄に doctor seed 不足（`Api_Result=12/13/14`）を登録。再開条件（GUI seed 補完 or trialsite 開放）を明示してログ・DOC_STATUS と同期。
  - 実績: RUN_ID=`20251116T164300Z`。`blocked/README.md` を RUN_ID 版へ差し替え、HTTP405 API と trialsite 禁止 API（report_print/systemkanri/userkanri）を「仕様実装済／Trial不可」ステータスに更新。`acceptlstv2`/`appointlstv2`/`medicalmodv2` の `Api_Result=13/12/10` を「データギャップ」に再掲し、Evidence（`crud/*/response_2025-11-16T02-05-26Z.xml`）とともにログ/DOC_STATUS へ連携。

- [x] **タスクE: ドキュメント整備・棚卸し**  
  - `docs/server-modernization/phase2/operations/ORCA_CONNECTIVITY_VALIDATION.md` §4.3 に Trial サーバー前提の手順／Blocker 対応を追記し、firecrawl 仕様との突合状態を明記。
  - `docs/managerdocs/PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` と `docs/web-client/planning/phase2/DOC_STATUS.md` 行 71-75 / 79-84 に進捗を反映し、Trial Blocker や完了項目を同期。
  - 実績: Runbook §4.3 に RUN_ID=`20251115T134513Z` の証跡要約と `TrialSeedMissing` ラベルを追加し、Table #2/#3/#5 の成功条件を最新挙動（Api_Result=12/13/10）へ更新。`docs/server-modernization/phase2/operations/logs/2025-11-20-orca-trial-crud.md` へ新項目を追記し、`docs/web-client/planning/phase2/DOC_STATUS.md` 行 71-75 / 79-84 および `PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` ORCA 行に RUN_ID, Evidence パス, Blocker 概要を反映。
  - 実績: RUN_ID=`20251115TrialConnectivityCodexZ1` で Runbook §4.3（Doctor seed fallback と coverage 更新手順）、`logs/2025-11-20-orca-trial-crud.md`、`PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md`、`DOC_STATUS.md` 行 95-96 を更新し、`coverage/coverage_matrix.md` / `blocked/README.md` のリンクと Blocker 所見を同期。

## 3. 進捗確認（Checkpoints）
- **Check A**: seed 確認メモと CRUD ログの整合。trialsite 禁止操作は必ず引用付きで Blocker 化できているか。
- **Check B**: firecrawl 仕様 ↔ Trial カバレッジ表が作成され、Trial 提供 API はすべてタスクCにエントリが作成されているか。
- **Check C**: DNS/TLS 証跡と `curl ... --data-binary @payloads/*.xml` の証跡が RUN_ID ごとに `artifacts/.../crud/` へ残っているか。HTTP 404/405 も Trial 結果として扱われているか。
- **Check D**: Blocker 管理（trialsite 引用節、firecrawl 節、再開条件、ログ↔DOC_STATUS の同期）ができているか。
- **Check E**: Runbook / DOC_STATUS / Assignment Overview / coverage_matrix が同じ日付で更新されているか。

## 4. 【ワーカー報告】テンプレ
1. RUN_ID（ドキュメントのみは `RUN_ID=NA`）  
2. 実施内容: UI 手順 / `curl -vv ... --data-binary @payloads/<api>_trial.xml` / 編集したドキュメント  
3. 使用端末 + DNS/TLS 結果（WSL2, macOS など）。GUI が使えない場合はその旨と再開条件を記録。  
4. 証跡ディレクトリ（`artifacts/.../{dns,tls,crud,ui,coverage,blocked}`、`logs/...`）と保存したファイル。  
5. trialsite／firecrawl 仕様の引用節（更新日含む）と、「Trial 提供 or Trial 非提供」の区分。  
6. `DOC_STATUS.md` 更新有無と該当行。

## 5. 参照ドキュメント
| 種別 | ドキュメント | 役割 |
| --- | --- | --- |
| Trial Runbook | `docs/server-modernization/phase2/operations/ORCA_CONNECTIVITY_VALIDATION.md` | Trial CRUD 手順・RUN_ID 管理 |
| trialsite 公式案内 | `docs/server-modernization/phase2/operations/assets/orca-trialsite/raw/trialsite.md` | 利用可否・注意事項 |
| firecrawl 仕様 | `docs/server-modernization/phase2/operations/assets/orca-api-spec/raw/*.md` | API パラメータ／レスポンス仕様 |
| ログ & 証跡 | `docs/server-modernization/phase2/operations/logs/2025-11-20-orca-trial-crud.md`、`artifacts/orca-connectivity/20251120Trial*/`, `artifacts/orca-connectivity/20251115TrialConnectivityCodexZ1/` | DNS/TLS/CRUD/Blocked 記録 |
| 棚卸し | `docs/web-client/planning/phase2/DOC_STATUS.md` 行71-75 / 79-84 | Trial 進捗・Blocker 管理 |
| 割当状況 | `docs/managerdocs/PHASE2_MANAGER_ASSIGNMENT_OVERVIEW.md` | ORCA 接続領域の割当 |

> 最終更新: 2025-11-15 / 担当: Codex（Phase2 ORCA 接続マネージャー）
