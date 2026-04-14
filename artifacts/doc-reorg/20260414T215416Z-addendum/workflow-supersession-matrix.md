# Workflow Supersession Matrix

実リポジトリ現物を基準に、`docs/implementation/orca-order-alignment` から前回 move した対象を再判定した。

| Item | Final Class | Final Location | Superseded / Retention Basis |
| --- | --- | --- | --- |
| `docs/reference/orca-order-alignment/orca_order_alignment_authoritative_spec_packet_20260407.md` | active workflow | `docs/implementation/orca-order-alignment/orca_order_alignment_authoritative_spec_packet_20260407.md` | 本文が「Codex に渡すべき 4 点」を明示し、execution plan / tables と相互参照している。dated だが current workstream background としてまだ自己完結性が高い。 |
| `docs/reference/orca-order-alignment/orca_order_alignment_authoritative_tables_20260407.json` | active workflow | `docs/implementation/orca-order-alignment/orca_order_alignment_authoritative_tables_20260407.json` | spec packet が companion JSON として参照しているため、reference へ離すより implementation 側に残す方が current workflow background として一貫する。 |
| `docs/archive/orca-order-alignment/orca_order_alignment_execution_plan_checklist_self_contained_20260407.md` | active workflow | `docs/implementation/orca-order-alignment/orca_order_alignment_execution_plan_checklist_self_contained_20260407.md` | spec packet の「Codex に渡すべき 4 点」に含まれ、active checklist として閉じ切っていない。archive に置くと workflow background が欠落する。 |
| `docs/archive/orca-order-alignment/orca_remaining_tasks_checklist_20260410.md` | archive | `docs/archive/orca-order-alignment/orca_remaining_tasks_checklist_20260410.md` | Source が repo 外パスで、`2026-04-10` 時点の follow-up snapshot。大半が完了済みで、current workstream の正本 checklist ではない。 |
| `docs/archive/orca-order-alignment/opendolphin_orca_codex_packet_20260413/**` | archive | `docs/archive/orca-order-alignment/opendolphin_orca_codex_packet_20260413/` | `FAIL / 再オープン推奨` 後の初回収束 packet。後続の closeout / recovery packet に目的が引き継がれており、現行 runbook の実行入口ではない。 |
| `docs/archive/orca-order-alignment/opendolphin_orca_closeout_packet_r2_20260413/**` | archive | `docs/archive/orca-order-alignment/opendolphin_orca_closeout_packet_r2_20260413/` | closeout 残件専用 packet。目的の一部は recovery packet R3 と現行 reviewer submission packet runbook に吸収されているため、履歴保持が妥当。 |
| `docs/archive/orca-order-alignment/opendolphin_orca_recovery_packet_r3_20260413/**` | archive | `docs/archive/orca-order-alignment/opendolphin_orca_recovery_packet_r3_20260413/` | reviewer submission packet 置換と live evidence 再採取の recovery 指示。現在は `docs/runbooks/reviewer-submission-packet.md` と関連 scripts が実行正本で、packet 自体は superseded。 |
| `docs/archive/orca-order-alignment/opendolphin_orca_review_research_prompts_20260413/**` | reference | `docs/reference/orca-order-alignment/opendolphin_orca_review_research_prompts_20260413/` | README が code review / spec investigation / report template の再利用を前提にしており、dated closeout packet ではなく reusable reference と判断した。 |

## Boundary Decision

- `docs/implementation/orca-order-alignment/` は runbooks / releases の代替ではない。
- ただし active workflow の背景資料と active checklist は index-only に縮退させず implementation 側に保持する。
- dated packet / closeout / recovery prompt set は archive、再利用可能な review prompt set は reference とする。
