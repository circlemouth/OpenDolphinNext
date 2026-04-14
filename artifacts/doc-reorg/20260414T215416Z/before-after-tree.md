# Before / After Tree

## Before

```text
README.md
docs/
  README.md
  implementation/
    orca-order-alignment/
      README.md
      orca_order_alignment_authoritative_spec_packet_20260407.md
      orca_order_alignment_authoritative_tables_20260407.json
      orca_order_alignment_execution_plan_checklist_self_contained_20260407.md
      orca_order_alignment_closure_packet_20260408.md
      orca_remaining_tasks_checklist_20260410.md
      opendolphin_orca_codex_packet_20260413/
      opendolphin_orca_closeout_packet_r2_20260413/
      opendolphin_orca_recovery_packet_r3_20260413/
      opendolphin_orca_review_research_prompts_20260413/
src/
  discovery/
    LICENSE_git履歴調査_20260310.md
    OpenDolphin-Lab-A4.pdf
    minagawa署名git履歴調査_20260310.md
    ライセンス_コード著者アカウント同一性時系列調査_20260313.md
web-client/
  README.md
  notes/
    *.md
artifacts/
  ...tracked evidence...
```

## After

```text
README.md
docs/
  README.md
  architecture/
    repository-doc-taxonomy.md
  implementation/
    README.md
    orca-order-alignment/
      README.md
  reference/
    README.md
    orca-order-alignment/
      README.md
      orca_order_alignment_authoritative_spec_packet_20260407.md
      orca_order_alignment_authoritative_tables_20260407.json
    repository-history/
      README.md
      LICENSE_git履歴調査_20260310.md
      OpenDolphin-Lab-A4.pdf
      minagawa署名git履歴調査_20260310.md
      ライセンス_コード著者アカウント同一性時系列調査_20260313.md
  archive/
    README.md
    orca-order-alignment/
      README.md
      orca_order_alignment_execution_plan_checklist_self_contained_20260407.md
      orca_order_alignment_closure_packet_20260408.md
      orca_remaining_tasks_checklist_20260410.md
      opendolphin_orca_codex_packet_20260413/
      opendolphin_orca_closeout_packet_r2_20260413/
      opendolphin_orca_recovery_packet_r3_20260413/
      opendolphin_orca_review_research_prompts_20260413/
web-client/
  README.md
  notes/
    README.md
    *.md
artifacts/
  README.md
  doc-reorg/
    20260414T215416Z/
      final-report.md
      source-of-truth-matrix.md
      non-doc-structural-findings.md
      before-after-tree.md
      document-set/
```

## Net Effect

- current workflow entry は残しつつ、packet / prompt / closeout 群を current path から外した
- `src/discovery/` を doc-only reference として `docs/reference/` へ統合した
- `artifacts/` を evidence 専用と明記した
