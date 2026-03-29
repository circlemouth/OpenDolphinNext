# 00 RUN_ID と参照確認

- RUN_ID: `20251229T220416Z`
- 期間: 2025-12-30 09:00 〜 2025-12-31 09:00 (JST) / 優先度: high / 緊急度: high / エージェント: codex
- YAML ID: `web-client/src/webclient_facility_prefix/00_RUN_IDと参照確認.md`

## 目的
- webclient facility prefix plan 20251229 の開始 RUN_ID を明文化し、以降の証跡・ログで同一値を使用する。
- 参照順を固定し、実装対象を Web クライアントに限定する。

## RUN_ID ルール
- RUN_ID は `YYYYMMDDThhmmssZ`（UTC）で採番する。
- 同一ガント期間に派生 RUN を作成する場合は、親 RUN_ID（本ファイル）を備考とログ先頭に明記する。

## 参照順（必読）
1. `docs/README.md`
2. `web-client/src/AppRouter.tsx`
3. `web-client/src/LoginScreen.tsx`
4. 本ガント（本ファイル）

## 対象スコープ
- 変更対象は `web-client/` のみ。
- `server/` は参照専用。

## ローカル検証（前提）
- 起動: `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`
- ログイン情報: `setup-modernized-env.sh` 記載のものを使用する。
