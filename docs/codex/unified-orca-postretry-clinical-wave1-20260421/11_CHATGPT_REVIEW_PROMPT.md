# 11. ChatGPT review prompts

## WO-1 review prompt

```text
あなたは OpenDolphinNext の ORCA Phase 3 post-retry hardening package reviewer です。

この作業はコード変更なしです。
patch / commit / 修正実装 / テスト追加は禁止です。

Codex が作成した WO-1 package を読み、以下を検証してください。

1. Phase 3 retry が再実行されていないか。
2. Phase 4 / fullflow / mutation が not_run のままか。
3. final ZIP source-scope scan が final ZIP hash を対象にしているか。
4. artifact-sha256.txt が package 内にあり、ledger verification が通っているか。
5. command logs に actual timestamp があるか。
6. phase3ExecutionRunId / preflightIdentityRunId / childHarnessEvidenceRunId が分離されているか。
7. C7 evidence が requestNumber01ValueVerified=true を含むか。
8. C7/source/tests が 00/02/03/04/blank/null/object/array/wrong patient/wrong candidate/zero/multiple request を reject するか。
9. apiResult=K3 が acceptedWithWarnings であり、K3 単独ではなく registration evidence + C7 accepted を要求しているか。
10. apiResult=60 / Request_Number=00 / HTTP 200 alone / wrapper exit 0 alone が mutation success になっていないか。
11. raw credential / cookie / Authorization / JSESSIONID / CSRF token value / raw ORCA body / raw patient detail / raw insurance detail / HAR / trace / video / screenshot / raw network dump が package に含まれていないか。
12. WO-2 に進めるか。

出力:
- overall review verdict
- work order readiness verdict
- executive summary
- package integrity matrix
- source/test/evidence matrix
- command matrix
- secret/sanitize assessment
- blocker matrix
- final recommendation
```

## WO-2 review prompt

```text
あなたは OpenDolphinNext の static/DADS recovery package reviewer です。
コード変更なしで、package 内 evidence をレビューしてください。

typecheck/build/test:ci の失敗が修正または明示 waiver されたか、DADS 判断が dads_app_ui_design_rules_20260411.md の範囲内か、Phase 3/Phase 4/mutation が実行されていないかを検証してください。
```

## WO-3/WO-4 review prompt

```text
あなたは OpenDolphinNext Clinical Input Wave 1 package reviewer です。
コード変更なしで、clinical local/server/component/static coverage をレビューしてください。

live ORCA medicalmodv2/diseasev3/subjectivesv2、Phase 3/4、fullflow が claim されていないかを重点確認してください。
```
