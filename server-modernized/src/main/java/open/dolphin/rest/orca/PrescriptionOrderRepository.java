package open.dolphin.rest.orca;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
class PrescriptionOrderRepository {

    static final String PROJECTION_WRITE_DENIED = "orca_prescription_orders_projection_write_denied";

    @PersistenceContext
    private EntityManager entityManager;

    long save(String facilityId,
            String patientId,
            String encounterId,
            LocalDate encounterDate,
            LocalDate performDate,
            String payloadJson,
            Instant createdAt,
            String createdBy) {
        throw new IllegalStateException(PROJECTION_WRITE_DENIED);
    }

    Optional<StoredPrescriptionOrder> findLatest(String facilityId,
            String patientId,
            String encounterId,
            LocalDate encounterDate) {
        if (facilityId == null || facilityId.isBlank() || patientId == null || patientId.isBlank()) {
            return Optional.empty();
        }

        StringBuilder sql = new StringBuilder(
                "select id, cast(payload_json as text), encounter_id, encounter_date, perform_date, created_at "
                        + "from orca_prescription_orders where facility_id = ? and patient_id = ?");
        List<Object> params = new ArrayList<>();
        params.add(facilityId);
        params.add(patientId);
        if (encounterId != null && !encounterId.isBlank()) {
            sql.append(" and encounter_id = ?");
            params.add(encounterId.trim());
        }
        if (encounterDate != null) {
            sql.append(" and encounter_date = ?");
            params.add(Date.valueOf(encounterDate));
        }
        sql.append(" order by created_at desc, id desc limit 1");

        Query query = entityManager.createNativeQuery(sql.toString());
        for (int i = 0; i < params.size(); i++) {
            query.setParameter(i + 1, params.get(i));
        }
        List<?> rows = query.getResultList();
        if (rows == null || rows.isEmpty()) {
            return Optional.empty();
        }
        Object row0 = rows.get(0);
        if (!(row0 instanceof Object[] row) || row.length < 6) {
            return Optional.empty();
        }
        long id = row[0] != null ? ((Number) row[0]).longValue() : 0L;
        String payloadJson = row[1] != null ? row[1].toString() : null;
        String resolvedEncounterId = row[2] != null ? row[2].toString() : null;
        LocalDate resolvedEncounterDate = toLocalDate(row[3]);
        LocalDate resolvedPerformDate = toLocalDate(row[4]);
        Instant resolvedCreatedAt = toInstant(row[5]);
        return Optional.of(new StoredPrescriptionOrder(
                id,
                payloadJson,
                resolvedEncounterId,
                resolvedEncounterDate,
                resolvedPerformDate,
                resolvedCreatedAt));
    }

    private LocalDate toLocalDate(Object value) {
        if (value instanceof Date date) {
            return date.toLocalDate();
        }
        if (value instanceof Timestamp ts) {
            return ts.toLocalDateTime().toLocalDate();
        }
        return null;
    }

    private Instant toInstant(Object value) {
        if (value instanceof Timestamp ts) {
            return ts.toInstant();
        }
        if (value instanceof java.util.Date date) {
            return date.toInstant();
        }
        return null;
    }

    record StoredPrescriptionOrder(
            long id,
            String payloadJson,
            String encounterId,
            LocalDate encounterDate,
            LocalDate performDate,
            Instant createdAt) {
    }
}
