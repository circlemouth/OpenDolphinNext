# ORCA Order Alignment

`docs/implementation/orca-order-alignment/` は ORCA order alignment workstream の current index と active workflow background を置く領域です。ここ自体は current contract の正本ではないが、現行作業で参照する背景資料は保持します。

## Current Workflow Entry
- [release-validation.md](../../runbooks/release-validation.md)
- [reviewer-submission-packet.md](../../runbooks/reviewer-submission-packet.md)
- [orca-remediation-cutover.md](../../releases/orca-remediation-cutover.md)
- [ORCA_CERTIFICATION_ONLY.md](../../operations/ORCA_CERTIFICATION_ONLY.md)

## Active Workflow Background
- [orca_order_alignment_authoritative_spec_packet_20260407.md](./orca_order_alignment_authoritative_spec_packet_20260407.md)
- [orca_order_alignment_authoritative_tables_20260407.json](./orca_order_alignment_authoritative_tables_20260407.json)
- [orca_order_alignment_execution_plan_checklist_self_contained_20260407.md](./orca_order_alignment_execution_plan_checklist_self_contained_20260407.md)

## Current Contract References
- [orca-route-taxonomy.md](../../contracts/orca-route-taxonomy.md)
- [orca-master-api.md](../../contracts/orca-master-api.md)
- [web-client/notes/ui-current-contract.md](../../../web-client/notes/ui-current-contract.md)
- [web-client/notes/orca-order-remediation-20260403.md](../../../web-client/notes/orca-order-remediation-20260403.md)
- [web-client/notes/orca-order-contract-cleanup-20260404.md](../../../web-client/notes/orca-order-contract-cleanup-20260404.md)
- [web-client/notes/orca-charge-canonicalization-20260404.md](../../../web-client/notes/orca-charge-canonicalization-20260404.md)

## Reference / Archive
- [reference/orca-order-alignment](../../reference/orca-order-alignment/README.md)
- [archive/orca-order-alignment](../../archive/orca-order-alignment/README.md)

## Boundary
- current workflow の判断・実行は runbooks / releases を正本にする
- active checklist と current workstream background は implementation に残す
- dated packet / closeout / recovery docs は archive で保持する
- reusable review / investigation prompt は reference に分離する
