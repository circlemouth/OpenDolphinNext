package open.dolphin.orca.push;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;

@ApplicationScoped
public class OrcaPushConnectionStateStore {
    public static final String STATUS_DISCONNECTED = "DISCONNECTED";
    public static final String STATUS_CONNECTING = "CONNECTING";
    public static final String STATUS_CONNECTED = "CONNECTED";
    public static final String STATUS_DEGRADED = "DEGRADED";

    private static final String SQL_UPSERT = """
            INSERT INTO opendolphin.d_orca_push_connection_state (
                facility_id, stream_kind, connection_status, websocket_url,
                last_connected_at, last_disconnected_at, last_error, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (facility_id, stream_kind) DO UPDATE SET
                connection_status = EXCLUDED.connection_status,
                websocket_url = EXCLUDED.websocket_url,
                last_connected_at = EXCLUDED.last_connected_at,
                last_disconnected_at = EXCLUDED.last_disconnected_at,
                last_error = EXCLUDED.last_error,
                updated_at = CURRENT_TIMESTAMP
            """;

    private static final String SQL_SELECT_ALL = """
            SELECT facility_id, stream_kind, connection_status, websocket_url,
                   last_connected_at, last_disconnected_at, last_error
              FROM opendolphin.d_orca_push_connection_state
             ORDER BY facility_id, stream_kind
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public void markConnecting(String facilityId, String streamKind, String websocketUrl) {
        upsertConnectionState(facilityId, streamKind, STATUS_CONNECTING, websocketUrl, null, null, null);
    }

    public void markConnected(String facilityId, String streamKind, String websocketUrl) {
        upsertConnectionState(facilityId, streamKind, STATUS_CONNECTED, websocketUrl, Instant.now(), null, null);
    }

    public void markDisconnected(String facilityId, String streamKind, String websocketUrl, String error) {
        upsertConnectionState(facilityId, streamKind, STATUS_DISCONNECTED, websocketUrl, null, Instant.now(), error);
    }

    public void markDegraded(String facilityId, String streamKind, String websocketUrl, String error) {
        upsertConnectionState(facilityId, streamKind, STATUS_DEGRADED, websocketUrl, null, null, error);
    }

    public void upsertConnectionState(String facilityId, String streamKind, String connectionStatus, String websocketUrl,
            Instant lastConnectedAt, Instant lastDisconnectedAt, String lastError) {
        requireText(facilityId, "facilityId");
        requireText(streamKind, "streamKind");
        requireText(connectionStatus, "connectionStatus");
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPSERT)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, streamKind.trim());
            statement.setString(3, connectionStatus.trim());
            statement.setString(4, normalize(websocketUrl));
            statement.setObject(5, lastConnectedAt != null ? Timestamp.from(lastConnectedAt) : null);
            statement.setObject(6, lastDisconnectedAt != null ? Timestamp.from(lastDisconnectedAt) : null);
            statement.setString(7, normalize(lastError));
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to upsert ORCA push connection state", ex);
        }
    }

    public List<FacilityPushConnectionState> listStates() {
        if (dataSource == null) {
            return List.of();
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_ALL);
             ResultSet resultSet = statement.executeQuery()) {
            List<FacilityPushConnectionState> states = new ArrayList<>();
            while (resultSet.next()) {
                states.add(new FacilityPushConnectionState(
                        resultSet.getString(1),
                        resultSet.getString(2),
                        resultSet.getString(3),
                        resultSet.getString(4),
                        toInstantString(resultSet.getTimestamp(5)),
                        toInstantString(resultSet.getTimestamp(6)),
                        resultSet.getString(7)));
            }
            return List.copyOf(states);
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load ORCA push connection state", ex);
        }
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for ORCA push connection state store");
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

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String toInstantString(Timestamp timestamp) {
        return timestamp != null ? timestamp.toInstant().toString() : null;
    }

    public record FacilityPushConnectionState(
            String facilityId,
            String streamKind,
            String connectionStatus,
            String websocketUrl,
            String lastConnectedAt,
            String lastDisconnectedAt,
            String lastError
    ) {
    }
}
