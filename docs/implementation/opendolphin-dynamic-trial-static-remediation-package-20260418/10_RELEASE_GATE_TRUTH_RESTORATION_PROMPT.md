# SA-01 — release-gate truth restoration prompt

```text
あなたは OpenDolphinNext の release-gate truth restoration subagent です。

目的:
C7, RT-01, older follow-up docs drift を current repo truth に合わせて閉じる。
対象は gate / docs / guard / script truthfulness だけ。
reception runtime redesign や live ORCA 実行はしない。

参照してよいもの:
- current repo source / tests / docs / notes / scripts / contracts
- docs/implementation/opendolphin-dynamic-trial-static-remediation-package-20260418/
- docs/implementation/opendolphin-static-fix-package-20260418/
- docs/implementation/opendolphin-webclient-remaining-followup-package-20260417/
- 外部サイト、一般論は禁止

fixed premises:
- reception runtime contract 自体は pass area
- task は gate truthfulness の修復であり、Reception の domain logic 変更ではない
- route taxonomy public surface を広げない
- important information / fixed premise drift を docs で誤魔化さない
- backward compatibility 不要
- build artifacts 無視

主要タスク:
1. `/api/orca/official/visits/mutation` へ行く browser request body の actual shape を repo で確定する
   - `ReceptionPage.tsx`
   - `reception/api.ts`
   - `fetchWithResolver.ts`
   - related tests / msw
2. `medical-information-gate.mjs` を actual browser payload shape に合わせる
   - helper は current browser request で leak を捕まえられること
   - 未指定 run では failure
   - 指定 run では omission gate 非適用
   - artifact 保存だけでなく script が fail する current behavior は維持
3. helper unit test を actual payload shape で固定する
4. `release-validation.md` と `orca-remediation-cutover.md` を scripts と同値の gate 文言へ揃える
5. `verify-no-blocked-orca-route-strings.mjs` / `runtime-ready-smoke.mjs` / `orcaQueueApi.ts` / taxonomy docs を見て、
   `/api/orca/queue` と `/api/orca/pusheventgetv2` が
   - stale drift なのか
   - intentional fail-close exception なのか
   を repo truth で決める
   その上で docs / guard / source を曖昧さなく揃える
6. older follow-up docs に残る
   - runtime-ready-smoke passed
   - npm run ci passed
   - server verify passed
   の carry-forward claim を current truth に合わせて cleanup する
   “未検証だから再実行が必要” ならそう書く

acceptance:
- QA_MEDICAL_INFORMATION 未指定 run で actual browser request body leak があると script failure になる
- helper test は actual browser payload shape を再現する
- release-validation / cutover docs は actual fail condition と一致する
- route taxonomy docs / guard / source の関係が reviewer/operator に誤読されない
- older follow-up docs に current truth と食い違う pass claim を残さない
- reception / administration / send success != paid を壊さない

required tests:
- cd web-client && npm run verify:web-guard
- cd web-client && npm run typecheck
- cd web-client && npx vitest run scripts/__tests__/medicalInformationGate.test.ts src/features/reception/__tests__/ReceptionPage.test.tsx src/mocks/handlers/receptionMocks.test.ts src/features/outpatient/__tests__/orcaQueueApi.test.ts

report format:
- summary
- actual_browser_payload_shape
- changed_files
- gate_before_after
- route_guard_alignment_decision
- docs_cleanup_done
- tests_run
- residual_risks
```
