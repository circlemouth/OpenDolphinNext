package open.dolphin.session;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.rest.AbstractResource;

@ApplicationScoped
class ChartFinalizeSnapshotResolver {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();

    @PersistenceContext(unitName = "opendolphinPU")
    private EntityManager em;

    String buildManifest(FinalizeSnapshotRequest request) {
        SnapshotRef patient = requirePatientSnapshot(request);
        SnapshotRef acceptance = resolveAcceptanceSnapshot(request);
        SnapshotRef insurance = requireInsuranceSnapshot(request);
        SnapshotRef disease = requireDiseaseSnapshot(request);
        PrescriptionSnapshot prescription = resolvePrescriptionSnapshot(request);
        SnapshotRef candidate = resolveMedicalCandidateSnapshot(request, prescription);
        OrcaOperationSnapshot operation = resolveOrcaOperationSnapshot(request);

        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("snapshotVersion", 2);
        manifest.put("source", "CHART_FINALIZE");
        manifest.put("sourceSystem", "ORCA");
        manifest.put("sourceApi", "chart-finalize-composite-snapshot");
        manifest.put("snapshotCapturedAt", request.capturedAt().toString());
        manifest.put("fetchedAt", latestFetchedAt(patient, acceptance, insurance, disease, candidate));
        manifest.put("orcaPatientId", request.orcaPatientId());
        manifest.put("encounterId", request.encounterId());
        manifest.put("visitDate", request.encounterDate().toString());
        manifest.put("encounterDate", request.encounterDate().toString());
        manifest.put("orcaAcceptanceId", request.orcaAcceptanceId());
        manifest.put("acceptanceId", request.orcaAcceptanceId());
        manifest.put("hasNoAcceptanceReason", request.noAcceptanceReason() != null);
        manifest.put("department", request.departmentCode());
        manifest.put("departmentCode", request.departmentCode());
        manifest.put("physician", request.physicianCode());
        manifest.put("physicianCode", request.physicianCode());
        manifest.put("insuranceCombination", request.insuranceCombinationNumber());
        manifest.put("insuranceCombinationNumber", request.insuranceCombinationNumber());
        manifest.put("rawSensitiveFieldsExcluded", true);

        putSnapshot(manifest, "patient", patient);
        putSnapshot(manifest, "acceptance", acceptance);
        putSnapshot(manifest, "insurance", insurance);
        putSnapshot(manifest, "disease", disease);
        putPrescription(manifest, prescription);
        putSnapshot(manifest, "prescriptionCandidate", candidate);
        putOrcaOperation(manifest, operation);
        manifest.put("snapshotCompletenessStatus", "COMPLETE");
        manifest.put("snapshotMissingPolicy", "DENY_FINALIZE_EXCEPT_NO_ORCA_ACCEPTANCE");
        manifest.put("orcaUnavailableStatus", "DENY_FINALIZE_ORCA_SNAPSHOT_UNAVAILABLE");
        return writeJson(manifest);
    }

    private SnapshotRef requirePatientSnapshot(FinalizeSnapshotRequest request) {
        Object[] row = single("""
                SELECT orca_patient_cache_id, source_system, source_api, fetched_at,
                       raw_response_hash, cache_status, business_status, cast(response_summary_json as text)
                  FROM opendolphin.orca_patient_cache
                 WHERE facility_id = ?
                   AND orca_patient_id = ?
                   AND source_system = 'ORCA'
                   AND source_api = 'patientgetv2'
                   AND cache_status = 'CURRENT'
                   AND business_status = 'ORCA_PATIENT_FOUND'
                 ORDER BY fetched_at DESC, orca_patient_cache_id DESC
                 LIMIT 1
                """, request.facilityId(), request.orcaPatientId());
        if (row == null) {
            throw incomplete("patientSnapshot", "ORCA patientgetv2 CURRENT snapshot is required");
        }
        return ref("SNAPSHOT_RECORDED", "orca_patient_cache:" + text(row[0]), text(row[4]),
                text(row[1]), text(row[2]), instantText(row[3]), summary(
                        "cacheStatus", text(row[5]),
                        "businessStatus", text(row[6])));
    }

    private SnapshotRef resolveAcceptanceSnapshot(FinalizeSnapshotRequest request) {
        if (request.orcaAcceptanceId() == null) {
            return ref("NO_ORCA_ACCEPTANCE_RECORDED", null, null, "ORCA", "acceptlstv2", null,
                    Map.of("missingReasonClass", "NO_ACCEPTANCE_REASON"));
        }
        Object[] row = single("""
                SELECT orca_acceptance_cache_id, source_system, source_api, fetched_at,
                       row_hash, acceptance_status, orca_acceptance_id, acceptance_date,
                       department_code, physician_code, insurance_combination_number
                  FROM opendolphin.orca_acceptance_cache
                 WHERE facility_id = ?
                   AND source_system = 'ORCA'
                   AND source_api = 'acceptlstv2'
                   AND acceptance_status IN ('CURRENT', 'DIFF_DETECTED', 'NEEDS_REVIEW')
                   AND orca_patient_id = ?
                   AND (orca_acceptance_id = ? OR orca_acceptance_key = ?)
                 ORDER BY fetched_at DESC, orca_acceptance_cache_id DESC
                 LIMIT 1
                """, request.facilityId(), request.orcaPatientId(), request.orcaAcceptanceId(),
                request.orcaAcceptanceId());
        if (row == null) {
            throw incomplete("acceptanceSnapshot", "ORCA acceptlstv2 snapshot is required when orcaAcceptanceId is present");
        }
        return ref("SNAPSHOT_RECORDED", "orca_acceptance_cache:" + text(row[0]), text(row[4]),
                text(row[1]), text(row[2]), instantText(row[3]), summary(
                        "acceptanceStatus", text(row[5]),
                        "acceptanceId", text(row[6]),
                        "visitDate", text(row[7]),
                        "department", text(row[8]),
                        "physician", text(row[9]),
                        "insuranceCombination", text(row[10])));
    }

    private SnapshotRef requireInsuranceSnapshot(FinalizeSnapshotRequest request) {
        Object[] row = single("""
                SELECT orca_insurance_cache_id, source_system, source_api, fetched_at,
                       row_hash, cache_status, base_date, insurance_combination_number,
                       public_insurance_count, cast(response_summary_json as text)
                  FROM opendolphin.orca_insurance_cache
                 WHERE facility_id = ?
                   AND source_system = 'ORCA'
                   AND source_api = 'insuranceinf1v2'
                   AND cache_status IN ('CURRENT', 'DIFF_DETECTED', 'NEEDS_REVIEW')
                   AND orca_patient_id = ?
                   AND insurance_combination_number = ?
                 ORDER BY fetched_at DESC, orca_insurance_cache_id DESC
                 LIMIT 1
                """, request.facilityId(), request.orcaPatientId(), request.insuranceCombinationNumber());
        if (row == null) {
            throw incomplete("insuranceSnapshot", "ORCA insuranceinf1v2 snapshot is required");
        }
        return ref("SNAPSHOT_RECORDED", "orca_insurance_cache:" + text(row[0]), text(row[4]),
                text(row[1]), text(row[2]), instantText(row[3]), summary(
                        "cacheStatus", text(row[5]),
                        "baseDate", text(row[6]),
                        "insuranceCombination", text(row[7]),
                        "publicInsuranceCount", numberOrZero(row[8])));
    }

    private SnapshotRef requireDiseaseSnapshot(FinalizeSnapshotRequest request) {
        String baseMonth = request.encounterDate().format(DateTimeFormatter.ofPattern("yyyyMM"));
        Object[] cache = single("""
                SELECT orca_disease_cache_id, source_system, source_api, fetched_at,
                       raw_response_hash, base_month, cast(warnings_json as text), cast(unmatched_json as text)
                  FROM opendolphin.orca_disease_cache
                 WHERE facility_id = ?
                   AND source_system = 'ORCA'
                   AND source_api = 'diseasegetv2'
                   AND orca_patient_id = ?
                   AND base_month = ?
                   AND (department_code IS NULL OR department_code = ?)
                   AND (insurance_combination_number IS NULL OR insurance_combination_number = ?)
                 ORDER BY fetched_at DESC, orca_disease_cache_id DESC
                 LIMIT 1
                """, request.facilityId(), request.orcaPatientId(), baseMonth, request.departmentCode(),
                request.insuranceCombinationNumber());
        if (cache == null) {
            throw incomplete("diseaseSnapshot", "ORCA diseasegetv2 cache is required for chart finalization");
        }
        Object snapshotId = em.createNativeQuery("""
                        INSERT INTO opendolphin.orca_disease_snapshot
                            (facility_id, encounter_id, chart_revision_id, orca_patient_id, base_month, perform_date,
                             department_code, physician_code, insurance_combination_number, snapshot_reason,
                             snapshot_created_at, source_api, cache_id, raw_response_hash, normalized_payload_json,
                             warnings_json, unmatched_json)
                        SELECT facility_id, ?, ?, orca_patient_id, base_month, ?, ?, ?, insurance_combination_number,
                               'CHART_FINALIZE', ?, source_api, orca_disease_cache_id, raw_response_hash,
                               normalized_payload_json, warnings_json, unmatched_json
                          FROM opendolphin.orca_disease_cache
                         WHERE orca_disease_cache_id = ?
                        RETURNING orca_disease_snapshot_id
                        """)
                .setParameter(1, request.encounterId())
                .setParameter(2, String.valueOf(request.chartRevisionId()))
                .setParameter(3, Date.valueOf(request.encounterDate()))
                .setParameter(4, request.departmentCode())
                .setParameter(5, request.physicianCode())
                .setParameter(6, Timestamp.from(request.capturedAt()))
                .setParameter(7, cache[0])
                .getSingleResult();
        return ref("SNAPSHOT_RECORDED", "orca_disease_snapshot:" + text(snapshotId), text(cache[4]),
                text(cache[1]), text(cache[2]), instantText(cache[3]), summary(
                        "baseMonth", text(cache[5]),
                        "warningCount", readList(cache[6]).size(),
                        "unmatchedCount", readList(cache[7]).size()));
    }

    private PrescriptionSnapshot resolvePrescriptionSnapshot(FinalizeSnapshotRequest request) {
        Object[] row = single("""
                SELECT po.prescription_order_id, pr.prescription_order_revision_id, po.status,
                       pr.content_hash, cast(pr.after_summary_json as text)
                  FROM opendolphin.prescription_order po
                  JOIN opendolphin.prescription_order_revision pr
                    ON pr.prescription_order_revision_id = po.current_revision_id
                 WHERE po.facility_id = ?
                   AND po.chart_revision_id = ?
                 ORDER BY po.updated_at DESC, po.prescription_order_id DESC
                 LIMIT 1
                """, request.facilityId(), String.valueOf(request.chartRevisionId()));
        if (row == null) {
            return new PrescriptionSnapshot("NO_PRESCRIPTION_ORDER", null, null, null, null, null);
        }
        return new PrescriptionSnapshot("SNAPSHOT_RECORDED", numberOrNull(row[0]), numberOrNull(row[1]),
                text(row[2]), text(row[3]), sha256(text(row[4])));
    }

    private SnapshotRef resolveMedicalCandidateSnapshot(FinalizeSnapshotRequest request, PrescriptionSnapshot prescription) {
        if (prescription.prescriptionOrderId() == null) {
            return ref("NO_PRESCRIPTION_ORDER", null, null, "LOCAL_PRESCRIPTION", "medical-candidate", null, Map.of());
        }
        Object[] row = single("""
                SELECT orca_medical_candidate_id, source_system, created_at, candidate_status,
                       sendable, cast(candidate_json as text), cast(issue_summary_json as text),
                       prescription_order_id, prescription_order_revision_id
                  FROM opendolphin.orca_medical_candidate
                 WHERE facility_id = ?
                   AND chart_revision_id = ?
                   AND prescription_order_id = ?
                   AND prescription_order_revision_id = ?
                   AND source_system = 'LOCAL_PRESCRIPTION'
                 ORDER BY created_at DESC, orca_medical_candidate_id DESC
                 LIMIT 1
                """, request.facilityId(), String.valueOf(request.chartRevisionId()),
                prescription.prescriptionOrderId(), prescription.prescriptionOrderRevisionId());
        if (row == null) {
            throw incomplete("prescriptionCandidateSnapshot",
                    "medical candidate snapshot is required when a prescription order exists");
        }
        return ref("SNAPSHOT_RECORDED", "orca_medical_candidate:" + text(row[0]),
                sha256(text(row[5]) + "\n" + text(row[6])), text(row[1]), "medical-candidate",
                instantText(row[2]), summary(
                        "candidateStatus", text(row[3]),
                        "sendable", Boolean.TRUE.equals(row[4]),
                        "issueCount", readList(row[6]).size()));
    }

    private OrcaOperationSnapshot resolveOrcaOperationSnapshot(FinalizeSnapshotRequest request) {
        Object[] row = single("""
                SELECT op.orca_operation_id, op.source_api, op.operation_status, op.request_hash,
                       op.response_hash, op.needs_user_review, op.requested_at,
                       tr.orca_transmission_id, tr.transmission_status, tr.response_hash,
                       rs.operation_status, rs.response_hash,
                       coalesce((SELECT reconciliation_status
                                   FROM opendolphin.orca_reconciliation_result rr
                                  WHERE rr.orca_operation_id = op.orca_operation_id
                                  ORDER BY rr.reconciled_at DESC, rr.orca_reconciliation_result_id DESC
                                  LIMIT 1), NULL)
                  FROM opendolphin.orca_operation op
                  LEFT JOIN LATERAL (
                      SELECT *
                        FROM opendolphin.orca_transmission tr
                       WHERE tr.orca_operation_id = op.orca_operation_id
                       ORDER BY tr.attempt_number DESC, tr.orca_transmission_id DESC
                       LIMIT 1
                  ) tr ON true
                  LEFT JOIN LATERAL (
                      SELECT *
                        FROM opendolphin.orca_response_summary rs
                       WHERE rs.orca_operation_id = op.orca_operation_id
                       ORDER BY rs.summarized_at DESC, rs.orca_response_summary_id DESC
                       LIMIT 1
                  ) rs ON true
                 WHERE op.facility_id = ?
                   AND op.chart_revision_id = ?
                 ORDER BY op.requested_at DESC, op.orca_operation_id DESC
                 LIMIT 1
                """, request.facilityId(), String.valueOf(request.chartRevisionId()));
        if (row == null) {
            return new OrcaOperationSnapshot("NO_ORCA_OPERATION_RECORDED", null, null, null, null, null, null, null);
        }
        String responseHash = firstNonBlank(text(row[11]), text(row[9]), text(row[4]));
        return new OrcaOperationSnapshot("SNAPSHOT_RECORDED", "orca_operation:" + text(row[0]), text(row[2]),
                text(row[3]), responseHash, text(row[7]) != null ? "orca_transmission:" + text(row[7]) : null,
                text(row[8]), text(row[12]));
    }

    private Object[] single(String sql, Object... params) {
        try {
            var query = em.createNativeQuery(sql);
            for (int i = 0; i < params.length; i++) {
                query.setParameter(i + 1, params[i]);
            }
            Object row = query.getSingleResult();
            return row instanceof Object[] values ? values : new Object[]{row};
        } catch (NoResultException ex) {
            return null;
        }
    }

    private SnapshotRef ref(String status, String reference, String hash, String sourceSystem, String sourceApi,
            String fetchedAt, Map<String, Object> summary) {
        return new SnapshotRef(status, reference, hash, sourceSystem, sourceApi, fetchedAt, summary);
    }

    private void putSnapshot(Map<String, Object> manifest, String prefix, SnapshotRef ref) {
        manifest.put(prefix + "SnapshotStatus", ref.status());
        if (ref.reference() != null) {
            manifest.put(prefix + "SnapshotReference", ref.reference());
        }
        if (ref.hash() != null) {
            manifest.put(prefix + "SnapshotHash", ref.hash());
        }
        if (ref.fetchedAt() != null) {
            manifest.put(prefix + "SnapshotFetchedAt", ref.fetchedAt());
        }
        manifest.put(prefix + "SnapshotSourceSystem", ref.sourceSystem());
        manifest.put(prefix + "SnapshotSourceApi", ref.sourceApi());
        if (!ref.summary().isEmpty()) {
            manifest.put(prefix + "SnapshotSummary", ref.summary());
        }
    }

    private void putPrescription(Map<String, Object> manifest, PrescriptionSnapshot prescription) {
        manifest.put("prescriptionSnapshotStatus", prescription.status());
        if (prescription.prescriptionOrderId() != null) {
            manifest.put("prescriptionOrderId", prescription.prescriptionOrderId());
            manifest.put("prescriptionOrderRevisionId", prescription.prescriptionOrderRevisionId());
            manifest.put("prescriptionOrderStatus", prescription.statusValue());
            manifest.put("prescriptionContentHash", prescription.contentHash());
            manifest.put("prescriptionSnapshotHash", prescription.snapshotHash());
        }
    }

    private void putOrcaOperation(Map<String, Object> manifest, OrcaOperationSnapshot operation) {
        manifest.put("orcaTransmissionSnapshotStatus", operation.status());
        manifest.put("orcaOperationStatus", operation.operationStatus());
        manifest.put("orcaOperationReference", operation.operationReference());
        manifest.put("orcaOperationRequestHash", operation.requestHash());
        manifest.put("orcaTransmissionReference", operation.transmissionReference());
        manifest.put("orcaTransmissionStatus", operation.transmissionStatus());
        manifest.put("orcaTransmissionHash", operation.responseHash());
        manifest.put("orcaReconciliationStatus", operation.reconciliationStatus());
    }

    private Map<String, Object> summary(Object... keyValues) {
        Map<String, Object> summary = new LinkedHashMap<>();
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            Object key = keyValues[i];
            Object value = keyValues[i + 1];
            if (key != null && value != null) {
                summary.put(key.toString(), value);
            }
        }
        return summary;
    }

    private String latestFetchedAt(SnapshotRef... refs) {
        String latest = null;
        for (SnapshotRef ref : refs) {
            String fetchedAt = ref.fetchedAt();
            if (fetchedAt != null && (latest == null || fetchedAt.compareTo(latest) > 0)) {
                latest = fetchedAt;
            }
        }
        return latest;
    }

    private WebApplicationException incomplete(String field, String reason) {
        return AbstractResource.restError(null, Response.Status.CONFLICT, "chart_revision_snapshot_incomplete",
                "Chart finalization requires a complete ORCA snapshot",
                Map.of("field", field, "reason", reason, "orcaUnavailableHandling",
                        "ORCA_UNAVAILABLE_IS_NOT_NO_ACCEPTANCE_REASON"), null);
    }

    private List<Object> readList(Object json) {
        try {
            return OBJECT_MAPPER.readValue(text(json) != null ? text(json) : "[]",
                    OBJECT_MAPPER.getTypeFactory().constructCollectionType(List.class, Object.class));
        } catch (JsonProcessingException ex) {
            return List.of();
        }
    }

    private String writeJson(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("chart_finalize_snapshot_encode_error", ex);
        }
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private Long numberOrNull(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.valueOf(value.toString());
    }

    private long numberOrZero(Object value) {
        Long number = numberOrNull(value);
        return number != null ? number : 0L;
    }

    private String text(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString();
        return text.isBlank() ? null : text;
    }

    private String instantText(Object value) {
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant().toString();
        }
        if (value instanceof Instant instant) {
            return instant.toString();
        }
        return text(value);
    }

    private String firstNonBlank(String first, String second, String third) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        if (second != null && !second.isBlank()) {
            return second;
        }
        return third != null && !third.isBlank() ? third : null;
    }

    record FinalizeSnapshotRequest(String facilityId,
                                   long chartId,
                                   long chartRevisionId,
                                   String orcaPatientId,
                                   String encounterId,
                                   LocalDate encounterDate,
                                   String orcaAcceptanceId,
                                   String noAcceptanceReason,
                                   String departmentCode,
                                   String physicianCode,
                                   String insuranceCombinationNumber,
                                   Instant capturedAt) {
    }

    record SnapshotRef(String status,
                       String reference,
                       String hash,
                       String sourceSystem,
                       String sourceApi,
                       String fetchedAt,
                       Map<String, Object> summary) {
    }

    record PrescriptionSnapshot(String status,
                                Long prescriptionOrderId,
                                Long prescriptionOrderRevisionId,
                                String statusValue,
                                String contentHash,
                                String snapshotHash) {
    }

    record OrcaOperationSnapshot(String status,
                                 String operationReference,
                                 String operationStatus,
                                 String requestHash,
                                 String responseHash,
                                 String transmissionReference,
                                 String transmissionStatus,
                                 String reconciliationStatus) {
    }
}
