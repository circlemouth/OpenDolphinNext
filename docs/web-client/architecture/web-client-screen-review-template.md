# Webクライアント 画面一覧・確認観点テンプレ（差し込み用）

> 目的: 最終計画書に差し込める **画面一覧 + 確認観点** のテンプレ。
> 参照: `docs/web-client/architecture/web-client-emr-design-integrated-20260128.md` / `docs/web-client/architecture/web-client-screen-structure-decisions-20260106.md` / `web-client/src/AppRouter.tsx` / `docs/web-client/architecture/web-client-api-mapping.md`

## 差し込み位置案
- `docs/web-client/planning/phase2/WEB_CLIENT_IMPLEMENTATION_PLAN.md` の **「1. 前提・インプット」直後**または**「2. 画面別の必須機能と仕様」冒頭**に「画面一覧・確認観点」節として差し込む。

## 画面一覧・確認観点（テンプレ）

| 画面 | ルート | 主要機能 | 主要API | データ整合 | エラー時挙動 |
| --- | --- | --- | --- | --- | --- |
| Login | `/login`<br>`/f/:facilityId/login` | 施設/ユーザー/パスワード/UUID入力、LoginSwitchNotice、成功で `/f/:facilityId/reception` | `/api/user/{facilityId}:{userId}` | RUN_ID生成/保存、sessionStorage/localStorage共有、facilityIdロック | 認証失敗の表示、セッション失効イベントでログアウト + 監査 |
| Reception | `/f/:facilityId/reception` | ステータス別一覧、検索/フィルタ、保存ビュー、右パネル患者サマリ、ORCA queue/再送、当日受付登録/取消 | `/api/orca/appointments/list`<br>`/api/orca/visits/list`<br>`/api/orca/visits/mutation`<br>`/api/orca/queue` | Patientsとフィルタ同期、auto-refresh=90s/stale=180s、監査メタ反映、送信/再送状態一致 | ApiFailureBanner(401/403/404/5xx/network)、missingMaster復旧ガイド、cacheHit=false時の再取得 |
| Charts | `/f/:facilityId/charts` | 3カラム+ドロワー、DocumentTimeline/SOAP/送信/ドラフト/印刷、SSE、ORCA原本/オーダー束/画像 | `/karte/*`<br>`/odletter/*`<br>`/api/orca/disease/*`<br>`/karte/diagnosis`<br>`/api/orca/order/bundles`<br>`/api/orca/tensu/*`<br>`/api/orca/general/*`<br>`/api/orca/inputset`<br>`/api/orca/interaction`<br>`/api/orca/chart-support/medical-mod-v2`<br>`/api/orca/chart-support/medical-mod-v23`<br>`/api/orca/chart-support/income-info`<br>`/api/orca/pusheventgetv2`<br>`/api01rv2/*`<br>`/blobapi/{dataId}`<br>`/karte/images`(`iamges` fallback)<br>`/karte/image`<br>`/karte/attachment`<br>`/chart-events` | patientId/returnToの引継ぎ、送信ガード(missingMaster/fallback/権限)、Reception送信状態との整合、SSE欠損時の再同期 | ApiFailureBanner、missingMaster復旧ガイド、送信失敗トースト+バナー、印刷データ欠損時の案内 |
| Patients | `/f/:facilityId/patients` | フィルタ/保存ビュー、患者一覧、基本/保険/公費/メモ/監査ログ/ORCA原本 | `/api/orca/patients/local-search`<br>`/patient/name`<br>`/patient/kana`<br>`/patient/id`<br>`/api/orca/patient/mutation`<br>`/patient`<br>`/karte/memo`<br>`/api/orca/patientgetv2` | Receptionとフィルタ同期、ORCA原本XML/JSON切替、operation監査、fallbackUsed時の保存ブロック | ApiFailureBanner、missingMaster復旧ガイド、入力バリデーション統一 |
| Administration | `/f/:facilityId/administration` | system_admin専用、設定配信/同期差分、ORCA queue操作、Legacy REST疎通、Touch/ADM/PHR接続 | `/api/admin/config`<br>`/api/admin/delivery`<br>`/api/orca/queue`<br>`/api/orca51/masterlastupdatev3`<br>`/api/api01rv2/systeminfv2`<br>`/api/api01rv2/system01dailyv2`<br>`/api/orca21/medicalsetv2`<br>`/api/api01rv2/*`(XML proxy)<br>`/api/orca/*`<br>`/touch/*` `/adm/*` `/phr/*`<br>Legacy REST endpoints | 配信内容のAdminBroadcast反映、queue操作がReception/Chartsへ反映、Legacy REST監査メタ(screen/action/endpoint/legacy) | 権限不足の拒否画面、ApiFailureBanner、Legacy REST 2xx/4xx/5xx表現 |
| Charts Print | `/f/:facilityId/charts/print/outpatient`<br>`/f/:facilityId/charts/print/document` | 外来/文書印刷プレビュー、`window.print()` | Charts系の文書/印刷参照API | 患者/施設コンテキスト一致、印刷内容とCharts最新状態一致 | データ欠損・未選択時の案内 |
| Debug (Hub) | `/f/:facilityId/debug` | Debug導線ハブ（本番ナビ外） | - | ENV+role条件のみ表示 | 権限/ENV無効時の拒否表示 |
| Debug (Outpatient Mock) | `/f/:facilityId/debug/outpatient-mock` | MSW/故障注入/telemetry検証 | `/api/orca/medical/outpatient` ほか | フラグ注入の監査/telemetry整合 | 権限/ENV無効時の拒否表示 |
| Debug (ORCA API) | `/f/:facilityId/debug/orca-api` | ORCA API コンソール | ORCA API エンドポイント | 監査メタ | 権限/ENV無効時の拒否表示 |
| Debug (Legacy REST) | `/f/:facilityId/debug/legacy-rest` | Legacy REST コンソール | Legacy REST endpoints | `payload.legacy=true`/endpoint明記 | 2xx/4xx/5xx 表現、content-type 表示切替 |
| Guard/Redirect | `/f/:facilityId` (index)<br>`*` legacy routes | index→reception、旧URL正規化、facilityId不一致拒否 | - | facilityId境界/セッション境界の一致 | 未ログインは/login、facility不一致は拒否画面 |

## 要確認事項（別枠）
- `/f/:facilityId/outpatient-mock` の扱い: 画面構成棚卸し資料では存在するが、AppRouter は `/f/:facilityId/debug/outpatient-mock` のみ許可し `/outpatient-mock` は NotFound 扱い。ドキュメント差分の整理が必要。
- Administration の直アクセスガード: 旧棚卸し資料では「URL直アクセス遮断は未実装」と記載があるが、AppRouter の `AdministrationGate` は system_admin 以外を拒否。現状仕様の整合が必要。
- Administration の詳細設計ドキュメント: Reception/Charts/Patients と同レベルの詳細設計が存在するか未確認（統合設計のみ）。
- 画面遷移図: 最小/拡張の文章図以外に、returnTo や Patients↔Charts の詳細遷移図が不足。
