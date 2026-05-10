package open.dolphin.security.audit;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import javax.sql.DataSource;

@ApplicationScoped
public class AuthoritativeAuditRepository {

    private static final short CHAIN_HEAD_KEY = 1;
    private static final String SQL_LOCK_CHAIN_HEAD = """
            SELECT head_event_id, head_hash
              FROM opendolphin.audit_chain_head
             WHERE singleton_key = ?
             FOR UPDATE
            """;
    private static final String SQL_INSERT_EVENT = """
            INSERT INTO opendolphin.audit_event (
                event_time, action, resource, actor_id, actor_role, facility_id,
                subject_type, subject_id, outcome, http_status, trace_id, request_id,
                ip_address, user_agent_hash, payload_json, payload_hash,
                previous_event_id, previous_hash, event_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), ?, ?, ?, ?)
            RETURNING event_id
            """;
    private static final String SQL_UPDATE_CHAIN_HEAD = """
            UPDATE opendolphin.audit_chain_head
               SET head_event_id = ?, head_hash = ?, updated_at = ?
             WHERE singleton_key = ?
            """;
    private static final String SQL_SELECT_EVENT = """
            SELECT event_id, event_time, action, resource, actor_id, actor_role, facility_id,
                   subject_type, subject_id, outcome, http_status, trace_id, request_id,
                   ip_address, user_agent_hash, payload_json::text, payload_hash,
                   previous_event_id, previous_hash, event_hash
              FROM opendolphin.audit_event
             WHERE event_id = ?
            """;
    private static final String SQL_SELECT_ALL_EVENTS = """
            SELECT event_id, event_time, action, resource, actor_id, actor_role, facility_id,
                   subject_type, subject_id, outcome, http_status, trace_id, request_id,
                   ip_address, user_agent_hash, payload_json::text, payload_hash,
                   previous_event_id, previous_hash, event_hash
              FROM opendolphin.audit_event
             ORDER BY event_id
            """;
    private static final String SQL_SELECT_CHAIN_HEAD = """
            SELECT head_event_id, head_hash
              FROM opendolphin.audit_chain_head
             WHERE singleton_key = ?
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    @Inject
    AuditHashService auditHashService;

    @Inject
    AuditOutboxRepository auditOutboxRepository;

    public AuditWriteResult append(AuditWriteCommand command) {
        Objects.requireNonNull(command, "command");
        Instant eventTime = command.eventTime() != null ? command.eventTime() : Instant.now();
        Map<String, Object> sanitizedPayload =
                AuditDetailSanitizer.sanitizeDetails(command.action(), command.payload());
        String payloadJson = hashService().canonicalizePayload(sanitizedPayload);
        String payloadHash = hashService().sha256Hex(payloadJson);
        String userAgentHash = hashOptional(command.userAgent());

        try (Connection connection = requireDataSource().getConnection()) {
            boolean manageLocalTransaction = connection.getAutoCommit();
            if (manageLocalTransaction) {
                connection.setAutoCommit(false);
            }
            try {
                ChainHead head = lockChainHead(connection);
                String eventHash = hashService().computeEventHash(new AuditHashService.EventHashInput(
                        eventTime.toString(),
                        requireText(command.action(), "action"),
                        requireText(command.resource(), "resource"),
                        normalizeOptional(command.actorId()),
                        normalizeOptional(command.facilityId()),
                        normalizeOptional(command.subjectType()),
                        normalizeOptional(command.subjectId()),
                        requireText(command.outcome(), "outcome"),
                        command.httpStatus() != null ? command.httpStatus().toString() : null,
                        normalizeOptional(command.traceId()),
                        normalizeOptional(command.requestId()),
                        payloadHash,
                        head.headEventId() != null ? head.headEventId().toString() : null,
                        normalizeOptional(head.headHash())));
                long eventId = insertEvent(connection, command, eventTime, payloadJson, payloadHash, userAgentHash, head, eventHash);
                updateChainHead(connection, eventId, eventHash, eventTime);
                outboxRepository().enqueue(connection, eventId, AuditOutboxRepository.DESTINATION_JMS_DOLPHIN);
                if (manageLocalTransaction) {
                    connection.commit();
                }
                return new AuditWriteResult(eventId, payloadHash, eventHash, head.headEventId(), head.headHash());
            } catch (Exception ex) {
                if (manageLocalTransaction) {
                    connection.rollback();
                }
                throw ex;
            } finally {
                if (manageLocalTransaction) {
                    connection.setAutoCommit(true);
                }
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to append authoritative audit event", ex);
        }
    }

    public boolean isWritePathAvailable() {
        try (Connection connection = requireDataSource().getConnection()) {
            boolean manageLocalTransaction = connection.getAutoCommit();
            if (manageLocalTransaction) {
                connection.setAutoCommit(false);
            }
            try {
                lockChainHead(connection);
                if (manageLocalTransaction) {
                    connection.rollback();
                }
                return true;
            } catch (Exception ex) {
                if (manageLocalTransaction) {
                    connection.rollback();
                }
                return false;
            } finally {
                if (manageLocalTransaction) {
                    connection.setAutoCommit(true);
                }
            }
        } catch (SQLException | RuntimeException ex) {
            return false;
        }
    }

    private ChainHead lockChainHead(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_LOCK_CHAIN_HEAD)) {
            statement.setShort(1, CHAIN_HEAD_KEY);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new IllegalStateException("audit_chain_head seed row is missing");
                }
                Long headEventId = resultSet.getObject(1) != null ? resultSet.getLong(1) : null;
                String headHash = resultSet.getString(2);
                return new ChainHead(headEventId, headHash);
            }
        }
    }

    private long insertEvent(Connection connection,
            AuditWriteCommand command,
            Instant eventTime,
            String payloadJson,
            String payloadHash,
            String userAgentHash,
            ChainHead head,
            String eventHash) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_INSERT_EVENT)) {
            statement.setTimestamp(1, Timestamp.from(eventTime));
            statement.setString(2, requireText(command.action(), "action"));
            statement.setString(3, requireText(command.resource(), "resource"));
            statement.setString(4, normalizeOptional(command.actorId()));
            statement.setString(5, normalizeOptional(command.actorRole()));
            statement.setString(6, normalizeOptional(command.facilityId()));
            statement.setString(7, normalizeOptional(command.subjectType()));
            statement.setString(8, normalizeOptional(command.subjectId()));
            statement.setString(9, requireText(command.outcome(), "outcome"));
            if (command.httpStatus() != null) {
                statement.setInt(10, command.httpStatus());
            } else {
                statement.setObject(10, null);
            }
            statement.setString(11, normalizeOptional(command.traceId()));
            statement.setString(12, normalizeOptional(command.requestId()));
            statement.setString(13, normalizeOptional(command.ipAddress()));
            statement.setString(14, userAgentHash);
            statement.setString(15, payloadJson);
            statement.setString(16, payloadHash);
            statement.setObject(17, head.headEventId());
            statement.setString(18, normalizeOptional(head.headHash()));
            statement.setString(19, eventHash);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new IllegalStateException("Failed to obtain audit event id");
                }
                return resultSet.getLong(1);
            }
        }
    }

    private void updateChainHead(Connection connection, long eventId, String eventHash, Instant updatedAt) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_UPDATE_CHAIN_HEAD)) {
            statement.setLong(1, eventId);
            statement.setString(2, eventHash);
            statement.setTimestamp(3, Timestamp.from(updatedAt));
            statement.setShort(4, CHAIN_HEAD_KEY);
            statement.executeUpdate();
        }
    }

    public EventRow loadEvent(long eventId) {
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_EVENT)) {
            statement.setLong(1, eventId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return mapEventRow(resultSet);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load authoritative audit event", ex);
        }
    }

    public List<EventRow> loadAllEvents() {
        List<EventRow> rows = new ArrayList<>();
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_ALL_EVENTS);
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                rows.add(mapEventRow(resultSet));
            }
            return rows;
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load authoritative audit events", ex);
        }
    }

    public ChainHeadView loadChainHead() {
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_CHAIN_HEAD)) {
            statement.setShort(1, CHAIN_HEAD_KEY);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new IllegalStateException("audit_chain_head seed row is missing");
                }
                Long headEventId = resultSet.getObject(1) != null ? resultSet.getLong(1) : null;
                return new ChainHeadView(headEventId, resultSet.getString(2));
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load authoritative audit chain head", ex);
        }
    }

    private EventRow mapEventRow(ResultSet resultSet) throws SQLException {
        return new EventRow(
                resultSet.getLong("event_id"),
                resultSet.getTimestamp("event_time").toInstant(),
                resultSet.getString("action"),
                resultSet.getString("resource"),
                resultSet.getString("actor_id"),
                resultSet.getString("actor_role"),
                resultSet.getString("facility_id"),
                resultSet.getString("subject_type"),
                resultSet.getString("subject_id"),
                resultSet.getString("outcome"),
                (Integer) resultSet.getObject("http_status"),
                resultSet.getString("trace_id"),
                resultSet.getString("request_id"),
                resultSet.getString("ip_address"),
                resultSet.getString("user_agent_hash"),
                resultSet.getString("payload_json"),
                resultSet.getString("payload_hash"),
                resultSet.getObject("previous_event_id") != null ? resultSet.getLong("previous_event_id") : null,
                resultSet.getString("previous_hash"),
                resultSet.getString("event_hash"));
    }

    private String hashOptional(String value) {
        String normalized = normalizeOptional(value);
        return normalized != null ? hashService().sha256Hex(normalized) : null;
    }

    private static String requireText(String value, String field) {
        String normalized = normalizeOptional(value);
        if (normalized == null) {
            throw new IllegalArgumentException(field + " is required");
        }
        return normalized;
    }

    private static String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for authoritative audit repository");
        }
        return dataSource;
    }

    private AuditHashService hashService() {
        return auditHashService != null ? auditHashService : new AuditHashService();
    }

    private AuditOutboxRepository outboxRepository() {
        return auditOutboxRepository != null ? auditOutboxRepository : new AuditOutboxRepository();
    }

    public record AuditWriteCommand(
            Instant eventTime,
            String action,
            String resource,
            String actorId,
            String actorRole,
            String facilityId,
            String subjectType,
            String subjectId,
            String outcome,
            Integer httpStatus,
            String traceId,
            String requestId,
            String ipAddress,
            String userAgent,
            Map<String, Object> payload) {

        public AuditWriteCommand {
            payload = immutablePayload(payload);
        }

        public Map<String, Object> payload() {
            return immutablePayload(payload);
        }

        private static Map<String, Object> immutablePayload(Map<String, Object> source) {
            if (source == null) {
                return null;
            }
            return Collections.unmodifiableMap(new LinkedHashMap<>(source));
        }
    }

    public record AuditWriteResult(
            long eventId,
            String payloadHash,
            String eventHash,
            Long previousEventId,
            String previousHash) {
    }

    public record EventRow(
            long eventId,
            Instant eventTime,
            String action,
            String resource,
            String actorId,
            String actorRole,
            String facilityId,
            String subjectType,
            String subjectId,
            String outcome,
            Integer httpStatus,
            String traceId,
            String requestId,
            String ipAddress,
            String userAgentHash,
            String payloadJson,
            String payloadHash,
            Long previousEventId,
            String previousHash,
            String eventHash) {
    }

    public record ChainHeadView(Long headEventId, String headHash) {
    }

    private record ChainHead(Long headEventId, String headHash) {
    }
}
