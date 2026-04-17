タイトル:
OpenDolphin WebClient — Reception transmission projection fix

ゴール:
tests/reception/e2e-rec-001-status-mvp.spec.ts の line 119 で露出している `送信: 送信済` 不一致を、spec drift ではなく Reception row projection / row-visible contract の欠損として修正する。
`送信済` は hidden detail ではなく row-local の always-visible slot に出し、table / collapsed card の両 variant があるなら表示契約を一致させる。
repo 実体に強い反証がない限り、この fail を spec drift に戻してはいけない。

使用可能情報:
- repo 実体
- docs/web-client/ux/dads_app_ui_design_rules_20260411.md
- この prompt
- 外部サイト、一般論、過去の bundle / review zip は禁止

固定前提:
- 3 ペイン責務固定
- patient context 非永続
- finish と send の分離
- right rail chooser-only
- 送信済 と 会計済み は非統合
- send success != paid
- generic bottom navigation の新規導入禁止
- 重要情報を disclosure に隠さない
- 1 画面 1 primary
- unknown は gate として残し、fail-close fallback を添える
- 後方互換性不要
- TODO / shim / format-only change 禁止
- build artifacts 無視

既知事実:
- 既に main へ統合済み: PR-01 Reception, PR-02 Charts main, PR-03 Right rail, PR-04 Disease, PR-07 Admin/setting, Playwright worktree ignore fix, PR-05 + PR-06a + PR-06b local batch merge, document-reuse E2E drift fix
- web-client targeted vitest: 110 passed / 1 skipped
- server-modernized targeted tests: 37 passed
- cd web-client && npm run typecheck は pass 済み
- failing spec: tests/reception/e2e-rec-001-status-mvp.spec.ts line 119
- Reception 側には送信表示コード自体は存在する
  - 例: web-client/src/features/reception/pages/ReceptionPage.tsx line 5559 付近
- 暫定裁定: projection bug 扱いを優先
- 想定 root cause 候補:
  - row-local billing signal key mismatch
  - row projection omission
  - collapsed card と table row の visible contract 差
  - cache handoff 欠損

repo touchpoints:
- web-client/src/features/reception/pages/ReceptionPage.tsx
- web-client/src/features/reception/receptionDailyState.ts
- web-client/src/features/charts/orcaClaimSendCache.ts
- tests/reception/e2e-rec-001-status-mvp.spec.ts
- path が動いていた場合は repo 証拠で mapping を報告し、推測で補わない

subagent 利用:
以下 2 本を gpt 5.4 high で起動する
1. reception_transmission_dataflow_probe
2. reception_row_render_locator_probe
main agent は subagent 結果を比較し、repo 証拠で最終判断して実装する

non-goal:
- spec を緩めるだけの変更
- 送信済 を disclosure / hidden detail に逃がす変更
- 送信済 と 会計済み の意味統合
- finish と send の再結合
- patient context persistence の導入
- right rail の責務拡張
- unrelated reception flows の広範囲再設計
- repo 証拠なしの route / state / schema / copy invent

実装方針:
1. failing spec の期待 visible contract を確認する
2. transmission signal の source -> state/cache -> projection -> row render の流れを追う
3. row-local key と row projection の不一致、または cache handoff 欠損があれば修正する
4. table と collapsed card の両 variant があるなら transmission slot を共通化する
5. `送信済` は row-local always-visible slot に置く
6. stable locator / testid を transmission slot に付与する
   - exact naming は repo convention に従う
   - convention がなければ minimal で説明的な naming を採用し report する
7. component/unit test があるなら最小限で追加または更新する
8. E2E は UI 契約修正に必要な locator stabilization だけを許可する。missing UI contract を assertion 側で隠蔽しない

acceptance:
- tests/reception/e2e-rec-001-status-mvp.spec.ts の該当 fail が pass する
- row-local transmission signal が always-visible slot で見える
- table / collapsed card が両方ある場合、visible contract が一致する
- stable locator / testid が transmission slot に付与される
- finish / send 分離、send / paid 非統合、right rail chooser-only、patient context 非永続が維持される
- hidden disclosure に重要情報を退避していない
- TODO / shim / temporary bypass を残していない

run tests:
- repo の既存 Playwright 実行手段で tests/reception/e2e-rec-001-status-mvp.spec.ts を再実行
- touched reception component/unit tests があれば再実行
- cd web-client && npm run typecheck
- canonical commands はこの task の完了報告とは別。未実行なら release-ready と主張しない

report format:
- summary
- root_cause
- changed_files
- contract_before_after
- locator_strategy
- tests_run
- residual_risks
- if_path_moved_mapping
