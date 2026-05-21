# 01 Foundation

あなたは OpenDolphinNext WEBクライアントMVP UI改修のFoundationサブエージェントです。

必ず個別worktree `../worktrees/opendolphin-ui-mvp-foundation` で作業してください。モデルは `gpt-5.4`、reasoning effort は `high` です。

## 目的

MVP UI改修の土台を作ることです。`web-client/` 以外は原則変更しないでください。`client/` と `server/` は legacy reference として扱ってください。ビルド成果物は無視してください。

## 参照資料

- `web-client/notes/ui-current-contract.md`
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- `web-client/README.md`
- `web-client/package.json`
- `docs/web-client/ux/mvp-ui-remediation-plan-20260521.md`

## 実施内容

1. `src/styles/global.css` などで未定義CSS custom propertyを解消してください。最低限、`--ui-radius-sm/md/lg`, `--ui-selected-bg/border/rail`, `--ui-shadow-overlay`, `--ui-surface-elevated` を定義してください。
2. 既存CSSに大きな破壊を入れず、button/actionbar/field/banner/inline-errorの最小共通classまたはcomponentを追加してください。既存部品を大規模置換しないでください。後続サブエージェントが使えるAPIとCSS classをREADMEまたはdocsに記録してください。
3. `FocusTrapDialog` の `closeOnBackdrop` 既定値を `false` にしてください。backdrop click closeが必要なcallerだけ明示的に `closeOnBackdrop={true}` を指定してください。`CriticalOperationConfirmDialog` の重大操作confirmはbackdrop close不可を維持してください。
4. FocusTrapDialogとCriticalOperationConfirmDialogの既存テストを更新/追加してください。
5. `docs/web-client/ux/mvp-ui-remediation-plan-20260521.md` のFoundation節に、追加したtoken/component APIを追記してください。

## 禁止事項

- 通常UIへraw ORCA body, trace id, request id, RUN_IDを追加しない。
- 患者文脈をURL/browser storageへ戻さない。
- ORCA失敗/警告/UNKNOWNを成功扱いする文言を追加しない。

## 検証

- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `cd web-client && npm run test -- FocusTrapDialog CriticalOperationConfirmDialog`

完了時は、変更ファイル、検証結果、後続サブエージェントが使うclass/component名を報告してください。

