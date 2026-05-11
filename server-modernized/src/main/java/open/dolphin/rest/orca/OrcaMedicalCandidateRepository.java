package open.dolphin.rest.orca;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.rest.dto.orca.OrcaMedicalCandidateResponse;

@ApplicationScoped
class OrcaMedicalCandidateRepository {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();

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

    private long number(Object value) {
        return ((Number) value).longValue();
    }

    private String text(Object value) {
        return value != null ? value.toString() : null;
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
}
