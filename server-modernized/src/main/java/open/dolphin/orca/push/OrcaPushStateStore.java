package open.dolphin.orca.push;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;

@ApplicationScoped
public class OrcaPushStateStore {

    public static final String STATUS_DISCONNECTED = "DISCONNECTED";
    public static final String STATUS_CONNECTING = "CONNECTING";
    public static final String STATUS_CONNECTED = "CONNECTED";
    public static final String STATUS_DEGRADED = "DEGRADED";

    private static final String SQL_UPSERT = """
            INSERT INTO opendolphin.d_orca_push_state (
                facility_id, connection_status, websocket_url, last_connected_at, last_disconnected_at,
                last_event_at, last_event_uuid, last_event_name, last_recovery_started_at,
                last_recovery_finished_at, last_recovery_window_start, last_recovery_window_end,
                last_error, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (facility_id) DO UPDATE SET
                connection_status = EXCLUDED.connection_status,
                websocket_url = EXCLUDED.websocket_url,
                last_connected_at = COALESCE(EXCLUDED.last_connected_at, opendolphin.d_orca_push_state.last_connected_at),
                last_disconnected_at = COALESCE(EXCLUDED.last_disconnected_at, opendolphin.d_orca_push_state.last_disconnected_at),
                last_event_at = COALESCE(EXCLUDED.last_event_at, opendolphin.d_orca_push_state.last_event_at),
                last_event_uuid = COALESCE(EXCLUDED.last_event_uuid, opendolphin.d_orca_push_state.last_event_uuid),
                last_event_name = COALESCE(EXCLUDED.last_event_name, opendolphin.d_orca_push_state.last_event_name),
                last_recovery_started_at = COALESCE(EXCLUDED.last_recovery_started_at, opendolphin.d_orca_push_state.last_recovery_started_at),
                last_recovery_finished_at = COALESCE(EXCLUDED.last_recovery_finished_at, opendolphin.d_orca_push_state.last_recovery_finished_at),
                last_recovery_window_start = COALESCE(EXCLUDED.last_recovery_window_start, opendolphin.d_orca_push_state.last_recovery_window_start),
                last_recovery_window_end = COALESCE(EXCLUDED.last_recovery_window_end, opendolphin.d_orca_push_state.last_recovery_window_end),
                last_error = EXCLUDED.last_error,
                updated_at = CURRENT_TIMESTAMP
            """;

    private static final String SQL_SELECT_ALL = """
            SELECT facility_id, connection_status, websocket_url, last_connected_at, last_disconnected_at,
                   last_event_at, last_event_uuid, last_event_name, last_recovery_started_at,
                   last_recovery_finished_at, last_recovery_window_start, last_recovery_window_end, last_error
              FROM opendolphin.d_orca_push_state
             ORDER BY facility_id
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public void markConnecting(String facilityId, String websocketUrl) {
        upsert(facilityId, STATUS_CONNECTING, websocketUrl, null, null, null, null, null, null, null, null, null, null);
    }

    public void markConnected(String facilityId, String websocketUrl) {
        OffsetDateTime now = OffsetDateTime.now();
        upsert(facilityId, STATUS_CONNECTED, websocketUrl, now, null, null, null, null, null, null, null, null, null);
    }

    public void markDisconnected(String facilityId, String websocketUrl, String error) {
        OffsetDateTime now = OffsetDateTime.now();
        upsert(facilityId, STATUS_DISCONNECTED, websocketUrl, null, now, null, null, null, null, null, null, null, error);
    }

    public void markDegraded(String facilityId, String websocketUrl, String error) {
        upsert(facilityId, STATUS_DEGRADED, websocketUrl, null, null, null, null, null, null, null, null, null, error);
    }

    public void markEvent(String facilityId, String websocketUrl, String eventUuid, String eventName, Instant eventTime) {
        upsert(facilityId, null, websocketUrl, null, null,
                eventTime != null ? OffsetDateTime.ofInstant(eventTime, java.time.ZoneOffset.UTC) : OffsetDateTime.now(),
                eventUuid, eventName, null, null, null, null, null);
    }

    public void markRecoveryStarted(String facilityId, Instant windowStart, Instant windowEnd) {
        upsert(facilityId, null, null, null, null, null, null, null,
                OffsetDateTime.now(),
                null,
                toOffset(windowStart),
                toOffset(windowEnd),
                null);
    }

    public void markRecoveryFinished(String facilityId, Instant windowStart, Instant windowEnd, String error) {
        upsert(facilityId, error == null ? STATUS_CONNECTED : STATUS_DEGRADED, null, null, null, null, null, null,
                null,
                OffsetDateTime.now(),
                toOffset(windowStart),
                toOffset(windowEnd),
                error);
    }

    public List<FacilityPushState> listStates() {
        if (dataSource == null) {
            return List.of();
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_ALL);
             ResultSet resultSet = statement.executeQuery()) {
            List<FacilityPushState> result = new ArrayList<>();
            while (resultSet.next()) {
                result.add(new FacilityPushState(
                        resultSet.getString(1),
                        resultSet.getString(2),
                        resultSet.getString(3),
                        toInstantString(resultSet.getTimestamp(4)),
                        toInstantString(resultSet.getTimestamp(5)),
                        toInstantString(resultSet.getTimestamp(6)),
                        resultSet.getString(7),
                        resultSet.getString(8),
                        toInstantString(resultSet.getTimestamp(9)),
                        toInstantString(resultSet.getTimestamp(10)),
                        toInstantString(resultSet.getTimestamp(11)),
                        toInstantString(resultSet.getTimestamp(12)),
                        resultSet.getString(13)));
            }
            return List.copyOf(result);
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load ORCA push state", ex);
        }
    }

    private void upsert(String facilityId,
            String status,
            String websocketUrl,
            OffsetDateTime lastConnectedAt,
            OffsetDateTime lastDisconnectedAt,
            OffsetDateTime lastEventAt,
            String lastEventUuid,
            String lastEventName,
            OffsetDateTime recoveryStartedAt,
            OffsetDateTime recoveryFinishedAt,
            OffsetDateTime recoveryWindowStart,
            OffsetDateTime recoveryWindowEnd,
            String lastError) {
        if (dataSource == null || facilityId == null || facilityId.isBlank()) {
            return;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPSERT)) {
            statement.setString(1, facilityId);
            statement.setString(2, status != null ? status : STATUS_CONNECTED);
            statement.setString(3, websocketUrl);
            statement.setObject(4, lastConnectedAt);
            statement.setObject(5, lastDisconnectedAt);
            statement.setObject(6, lastEventAt);
            statement.setString(7, lastEventUuid);
            statement.setString(8, lastEventName);
            statement.setObject(9, recoveryStartedAt);
            statement.setObject(10, recoveryFinishedAt);
            statement.setObject(11, recoveryWindowStart);
            statement.setObject(12, recoveryWindowEnd);
            statement.setString(13, lastError);
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to persist ORCA push state", ex);
        }
    }

    private static OffsetDateTime toOffset(Instant instant) {
        return instant != null ? OffsetDateTime.ofInstant(instant, java.time.ZoneOffset.UTC) : null;
    }

    private static String toInstantString(Timestamp timestamp) {
        return timestamp != null ? timestamp.toInstant().toString() : null;
    }

    public record FacilityPushState(
            String facilityId,
            String connectionStatus,
            String websocketUrl,
            String lastConnectedAt,
            String lastDisconnectedAt,
            String lastEventAt,
            String lastEventUuid,
            String lastEventName,
            String lastRecoveryStartedAt,
            String lastRecoveryFinishedAt,
            String lastRecoveryWindowStart,
            String lastRecoveryWindowEnd,
            String lastError) {
    }
}
