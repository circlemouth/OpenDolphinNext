# diseasev3 official contract refresh

RUN_ID: `20260428T050947Z`

## Result

`DISEASEV3_OFFICIAL_CONTRACT_REFRESH_NO_LIVE` を完了した。live Trial ORCA mutation は実行していない。

公式仕様を再確認し、`diseasev3` create の repo-local wrapper / no-live evidence contract を以下に揃えた。

- ORCA endpoint: `/orca22/diseasev3`
- Official server route: `/api/orca/official/chart-support/disease-mod-v3`
- Request selection: no query `class`; body `Request_Number` は current create wrapper では absent 必須
- Existing `Request_Number=02/03/04` update/delete-like path remains forbidden in this wrapper
- Business success: transport 2xx、zero-like `Api_Result`、completion evidence をすべて要求し、HTTP 200 / `Api_Result=0000` だけでは success にしない

## Official Sources Checked

- `https://www.orca.med.or.jp/receipt/users/tec/api/overview.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/diseasemod.html`
- `https://www.orca.med.or.jp/receipt/users/tec/api/subjectives.html`

## Evidence

- Sanitized summary: `docs/implementation/diseasev3-official-contract-refresh-20260428T050947Z/summary.sanitized.json`
- Wrapper dry-run: `docs/implementation/diseasev3-official-contract-refresh-20260428T050947Z/wrapper-dry-run/phase4-soap-disease-summary.sanitized.json`
- Wrapper dry-run sha256: `15bbeb4098cb6cdd96559bb425501eeb6a7d37647135e2005b9c1ddb73e54774`

## Checks

- `npm run --prefix web-client test:ci -- scripts/__tests__/phase4SoapDiseaseSafeEvidence.test.ts`: pass, 1 file / 13 tests.
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=OrcaChartSupportResourceTest -Dsurefire.failIfNoSpecifiedTests=false test`: pass, 14 tests.
- Initial server-only Maven command without the reactor failed because `api-contract` DTO classes were not on the compile path; rerun with `pom.server-modernized.xml -am` passed.

## Safety

- credentialsCaptured=false
- diagnosticArtifactsCaptured=false
- rawArtifactsCommittedOrPackaged=false
- rawOrcaBodiesCaptured=false
- patientInsuranceDetailsCaptured=false
- productionOrcaAttempted=false
- s3ObjectStorageUsed=false

## Claim Boundary

No diseasev3 Trial business acceptance, disease update/delete, subjectivesv2 Trial business acceptance, fullflow success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO/PENDING, or final release readiness is claimed.
