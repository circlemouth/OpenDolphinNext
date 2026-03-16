# Webクライアント 電子カルテ設計（実装整合・統合版）

- RUN_ID: 20260130T125310Z
- 更新日: 2026-01-30
- 対象: 外来（Reception / Charts / Patients / Administration）+ Login + Debug（本番ナビ外）
- 差分理由: Reception/Charts/Patients の画面別詳細設計ドキュメントへの参照を追加した。

## 0. 目的と前提
本書は、既存設計と **現行の Web クライアント実装** を突合し、今後採用する「最適な実装仕様」を定義する。
作業工程の分解は別ドキュメントで行うため、ここでは **「どのように実装するか（構成・仕様・機能粒度）」** を明確にする。

- 正本: `docs/DEVELOPMENT_STATUS.md`
- Webクライアント現行ハブ: `docs/web-client/CURRENT.md`
- ORCA 実環境接続の正本: `docs/server-modernization/operations/ORCA_CERTIFICATION_ONLY.md`
- server-modernized の現行 API で実現可能な範囲のみを対象とする。
- 旧来クライアント（`client/`）は参照のみ。
- 外来スコープのみ（入院は対象外）。
- Phase2 文書は Legacy/Archive（参照専用）。

## 0.1 使いやすさの共通方針
- 画面上部で、いまの状態（対象・更新時刻・ロック）と、次にできることを確認できるようにする。
- 画面間を行き来しても作業が途切れないように、検索条件と復帰導線を維持する。
- 失敗時は、原因の切り分けと復旧手順を同じ形式で出し、再試行の場所を迷わせない。
- 監査性は運用の安心につながるため、RUN_ID と主要イベントは各画面で見つけやすくする。

## 0.2 画面間の基本動線（外来）
外来の作業は、受付で対象を見つけ、カルテで記録と送信を行い、必要に応じて患者情報を修正して戻る、という往復が中心になる。
このため、Reception と Patients は検索条件を引き継ぎ、Patients は returnTo を保持して Charts に戻れるようにする。

## 1. 統合・参照したドキュメント / 実装参照
### 1.1 ドキュメント
- `docs/web-client/architecture/web-client-screen-structure-decisions-20260106.md`
- `docs/web-client/architecture/web-client-screen-structure-master-plan-20260106.md`
- `docs/web-client/architecture/future-web-client-design.md`
- `docs/web-client/ux/charts-claim-ui-policy.md`
- `docs/web-client/ux/reception-schedule-ui-policy.md`
- `docs/web-client/ux/patients-admin-ui-policy.md`
- `docs/web-client/ux/charts-compact-layout-proposal-20260110.md`
- `docs/web-client/architecture/doctor-workflow-status-20260120.md`
- `docs/web-client/architecture/patient-image-management-status-20260120.md`
- `docs/web-client/architecture/document-embedded-attachment-policy.md`
- `docs/server-modernization/MODERNIZED_REST_API_INVENTORY.md`
- `docs/server-modernization/orca-additional-api-implementation-notes.md`

### 1.2 現行実装の主要参照（コード）
- `web-client/src/AppRouter.tsx`（ルーティング/共通シェル/権限ガード）
- `web-client/src/LoginScreen.tsx`（ログイン仕様）
- `web-client/src/features/reception/pages/ReceptionPage.tsx`
- `web-client/src/features/charts/pages/ChartsPage.tsx`
- `web-client/src/features/patients/PatientsPage.tsx`
- `web-client/src/features/administration/AdministrationPage.tsx`
- `web-client/src/features/shared/ChartEventStreamBridge.tsx`（SSE）
- `web-client/src/features/shared/ApiFailureBanner.tsx` / `MissingMasterRecoveryGuide.tsx`
- `web-client/src/features/debug/DebugHubPage.tsx` / `OutpatientMockPage.tsx`

## 2. 実装方針の優先順位（衝突時の判断）
1. `docs/DEVELOPMENT_STATUS.md`
2. `docs/web-client/architecture/web-client-screen-structure-decisions-20260106.md`
3. 本書（実装計画書）
4. 現行実装（`web-client/src`）
5. 個別 UX ポリシー・将来設計・提案ドキュメント

> 画面構成の決定事項は **先に decision 文書を更新**し、本書へ反映する。
> 現行実装は「事実ベースライン」として尊重するが、本書で差分・変更方針を明示した部分は本書を優先する。

## 3. グローバル設計（実装方針）

### 3.1 ルーティング/ナビゲーション
- **施設プレフィックス**: `/f/:facilityId/*` を主導線として固定。
- **入口**: `/login` → Facility 解決 → `/f/:facilityId/login`。
- **メイン画面**: `/f/:facilityId/reception` / `/f/:facilityId/charts` / `/f/:facilityId/patients` / `/f/:facilityId/administration`。
- **印刷**: `/f/:facilityId/charts/print/outpatient` / `/charts/print/document`。
- **Debug**: `/f/:facilityId/debug/*` に隔離（本番ナビ外）。
- **旧URL**: `LegacyRootRedirect` で `/f/:facilityId/*` へ正規化。
- **ベースパス**: `VITE_BASE_PATH` を考慮。

### 3.2 共通 UI シェル
- **トップバー**: ブランド/施設/ユーザー/role/RUN_ID/切替/ログアウト。
- **左ナビ**: 受付 → カルテ → 患者 → 管理（管理は `system_admin` のみ有効、非system_adminは無効表示）。
- **RUN_ID 表示**: クリックでコピー、通知バナーでも更新通知。
- **通知スタック**: 成功/警告/失敗トースト（最大3件）。

### 3.3 セッション/権限/境界
- セッションは `sessionStorage` に保存し、RUN_ID を観測メタへ同期。
- facilityId 不一致は **拒否画面**を表示。
- Login 画面への再アクセスは **切替導線**に誘導（監査ログ付き）。
- `system_admin` 以外は Administration 画面をブロック（ナビ無効化 + 直接アクセス拒否の両面で gate）。

### 3.4 観測・監査
- `runId`/`traceId` を API ヘッダーと UI に伝播。
- 主要操作（保存/送信/配信/再送/権限ブロック）は監査ログに記録。
- **AuthService flags**: `runId` / `cacheHit` / `missingMaster` / `dataSourceTransition` / `fallbackUsed` を共通扱い。
- 複数タブ間は shared storage で flags を同期。

### 3.5 エラー/復旧/自動更新
- `ApiFailureBanner` により 401/403/404/5xx/Network の共通復旧導線を統一。
- `missingMaster` 時は **復旧ガイド**を表示し、再取得/受付/管理者共有を促す。
- 自動更新は **OUTPATIENT_AUTO_REFRESH_INTERVAL_MS=90_000（90秒）** に固定（Reception / Patients 共通）。
- stale 判定は **2x（180秒）** で警告バナーを表示。
- 手動更新は監査ログへ記録。
- **MissingMasterRecoveryGuide 配置ルール**: 画面内の最上部に配置し、主要なバナー群（AdminBroadcast/AutoRefresh/ToneBanner/ApiFailureBanner）の**直下**、詳細コンテンツ（一覧/フォーム/詳細カード）の**直前**に置く。
- **復旧導線の順序**: 「バナー → 復旧導線 → 詳細」を基本順とし、Reception/OrcaSummary/DocumentTimeline/Patients でこの順序を維持する。

### 3.6 配信/運用ブロードキャスト
- `AdminBroadcast` を localStorage で共有し、Reception/Charts/Patients へ反映。
- 配信内容: `chartsDisplayEnabled` / `chartsSendEnabled` / `chartsMasterSource` / ORCA queue 状態など。
- 受信側はバナー通知 + 明示メタ表示。

### 3.7 リアルタイム更新（SSE）
- `/chart-events` を基軸に ChartEventStream を常時起動。
- **欠損検知**時は再同期（リプレイ）を実施し、失敗時は警告を表示。
- SSE が不安定な環境でも UI が崩れないよう **静的更新 + 手動再取得**でフォールバック。

### 3.8 表示・文言の統一（迷いを減らすための約束）
- 画面やパネルの呼び方は、ナビ名と一致させる（Reception / Charts / Patients / Administration）。
- 同じ状態は、同じ言葉で出す（例：編集不可、承認済み、タブロック）。
- 無効化の理由は短い文で示し、必要なら復旧ガイドへの導線を添える。
- 日付は ISO 形式を基本とし、入力欄では例を出して迷いを減らす。

### 3.9 画面間で引き継ぐもの（実装メモ）
- RUN_ID はログイン時に生成し、以後の画面と API へ伝播する。
- 検索条件は、Reception と Patients で localStorage を使って持ち回る。
- Charts は URL の carry を使って patientId などを受け取り、画面内の表示と監査に反映する。

### 3.10 横断UIレビュー反映（RUN_ID=20260130T121758Z）
#### 3.10.1 統一した文言・導線
- 自動更新の stale バナー文言を統一:
  - Reception: 「受付一覧の自動更新が止まっています。最終更新: <timestamp>。再取得してください。」
  - Patients: 「患者一覧の自動更新が止まっています。最終更新: <timestamp>。再取得してください。」
- 空状態の文言を統一:
  - Reception: 「0件です。日付やキーワードを見直してください。ヒント: 診療科・担当医・保険/自費を先に絞ると探しやすくなります。」
  - Patients: 「0件です。キーワードを見直してください。ヒント: ID/氏名/カナ・診療科・担当医で絞れます。」
- 送信失敗表示の統一:
  - Charts: トースト「ORCA送信に失敗」＋バナー「ORCA送信に警告/失敗」。
  - Reception: 一覧の送信状態は「送信: 失敗」＋「再送待ち」で表現。
- Missing Master 復旧導線の統一: 「再取得 → Reception → 管理者共有」をガイド見出し/ステータス詳細/nextAction に反映。

#### 3.10.2 画面間導線の確認
- Missing Master 時の次アクションは全画面で「再取得 → Reception → 管理者共有」に統一。
- Reception ↔ Patients の保存ビュー共有と Charts への復帰導線は確認済み（変更なし）。
- Charts 送信失敗時の再送は `/api/orca/queue?retry=1` に統一（確認済み）。

#### 3.10.3 回帰確認（主要シナリオ）
- 自動更新（stale）: `tests/e2e/outpatient-auto-refresh-banner.spec.ts` PASS。
- エラー復旧（401/403/404/5xx/network）: `tests/e2e/outpatient-generic-error-recovery.msw.spec.ts` PASS。
- 再送（送信失敗→再送キュー→Reception反映）: `tests/e2e/charts/e2e-orca-claim-send.spec.ts`（grep「再送キュー」、`PLAYWRIGHT_DISABLE_MSW=1`）PASS。
- 付帯: `web-client/src/features/shared/__tests__/missingMasterRecovery.test.ts` PASS。

#### 3.10.4 スクリーンショット更新範囲
- MissingMasterRecoveryGuide（Charts/Patients）: 見出しが「再取得 → Reception → 管理者共有」に更新されたため差し替え対象。
- StatusBadge の復旧導線文言（Reception/Charts/Patients）: 「復旧導線: 再取得 → Reception → 管理者共有」を表示する状態。
- 自動更新停止バナー（Reception/Patients）: 「止まっています」表記のスクショが必要な場合は更新。
- 空状態（Reception/Patients）: 「0件です」文言のスクショが必要な場合は更新。
- Charts 送信失敗トースト/バナー、Reception の送信失敗/再送待ち行: 送信失敗の状態スクショがある場合は更新。

#### 3.10.5 証跡/成果物の扱い
- HAR/動画/スクリーンショットはローカル成果物として `artifacts/webclient/e2e/<RUN_ID>/` と `artifacts/webclient/orca-e2e/<RUN_ID>/` に生成し、リポジトリ肥大化を避けるためコミット対象外とする（必要時に再生成）。

#### 3.10.6 回帰確認の再現手順（RUN_ID=20260130T125310Z）
**前提**
- Node.js 依存がインストール済み（未導入の場合は `cd web-client && npm install`）。
- MSW 検証は `VITE_DEV_PROXY_TARGET` を未設定（msw プロファイル）で実行。
- Playwright の webServer は `localhost:4173` を使用（`PLAYWRIGHT_BASE_URL` で任意に上書き可）。

**実行コマンド（再現用）**
1) 単体テスト（Missing Master 復旧導線）
```bash
cd web-client
npm test -- --run src/features/shared/__tests__/missingMasterRecovery.test.ts
```
2) 自動更新（stale）バナー
```bash
cd ..
RUN_ID=20260130T125310Z npx playwright test tests/e2e/outpatient-auto-refresh-banner.spec.ts
```
3) エラー復旧（401/403/404/5xx/network）
```bash
RUN_ID=20260130T125310Z npx playwright test tests/e2e/outpatient-generic-error-recovery.msw.spec.ts
```
4) 再送（送信失敗→再送キュー→Reception反映）
```bash
RUN_ID=20260130T125310Z PLAYWRIGHT_DISABLE_MSW=1 npx playwright test tests/e2e/charts/e2e-orca-claim-send.spec.ts --grep "再送キュー"
```

**環境変数メモ**
- `PLAYWRIGHT_DISABLE_MSW=1` の場合は MSW を無効化し、テスト内の route stub を使用する。
- `VITE_DEV_USE_HTTPS=1` を付与すると webServer が https で起動し、`PLAYWRIGHT_BASE_URL` を未指定でも `https://localhost:4173` を使用する。
- 軽量ログ: `docs/web-client/operations/ui-review-regression-20260130.md`。

## 4. 画面別 実装方針

### 4.1 Login
**実装方針**
- 入力: 施設ID / ユーザーID / パスワード / clientUUID。
- `/api/user/{facilityId}:{userId}` でログイン検証。
- 認証は **Basic** を優先し、Legacy ヘッダ認証は `VITE_ENABLE_LEGACY_HEADER_AUTH=1` の場合に強制またはフォールバックする。
- `VITE_ALLOW_LEGACY_HEADER_AUTH_FALLBACK=1` の場合のみ Basic 失敗時に限定フォールバックを許可する。
- RUN_ID をログイン時に生成し、以後の画面へ伝播。
- ログイン成功後は `/f/:facilityId/reception` へ遷移。

**設計調整点**
- API は `/user/{userId}` ではなく `/api/user/{facilityId}:{userId}` を正とする。

### 4.2 Reception（受付）
**実装方針**
- 受付/診療/会計/予約の **ステータス別リスト**を縦積み表示。
- フィルタ: キーワード（ID/氏名/カナ）、診療科、担当医、保険/自費。
- **保存済みビュー**をローカル保存し、Patients と状態連携。
- 右パネルに患者サマリ（保険・直近受診・メモ・トーン）を表示。
- ORCA queue 状態/再送状況/例外リストを専用パネルで可視化。
- 予約外当日受付（acceptmodv2）を画面内フォームで実行（登録/取消のみ）。

**設計調整点**
- 自動更新は 30 秒ではなく **90 秒**。
- 受付操作は **登録/取消のみ**をフォームで実施し、参照/照会は一覧検索で行う。

**利用API（主要）**
- 受付/予約: `/api/orca/appointments/list`, `/api/orca/visits/list`, `/api/orca/visits/mutation`
- 受付トーン/請求: `/api/orca/queue` + 送信キャッシュ
- ORCA queue: `/api/orca/queue`

**詳細設計（画面別ドキュメント）**
- `docs/web-client/architecture/web-client-emr-reception-design-20260128.md`

### 4.3 Charts（カルテ）
**実装方針**
- **トップバー**: 患者サマリ + RUN_ID/トーン/監査メタを集約。
- **Action Bar**: 診療終了 / ORCA送信 / ドラフト保存 / 印刷。
- **3カラム構成**
  - 左: 患者タブ（検索/履歴）+ 病名編集。
  - 中央: SOAP入力 + DocumentTimeline。
  - 右: 患者メモ + OrcaSummary + ORCA原本 + MedicalOutpatientRecord + Telemetry。
- **ユーティリティドロワー**: 病名/オーダー束/文書/画像/検査/その他を必要時に展開。
- 送信は `missingMaster` / `fallbackUsed` / `chartsMasterSource` をガードして制御。
- 編集ロック・承認確認・監査ログを必須化。

**設計調整点**
- 旧設計の「上部タブ」ではなく **セクション移動 + ドロワー方式**を採用。
- SSE（ChartEventStream）は **実装済み**のため、計画外ではなく標準機能として扱う。

**利用API（主要）**
- 文書/カルテ: `/karte/*`, `/odletter/*`
- 病名: `/api/orca/disease/*`, `/karte/diagnosis`
- オーダー束: `/api/orca/order/bundles`
- マスタ/相互作用: `/api/orca/tensu/*`, `/api/orca/general/*`, `/api/orca/inputset`, `/api/orca/interaction`
- 送信/会計: `/api/orca/chart-support/medical-mod-v2`, `/api/orca/chart-support/medical-mod-v23`, `/api/orca/chart-support/income-info`
- ORCAイベント: `/api/orca/pusheventgetv2`
- 帳票: `/api01rv2/*` + `/blobapi/{dataId}`
- 画像: `/karte/images`（正）/ `/karte/iamges`（typo 互換フォールバック）, `/karte/image`, `/karte/attachment`
- SSE: `/chart-events`

**詳細設計（画面別ドキュメント）**
- `docs/web-client/architecture/web-client-emr-charts-design-20260128.md`

### 4.4 Patients（患者）
**実装方針**
- 左: フィルタ + 保存済みビュー。
- 中央: 患者一覧（ID/氏名/保険/未紐付）。
- 右: 患者基本情報/保険/公費/メモ/監査ログ/ORCA原本表示。
- Reception ↔ Patients のフィルタ同期と復帰導線を維持。
- バリデーションは UI 側で強制し、失敗は共通バナーで復旧導線を提示。

**設計調整点**
- ORCA 原本は `patientgetv2` を **XML/JSON 切替で可視化**。

**利用API（主要）**
- 患者検索: `/api/orca/patients/local-search`, `/patient/name`, `/patient/kana`, `/patient/id`
- 患者更新: `/api/orca/patient/mutation`, `/patient`
- 患者メモ: `/karte/memo`
- ORCA原本: `/api/orca/patientgetv2`

**詳細設計（画面別ドキュメント）**
- `docs/web-client/architecture/web-client-emr-patients-design-20260128.md`

### 4.5 Administration（管理）
**実装方針**
- **system_admin 専用画面**としてガード（ナビ無効化 + 直接アクセス拒否の両面で gate）。
- 設定配信/同期状況を可視化し、差分検知を明示。
- ORCA queue 操作（再送/破棄）と状態監視を統合。
- ORCA 追加 API: XML Proxy / 内製 Wrapper / Touch ADM/PHR の疎通導線を実装済み。
- Legacy REST 疎通パネルを保持（debug・admin 両方）。

**利用API（主要）**
- 設定配信: `/api/admin/config`, `/api/admin/delivery`
- ORCA queue: `/api/orca/queue`
- ORCA master/system: `/api/orca51/masterlastupdatev3`, `/api/api01rv2/systeminfv2`, `/api/api01rv2/system01dailyv2`, `/api/orca21/medicalsetv2`
- ORCA XML Proxy: `/api/api01rv2/acceptlstv2`, `/api/api01rv2/system01lstv2`, `/api/orca101/manageusersv2`, `/api/api01rv2/insprogetv2`
- ORCA internal wrapper: `/api/orca/*` 連携系（tensu-sync, medical-records 等）
- Touch/ADM/PHR: `/touch/*`, `/adm/*`, `/phr/*`

### 4.6 Debug / QA 導線（本番ナビ外）
**実装方針**
- `VITE_ENABLE_DEBUG_PAGES=1` かつ `system_admin` のみ **表示・アクセス可能**。
- Outpatient Mock / ORCA API Console / Legacy REST Console を提供。
- 本番導線には一切表示しない。

## 5. 実装計画としての要点（設計差分の固定化）
- **自動更新間隔**: `OUTPATIENT_AUTO_REFRESH_INTERVAL_MS=90_000`（90秒）固定、stale 警告は 2x（180秒）。
- **Charts UI**: 上部タブではなく、3カラム + ドロワー + セクション移動を採用。
- **SSE**: ChartEventStream は既に実装済みのため **標準機能**として維持。
- **画像API**: `/karte/images` を正とし、`/karte/iamges` は typo 互換フォールバック扱い。
- **Login API**: `/api/user/{facilityId}:{userId}` を正とし、Legacy ヘッダ認証は `VITE_ENABLE_LEGACY_HEADER_AUTH=1` で強制/フォールバック、`VITE_ALLOW_LEGACY_HEADER_AUTH_FALLBACK=1` の場合のみ Basic 失敗時に限定フォールバックする。

## 6. 非対象/保留（明示的に実装しない）
- 入院・病棟スコープ。
- Phase2 設計で提案されたが server-modernized で未実装の機能。
- 本番ナビに Debug/QA 導線を露出すること。

## 7. 本書の更新ガイド
- 改訂時は RUN_ID を採番し、更新日・差分を明記する。
- 画面構成の決定事項が変わる場合は `web-client-screen-structure-decisions-20260106.md` を先に更新し、本書へ反映する。
