# WEBORCA実データ反映チェックリスト（Reception評価用）

> 差し込み先案: `docs/verification-plan.md` の「4. 画面一覧と確認観点」または「8. 成果物定義（チェックリスト）」に追加。

## 1. WEBORCA実データ反映の対象（確認範囲）

- 患者: 患者ID/氏名/生年月日/性別/保険区分が ORCA 実データと一致
- 受付: 受付日時/受付区分/担当医/診療科が ORCA 実データと一致
- 会計: 送信状態/会計ステータス/エラー表示が ORCA 実データと整合
- 予約: 予約日時/予約枠/予約ステータスが ORCA 実データと一致

## 2. Reception検証の評価基準（短文チェックリスト）

- 患者検索結果が ORCA 実データと一致する
- 受付一覧の患者/日時/診療科/担当医が ORCA 実データと一致する
- 会計/送信状態が ORCA 実データに追従して更新される
- 予約一覧の表示が ORCA 実データと一致する
- 例外（未送信/エラー/保留）時の表示が ORCA 実データと整合する
- データ更新後の反映タイミング（即時/再取得）が仕様どおり

## 2.1 前提条件（未完検証のための具体条件）

- ORCA 実データ（受付済み/未受付）が存在していること。
- 受付送信に必要な ORCA 認証情報が有効であること（Basic + Facility ヘッダ）。
- Reception 画面で患者一覧が取得できること（`/orca/appointments/list` `/orca/visits/list` が 200）。
- WebORCA の接続先が確定していること（Trial/本番いずれか）。
- 施設ID/ユーザーIDが正しいこと（facility.json と一致）。

## 2.2 必要なユーザー権限 / シードデータ / 環境変数

- ユーザー権限:
  - `admin`（Reception/Charts の通常操作）
  - `system_admin`（Administration で ORCA 設定確認が必要な場合）
- シードデータ（ORCA 側）:
  - 受付済み患者 1 名（当日分）
  - 未受付患者 1 名（当日分、予約枠あり）
  - 送信失敗/保留状態の患者 1 名（例外表示確認用）
- 環境変数/設定（server-modernized 側）:
  - `ORCA_API_HOST` / `ORCA_API_PORT` / `ORCA_API_SCHEME`
  - `ORCA_API_USER` / `ORCA_API_PASSWORD`
  - `ORCA_MODE=weborca`（WebORCA 利用時）
  - `ORCA_API_PATH_PREFIX`（必要なら `/api` を明示）
  - `LOGFILTER_HEADER_AUTH_ENABLED=false`（認証モーダル回避が必要な場合）
  - `VITE_ENABLE_FACILITY_HEADER=1`（必要時）

## 2.3 再検証の最小データ条件（8.1.4）

- 患者:
  - 当日受付済み患者 1 名（保険区分あり）
  - 当日未受付患者 1 名（予約枠あり）
- 受付:
  - 当日分の受付データ 1 件（受付日時/診療科/担当医が明示）
- 会計:
  - 送信済み患者 1 名（会計ステータスが正常）
  - 送信失敗 or 保留状態の患者 1 名（例外表示確認用）
- 予約:
  - 当日予約枠 1 件（予約日時/枠/ステータスが参照可能）

## 2.4 UI / Network / ORCA レスポンス突合チェック

- UI:
  - Reception 一覧の患者ID/氏名/生年月日/性別/保険区分
  - 受付日時/区分/診療科/担当医
  - 会計ステータス（送信済み/失敗/保留）
  - 予約枠/予約ステータス（当日分）
- Network:
  - `/orca/appointments/list` `/orca/visits/list` が 200
  - 必要に応じて `/api/orca/queue` が 200
- ORCAレスポンス:
  - appointments/visits の該当患者レコードが UI と一致
  - 会計/送信状態が UI と一致

## 2.5 証跡フォーマット（最小）

- RUN_ID を必ず採番
- スクショ:
  - Reception 一覧（患者/受付/会計/予約の可視範囲）
- ログ:
  - ORCA レスポンス JSON（appointments/visits）
  - Network 200 のヘッダ or 要約ログ

## 2.6 WEBクライアント経由の実データ送信（最小手順）

1. Web クライアントで `admin` ロールのユーザーでログイン。
2. Reception 画面で対象患者を検索し、受付送信を実行。
3. 送信完了後、受付一覧に患者が反映されることを確認（受付日時/診療科/担当医）。
4. 会計ステータスが送信済み/保留など想定どおりであることを確認。
5. 予約枠/予約ステータスが UI に反映されていることを確認。
6. 必要に応じて `/api/orca/queue` を再取得し、送信キューの反映を確認。

## 2.7 期待結果（突合ポイント）

- 患者: ORCA 実データの患者ID/氏名/生年月日/性別/保険区分と UI 表示が一致。
- 受付: 受付日時/区分/診療科/担当医が ORCA 実データと一致。
- 会計: 送信状態/会計ステータス/エラー表示が ORCA 実データと一致。
- 予約: 予約枠/予約ステータスが ORCA 実データと一致。
- 例外: 送信失敗/保留の状態が UI に表示され、ORCA 応答と整合。

## 2.8 証跡フォーマット（実データ送信）

- RUN_ID: `YYYYMMDDTHHMMSSZ-weborca-accept`
- スクショ:
  - Reception 一覧（送信前/送信後）
  - 受付送信結果のバナー/トースト（表示があれば）
- ログ:
- Network: `appointments/list` / `visits/list` / `/api/orca/queue` のレスポンス
  - ORCA レスポンス JSON（患者/受付/会計/予約）
  - `/api/orca/queue` 応答（必要時）
- ORCA 側確認:
  - ORCA 画面 or API で受付送信が反映されていることを確認（確認方法をメモ）

## 2.6 実行記録テンプレ（verification-plan と共通）

- RUN_ID 命名: `YYYYMMDDTHHMMSSZ-{scenario}`（例: `20260204T112000Z-weborca-reception-send`）
- 証跡保存先: `artifacts/verification/{RUN_ID}/`
- 最小記録項目: 日時 / 環境 / MSW / 接続先 / 結果 / 証跡パス

| RUN_ID | 日時（開始/終了） | 環境（ORCA_MODE/ENV/Branch） | MSW | 接続先（trial/prod/host） | 結果 | 証跡パス |
| --- | --- | --- | --- | --- | --- | --- |
| 20260204T112000Z-weborca-reception-send | 2026-02-04 11:20〜11:35 | ORCA_MODE=weborca, ORCA_API_*, branch=main | off | dev or trial | 受付送信/再送の結果を記録 | `OpenDolphin_WebClient/artifacts/verification/20260204T112000Z-weborca-reception-send/` |

## 2.7 Dev ORCA 到達性チェックリスト（実行用）

前提条件:
- VPN 接続が有効（社内ネットワーク到達）
- 100.102.17.40:8000/443/8443 の FW 許可
- Dev ORCA が稼働中
- Basic 認証情報が有効
- `ORCA_MODE=weborca` / `ORCA_API_PATH_PREFIX` が正しい

チェック項目:
- [ ] ルート確認: `route -n get 100.102.17.40`（`utun` 経由）
- [ ] TCP 到達: `nc -vz 100.102.17.40 8000`
- [ ] HTTP 到達: `curl -v http://100.102.17.40:8000/`
- [ ] TLS 到達: `openssl s_client -connect 100.102.17.40:443 -servername 100.102.17.40`（必要時）
- [ ] ORCA 疎通: `curl -u <user>:<pass> ... /api01rv2/system01dailyv2`（HTTP200 / Api_Result=00）
- [ ] UI 経由: Vite proxy 経由で `/orca/visits/list` が 200

## 2.8 ORCA trial 接続ログ（acceptmodv2 実測）

- acceptmodv2/seed の実測は復旧検証の一部として扱う（詳細は verification-plan の該当節を参照）。
  - 20260204T050320Z-acceptmodv2-phys10001: Patient_ID=01414 / Physician_Code=10001 で Api_Result=00（受付登録成功）。

### acceptmodv2 復旧に必要な前提

- 接続/認証:
  - ORCA 接続先が到達可能（Trial/Dev/本番のいずれか）。
  - Basic 認証 + `X-Facility-Id` が正しいこと。
  - WebORCA 想定時は `ORCA_MODE=weborca` / `ORCA_API_PATH_PREFIX` を整合。
- seed/権限:
  - 医師/患者の seed が存在（最低1件ずつ）。
  - 受付送信に必要なロール/権限が付与。
- 環境変数:
  - `ORCA_API_HOST/PORT/SCHEME` または `ORCA_BASE_URL`
  - `ORCA_API_USER/PASSWORD`
  - `VITE_DISABLE_MSW=1` / `VITE_DEV_PROXY_TARGET`（web-client 経由）

### Trial 不可の場合の本番想定計画

1. 本番相当 ORCA の接続先/認証/施設ID を運用担当から共有。
2. `system01dailyv2` が 200/Api_Result=00 であることを確認。
3. 本番相当の患者/医師 seed を最低限用意し、受付送信対象の患者IDを確定。
4. web-client を本番相当の接続先に向けて起動（MSW 無効）。
5. 受付送信（acceptmodv2）を実施し、UI/Network/ORCA 応答の証跡を保存。

## 2.9 WEBORCA実データ送信（web-client経由）準備チェックリスト

目的: Reception の「受付送信」で WebORCA 実データを送信できる状態を整える（MSW 無効・実 ORCA 接続）。

前提条件:
- ORCA 接続先/認証: `docs/server-modernization/operations/ORCA_CERTIFICATION_ONLY.md` に従い設定済み。
- server-modernized が ORCA 接続可能（`ORCA_API_HOST/PORT/SCHEME` または `ORCA_BASE_URL` + `ORCA_API_USER/PASSWORD`）。
- WebORCA 想定時は `ORCA_MODE=weborca`（または `ORCA_API_WEBORCA=1`）で `/api` 付与が有効。
- Web クライアントでログイン可能なユーザー（`admin`/`doctor`）が存在。
- 施設ID（`X-Facility-Id`）が確定し、ログイン時に反映されること。

起動/設定チェック:
- [ ] server-modernized 起動ログで ORCA 設定が反映されていること（`ORCA_*` の set/unset を確認）
- [ ] `VITE_DISABLE_MSW=1` で web-client を起動
- [ ] `VITE_DEV_PROXY_TARGET` が server-modernized の `/openDolphin/resources` を指す
- [ ] ログイン後に DevTools で `Authorization` ヘッダが付与されていること
- [ ] `/orca/appointments/list` `/orca/visits/list` が 200 で返ること

送信準備（Reception）:
- [ ] 受付対象の患者が ORCA 側に存在（当日分の患者 ID が分かる）
- [ ] 受付送信フォームの必須項目（患者ID/保険区分/来院区分）が入力できる
- [ ] 送信ボタン押下時に Network へ実リクエストが送出される（MSW ではない）

実施直前チェックリスト（実データ送信）:
- [ ] RUN_ID を採番（`YYYYMMDDTHHMMSSZ-weborca-reception-send`）
- [ ] 送信前の Reception 一覧をスクショ保存
- [ ] 送信後のバナー/一覧更新をスクショ保存
- [ ] Network の該当リクエスト/レスポンスを保存（headers/body）

## 2.10 実行可否判定（2026-02-04）

- 判定: 不可
- ブロッカー:
  - ORCA 認証情報/施設IDが未共有（Basic + `X-Facility-Id`）。
  - Dev ORCA（100.102.17.40:8000）は到達不可。
  - 実行環境の `ORCA_*` / `VITE_*` が未設定。
  - ORCA 実データの有無が未確認（`/orca/appointments/list` `/orca/visits/list` の実データ確認が必要）。
- 解決手順（最小）:
  1. ORCA 認証情報/施設IDを共有し、server-modernized に設定。
  2. VPN/FW/Dev ORCA 稼働を確認して到達性を回復。
  3. ORCA 実データを確認（`/orca/appointments/list` `/orca/visits/list` が 200 かつ実データあり）。
  4. web-client を `VITE_DISABLE_MSW=1` で起動し、`/orca/appointments/list` `/orca/visits/list` が 200 であることを確認。
  5. Reception から送信/再送操作を実行し、RUN_ID/証跡（Network/スクショ）を保存。

## 3. verification-plan.md 差し込み用文案

### WEBORCA実データ反映（Reception評価チェックリスト）

- 患者: ID/氏名/生年月日/性別/保険区分が ORCA 実データと一致する
- 受付: 受付日時/区分/診療科/担当医が ORCA 実データと一致する
- 会計: 送信状態/会計ステータス/エラー表示が ORCA 実データと整合する
- 予約: 予約日時/予約枠/ステータスが ORCA 実データと一致する
- 例外: 未送信/エラー/保留の表示が ORCA 実データと整合する
- 反映: データ更新後の反映タイミングが仕様どおり
