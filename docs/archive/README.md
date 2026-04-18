# Archive

`docs/archive/` は履歴保持のための dated docs を置く領域です。packet、prompt、handoff、closeout、recovery、review template を current docs の導線から外しつつ、git 追跡を維持します。

Archive 配下の `PASS`、`READY`、`完了済み`、`already closed`、close 条件、final report template はすべて historical/template context です。current source of truth ではありません。

Current source of truth for ORCA/static remediation status is:

- [../implementation/opendolphin-postfix-static-remediation-20260418/08_static_exit_report.md](../implementation/opendolphin-postfix-static-remediation-20260418/08_static_exit_report.md)
- [../contracts/orca-route-taxonomy.md](../contracts/orca-route-taxonomy.md)
- [../contracts/orca-connection.md](../contracts/orca-connection.md)
- [../runbooks/release-validation.md](../runbooks/release-validation.md)

## Archive Sets
- [ORCA order alignment archive](orca-order-alignment/README.md)

## Rules
- archive は current contract や live workflow の入口に含めない
- evidence は `artifacts/` に置き、archive を evidence dump で代用しない
- active workflow に復帰した文書だけを current path へ戻す
