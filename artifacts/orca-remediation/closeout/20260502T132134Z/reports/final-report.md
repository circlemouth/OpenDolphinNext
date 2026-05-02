# GUI + ORCA Live Closeout

- RUN_ID: `20260502T132134Z`
- Target: Vite `http://localhost:5173/`, `server-modernized` on `9080`, WebORCA Trial
- Evidence policy: raw credential, Cookie, Authorization, raw ORCA body, HAR, trace, video, screenshot, raw patient detail are not included in this report.

## Result
- Browser GUI administration check: admin route reachable, effective role displayed as `admin`, topbar ORCA status uses sanitized readiness, new console errors `0`.
- Readiness: `/api/health` returned only `service/status`; `/api/health/readiness` returned sanitized `status/checks` and no secret-like URL/credential details.
- Selected Trial patient: `00005` after exact read-only preflight.
- `acceptmodv2`: business accepted with warning `K3`; request-number C7 gate accepted; no `medicalInformation` field sent when unselected.
- Charts fullflow: existing canonical handoff resolved to server-derived visit context; treatment order saved locally; GUI `ORCA 送信` confirmed; `medical-mod-v2` returned HTTP `200`.
- medicalmodv2 payload validation: expected code `140000610` found; response captured through app route `/api/orca/official/chart-support/medical-mod-v2`; page errors `0`, console errors `0`.

## Security Checks
- Tampered `voucherNumber` probe with valid CSRF/session returned `400`, `field=encounterContext`, `message=server-derived encounter context was not found`, before ORCA transport.
- Initial tampered probe without Origin/Referer returned `403` CSRF failure.
- Server stores official/provisional visit identifiers as server-derived `worklist_flags`; client-provided identifiers are not treated as authority.
- Admin topbar no longer polls `/api/admin/orca/connection/test`, avoiding step-up mutation/412 spam during normal navigation.

## Gates
- `cd web-client && npm run verify:web-guard && npm run typecheck && npm run test:ci`: pass (`204` files, `1476` tests passed, `2` skipped).
- `cd web-client && npm run build`: pass.
- `PLAYWRIGHT_DISABLE_MSW=1 npm run --prefix web-client test:e2e:no-artifacts -- --run-id 20260502T132134Z tests/e2e/safe-no-artifacts/charts-missing-context-recovery.safe.spec.ts tests/e2e/safe-no-artifacts/local-clinical-persistence.safe.spec.ts`: pass (`8` tests).
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`: pass (`BUILD SUCCESS`).

## Sanitized Evidence
- Read-only preflight: `qa/weborca-readonly-preflight-00005/summary.json`
- Accept mutation summary: `qa/acceptmodv2-00005/accept-summary.sanitized.json`
- Fullflow summary: `qa/fullflow-00005-provisional-rerun/summary.json`
