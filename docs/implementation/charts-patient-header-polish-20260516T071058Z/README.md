# Charts Patient Header Polish

- RUN_ID: `20260516T071058Z`
- Scope: Charts patient summary header UI only.
- Mock: [patient-header-mock.png](./patient-header-mock.png)

## Intent

The browser review pointed out two visible issues in the Charts header:

- The patient identity / visit context area was visually crowded.
- The normal-state `患者安全` explanatory banner duplicated information already visible in the patient header.

The mock keeps patient identification and visit context visible, removes the normal explanatory banner, and treats safety banners as exception-only surfaces for dirty state, edit locks, approval locks, ORCA failure, or UNKNOWN.

## Medical Safety Boundary

- This is a display-only web-client change.
- ORCA / WebORCA source-of-truth data is not localized or mutated.
- Chart finalization, prescription finalization, ORCA send, accounting send, and audit persistence are not changed.
- Patient identity remains visible in the header; only the redundant normal-state explanatory banner is removed.
- ORCA warning / failure / UNKNOWN states remain initial visible warnings and are not hidden behind details.

## Image Generation Prompt Summary

Generated with the built-in imagegen path as a UI mockup reference. The prompt requested a restrained Japanese EMR desktop header, with left clinical actions, central patient identity, right visit-context chips, no green `患者安全` explanatory banner, and anonymized sample patient text only.
