package open.dolphin.orca.push;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import javax.sql.DataSource;

@ApplicationScoped
public class OrcaPushSeenEventStore {

    private static final String SQL_INSERT = """
            INSERT INTO opendolphin.d_orca_push_seen_event (
                facility_id, event_uuid, event_name, event_time, expires_at
            ) VALUES (?, ?, ?, ?, ?)
            """;

    private static final String SQL_PURGE = """
            DELETE FROM opendolphin.d_orca_push_seen_event
             WHERE expires_at < CURRENT_TIMESTAMP
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public boolean markSeen(String facilityId, String eventUuid, String eventName, Instant eventTime, int retentionDays) {
        if (dataSource == null || facilityId == null || facilityId.isBlank()
                || eventUuid == null || eventUuid.isBlank()) {
            return false;
        }
        purgeExpired();
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_INSERT)) {
            statement.setString(1, facilityId);
            statement.setString(2, eventUuid);
            statement.setString(3, eventName);
            statement.setObject(4, eventTime != null ? OffsetDateTime.ofInstant(eventTime, java.time.ZoneOffset.UTC) : null);
            statement.setObject(5, OffsetDateTime.now().plusDays(Math.max(retentionDays, 1)));
            statement.executeUpdate();
            return true;
        } catch (SQLException ex) {
            if ("23505".equals(ex.getSQLState())) {
                return false;
            }
            throw new IllegalStateException("Failed to persist ORCA push dedup event", ex);
        }
    }

    public void purgeExpired() {
        if (dataSource == null) {
            return;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_PURGE)) {
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to purge ORCA push dedup events", ex);
        }
    }
}
