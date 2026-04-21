あなたは OpenDolphinNext clinical input Wave 2A の統括 Codex エージェントです。

目的:
Wave 1 で確認された high-severity blocker のうち、仕様が比較的明確で、production implementation fix と targeted test update で前進できるものを解消する。

Wave 2A で解く対象:
1. diagnosis date validation
   - UI の yyyy-MM-dd を server が正しく受け取るか、受けないなら fail-closed で 400 を返す
   - invalid date を受理して null 永続化しない
   - endDate before startDate を reject する
2. diagnosis outcome validation
   - unknown outcome を free-pass しない
   - repo 内で正当化できる allowlist を採用する。repo で根拠が足りない場合は conservative に reject し、文言と test を揃える
3. SOAP performDate validation
   - invalid performDate を current date fallback で保存しない
   - fail-closed か、明示的・監査可能な fallback のどちらかに統一する。今回の default は fail-closed
4. parser logging hardening
   - invalid date などの ordinary client error で stack trace を露出しない
5. /karte/document POST/PUT audit
   - create/update の server-side audit event を追加する
   - actor, patient, karte, document, action, outcome, timestamp, correlation/request context を過不足なく残す
6. DADS-critical UI follow-up
   - SOAP: visible label / support text / concrete static error / disabled reason
   - Disease: date guidance / concrete validation / non-placeholder guidance
   - Document: placeholder 依存を減らし、support text / concrete static error を付与
   - save/send context の patient identity visibility を補強する

Wave 2A で解かない対象:
- order set extended field preservation の仕様変更
- ended disease を default-visible にするかの臨床判断
- ORCA medicalmodv2 / diseasev3 / subjectivesv2 の official compatibility 確認
- live ORCA mutation / Phase 3 / Phase 4 / fullflow / reception registration mutation
- legacy client/ や legacy server/ の変更

必須制約:
- 外部 web 禁止
- ORCA 公式仕様 web lookup 禁止。必要事項は “要 ORCA 公式仕様確認” と残す
- live ORCA mutation 禁止
- Phase 3 / Phase 4 / fullflow / reception registration mutation 禁止
- raw HAR / trace / video / screenshot / raw XML / raw network body / credential / cookie / token を evidence に含めない
- production clinical implementation change は Wave 2A の範囲に限る
- DADS 判断は docs/web-client/ux/dads_app_ui_design_rules_20260411.md に限定する

作業方法:
- サブエージェントは全て gpt 5.4 high で起動する
- 各サブエージェントは必ず個別 worktree で作業する
- main coordinator は subagent 起動、merge 順、conflict 解消、aggregate 実行、最終報告を担当する
- 各 subagent には docs/codex/clinical-input-wave2a-20260421/ の個別 prompt を渡す

サブエージェント:
A: server validation and parser logging
B: /karte/document create/update audit
C: web UI validation and DADS follow-up
D: test contract flip, aggregate execution, reporting

推奨 merge 順:
1. Agent A
2. Agent B
3. Agent C
4. Agent D

最終成果物:
docs/codex/clinical-input-wave2a-20260421/results/WAVE2A_COORDINATOR_REPORT.md

最終報告に必ず含めること:
- base commit / final commit / merge order / worktree status
- changed files
- tests added/updated
- commands run and results
- fixed blockers / remaining blockers
- ORCA boundary statement
- DADS scope statement
- not-run commands and reasons
- next wave recommendation
