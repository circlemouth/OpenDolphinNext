package open.dolphin.orca.sync;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import javax.sql.DataSource;

@ApplicationScoped
public class OrcaSyncCursorStore {

    private static final String SQL_SELECT = """
            SELECT cursor_type, cursor_value, last_applied_run_id, updated_at
              FROM opendolphin.d_orca_sync_cursor
             WHERE facility_id = ? AND stream_kind = ?
            """;

    private static final String SQL_UPSERT = """
            INSERT INTO opendolphin.d_orca_sync_cursor (
                facility_id, stream_kind, cursor_type, cursor_value, last_applied_run_id, updated_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (facility_id, stream_kind) DO UPDATE SET
                cursor_type = EXCLUDED.cursor_type,
                cursor_value = EXCLUDED.cursor_value,
                last_applied_run_id = EXCLUDED.last_applied_run_id,
                updated_at = CURRENT_TIMESTAMP
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public CursorRow load(String facilityId, String streamKind) {
        if (isBlank(facilityId) || isBlank(streamKind) || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, streamKind.trim());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return new CursorRow(
                        facilityId.trim(),
                        streamKind.trim(),
                        resultSet.getString(1),
                        resultSet.getString(2),
                        resultSet.getString(3),
                        resultSet.getTimestamp(4).toInstant());
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load ORCA sync cursor", ex);
        }
    }

    public void save(String facilityId, String streamKind, String cursorType, String cursorValue, String lastAppliedRunId) {
        requireText(facilityId, "facilityId");
        requireText(streamKind, "streamKind");
        requireText(cursorType, "cursorType");
        requireText(cursorValue, "cursorValue");
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPSERT)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, streamKind.trim());
            statement.setString(3, cursorType.trim());
            statement.setString(4, cursorValue.trim());
            statement.setString(5, normalize(lastAppliedRunId));
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to save ORCA sync cursor", ex);
        }
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for ORCA sync cursor store");
        }
        return dataSource;
    }

    private static String requireText(String value, String label) {
        String normalized = normalize(value);
        if (normalized == null) {
            throw new IllegalArgumentException(label + " is required");
        }
        return normalized;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record CursorRow(
            String facilityId,
            String streamKind,
            String cursorType,
            String cursorValue,
            String lastAppliedRunId,
            Instant updatedAt
    ) {
    }
}
