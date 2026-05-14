# Mock GUI Redesign Runtime Recovery and Visual Gap Docset Plan

RUN_ID: `20260514T011913Z`

## 1. Purpose

Docker 起動後の実環境で、先に ORCA 接続と DB スキーマを正常化し、その後に M01〜M18 モックとの差分確認を安全に進めるための追加ドキュメントセット作成計画を定義する。

この計画は実装修正そのものではなく、次の追加作業を迷わず実行できるようにするためのものとする。

- runtime recovery の復旧内容と証跡整理
- 実ブラウザ確認で使うシナリオ定義
- M01〜M18 の visual / interaction gap matrix
- 正常稼働に必要な追加実装・運用修正候補の棚卸し
- 証跡 sanitization と医療安全確認項目

## 2. Recovery Summary

### 2.1 DB recovery

現象:

- `server-modernized-dev` は起動したが、ORCA 関連 API が 500 を返していた。
- server log では `orca_operation.central_audit_trace_id` が存在しないため、ORCA operation ledger 記録に失敗していた。
- Flyway 履歴は `0331` で止まっており、現行コードが参照する `V0333__orca_operation_audit_trace.sql` が未適用だった。

復旧:

- DB role password を現在の server container runtime と整合させた。
- Flyway checksum mismatch は local dev DB 履歴と現行 migration 正本のずれとして扱い、`flyway repair` 後に `migrate` を実行した。
- `0332`, `0333`, `0334` が適用され、schema は `v0334` になった。
- `orca_operation` に `central_audit_trace_id`, `unknown_classification`, `reconciliation_status` が存在することを確認した。

### 2.2 ORCA / backend recovery

確認結果:

- `GET /openDolphin/api/health` は HTTP 200。
- `GET /openDolphin/api/health/readiness` は HTTP 200。
- readiness 上の `database`, `auditLog`, `orca`, `orcaBillingCache`, `attachmentStorage` は `UP`。
- ORCA は `weborca` mode、credential configured、client auth disabled として到達可能。
- 実ブラウザ相当の Playwright ログイン後、受付画面で HTTP 500 は再発していない。
- ORCA official appointment route は HTTP 200 を返し、ORCA HTTP request も HTTP 200 で完了した。

制約:

- `/api/admin/orca/connection/test` は admin step-up が必要で、通常ログイン直後の直接 POST は `412 step_up_required` になる。これは期待される保護動作であり、接続失敗ではない。
- stored facility ORCA config がないため、trial-local runtime fallback の WARN が出ている。dev/Trial 環境としては稼働可能だが、正常稼働ドキュメントでは「fallback を許容する条件」と「施設別設定を登録すべき条件」を分けて記載する必要がある。

### 2.3 Web runtime state

確認結果:

- `web-client` dev server は `http://127.0.0.1:5173/` で HTTP 200。
- MSW は無効化し、通常 Vite proxy で `server-modernized` に接続している。
- ログイン後、受付画面は表示される。
- 患者管理画面は表示されるが、現時点の local DB では患者件数 0 件。

制約:

- local DB に患者がないため、実データ導線だけでは患者個別カルテ画面 M01〜M18 を全状態で確認できない。
- visual gap 確認には、次のどちらかを選択して証跡化する必要がある。
  - ORCA Trial から非本番・検証用患者を取り込み、受付してから Charts を開く。
  - MSW または Playwright route stub で raw 患者情報を含まない固定シナリオを作り、UI layout のみ確認する。

## 3. Current Runtime Risks To Document

| Risk | Status | Required follow-up |
| --- | --- | --- |
| DB schema drift | Recovered locally | `runtime-recovery.md` に Flyway `repair + migrate` の理由、結果、再発時の確認 SQL を記載する。 |
| `docker compose` raw invocation requires local secret env | Open | `normal-runtime-runbook.md` に `setup-modernized-env.sh` 経由起動、または ignored local env の扱いを整理する。secret 値は書かない。 |
| trial-local ORCA fallback WARN | Open | dev/Trial では許容、本番相当では施設別 ORCA config 必須として分ける。 |
| Admin ORCA connection test requires step-up | Expected | visual / smoke checklist に step-up 手順または代替 evidence を明記する。 |
| No local patients after recovery | Open | visual 確認用 fixture strategy を決める。raw 患者情報を証跡に残さない。 |
| mock visual mismatch from prior route-stub check | Open | M01 と M05/M12 周辺を優先して gap matrix 化する。 |

## 4. Visual Gap Docset Structure

追加ドキュメントセットは以下に作成する。

`docs/implementation/mock-gui-redesign/runtime-visual-gap-20260514/`

予定ファイル:

| File | Purpose |
| --- | --- |
| `README.md` | docset 全体の読み方、対象 RUN_ID、使用した runtime、証跡 sanitization 方針。 |
| `runtime-recovery.md` | DB/Flyway/ORCA/backend/web-client の復旧手順、確認結果、残リスク。 |
| `browser-scenarios.md` | Playwright / Codex browser で確認する導線。live smoke と controlled visual fixture を分離する。 |
| `mock-gap-matrix.md` | M01〜M18 ごとの期待要素、現状確認結果、差分、追加実装要否。 |
| `additional-implementation-plan.md` | 正常稼働・モック整合のために必要な追加修正を優先度順に整理する。 |
| `acceptance-recheck.md` | `03_acceptance_checklist.md` を runtime 確認結果で再採点する。 |
| `evidence-manifest.md` | screenshot / logs / command summaries の一覧。raw PHI、raw ORCA response、credential を含めないことを明記する。 |

## 5. Browser Verification Plan

### Phase A: live runtime smoke

目的:

- DB / ORCA / auth / reception の正常稼働確認。
- UI redesign の影響で基本業務導線が壊れていないことを確認。

手順:

1. `server-modernized-dev`, Postgres, MinIO の container health を確認する。
2. `web-client` を MSW disabled で起動する。
3. browser でログインする。
4. 受付画面を開く。
5. 患者管理画面を開く。
6. HTTP 500 response がないことを Playwright response hook で確認する。
7. readiness の ORCA `UP` と official appointment route の HTTP 200 を確認する。

記録:

- URL は query 値を redacted にする。
- raw 患者情報、ORCA credential、raw ORCA XML/JSON は保存しない。

### Phase B: patient chart entry strategy

目的:

- M01〜M18 の患者個別カルテ画面を実際に開く。

選択肢:

| Option | Pros | Cons | Decision needed |
| --- | --- | --- | --- |
| ORCA Trial から検証患者を取り込み受付する | live backend / ORCA / DB で実導線を確認できる | DB に検証患者データが残る。証跡 sanitization が必須。 | ORCA Trial の検証用患者 ID を決める。 |
| MSW / route stub で固定 UI fixture を使う | raw PHI を避けやすく、M01〜M18 状態を再現しやすい | live ORCA/DB の完全な E2E ではない | visual layout 確認専用として明示する。 |
| component-level Playwright/Vitest screenshot | 状態を細かく作れる | app 全体導線の確認には弱い | modal/drawer 系 M02〜M18 の補助に使う。 |

推奨:

- Phase A は live runtime smoke として維持する。
- Phase B は controlled visual fixture を主軸にし、必要最小限の live patient flow を別枠にする。

### Phase C: M01〜M18 visual pass

重点確認:

- M01: 患者ヘッダー、安全バナー、3カラム、右カテゴリドック、当日オーダー。
- M02/M09/M10/M11: 右ドロワー、候補ソース、RP単位、安全チェック。
- M03/M04/M06/M08: modal 初期表示、患者識別、比較表示、競合差分。
- M05/M15/M16/M17: bottom dock、文書、画像、セット/スタンプ、帳票。
- M12/M13/M14/M18: ORCA結果、正本差分、版履歴/署名、会計送信済み状態。

既知の優先 gap:

- route-stub 状態では患者文脈 guard が強く出て、M01 全体の確認を阻害した。
- ORCA result / guard 表示が大きくなりすぎ、患者ヘッダーや SOAP 領域を圧迫する状態があった。
- right dock / bottom dock は表示されていても、固定セレクタや検証観点と実 DOM 構造が一致しない箇所がある。
- live DB に患者がないため、通常導線で Charts へ入る fixture strategy が未確定。

## 6. Additional Implementation Plan Draft

追加実装候補は、docset 作成後に `additional-implementation-plan.md` へ確定する。

Priority 0:

- DB/Flyway drift の再発確認手順を runtime runbook に追加する。
- `docker compose` を raw で触る場合の local secret env 前提を明文化する。
- visual verification fixture を PHI-free に固定する。

Priority 1:

- M01 の Charts entry guard 表示を、患者文脈が正常な場合に主画面を圧迫しないよう再確認する。
- ORCA result / safety banner / lock banner の最大高さ、折り返し、優先度を調整する。
- right dock と bottom dock の DOM hook / test selector / visual checklist を実装に合わせて整理する。

Priority 2:

- M02〜M18 の modal/drawer/bottom dock 状態を Playwright で直接開ける test harness を整備する。
- admin ORCA connection test の step-up 導線を browser scenario に組み込む。
- Trial fallback WARN を dev-only として扱うか、施設別 ORCA config の登録導線を runtime setup に追加するか判断する。

## 7. Safety Checklist For The Docset

- 患者文脈を URL、`localStorage`、`sessionStorage` に新規保存しない。
- screenshot や log excerpt に raw 患者情報を残さない。
- ORCA URL、Basic 認証、証明書、証明書パスワード、raw XML、raw ORCA response を保存しない。
- ORCA `UNKNOWN` / warning / unmatch / failure を success と書かない。
- `診療録確定`、`処方確定`、`ORCA送信`、`診察終了`、`会計送信`、`会計済み` を同一状態として扱わない。
- 会計送信後 lock、idempotency key、二重送信防止、audit append-only に影響する差分は別項目として確認する。
- Legacy `client/` と `server/` は変更しない。

## 8. Proposed Next Actions

1. `runtime-visual-gap-20260514/` docset を作成する。
2. live runtime smoke の sanitized evidence を `runtime-recovery.md` と `evidence-manifest.md` に反映する。
3. controlled visual fixture 方針を決め、M01/M02/M05/M12/M18 の代表状態から screenshot 確認する。
4. M01〜M18 の `mock-gap-matrix.md` を埋める。
5. 追加実装が必要な項目を Priority 0〜2 に分けて `additional-implementation-plan.md` に落とす。
6. 追加実装に進む前に、ユーザー確認を受ける。
