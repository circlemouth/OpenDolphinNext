package open.dolphin.orca.sync;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.concurrent.locks.ReentrantLock;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.sql.DataSource;

/**
 * Persists ORCA patient sync cursor into the application database.
 */
@ApplicationScoped
public class OrcaPatientSyncStateStore {

    private static final Logger LOGGER = Logger.getLogger(OrcaPatientSyncStateStore.class.getName());
    private static final String TABLE_NAME = "d_orca_patient_sync_state";
    private static final String TABLE_REFERENCE = "opendolphin." + TABLE_NAME;

    private static final String SQL_SELECT = """
            SELECT last_sync_date, last_synced_at, last_run_id, last_error
              FROM opendolphin.d_orca_patient_sync_state
             WHERE facility_id = ?
            """;

    private static final String SQL_UPSERT_SUCCESS = """
            INSERT INTO opendolphin.d_orca_patient_sync_state (
                facility_id, last_sync_date, last_synced_at, last_run_id, last_error, updated_at
            ) VALUES (?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)
            ON CONFLICT (facility_id) DO UPDATE SET
                last_sync_date = EXCLUDED.last_sync_date,
                last_synced_at = EXCLUDED.last_synced_at,
                last_run_id = EXCLUDED.last_run_id,
                last_error = NULL,
                updated_at = CURRENT_TIMESTAMP
            """;

    private static final String SQL_UPSERT_FAILURE = """
            INSERT INTO opendolphin.d_orca_patient_sync_state (
                facility_id, last_synced_at, last_run_id, last_error, updated_at
            ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (facility_id) DO UPDATE SET
                last_synced_at = EXCLUDED.last_synced_at,
                last_run_id = EXCLUDED.last_run_id,
                last_error = EXCLUDED.last_error,
                updated_at = CURRENT_TIMESTAMP
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    private DataSource dataSource;

    private final ReentrantLock lock = new ReentrantLock();

    public String resolveStorageDescriptor() {
        return "db:" + TABLE_REFERENCE;
    }

    public FacilityState loadFacilityState(String facilityId) {
        String normalizedFacilityId = normalizeFacilityId(facilityId);
        if (normalizedFacilityId == null) {
            return null;
        }
        lock.lock();
        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT)) {
            statement.setString(1, normalizedFacilityId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                FacilityState state = new FacilityState();
                Date lastSyncDate = resultSet.getDate(1);
                state.lastSyncDate = lastSyncDate != null ? lastSyncDate.toLocalDate().toString() : null;
                state.lastSyncedAt = timestampToIso(resultSet.getTimestamp(2));
                state.lastRunId = resultSet.getString(3);
                state.lastError = resultSet.getString(4);
                return state;
            }
        } catch (SQLException ex) {
            LOGGER.log(Level.WARNING,
                    "Failed to load ORCA patient sync state. facilityId={0} err={1}",
                    new Object[]{normalizedFacilityId, ex.getMessage()});
            return null;
        } finally {
            lock.unlock();
        }
    }

    public void markSuccess(String facilityId, LocalDate endDate, String runId) {
        String normalizedFacilityId = normalizeFacilityId(facilityId);
        if (normalizedFacilityId == null || endDate == null) {
            return;
        }
        lock.lock();
        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPSERT_SUCCESS)) {
            statement.setString(1, normalizedFacilityId);
            statement.setDate(2, Date.valueOf(endDate));
            statement.setObject(3, OffsetDateTime.now());
            statement.setString(4, runId);
            statement.executeUpdate();
        } catch (SQLException ex) {
            LOGGER.log(Level.WARNING,
                    "Failed to persist ORCA patient sync success state. facilityId={0} err={1}",
                    new Object[]{normalizedFacilityId, ex.getMessage()});
        } finally {
            lock.unlock();
        }
    }

    public void markFailure(String facilityId, String error, String runId) {
        String normalizedFacilityId = normalizeFacilityId(facilityId);
        if (normalizedFacilityId == null) {
            return;
        }
        lock.lock();
        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPSERT_FAILURE)) {
            statement.setString(1, normalizedFacilityId);
            statement.setObject(2, OffsetDateTime.now());
            statement.setString(3, runId);
            statement.setString(4, error);
            statement.executeUpdate();
        } catch (SQLException ex) {
            LOGGER.log(Level.WARNING,
                    "Failed to persist ORCA patient sync failure state. facilityId={0} err={1}",
                    new Object[]{normalizedFacilityId, ex.getMessage()});
        } finally {
            lock.unlock();
        }
    }

    private Connection getConnection() throws SQLException {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for ORCA patient sync state store");
        }
        return dataSource.getConnection();
    }

    private static String normalizeFacilityId(String facilityId) {
        if (facilityId == null) {
            return null;
        }
        String normalized = facilityId.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String timestampToIso(Timestamp timestamp) {
        if (timestamp == null) {
            return null;
        }
        Instant instant = timestamp.toInstant();
        return instant.toString();
    }

    public static class FacilityState {
        public String lastSyncDate;
        public String lastSyncedAt;
        public String lastRunId;
        public String lastError;
    }
}
