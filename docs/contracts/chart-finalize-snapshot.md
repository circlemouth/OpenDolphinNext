# Chart Finalize ORCA Snapshot Contract

## 目的

診療録確定時点で参照した ORCA / WebORCA 由来情報と OpenDolphinNext 正本の処方指示・送信候補を、不変の説明可能 snapshot として固定する。

この snapshot は ORCA 正本の代替ではない。確定後に ORCA 側の患者、受付、保険、病名、算定情報が変わっても、確定済み診療録の snapshot は上書きしない。

## 正本境界

| 領域 | 正本 | chart finalize snapshot の扱い |
|---|---|---|
| 患者基本情報 | ORCA / WebORCA | `orca_patient_cache` の `patientgetv2` CURRENT / FOUND row を参照・hash 固定する |
| 受付 | ORCA / WebORCA | `orca_acceptance_cache` の `acceptlstv2` row を参照・hash 固定する。受付なし理由とは分離する |
| 保険・公費・保険組合せ | ORCA / WebORCA | `orca_insurance_cache` の `insuranceinf1v2` row を参照・hash 固定する |
| 病名 | ORCA / WebORCA | `orca_disease_cache` から `orca_disease_snapshot(snapshot_reason=CHART_FINALIZE)` を作成し、参照・hash 固定する |
| 処方指示 | OpenDolphinNext | `prescription_order` / `prescription_order_revision` の current revision と content hash を固定する |
| ORCA 送信候補・算定候補 | OpenDolphinNext candidate | `orca_medical_candidate` の latest candidate を参照・hash 固定する |
| warning / unmatch / ORCA 側のみ情報 | ORCA operation ledger | `orca_operation` / `orca_transmission` / response summary / reconciliation の status と hash を固定する |

## Manifest v2

`chart_revision.snapshot_manifest_json` は server-side resolver が生成する。client body の `facilityId`, `ownerId`, `role`, `uri`, `digest`, `objectKey` や ORCA 接続先情報は採用しない。

必須 metadata:

- `snapshotVersion=2`
- `source=CHART_FINALIZE`
- `sourceSystem=ORCA`
- `sourceApi=chart-finalize-composite-snapshot`
- `snapshotCapturedAt`
- `fetchedAt`
- `orcaPatientId`
- `acceptanceId` / `orcaAcceptanceId`
- `visitDate`
- `department`
- `physician`
- `insuranceCombination`
- `rawSensitiveFieldsExcluded=true`

各 snapshot は `*SnapshotStatus`, `*SnapshotReference`, `*SnapshotHash` で固定する。export では allowlist scalar のみを投影し、raw ORCA body、credential、患者住所・電話、保険詳細、Cookie、Authorization、CSRF は返さない。

## 確定許可条件

原則として、以下が揃わない場合は `409 chart_revision_snapshot_incomplete` で診療録確定を拒否する。

- ORCA 患者 snapshot: `patientgetv2` CURRENT / ORCA_PATIENT_FOUND
- ORCA 受付 snapshot: `orcaAcceptanceId` がある場合の `acceptlstv2` snapshot
- ORCA 保険 snapshot: 対象患者・保険組合せの `insuranceinf1v2` snapshot
- ORCA 病名 snapshot: 対象患者・診療月の `diseasegetv2` cache から作成した `orca_disease_snapshot`
- 処方指示が存在する場合の `orca_medical_candidate`

許容される欠落は、ORCA 受付そのものが診療業務上存在しないことを明示する `noAcceptanceReason` だけである。ORCA 取得不能、通信断、認証失敗、UNKNOWN、不一致、警告は `noAcceptanceReason` として扱わない。

## 不変性

FINAL / AMENDED / ADDENDUM / CANCELLED / VOIDED の revision は直接更新不可である。訂正・追記で新 revision を作る場合も、元 revision の `snapshot_manifest_json` をコピーし、後日の ORCA re-fetch 結果で過去 snapshot を再生成しない。

## 禁止事項

- `patientSnapshotStatus=IDENTIFIER_ONLY` を本番 manifest に出すこと
- `PENDING_WORKER_INTEGRATION` を本番 manifest / export に出すこと
- ORCA unavailable を `NO_ACCEPTANCE_REASON` と混同すること
- ORCA warning / unmatch / UNKNOWN を完全成功として隠すこと
- client 提供の患者・受付・保険・処方候補値から snapshot を合成すること
