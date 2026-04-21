# 03. Main Codex prompt

```text
あなたは OpenDolphinNext clinical input coverage hardening の Codex メイン統括エージェントです。

目的:
CWP-01 の integration gate を確認し、通過後に CWP-05 / CWP-02 / CWP-03 / CWP-04 / CWP-06 を並列起動して統括する。

前提:
CWP-01: order-containing `/karte/document` save/readback/revision preservation tests は、ワーカー報告上 PASS。
報告された branch / commit / artifact:
- branch: codex/cwp01-karte-order-persistence
- commit: f6121aa23 docs: finalize CWP-01 order persistence evidence
- artifact: clinical-input-cwp01-karte-order-persistence-20260421.zip
- artifact SHA-256: bb7d646646b474cb345e108f25dfa0e3fad2db5a13d55b7285d94d85096c26f2

CWP-01 reported verified:
- medOrder / treatmentOrder / radiologyOrder を含む canonical DocumentModel fixture
- KarteDocumentWriteService.addDocument equivalent server write path
- beanJson encode、module metadata、parent backreference、integrity seal
- detail readback
- revision snapshot、restore/revise clone path、diff digest、integrity tamper detection
- targeted Maven tests exit code 0, 24 tests, failures 0

ただし、以下は未検証のまま:
- Playwright / e2e / runtime browser success
- Phase 3 / Phase 4 / fullflow
- live ORCA mutation / ORCA medicalmodv2 success
- HTTP-level revise/restore authorization/history-group full flow
- ORCA claim field semantics
- ORCA 公式仕様との完全照合

最初に行うこと:
1. CWP-01 branch / commit / artifact SHA-256 / zip contents / targeted test summary をローカルで検証する。
2. 検証結果を sanitized command log として docs/codex に記録する。
3. CWP-01 を integration base branch に取り込む。
4. 以後の work package は CWP-01 統合後の base から個別 worktree を切る。

必須禁止事項:
- 外部 web を使わない。
- live ORCA mutation を行わない。
- Phase 3 / Phase 4 / fullflow を行わない。
- ORCA live success を claim しない。
- MSW / unit / local server test success を live ORCA success と書かない。
- 実行していない Playwright/e2e/runtime success を claim しない。
- raw HAR / trace / video / screenshot / credentials / secrets を成果物に含めない。
- build artifacts は成果物 zip に含めない。
- ORCA 公式仕様判断が必要な内容は “要 ORCA 公式仕様確認” として残す。

並列方針:
CWP-01 integration gate 後、以下の 5 work package を可能な限り並列に進める。
全 sub-agent は gpt-5.4 high で起動し、必ず個別 worktree で作業する。

推奨 worktree:
git worktree add ../odn-cwp05-disease-date-readback -b codex/cwp05-disease-date-readback
git worktree add ../odn-cwp02-soap-server-reload -b codex/cwp02-soap-server-reload
git worktree add ../odn-cwp03-prescription-local-flow -b codex/cwp03-prescription-local-flow
git worktree add ../odn-cwp04-generic-order-matrix -b codex/cwp04-generic-order-matrix
git worktree add ../odn-cwp06-document-two-phase-failure -b codex/cwp06-document-two-phase-failure

Sub-agent assignments:
- Sub-agent A: CWP-05 disease date/readback validation
- Sub-agent B: CWP-02 SOAP canonical server reload
- Sub-agent C: CWP-03 prescription full local persistence
- Sub-agent D: CWP-04 generic order bundle matrix + static ORCA boundary
- Sub-agent E: CWP-06 document attachment two-phase failure

Merge order:
1. CWP-01 verification / integration base
2. CWP-05 disease date/readback
3. CWP-02 SOAP server reload
4. CWP-04 generic order matrix
5. CWP-03 prescription local flow
6. CWP-06 document two-phase failure
7. shared docs/evidence updates
8. final targeted regression commands
9. final report

共通 acceptance:
- 追加テストは targeted command で実行し、exit code / test count / failures / skipped を記録する。
- git diff --check を通す。
- 可能なら既存 doc link checker を通す。
- 成果物 zip には source/test/docs/sanitized logs のみを含める。
- final report に verified / not verified / ORCA boundary / DADS boundary / next package を明記する。
- runtime browser / Playwright / live ORCA を実行していない場合は not verified と書く。

最終成果物:
- 各 branch の commit
- docs/codex/clinical-input-wave1-YYYYMMDD/ 以下の統合報告
- artifacts/codex/clinical-input-wave1-YYYYMMDD.zip
- artifact SHA-256
- targeted command summary
- not verified list
- next recommended CWP-07/CWP-08/CWP-09/CWP-10 plan
```
