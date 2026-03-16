# Charts（カルテ）詳細設計（現行実装準拠）

- RUN_ID: 20260130T125310Z
- 更新日: 2026-01-30
- 対象: Webクライアント Charts 画面（外来）
- 参照: `docs/web-client/architecture/web-client-emr-design-integrated-20260128.md`

## 0. 目的とスコープ
- 外来カルテの **記録・送信・印刷・監査** を 1画面で完結させる。
- 受付情報（Reception）と患者情報（Patients）を **同一RUN_IDで連動**させ、監査ログの可観測性を担保する。
- server-modernized の現行APIで実装可能な範囲のみを対象。

## 0.1 使いやすさの設計方針（UI）
- いま扱っている患者と受付がひと目で分かるように、患者サマリバーを基準に情報を固定表示する。
- 重要な操作（送信・診療終了・印刷）は、できないときに理由と次の手順を必ず示し、迷いを減らす。
- 診療記録は入力途中でも失われないようにドラフトを扱い、患者切替やタブ移動では確認を出す。
- 参照情報（請求・キュー・原本）は記録の邪魔をしない位置に置き、必要なときにすぐ確認できるようにする。

## 1. 現行実装の参照
- 画面本体: `web-client/src/features/charts/pages/ChartsPage.tsx`
- アクションバー: `web-client/src/features/charts/ChartsActionBar.tsx`
- 患者サマリ: `web-client/src/features/charts/ChartsPatientSummaryBar.tsx`
- 左カラム患者タブ: `web-client/src/features/charts/PatientsTab.tsx`
- SOAP: `web-client/src/features/charts/SoapNotePanel.tsx` / `web-client/src/features/charts/soap/*`
- タイムライン: `web-client/src/features/charts/DocumentTimeline.tsx`
- 病名編集: `web-client/src/features/charts/DiagnosisEditPanel.tsx`
- オーダー/処方編集: `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- 文書作成: `web-client/src/features/charts/DocumentCreatePanel.tsx`
- 画像ドック: `web-client/src/features/images/components/*`
- ORCAサマリ/原本: `web-client/src/features/charts/OrcaSummary.tsx` / `OrcaOriginalPanel.tsx`
- SSE: `web-client/src/features/shared/ChartEventStreamBridge.tsx`

## 2. 画面全体構成（文章ワイヤーフレーム）
```
[Skip Link]
- 本文へスキップ

[Header / Topbar]
- タイトル / 説明文
- RUN_ID / dataSourceTransition / missingMaster / cacheHit / fallbackUsed / 編集状態
- 監査サマリ / Charts master / 配信ステータス / ETag / 適用先

[Admin Broadcast / Warning Banners]
- 配信通知 / context alert / edit lock / delivery impact / charts disabled

[Action Bar]
- 診療終了 / ORCA送信 / ドラフト保存 / 印刷
- ロック状態 / 承認状態 / ネットワーク状態 / 再送

[Workbench]
└─ Sticky: 患者サマリバー
└─ 3カラム
   ├─ Left
   │  ├─ PatientsTab（受付履歴/患者検索/監査/Patients連携）
   │  └─ DiagnosisEditPanel（病名CRUD）
   ├─ Center
   │  ├─ SoapNotePanel（SOAP + Subjectives）
   │  └─ DocumentTimeline（受付履歴/請求/ORCAキュー/PushEvent）
   └─ Right
      ├─ 患者メモ
      ├─ OrcaSummary
      ├─ OrcaOriginalPanel
      ├─ MedicalOutpatientRecordPanel
      └─ TelemetryFunnelPanel（debugのみ）

[Utility Drawer]
- 診療操作 / 処方編集 / オーダー編集 / 文書作成 / 画像 / 検査
```

## 3. 主要UI構成（使用者視点）
### 3.1 トップバー
- **目的**: 状態監視と運用判断のためのメタ情報集約。
- **表示内容**:
  - RUN_ID / dataSourceTransition / missingMaster / cacheHit / fallbackUsed
  - 編集状態（readOnly/approval/lock）
  - 監査サマリ（最新 auditEvent）
  - Charts master（配信設定）
  - Charts送信の有効/無効（配信ポリシー）
  - ETag / 適用先

### 3.2 アクションバー（診療終了・送信・印刷）
- **主要操作**:
  - 診療終了（Finish）
  - ORCA送信（Send）
  - ドラフト保存
  - 印刷
- **ガード条件**:
  - missingMaster / fallbackUsed / dataSourceTransition != server
  - 権限不足 / 患者未選択 / ネットワークオフライン
  - 承認ロック / タブロック（readOnly）
- **送信処理**:
  - medicalmodv2 を送信し invoice/dataId を保持
  - medicalmodv23 は診療終了相当として後続送信
- **再送導線**:
  - 送信失敗時は `/api/orca/queue?patientId=...&retry=1` を呼び出し再送を試行する。
- **印刷処理**:
  - ORCA帳票 API へ送信 → `dataId` 取得 → `/blobapi/{dataId}` で PDF 取得
  - 事前確認ダイアログで必要項目（invoice 等）を確認

#### 3.2.1 各操作の使い分け（運用の迷いを減らす）
- ドラフト保存は、入力途中の退避と引き継ぎに使う。送信や会計の状態は変えない。
- ORCA送信は、外来データを会計側へ渡す操作として扱い、成功したら結果（invoice/dataId）を画面内で追えるようにする。
- 診療終了は、診療を閉じる操作として扱い、終了後に入力が止まる場合は理由と解除条件を明示する。
- 印刷は、帳票の種別と必要項目を最初に確認し、取得に失敗したときは再実行の導線を同じ場所に置く。

#### 3.2.2 ガード時の表示ルール（短い文で伝える）
- 無効化の理由は、できれば一文で出す（例：マスタ未取得のため送信できません）。
- 理由の中に、対処（再取得・管理者連絡・再送など）を一つだけ添える。
- ガードに該当するフラグは、トップバー表示と文言を揃える（missingMaster / fallbackUsed / dataSourceTransition など）。

### 3.3 患者サマリバー（Sticky）
- 患者ID/受付ID/予約ID、年齢・性別、取得日時、承認/ロック状態を表示。
- Reception/Patients からの carry over 情報を保持し、タイムライン/右カラムと同期。

### 3.4 左カラム（PatientsTab + 病名編集）
- **PatientsTab**
  - 受付履歴の一覧（Reception からのエントリ）
  - 患者検索/選択、メモ編集、監査ログ簡易表示
  - Patients 画面への深いリンク（基本/保険の編集）
  - 受付ステータス/role/missingMaster による編集ブロック
- **DiagnosisEditPanel**
  - 病名の作成/更新/削除
  - ORCA disease API と同期、監査ログを付与

### 3.5 中央カラム（SOAP + タイムライン）
- **SoapNotePanel**
  - SOAP入力（S/O/A/P/自由記載）
  - テンプレート挿入/履歴管理
  - 画像添付プレースホルダ挿入（ImageDockedPanel 連携）
  - 症状詳記（ORCA Subjectives）タブ
- **DocumentTimeline**
  - 受付履歴・請求・ORCAキュー・PushEvent を時系列で提示
  - キュー遅延/送信失敗/マスタ欠損時の復旧導線
  - 追加読み込み（無限スクロール/ページング）

### 3.6 右カラム（ORCAサマリ/原本/記録）
- **患者メモ**: 受付/患者情報からの短文メモ
- **OrcaSummary**: `/api/orca/medical/outpatient` から外来サマリ取得
- **OrcaOriginalPanel**: diseaseget/medicalget/tmedicalget/ diseasev3/medicalmod の XML 原本操作
- **MedicalOutpatientRecordPanel**: ORCA取得結果の要約

### 3.7 Utility Drawer
- **診療操作**: Action bar / タイムライン / ORCAサマリへジャンプ
- **処方編集**: OrderBundleEditPanel（medOrder）
- **オーダー編集**: OrderBundleEditPanel（generalOrder）
- **文書作成**: DocumentCreatePanel（紹介状/診断書/返信書）
- **画像**: ImageDockedPanel（/karte/images → 添付）
- **検査**: 現行は遷移補助（将来の検査UI準備）

### 3.8 キーボードショートカット（現行実装）
- **患者検索**: Alt+P / Ctrl+F（`charts-patient-search` へフォーカス）
- **アクション**: Alt+S（送信） / Alt+I（印刷） / Alt+E（診療終了） / Shift+Enter（ドラフト保存）
- **ユーティリティ**: Ctrl+Shift+U（開閉） / Ctrl+Shift+1〜6（診療操作/処方/オーダー/文書/画像/検査）
- **セクション移動**: Ctrl+Shift+← / →（Topbar/ActionBar/Timeline/ORCA Summary/PatientsTab/Telemetry を循環）
- **閉じる**: Esc（ユーティリティドロワーを閉じる）

### 3.9 状態表示とガードの見せ方（使いやすさ補足）
- ボタンや入力欄が無効なときは、理由を画面上で確認できるようにする（ツールチップや補足文など）。
- readOnly / approval / lock は、止まる操作（入力・保存・送信・印刷）を具体的に示す。
- 送信失敗や遅延は、タイムライン上で気づけるようにし、再送操作は近くに置く。
- 復旧が必要な状態（missingMaster など）は、復旧ガイドへの導線を同じ場所に置き続ける。

### 3.10 記録入力を止めないための小さな工夫（実装メモ）
- 入力中のフォーカスは、保存や送信の後もできるだけ維持する。
- テンプレート挿入は、挿入前後が分かるようにし、取り消しができる導線を用意する。
- 画像添付は、プレースホルダ挿入だけで迷わないように、画像一覧を開く導線を並べる。
- タイムラインは、異常（送信失敗・遅延・マスタ欠損）を上に寄せ、次の操作を一つに絞って提示する。

## 4. 主要フロー
### 4.1 Reception からの遷移
- Reception の選択行ダブルクリック → Charts を新規タブで開く。
- RUN_ID / patientId / appointmentId / receptionId / visitDate を URL に carry。

### 4.2 患者切替・ドラフト管理
- 患者切替時は **ドラフト未保存**を検知し、切替ブロック/警告。
- SOAP履歴は sessionStorage（最大件数/容量制限）で保持。

### 4.3 ORCA送信・診療終了
- ORCA送信: medicalmodv2 → 結果を送信キャッシュへ保存。
- 診療終了: medicalmodv23 を後続送信（参考情報として記録）。
- 失敗時は再送導線（/api/orca/queue?patientId=...&retry=1）。

### 4.4 印刷
- 帳票種別（処方箋/お薬手帳/カルテ/請求書/明細）を選択。
- 必須情報不足時は事前ガードでブロックし、理由を表示。

## 5. 監査・観測
- 重要操作は `auditEvent` に記録（action/outcome/operationPhase）。
- runId/traceId を画面全体で継承。
- 管理配信のメタ（ETag/Version）をトップバーで可視化。
- ChartEventStream（SSE）で更新通知を受信。欠損検知時は再同期を実施。

## 6. データ/状態管理
- **RUN_ID**: Reception → Charts で引き継ぎ、各APIへ透過。
- **Tab Lock**: 同一患者を別タブで編集した場合 readOnly 化。
- **Approval Lock**: 承認済みの場合は編集不可。
- **送信キャッシュ**: `/api/orca/queue` と統合し請求状態を再構成。
- **SOAP履歴**: sessionStorage（最大 50件/20エンカウント）。
- **文書履歴**: localStorage（施設/ユーザー単位）。

## 7. API一覧（Charts）
### 7.1 受付/送信/キュー
| 目的 | エンドポイント | method | 主な入力 | 主な出力/扱い |
| --- | --- | --- | --- | --- |
| 受付一覧 | `/api/orca/appointments/list` / `/api/orca/visits/list` | POST (JSON) | date/keyword/department/physician | 受付/予約リストの基礎データ |
| ORCAキュー | `/api/orca/queue` | GET | patientId, retry=1 | 送信状況の可視化・再送導線 |
| ORCAイベント | `/api/orca/pusheventgetv2` | POST (XML) | Base_Date, Event, User | PushEvent の一覧と通知 |

### 7.2 ORCA 送信/会計
| 目的 | エンドポイント | method | 主な入力 | 主な出力/扱い |
| --- | --- | --- | --- | --- |
| 診療送信 | `/api/orca/chart-support/medical-mod-v2` | POST (XML) | Patient_ID, Perform_Date, Dept | Api_Result / Invoice_Number / Data_Id |
| 診療終了 | `/api/orca/chart-support/medical-mod-v23` | POST (XML) | Patient_ID, LastVisit_Date | Api_Result |
| 会計情報 | `/api/orca/chart-support/income-info` | POST (XML) | Patient_ID, Perform_Month | 請求情報の補助 |

### 7.3 病名/オーダー/マスタ
| 目的 | エンドポイント | method | 主な入力 | 主な出力/扱い |
| --- | --- | --- | --- | --- |
| 病名取得 | `/api/orca/disease/import/{patientId}` | GET | from/to/activeOnly | 病名一覧（JSON） |
| 病名更新 | `/api/orca/disease` | POST (JSON) | operations[] | create/update/delete |
| 病名原本 | `/api01rv2/diseasegetv2` | POST (XML) | Patient_ID, Base_Date | ORCA原本参照 |
| 病名XML更新 | `/orca22/diseasev3` | POST (XML) | XML payload | ORCA原本更新 |
| オーダー束 | `/api/orca/order/bundles` | GET/POST | patientId, entity | bundle CRUD |
| マスタ検索 | `/api/orca/master/*` | GET | keyword/effective | generic/youhou/material/etensu など |
| 薬剤詳細補正 | `/api01rv2/medicationgetv2` | POST (XML) | Request_Code | コード補正/選択候補 |
| 禁忌チェック | `/api01rv2/contraindicationcheckv2` | POST (XML) | medication codes | 禁忌/相互作用 |
| 症状詳記 | `/api01rv2/subjectiveslstv2` / `/orca25/subjectivesv2` | POST (XML) | Patient_ID, Perform_Date | 一覧取得/登録 |

### 7.4 文書/画像/帳票
| 目的 | エンドポイント | method | 主な入力 | 主な出力/扱い |
| --- | --- | --- | --- | --- |
| 画像一覧 | `/karte/images`（正）/`/karte/iamges`（typo互換） | GET | patientId, karteId | 画像リスト |
| 画像詳細 | `/karte/image` | GET | imageId | 画像メタ |
| 添付取得 | `/karte/attachment` | GET | attachmentId | 添付内容 |
| 文書保存 | `/karte/document` | POST | 文書 + 添付参照 | 文書ID/監査 |
| 帳票生成 | `/api01rv2/*v2` | POST (XML) | 帳票種別パラメータ | Data_Id を返却 |
| 帳票PDF取得 | `/blobapi/{dataId}` | GET | dataId | PDF BLOB |

### 7.5 Stamp / ユーザー
| 目的 | エンドポイント | method | 主な入力 | 主な出力/扱い |
| --- | --- | --- | --- | --- |
| ユーザー情報 | `/user/{userName}` | GET | userName | userPk 解決 |
| スタンプツリー | `/touch/stampTree/{userPk}` | GET | userPk | スタンプ一覧 |
| スタンプ詳細 | `/touch/stamp/{stampId}` | GET | stampId | スタンプ内容 |

### 7.6 リアルタイム
| 目的 | エンドポイント | method | 主な入力 | 主な出力/扱い |
| --- | --- | --- | --- | --- |
| Chart Event | `/chart-events` | SSE | facilityId/clientUUID | 更新通知（欠損は再同期） |

## 8. 実装上の注意
- 送信・印刷などの **重要操作は必ず確認ダイアログ**を経由する。
- missingMaster / fallbackUsed の場合は編集ブロックし、復旧導線を明示する。
- Utility Drawer は **患者未選択時は disable** し、理由を表示する。
- タブロック/承認ロックは **行動制約 + 理由表示** を必須とする。

## 9. 使い勝手チェック項目（実装レビュー用）
- 患者未選択のとき、何ができないかがひと目で分かり、理由も確認できる。
- 送信できないとき、理由が分かり、復旧の手順が示される。

## 10. 横断UIレビュー反映（RUN_ID=20260130T121758Z）
### 10.1 文言・導線の確認/変更
- 送信失敗表示: トースト「ORCA送信に失敗」＋バナー「ORCA送信に警告/失敗」で統一。
- Missing Master 復旧導線: 「再取得 → Reception → 管理者共有」に統一（ガイド見出し/StatusBadge/nextAction）。
- DocumentTimeline/OrcaSummary の復旧文言は既存仕様の範囲で確認済み（変更なし）。

### 10.2 画面間導線の統一ポイント
- 再送は `/api/orca/queue?retry=1` を使用（確認済み・変更なし）。
- Patients へのリンク／Reception 参照導線は既存仕様どおり（確認済み・変更なし）。

### 10.3 回帰確認（主要シナリオ）
- 送信失敗→再送キュー→Reception反映: `tests/e2e/charts/e2e-orca-claim-send.spec.ts`（grep「再送キュー」、`PLAYWRIGHT_DISABLE_MSW=1`）PASS。
- エラー復旧（ORCA キュー/請求/医療記録）: `tests/e2e/outpatient-generic-error-recovery.msw.spec.ts` PASS。
- 再現手順: 統合設計 `docs/web-client/architecture/web-client-emr-design-integrated-20260128.md` の 3.10.6 と `docs/web-client/operations/ui-review-regression-20260130.md` を参照。

### 10.4 スクリーンショット更新範囲
- 送信失敗トースト/バナー、MissingMaster 復旧導線（再取得→Reception→管理者共有）表示のスクショがある場合は更新。
- 上記以外は確認済み（変更なし）。
- 印刷は必須情報が揃うまで進まないが、足りない項目が分かる。
- ドラフト未保存のまま患者切替やタブ移動をしようとすると、保存して切替・破棄して切替・キャンセルを選べる。
