# 01 task split

## A. Codex で実リポジトリ作業するタスク

以下は source / test / scripts / repo docs の変更を伴うため、Codex が実リポジトリで作業する。

| priority | cluster | severity | affected area | coding scope | invariant |
|---:|---|---|---|---|---|
| 1 | C7-01 / C7-02 | Critical / High | reception; tests/docs/QA/cutover | QA helper/scripts/tests/docs | 未指定 run では `medicalInformation` / `Medical_Information` key の presence 自体を failure。target mutation request は 1 件以上必須。 |
| 2 | C5-01 | High | patients | import API/tests/UI-adjacent tests | full success は business all-zero + errors 0 + skipped 0 + requested/fetched/imported consistency + canonical readback success。 |
| 3 | C3-01 / C3-02 | High / Medium | charts/chart-support | Timeline / print / component tests | positive transmission / invoice / print prefill は row-local key match 以外から出さない。patient/latest fallback は positive signal source にしない。 |
| 4 | C2-01 / C1-01 | High / Medium | route/transport/config/security | config validation / admin resource / tests | userinfo URL と `default` sentinel literal を config/admin/transport/readiness で同一ルール拒否。 |
| 5 | RT-01 | High | route/transport/config/security; tests/docs/QA/cutover | static guard script / mock-test boundary / docs | server public surface、client fail-close sentinel、mock/test surface の境界を guard/docs/tests で一致。 |
| 6 | T-NEG-01 | Medium | route/transport/config/security | sanitizer negative tests and any needed fixes | rendered detail log、admin save failure payload/details、userinfo admin view を direct negative test で固定。 |
| 7 | C6-01 | Medium | UI/DADS; charts/chart-support | OrcaSummary unit/e2e tests and any needed UI fixes | ORCA収納情報の重要 labels は `toBeVisible()` と details-out で lock。DOM presence only を success evidence にしない。 |
| 8 | DOC cleanup after code | Medium | tests/docs/QA/cutover | docs edits after source truth | carried-forward PASS / already closed 表現を current repo truth と混同させない。 |
| 9 | TEST evidence | Medium | tests/docs/QA/cutover | command execution/log capture | claimed green は rerun result または repo 内 log/artifact がある場合だけ accepted。 |

## B. ChatGPT で検討するコーディング不要タスク

以下は、まず ChatGPT に検討させる。出力は方針・文言・チェックリストであり、コード・patch を作らない。

| topic | why non-coding first | output expected |
|---|---|---|
| health/readiness contract policy | docs は anonymous status-only、source/test は detailed body 前提。どちらを official contract にするかの方針判断が必要。 | source変更なしの方針メモ、採用する invariant、Codex に渡す場合の短い実装指示 |
| route taxonomy explanation | server public surface と client fail-close sentinel/mocks/tests が混同されやすい。 | ORCA trial communication 用の正確な説明文 |
| carried-forward docs cleanup policy | 旧 docs の PASS / already closed 表現をどう扱うか統一する必要。 | 置換方針、禁止表現、許可表現 |
| DADS evidence interpretation | C6 は DADS 文書だけで判断する必要。 | 重要情報、details-out、1 primary、visibility lock の判定基準 |
| worker report / test evidence policy | test claim accepted 条件を統一する必要。 | worker report テンプレート、accepted / not verified の書き分け |
| dynamic trial handoff plan | static closure 後に何を dynamic で確認するかを、live 成功 claim なしで整理。 | dynamic handoff checklist と evidence table |

## C. Codex 作業から除外するもの

- 外部サイト調査。
- live WebORCA / ORCA dynamic 実行。
- 後方互換性維持のための旧挙動温存。
- build 成果物調査。
- worker report claim の無条件受理。
