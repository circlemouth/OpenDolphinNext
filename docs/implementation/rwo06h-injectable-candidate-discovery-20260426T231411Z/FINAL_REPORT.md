# RWO-06H Injectable Candidate Discovery

RUN_ID: `20260426T231411Z`

## Verdict

`RWO06H_INJECTABLE_CANDIDATE_DISCOVERY_STOPPED_BEFORE_LIVE`

The active rollback / owner-decision handoff remains pending because no new operator rollback rehearsal evidence and no explicit final owner GO/NO-GO/PENDING input was present. This run carried that blocker forward without reclassification and advanced the executable queue.

Eight additional source-backed injectable medication candidates were checked through the sanitized read-only `medicationgetv2 Request_Number=02` wrapper. All returned sanitized `2xx` / `other_present` / `masterFound=false` for the medication row. Procedure/material/comment master freshness still returned sanitized success, but row-level injectable medication proof was not produced.

No live ORCA Trial mutation and no diagnostic fullflow were executed.

## Threat Model / Misuse Cases

| Misuse case | Control | Result |
|---|---|---|
| Treat public injectable source evidence as Trial row proof. | Each candidate must pass `medicationgetv2 Request_Number=02` with row-level `masterFound=true`. | Mitigated; all candidates failed row proof. |
| Promote HTTP 2xx or wrapper completion to injection business acceptance. | Business success remains `not_applicable_or_readonly_master_validity_not_validated`; live remains stopped. | Mitigated. |
| Reuse previously rejected candidates as accepted evidence. | `620000012`, `620076111`, and `620007539` were not retried unchanged as accepted evidence. | Mitigated. |
| Leak ORCA credentials, raw ORCA bodies, patient detail, or insurance detail in evidence. | Wrapper stores only allowlisted classifications and hashes; raw request/response bodies are not stored. | Mitigated. |

## Source-Backed Candidates Checked

| Medication code | Public source classification | Read-only result |
|---|---|---|
| `620006203` | MHLW notice lists the code as an injectable `ウロナーゼ静注用６万単位`; MEDLEY also classifies it as injection. | `2xx` / `other_present` / `masterFound=false` |
| `620004173` | Hikari product page lists `光糖液20%（500mL）`, glucose injection, with receipt code `620004173`. | `2xx` / `other_present` / `masterFound=false` |
| `620002589` | Maruishi product page lists `注射用エフオーワイ100` with receipt code `620002589`. | `2xx` / `other_present` / `masterFound=false` |
| `621958501` | Mitsubishi Tanabe code page lists `ヘルベッサー注射用10` with receipt code `621958501`. | `2xx` / `other_present` / `masterFound=false` |
| `620006734` | MHLW notice lists the code as `ヘパリンナトリウム注射液`. | `2xx` / `other_present` / `masterFound=false` |
| `620767312` | MHLW 2026 master-change notice lists the code as `生理食塩液「YD」500mL`. | `2xx` / `other_present` / `masterFound=false` |
| `620738012` | MHLW 2026 master-change notice lists the code as `ブドウ糖注射液「YD」5% 500mL`. | `2xx` / `other_present` / `masterFound=false` |
| `621429304` | MHLW 2026 master-change notice lists the code as `ナファモスタットメシル酸塩注射用10mg「YD」`. | `2xx` / `other_present` / `masterFound=false` |

Source URLs used:

- ORCA `medicationgetv2` API: https://www.orca.med.or.jp/receipt/tec/api/medicationgetv2.html
- ORCA manual, injection fee: https://orcamanual.orca.med.or.jp/gairai/chapter/2-6-5/
- MHLW code notice: https://www.mhlw.go.jp/content/12404000/001595737.pdf
- MHLW 2026 master-change notice: https://shinryohoshu.mhlw.go.jp/shinryohoshu/file/info/ymente260414.pdf
- Hikari product page: https://www.hikari-pharm.co.jp/hikari/archives/product/8422
- Maruishi product page: https://www.maruishi-pharm.co.jp/medical/products/14267/
- Mitsubishi Tanabe code page: https://medical.mt-pharma.co.jp/di/code/rc/vac/
- MEDLEY product page: https://medley.life/medicines/prescription/3954400D4080/

## Sanitized Evidence

| Medication code | Evidence | sha256 |
|---|---|---|
| `620006203` | `artifacts/orca-remediation/closeout/20260426T231411Z/qa/rwo06h-injectable-candidate-readonly-620006203/master-validity-readonly-summary.sanitized.json` | `65f260e16c569b47e09de05c8c98737f981ffded925ea62d4b5203fdc1100d84` |
| `620004173` | `artifacts/orca-remediation/closeout/20260426T231411Z/qa/rwo06h-injectable-candidate-readonly-620004173/master-validity-readonly-summary.sanitized.json` | `93a638950424cf680d242330a884a88e46a6e0533538ac3fa0bca14b6a1fb2ea` |
| `620002589` | `artifacts/orca-remediation/closeout/20260426T231411Z/qa/rwo06h-injectable-candidate-readonly-620002589/master-validity-readonly-summary.sanitized.json` | `ee2a1a49c9402de1ec4bea1553fa1653589cfabfd724fba9a57c265904b0a19b` |
| `621958501` | `artifacts/orca-remediation/closeout/20260426T231411Z/qa/rwo06h-injectable-candidate-readonly-621958501/master-validity-readonly-summary.sanitized.json` | `260845b203782e6354edcbf4f1e557aa5dde9eb16b63d82c4b6e19820419c9be` |
| `620006734` | `artifacts/orca-remediation/closeout/20260426T231411Z/qa/rwo06h-injectable-candidate-readonly-620006734/master-validity-readonly-summary.sanitized.json` | `57a33cd1834c0f3dd98e12770ad953b8a8b767a6e658687102f3f0b542814655` |
| `620767312` | `artifacts/orca-remediation/closeout/20260426T231411Z/qa/rwo06h-injectable-candidate-readonly-620767312/master-validity-readonly-summary.sanitized.json` | `063524ea2099443e93dca425b61dd8d2bf816dd3685bf6ea877595dfed414f3c` |
| `620738012` | `artifacts/orca-remediation/closeout/20260426T231411Z/qa/rwo06h-injectable-candidate-readonly-620738012/master-validity-readonly-summary.sanitized.json` | `295e47f24dd70392331490ffdd3e58c27a6e1c41f988b5588acd240c60155259` |
| `621429304` | `artifacts/orca-remediation/closeout/20260426T231411Z/qa/rwo06h-injectable-candidate-readonly-621429304/master-validity-readonly-summary.sanitized.json` | `b849a68be8f26da61acfee17966f02ba018a56a4e6fdd8970df7fac5fd2bde12` |

## Verification

| Check | Result |
|---|---|
| `qa-phase4-injection-master-validity.mjs --execute-readonly` for 8 candidates | Expected stop before live; sanitized evidence recorded |
| `node --check web-client/scripts/qa-lib/phase4-master-validity-evidence.mjs web-client/scripts/qa-phase4-injection-master-validity.mjs` | PASS |
| `npm --prefix web-client test -- --run scripts/__tests__/phase4MasterValidityEvidence.test.ts` | PASS |
| `npm --prefix web-client run verify:web-guard` | PASS |
| `bash server-modernized/tools/ci/check-doc-links.sh` | PASS |
| `node --test tests/review-packet/reviewer-submission-packet.test.mjs` | PASS |
| `git diff --check` | PASS |

## Claim Boundary

Allowed claim: `RWO-06H` now has additional source-backed injectable candidate discovery and read-only `medicationgetv2 Request_Number=02` checks, all stopping before live because row-level injectable medication proof was not produced.

Not claimed: injection Trial business acceptance, base-charge Trial business acceptance, any live mutation in this run, L4/fullflow success, actual rollback rehearsal, final owner GO/NO-GO, production ORCA readiness, S3/object-storage readiness, attachment/PHR storage readiness, or final release readiness.

## Security Notes

- Credentials printed or captured: `false`
- Raw ORCA request/response bodies captured: `false`
- Raw patient/insurance detail captured: `false`
- Diagnostic artifacts captured: `false`
- Raw artifacts committed or packaged: `false`
- Production ORCA attempted: `false`
- S3/MinIO/object-storage configuration requested or used: `false`

## Recommended Next Action

Continue with `RWO-09_STATIC_PACKAGE_REFRESH` or another independent no-live/static gate. Do not execute `injectionOrder/310` live Trial mutation until a different candidate or changed precondition produces row-level `medicationgetv2 Request_Number=02` proof with `masterFound=true`.
