# 02. Phase and Workstream Plan

## 1. phase 0〜4

| Phase | 目的 | owner | dependency | deliverable | exit criteria | PR split 原則 |
| --- | --- | --- | --- | --- | --- | --- |
| Phase 0 | docs freeze と裁定固定 | main agent + docs owner | none | fixed decisions / gate register / task register / screen spec / prompts / repo touchpoint plan | 01/02/03/05/06/08/11/12/13/14 が package 内で整合し、unknown が gate + fallback 付きで残っている | repo PR は作らない。planning package を起点に以後の owner PR へ docs/tests を同梱する |
| Phase 1 | visible UX stabilization | reception / charts / orders | Phase 0 | WS-01〜WS-03 の実装。Reception row semantics、encounter band、action bar、right rail chooser-only | send success != paid が UI 上で崩れず、right rail から second editor が消え、missing-context が fail-close で動く | PR-01〜PR-03 |
| Phase 2 | domain contract recovery | disease / document-image / billing / admin-runtime | Phase 1 + related gates | WS-04〜WS-07 の docs/code/test。disease 3層、document/image lifecycle、billing boundary、setting dependency | silent merge / silent drop / guessed setting / guessed paid promotion が消え、未確定項目は gate のまま残る | PR-04〜PR-07 |
| Phase 3 | structural implementation + responsive/a11y hardening | owner-embedded + ui integrator | Phase 1, Phase 2 | WS-08 の owner-embedded 修正。1280/1024/768/390 圧縮、focus、live region、must-visible の整流化 | narrow layout でも重要情報が disclosure に落ちず、1 画面 1 primary と chooser-only が維持される | owner PR に吸収。残件がある場合のみ PR-08 residual stabilization |
| Phase 4 | test / release gate / packet | qa-release | all prior merged | WS-09 の test matrix 実装、canonical commands green、manual QA、ORCA live QA、release packet | 07/14 に記載した blocking tests と manual QA が green か blocker として記録され、open gate が release owner に引き渡せる | PR-09 final gate / packet |

## 2. WS-01〜WS-09

| WS | name | owner | dependency | deliverable | exit criteria | PR split |
| --- | --- | --- | --- | --- | --- | --- |
| WS-01 | Reception queue and status semantics | reception | UG-01, UG-02, WS01-G1, DADS visible-state rule | row-local workflow/transmission/correction taxonomy, always-visible row inventory, canonical handoff keep | `会計待ち + 送信済` fallback が実装され、patientId-only overlay/handoff が復活しない | PR-01 |
| WS-02 | Encounter context band and action bar | charts-shell | patient-context contract, UG-16, WS02-G1, WS02-G2 | encounter context band, single CTA owner, visible save/print/return, lost-context fail-close | ChartsPatientSummaryBar から main CTA が消え、ChartsActionBar が page CTA owner になる | PR-02 |
| WS-03 | Right rail chooser-only hardening | orders | chart-domain-boundary, reusable-assets-taxonomy, order cleanup note, UG-11 | order-facing chooser-only dock/drawer, source taxonomy copy, no second editor | right rail runtime tool から `document`/`orca` が消え、center primary が崩れない | PR-03 |
| WS-04 | Disease boundary recovery | disease | UG-04, UG-05, UG-06, UG-07, WS04-G1, WS04-G2 | clinical / insurance / ORCA mirror 3層 contract, conflict matrix, candidate-not-truth behavior | single-list truth と silent merge/delete が消え、gate 未解決時は manual-resolution note + fail-close で止まる | PR-04 |
| WS-05 | Document / image lifecycle recovery | document-image | UG-08, UG-09, WS05-G1, WS05-G2 | snapshot-only / reference-remove-only / image-asset boundary, print fail-close, attachability visibility | sessionStorage preview restore が消え、attachment-linked edit が silent drop しない | PR-05 |
| WS-06 | Billing boundary and ORCA correction | billing | UG-01, UG-02, UG-03, UG-12 | workflow/send/correction/setting 4層、correction note catalog、charts-side paid confirmation separation | Charts/Reception のどちらでも send success が paid を意味しなくなる | PR-06a / PR-06b |
| WS-07 | Management-setting dependent behavior | admin-runtime | UG-14, runtime-config contract, orca-connection contract | authoritative source inventory, feature-off fallback, admin scope note | unknown setting が enabled/success に倒れず、`/api/admin/config` が charts delivery only として理解できる | PR-07 |
| WS-08 | Responsive / DADS / accessibility hardening | owner-embedded + ui integrator | UG-16, feedback-spec, ui-guideline, all visible-state decisions | width rules, visible-state preservation, focus/live region alignment, screenshot QA | 1280/1024/768/390 の必須観点が test/manual QA に入り、important info を隠さない | owner PR absorb; residual only in PR-08 |
| WS-09 | Test / release gate integration | qa-release | all prior WS outputs | test matrix, stop-ship criteria, release packet, merge checklist | canonical commands, targeted suites, ORCA live QA, packet evidence が 07/14 と一致する | PR-09 |

## 3. owner ルール
- `main agent` は工程表・worktree・subagent・merge order・最終検証・報告の owner
- `WS owner` は自分の file scope の docs/code/tests を一緒に出す
- `qa-release` は独立仕様を足さない。既に fixed になった contract を test / runbook / packet へ接続する
- `ui` owner は DADS adaptation と must-visible rule を守るが、domain truth を作らない

## 4. dependency の解釈
- gate が閉じていない workstream は、**gate 依存部分だけ fail-close** で止める
- docs freeze は merge 済み repo doc ではなく、**planning package 上の裁定済み decision set** を意味する
- WS-08 は owner PR へ吸収する。横断 residual が出た場合だけ PR-08 を使う
- WS-09 は contract を変えない。test / packet / stop-ship の統合だけを行う

## 5. PR split 原則
1. 1 PR に reception / disease / document / billing を混在させない
2. docs patch と test patch は owner PR と同梱する
3. `send success != paid`、patient context 非永続、right rail chooser-only はどの PR でも壊さない
4. gate 未解決項目を埋めるための guessed route / DTO / copy を実装しない
5. residual stabilization PR は **new contract を作らない**
