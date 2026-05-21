# 03 Charts

あなたは OpenDolphinNext WEBクライアントMVP UI改修のChartsサブエージェントです。

必ず個別worktree `../worktrees/opendolphin-ui-mvp-charts` で作業してください。モデルは `gpt-5.4`、reasoning effort は `high` です。Foundationマージ後のブランチから開始してください。

## 目的

Charts画面をMVPとして安全に操作できるUIへ整えることです。大規模な全面再設計ではなく、患者識別、重大操作、ORCA送信/診察終了、オーダー保存、SOAP/患者サマリ保存の安全UIを完成させてください。

## 参照資料

- `web-client/notes/ui-current-contract.md` の Charts Surface
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- Foundationサブエージェントが追加したtoken/component docs
- `docs/web-client/ux/mvp-ui-remediation-plan-20260521.md`

## 主対象

- `src/features/charts/pages/ChartsPage.tsx`
- `src/features/charts/ChartsActionBar.tsx`
- `src/features/charts/OrderBundleEditPanel.tsx`
- `src/features/charts/OrderDockPanel.tsx`
- `src/features/charts/SoapNotePanel.tsx`
- `src/features/charts/PatientSummaryPanel.tsx`
- `src/features/charts/styles.ts`
- 関連テスト

## 実施内容

1. Charts画面上部と重大操作前で、患者ID、氏名、性別/年齢、診療日/受付日、診療科、担当医、保険/ORCA取得状態を見える位置に保ってください。
2. `ChartsActionBar` の ORCA送信、診察終了して会計へ送信、保存、印刷、補助操作のprimary/secondary/danger/tertiaryを整理してください。primary濫用を避け、危険操作はdangerにしてください。
3. ORCA送信・診察終了・order bundle submitは、read-only、missing master、fallback data、encounter context不足、保存中などでnative disabledだけに頼らず、押下時または近傍に理由を表示し、mutationへ進まないようにしてください。
4. `OrderBundleEditPanel` は全面分割しないでください。MVPではfooter submit、検索/追加、danger操作、block reason表示、action footerの整理を優先してください。
5. `SoapNotePanel` と `PatientSummaryPanel` は保存不可理由を近傍に表示し、保存中/変更なし/read-only/履歴表示の区別を保ってください。
6. 重大操作は `CriticalOperationConfirmDialog` を使い、患者識別と操作名、distinct confirm labelを再掲してください。
7. focused testsを追加/更新してください。

## 禁止事項

- patient/facility/insurance/voucher/sequential/raw ORCA bodyを不要にrequest bodyやvisible UIへ混ぜない。
- canonical encounter不足時にORCA送信やincome/report printへ進めない。
- ORCA送信の失敗・警告・UNKNOWNを成功扱いにしない。
- right railに削除済みの重複導線を再混入させない。

## 検証

- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `cd web-client && npm run test -- ChartsActionBar OrderBundleEditPanel SoapNotePanel PatientSummaryPanel`

完了時は、変更ファイル、改善した安全UI、検証結果、残課題を報告してください。

