package open.dolphin.reconciliation;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import javax.sql.DataSource;

@ApplicationScoped
public class ReconciliationTaskRepository {

    private static final String SQL_INSERT = """
            INSERT INTO opendolphin.reconciliation_task (
                facility_id, subject_type, subject_key, reason_code, status, priority, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, cast(? as jsonb))
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public void openTask(String facilityId, String subjectType, String subjectKey, String reasonCode,
            String status, String priority, String payloadJson) {
        require(facilityId, "facilityId");
        require(subjectType, "subjectType");
        require(subjectKey, "subjectKey");
        require(reasonCode, "reasonCode");
        require(status, "status");
        require(priority, "priority");
        String effectivePayload = normalize(payloadJson);
        if (effectivePayload == null) {
            effectivePayload = "{}";
        }
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_INSERT)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, subjectType.trim());
            statement.setString(3, subjectKey.trim());
            statement.setString(4, reasonCode.trim());
            statement.setString(5, status.trim());
            statement.setString(6, priority.trim());
            statement.setString(7, effectivePayload);
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to open reconciliation task", ex);
        }
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for reconciliation task repository");
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
