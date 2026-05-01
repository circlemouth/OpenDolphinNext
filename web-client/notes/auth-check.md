# Auth/主要画面 簡易確認メモ (current contract)

- 日時: 2026-03-27
- 環境: デフォルト(`.env.sample` 相当), `VITE_*` 未上書き, `WEB_CLIENT_MODE=npm`

## current auth contract
- `LoginScreen` は `POST /session/login` に `facilityId`, `userId`, `password`, `clientUuid` を JSON で送信する。
- サーバーが二要素認証を要求した場合のみ `POST /session/login/factor2` に 6 桁コードを送る。
- 成功時は session が rotate され、auth session registry に登録される。
- `factor2` は TOTP 前提で、pending session の期限切れや試行上限で失効する。
- この runtime では旧認証切替の env switch は使わない。

## smoke notes
- 旧 Basic / 旧認証経路の説明は current contract ではないため、このファイルからは除去した。
- デモ / stub endpoint は別契約で扱う。

## single facility login
- `OPENDOLPHIN_SINGLE_FACILITY_MODE=true` / `VITE_SINGLE_FACILITY_LOGIN=1` の単一施設モードでは、画面上の施設ID入力欄を表示しない。
- クライアントは `facilityId` をログイン payload から省略し、サーバーは `OPENDOLPHIN_FACILITY_ID` を権威として解決する。不一致の client-provided `facilityId` は拒否する。
- 起動例: `OPENDOLPHIN_FACILITY_ID=1.3.6.1.4.1.9414.72.103 OPENDOLPHIN_SINGLE_FACILITY_MODE=1 WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`
