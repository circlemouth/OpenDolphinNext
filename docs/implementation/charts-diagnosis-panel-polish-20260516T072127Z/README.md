# Charts Diagnosis Panel Polish

- RUN_ID: `20260516T072127Z`
- Scope: Charts left-column `DiagnosisEditPanel` display polish only.
- Mock: [diagnosis-panel-mock.png](./diagnosis-panel-mock.png)

## Intent

The browser review pointed out that the ORCA registered disease panel was crowded and repeated the same source-of-truth wording in multiple places. The mock and implementation keep ORCA disease state visible, but compress the source indicator and disease count into the header and make the active disease list easier to scan.

## Medical Safety Boundary

- Disease remains ORCA / WebORCA source-of-truth.
- This change does not add or change disease mutation APIs.
- `ORCAへ病名登録`, `ORCA病名を更新`, `ORCA病名を削除`, and `削除病名を整理` continue to require the existing confirmation path.
- Local candidates and chart-text disease mentions remain separated from `ORCA登録病名`.
- ORCA warnings, unmatch information, unavailable mirror state, and mutation block reasons remain initially visible.

## Image Generation Prompt Summary

Generated with the built-in imagegen path as a UI mockup reference. The prompt requested a compact Japanese EMR diagnosis panel with an ORCA source badge, count badge, action row, dense disease rows, anonymized sample disease names, and no patient personal data.
