package open.dolphin.rest.orca;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import open.dolphin.rest.dto.orca.PrescriptionDrug;
import open.dolphin.rest.dto.orca.PrescriptionOrder;
import open.dolphin.rest.dto.orca.PrescriptionRp;

@ApplicationScoped
class PrescriptionAuthorityRepository {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();

    @PersistenceContext
    private EntityManager entityManager;

    PrescriptionMutationResult createDraft(String facilityId,
            String patientId,
            String encounterId,
            String chartRevisionId,
            PrescriptionOrder order,
            String actor,
            Instant now) {
        long orderId = number(entityManager.createNativeQuery("""
                        INSERT INTO opendolphin.prescription_order
                            (facility_id, patient_id, encounter_id, chart_revision_id, created_by, updated_by, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        RETURNING prescription_order_id
                        """)
                .setParameter(1, facilityId)
                .setParameter(2, patientId)
                .setParameter(3, encounterId)
                .setParameter(4, chartRevisionId)
                .setParameter(5, actor)
                .setParameter(6, actor)
                .setParameter(7, Timestamp.from(now))
                .setParameter(8, Timestamp.from(now))
                .getSingleResult());
        long revisionId = insertRevision(orderId, 1, "DRAFT", null, null, null, null, actor, now, order, null, order);
        insertItems(revisionId, order, actor);
        setCurrentRevision(facilityId, orderId, revisionId, "DRAFT", actor, now);
        insertEvent(facilityId, orderId, revisionId, "CREATE", null, null, actor, now, null, order);
        return new PrescriptionMutationResult(orderId, revisionId, "DRAFT", null, patientId, encounterId);
    }

    PrescriptionMutationResult finalizeDraft(String facilityId, long orderId, String actor, Instant now) {
        Object[] row = loadOrderForUpdate(facilityId, orderId);
        long revisionId = number(row[1]);
        String status = text(row[2]);
        if (!"DRAFT".equals(status)) {
            throw new IllegalStateException("prescription_order_not_draft");
        }
        String currentSummary = summaryFromRevision(facilityId, orderId, revisionId);
        String contentHash = sha256(json(currentSummary));
        entityManager.createNativeQuery("""
                        UPDATE opendolphin.prescription_order_revision
                           SET status = 'FINAL', content_hash = ?, finalized_at = ?, finalized_by = ?
                         WHERE prescription_order_revision_id = ?
                        """)
                .setParameter(1, contentHash)
                .setParameter(2, Timestamp.from(now))
                .setParameter(3, actor)
                .setParameter(4, revisionId)
                .executeUpdate();
        setCurrentRevision(facilityId, orderId, revisionId, "FINAL", actor, now);
        insertEvent(facilityId, orderId, revisionId, "FINALIZE", null, null, actor, now, currentSummary, currentSummary);
        return new PrescriptionMutationResult(orderId, revisionId, "FINAL", contentHash, text(row[3]), text(row[4]));
    }

    PrescriptionMutationResult transition(String facilityId,
            long orderId,
            String status,
            String eventType,
            String reasonCode,
            String reasonText,
            PrescriptionOrder order,
            String actor,
            Instant now,
            String contentHash) {
        Object[] row = loadOrderForUpdate(facilityId, orderId);
        String currentStatus = text(row[2]);
        if ("DRAFT".equals(currentStatus)) {
            throw new IllegalStateException("prescription_order_not_finalized");
        }
        if (order != null) {
            order.setPatientId(text(row[3]));
            order.setEncounterId(text(row[4]));
        }
        String resolvedContentHash = order != null ? sha256(json(order)) : contentHash;
        int nextRevision = ((Number) entityManager.createNativeQuery("""
                        SELECT COALESCE(MAX(revision_number), 0) + 1
                          FROM opendolphin.prescription_order_revision pr
                          JOIN opendolphin.prescription_order po
                            ON po.prescription_order_id = pr.prescription_order_id
                         WHERE pr.prescription_order_id = ?
                           AND po.facility_id = ?
                        """)
                .setParameter(1, orderId)
                .setParameter(2, facilityId)
                .getSingleResult()).intValue();
        Object before = summaryFromRevision(facilityId, orderId, number(row[1]));
        enableAuthorityMutation();
        long revisionId = insertRevision(orderId, nextRevision, status, reasonCode, reasonText, resolvedContentHash,
                "FINAL".equals(status) || "CHANGED".equals(status) || "REISSUED".equals(status) ? now : null,
                actor, now, order, before, order);
        if (order != null) {
            insertItems(revisionId, order, actor);
        }
        setCurrentRevision(facilityId, orderId, revisionId, status, actor, now);
        insertEvent(facilityId, orderId, revisionId, eventType, reasonCode, reasonText, actor, now, before, order);
        return new PrescriptionMutationResult(orderId, revisionId, status, resolvedContentHash, text(row[3]), text(row[4]));
    }

    PrescriptionMutationResult recordResend(String facilityId,
            long orderId,
            String reasonCode,
            String reasonText,
            String actor,
            Instant now) {
        Object[] row = loadOrderForUpdate(facilityId, orderId);
        String currentStatus = text(row[2]);
        if ("DRAFT".equals(currentStatus)) {
            throw new IllegalStateException("prescription_order_not_finalized");
        }
        long revisionId = number(row[1]);
        Object currentSummary = summaryFromRevision(facilityId, orderId, revisionId);
        insertEvent(facilityId, orderId, revisionId, "RESEND", reasonCode, reasonText, actor, now, currentSummary, currentSummary);
        return new PrescriptionMutationResult(orderId, revisionId, currentStatus,
                contentHashFromRevision(facilityId, orderId, revisionId), text(row[3]), text(row[4]));
    }

    private String summaryFromRevision(String facilityId, long orderId, long revisionId) {
        return text(entityManager.createNativeQuery("""
                        SELECT pr.after_summary_json::text
                          FROM opendolphin.prescription_order_revision pr
                          JOIN opendolphin.prescription_order po
                            ON po.prescription_order_id = pr.prescription_order_id
                         WHERE pr.prescription_order_revision_id = ?
                           AND pr.prescription_order_id = ?
                           AND po.facility_id = ?
                        """)
                .setParameter(1, revisionId)
                .setParameter(2, orderId)
                .setParameter(3, facilityId)
                .getSingleResult());
    }

    private String contentHashFromRevision(String facilityId, long orderId, long revisionId) {
        return text(entityManager.createNativeQuery("""
                        SELECT pr.content_hash
                          FROM opendolphin.prescription_order_revision pr
                          JOIN opendolphin.prescription_order po
                            ON po.prescription_order_id = pr.prescription_order_id
                         WHERE pr.prescription_order_revision_id = ?
                           AND pr.prescription_order_id = ?
                           AND po.facility_id = ?
                        """)
                .setParameter(1, revisionId)
                .setParameter(2, orderId)
                .setParameter(3, facilityId)
                .getSingleResult());
    }

    private Object[] loadOrderForUpdate(String facilityId, long orderId) {
        try {
            Object row = entityManager.createNativeQuery("""
                            SELECT prescription_order_id, current_revision_id, status, patient_id, encounter_id
                              FROM opendolphin.prescription_order
                             WHERE prescription_order_id = ?
                               AND facility_id = ?
                             FOR UPDATE
                            """)
                    .setParameter(1, orderId)
                    .setParameter(2, facilityId)
                    .getSingleResult();
            return (Object[]) row;
        } catch (NoResultException ex) {
            throw new IllegalStateException("prescription_order_not_found", ex);
        }
    }

    private long insertRevision(long orderId,
            int revisionNumber,
            String status,
            String reasonCode,
            String reasonText,
            String contentHash,
            Instant finalizedAt,
            String actor,
            Instant now,
            Object source,
            Object before,
            Object after) {
        Object id = entityManager.createNativeQuery("""
                        INSERT INTO opendolphin.prescription_order_revision
                            (prescription_order_id, revision_number, status, reason_code, reason_text, content_hash,
                             finalized_at, finalized_by, created_at, created_by,
                             source_summary_json, before_summary_json, after_summary_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), cast(? as jsonb), cast(? as jsonb))
                        RETURNING prescription_order_revision_id
                        """)
                .setParameter(1, orderId)
                .setParameter(2, revisionNumber)
                .setParameter(3, status)
                .setParameter(4, reasonCode)
                .setParameter(5, reasonText)
                .setParameter(6, contentHash)
                .setParameter(7, finalizedAt != null ? Timestamp.from(finalizedAt) : null)
                .setParameter(8, finalizedAt != null ? actor : null)
                .setParameter(9, Timestamp.from(now))
                .setParameter(10, actor)
                .setParameter(11, json(source))
                .setParameter(12, json(before))
                .setParameter(13, json(after))
                .getSingleResult();
        return number(id);
    }

    private void insertItems(long revisionId, PrescriptionOrder order, String actor) {
        if (order == null || order.getRps() == null) {
            return;
        }
        int sequence = 1;
        List<PrescriptionRp> rps = order.getRps();
        for (int rpIndex = 0; rpIndex < rps.size(); rpIndex++) {
            PrescriptionRp rp = rps.get(rpIndex);
            if (rp == null || rp.getDrugs() == null) {
                continue;
            }
            for (PrescriptionDrug drug : rp.getDrugs()) {
                if (drug == null) {
                    continue;
                }
                StructuredPrescriptionItemRow row = structuredItemRow(sequence++, rpIndex + 1, rp, drug, actor);
                entityManager.createNativeQuery("""
                                INSERT INTO opendolphin.prescription_order_item
                                    (prescription_order_revision_id, item_sequence, rp_sequence, drug_code, drug_name,
                                     standard_name, dosage_form, usage_code, usage_name, dose_value, dose_unit, days,
                                     prescription_location, medication_route, generic_name_prescription,
                                     doctor_comment, unresolved_reason, item_json, created_by)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), ?)
                                """)
                        .setParameter(1, revisionId)
                        .setParameter(2, row.itemSequence())
                        .setParameter(3, row.rpSequence())
                        .setParameter(4, row.drugCode())
                        .setParameter(5, row.drugName())
                        .setParameter(6, row.standardName())
                        .setParameter(7, row.dosageForm())
                        .setParameter(8, row.usageCode())
                        .setParameter(9, row.usageName())
                        .setParameter(10, row.doseValue())
                        .setParameter(11, row.doseUnit())
                        .setParameter(12, row.days())
                        .setParameter(13, row.prescriptionLocation())
                        .setParameter(14, row.medicationRoute())
                        .setParameter(15, row.genericNamePrescription())
                        .setParameter(16, row.doctorComment())
                        .setParameter(17, row.unresolvedReason())
                        .setParameter(18, row.itemJson())
                        .setParameter(19, row.createdBy())
                        .executeUpdate();
            }
        }
    }

    StructuredPrescriptionItemRow structuredItemRow(int itemSequence, int rpSequence, PrescriptionRp rp, PrescriptionDrug drug, String actor) {
        String drugName = trimToNull(drug.getName());
        if (drugName == null) {
            drugName = "UNRESOLVED_DRUG";
        }
        return new StructuredPrescriptionItemRow(
                itemSequence,
                rpSequence,
                trimToNull(drug.getCode()),
                drugName,
                trimToNull(drug.getStandardName()),
                trimToNull(drug.getDosageForm()),
                rp != null ? trimToNull(rp.getUsageCode()) : null,
                rp != null ? trimToNull(rp.getUsageName()) : null,
                trimToNull(drug.getQuantity()),
                trimToNull(drug.getUnit()),
                resolveDays(rp),
                resolvePrescriptionLocation(rp),
                resolveMedicationRoute(rp),
                Boolean.TRUE.equals(drug.getGeneralNamePrescription()),
                trimToNull(firstNonBlank(drug.getDrugComment(), rp != null ? rp.getDoctorComment() : null)),
                unresolvedReason(rp, drug),
                json(drug),
                trimToNull(actor));
    }

    private Integer resolveDays(PrescriptionRp rp) {
        if (rp == null) {
            return null;
        }
        String classNumber = trimToNull(rp.getMedicalClassNumber());
        if (classNumber != null && classNumber.matches("\\d{1,4}")) {
            return Integer.valueOf(classNumber);
        }
        Integer explicitDays = rp.getDays();
        return explicitDays != null && explicitDays >= 0 ? explicitDays : null;
    }

    private String resolvePrescriptionLocation(PrescriptionRp rp) {
        if (rp == null) {
            return null;
        }
        String medicalClass = trimToNull(rp.getMedicalClass());
        if (medicalClass != null) {
            return medicalClass.endsWith("2") ? "OUTSIDE" : "IN_HOUSE";
        }
        String explicit = trimToNull(rp.getPrescriptionLocation());
        if (explicit == null) {
            return null;
        }
        String normalized = explicit.replace("-", "_").toUpperCase();
        if ("IN".equals(normalized) || "IN_HOUSE".equals(normalized)) {
            return "IN_HOUSE";
        }
        if ("OUT".equals(normalized) || "OUTSIDE".equals(normalized)) {
            return "OUTSIDE";
        }
        return null;
    }

    private String resolveMedicationRoute(PrescriptionRp rp) {
        if (rp == null) {
            return null;
        }
        String medicalClass = trimToNull(rp.getMedicalClass());
        if (medicalClass != null) {
            if (medicalClass.startsWith("22")) {
                return "AS_NEEDED";
            }
            if (medicalClass.startsWith("23")) {
                return "TOPICAL";
            }
            return "ORAL";
        }
        String explicit = trimToNull(rp.getMedicationRoute());
        if (explicit == null) {
            return null;
        }
        String normalized = explicit.replace("-", "_").toUpperCase();
        if (List.of("ORAL", "TOPICAL", "INJECTION", "AS_NEEDED", "OTHER").contains(normalized)) {
            return normalized;
        }
        if ("REGULAR".equals(normalized)) {
            return "ORAL";
        }
        if ("TONYO".equals(normalized) || "PRN".equals(normalized)) {
            return "AS_NEEDED";
        }
        if ("GAIYO".equals(normalized)) {
            return "TOPICAL";
        }
        return null;
    }

    private String unresolvedReason(PrescriptionRp rp, PrescriptionDrug drug) {
        if (trimToNull(drug.getCode()) == null) {
            return "drug_code_unresolved";
        }
        if (rp == null || trimToNull(rp.getUsageCode()) == null) {
            return "usage_code_unresolved";
        }
        return null;
    }

    private void setCurrentRevision(String facilityId, long orderId, long revisionId, String status, String actor, Instant now) {
        entityManager.createNativeQuery("""
                        UPDATE opendolphin.prescription_order
                           SET current_revision_id = ?, status = ?, updated_by = ?, updated_at = ?
                         WHERE prescription_order_id = ?
                           AND facility_id = ?
                        """)
                .setParameter(1, revisionId)
                .setParameter(2, status)
                .setParameter(3, actor)
                .setParameter(4, Timestamp.from(now))
                .setParameter(5, orderId)
                .setParameter(6, facilityId)
                .executeUpdate();
    }

    private void insertEvent(String facilityId,
            long orderId,
            long revisionId,
            String eventType,
            String reasonCode,
            String reasonText,
            String actor,
            Instant now,
            Object before,
            Object after) {
        Instant occurredAt = now.truncatedTo(ChronoUnit.MICROS);
        String beforeJson = normalizedJson(before);
        String afterJson = normalizedJson(after);
        String previousHash = previousEventHash(facilityId, orderId);
        String eventHash = PrescriptionOrderEventHashChainVerifier.computeEventHash(
                orderId,
                revisionId,
                eventType,
                actor,
                occurredAt,
                beforeJson,
                afterJson,
                previousHash);
        entityManager.createNativeQuery("""
                        INSERT INTO opendolphin.prescription_order_event
                            (prescription_order_id, prescription_order_revision_id, event_type, reason_code,
                             reason_text, actor_user_id, occurred_at, before_summary_json, after_summary_json,
                             previous_event_hash, event_hash)
                        VALUES (?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), cast(? as jsonb), ?, ?)
                        """)
                .setParameter(1, orderId)
                .setParameter(2, revisionId)
                .setParameter(3, eventType)
                .setParameter(4, reasonCode)
                .setParameter(5, reasonText)
                .setParameter(6, actor)
                .setParameter(7, Timestamp.from(occurredAt))
                .setParameter(8, beforeJson)
                .setParameter(9, afterJson)
                .setParameter(10, previousHash)
                .setParameter(11, eventHash)
                .executeUpdate();
    }

    private String previousEventHash(String facilityId, long orderId) {
        @SuppressWarnings("unchecked")
        List<String> hashes = entityManager.createNativeQuery("""
                        SELECT event_hash
                          FROM opendolphin.prescription_order_event poe
                          JOIN opendolphin.prescription_order po
                            ON po.prescription_order_id = poe.prescription_order_id
                         WHERE poe.prescription_order_id = ?
                           AND po.facility_id = ?
                         ORDER BY occurred_at DESC, prescription_order_event_id DESC
                         LIMIT 1
                        """)
                .setParameter(1, orderId)
                .setParameter(2, facilityId)
                .getResultList();
        return hashes.isEmpty() ? PrescriptionOrderEventHashChainVerifier.GENESIS_HASH : hashes.get(0);
    }

    private String normalizedJson(Object value) {
        return text(entityManager.createNativeQuery("SELECT cast(cast(? as jsonb) as text)")
                .setParameter(1, json(value))
                .getSingleResult());
    }

    private void enableAuthorityMutation() {
        entityManager.createNativeQuery("SELECT set_config('opendolphin.prescription_authority_mutation', 'event', true)")
                .getSingleResult();
    }

    private String json(Object value) {
        if (value == null) {
            return "{}";
        }
        if (value instanceof String text) {
            return text.isBlank() ? "{}" : text;
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("prescription_summary_encode_error", ex);
        }
    }

    private String sha256(String value) {
        return PrescriptionOrderEventHashChainVerifier.sha256(value);
    }

    private long number(Object value) {
        return ((Number) value).longValue();
    }

    private String text(Object value) {
        return value != null ? value.toString() : null;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String firstNonBlank(String first, String second) {
        String normalized = trimToNull(first);
        return normalized != null ? normalized : trimToNull(second);
    }

    record PrescriptionMutationResult(
            long orderId,
            long revisionId,
            String status,
            String contentHash,
            String patientId,
            String encounterId) {
    }

    record StructuredPrescriptionItemRow(
            int itemSequence,
            int rpSequence,
            String drugCode,
            String drugName,
            String standardName,
            String dosageForm,
            String usageCode,
            String usageName,
            String doseValue,
            String doseUnit,
            Integer days,
            String prescriptionLocation,
            String medicationRoute,
            boolean genericNamePrescription,
            String doctorComment,
            String unresolvedReason,
            String itemJson,
            String createdBy) {
    }
}
