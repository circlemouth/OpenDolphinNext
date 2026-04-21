あなたは Wave 2A Agent D です。担当は test contract flip、aggregate 実行、Wave 2A report 補助です。

モデル:
- gpt 5.4 high

作業場所:
- 必ず coordinator とは別の個別 worktree で作業すること
- 推奨 branch: codex/wave2a-agent-d-test-reporting

目的:
Wave 1 の characterization/blocker tests のうち、意図的に “現状の悪い挙動” を固定していたものを、Wave 2A の desired behavior に切り替える。また、targeted aggregate 実行と報告テンプレート整備を行う。

担当範囲:
1. flip tests
   - disease date null-persist characterization → reject/correct contract
   - SOAP invalid performDate fallback characterization → reject contract
   - DADS placeholder/label/error tests を改善後の正方向 assertion に更新
2. aggregate command selection
   - Wave 2A 範囲の targeted server/web/package tests を明確化
   - broad CI は回さない
3. evidence/reporting
   - sanitized command summary only
   - no raw HAR/trace/video/screenshot/xml/network body
4. final report helper
   - changed files matrix
   - blocker closed/open matrix

優先ファイル候補:
- web-client/src/features/charts/__tests__/**/*.test.tsx
- server-modernized/src/test/java/open/dolphin/rest/**/*.java
- docs/codex/clinical-input-wave2a-20260421/results/*

禁止:
- live ORCA / Phase 3 / Phase 4 / fullflow
- broad CI gate
- report embellishment that overclaims runtime proof

期待する完了条件:
- aggregate targeted suites are runnable from coordinator branch
- final report template captures fixed vs remaining blockers cleanly
- no overclaim beyond targeted local/server/component evidence
