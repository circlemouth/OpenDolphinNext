package open.dolphin.rest.orca;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

@ApplicationScoped
class ChartEditSessionRepository {

    @PersistenceContext
    private EntityManager entityManager;

    EditSessionResult acquire(EditSessionCommand command) {
        Instant now = command.now();
        Instant expiresAt = now.plusSeconds(command.ttlSeconds());
        EditSessionRow current = loadForUpdate(command.facilityId(), command.patientId(), command.encounterScope());
        String leaseId = trimToNull(command.leaseId()) != null ? command.leaseId().trim() : UUID.randomUUID().toString();
        if (current == null) {
            entityManager.createNativeQuery("""
                            INSERT INTO opendolphin.chart_edit_session
                                (facility_id, patient_id, encounter_scope, lease_id, owner_user_id,
                                 owner_run_id, owner_tab_session_id, acquired_at, heartbeat_at, expires_at,
                                 created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """)
                    .setParameter(1, command.facilityId())
                    .setParameter(2, command.patientId())
                    .setParameter(3, command.encounterScope())
                    .setParameter(4, leaseId)
                    .setParameter(5, command.actorUserId())
                    .setParameter(6, trimToNull(command.ownerRunId()))
                    .setParameter(7, trimToNull(command.ownerTabSessionId()))
                    .setParameter(8, Timestamp.from(now))
                    .setParameter(9, Timestamp.from(now))
                    .setParameter(10, Timestamp.from(expiresAt))
                    .setParameter(11, Timestamp.from(now))
                    .setParameter(12, Timestamp.from(now))
                    .executeUpdate();
            return new EditSessionResult(true, "owned", command.patientId(), command.encounterScope(), leaseId,
                    trimToNull(command.ownerRunId()), trimToNull(command.ownerTabSessionId()), now, now, expiresAt,
                    false, null);
        }

        boolean active = current.releasedAt() == null && current.expiresAt().isAfter(now);
        boolean sameOwner = command.actorUserId().equals(current.ownerUserId())
                && trimToNull(command.ownerTabSessionId()) != null
                && trimToNull(command.ownerTabSessionId()).equals(current.ownerTabSessionId());
        if (active && !sameOwner && !command.forceTakeover()) {
            return new EditSessionResult(false, "other-editor", command.patientId(), command.encounterScope(),
                    current.leaseId(), current.ownerRunId(), current.ownerTabSessionId(), current.acquiredAt(),
                    current.heartbeatAt(), current.expiresAt(), false, "chart_edit_session_locked");
        }

        boolean staleTakeover = !sameOwner && (command.forceTakeover() || !active);
        entityManager.createNativeQuery("""
                        UPDATE opendolphin.chart_edit_session
                           SET lease_id = ?,
                               owner_user_id = ?,
                               owner_run_id = ?,
                               owner_tab_session_id = ?,
                               acquired_at = ?,
                               heartbeat_at = ?,
                               expires_at = ?,
                               released_at = NULL,
                               release_reason = NULL,
                               takeover_count = takeover_count + ?,
                               stale_takeover_at = CASE WHEN ? = 1 THEN ? ELSE stale_takeover_at END,
                               stale_takeover_by = CASE WHEN ? = 1 THEN ? ELSE stale_takeover_by END,
                               updated_at = ?
                         WHERE chart_edit_session_id = ?
                        """)
                .setParameter(1, leaseId)
                .setParameter(2, command.actorUserId())
                .setParameter(3, trimToNull(command.ownerRunId()))
                .setParameter(4, trimToNull(command.ownerTabSessionId()))
                .setParameter(5, Timestamp.from(sameOwner ? current.acquiredAt() : now))
                .setParameter(6, Timestamp.from(now))
                .setParameter(7, Timestamp.from(expiresAt))
                .setParameter(8, staleTakeover ? 1 : 0)
                .setParameter(9, staleTakeover ? 1 : 0)
                .setParameter(10, Timestamp.from(now))
                .setParameter(11, staleTakeover ? 1 : 0)
                .setParameter(12, command.actorUserId())
                .setParameter(13, Timestamp.from(now))
                .setParameter(14, current.id())
                .executeUpdate();
        return new EditSessionResult(true, "owned", command.patientId(), command.encounterScope(), leaseId,
                trimToNull(command.ownerRunId()), trimToNull(command.ownerTabSessionId()),
                sameOwner ? current.acquiredAt() : now, now, expiresAt, staleTakeover, null);
    }

    EditSessionResult heartbeat(EditSessionCommand command) {
        Instant now = command.now();
        Instant expiresAt = now.plusSeconds(command.ttlSeconds());
        EditSessionRow current = loadForUpdate(command.facilityId(), command.patientId(), command.encounterScope());
        String leaseId = trimToNull(command.leaseId());
        if (current == null || leaseId == null || !leaseId.equals(current.leaseId())
                || !command.actorUserId().equals(current.ownerUserId())) {
            return new EditSessionResult(false, "lost", command.patientId(), command.encounterScope(),
                    null, null, null, null, null, null, false, "chart_edit_session_lost");
        }
        if (current.releasedAt() != null || !current.expiresAt().isAfter(now)) {
            return new EditSessionResult(false, "expired", command.patientId(), command.encounterScope(),
                    current.leaseId(), current.ownerRunId(), current.ownerTabSessionId(), current.acquiredAt(),
                    current.heartbeatAt(), current.expiresAt(), false, "chart_edit_session_expired");
        }
        entityManager.createNativeQuery("""
                        UPDATE opendolphin.chart_edit_session
                           SET heartbeat_at = ?, expires_at = ?, updated_at = ?
                         WHERE chart_edit_session_id = ?
                        """)
                .setParameter(1, Timestamp.from(now))
                .setParameter(2, Timestamp.from(expiresAt))
                .setParameter(3, Timestamp.from(now))
                .setParameter(4, current.id())
                .executeUpdate();
        return new EditSessionResult(true, "owned", command.patientId(), command.encounterScope(), current.leaseId(),
                current.ownerRunId(), current.ownerTabSessionId(), current.acquiredAt(), now, expiresAt, false, null);
    }

    EditSessionResult release(EditSessionCommand command) {
        Instant now = command.now();
        EditSessionRow current = loadForUpdate(command.facilityId(), command.patientId(), command.encounterScope());
        String leaseId = trimToNull(command.leaseId());
        if (current == null || leaseId == null || !leaseId.equals(current.leaseId())
                || !command.actorUserId().equals(current.ownerUserId())) {
            return new EditSessionResult(false, "lost", command.patientId(), command.encounterScope(),
                    null, null, null, null, null, null, false, "chart_edit_session_lost");
        }
        entityManager.createNativeQuery("""
                        UPDATE opendolphin.chart_edit_session
                           SET released_at = ?, release_reason = ?, updated_at = ?
                         WHERE chart_edit_session_id = ?
                        """)
                .setParameter(1, Timestamp.from(now))
                .setParameter(2, "client_release")
                .setParameter(3, Timestamp.from(now))
                .setParameter(4, current.id())
                .executeUpdate();
        return new EditSessionResult(true, "released", command.patientId(), command.encounterScope(), current.leaseId(),
                current.ownerRunId(), current.ownerTabSessionId(), current.acquiredAt(), now, current.expiresAt(), false, null);
    }

    private EditSessionRow loadForUpdate(String facilityId, String patientId, String encounterScope) {
        try {
            Object row = entityManager.createNativeQuery("""
                            SELECT chart_edit_session_id, lease_id, owner_user_id, owner_run_id, owner_tab_session_id,
                                   acquired_at, heartbeat_at, expires_at, released_at
                              FROM opendolphin.chart_edit_session
                             WHERE facility_id = ?
                               AND patient_id = ?
                               AND encounter_scope = ?
                             FOR UPDATE
                            """)
                    .setParameter(1, facilityId)
                    .setParameter(2, patientId)
                    .setParameter(3, encounterScope)
                    .getSingleResult();
            Object[] values = (Object[]) row;
            return new EditSessionRow(
                    ((Number) values[0]).longValue(),
                    text(values[1]),
                    text(values[2]),
                    text(values[3]),
                    text(values[4]),
                    instant(values[5]),
                    instant(values[6]),
                    instant(values[7]),
                    instant(values[8]));
        } catch (NoResultException ex) {
            return null;
        }
    }

    private static String text(Object value) {
        return value != null ? value.toString() : null;
    }

    private static Instant instant(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant();
        }
        if (value instanceof java.time.OffsetDateTime offsetDateTime) {
            return offsetDateTime.toInstant();
        }
        if (value instanceof Instant instant) {
            return instant;
        }
        return Instant.parse(value.toString());
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    record EditSessionCommand(
            String facilityId,
            String patientId,
            String encounterScope,
            String actorUserId,
            String ownerRunId,
            String ownerTabSessionId,
            String leaseId,
            boolean forceTakeover,
            long ttlSeconds,
            Instant now) {
    }

    record EditSessionResult(
            boolean ok,
            String lockStatus,
            String patientId,
            String encounterScope,
            String leaseId,
            String ownerRunId,
            String ownerTabSessionId,
            Instant acquiredAt,
            Instant heartbeatAt,
            Instant expiresAt,
            boolean staleTakeover,
            String errorCode) {
    }

    private record EditSessionRow(
            long id,
            String leaseId,
            String ownerUserId,
            String ownerRunId,
            String ownerTabSessionId,
            Instant acquiredAt,
            Instant heartbeatAt,
            Instant expiresAt,
            Instant releasedAt) {
    }
}
