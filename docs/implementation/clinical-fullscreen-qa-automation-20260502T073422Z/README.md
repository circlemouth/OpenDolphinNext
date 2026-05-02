# Clinical Full-Screen QA Automation

RUN_ID: `20260502T073422Z`  
Status: current execution docset  
Owner: Codex automation heartbeat

## Purpose

この docset は、OpenDolphin WebClient の全業務画面を Codex ブラウザで反復検証し、機能しない箇所を修正、再試行、再修正するための実行正本です。

対象は debug 画面を除く現行業務 route です。

- `/login`
- `/f/:facilityId/reception`
- `/f/:facilityId/charts`
- `/f/:facilityId/charts/order-sets`
- `/f/:facilityId/charts/print/outpatient`
- `/f/:facilityId/charts/print/document`
- `/f/:facilityId/patients`
- `/f/:facilityId/administration`
- `/f/:facilityId/m/images` when mobile image UI is enabled

証跡は `artifacts/clinical-fullscreen-qa/<RUN_ID>/` に保存し、`docs/` には手順、チェックリスト、引き継ぎ、automation prompt だけを置きます。

## Done Definition

- 全対象画面が表示でき、主要操作が成功する、または外部要因として分類済みである。
- 受付、患者検索、カルテ起動、SOAP、病名、処方 RP、複数 RP、オーダー予測入力、代表的オーダー、会計送信、帳票、管理系が確認済みである。
- `repo-defect` と `security-blocker` は根本原因を修正し、同じシナリオを再試行済みである。
- `web-client/` と `server-modernized/` の必要な focused tests、safe browser gate、final gate が成功している。
- 認証、認可、セッション、health/readiness、外部接続、添付/画像、監査ログに影響する変更では該当 docs を更新済みである。
- raw 資格情報、Cookie、Authorization、JSESSIONID、CSRF、raw ORCA body、患者氏名、住所、電話番号、保険詳細、HAR、trace、video、screenshot を tracked evidence に残していない。

## Security Boundary

Web クライアントは信頼境界ではありません。以下は必ずサーバー側で再検証し、UI 表示や hidden state を権威情報にしません。

- user, facility, role, ownership, permission
- scheduleKey, encounterKey, reception identifiers
- storage URI, object key, digest, file name
- ORCA connection target and credentials
- printable report parameters and patient context

### Misuse Cases

1. 改ざんした `facilityId` や role で、他施設の受付、カルテ、患者情報、管理機能へアクセスする。
2. クライアント保存値や URL query で `patientId` / `encounterKey` / `receptionId` を差し替え、別患者のカルテを開く。
3. 任意 URL や外部接続設定を入力し、ORCA 接続確認や readiness を SSRF の踏み台にする。
4. health/readiness、エラー応答、console、証跡に ORCA 接続先、資格情報、内部例外、患者詳細を漏えいさせる。
5. 処方 RP、請求コメント、病名、帳票入力に HTML/JS を入れ、XSS や帳票汚染を成立させる。

## WebORCA Trial Policy

- WebORCA Trial で確認可能なものは、local/MSW/no-artifacts の安全確認後に live preflight へ進めます。
- Trial 資格情報は `ORCA_ENV_FILE`、`./orca.env.local`、`~/.config/opendolphin/orca.env` のいずれかから実行時に供給します。
- 外部 Trial データ不足、資格情報未投入、Trial endpoint の一時障害は repo defect と混同せず、`environment-blocker` または `test-data-blocker` に分類します。
- live mutation 成功は HTTP 200 だけで判定しません。endpoint 固有の business evidence を必須にします。

## Files

- [CHECKLIST.md](CHECKLIST.md): 対象画面とシナリオのチェック表。
- [RUNBOOK.md](RUNBOOK.md): 起動、ブラウザ確認、テスト、live Trial、修正反復の手順。
- [AUTOMATION_PROMPT.md](AUTOMATION_PROMPT.md): 30分 heartbeat automation に登録する自己完結 prompt。
- [ITERATION_LOG_TEMPLATE.md](ITERATION_LOG_TEMPLATE.md): 各回の報告テンプレート。
