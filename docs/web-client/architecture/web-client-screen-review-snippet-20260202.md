# 画面レビュー表 差し込み本文案（ドラフト）

## 差し込み位置案
- `docs/web-client/planning/phase2/WEB_CLIENT_IMPLEMENTATION_PLAN.md` の **「1. 前提・インプット」直後**または**「2. 画面別の必須機能と仕様」冒頭**に「画面一覧・確認観点」節として差し込む。

## 画面一覧・確認観点（概要）
本節は、画面ごとの **ルート / 主要機能 / 主要API / データ整合 / エラー時挙動** を一覧化し、確認観点を最小の粒度で共有するためのものです。詳細は `docs/web-client/architecture/web-client-screen-review-template.md` を参照してください。

## 表のサンプル行

| 画面 | ルート | 主要機能 | 主要API | データ整合 | エラー時挙動 |
| --- | --- | --- | --- | --- | --- |
| Login | `/login`<br>`/f/:facilityId/login` | 施設/ユーザー/パスワード/UUID入力、LoginSwitchNotice | `/api/user/{facilityId}:{userId}` | RUN_ID生成/保存、session/localStorage共有、facilityIdロック | 認証失敗の表示、セッション失効でログアウト + 監査 |
| Reception | `/f/:facilityId/reception` | ステータス別一覧、検索/フィルタ、保存ビュー、ORCA queue/再送 | `/api/orca/appointments/list`<br>`/api/orca/visits/*`<br>`/api/orca/queue` | Patientsとフィルタ同期、auto-refresh=90s/stale=180s、監査メタ反映 | ApiFailureBanner、missingMaster復旧ガイド、再取得導線 |
| Charts | `/f/:facilityId/charts` | 3カラム+ドロワー、DocumentTimeline、送信/印刷、SSE | `/karte/*`<br>`/odletter/*`<br>`/api/orca/*`<br>`/api/orca/chart-support/medical-mod-v2`<br>`/chart-events` | patientId/returnTo引継ぎ、送信ガード、SSE欠損時再同期 | ApiFailureBanner、missingMaster復旧ガイド、送信失敗トースト+バナー |

## 要確認事項（短く）
- `/f/:facilityId/outpatient-mock` の扱い（AppRouter は `/debug/outpatient-mock` のみ許可）。
- Administration の直アクセスガード仕様（旧資料と現行実装の整合）。
- Administration の詳細設計ドキュメント有無。
- returnTo を含む詳細遷移図の不足。
