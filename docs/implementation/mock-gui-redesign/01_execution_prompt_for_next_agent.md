# Mock GUI Redesign Execution Prompt for Next Agent

このプロンプトは、別担当者が `docs/implementation/mock-gui-redesign/00_inventory_and_wave_plan.md` に基づいて M01〜M18 の UI redesign 実装を完遂するための実行指示である。

下記をそのまま新しい Codex 担当者へ渡す。

```text
あなたは OpenDolphinNext / OpenDolphin WebClient の実装担当メインエージェントです。

目的:
`docs/implementation/mock-gui-redesign/00_inventory_and_wave_plan.md` に基づき、添付docset `/Users/Hayato/Downloads/odn_mock_gui_codex_docset` の M01〜M18 UIモックへ現行 `web-client` の患者個別カルテ画面を段階的に寄せ、実装、テスト、ブラウザ確認、最終報告まで完遂してください。

重要:
- この作業は大規模で、単一ターン完遂が不確かです。作業開始直後に Codex のハートビート機能を使い、このスレッドへ定期的に戻って進捗継続できるようにしてください。目安は30分間隔です。heartbeat のプロンプトには「最新のgit状態、Wave進捗、未完了チェックリスト、失敗中の検証を確認し、実装を継続する」と入れてください。cronではなく、このスレッドに紐づく heartbeat を優先してください。
- このプロンプトはサブエージェント利用を明示的に許可します。メインエージェントは全体設計、競合調整、統合、最終検証の責任を持ち、サブエージェントは明確に分離した担当範囲で並行作業させてください。
- サブエージェントは同じファイルを同時に編集しないように所有範囲を分けてください。他者の変更を revert してはいけません。
- 実装途中で大きな不確実性、テスト失敗、UI崩れ、ORCA/患者文脈の安全性懸念を見つけた場合も、別チケット送りにせず、根本原因、是正、検証まで行ってください。

最初に必ず実施:
1. `date -u +%Y%m%dT%H%M%SZ` で RUN_ID を採番する。
2. `git status --short` と `git branch --show-current` を確認し、既存差分を自分の変更と混ぜない。
3. 次を読む:
   - `AGENTS.md`
   - `docs/implementation/mock-gui-redesign/00_inventory_and_wave_plan.md`
   - `/Users/Hayato/Downloads/odn_mock_gui_codex_docset/README.md`
   - `/Users/Hayato/Downloads/odn_mock_gui_codex_docset/01_mock_image_inventory.md`
   - `/Users/Hayato/Downloads/odn_mock_gui_codex_docset/02_implementation_plan.md`
   - `/Users/Hayato/Downloads/odn_mock_gui_codex_docset/03_acceptance_checklist.md`
   - `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
   - `docs/web-client/ux/web-client-ui-guideline.md`
   - `web-client/notes/ui-current-contract.md`
   - `web-client/notes/patient-context-contract.md`
   - `docs/web-client/ux/medical-safety-ui-rules.md`
   - `docs/architecture/ehr-orca-source-of-truth-boundary.md`
   - `docs/architecture/ehr-chart-prescription-authority.md`
   - `docs/architecture/orca-integration-safety-contract.md`
4. ハートビートを設定する。設定後、現在の作業計画とサブエージェント分担を短く記録してから実装に入る。

医療安全の絶対条件:
- 患者文脈を URL、`localStorage`、`sessionStorage` に新規保存しない。
- ORCA送信の失敗、警告、不一致、UNKNOWNを成功扱いしない。
- ORCA送信成功を診療録確定、処方確定、会計済みと混同しない。
- `診療録確定`、`処方確定`、`ORCA送信`、`診察終了`、`会計送信`、`会計済み` を同一状態にしない。
- 会計送信の idempotency key と二重送信防止を壊さない。
- 確定済み診療録や確定済み処方指示を直接上書きしない。
- 重大操作モーダルには患者識別情報を必ず再掲する。
- disabled ボタンだけに依存せず、理由と解除条件を直近に表示する。
- ORCA URL、Basic認証、証明書、証明書パスワード、raw XML、raw患者情報をブラウザ、ログ、証跡に出さない。
- Legacy の `client/` と `server/` は参照専用。明示指示なしに変更しない。

サブエージェント起動方針:
サブエージェントは次の順で使ってください。メインエージェントは最初にコード構造を把握し、即時ブロッカーは自分で処理しつつ、並行可能な作業だけを委譲してください。

1. `ui/mock-foundation`
   - 対応docset: `/Users/Hayato/Downloads/odn_mock_gui_codex_docset/subagents/10_subagent_foundation_prompt.md`
   - 所有範囲: shared components、charts UI shell、styles基盤
   - 期待成果: `PatientIdentityBar`、`StatusPill`、`FocusTrapDialog`、`CriticalOperationConfirmDialog` の後方互換拡張案と実装、`ChartSafetyBanner`、`ClinicalPanelShell`、`ClinicalDrawerShell`、`DiffPreviewLayout`、`OrcaResultPanel` の最小基盤

2. `ui/mock-chart-shell`
   - 対応docset: `/Users/Hayato/Downloads/odn_mock_gui_codex_docset/subagents/11_subagent_chart_shell_prompt.md`
   - 所有範囲: `ChartsPage.tsx`, `ChartsPatientSummaryBar.tsx`, `SoapNotePanel.tsx`, `OrderSummaryPane.tsx`
   - 期待成果: M01 基本ワークスペース、患者ヘッダー、安全アラート、右ドック接続、患者文脈非storage維持

3. `ui/mock-orders`
   - 対応docset: `/Users/Hayato/Downloads/odn_mock_gui_codex_docset/subagents/12_subagent_orders_prescription_prompt.md`
   - 所有範囲: `RightUtilityDrawer.tsx`, `OrderDockPanel.tsx`, `PrescriptionOrderEditorPanel.tsx`, `OrcaMedicalCandidatePanel.tsx`
   - 期待成果: M02/M09/M10/M11、RP単位UI、1 RP = 共通用法、安全チェック表示、カテゴリ差分

4. `ui/mock-modals`
   - 対応docset: `/Users/Hayato/Downloads/odn_mock_gui_codex_docset/subagents/13_subagent_modals_workflows_prompt.md`
   - 所有範囲: `DiagnosisEditPanel.tsx`, `DoCopyDialog.tsx`, `PatientsTab.tsx`, conflict UI
   - 期待成果: M03/M04/M06/M08、未コード化/ORCA送信予定の初期表示、Do転記左右比較、患者切替安全確認、競合比較

5. `ui/mock-dock-docs-images`
   - 対応docset: `/Users/Hayato/Downloads/odn_mock_gui_codex_docset/subagents/14_subagent_bottomdock_docs_images_prompt.md`
   - 所有範囲: `DocumentCreatePanel.tsx`, image components, `StampLibraryPanel.tsx`, `ReportPrintDialog.tsx`
   - 期待成果: M05/M15/M16/M17、下部ドック、文書、画像、セット/スタンプ差分、帳票プレビュー

6. `ui/mock-history-orca`
   - 対応docset: `/Users/Hayato/Downloads/odn_mock_gui_codex_docset/subagents/15_subagent_history_orca_postsend_prompt.md`
   - 所有範囲: `OrcaOriginalPanel.tsx`, `RevisionHistoryDrawer.tsx`, `ChartsActionBar.tsx`, post-send state
   - 期待成果: M12/M13/M14/M18、ORCA送信結果、ORCA正本差分、版履歴/署名、会計送信済み状態

7. `ui/mock-qa`
   - 対応docset: `/Users/Hayato/Downloads/odn_mock_gui_codex_docset/subagents/16_subagent_qa_prompt.md`
   - 所有範囲: tests、visual verification、acceptance checklist
   - 期待成果: focused test更新、acceptance checklist消化、Playwright/ブラウザ目視確認、最終gate支援

Wave順序:

Wave 1: Foundation + M01 Chart Shell
- 共通UI基盤を入れ、M01の基本ワークスペースを成立させる。
- `showBottomUtilityDock = false` の扱いを確認し、Wave 4で安全に有効化できる接続点を作る。
- 完了条件: M01主要構造、患者識別、ORCA source/cache、dirty guard、patient context contract が維持されている。

Wave 2: Orders / RP / Right Drawer
- M02/M09/M10/M11を実装する。
- 完了条件: 1 RP = 共通用法がUIとテストで確認でき、処方安全チェックの警告/禁忌/確認済みを区別できる。

Wave 3: Clinical Modals / Patient Switch / Conflict
- M03/M04/M06/M08を実装する。
- 完了条件: 未コード化警告、ORCA送信予定、Do転記比較、未保存患者切替、競合比較が初期表示または明確な主要導線で確認できる。

Wave 4: Bottom Dock / Docs / Images / Stamp / Report
- M05/M15/M16/M17を実装する。
- 完了条件: 下部ドックで文書、画像、セット/スタンプ、帳票が使え、患者識別と添付/出力先が見える。クライアント由来の storage URI/object key/digest/owner/facility を権威扱いしない。

Wave 5: ORCA / Revision / Post-Send / QA
- M12/M13/M14/M18と全体QAを完了する。
- 完了条件: ORCA成功/失敗/一部失敗/UNKNOWN/再送導線が区別され、ORCA正本差分、版履歴/署名、会計送信済み状態が安全に表示される。全体検証が通る。

実装中の統合ルール:
- メインエージェントは、サブエージェント結果を待つだけで止まらず、非重複の統合作業、テスト整備、スタイル確認を進める。
- サブエージェントが返した変更は必ずレビューし、安全境界、型、テスト、UI一貫性を確認してから統合する。
- 競合リスクの高い `ChartsPage.tsx`、`styles.ts`、`ChartsActionBar.tsx`、`PrescriptionOrderEditorPanel.tsx`、`RightUtilityDrawer.tsx` はメインエージェントが最終統合責任を持つ。
- 既存機能を消すのではなく、既存のAPI、guard、dirty state、tab lock、audit導線を活かしてUIを寄せる。
- DADSに反する placeholder 依存、理由なし disabled、重要情報の初期非表示を増やさない。

検証:
Waveごとに focused test を先に実行し、最後に full gate を実行してください。

最低限:
- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `cd web-client && npm run test:ci`
- `cd web-client && npm run build`

必要に応じて:
- `cd web-client && npm test -- --run src/features/charts/__tests__`
- `cd web-client && npm test -- --run src/features/patients/__tests__`
- `cd web-client && npm test -- --run src/features/images/__tests__`

server/API契約へ波及した場合のみ:
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=<TestClass> test`
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`

ブラウザ確認:
- 実装後、可能なら `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh` で起動し、患者個別カルテ画面をブラウザで確認する。
- M01〜M18相当の状態を確認し、スクリーンショットや証跡に raw患者情報、ORCA資格情報、raw ORCA応答を残さない。

最終成果:
- M01〜M18の実装差分。
- 必要なテスト更新。
- 必要な current docs 更新。UI仕様や安全契約が変わる場合は `docs/` または `web-client/notes/` を更新する。
- 最終報告には、実施内容、変更ファイル、検証コマンド結果、残リスク、未実施があれば理由を日本語で記載する。
- 作業完了後、ユーザーから求められた場合はコミットする。worktree作業であれば報告前にコミットする。

Done判定:
- M01〜M18の主要構造、色、余白、操作階層が実装されている。
- 患者安全情報、未保存、ORCA正本/キャッシュ、編集ロック、送信失敗、会計送信後ロックが隠れない。
- 主要CTAは各文脈で1つだけ強い塗りボタンになっている。
- 全重大操作で患者識別情報が再掲される。
- ORCA UNKNOWN/警告/不一致/失敗が成功扱いされていない。
- web-client guard、typecheck、test、build が通っている。
- Legacy `client/` / `server/` を変更していない。
- 作業ツリーの差分を説明でき、不要な生成物や秘密情報を含まない。
```

## メインエージェント向け補足

このプロンプトは「サブエージェントを起動してよい」ことを明示している。後続担当者がサブエージェント利用可能な環境にいる場合、上記の順に並列化できる。利用不可の環境では同じWave順序で単独実装する。

ハートビートは長時間作業の継続性を確保するための指示であり、実装担当スレッドに紐づけて設定する。別スレッドで作業を始める場合は、その別スレッド側で設定する。
