# Browser Scenarios

RUN_ID: `20260514T020603Z`

## Preflight

- `git status --short` と branch `master` を確認。
- Docker containers:
  - `opendolphin-server-modernized-dev`: healthy
  - `opendolphin-postgres-modernized`: healthy
  - `opendolphin-minio`: healthy
- `GET /openDolphin/api/health/readiness`: HTTP 200。
- readiness components:
  - `database`: `UP`
  - `auditLog`: `UP`
  - `orca`: `UP`, mode `weborca`
  - `orcaBillingCache`: `UP`
  - `attachmentStorage`: `UP`
- Vite: `http://127.0.0.1:5173/` HTTP 200。

## Live Trial Flow

1. WebORCA Trial candidate discovery を実行。
2. exact readonly preflight を Trial candidate `00001` で実行し、accepted。
3. `acceptmodv2` を Trial candidate `00001` で実行し、`businessAcceptedWithWarnings`。
4. Codex ブラウザで受付画面を開き、受付一覧から Charts を起動。
5. Trial candidate `00002` も readonly preflight accepted 後に fullflow を試行。
6. fullflow は受付登録後の Charts handoff が取得できず停止。再試行では二重受付防止により受付ボタン disabled。
7. Codex ブラウザで受付一覧から `00002` の Charts を手動起動。
8. Phase4 safe wrapper の dry-run を 8 workflow で実行。
9. 過去 checkpoint により再送すべきでない workflow を除き、未実行候補 5 workflow を live 実行。

## UI Observation Rules

- 患者氏名、住所、電話、保険詳細、raw ORCA 応答は記録しない。
- 患者IDは Trial 初期候補 ID のみ必要最小限で記載する。
- スクリーンショットは永続保存しない。必要な視覚確認は DOM マーカーとして記録する。
- `UNKNOWN`、warning、mismatch、failure、transport rejection は success と書かない。

## Observed Browser Markers

- 受付画面:
  - 受付一覧が表示され、Trial 受付行が 2 件表示された。
  - `カルテ` ボタンから Charts を起動できた。
  - HTTP 500 相当の画面エラーは表示されなかった。
- Charts:
  - 患者識別、ORCA取得状態、SOAP、処方、注射、処置、検査、算定、文書、画像、ORCA正本、版履歴が表示された。
  - Trial candidate `00001` では `暫定参照 / ORCA正本確認が必要` が初期表示され、会計送信はガードされた。
  - Trial candidate `00002` では `暫定参照` は出なかったが、通常の `診察終了して会計へ送信` CTA が表示されなかった。
