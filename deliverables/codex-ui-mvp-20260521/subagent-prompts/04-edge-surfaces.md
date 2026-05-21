# 04 Edge Surfaces

あなたは OpenDolphinNext WEBクライアントMVP UI改修のEdge Surfacesサブエージェントです。

必ず個別worktree `../worktrees/opendolphin-ui-mvp-edge-surfaces` で作業してください。モデルは `gpt-5.4`、reasoning effort は `high` です。Foundationマージ後のブランチから開始してください。

## 目的

Login、Patients、Mobile Images、Administrationを、MVPとして最低限破綻なく使えるUIへ整えることです。大規模刷新ではなく、入力説明、理由表示、inline style整理、button/alert階層統一を優先してください。

## 参照資料

- `web-client/notes/ui-current-contract.md`
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- Foundationサブエージェントが追加したtoken/component docs
- `docs/web-client/ux/mvp-ui-remediation-plan-20260521.md`

## 主対象

- `src/LoginScreen.tsx`
- `src/features/login/*`
- `src/features/patients/PatientsPage.tsx`
- `src/features/patients/patients.css`
- `src/features/images/pages/MobileImagesUploadPage.tsx`
- `src/features/images/components/*`
- `src/features/administration/*`
- `src/styles/app-shell.css`
- 関連テスト

## 実施内容

1. Loginのplaceholder依存を減らし、label/support/error textへ移してください。factor2 6桁入力の説明とエラー文を明示してください。
2. Login/Patientsの主要CTAは、native disabledだけでなく理由表示を持たせてください。DADS方針に沿って、未入力のまま押された場合に不足項目を案内する設計を優先してください。
3. Patientsは検索、保存、ORCA参照、official/local境界のUI説明を整理し、患者文脈と内部/debug情報を混ぜないでください。
4. Mobile Imagesはinline styleをCSSへ移し、患者未選択、ファイル未選択、選択ファイル要約、個別エラー、アップロード中、失敗を見えるようにしてください。
5. Administrationは既存AdminCard/AdminAlert/AdminFieldをFoundation tokenへ寄せ、保存/接続確認/危険操作のbutton階層を整理してください。
6. App shell/mobile表示で、ナビゲーションが大きく破綻しないように最低限のresponsive調整をしてください。DADS上、bottom navigationは使わないでください。
7. focused testsを追加/更新してください。

## 禁止事項

- 認証フローやsession storage規約を壊さない。
- 患者文脈をURL/browser storageへ戻さない。
- Mobile Imagesで患者未確定のアップロードを可能にしない。
- Administrationでsecretや生credentialをvisible UIへ追加しない。

## 検証

- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `cd web-client && npm run test -- LoginScreen PatientsPage MobileImagesUploadPage AdministrationPage`

完了時は、変更ファイル、改善点、検証結果、残課題を報告してください。

