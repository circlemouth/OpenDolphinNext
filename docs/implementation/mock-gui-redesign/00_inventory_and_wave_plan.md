# Mock GUI Redesign: Inventory and Wave Plan

RUN_ID: `20260513T235022Z`

## 目的と前提

添付ドキュメントセット `/Users/Hayato/Downloads/odn_mock_gui_codex_docset` を全体仕様として読み、現行 `web-client` の患者個別カルテ画面を M01〜M18 のUIモックへ段階的に寄せるための棚卸しと実装計画を定義する。

この文書は実装開始前の計画書であり、ここではコード変更を行わない。実装時も `client/` と `server/` は Legacy 参照専用とし、主対象は `web-client/`、必要時のみ `server-modernized/` と current contract docs を確認する。

## 医療安全プリフライト

### 触る正本と境界

| 領域 | 正本/境界 | 実装時の扱い |
| --- | --- | --- |
| 患者基本・受付・保険・病名・ORCA診療行為 | ORCA / WebORCA 正本 | 画面表示は ORCA 正本/キャッシュ/UNKNOWN を明示する。Web UI側で ORCA 正本を local 正本化しない。 |
| SOAP、カルテ本文、診療録確定、処方指示 | OpenDolphinNext 正本 | 確定済み診療録・確定済み処方を直接上書きしない。訂正/追記/取消の導線と監査を崩さない。 |
| ORCA送信候補、送信結果、帳票プレビュー、画像/文書参照、版履歴 | cache / snapshot / candidate / audit log | キャッシュと正本をUIで混同しない。監査ログは append-only の前提を維持する。 |

### 混同禁止

- `診療録確定`、`処方確定`、`ORCA送信`、`診察終了`、`会計送信`、`会計済み` を同一状態として扱わない。
- ORCA送信の失敗、警告、不一致、`UNKNOWN` を成功扱いしない。
- `診察終了して会計へ送信` は idempotency key と二重送信防止を維持し、判定不能時にタブを閉じない。
- ブラウザ側へ ORCA URL、Basic認証、証明書、証明書パスワード、raw患者情報を露出しない。
- 患者識別情報は `PatientIdentityBar` と重大操作モーダルで再掲する。

### 想定 misuse case

| ID | misuse case | 実装計画上の防止策 |
| --- | --- | --- |
| MC-1 | 新しいタブ/下部ドック/モーダルが患者文脈を URL、`localStorage`、`sessionStorage` に再保存し、患者取り違えやPHI残留を招く。 | 患者文脈は `location.state` と volatile memory の現行契約を維持し、追加UIでも患者ID等を storage key/value に入れない。 |
| MC-2 | ORCA送信結果の `UNKNOWN`、一部失敗、警告を成功バナーに寄せ、会計送信済みとして編集ロック/タブクローズしてしまう。 | `needsCloseAndSendReview` と UNKNOWN を初期表示で強調し、成功/判定不能/失敗を別トーンで表現する。 |
| MC-3 | disabled ボタンだけで理由が見えず、操作者が再送/別導線/二重クリックで危険操作を試す。 | disabled の直近に理由と解除条件を表示し、重大操作は `CriticalOperationConfirmDialog` で患者識別とチェック項目を再掲する。 |
| MC-4 | 他端末更新や患者切替時に未保存SOAP/処方/病名を失う。 | `PatientsTab`、`useChartsTabLock`、dirty guard、競合比較UIを維持し、M06/M08で視認性を上げる。 |
| MC-5 | 帳票/画像/文書/ORCA差分UIに raw資格情報、内部URL、raw XML、不要なPHIを表示・ログ出力する。 | 表示は sanitized summary と相関ID中心にし、raw ORCAパスや資格情報はクライアントに渡さない前提でレビューする。 |

## 1. モックID M01〜M18 と現行コンポーネントの対応表

| Mock | 仕様上の画面/状態 | 現行コンポーネント/入口 | 現行との差分と実装方向 |
| --- | --- | --- | --- |
| M01 | 患者個別カルテ基本ワークスペース。患者ヘッダー、安全アラート、病名、患者サマリ、Past Hub、SOAP、当日オーダー、右カテゴリドック。 | `web-client/src/features/charts/pages/ChartsPage.tsx`, `ChartsPatientSummaryBar.tsx`, `DiagnosisEditPanel.tsx`, `PatientSummaryPanel.tsx`, `PastHubPanel.tsx`, `SoapNotePanel.tsx`, `OrderSummaryPane.tsx`, `RightUtilityDock.tsx` | 既存の3カラム/右ドックを活かし、患者識別・安全情報・ORCA状態を上段で常時見える構造へ寄せる。 |
| M02 | 処方候補/処方入力ドロワー。患者候補、施設頻用、ORCA診療セット、検索追加。 | `RightUtilityDrawer.tsx`, `OrderDockPanel.tsx`, `PrescriptionOrderEditorPanel.tsx`, `OrcaMedicalCandidatePanel.tsx` | 右ドロワーのカテゴリUIを共通化し、候補/編集中/ORCA候補/検索の情報階層を整理する。注射・処置・検査・算定は同レイアウトのカテゴリ差分で扱う。 |
| M03 | 病名詳細入力モーダル。未コード化警告、ORCA送信予定内容。 | `DiagnosisEditPanel.tsx`, `FocusTrapDialog.tsx` | `<details>` に寄りがちな重要情報を初期表示し、未コード化/ORCA送信予定/患者識別を大型モーダルに載せる。 |
| M04 | Past HubからのDo転記プレビュー。転記元・転記先の並列確認。 | `PastHubPanel.tsx`, `DoCopyDialog.tsx` | 転記差分の左右比較、転記先患者/日時/未保存影響を見やすくし、既存の適用ガードを保つ。 |
| M05 | 下部ドックの文書タブ。診療情報提供書、文書履歴、画像添付。 | `ChartsPage.tsx`, `DocumentCreatePanel.tsx`, `documentImageAttach` 関連 | `showBottomUtilityDock = false` の現状を実装時の切替点とし、文書/画像/帳票を下部ドックで統一する。 |
| M06 | 患者・受付選択。未保存変更時の安全な患者切替。 | `web-client/src/features/patients/PatientsTab.tsx`, 患者切替確認ダイアログ | 既存の patient switch confirm / dirty draft confirm を保ち、患者識別と未保存影響の視認性を上げる。 |
| M07 | 診察終了して会計へ送信の確認。チェックリストと帳票選択。 | `ChartsActionBar.tsx`, `CriticalOperationConfirmDialog.tsx`, `closeAndSendBillingApi.ts` | 既存の会計送信確認を拡張し、患者識別、送信対象、チェックリスト、帳票選択、会計済みではない説明を明示する。 |
| M08 | 他端末更新・編集ロック競合。現在入力と最新保存内容の比較。 | `editLock` 関連, `useChartsTabLock`, `ChartsPage.tsx` | ロック/競合をトーストや単純警告だけに閉じず、比較レビューUIとして患者・版・操作者を表示する。 |
| M09 | 1つのRPに単剤を入れる処方入力。 | `PrescriptionOrderEditorPanel.tsx` | RP単位の構造を明確化し、1 RP = 共通用法のルールをUI上で常時表示する。 |
| M10 | 複数薬剤を1つのRPに入れる処方入力。1 RP = 単独共通用法。 | `PrescriptionOrderEditorPanel.tsx`, `orderRpNormalization`, `orderRpRequirements` | RP内複数薬剤の追加/削除/用法共有の表示を強化し、異なる用法は別RPへ誘導する。 |
| M11 | 処方チェック結果。重複投与、相互作用、アレルギー。 | `PrescriptionOrderEditorPanel.tsx`, `orcaOrderInteractionApi` | 既存の静的相互作用チェックを患者安全チェック表示へ寄せ、警告・禁忌・確認済みを区別する。 |
| M12 | ORCA送信結果。成功/失敗/一部失敗/応答詳細/再送導線。 | `ChartsActionBar.tsx`, `ChartsPage.tsx`, `closeAndSendBillingApi.ts`, `orcaClaimApi.ts` | `needsCloseAndSendReview` とエラー状態を前面に出し、UNKNOWN時の再送/受付復旧導線を安全に分ける。 |
| M13 | ORCA正本再取得と院内表示との差分確認。 | `OrcaOriginalPanel.tsx`, patient sync/diff 関連 | 現状 `OrcaOriginalPanel` は `null`。ORCA正本/院内表示/キャッシュの差分を明示する新規実装対象。 |
| M14 | 版履歴・訂正履歴・署名確定。 | `revisions/RevisionHistoryDrawer.tsx`, revision page/drawer, approval state | 現行drawerをタイムライン/署名/訂正理由/監査情報が追える構造へ寄せる。 |
| M15 | 画像アップロード、カメラ撮影、スキャン取込、添付先選択。 | `ImageDockedPanel.tsx`, `ImageDropzone.tsx`, `ImageCameraCapture.tsx` | 下部ドック内で画像取込を統一し、添付先患者/文書/カルテ文脈を常時表示する。 |
| M16 | セット/スタンプ適用前の差分プレビュー。 | `StampLibraryPanel.tsx`, `OrderSetEditorPage`, set apply preview | 適用前差分、対象患者、既存オーダーへの影響を確認してから反映する導線へ寄せる。 |
| M17 | 帳票選択・印刷/PDFプレビュー。 | `print/ReportPrintDialog.tsx`, `useOrcaReportPrint` | 帳票選択、プレビュー、出力先、ORCA/院内由来の区別を下部ドックまたは大型モーダルで整理する。 |
| M18 | 会計送信済み状態。通常編集ロック、会計画面移動、取消理由。 | billing completion state, `ChartsActionBar.tsx`, `ChartsPage.tsx` | 会計送信済みをカルテ確定/会計済みと混同しない表示にし、通常編集ロック、取消理由、受付/会計復旧導線を分ける。 |

## 2. 実装に使う共通UI基盤の設計

### 既存基盤を優先するもの

| 共通UI | 現行ファイル | 設計方針 |
| --- | --- | --- |
| 患者識別バー | `web-client/src/shared/components/PatientIdentityBar.tsx` | M01/M06/M07/M08/M12/M18の患者取り違え防止の主軸にする。患者ID、氏名、生年月日、性別、年齢、受付日、診療科、医師、保険、ORCA source/cacheを削らない。 |
| 状態チップ | `web-client/src/shared/components/StatusPill.tsx` | ORCA状態、未保存、編集ロック、処方安全チェック、会計送信状態のトーンを統一する。 |
| 重大操作確認 | `web-client/src/shared/components/CriticalOperationConfirmDialog.tsx` | M07/M12/M14/M18で患者識別、対象、結果、チェックリストを再掲する。実装時は checklist / extraContent / size などの後方互換オプション追加を検討する。 |
| アクセシブルモーダル | `web-client/src/shared/components/FocusTrapDialog.tsx` | M03/M04/M08/M11/M13/M17の大型モーダル基盤にする。実装時は `className`、`size`、`description`、footer slots などを非破壊で追加する。 |
| 臨床カテゴリicon | `web-client/src/features/charts/ClinicalIcon.tsx` | 右ドック/下部ドック/カテゴリタブの意味付けを既存iconで統一する。 |
| 全体スタイル | `web-client/src/features/charts/styles.ts`, `web-client/src/styles/global.css` | charts固有の密度・3カラム・下部ドック・モーダル拡張を charts 側に寄せ、global 変更は最小化する。 |

### 新規または拡張するUI単位

| UI単位 | 想定配置 | 役割 |
| --- | --- | --- |
| `ChartSafetyBanner` | `features/charts` または `features/charts/ui` | アレルギー、感染、異常検査、保険/ORCA注意、未保存/ロックを M01 上段で見える化する。 |
| `ClinicalPanelShell` | `features/charts/ui` | 病名、患者サマリ、Past Hub、SOAP、当日オーダーなどの見出し、補助情報、toolbar密度を統一する。 |
| `ClinicalDrawerShell` | `features/charts/ui` | M02系の処方/注射/処置/検査/算定ドロワーの共通枠。候補、施設頻用、ORCAセット、検索、入力中の状態を同じ構造で持つ。 |
| `BottomUtilityDock` | `ChartsPage.tsx` 配下または `features/charts` | M05/M15/M16/M17を同じ下部ドック内で切り替える。患者文脈を storage に保存しない。 |
| `DiffPreviewLayout` | `features/charts/ui` | M04/M08/M13/M16で左右比較、変更点、適用影響を共通化する。 |
| `OrcaResultPanel` | `features/charts` | M12/M18で成功/失敗/一部失敗/UNKNOWN/再送導線を一貫表示する。 |

### DADS/医療安全ルール

- placeholder を説明文代わりにしない。入力欄の外にラベル、補助文、エラーを置く。
- disabled ボタンだけに依存しない。不可理由と解除条件を直近に表示する。
- 重要情報を初期非表示の `<details>` に閉じ込めない。未コード化、UNKNOWN、警告、不一致、患者識別、会計送信状態は初期表示する。
- 主要CTAは文脈ごとに1つだけ強い塗りボタンにし、重大操作は confirm を必須にする。
- タップ/クリック対象は 44px 程度を確保し、表やドックの密度を上げても読める行高を維持する。
- 一色に偏ったテーマへ寄せず、状態色は success/warning/danger/info を意味で使い分ける。

## 3. 変更対象ファイル一覧

### 中核画面

| ファイル | 主な対象Mock | 予定変更 |
| --- | --- | --- |
| `web-client/src/features/charts/pages/ChartsPage.tsx` | M01, M05, M08, M12, M18 | 3カラム密度、患者安全バナー、下部ドック有効化、ORCA結果/会計送信済み状態の配置。 |
| `web-client/src/features/charts/ChartsPatientSummaryBar.tsx` | M01 | 患者ヘッダー、安全情報、ORCA source/cache 表示の強化。 |
| `web-client/src/features/charts/ChartsActionBar.tsx` | M07, M12, M18 | 診察終了/会計送信確認、送信結果、会計送信済み状態のCTA整理。 |
| `web-client/src/features/charts/DiagnosisEditPanel.tsx` | M01, M03 | 病名一覧と詳細モーダルの情報階層改善。 |
| `web-client/src/features/charts/SoapNotePanel.tsx` | M01, M08 | SOAP入力密度、未保存/競合状態の表示確認。 |
| `web-client/src/features/charts/OrderSummaryPane.tsx` | M01, M09, M10, M18 | 当日オーダーと会計送信後ロック状態の表示。 |

### 右ドック・オーダー・処方

| ファイル | 主な対象Mock | 予定変更 |
| --- | --- | --- |
| `web-client/src/features/charts/RightUtilityDock.tsx` | M01, M02 | カテゴリドックの見た目、選択状態、キーボード/ARIA確認。 |
| `web-client/src/features/charts/RightUtilityDrawer.tsx` | M02 | 候補/頻用/ORCAセット/検索追加の再構成。 |
| `web-client/src/features/charts/OrderDockPanel.tsx` | M02 | カテゴリ別入力コンテナの整理。 |
| `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx` | M02, M09, M10, M11 | RP単位UI、安全チェック、処方確定確認の見直し。 |
| `web-client/src/features/charts/OrcaMedicalCandidatePanel.tsx` | M02 | ORCA診療候補の表示トーンと追加導線。 |

### モーダル・患者切替・履歴

| ファイル | 主な対象Mock | 予定変更 |
| --- | --- | --- |
| `web-client/src/features/charts/DoCopyDialog.tsx` | M04 | Do転記の左右比較と適用ガード。 |
| `web-client/src/features/patients/PatientsTab.tsx` | M06 | 患者/受付選択と未保存切替確認の視認性改善。 |
| `web-client/src/features/charts/revisions/RevisionHistoryDrawer.tsx` | M14 | 版履歴、訂正、署名、監査情報のタイムライン化。 |
| `web-client/src/features/charts/OrcaOriginalPanel.tsx` | M13 | ORCA正本差分UIの新規/再有効化対象。 |
| `web-client/src/shared/components/FocusTrapDialog.tsx` | M03, M04, M08, M11, M13, M17 | 大型モーダル対応の後方互換拡張。 |
| `web-client/src/shared/components/CriticalOperationConfirmDialog.tsx` | M07, M12, M14, M18 | checklist/extra content/size の後方互換拡張。 |

### 下部ドック・文書・画像・帳票

| ファイル | 主な対象Mock | 予定変更 |
| --- | --- | --- |
| `web-client/src/features/charts/DocumentCreatePanel.tsx` | M05 | 文書タブ、履歴、添付導線。 |
| `web-client/src/features/images/components/ImageDockedPanel.tsx` | M15 | 画像ドックの密度と患者/添付先表示。 |
| `web-client/src/features/images/components/ImageDropzone.tsx` | M15 | 取込状態、ファイル制限、患者識別表示の確認。 |
| `web-client/src/features/images/components/ImageCameraCapture.tsx` | M15 | カメラ取込状態と中断/保存導線。 |
| `web-client/src/features/charts/StampLibraryPanel.tsx` | M16 | セット/スタンプ適用前プレビュー。 |
| `web-client/src/features/charts/print/ReportPrintDialog.tsx` | M17 | 帳票選択、PDFプレビュー、出力導線。 |

### スタイル・テスト

| ファイル/ディレクトリ | 予定変更 |
| --- | --- |
| `web-client/src/features/charts/styles.ts` | charts画面全体、ドック、モーダル、状態表示のCSS調整。 |
| `web-client/src/styles/global.css` | 共有トークンやフォーカス/アクセシビリティの最小調整のみ。 |
| `web-client/src/features/charts/__tests__/` | M01〜M18に対応する既存テスト更新/追加。 |
| `web-client/src/features/patients/__tests__/` | M06患者切替の未保存ガード確認。 |
| `web-client/src/features/images/__tests__/` | M15画像ドックの確認。 |

## 4. 競合リスクの高いファイル一覧

| リスク | ファイル | 理由 | 衝突回避方針 |
| --- | --- | --- | --- |
| 高 | `web-client/src/features/charts/pages/ChartsPage.tsx` | 患者カルテ画面の状態、送信、ドック、タブ、dirty guard が集中している。 | Waveごとに責務を区切り、先に共通UI/型を用意して大きな同時編集を避ける。 |
| 高 | `web-client/src/features/charts/styles.ts` | 多数コンポーネントの見た目に影響し、CSS競合が起きやすい。 | charts配下の新規class命名を固定し、globalへ逃がさない。 |
| 高 | `web-client/src/features/charts/ChartsActionBar.tsx` | 診察終了、会計送信、取消、承認解除など重大操作が集約されている。 | M07/M12/M18を同一Waveで一貫して扱い、状態名を混同しない。 |
| 高 | `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx` | RP構造、処方安全チェック、確定確認が複雑でテスト影響が大きい。 | RPモデルを壊さず見た目から寄せ、異なる用法の分離ルールをテストで固定する。 |
| 高 | `web-client/src/features/charts/RightUtilityDrawer.tsx` | M02系カテゴリ差分の中心で、処方/注射/処置/検査/算定が同時に触れる。 | `ClinicalDrawerShell` などの共通枠に寄せてカテゴリ固有差分を小さくする。 |
| 中 | `web-client/src/features/charts/DiagnosisEditPanel.tsx` | ORCA病名、未コード化、確定/取消確認に絡む。 | 未コード化/ORCA送信予定を隠さないことを完了条件にする。 |
| 中 | `web-client/src/features/charts/DoCopyDialog.tsx` | Past Hub転記と未保存影響に絡む。 | 適用ロジックは維持し、比較表示中心に変更する。 |
| 中 | `web-client/src/shared/components/FocusTrapDialog.tsx` | 共有モーダルのため広範囲に影響する。 | 既存props互換を保ち、追加propsのみで拡張する。 |
| 中 | `web-client/src/shared/components/CriticalOperationConfirmDialog.tsx` | 重大操作確認の共有基盤。 | 既存呼び出しを壊さず、M07/M12/M18向けの任意slotを追加する。 |
| 中 | `web-client/src/features/patients/PatientsTab.tsx` | 患者切替安全導線に関わる。 | 現行dirty guardを消さずに表示改善へ限定する。 |

## 5. Wave 1〜Wave 5 の実装計画

### Wave 1: Foundation + M01 Chart Shell

対象Mock: M01、M02の外枠、M08/M12/M18の状態表示土台。

作業内容:

- `PatientIdentityBar`、`StatusPill`、`FocusTrapDialog`、`CriticalOperationConfirmDialog` の拡張方針を確定する。
- `ChartSafetyBanner`、`ClinicalPanelShell`、`ClinicalDrawerShell`、`DiffPreviewLayout`、`OrcaResultPanel` の最小共通UIを追加する。
- `ChartsPage.tsx` の患者個別カルテ基本ワークスペースを M01 の情報階層へ寄せる。
- 患者文脈を URL/storage に入れない現行契約を維持する。
- `showBottomUtilityDock = false` の扱いを確認し、Wave 4で安全に有効化できる接続点を整理する。

主な変更候補:

- `web-client/src/features/charts/pages/ChartsPage.tsx`
- `web-client/src/features/charts/ChartsPatientSummaryBar.tsx`
- `web-client/src/features/charts/DiagnosisEditPanel.tsx`
- `web-client/src/features/charts/SoapNotePanel.tsx`
- `web-client/src/features/charts/OrderSummaryPane.tsx`
- `web-client/src/features/charts/RightUtilityDock.tsx`
- `web-client/src/features/charts/styles.ts`
- `web-client/src/shared/components/FocusTrapDialog.tsx`
- `web-client/src/shared/components/CriticalOperationConfirmDialog.tsx`

### Wave 2: Orders / RP / Right Drawer

対象Mock: M02、M09、M10、M11。

作業内容:

- 右ドロワーの候補、施設頻用、ORCA診療セット、検索追加を M02 へ寄せる。
- 処方RP UIで「1 RP = 共通用法」を常時明示し、単剤/複数薬剤の入力を M09/M10 に寄せる。
- 重複投与、相互作用、アレルギーなどの安全チェック結果を M11 として表示する。
- 注射/処置/検査/算定は M02 と同一レイアウトのカテゴリ差分で実装する。
- 処方確定、ORCA候補追加、RP正規化の既存テストを壊さない。

主な変更候補:

- `web-client/src/features/charts/RightUtilityDrawer.tsx`
- `web-client/src/features/charts/OrderDockPanel.tsx`
- `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`
- `web-client/src/features/charts/OrcaMedicalCandidatePanel.tsx`
- `web-client/src/features/charts/styles.ts`
- `web-client/src/features/charts/__tests__/`

### Wave 3: Clinical Modals / Patient Switch / Conflict

対象Mock: M03、M04、M06、M08。

作業内容:

- 病名詳細モーダルで未コード化警告とORCA送信予定内容を初期表示する。
- Do転記プレビューを転記元/転記先の左右比較へ寄せる。
- 患者/受付選択と未保存変更時の患者切替確認を M06 へ寄せる。
- 他端末更新・編集ロック競合を M08 の比較レビューUIへ寄せる。
- 既存の dirty draft guard、tab lock、patient context contract を維持する。

主な変更候補:

- `web-client/src/features/charts/DiagnosisEditPanel.tsx`
- `web-client/src/features/charts/DoCopyDialog.tsx`
- `web-client/src/features/patients/PatientsTab.tsx`
- `web-client/src/features/charts/pages/ChartsPage.tsx`
- `web-client/src/features/charts/styles.ts`
- `web-client/src/shared/components/FocusTrapDialog.tsx`

### Wave 4: Bottom Dock / Docs / Images / Stamp / Report

対象Mock: M05、M15、M16、M17。

作業内容:

- 下部ドックを文書、画像、セット/スタンプ、帳票で統一し、必要な箇所から起動できるようにする。
- 文書タブで診療情報提供書、文書履歴、画像添付を M05 に寄せる。
- 画像アップロード、カメラ撮影、スキャン取込、添付先選択を M15 に寄せる。
- セット/スタンプ適用前の差分プレビューを M16 として明示する。
- 帳票選択とPDFプレビューを M17 として整理する。
- 添付/画像の storage URI、object key、digest、owner/facility をクライアント権威にしない。

主な変更候補:

- `web-client/src/features/charts/pages/ChartsPage.tsx`
- `web-client/src/features/charts/DocumentCreatePanel.tsx`
- `web-client/src/features/images/components/ImageDockedPanel.tsx`
- `web-client/src/features/images/components/ImageDropzone.tsx`
- `web-client/src/features/images/components/ImageCameraCapture.tsx`
- `web-client/src/features/charts/StampLibraryPanel.tsx`
- `web-client/src/features/charts/print/ReportPrintDialog.tsx`
- `web-client/src/features/charts/styles.ts`

### Wave 5: ORCA / Revision / Post-Send / QA

対象Mock: M12、M13、M14、M18 と全体QA。

作業内容:

- ORCA送信結果の成功/失敗/一部失敗/UNKNOWN/再送導線を M12 として整理する。
- `OrcaOriginalPanel.tsx` を実装し、ORCA正本再取得と院内表示との差分を M13 として表示する。
- 版履歴、訂正履歴、署名確定を M14 として整理する。
- 会計送信済み状態、通常編集ロック、会計画面移動、取消理由を M18 として表示する。
- 全Waveの回帰テスト、型チェック、ビルド、ブラウザ目視確認を実施する。

主な変更候補:

- `web-client/src/features/charts/ChartsActionBar.tsx`
- `web-client/src/features/charts/pages/ChartsPage.tsx`
- `web-client/src/features/charts/OrcaOriginalPanel.tsx`
- `web-client/src/features/charts/revisions/RevisionHistoryDrawer.tsx`
- `web-client/src/features/charts/OrderSummaryPane.tsx`
- `web-client/src/features/charts/styles.ts`
- `web-client/src/features/charts/__tests__/`

## 6. サブエージェント起動順

実装時は下記の順に起動する。各サブエージェントは専用worktree/担当範囲を分け、他のエージェントの変更を巻き戻さない。今回は計画のみで、サブエージェントは起動しない。

| 順序 | 名前 | 対応docset | 担当Wave/範囲 | 主な所有ファイル |
| --- | --- | --- | --- | --- |
| 1 | `ui/mock-foundation` | `subagents/10_subagent_foundation_prompt.md` | Wave 1 基盤 | shared components、charts UI shell、styles基盤 |
| 2 | `ui/mock-chart-shell` | `subagents/11_subagent_chart_shell_prompt.md` | Wave 1 M01 | `ChartsPage.tsx`, `ChartsPatientSummaryBar.tsx`, `SoapNotePanel.tsx`, `OrderSummaryPane.tsx` |
| 3 | `ui/mock-orders` | `subagents/12_subagent_orders_prescription_prompt.md` | Wave 2 | `RightUtilityDrawer.tsx`, `OrderDockPanel.tsx`, `PrescriptionOrderEditorPanel.tsx` |
| 4 | `ui/mock-modals` | `subagents/13_subagent_modals_workflows_prompt.md` | Wave 3 | `DiagnosisEditPanel.tsx`, `DoCopyDialog.tsx`, `PatientsTab.tsx`, conflict UI |
| 5 | `ui/mock-dock-docs-images` | `subagents/14_subagent_bottomdock_docs_images_prompt.md` | Wave 4 | `DocumentCreatePanel.tsx`, image components, `StampLibraryPanel.tsx`, `ReportPrintDialog.tsx` |
| 6 | `ui/mock-history-orca` | `subagents/15_subagent_history_orca_postsend_prompt.md` | Wave 5 | `OrcaOriginalPanel.tsx`, `RevisionHistoryDrawer.tsx`, `ChartsActionBar.tsx`, post-send state |
| 7 | `ui/mock-qa` | `subagents/16_subagent_qa_prompt.md` | Wave 5 QA | tests、visual verification、acceptance checklist |

## 7. 各Waveの完了条件

### Wave 1 完了条件

- M01 の主要構造、患者ヘッダー、安全アラート、病名、患者サマリ、Past Hub、SOAP、当日オーダー、右ドックが現行機能を保ったまま表示される。
- 患者ID、氏名、生年月日、性別、年齢、受付日、診療科、医師、保険、ORCA source/cache が削られていない。
- 患者文脈が URL、`localStorage`、`sessionStorage` に新規保存されていない。
- 既存の patient tab / encounter context / dirty guard が回帰していない。

### Wave 2 完了条件

- M02/M09/M10 の処方候補/入力/RP構造が再現される。
- 「1 RP = 共通用法。異なる用法は別RP」がUIとテストで確認できる。
- M11 の安全チェックが警告/禁忌/確認済みを区別して表示される。
- ORCA候補や処方確定を成功扱いする条件が既存契約から緩んでいない。

### Wave 3 完了条件

- M03 の未コード化警告とORCA送信予定内容が初期表示される。
- M04 のDo転記プレビューで転記元/転記先/患者/日時/未保存影響を確認できる。
- M06 の患者切替で未保存変更がある場合に安全確認が表示される。
- M08 の編集競合で最新保存内容と現在入力を比較でき、失う可能性のある内容が見える。

### Wave 4 完了条件

- M05/M15/M16/M17 が下部ドックまたは統一された大型モーダルで利用できる。
- 文書、画像、セット/スタンプ、帳票の各導線で患者識別と添付/出力先が見える。
- storage URI、object key、digest、owner/facility をクライアント由来の正本として扱っていない。
- 画像/文書/帳票UIに raw資格情報、内部URL、raw ORCA応答、不要なPHIが表示されない。

### Wave 5 完了条件

- M12 で成功、失敗、一部失敗、UNKNOWN、再送/復旧導線が区別される。
- M13 で ORCA正本、院内表示、キャッシュ/差分の境界が分かる。
- M14 で版履歴、訂正、署名、監査情報が追える。
- M18 で会計送信済み、通常編集ロック、取消理由、会計/受付導線が表示される。
- 全体QAで acceptance checklist、型チェック、テスト、ビルド、ブラウザ確認が完了する。

## 8. 既存機能を壊さないための確認項目

### 必須確認

- 患者文脈を URL、`localStorage`、`sessionStorage` に保存していない。
- `encounterKey` / `scheduleKey` なしに会計送信や患者タブ復元を進めていない。
- ORCA送信の `UNKNOWN`、警告、不一致、失敗を成功扱いしていない。
- ORCA送信成功を診療録確定、処方確定、会計済みと混同していない。
- 会計送信の idempotency key と二重送信防止を壊していない。
- 重大操作モーダルに患者識別情報が再掲される。
- disabled ボタンの直近に理由と解除条件がある。
- 確定済み診療録または確定済み処方指示を直接上書きしていない。
- 監査ログに必要な操作者、対象患者、対象診療録/処方、ORCA結果の導線が残る。
- ORCA URL、Basic認証、証明書、証明書パスワード、raw XML、raw患者情報がブラウザ/ログ/証跡に漏れない。
- `client/` と `server/` を変更していない。

### 推奨検証コマンド

Waveごとに focused test を先に回し、統合後に full gate を実施する。

```bash
cd web-client && npm run verify:web-guard
cd web-client && npm run typecheck
cd web-client && npm run test:ci
cd web-client && npm run build
```

必要に応じて対象テストを絞る。

```bash
cd web-client && npm test -- --run src/features/charts/__tests__
cd web-client && npm test -- --run src/features/patients/__tests__
cd web-client && npm test -- --run src/features/images/__tests__
```

server/API契約へ波及した場合のみ、該当の Maven focused test と static analysis を実施する。

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=<TestClass> test
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
```

### 実装開始前の作業ブランチ/既存差分メモ

調査時点の作業ブランチは `master`。既存の未コミット差分として以下があるため、実装時に混ぜて staging/revert しない。

- `server-modernized/src/test/java/open/dolphin/session/ChartRevisionExportServiceTest.java`
- `server-modernized/src/test/java/open/dolphin/tools/ci/RepoGuardScriptsTest.java`

## 実装停止条件

次のいずれかに該当する場合、そのWaveは完了扱いにせず、UIを先に進めない。

- 患者取り違え防止情報が隠れる、または重大操作確認から消える。
- ORCA `UNKNOWN` / 警告 / 不一致 / 失敗が成功と同じ見た目または同じ後続処理になる。
- 患者文脈、ORCA資格情報、raw患者情報が URL/storage/log/evidence に残る。
- 既存の dirty guard、tab lock、idempotency、二重送信防止、監査導線が壊れる。
- DADSに反する placeholder依存、理由なし disabled、重要情報の初期非表示が残る。
