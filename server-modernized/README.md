# server-modernized 運用メモ

## ORCA POST 系の既定動作
- subjectives（`/api/orca/chart/subjectives`）を含む current ORCA POST 連携は **常に実運用モード** で動作する。
- `stub/real` 切替の互換設定、feature flag、filter は削除済みであり、環境変数やシステムプロパティで stub 応答へ切り替えることはできない。
- 検証時は ORCA 接続設定そのものを正しく投入し、WebORCA Trial など現行接続先で疎通確認する。

## Web client 連携のセキュリティ運用契約（2026-03）
- backend 先行 → frontend 後続でデプロイする（逆順禁止）。
- `index.html` の `meta[name="csrf-token"]` は `__CSRF_TOKEN__` を実トークンへ置換し、`Cache-Control: private, no-store` を適用する。
- unsafe method（`POST/PUT/PATCH/DELETE`）の CSRF 検証は `fetch` と `XMLHttpRequest`（upload）を同一条件で扱う。
- `POST /api/logout` は `credentials` + CSRF を前提に冪等で処理する。
- 画像ヘッダは `X-Client-Feature-Images` のみを受け入れ、旧 `X-Feature-Images` は廃止する。
- session cookie は `Secure` / `HttpOnly` / `SameSite=Lax` を前提に配信する。
- 本番相当環境は HTTPS 前提で運用し、TLS 終端の前段プロキシがある場合も `Forwarded` / `X-Forwarded-*` を正しく渡す。
- `Authorization: Basic` の fallback 認証は廃止済みであり、session / container principal のみを認証根拠として扱う。
- ORCA credential は server 側設定からのみ供給する。hard-coded default は存在せず、未設定時は fail-closed で応答する。
- 詳細チェックリスト: `docs/web-client/operations/security-rollout-checklist-20260304.md`
