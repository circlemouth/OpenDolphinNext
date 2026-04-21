あなたは Wave 2A Agent C です。担当は web UI validation と DADS-critical follow-up です。

モデル:
- gpt 5.4 high

作業場所:
- 必ず coordinator とは別の個別 worktree で作業すること
- 推奨 branch: codex/wave2a-agent-c-web-dads-validation

目的:
Wave 1 の DADS high-severity blocker を、過剰 redesign をせずに clinical input で最低限必要な改善へ落とし込む。

担当範囲:
1. SOAP UI
   - textarea に visible label / support text を与える
   - ordinary validation/save error は static and concrete にする
   - disabled を使う箇所は近傍に理由/有効化条件を出す
2. Disease UI
   - date input guidance を visible support text で出す
   - invalid date / chronology / outcome error を concrete text で出す
   - placeholder を guidance 代用にしない
   - ended disease default-visible policy変更はしない。必要なら note を final report に残す
3. Document UI
   - placeholder 依存を減らし、support text / concrete static error を付ける
   - ordinary validation で role=alert / assertive live region 依存を見直す
4. patient identity visibility
   - disease/SOAP/document の save/send context で patient identity visibility を補う
5. tests
   - component tests を更新/追加
   - DADS contract tests を positive assertion に更新

DADS根拠は docs/web-client/ux/dads_app_ui_design_rules_20260411.md に限定する:
- important information not hidden
- label/support text/error text
- placeholder not used as substitute
- disabled avoided or reason/enabling condition nearby
- one primary action per screen/context
- date input guidance
- error text concrete and static
- accessibility/focus/contrast if source supports checking

優先ファイル候補:
- web-client/src/features/charts/SoapNotePanel.tsx
- web-client/src/features/charts/DiagnosisEditPanel.tsx
- web-client/src/features/charts/DocumentCreatePanel.tsx
- web-client/src/features/charts/__tests__/dadsClinicalInputContract.test.tsx
- related feature tests for SOAP/disease/document

禁止:
- broad visual redesign
- unrelated component library migration
- Playwright raw artifact generation
- order set redesign

期待する完了条件:
- Wave 1 DADS blockers D-001 and D-003 are meaningfully reduced
- disease date guidance and concrete validation exist
- patient identity visibility is improved in save/send context or explicitly documented if partial
- component tests pass

報告に必ず書くこと:
- which DADS bullets were addressed
- what remains intentionally deferred
- any selectors/test rewrites caused by placeholder removal
