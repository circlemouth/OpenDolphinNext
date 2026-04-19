# Static exit and dynamic handoff

## static exit checklist
すべて埋まるまで dynamic ORCA trial check に進めない。

- [ ] SA-01: omission gate / route guard / older follow-up docs drift が current truth に揃った
- [ ] SA-02: import full-success semantics が business success + canonical readback success で閉じた
- [ ] SA-03: row-local direct negatives と must-visible visibility lock が揃った
- [ ] SA-04: clientAuthConfigured truthfulness と sanitize rendered-surface tests が揃った
- [ ] `cd web-client && npm run verify:web-guard`
- [ ] `cd web-client && npm run typecheck`
- [ ] focused tests from `61_TEST_MATRIX.csv`
- [ ] `cd web-client && npm run ci`
- [ ] `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
- [ ] reception / administration / send success != paid / route taxonomy public surface の guard が clean
- [ ] final report で unknown / not verified を success 扱いしていない

## dynamic に渡す時点でも unknown のまま残るもの
- actual WebORCA 到達性
- actual auth / mTLS handshake
- live captured request での omission evidence
- live ORCA での patient import partial/full success behavior
- same-day multi-encounter live data 上の overlay integrity

## static exit 後の dynamic trial entry guidance
ここから先は別フェーズ。static package 実行中は行わない。

Codex で ORCA 接続テストをする場合の trial site:
- URL: official WebORCA Trial endpoint from local secret store or environment only.
- user: local secret store or `ORCA_TRIAL_USER` only.
- password source: local secret store or `ORCA_TRIAL_PASSWORD` only.

dynamic trial 開始前の最低条件:
1. static exit checklist が全部埋まっている
2. `docs/runbooks/release-validation.md` と `docs/releases/orca-remediation-cutover.md` が current code truth と一致している
3. older follow-up docs の carry-forward pass claim が cleanup されている
4. final static report に residual unknown が明記されている

dynamic で優先して見る項目:
1. `QA_MEDICAL_INFORMATION` 未指定 run で actual browser capture に leak がないこと
2. patient import の business partial / canonical readback behavior が static semantics と一致すること
3. same-day multi-encounter / multi-reception で charts overlay が row-local に保たれること
4. readiness / audit で `clientAuthConfigured` の observability が live config truth と一致すること

## dynamic report の禁止事項
- static fix だけで live success を既成事実化しない
- unknown / not verified を pass 扱いしない
- artifact があるだけで gate pass と書かない
