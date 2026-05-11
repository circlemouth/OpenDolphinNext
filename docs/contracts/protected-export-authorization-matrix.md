# Protected Export Authorization Matrix

Status: current

This contract fixes the server-side authorization, audit, and PHI minimization requirements for protected export, PDF/report, image, and attachment surfaces. It complements [document-integrity.md](./document-integrity.md), [patient-images.md](./patient-images.md), and [runtime-config.md](./runtime-config.md).

## Scope

Protected surfaces are routes that return or create patient-bound export material, PDF/report material, image assets, attachment references, or document payloads that can carry PHI. Browser visibility, disabled buttons, route guards, or caller-supplied facility/owner fields are not authorization.

## Required Invariants

- Authentication is required for every protected route.
- Facility is resolved from the server-side session or authenticated principal. Request body, query string, `facilityId`, owner, role, storage URI, digest, object key, and client-side flags are not authority.
- Capability checks are operation-specific: read/list, export/download, upload/create, update, delete/reference-remove, ORCA report creation, and admin evidence review are separate decisions.
- Patient/chart/document/attachment ownership is reloaded server-side before the operation. A matching facility alone is not enough when an operation-specific capability is missing.
- Audit is append-only. Mutating operations require an available authoritative audit write path before persistence or external storage changes. Export/download operations record a sanitized audit event when the route already has an audit service path; missing audit coverage is a release blocker, not a client-side workaround.
- Responses and audit details must not include raw ORCA bodies, credential material, Cookie, Authorization, CSRF token, JSESSIONID, internal storage key, raw object URI, patient address/phone, insurance detail, HAR, trace, video, or screenshot references.
- Download/export responses use no-store/private cache controls when the resource implementation supports response headers. New protected download implementations must add no-store by default.
- Object storage metadata is server-generated. Reference remove is not object delete unless a dedicated, audited hard-delete capability exists.
- CSV export neutralizes spreadsheet formula-leading cells; JSON/PDF/report projections use allowlists and redaction before hashing or rendering.

## Protected Route Matrix

| Route key | Surface | Minimum capability | Server authority | Audit / evidence requirement | PHI / storage exposure rule |
| --- | --- | --- | --- | --- | --- |
| `GET /api/charts/{*}/revisions/export` | Chart revision JSON export | chart export/read | Server resolves chart and facility from DB/session; request body/query cannot override owner or facility. | Export hash is calculated from sanitized allowlist payload. Authorization denial and inconsistent current revision fail closed. | No raw ORCA body, credential, Cookie, Authorization, CSRF, patient address/phone, or insurance detail. |
| `GET /api/charts/{*}/revisions/export.csv` | Chart revision CSV export | chart export/read | Same as JSON export. | CSV uses the same revision/event provenance as JSON export. | Formula-leading values are neutralized; only sanitized fixed columns are emitted. |
| `GET /api/charts/{*}/revisions/export.pdf` | Chart revision PDF export / print payload | chart export/read | Same as JSON export; server resolves chart, current revision, patient context, and facility from DB/session. | PDF rendering uses the sanitized chart export projection and export hash/provenance metadata. | Raw ORCA bodies, credentials, storage keys, raw report bodies, and caller-provided patient/facility fields are excluded. |
| `POST /api/orca/official/reports/{*}` | ORCA report/PDF-like report request and binary staging | ORCA report create/export | Facility and ORCA endpoint are resolved server-side; report type is allowlisted; storage key/digest are server-generated. | `ORCA_REPORT_CREATE` and `ORCA_REPORT_BINARY_UPLOAD` use sanitized audit details and hash identifiers instead of raw report identifiers. | Raw request/response bodies, invoice/data identifiers, object keys, and credentials are excluded from response/evidence. |
| `GET /api/patients/{*}/images` | Patient image list | patient image read/list | Patient accessibility is checked server-side by facility and patient id. | List evidence stays metadata-only. | Download URL is context-root safe and must not expose storage URI or object key. |
| `POST /api/patients/{*}/images` | Patient image upload | patient image upload/create | Patient accessibility, feature flag, storage readiness, and audit write availability are required before persistence. | `PATIENT_IMAGE_UPLOAD` records sanitized metadata only. | MIME/size/dimensions are validated; filename is sanitized; temp files are deleted. |
| `GET /api/patients/{*}/images/{*}` | Patient image download | patient image download/export | Patient and image ownership are reloaded server-side before streaming. | `PATIENT_IMAGE_DOWNLOAD` records sanitized metadata only. | `Content-Disposition: attachment`; no-store headers; storage URI/digest are internal only. |
| `POST /api/karte/document` | Document create with attachment references | chart/document create | Facility and attachment references are resolved server-side; only attachment id references are accepted. | Authoritative audit write path must be available before persistence. | Client-provided URI/digest/storageKey/owner/facility metadata is rejected. |
| `PUT /api/karte/document` | Document update with attachment references | chart/document update | Same attachment id re-resolution as create. | Authoritative audit write path must be available before persistence. | Reference remove does not delete the underlying asset. |
| `PUT /api/karte/document/{*}` | Document title update | chart/document update | Document facility access is checked server-side by document id. | Authoritative audit write path must be available before persistence. | Title/error responses must not echo raw sensitive payloads. |
| `DELETE /api/karte/document/{*}` | Document delete/reference remove | chart/document delete | Document facility access is checked server-side by document id. | Deletion outcome is audited with sanitized metadata. | Attachment reference removal is not object hard delete. |
| `GET /api/karte/attachment/{*}` | Legacy attachment read | attachment read/download | Attachment facility access is checked server-side by attachment id. | Any reviewer evidence must cite sanitized metadata only. | Response must not be treated as object-storage authority by clients. |
| `GET /api/karte/image/{*}` | Legacy image read | patient image read/download | Image/document access is checked server-side. | Any reviewer evidence must cite sanitized metadata only. | Raw storage URI, object key, and digest remain internal. |
| `GET /api/karte/docinfo/all/{*}` | Bulk chart document info for PDF/period export preparation | chart export/read | Patient facility access is checked server-side by karte id; paging is normalized server-side. | Reviewer evidence records route, count/hash, and run id only. | Document list metadata must not be expanded into raw bodies or copied screenshots. |

## Misuse Cases

1. A user changes `facilityId`, owner, role, URI, digest, or storage key in a request body to export another facility's chart, image, attachment, or report. The server must ignore or reject caller authority and reload ownership from session plus DB.
2. A user with chart read access but no export/download capability tries to use a binary/report route to bypass the UI. The route must enforce the operation-specific capability server-side and fail closed.
3. An operator copies raw ORCA XML, a report body, HAR, trace, screenshot, or raw storage path into reviewer evidence. Packet and sensitive-evidence guards must reject the artifact.
4. A document update submits attachment metadata with a valid-looking digest/object key for a different asset. The document route must accept only server-resolved attachment ids and must not hard-delete object assets on reference removal.

## Verification Commands

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=ProtectedExportAuthorizationMatrixTest test
bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-doc-links.sh
```
