# 09. Merge Order and Conflict Plan

## canonical merge order
1. SA-01 transport-security-hardening
2. SA-03 patients-canonical-readback
3. SA-02 charts-claim-signal-and-summary-visibility
4. SA-04 docs-tests-qa-alignment
5. main-agent stabilization

## merge checkpoints
### after SA-01
- server tests pass
- no runtime fallback remains in touched code
- sanitize negative tests exist

### after SA-03
- patients tests pass
- full-success semantics only after canonical re-fetch success
- dialog close semantics confirmed

### after SA-02
- charts tests pass
- `OrcaSummary.tsx` ownership fixed
- row-local cache semantics confirmed
- must-visible sections visible

### after SA-04
- docs/tests/scripts are aligned with final code semantics
- script gate matches release docs

## conflict hotspots
### hotspot A: `OrcaSummary.tsx` vs `OrcaSummary.semantics.test.tsx`
- owner code: SA-02
- owner tests/docs: SA-04
- rule: SA-04 must rebase after SA-02. layout assertion は SA-02 final code に追従する

### hotspot B: Patients success copy vs release docs
- owner code: SA-03
- owner docs/scripts: SA-04
- rule: SA-04 は SA-03 が確定させた partial failure semantics を文書化する。別 semantics を作らない

### hotspot C: server sanitize message text
- owner code/tests: SA-01
- rule: docs は message literal に依存しすぎない。reason code / sanitized policy を中心に書く

## main-agent stabilization allowed
- selector drift 修正
- wording drift 修正
- import path/typing conflict 修正
- test fixture 更新
- minor style drift 修正

## main-agent stabilization forbidden
- new blocker scope 追加
- route/state ownership 変更
- broad redesign
- live ORCA 実行

## reopen condition
次のどれかが起きたら、main agent は merge を止めて human へ報告する。
1. SA 間で semantics が食い違う
2. repo truth と blocker verdict が衝突する新証拠が出た
3. pass area regression を避けられない
4. dynamic test をしないと判断できない項目が blocker として現れた
