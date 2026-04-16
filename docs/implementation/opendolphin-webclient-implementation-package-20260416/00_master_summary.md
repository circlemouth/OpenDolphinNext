# 00. Master Summary

## 回収方針
この package は、reviewer 01〜09 の提案を **current repo truth 優先** で統合し、Codex がそのまま実装を始められる計画へ再編したものです。
焦点は literal な画面模倣ではなく、**責務・状態・境界・保存単位・同期・補正責務** を固定することです。

## keep
- 3 ペイン責務、patient context 非永続、`finish` / `send` 分離、right rail chooser-only
- Charts main = `SoapNotePanel`、Reception handoff の canonical key fail-close
- Admin source split: `/api/admin/config` = charts delivery only、`/api/admin/orca/connection` = facility connection、`/api/admin/orca/capabilities` = capability/testedScope
- runtime smoke を含む canonical commands 3 本

## update
- Reception の `send success -> 会計済み` auto-promotion を撤去し、workflow と transmission signal を分離
- Charts summary bar / action bar の責務を再配分し、visible primary / secondary / return を固定
- right rail を order-facing chooser-only に縮退し、document/orca/editor を runtime rail から外す
- disease を single list 前提から外し、insurance-local / ORCA mirror / candidate を分ける
- document / image は snapshot / reference / asset / print を分離し、sessionStorage preview restore を止める
- correction note と setting note を同じ slot に混ぜない
- unknown setting / unknown sync / unknown delete scope / unknown paid source は gate として残す

## add
- domain docs 6 本: `chart-domain-boundary` / `reusable-assets-taxonomy` / `disease-insurance-orca-contract` / `document-image-lifecycle` / `billing-boundary-correction-scenarios` / `management-setting-dependent-behavior`
- reviewer 統合 matrix
- task register / gate CSV / test matrix
- Codex main/subagent prompts
- merge order / PR split / release packet requirements

## reject
- `send success == paid`
- patientId-only row overlay / patientId-only charts open
- right rail の second editor 化、`document` / `orca` tool の runtime 存続
- disease single list truth、order-derived disease auto-confirm、ORCA mirror の truth 化
- sessionStorage / localStorage への patient-specific print/document context 永続
- `/api/admin/config` への根拠なき facility setting 一括追加
- docs-only 実装 PR を必須とする運び
- responsive/a11y を別建ての broad rewrite PR にすること
- generic bottom navigation

## 主要 fixed decision
1. Reception / billing: workflow / transmission / correction / setting 4 層
2. Charts: `ChartsPatientSummaryBar` = encounter context band、`ChartsActionBar` = page CTA owner
3. Orders / right rail: runtime rail = chooser-only
4. Disease: insurance-local authoring / ORCA mirror read-only / candidate source
5. Document / image: template / snapshot / asset / reference / print preview 分離
6. Settings: admin/config, connection, capability, runtime を分離し unknown setting は feature-off

## 主要 open gate
- UG-01 `会計済み` authoritative owner
- UG-02 `再計待` authoritative source
- UG-04〜07 disease owner / sync / resolution / code/date semantics
- UG-08 / UG-09 / WS05-G1 / WS05-G2 document hydration / delete / reference payload / attachment rehydrate
- UG-11 cp-set / consult-set scope
- UG-12 same-day same-test correction automation
- UG-14 setting inventory
- UG-16 responsive exact thresholds / 390 target
- UG-17 concurrent edit final UX
- WS01-G1 row-local billing signal key
- WS02-G1 / WS02-G2 context source order gap / safe return label mapping

## merge 方針
- docs freeze は **planning gate** として先に固定し、実装 PR には owner ごとの docs/tests/code を同梱する
- PR split は domain ごと: Reception → Charts main → Right rail → Disease → Document/Image → Billing core → Billing reception projection → Admin/Setting → Residual stabilization → Final gate
- conflict 正本: wording = `feedback-spec.md`、current fact/route = `ui-current-contract.md`、config source = `runtime-config.md` / `orca-connection.md`
