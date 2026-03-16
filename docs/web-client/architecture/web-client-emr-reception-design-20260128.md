# Reception（受付）詳細設計（現行実装準拠）

- RUN_ID: 20260130T125310Z
- 更新日: 2026-01-30
- 更新: 2026-02-13（RUN_ID: 20260213T114440Z）
- 対象: Webクライアント Reception 画面（外来）
- 参照: `docs/web-client/architecture/web-client-emr-design-integrated-20260128.md`

## 0. 目的とスコープ
- 受付/診療/会計/予約を **一覧で俯瞰**し、同一画面で当日受付の登録/取消まで完結させる。
- **server-modernized の現行APIで実装可能な範囲のみ**を対象とする。
- 設計の基準は「現行実装の振る舞い + 運用での誤操作防止」。

## 0.1 使いやすさの設計方針（UI）
- 一覧で状況を俯瞰し、必要な人だけをすぐ拾えるように、例外と次の行動を分かりやすく出す。
- 患者行の選択と右ペインの表示を常に同期させ、どこを見ているか迷わないようにする。
- 予約外当日受付は、入力必須と取消条件を明確にし、誤操作（取消の取り違え）を防ぐ。
- 自動更新があっても作業が途切れないように、選択中の行と入力中の内容を守る。

## 0.2 この画面の主な使い方
Reception は、当日の来院状況を見ながら、カルテを開く人と、例外対応が必要な人を見分けるための画面として使う。
検索や保存ビューで対象を絞り、必要なら右ペインで状況を確認してから Charts を新規タブで開く。

## 1. 現行実装の参照
- 画面本体: `web-client/src/features/reception/pages/ReceptionPage.tsx`
- 受付登録/取消フォーム: `web-client/src/features/reception/pages/ReceptionPage.tsx`（`reception-accept` セクション）
- 例外一覧: `web-client/src/features/reception/components/ReceptionExceptionList.tsx`
- 監査ビュー: `web-client/src/features/reception/components/ReceptionAuditPanel.tsx`
- トーン/マスタ復旧: `web-client/src/features/reception/components/OrderConsole.tsx` / `ToneBanner.tsx`
- API: `web-client/src/features/reception/api.ts`
- 受付ステータス・型: `web-client/src/features/outpatient/types.ts`
- 例外判定ロジック: `web-client/src/features/reception/exceptionLogic.ts`
- ORCAキュー判定: `web-client/src/features/outpatient/orcaQueueStatus.ts`
- 90秒自動更新: `web-client/src/features/shared/autoRefreshNotice.ts`

## 2. 画面全体構成（文章ワイヤーフレーム）
```
[Header]
- タイトル + 説明文
- RUN_ID / dataSourceTransition / missingMaster / cacheHit / audit summary / fetchedAt
- AdminBroadcast バナー / AutoRefresh バナー / 例外導線バナー

[Main 2カラム]
└─ Left（一覧・操作エリア）
   ├─ 予約外当日受付フォーム（register/cancel）
   ├─ 検索フォーム（日時・キーワード・診療科・担当医・保険/自費・ソート）
   ├─ 保存ビュー（適用/削除/保存）
   ├─ サマリー & 注意バナー（未紐付・intent）
   ├─ 例外一覧（未承認/送信エラー/遅延）
   └─ ステータス別リスト（予約/診察待ち/診察中/診察終了/会計済み）

└─ Right（右ペイン）
   ├─ 患者概要カード
   ├─ オーダー概要カード
   └─ OrderConsole（tone + resolveMasterSource + missingMasterノート）

[Footer]
- 監査履歴検索（local audit log）
```

## 3. UI詳細（使用者視点の導線）
### 3.1 ヘッダー/メタバー
- **タイトル/説明文**: 現行実装では「Reception 検索と外来API接続」を示し、Reception→Charts へのRUN_ID継承を説明する。
- **メタピル**:
  - `RUN_ID`（クリックでコピー）
  - `dataSourceTransition`（server/snapshot/mock/fallback）
  - `missingMaster`（true/false）
  - `cacheHit`（true/false）
  - 監査サマリ（最新 auditEvent の action/outcome）
  - `fetchedAt`

### 3.2 予約外当日受付（acceptmodv2）フォーム
- **目的**: 予約外の当日受付を登録/取消する。
- **入力フィールド**:
  - 患者ID（必須）
  - 保険/自費（必須）: insurance/self
  - 来院区分（必須）: 通常/時間外/救急
  - 操作: 受付登録(01) / 受付取消(02)
  - 受付ID（取消時必須）
  - メモ/診療内容
- **アクション**:
  - 受付送信（必須入力が揃うまで無効）
  - 選択中の患者を反映（一覧から選んだ患者ID/受付IDを転記）
  - バナーをクリア
- **結果表示**:
  - 成功/警告/失敗を ToneBanner で表示
  - Api_Result と詳細を表示
  - 所要時間（ms）を表示
  - 送信結果はフォーム直下の結果エリアで確認できるようにする

#### 3.2.1 受付登録と取消の安全策（運用メモ）
- 取消は取り違えが起きやすいため、受付IDが空のまま送信できないことを明確に示す。
- 一覧から患者を選んだときは、フォームに患者IDと受付IDを転記し、入力の手数を減らす。
- 自動転記は「未入力または直近の自動転記値と一致している項目」のみ更新し、手入力済みの項目は上書きしない。
- 送信後は、成功・警告・失敗のいずれでも結果を残し、必要なら同じ場所から再送できるようにする。

### 3.3 検索・フィルタ
- **検索条件**:
  - 日付（必須、ISO）
  - キーワード（患者ID/氏名/カナ）
  - 診療科
  - 担当医
  - 保険/自費
  - ソート（受付/予約時間・氏名・診療科）
- **ボタン**:
  - 検索 / 再取得 / クリア / Patients へ
- **保存ビュー**:
  - 保存ビューを選択 → 適用 / 削除
  - ビュー名入力 → 「現在の条件を保存」
- **共有仕様**:
  - Reception と Patients で保存ビューを共有（`outpatient/savedViews`）
  - フィルタ状態は localStorage に保存（`reception-filter-state`）

### 3.4 例外一覧（未承認/送信エラー/遅延）
- **判定ロジック**:
  - 未承認: `claimStatusText` が「会計待ち/未承認/未確定/未送信/承認待ち」に該当
  - 送信エラー: queue phase が failed、または errorMessage あり
  - 遅延: ORCA queue の nextRetryAt から 5分超（`ORCA_QUEUE_STALL_THRESHOLD_MS`）
- **取得元**:
  - 例外判定に使うキュー情報は **`/api/orca/queue` の `queue` が主**。
  - **送信キャッシュ**は「直近送信の結果」を補助的に反映する（一覧の主データにはしない）。
- **表示**:
  - 合計/未承認/送信エラー/遅延 の件数ピル
  - カードに患者ID/予約ID/受付ID・状態・支払・請求・ORCAキューを表示
  - アクション: 一覧で選択 / Charts 新規タブ / 次アクション表示

### 3.5 ステータス別リスト（予約/診察待ち/診察中/診察終了/会計済み）
- **構成**:
  - セクションごとに折りたたみ可能（初期: 会計済みのみ折りたたみ）
  - 各セクションの件数を表示
- 予約列（`予約`）も表示し、ORCA 予約（`/api/orca/appointments/list`）を一覧で俯瞰できるようにする
- **表示名（内部ステータス → 画面表示）**:
  - `予約` → `予約`
  - `受付中` → `診察待ち`
  - `診療中` → `診察中`
  - `会計待ち` → `診察終了`
- **テーブル列**:
  1) 状態
  2) 患者ID / 受付ID / 予約ID
  3) 氏名・カナ
  4) 来院時刻 + 診療科
  5) 保険/自費 + 保険表記
  6) 請求状態 + bundle/invoice/data (送信キャッシュ含む)
  7) メモ + source
  8) 直近診療
  9) ORCAキュー
  10) カルテ（新規タブ）
- **行操作**:
  - クリック: 右ペインへ反映
  - ダブルクリック / Enter: Charts 新規タブで開く（patientId 必須）
  - 診察終了カード: 個別の「会計送信」ボタンで ORCA `medicalmodv2` 送信 → 成功時は会計済みへ移動

### 3.6 右ペイン（患者概要 + オーダー概要）
- **患者概要**:
  - 患者ID/受付ID/予約ID
  - 氏名/カナ/性別/生年月日
  - 支払区分・保険
  - 状態 / 診療科 / 担当医 / 直近診療
  - Charts 新規タブボタン（patientId が無い場合は disabled）
- **オーダー概要**:
  - 請求状態 / バンドル / 合計金額 / 診療時間
  - ORCAキュー（phase/詳細/再送回数/エラー）

### 3.7 OrderConsole（トーン/マスタ状態の可視化・切替）
- **Step表示**:
  - Step1: Tone（tone=server chain）
  - Step2: resolveMasterSource バッジ
- **制御**:
  - resolveMasterSource の手動切替（mock/snapshot/server/fallback）
  - missingMaster / cacheHit の手動切替
  - missingMaster コメント（監査ログへ反映）
- **意図**: マスタ取得状態の検証と運用ガイダンスの可視化

### 3.8 監査履歴検索
- **検索軸**: runId / patientId / action / queue など
- **フィルタ**: 選択中の患者のみ
- **表示**: 最新順に action/outcome、endpoint、queue/exception summary を表示

### 3.9 自動更新と stale 警告
- **自動更新間隔**: 90秒（`OUTPATIENT_AUTO_REFRESH_INTERVAL_MS=90_000`）で Reception 一覧と請求フラグを再取得する。
- **stale 警告**: 最終更新から 180秒（2倍）を超えると警告バナーを表示する。

### 3.10 一覧更新時の選択保持（自動更新を前提に）
- 自動更新や手動再取得で一覧が更新されても、可能な限り選択中の行を保持する。
- 選択行が消えた場合は、理由（検索条件変更・日付変更など）が分かるようにする。
- 更新が走ったことは控えめに示し、入力中のフォームやフィルタが突然変わらないようにする。

### 3.11 空状態と読み込み中の扱い
- 検索結果が 0 件のときは、条件の見直しポイント（例：日付・キーワード）を短い文で案内する。
- 読み込み中は、一覧が途中で入れ替わって見えないようにし、完了後に更新時刻（fetchedAt）で確認できるようにする。

### 3.12 Charts を開く操作の分かりやすさ
- ダブルクリックと Enter が同じ動作になることを画面内で分かるようにし、ボタン操作とも統一する。
- patientId が無い行ではボタンを無効にし、無効の理由を示す。

## 4. データフロー（操作とAPIの対応）
1. 画面初期表示
   - 受付一覧: `/api/orca/appointments/list` + `/api/orca/visits/list` を併用取得し統合
   - 送信キュー: `/api/orca/queue` と送信キャッシュを取得（例外判定の一次情報）
2. 受付登録/取消
   - `/api/orca/visits/mutation` に Request_Number=01/02 で送信
   - 成功時は一覧を即時更新（新規/削除）
3. フィルタ変更
   - URLパラメータ + localStorage に保存
4. 例外抽出
   - **送信キャッシュ + `/api/orca/queue` の queue** を元に未承認/送信エラー/遅延を算出
   - **再送/詳細確認**は `/api/orca/queue` を使用する（操作系の補助）
5. Charts へ遷移
   - 行ダブルクリック/ボタンで `buildChartsUrl` を生成し新規タブで起動

## 5. 状態管理・ローカル保存
- **フィルタ状態**: `reception-filter-state`（localStorage）
- **折りたたみ**: `reception-section-collapses`（localStorage）
- **保存ビュー**: `outpatient/savedViews`（Reception/Patients 共通）
- **RUN_ID**: 画面遷移で Carry over（Charts に引き継ぎ）

## 6. エラー/復旧・運用ガード
- **ApiFailureBanner**: 401/403/404/5xx/network で共通復旧導線
- **missingMaster**: 右ペインや ToneBanner に復旧ガイド
- **受付取消**: 受付ID未入力時は送信不可
- **患者未紐付**: 未紐付検出時は警告バナーを表示

## 7. API一覧（Reception）
| 目的 | エンドポイント | method | 主な入力 | 主な出力/扱い |
| --- | --- | --- | --- | --- |
| 予約一覧 | `/api/orca/appointments/list` | POST (JSON) | appointmentDate, medicalInformation, departmentCode, physicianCode | slots/reservations/visits を統合し一覧生成 |
| 当日受付一覧 | `/api/orca/visits/list` | POST (JSON) | visitDate, requestNumber=01 | 受付中/診療中/会計待ち等の一覧に統合 |
| 受付登録/取消 | `/api/orca/visits/mutation` | POST (JSON) | Request_Number=01/02, Patient_ID, acceptancePush, paymentMode, etc | 成功/警告/失敗をバナー表示、一覧を即時更新 |
| 送信キュー | `/api/orca/queue` | GET | なし | queue を表示と例外判定へ利用 |
| モック | `/api/orca/appointments/list/mock`, `/api/orca/visits/list/mock`, `/api/orca/visits/mutation/mock` | POST | VITE_DISABLE_MSW=0 時のフォールバック | デモ/検証用 |

## 8. 実装上の注意
- 受付一覧の「ORCAキュー」は **/api/orca/queue の queue と送信キャッシュ**を統合して表示する。
- 自動更新は 90秒。2倍遅延で警告バナーを表示。
- Charts への遷移は **新規タブ**が標準（既存作業を保持）。
- Reception と Patients の保存ビューは同一キーで共有し、フィルタを相互に持ち回る。

## 9. 使い勝手チェック項目（実装レビュー用）
- 例外一覧を見れば、誰に何が起きていて、次に何をすればよいかが分かる。
- 当日受付の取消は受付IDが無いと実行できず、取り違えが起きにくい。
- 自動更新後も、選択中の患者と右ペインの内容がずれない。
- Charts への遷移は常に新規タブで行われ、現在の作業（受付の選別）が失われない。

## 10. 横断UIレビュー反映（RUN_ID=20260130T121758Z）
### 10.1 文言・導線の確認/変更
- 自動更新（stale）バナー: 「受付一覧の自動更新が止まっています。最終更新: <timestamp>。再取得してください。」
- 空状態: 「0件です。日付やキーワードを見直してください。ヒント: 診療科・担当医・保険/自費を先に絞ると探しやすくなります。」
- 送信失敗表示: 一覧の送信状態は「送信: 失敗」＋「再送待ち」で統一。
- Missing Master 復旧導線: 「再取得 → Reception → 管理者共有」に統一（StatusBadge/ガイドの表示）。

### 10.2 画面間導線の統一ポイント
- Charts は新規タブで開く導線を維持（確認済み・変更なし）。
- Reception ↔ Patients の保存ビュー共有とフィルタ持ち回りは確認済み（変更なし）。

### 10.3 回帰確認（主要シナリオ）
- 自動更新（stale）: `tests/e2e/outpatient-auto-refresh-banner.spec.ts` PASS。
- エラー復旧（401/403/404/5xx/network）: `tests/e2e/outpatient-generic-error-recovery.msw.spec.ts` PASS。
- 再送（送信失敗→再送キュー→Reception反映）: `tests/e2e/charts/e2e-orca-claim-send.spec.ts`（grep「再送キュー」、`PLAYWRIGHT_DISABLE_MSW=1`）PASS。
- 再現手順: 統合設計 `docs/web-client/architecture/web-client-emr-design-integrated-20260128.md` の 3.10.6 と `docs/web-client/operations/ui-review-regression-20260130.md` を参照。

### 10.4 スクリーンショット更新範囲
- 自動更新停止バナー / 空状態 / 送信失敗（送信: 失敗 + 再送待ち） / MissingMaster 復旧導線の表示を含むスクショがある場合は更新。
- 上記以外は確認済み（変更なし）。
