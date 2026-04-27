# diseasev3 endpoint semantics contract

RUN_ID: `20260427T143700Z`

`DISEASEV3_ENDPOINT_SEMANTICS_CONTRACT` を公式仕様調査のみで進めた。live Trial mutation は実行していない。

## Result

- ORCA overview では `diseasev3` は `POST /orca22/diseasev3`。
- note 1 対象のため query `class` ではなく、複数機能の選択は request data 内の `Request_Number` で行う。
- current no-live wrapper は create-only `Request_Number=01` として扱い、update/delete は未許可のままにする。
- 成功判定は transport 2xx、zero-like `Api_Result`、completion evidence をすべて要求する。warning / unmatch disease 情報は成功の代替にしない。

## Evidence

- Sanitized summary: `docs/implementation/diseasev3-endpoint-semantics-contract-20260427T143700Z/summary.sanitized.json`
- Official sources checked:
  - `https://www.orca.med.or.jp/receipt/users/tec/api/overview.html`
  - `https://www.orca.med.or.jp/receipt/users/tec/api/diseasemod.html`

## Claim Boundary

No `diseasev3` Trial mutation, disease create/update/delete acceptance, `subjectivesv2` acceptance, fullflow success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness is claimed.
