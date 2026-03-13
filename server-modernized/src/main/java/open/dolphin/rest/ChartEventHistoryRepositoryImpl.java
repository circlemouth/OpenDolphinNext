package open.dolphin.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalLong;
import open.dolphin.infomodel.ChartEventModel;

@ApplicationScoped
public class ChartEventHistoryRepositoryImpl implements ChartEventHistoryRepository {

    @PersistenceContext
    private EntityManager em;

    @Override
    public long nextEventId() {
        Number value = (Number) em.createNativeQuery("select nextval('chart_event_seq')").getSingleResult();
        return value.longValue();
    }

    @Override
    public void save(long eventId, ChartEventModel event, String payloadJson, Instant createdAt) {
        em.createNativeQuery(
                        "insert into chart_event_history (event_id, facility_id, issuer_uuid, event_type, payload_json, created_at) "
                                + "values (?, ?, ?, ?, ?, ?)")
                .setParameter(1, eventId)
                .setParameter(2, event != null ? event.getFacilityId() : null)
                .setParameter(3, event != null ? event.getIssuerUUID() : null)
                .setParameter(4, event != null ? event.getEventType() : null)
                .setParameter(5, payloadJson)
                .setParameter(6, Timestamp.from(createdAt))
                .executeUpdate();
    }

    @Override
    public List<ChartEventHistoryRecord> fetchAfter(String facilityId, long lastEventId, int limit) {
        List<Object[]> rows = em.createNativeQuery(
                        "select event_id, issuer_uuid, payload_json "
                                + "from chart_event_history "
                                + "where facility_id = ? and event_id > ? "
                                + "order by event_id asc")
                .setParameter(1, facilityId)
                .setParameter(2, lastEventId)
                .setMaxResults(limit)
                .getResultList();

        List<ChartEventHistoryRecord> results = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            long eventId = ((Number) row[0]).longValue();
            String issuerUuid = row[1] != null ? row[1].toString() : null;
            String payloadJson = row[2] != null ? row[2].toString() : null;
            results.add(new ChartEventHistoryRecord(eventId, issuerUuid, payloadJson));
        }
        return results;
    }

    @Override
    public OptionalLong findOldestEventId(String facilityId) {
        Object result = em.createNativeQuery(
                        "select min(event_id) from chart_event_history where facility_id = ?")
                .setParameter(1, facilityId)
                .getSingleResult();
        if (result == null) {
            return OptionalLong.empty();
        }
        long value = ((Number) result).longValue();
        return value > 0 ? OptionalLong.of(value) : OptionalLong.empty();
    }

    @Override
    public OptionalLong findLatestEventId() {
        List<?> results = em.createNativeQuery("select event_id from chart_event_history order by event_id desc")
                .setMaxResults(1)
                .getResultList();
        if (results.isEmpty() || results.get(0) == null) {
            return OptionalLong.empty();
        }
        long value = ((Number) results.get(0)).longValue();
        return value > 0 ? OptionalLong.of(value) : OptionalLong.empty();
    }

    @Override
    public void purge(String facilityId, int retentionCount, Duration retentionDuration, Instant now) {
        if (facilityId == null || facilityId.isBlank()) {
            return;
        }

        if (retentionDuration != null && !retentionDuration.isZero() && !retentionDuration.isNegative()) {
            Instant threshold = now.minus(retentionDuration);
            em.createNativeQuery("delete from chart_event_history where facility_id = ? and created_at < ?")
                    .setParameter(1, facilityId)
                    .setParameter(2, Timestamp.from(threshold))
                    .executeUpdate();
        }

        if (retentionCount > 0) {
            Long thresholdEventId = findEventIdThreshold(facilityId, retentionCount);
            if (thresholdEventId != null) {
                em.createNativeQuery(
                                "delete from chart_event_history where facility_id = ? and event_id < ?")
                        .setParameter(1, facilityId)
                        .setParameter(2, thresholdEventId)
                        .executeUpdate();
            }
        }
    }

    @Override
    public void purgeAll(int retentionCount, Duration retentionDuration, Instant now) {
        if (retentionDuration != null && !retentionDuration.isZero() && !retentionDuration.isNegative()) {
            Instant threshold = now.minus(retentionDuration);
            em.createNativeQuery("delete from chart_event_history where created_at < ?")
                    .setParameter(1, Timestamp.from(threshold))
                    .executeUpdate();
        }

        if (retentionCount > 0) {
            em.createNativeQuery(
                            "delete from chart_event_history where event_id in ("
                                    + "select event_id from ("
                                    + "select event_id, row_number() over (partition by facility_id order by event_id desc) as rn "
                                    + "from chart_event_history"
                                    + ") ranked where rn > ?)")
                    .setParameter(1, retentionCount)
                    .executeUpdate();
        }
    }

    private Long findEventIdThreshold(String facilityId, int retentionCount) {
        List<?> results = em.createNativeQuery(
                        "select event_id from chart_event_history "
                                + "where facility_id = ? order by event_id desc")
                .setParameter(1, facilityId)
                .setFirstResult(Math.max(retentionCount - 1, 0))
                .setMaxResults(1)
                .getResultList();
        if (results.isEmpty()) {
            return null;
        }
        Object value = results.get(0);
        if (value == null) {
            return null;
        }
        return ((Number) value).longValue();
    }
}
