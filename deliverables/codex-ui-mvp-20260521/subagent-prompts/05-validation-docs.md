# 05 Validation / Docs

あなたは OpenDolphinNext WEBクライアントMVP UI改修のValidation/Docsサブエージェントです。

必ず個別worktree `../worktrees/opendolphin-ui-mvp-validation-docs` で作業してください。モデルは `gpt-5.4`、reasoning effort は `high` です。Foundation、Reception、Charts、Edge Surfacesのマージ後に開始してください。

## 目的

MVP UI改修のガード、テスト、文書、成果物zipを完成させることです。`web-client/` と `docs/` と `deliverables/` を主対象にしてください。

## 参照資料

- `web-client/notes/ui-current-contract.md`
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- `docs/web-client/ux/mvp-ui-remediation-plan-20260521.md`
- 各サブエージェントの報告

## 実施内容

1. `docs/web-client/ux/mvp-ui-remediation-plan-20260521.md` を最終状態へ更新してください。実装済み内容、未実装だが非MVPとした内容、検証結果を整理してください。
2. 可能なら `web-client/scripts/verify-ui-mvp-contract.mjs` を追加してください。最低限、未定義CSS custom property、`FocusTrapDialog` backdrop close既定再混入、通常UIへのraw ORCA body/trace id/request id露出を検出してください。
3. 既存 `verify:web-guard` に安全に組み込めるなら組み込んでください。過度に不安定なら独立scriptにし、validation reportに理由を書いてください。
4. focused testの穴を確認し、必要な最小テストを追加してください。
5. `deliverables/codex-ui-mvp-20260521/validation-report.md` を作成してください。
6. `deliverables/codex-ui-mvp-20260521.zip` を作成してください。zipには、plan doc、subagent prompts、validation report、必要なevidenceだけを入れてください。node_modules、dist、test-resultsの巨大生成物は含めないでください。

## 検証

- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `cd web-client && npm run test:ci`
- `cd web-client && npm run build`
- 必要に応じて `cd web-client && npm run test:e2e:no-artifacts`

## ORCA live/preflight

ORCA live/preflightを行う場合は、既存runbookとQA scriptに従い、read-only/preflightを優先してください。資格情報はローカルsecretまたは環境変数から供給し、repo、成果物、ログ、summaryへraw値を残さないでください。副作用のある操作は既存runbookで安全性が明示されている範囲のみです。

完了時は、検証コマンド結果、未解決事項、作成zip pathを報告してください。

