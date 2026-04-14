# UI Reference Drift Check

## Scope

- enduring reference: `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- project-local adaptation: `docs/web-client/ux/web-client-ui-guideline.md`
- current fact: `web-client/notes/ui-current-contract.md`

## Checks

### 1. DADS no-copy / no-drift

- `docs/web-client/ux/web-client-ui-guideline.md` を project-local adaptation だけに縮約した。
- DADS 本文の色、タイポグラフィ、部品仕様、準備中項目の詳細説明をこの文書へ再掲しない形へ修正した。
- 現在の guideline は「この repo 固有の採用判断」と review checklist だけを残している。

### 2. Current Fact Separation

- `web-client/notes/ui-current-contract.md` は route / surface / required state / verification を列挙する current fact 文書として維持した。
- `web-client-ui-guideline.md` では current fact を再掲せず、`ui-current-contract.md` を canonical source として参照するだけにした。

### 3. DADS 準備中項目への独自追加有無

- guideline で「DADS で準備中の項目は project-local rule を増やさない」と明記した。
- DADS の準備中項目に対して、新しい visual rule や behavior rule を付与する文言は残していない。

## Conclusion

- enduring reference: `dads_app_ui_design_rules_20260411.md`
- project-local adaptation only: `web-client-ui-guideline.md`
- current fact only: `web-client/notes/ui-current-contract.md`

今回の addendum では、DADS の焼き直しや drift を増やす変更は行っていない。
