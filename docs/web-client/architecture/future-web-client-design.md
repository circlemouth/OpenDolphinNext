# 次期 Web クライアント設計サマリ（RUN_ID=20251226T141048Z）

本書は `docs/web-client/README.md`・`docs/web-client/ux/*`・現行実装（`web-client/src`）を踏まえ、Reception/Charts/Patients/Administration までを包含した「次に作るべき」Web クライアントの画面配置と機能セットを一枚に集約した設計ガイドである。Phase2 のトーン設計（`tone=server`/`dataSourceTransition`/`missingMaster`/`cacheHit`）と RUN_ID の持ち回りを前提に、UI/UX・ARIA・テレメトリ・API を紐付けている。

## 0. 前提・目的
- 本番スコープ：外来（Reception → Charts → Patients → Administration）。入院系は対象外。
- 参照コード：`web-client/src/AppRouter.tsx`（ナビゲーション＋RUN_ID発行）、`features/reception/*`、`features/charts/*`、`libs/http/httpClient.ts`（OUTPATIENT_API_ENDPOINTS）、`libs/telemetry/telemetryClient.ts`。
- トーン共通語彙：`tone`（info/warning/error）、`missingMaster`、`cacheHit`、`dataSourceTransition`（mock/snapshot/server/fallback）、`resolveMasterSource`、`runId`。
- 監査と A11y：すべてのバナー／主要操作に `role=status|alert` + `aria-live` を付与し、同一 `runId` を `data-run-id` に保持。`auditEvent` へ metadata（runId, dataSourceTransition, cacheHit, missingMaster, fallbackUsed）を透過。

## 1. 情報アーキテクチャとグローバル仕様
- **グローバルシェル**：トップバー（ブランド＋施設＋ユーザー＋RUN_ID＋ログアウト）、左ナビ（Reception / Charts / Patients / Administration）、右側に通知トーストスタック。
- **RUN_ID 伝播**：ログイン成功時に `AppRouter` が発行し、Router Context で全画面へ注入。API ヘッダー・telemetry・バナーの `data-run-id` に共通使用。
- **状態管理**：`AuthServiceProvider` を全ページで再利用し、`missingMaster`・`cacheHit`・`dataSourceTransition` を単一ソースに。Reception で変更されたフラグは Charts/Patients/Administration に carry-over。
- **色・トーン**：Error=赤, Warning=琥珀, Info=青, Success=緑。`tone=server` は Warning（aria-live=assertive）、`cacheHit=true` は Info（aria-live=polite）。
- **テレメトリ**：`telemetryClient.recordOutpatientFunnel` を `resolve_master` → `charts_orchestration` の二段で送信。各操作は `traceId` と `runId` をセット。
- **API バインディング**：`OUTPATIENT_API_ENDPOINTS`（claim/appointment/medical/patient）を使用し、`resolveMasterSource` により dataSourceTransition を決定。各呼び出しは `audit.logUiState` を書き出す。

## 2. 画面別設計（要素配置と機能）

### 2.1 Login
| エリア | 要素/機能 | データ・イベント | 備考 |
| --- | --- | --- | --- |
| メインカード | 施設ID / ユーザーID / パスワード / クライアントUUID フォーム | MD5 ハッシュ化→`/user/{facility:user}` GET、成功で `runId` 発行 | 入力検証とフィードバック（成功=green, 失敗=red）。localStorage に dev 用 seed を保存。 |
| ステータス | `role=status` メッセージ | `aria-live=polite` | 成功時に displayName を表示。 |

### 2.2 グローバルナビゲーション / 共通パネル
| エリア | 要素/機能 | データ・イベント | 備考 |
| --- | --- | --- | --- |
| トップバー | ブランド、施設ID、ユーザー、RUN_ID、ログアウト | `AppRouter` session | RUN_ID はリンククリックでクリップボードコピー（実装追加）。 |
| 左ナビ | Reception / Charts / Patients / Administration | `NavLink` + badge（warning/error件数） | パス一致で `is-active`。権限不足タブは disabled+ツールチップ。 |
| 通知スタック | 成功/失敗/長時間処理トースト | `role=status` | 3件までキュー、Esc で閉じる。 |

### 2.3 Reception（受付一覧＋オーダーコンソール）
| エリア | 要素/機能 | データ・イベント | 備考 |
| --- | --- | --- | --- |
| ヘッダー | 検索（患者ID/漢字/カナ）、フィルタ（待ち/診察中/完了、自費/保険）、ソート | `aria-live=polite` で件数更新 | クエリは URL に保持し Charts へ引き継ぎ。 |
| バナー帯 | `ToneBanner`（tone=server / error / info） | `missingMaster`/`cacheHit`/`dataSourceTransition` で文言切替。`role=alert` | `resolveMasterSource` 変更で再レンダリング。 |
| 受付テーブル | 列: 状態バッジ, 患者ID, 名前, 来院時刻, 保険/自費, メモ, 直近診療, ORCA キュー状態 | 行クリックで右ペインに詳細、ダブルクリックで Charts を新タブ | `status-badge` を再利用し `data-run-id` 付与。 |
| 右ペイン（詳細） | 患者概要カード / 直近診療 / オーダー概要 / missingMaster ノート入力 | `OrderConsole` と同じバナーと note を共有 | note 送信は `auditEvent` に含める。 |
| OrderConsole | Step1 Tone / Step2 Master Source / CacheHit & MissingMaster バッジ / toggle ボタン / note | `resolveMasterSource` セレクトで `dataSourceTransition` を変更。`missingMaster` toggle は Charts/Patients へ伝搬 | note は `aria-live` assertive when missingMaster=true。 |

### 2.4 Charts（カルテ）
| エリア | 要素/機能 | データ・イベント | 備考 |
| --- | --- | --- | --- |
| ヘッダー | 患者基本情報、受付ID、保険/自費トグル、`dataSourceTransition` pill | `AuthService` flags | Reception のフィルタを保持。 |
| アクションバー | 診療終了、ORCA 送信、Draft 保存、キャンセル | 成功/失敗を telemetry + audit に送信 | ORCA 送信は missingMaster=false でのみ有効。 |
| DocumentTimeline | バナー（ToneBanner）、タイムライン（受付→診療→ORCA キュー）、`missingMaster` highlight | `aria-live` toneに応じ切替 | timeline entry は `data-run-id` 付き。 |
| OrcaSummary | 予約/外来フラグから取得したサマリ、`dataSourceTransition` 説明、`cacheHit`/`missingMaster` バッジ | `/api/orca/appointments/list/*` / `/api/orca/medical/outpatient` | fallbackUsed=true で警告を表示。 |
| PatientsTab | 患者一覧/検索、タブ: 基本情報/保険/過去受診、右ペインに編集フォーム | `/api/orca/patient/mutation` | 編集後は Administration に配信。missingMaster 時は編集をブロック。 |

#### 2.4.1 外来カルテ作業台（ブラッシュアップ仕様の反映）
現行設計の Charts を「外来カルテ作業台」として拡張し、3カラム＋右固定メニューで運用効率を最大化する。

| 領域 | 役割 | 主な要素 | 設計メモ |
| --- | --- | --- | --- |
| 上段: 共通ヘッダ | システム共通 | 施設/ユーザー/RUN_ID/通知 | 既存のグローバルシェルを継続。 |
| 上段: 患者ヘッダ | 誤認防止 | 患者番号、氏名(漢字/カナ)、性別、年齢(歳/月)、生年月日(西暦+和暦)、受付番号、TEL、患者メモ | 氏名は最強調。年齢は自動計算。 |
| 上段: 診療バー | 診療状態/操作 | 初診/再診、診察終了、担当者、診療科、承認、ロック、最終出力 | 承認=署名確定。ロックは「承認済で編集不可」へ統一。 |
| 左カラム | 病名 + 過去 | 病名テーブル（主/疑い/開始/転帰/保険）、過去カルテ/処方歴/サマリー/次回診察 | 病名コードを保持し ORCA 連動前提。 |
| 中央カラム | 記載ログ + 入力 | Free/Subjective/Objective/Assessment/Plan のログ、入力欄、定型文 | セクション単位で保存。Shift+Enter で登録。 |
| 右カラム | 当日処方/オーダー | RP 単位の処方、オーダー束（処置+付随薬剤）、状態ラベル | 編集は右固定メニューへ寄せ、右カラムは確認中心。 |
| 右固定メニュー | 追加機能入口 | 処方/オーダー検索/検査/文書/画像登録 等 | 右スライドパネルで統一して本画面内に収める。 |

#### 2.4.2 差分整理（現行設計 vs 参考仕様）と統合判断
- **Charts の中核**: 現行の DocumentTimeline を「セクション別記載ログ + タイムライン」へ拡張し、SOAP を時系列で積み上げる UI に統合する。
- **病名/履歴の位置**: 現行の PatientsTab を分離し、左カラムへ病名・履歴を常時表示する。Patients 画面は「一覧・編集導線」に集中させる。
- **処方/オーダー**: 右カラムは当日分の確認に限定し、編集は右固定メニューからの専用パネルに統一する（集中を阻害しない）。
- **承認/ロック/Do**: 承認=署名確定、ロック=承認済編集不可、Do=「確認して確定」の意味で統一。どのカテゴリに Do を付与するかは受診×カテゴリ単位で設計する。
- **患者安全**: 受付番号・氏名強調・和暦併記を必須とし、Charts ヘッダーに事故防止の表示ルールを追加する。

#### 2.4.3 追加データ要件（Charts 拡張分）
- **病名**: 主病名は一意、疑いフラグは病名ごとに保持。開始日/転帰/転帰日は編集可能（カレンダー入力）。
- **カルテ本文**: セクション別ログ（Free/Subjective/Objective/Assessment/Plan）、記載者職種、記載日時、テンプレート ID を保持。
- **処方**: RP 単位で薬剤・用法・コメント・状態・入力者ログを保持。
- **オーダー**: 表示名（束）＋内訳（処置/薬剤配列）＋状態を保持。

### 2.5 Patients（受付→患者管理導線）
| エリア | 要素/機能 | データ・イベント | 備考 |
| --- | --- | --- | --- |
| 左メニュー | フィルタ（診療科/担当医/属性）、保存済みビュー | localStorage + URL | Reception からの遷移でフィルタ復元。 |
| 一覧 | 患者ID、氏名、保険/自費、次回予約、未紐付ステータス、アクション（編集/Receptionへ戻る） | `status-badge` reuse | 未紐付=warning でトーストも表示。 |
| 右詳細 | 編集フォーム、監査ログビュー、ORCA 反映ステータス | `/api/orca/patient/mutation` | 保存時に `auditEvent` と `telemetry` へ runId を送信。 |

### 2.6 Administration（設定）
| エリア | 要素/機能 | データ・イベント | 備考 |
| --- | --- | --- | --- |
| ヘッダー | 配信状態（即時/次回リロード）、最終配信時刻、環境（dev/stage） | `/config` エンドポイント | 権限=system_admin のみ編集可。 |
| 設定フォーム | ORCA 接続設定（エンドポイント/証明書/ヘルスチェック間隔）、MSW/モックトグル、配信フラグ | 保存で `auditEvent` と `broadcast` | 変更は Reception/Charts にバナーで通知。 |
| 配信キュー | 未配信の設定バンドル一覧、再送/破棄ボタン | `role=status` | 遅延が閾値超過で warning バナー。 |

### 2.7 Outpatient Mock（デモ/QA 専用・本番ナビ外）
| エリア | 要素/機能 | データ・イベント | 備考 |
| --- | --- | --- | --- |
| ページ | フラグ切替（missingMaster/cacheHit/dataSourceTransition）、MSW シナリオ選択 | `telemetryClient` を通して `resolve_master` を発火 | QA 用。`/f/:facilityId/debug/*` 配下に隔離し、本番ナビから除外。`VITE_DISABLE_MSW=1` では警告を表示。 |

## 3. データ・API・監査の要点
- API: `OUTPATIENT_API_ENDPOINTS` に揃える。呼び出し時に `runId`/`dataSourceTransition`/`cacheHit`/`missingMaster`/`fallbackUsed` をヘッダーまたは body metadata で送出し、応答でも受け取り UI/telemetry に反映。
- 監査: `auditEvent` に業務キー（facilityId/patientId/appointmentId/claimId/operation）と metadata を格納。UI 側は `audit.logUiState` を用い、tone バナーが表示されたタイムスタンプとトリガー操作を記録。
- テレメトリ: 主要操作（ログイン成功、resolveMasterSource 遷移、ORCA 送信、患者編集保存、設定配信、MSW モード切替）を funnel で記録。失敗イベントは `reason/errorCode/httpStatus` を必須。
- アクセシビリティ: すべてのバナーに `role=alert|status` と `aria-live`、重要なトグルに `aria-pressed`。テーブル行はキーボード操作でフォーカス移動可。
- 外来カルテ拡張: SOAP 記載/病名/処方/オーダーの編集操作は `auditEvent` へ記録し、セクション別に `operation` を分割（例: `chart_note_add`, `disease_primary_change`, `prescription_add`, `order_status_update`）。

## 4. 実装移行ガイド
- **短期 (UI shell 強化)**: AppShell に通知スタック＋RUN_ID コピー、左ナビの権限ガード追加。Reception/Charts で `AuthService` を共通化。
- **中期 (Reception/Charts 本格化)**: Reception テーブル・OrderConsole を API 接続させ、Charts の DocumentTimeline/OrcaSummary/PatientsTab を real data 化。`resolveMasterSource` と `dataSourceTransition` を API と telemetry で実配線。
- **後期 (Patients/Administration)**: 患者編集・設定配信の API 実装と監査連携。配信キュー/リトライ導線とトースト通知を追加。
- **検証**: Playwright で tone/aria-live/transition chain を自動確認。Stage/Preview では `VITE_DISABLE_MSW=1` + `VITE_DEV_PROXY_TARGET` で実 API を計測。

## 5. リンクと参照
- 既存 UX ポリシー: `docs/web-client/ux/reception-schedule-ui-policy.md`, `docs/web-client/ux/charts-claim-ui-policy.md`, `docs/web-client/ux/patients-admin-ui-policy.md`
- API マッピング: `docs/web-client/architecture/web-client-api-mapping.md`
- 現行デモ実装: `web-client/src/AppRouter.tsx`, `features/reception/*`, `features/charts/*`
