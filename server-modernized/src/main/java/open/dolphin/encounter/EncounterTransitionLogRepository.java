package open.dolphin.encounter;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import javax.sql.DataSource;

@ApplicationScoped
public class EncounterTransitionLogRepository {

    private static final String SQL_INSERT = """
            INSERT INTO opendolphin.encounter_transition_log (
                facility_id, encounter_key, operation, from_state, to_state,
                request_id, trace_id, idempotency_key, attempt_count, last_error, reconciliation_required
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (facility_id, encounter_key, idempotency_key) DO UPDATE SET
                operation = EXCLUDED.operation,
                from_state = EXCLUDED.from_state,
                to_state = EXCLUDED.to_state,
                request_id = EXCLUDED.request_id,
                trace_id = EXCLUDED.trace_id,
                attempt_count = opendolphin.encounter_transition_log.attempt_count + 1,
                last_error = EXCLUDED.last_error,
                reconciliation_required = EXCLUDED.reconciliation_required,
                updated_at = CURRENT_TIMESTAMP
            """;

    private static final String SQL_MARK_RECONCILIATION = """
            UPDATE opendolphin.encounter_transition_log
               SET reconciliation_required = TRUE,
                   last_error = ?,
                   updated_at = CURRENT_TIMESTAMP
             WHERE facility_id = ? AND encounter_key = ? AND idempotency_key = ?
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public void insertAttempt(String facilityId, String encounterKey, String operation, String fromState, String toState,
            String requestId, String traceId, String idempotencyKey, String lastError, boolean reconciliationRequired) {
        require(facilityId, "facilityId");
        require(encounterKey, "encounterKey");
        require(operation, "operation");
        require(requestId, "requestId");
        require(traceId, "traceId");
        require(idempotencyKey, "idempotencyKey");
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_INSERT)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, encounterKey.trim());
            statement.setString(3, operation.trim());
            statement.setString(4, normalize(fromState));
            statement.setString(5, normalize(toState));
            statement.setString(6, requestId.trim());
            statement.setString(7, traceId.trim());
            statement.setString(8, idempotencyKey.trim());
            statement.setInt(9, 1);
            statement.setString(10, normalize(lastError));
            statement.setBoolean(11, reconciliationRequired);
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to insert encounter transition attempt", ex);
        }
    }

    public void markReconciliationRequired(String facilityId, String encounterKey, String idempotencyKey, String lastError) {
        require(facilityId, "facilityId");
        require(encounterKey, "encounterKey");
        require(idempotencyKey, "idempotencyKey");
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_MARK_RECONCILIATION)) {
            statement.setString(1, normalize(lastError));
            statement.setString(2, facilityId.trim());
            statement.setString(3, encounterKey.trim());
            statement.setString(4, idempotencyKey.trim());
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to mark encounter reconciliation required", ex);
        }
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for encounter transition log repository");
        }
        return dataSource;
    }

    private static String require(String value, String label) {
        String normalized = normalize(value);
        if (normalized == null) {
            throw new IllegalArgumentException(label + " is required");
        }
        return normalized;
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
