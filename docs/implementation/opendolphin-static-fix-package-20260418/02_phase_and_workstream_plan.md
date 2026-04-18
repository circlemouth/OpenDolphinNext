# 02. Phase and Workstream Plan

## phase overview
| Phase | 目的 | owner | deliverable | exit criteria |
| --- | --- | --- | --- | --- |
| P0 | optional preflight only | human + ChatGPT | ambiguity memo (任意) | blocker 実装に必須ではない |
| P1 | server static blockers | SA-01 | C1/C2 code + tests | facility fail-close と sanitize negative tests が green |
| P2 | charts static blockers | SA-02 | C3/C4 code + tests | row-local signal と must-visible OrcaSummary が green |
| P3 | patients static blockers | SA-03 | C5 code + tests | canonical re-fetch failure を full success に畳まない |
| P4 | docs/test/QA alignment | SA-04 | C6/C7 tests/docs/scripts | docs と scripts と tests の gate が一致 |
| P5 | merge / stabilization / report | main agent | integrated branch + final report | targeted matrix green、dynamic hold report まで完了 |

## workstream definition
### WS-S1 server transport/config/security
- cluster: C1, C2
- owner: SA-01
- parallelism: SA-02 / SA-03 と並行可
- conflict hotspot: `OrcaTransportRegistry`, `OrcaTransportSettings`, `AdminOrcaConnectionTestSupport`
- exit: fallback 消去 + sanitize tests 追加

### WS-W1 charts claim signal and summary visibility
- cluster: C3, C4
- owner: SA-02
- parallelism: SA-01 / SA-03 と並行可
- conflict hotspot: `OrcaSummary.tsx`, `ChartsActionBar.tsx`, charts claim cache周辺
- exit: row-local lookup + strongest key save + must-visible sections + regression tests

### WS-P1 patients canonical readback semantics
- cluster: C5
- owner: SA-03
- parallelism: SA-01 / SA-02 と並行可
- conflict hotspot: `PatientsPage.tsx`, `patients/api.ts`, `PatientInfoEditDialog.tsx`, `orcaPatientImportApi.ts`
- exit: partial failure semantics + negative tests

### WS-Q1 docs / tests / QA gates
- cluster: C6, C7
- owner: SA-04
- dependency: SA-02, SA-03 の変更内容を踏まえて調整
- exit: visibility semantics tests, QA script fail conditions, runbook/cutover alignment

## merge order
1. SA-01 を main agent が取り込む
2. SA-03 を main agent が取り込む
3. SA-02 を main agent が取り込む
4. SA-04 を SA-02/SA-03 取り込み後に rebase してから取り込む
5. main agent が cross-workstream stabilization を行う

## なぜこの順番か
- SA-01 は server 側で独立度が高く、Critical を最初に閉じられる
- SA-03 は Patients 領域で UI/logic が Charts と衝突しにくい
- SA-02 は `OrcaSummary.tsx` を owner として広く触るため、Charts UI 側の正本を最後に寄せる
- SA-04 は tests/docs/scripts で SA-02/SA-03 の最終 semantics に追従する必要がある

## stop conditions
次のどれかに触れたら、その subagent は main agent へ blocker を返し、勝手に scope を広げない。
1. repo truth と static blocker verdict が衝突する新証拠を見つけた
2. new route / new DTO / new state owner が必要になった
3. PASS area を壊さないと進めない
4. live ORCA 実行が必要だと判明した
5. DADS 修正のために broad redesign が必要だと判明した

## final exit criteria
- C1〜C7 の acceptance が全て満たされる
- task/test matrix の blocker 行が green または明示 blocker 付き
- dynamic ORCA trial は未実施のまま hold されている
- final report に「static fix complete / ready to schedule dynamic trial check」の前提が書ける
