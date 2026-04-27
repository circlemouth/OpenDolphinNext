# SOAP subjectivesv2 route contract

RUN_ID: `20260427T143700Z`

`SOAP_SUBJECTIVESV2_ROUTE_CONTRACT` を no-live で完了した。`subjectivesv2` は `POST /api/orca/official/chart-support/subjectives-mod-v2` から ORCA `/orca25/subjectivesv2?class=01` に固定し、`subjectivesmodreq` body へ `Request_Number` を入れない契約を維持する。

## Result

- HTTP `404` / `502` は `transportRejected` として分類し、`businessRejected` または `businessAccepted` に昇格しない。
- HTTP `200` と zero-like `Api_Result` だけでは成功にしない。completion evidence がない場合は `notVerified`。
- サーバー側の非XML transport failure でも `parserAmbiguous` ではなく `transportRejected` に閉じる。
- Live Trial ORCA mutation: not executed.

## Evidence

- Sanitized summary: `docs/implementation/soap-subjectivesv2-route-contract-20260427T143700Z/summary.sanitized.json`
- Wrapper dry-run: `docs/implementation/soap-subjectivesv2-route-contract-20260427T143700Z/wrapper-dry-run/phase4-soap-disease-summary.sanitized.json`
- Wrapper dry-run sha256: `3344f6bd083874461bd8b70839a4e9fcd085a6b834443415259923e9d0475df0`

## Checks

- `npm run test:ci -- scripts/__tests__/phase4SoapDiseaseSafeEvidence.test.ts`: pass, 13 tests.
- `mvn -f api-contract/pom.xml install -DskipTests`: pass.
- `mvn -pl server-modernized -Dtest=OrcaChartSupportResourceTest test`: pass, 14 tests.

## Claim Boundary

No SOAP `subjectivesv2` Trial business acceptance, `diseasev3` Trial readiness, fullflow success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness is claimed.
