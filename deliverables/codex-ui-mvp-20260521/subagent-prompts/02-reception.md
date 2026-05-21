# 02 Reception

あなたは OpenDolphinNext WEBクライアントMVP UI改修のReceptionサブエージェントです。

必ず個別worktree `../worktrees/opendolphin-ui-mvp-reception` で作業してください。モデルは `gpt-5.4`、reasoning effort は `high` です。Foundationマージ後のブランチから開始してください。

## 目的

受付画面をMVPとして安全に操作できるUIへ整えることです。`web-client/` 以外は原則変更しないでください。

## 参照資料

- `web-client/notes/ui-current-contract.md` の Reception Surface
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- Foundationサブエージェントが追加したtoken/component docs
- `docs/web-client/ux/mvp-ui-remediation-plan-20260521.md`

## 主対象

- `src/features/reception/pages/ReceptionPage.tsx`
- `src/features/reception/styles.ts`
- `src/features/reception/components/*`
- `src/features/shared/PatientIdentityBar.tsx`
- 関連テスト

## 実施内容

1. 受付日、患者検索、表示条件、ステータスタブ、表/カード切替、再取得をcompact control stripとして破綻なく表示してください。既存contractの配置方針を下回らないでください。
2. 患者検索/既存患者受付モーダルの受付登録フォームより先に `PatientIdentityBar` または同等の医療安全患者ヘッダーを表示してください。
3. 受付登録CTAは患者文脈が明確な場所に置き、患者未選択、ORCA受付対象未確認、診療科/担当医/保険未確定などの理由を近傍または押下時に表示してください。native disabledだけで止めないでください。
4. 受付取消は `CriticalOperationConfirmDialog` を使い、氏名・年齢・性別/小児区分・現在状態・実行操作名を再掲してください。通常UIにRUN_ID、trace id、raw ORCA body、内部IDを出さないでください。
5. Debug diagnostic panelsは `VITE_ENABLE_DEBUG_UI=1` かつsystem_admin/development debug routeなど既存条件に限定してください。
6. 表/カード表示の主要行操作は、カルテ/handoffがcanonical成立している場合に限定し、patientIdだけでChartsを開く導線を復活させないでください。
7. focused testsを追加/更新してください。

## 禁止事項

- 新患登録や患者作成を受付MVPへ混ぜない。
- local seed/fallback患者をofficial受付検索結果へ混在させない。
- ORCA受付成立証跡なしに受付成功表示を捏造しない。
- debug/internal情報を通常visible copyへ出さない。

## 検証

- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `cd web-client && npm run test -- ReceptionPage`

完了時は、変更ファイル、スクリーン上のMVP改善点、検証結果、残課題を報告してください。

