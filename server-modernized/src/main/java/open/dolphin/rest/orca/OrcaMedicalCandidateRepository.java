package open.dolphin.rest.orca;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV2Request;
import open.dolphin.rest.dto.orca.OrcaMedicalCandidateResponse;

@ApplicationScoped
class OrcaMedicalCandidateRepository {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };
    private static final TypeReference<List<OrcaMedicalCandidateResponse.Issue>> ISSUE_LIST_TYPE = new TypeReference<>() {
    };
    private static final TypeReference<List<ChartSupportMedicalModV2Request.MedicalInformation>> MEDICAL_INFORMATION_LIST_TYPE =
            new TypeReference<>() {
            };

    @PersistenceContext
    private EntityManager entityManager;

    PrescriptionRevisionRecord findPrescriptionByChartRevision(String facilityId, String chartRevisionId) {
        try {
            Object row = entityManager.createNativeQuery("""
                            SELECT po.prescription_order_id,
                                   pr.prescription_order_revision_id,
                                   po.patient_id,
                                   po.encounter_id,
                                   po.status,
                                   pr.content_hash,
                                   cast(pr.after_summary_json as text)
                              FROM opendolphin.prescription_order po
                              JOIN opendolphin.prescription_order_revision pr
                                ON pr.prescription_order_revision_id = po.current_revision_id
                             WHERE po.facility_id = ?
                               AND po.chart_revision_id = ?
                             ORDER BY po.updated_at DESC, po.prescription_order_id DESC
                             LIMIT 1
                            """)
                    .setParameter(1, facilityId)
                    .setParameter(2, chartRevisionId)
                    .getSingleResult();
            Object[] values = (Object[]) row;
            return new PrescriptionRevisionRecord(
                    number(values[0]),
                    number(values[1]),
                    text(values[2]),
                    text(values[3]),
                    text(values[4]),
                    text(values[5]),
                    text(values[6]));
        } catch (NoResultException ex) {
            return null;
        }
    }

    long saveCandidate(String facilityId,
            String chartRevisionId,
            PrescriptionRevisionRecord source,
            OrcaMedicalCandidateResponse candidate,
            String actor,
            Instant now) {
        Object id = entityManager.createNativeQuery("""
                        INSERT INTO opendolphin.orca_medical_candidate
                            (facility_id, chart_revision_id, prescription_order_id, prescription_order_revision_id,
                             patient_id, encounter_id, candidate_status, sendable, candidate_json,
                             issue_summary_json, created_at, created_by)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), cast(? as jsonb), ?, ?)
                        RETURNING orca_medical_candidate_id
                        """)
                .setParameter(1, facilityId)
                .setParameter(2, chartRevisionId)
                .setParameter(3, source.prescriptionOrderId())
                .setParameter(4, source.prescriptionRevisionId())
                .setParameter(5, source.patientId())
                .setParameter(6, source.encounterId())
                .setParameter(7, candidate.getCandidateStatus())
                .setParameter(8, candidate.isSendable())
                .setParameter(9, json(candidateSnapshot(candidate)))
                .setParameter(10, json(candidate.getIssues()))
                .setParameter(11, Timestamp.from(now))
                .setParameter(12, actor)
                .getSingleResult();
        return number(id);
    }

    LatestCandidateRecord findLatestCandidateByChartRevision(String facilityId, String chartRevisionId) {
        try {
            Object row = entityManager.createNativeQuery("""
                            SELECT orca_medical_candidate_id,
                                   prescription_order_id,
                                   prescription_order_revision_id,
                                   patient_id,
                                   encounter_id,
                                   candidate_status,
                                   sendable,
                                   cast(candidate_json as text),
                                   cast(issue_summary_json as text),
                                   current_po.prescription_order_id,
                                   current_po.status,
                                   current_pr.prescription_order_revision_id,
                                   current_pr.content_hash
                              FROM opendolphin.orca_medical_candidate candidate
                              LEFT JOIN LATERAL (
                                  SELECT po.prescription_order_id,
                                         po.status,
                                         po.current_revision_id
                                    FROM opendolphin.prescription_order po
                                   WHERE po.facility_id = candidate.facility_id
                                     AND po.chart_revision_id = candidate.chart_revision_id
                                   ORDER BY po.updated_at DESC, po.prescription_order_id DESC
                                   LIMIT 1
                              ) current_po ON true
                              LEFT JOIN opendolphin.prescription_order_revision current_pr
                                ON current_pr.prescription_order_revision_id = current_po.current_revision_id
                             WHERE candidate.facility_id = ?
                               AND candidate.chart_revision_id = ?
                               AND candidate.source_system = 'LOCAL_PRESCRIPTION'
                             ORDER BY candidate.created_at DESC, candidate.orca_medical_candidate_id DESC
                             LIMIT 1
                            """)
                    .setParameter(1, facilityId)
                    .setParameter(2, chartRevisionId)
                    .getSingleResult();
            Object[] values = (Object[]) row;
            return new LatestCandidateRecord(
                    number(values[0]),
                    number(values[1]),
                    number(values[2]),
                    text(values[3]),
                    text(values[4]),
                    text(values[5]),
                    Boolean.TRUE.equals(values[6]),
                    text(values[7]),
                    text(values[8]),
                    numberOrNull(values[9]),
                    text(values[10]),
                    numberOrNull(values[11]),
                    text(values[12]));
        } catch (NoResultException ex) {
            return null;
        }
    }

    OrcaMedicalCandidateResponse toResponse(String chartRevisionId, LatestCandidateRecord record) {
        Map<String, Object> snapshot = readMap(record.candidateJson());
        String candidateContentHash = text(snapshot.get("prescriptionContentHash"));
        List<OrcaMedicalCandidateResponse.Issue> issues = new ArrayList<>(readIssues(record.issueSummaryJson()));
        boolean orderStale = !Long.valueOf(record.prescriptionOrderId()).equals(record.currentPrescriptionOrderId());
        boolean revisionStale = !Long.valueOf(record.prescriptionRevisionId()).equals(record.currentPrescriptionRevisionId());
        boolean statusStale = !isCandidateSourceStatus(record.currentPrescriptionStatus());
        boolean sourceStale = orderStale
                || revisionStale
                || statusStale
                || !equalsTrimmed(candidateContentHash, record.currentPrescriptionContentHash());
        OrcaMedicalCandidateResponse response = new OrcaMedicalCandidateResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setCandidateId(record.candidateId());
        response.setCandidateStatus(sourceStale ? "NEEDS_REVIEW" : record.candidateStatus());
        response.setSendable(!sourceStale && record.sendable());
        response.setNonAuthoritative(true);
        response.setPatientId(record.patientId());
        response.setEncounterId(record.encounterId());
        response.setChartRevisionId(chartRevisionId);
        response.setPrescriptionId(record.prescriptionOrderId());
        response.setPrescriptionRevisionId(record.prescriptionRevisionId());
        response.setPrescriptionContentHash(candidateContentHash);
        response.setMedicalInformation(readMedicalInformation(snapshot.get("medicalInformation")));
        if (sourceStale) {
            issues.add(issue("prescription_candidate_source_stale",
                    "candidate source revision does not match current prescription revision"));
        }
        response.setIssues(issues);
        return response;
    }

    Map<String, Object> candidateSnapshot(OrcaMedicalCandidateResponse candidate) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("nonAuthoritative", candidate.isNonAuthoritative());
        snapshot.put("candidateStatus", candidate.getCandidateStatus());
        snapshot.put("sendable", candidate.isSendable());
        snapshot.put("prescriptionContentHash", candidate.getPrescriptionContentHash());
        snapshot.put("medicalInformation", candidate.getMedicalInformation());
        return snapshot;
    }

    private String json(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("orca_medical_candidate_encode_error", ex);
        }
    }

    private Map<String, Object> readMap(String json) {
        try {
            return OBJECT_MAPPER.readValue(json != null && !json.isBlank() ? json : "{}", MAP_TYPE);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("orca_medical_candidate_decode_error", ex);
        }
    }

    private List<OrcaMedicalCandidateResponse.Issue> readIssues(String json) {
        try {
            return OBJECT_MAPPER.readValue(json != null && !json.isBlank() ? json : "[]", ISSUE_LIST_TYPE);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("orca_medical_candidate_issue_decode_error", ex);
        }
    }

    private List<ChartSupportMedicalModV2Request.MedicalInformation> readMedicalInformation(Object value) {
        if (value == null) {
            return List.of();
        }
        return OBJECT_MAPPER.convertValue(value, MEDICAL_INFORMATION_LIST_TYPE);
    }

    private long number(Object value) {
        return ((Number) value).longValue();
    }

    private Long numberOrNull(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private String text(Object value) {
        return value != null ? value.toString() : null;
    }

    private boolean equalsTrimmed(String expected, String actual) {
        String normalizedExpected = trimToNull(expected);
        String normalizedActual = trimToNull(actual);
        return normalizedExpected != null && normalizedExpected.equals(normalizedActual);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private OrcaMedicalCandidateResponse.Issue issue(String code, String message) {
        OrcaMedicalCandidateResponse.Issue issue = new OrcaMedicalCandidateResponse.Issue();
        issue.setCode(code);
        issue.setMessage(message);
        return issue;
    }

    private boolean isCandidateSourceStatus(String status) {
        return "FINAL".equals(status) || "CHANGED".equals(status) || "REISSUED".equals(status);
    }

    record PrescriptionRevisionRecord(
            long prescriptionOrderId,
            long prescriptionRevisionId,
            String patientId,
            String encounterId,
            String status,
            String contentHash,
            String summaryJson) {
    }

    record LatestCandidateRecord(
            long candidateId,
            long prescriptionOrderId,
            long prescriptionRevisionId,
            String patientId,
            String encounterId,
            String candidateStatus,
            boolean sendable,
            String candidateJson,
            String issueSummaryJson,
            Long currentPrescriptionOrderId,
            String currentPrescriptionStatus,
            Long currentPrescriptionRevisionId,
            String currentPrescriptionContentHash) {
    }
}
