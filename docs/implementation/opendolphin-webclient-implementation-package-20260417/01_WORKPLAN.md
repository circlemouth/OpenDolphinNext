# OpenDolphin WebClient 残ブロッカー解消工程表

## 目的
release blocker のうち code-change を伴うものを、worker 裁定に従って順番に解消する。

## 実行順
1. Reception transmission projection fix
2. Billing / Charts OrcaSummary mount contract fix
3. Print preview harness-first isolation / fix
4. 3 で app-side defect が立証された場合のみ、print preview app escalation fix
5. 1〜4 が閉じてから canonical commands
6. canonical commands 通過後に manual QA
7. manual QA 通過後に ORCA live QA

## task gating
- Task 1 の targeted retest が pass するまで Task 2 に進まない
- Task 2 の targeted retest が pass するまで Task 3 に進まない
- Task 3 は harness-first とし、route-state 明示ありでも preview shell / missing shell のどちらにも deterministic に収束しない証拠が出た場合のみ Task 31 に進む
- history split はこの工程の外に置く。runtime blocker より先に着手しない

## targeted retest order
1. tests/reception/e2e-rec-001-status-mvp.spec.ts
2. tests/charts/e2e-orca-billing-status.spec.ts
3. tests/e2e/charts-report-print.msw.spec.ts

## canonical command order
1. cd web-client && node scripts/runtime-ready-smoke.mjs
2. cd web-client && npm run ci
3. mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify

## stop conditions
- fixed premise drift を起こす変更を見つけたら停止
- spec を緩めるだけの変更しか思いつかない場合は停止して報告
- print preview で app/harness の証拠が割れたら、混ぜて直さず classification を報告
- canonical commands 未実行のまま release-ready を主張しない

## final report minimum
- changed_files
- blocker_status
- targeted_retests
- canonical_commands
- residual_risks
- stop_ship_remaining_or_cleared
