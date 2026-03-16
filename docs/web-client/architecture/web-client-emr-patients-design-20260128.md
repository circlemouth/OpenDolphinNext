# Patients（患者）詳細設計（現行実装準拠）

- RUN_ID: 20260130T125310Z
- 更新日: 2026-01-30
- 対象: Webクライアント Patients 画面（外来）
- 参照: `docs/web-client/architecture/web-client-emr-design-integrated-20260128.md`

## 0. 目的とスコープ
- 外来患者の **検索・一覧・編集** を一画面で完結させる。
- ORCA原本/保険/メモの取得・更新を **同一RUN_IDで監査可能**にする。
- Reception/Charts からの **フィルタ引き継ぎ** と **復帰導線** を維持する。

## 0.1 使いやすさの設計方針（UI）
- 検索条件は少ない手数で整えられるようにし、保存ビューで再利用できるようにする。
- 編集は、入力ミスに気づける表示と、保存後の安心感（結果の見える化）を両立させる。
- ORCA原本や保険者検索などの参照情報は、編集の流れを邪魔しない位置にまとめる。
- Reception と Charts から来ても迷わないように、戻る導線を画面内に置き続ける。

## 0.2 この画面で多い作業（想定）
Patients は、受付やカルテの途中で気づいた患者情報の不足を補い、すぐ元の画面へ戻るために使うことが多い。
そのため、検索から編集、保存、復帰までを短い動線でつなぎ、保存失敗時の巻き戻しも分かりやすくする。

## 1. 現行実装の参照
- 画面本体: `web-client/src/features/patients/PatientsPage.tsx`
- API: `web-client/src/features/patients/api.ts`
- ORCA原本: `web-client/src/features/patients/patientOriginalApi.ts`
- ORCA保険一覧: `web-client/src/features/patients/insuranceApi.ts`
- ORCAメモ: `web-client/src/features/patients/patientMemoApi.ts`
- バリデーション: `web-client/src/features/patients/patientValidation.ts`
- 共通バナー: `web-client/src/features/shared/ApiFailureBanner.tsx`
- missingMaster復旧: `web-client/src/features/shared/MissingMasterRecoveryGuide.tsx`

## 2. 画面全体構成（文章ワイヤーフレーム）
```
[Header]
- タイトル / 説明
- RUN_ID / missingMaster / fallbackUsed / cacheHit / dataSourceTransition / recordsReturned

[Broadcast/Banner]
- AdminBroadcast / AutoRefresh / ToneBanner / Charts到達バナー / 未紐付警告

[Filters + Saved Views]
- キーワード / 診療科 / 担当医 / 保険/自費
- 検索更新 / Chartsに戻る / Receptionに戻る
- 保存ビュー（適用/削除/保存）

[Main 2カラム]
└─ Left: 患者一覧（選択）
└─ Right: 編集フォーム + ORCA原本 + 保険者検索 + ORCAメモ + 監査ログ

[Footnote]
- dataSourceTransition / cacheHit / missingMaster / fetchedAt など
```

## 3. UI詳細（使用者視点）
### 3.1 ヘッダー/メタ情報
- **表示**:
  - RUN_ID / missingMaster / fallbackUsed / cacheHit / dataSourceTransition / recordsReturned
- **説明文**:
  - `/api/orca/patients/local-search` で閲覧、`/api/orca/patient/mutation` で保存。

### 3.2 フィルタ & 保存ビュー
- **フィルタ項目**:
  - キーワード（氏名/カナ/ID）
  - 診療科、担当医、保険/自費
- **操作**:
  - 検索更新 / Charts に戻る / Reception に戻る
- **保存ビュー**:
  - ビュー選択 → 適用/削除
  - ビュー名を指定して「現在の条件を保存」
- **自動引き継ぎ**:
  - Reception のフィルタ state を初期値として読み込み

### 3.3 患者一覧（左カラム）
- **一覧要素**:
  - 患者ID / 氏名 / カナ
  - 生年月日 / 保険 / 最終受診
- **未紐付警告**:
  - 患者ID欠損 / 氏名欠損をバッジ表示
  - 重大時は編集ブロック（警告メッセージ表示）

### 3.4 編集フォーム（右カラム上部）
- **操作**:
  - 新規作成 / 削除 / 保存
- **入力フィールド**:
  - 患者ID、氏名、カナ、生年月日、性別、電話、郵便番号、住所
  - 保険/自費、メモ
- **バリデーション**:
  - 氏名必須（空文字は不可）
  - 患者IDは数値のみ・最大16桁
  - カナは全角カタカナ（長音・空白は許可）
  - 生年月日は `YYYY-MM-DD` 形式（ISO日付）
  - 性別は `M/F/O` のいずれか
  - 電話番号は数字/括弧/ハイフン/空白のみ（6〜24文字）
  - 郵便番号は `123-4567` 形式（ハイフン有無可）
- **失敗時導線**:
  - 再試行 / 巻き戻し / 再取得

### 3.5 ORCA 原本（patientgetv2）
- **取得形式**: XML2 / JSON の切替
- **入力**:
  - Patient_ID / class
- **出力**:
  - Api_Result / Api_Result_Message / Information_Date / Information_Time / RunId
  - 原本本文（XML/JSON）を表示

### 3.6 保険者検索（insuranceinf1v2）
- **入力**:
  - Base_Date / キーワード（保険者番号/名称/公費）
- **出力**:
  - 保険者一覧 / 公費一覧
  - 「反映」ボタンで保険欄に転記

### 3.7 ORCAメモ（patientlst7v2 / patientmemomodv2）
- **取得**: patientlst7v2
- **更新**: patientmemomodv2
- **入力**:
  - Base_Date / Memo_Class / 診療科コード
  - 更新用: Perform_Date / Memo_Class / 診療科コード / メモ本文
- **出力**:
  - Api_Result / Api_Result_Message / RunId / missingTags

### 3.8 監査ログビュー
- **検索条件**:
  - キーワード / outcome / 対象 / 並び順 / 件数 / 開始日 / 終了日
- **表示**:
  - 保存結果、ORCA反映状態
  - 監査ログ一覧（action/outcome/runId/endpoint/changedKeys など）

### 3.9 入力支援とバリデーション表示（迷いを減らす）
- ルールが厳しい項目（患者ID・カナ・日付など）は、入力欄の近くに短い説明を出し、失敗時はどこが違うかを示す。
- 形式が決まっている項目は、例を一つだけ置く（例：生年月日は `YYYY-MM-DD`）。
- 住所や電話など長い入力は、入力途中でも見失わないようにラベルを固定表示する。
- 保存ボタンが無効なときは、必須未入力の項目が分かるようにする。

### 3.10 保存後の見え方（安心感のために）
- 保存が成功したら、更新対象（患者ID）と結果（auditEvent など）が分かるように出す。
- 失敗したら、再試行と再取得のどちらを優先すべきかを示し、同じ場所からやり直せるようにする。

## 4. 主要フロー
1. Reception からの遷移
   - Reception のフィルタ状態を初期値として読み込み
2. Charts からの遷移
   - returnTo を保持し「Charts に戻る」を提供
3. 患者検索
   - 検索条件を適用し `/api/orca/patients/local-search` を再取得
4. 患者更新
   - バリデーション → `/api/orca/patient/mutation` へ送信
5. ORCA 原本参照
   - XML/JSON の切替で `patientgetv2` を取得
6. ORCA メモ更新
   - patientmemomodv2 へ XML 送信 → 成否をバナー表示

## 5. 状態管理・ローカル保存
- **フィルタ状態**: `patients-filter-state`（localStorage）
- **Reception連携**: `reception-filter-state` を初期取り込み
- **Charts復帰URL**: sessionStorage（`opendolphin:web-client:patients:returnTo`）
- **保存ビュー**: `outpatient/savedViews`（Reception と共有）

## 6. エラー/復旧・運用ガード
- **ApiFailureBanner**: 401/403/404/5xx/network
- **missingMaster/fallbackUsed**: 編集ブロック + 復旧ガイド
- **未紐付患者**: 重要度に応じて警告/編集ブロック
- **保存失敗**: 再試行/巻き戻し/再取得導線

## 7. API一覧（Patients）
| 目的 | エンドポイント | method | 主な入力 | 主な出力/扱い |
| --- | --- | --- | --- | --- |
| 患者検索 | `/api/orca/patients/local-search` | POST (JSON) | keyword/department/physician/paymentMode | 患者一覧 / meta / auditEvent |
| 患者更新 | `/api/orca/patient/mutation` | POST (JSON) | operation(create/update/delete), patient | 更新結果 / auditEvent |
| ORCA原本 | `/api/orca/patientgetv2` | GET | id, class, format=json | XML2/JSON原本 |
| 保険者一覧 | `/api/api01rv2/insuranceinf1v2` | POST (XML) | Base_Date | 保険者/公費一覧 |
| ORCAメモ取得 | `/api01rv2/patientlst7v2` | POST (XML) | Patient_ID, Base_Date, Memo_Class | メモ一覧 |
| ORCAメモ更新 | `/orca06/patientmemomodv2` | POST (XML) | Patient_ID, Perform_Date, Memo | 更新結果 |
| モック | `/api/orca/patients/local-search/mock`, `/api/orca/patient/mutation/mock` | POST | VITE_DISABLE_MSW=0 時のフォールバック | デモ/検証用 |

## 8. 実装上の注意
- **編集ブロック**時は MissingMasterRecoveryGuide を必ず表示し、再取得導線を明示する。
- returnTo は安全性チェックを通過した場合のみ Charts に戻る。
- ORCA原本・保険一覧・メモ更新の結果は runId/traceId を表示し監査性を担保。

## 9. 使い勝手チェック項目（実装レビュー用）
- Reception から来たとき、初期条件が引き継がれ、迷わず検索結果に到達できる。
- 入力ルールが厳しい項目は、エラーの理由が分かり、直しやすい。
- 保存が成功したあと、何が更新されたかが分かる。
- Charts に戻る導線が見つけやすく、returnTo が不正な場合は安全に拒否される。

## 10. 横断UIレビュー反映（RUN_ID=20260130T121758Z）
### 10.1 文言・導線の確認/変更
- 自動更新（stale）バナー: 「患者一覧の自動更新が止まっています。最終更新: <timestamp>。再取得してください。」
- 空状態: 「0件です。キーワードを見直してください。ヒント: ID/氏名/カナ・診療科・担当医で絞れます。」
- Missing Master 復旧導線: 「再取得 → Reception → 管理者共有」に統一（ガイド見出し/StatusBadge/nextAction）。

### 10.2 画面間導線の統一ポイント
- Charts への returnTo と Reception への戻り導線は確認済み（変更なし）。
- Reception ↔ Patients の保存ビュー共有は確認済み（変更なし）。

### 10.3 回帰確認（主要シナリオ）
- 自動更新（stale）: `tests/e2e/outpatient-auto-refresh-banner.spec.ts` PASS。
- エラー復旧（404/network 等）: `tests/e2e/outpatient-generic-error-recovery.msw.spec.ts` PASS。
- 再現手順: 統合設計 `docs/web-client/architecture/web-client-emr-design-integrated-20260128.md` の 3.10.6 と `docs/web-client/operations/ui-review-regression-20260130.md` を参照。

### 10.4 スクリーンショット更新範囲
- 自動更新停止バナー / 空状態 / MissingMaster 復旧導線（再取得→Reception→管理者共有）表示のスクショがある場合は更新。
- 上記以外は確認済み（変更なし）。
