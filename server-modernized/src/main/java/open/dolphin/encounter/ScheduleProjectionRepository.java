package open.dolphin.encounter;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import javax.sql.DataSource;

@ApplicationScoped
public class ScheduleProjectionRepository {

    private static final String SQL_UPSERT = """
            INSERT INTO opendolphin.schedule_projection (
                schedule_key, facility_id, patient_id, karte_id, orca_appointment_id, scheduled_datetime,
                department_code, physician_code, state, linked_encounter_key, source_updated_at, projected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (schedule_key) DO UPDATE SET
                facility_id = EXCLUDED.facility_id,
                patient_id = EXCLUDED.patient_id,
                karte_id = EXCLUDED.karte_id,
                orca_appointment_id = EXCLUDED.orca_appointment_id,
                scheduled_datetime = EXCLUDED.scheduled_datetime,
                department_code = EXCLUDED.department_code,
                physician_code = EXCLUDED.physician_code,
                state = EXCLUDED.state,
                linked_encounter_key = EXCLUDED.linked_encounter_key,
                source_updated_at = EXCLUDED.source_updated_at,
                projected_at = EXCLUDED.projected_at
            """;

    private static final String SQL_LINK_ENCOUNTER = """
            UPDATE opendolphin.schedule_projection
               SET linked_encounter_key = ?,
                   projected_at = ?
             WHERE schedule_key = ?
            """;

    private static final String SQL_SELECT = """
            SELECT schedule_key, facility_id, patient_id, karte_id, orca_appointment_id, scheduled_datetime,
                   department_code, physician_code, state, linked_encounter_key, source_updated_at, projected_at
              FROM opendolphin.schedule_projection
             WHERE schedule_key = ?
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public void upsertFromOrca(ScheduleUpsertCommand command) {
        require(command.scheduleKey(), "scheduleKey");
        require(command.facilityId(), "facilityId");
        require(command.patientId(), "patientId");
        require(command.orcaAppointmentId(), "orcaAppointmentId");
        if (command.scheduledDatetime() == null) {
            throw new IllegalArgumentException("scheduledDatetime is required");
        }
        if (command.projectedAt() == null) {
            throw new IllegalArgumentException("projectedAt is required");
        }
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPSERT)) {
            statement.setString(1, command.scheduleKey().trim());
            statement.setString(2, command.facilityId().trim());
            statement.setString(3, command.patientId().trim());
            statement.setObject(4, command.karteId());
            statement.setString(5, command.orcaAppointmentId().trim());
            statement.setTimestamp(6, Timestamp.from(command.scheduledDatetime()));
            statement.setString(7, normalize(command.departmentCode()));
            statement.setString(8, normalize(command.physicianCode()));
            statement.setString(9, require(command.state(), "state"));
            statement.setString(10, normalize(command.linkedEncounterKey()));
            statement.setObject(11, command.sourceUpdatedAt() != null ? Timestamp.from(command.sourceUpdatedAt()) : null);
            statement.setTimestamp(12, Timestamp.from(command.projectedAt()));
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to upsert schedule projection", ex);
        }
    }

    public void linkEncounter(String scheduleKey, String encounterKey, Instant projectedAt) {
        require(scheduleKey, "scheduleKey");
        require(encounterKey, "encounterKey");
        if (projectedAt == null) {
            throw new IllegalArgumentException("projectedAt is required");
        }
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_LINK_ENCOUNTER)) {
            statement.setString(1, encounterKey.trim());
            statement.setTimestamp(2, Timestamp.from(projectedAt));
            statement.setString(3, scheduleKey.trim());
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to link encounter to schedule projection", ex);
        }
    }

    public ScheduleRow findByScheduleKey(String scheduleKey) {
        if (normalize(scheduleKey) == null || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT)) {
            statement.setString(1, scheduleKey.trim());
            try (var resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return new ScheduleRow(
                        resultSet.getString(1),
                        resultSet.getString(2),
                        resultSet.getString(3),
                        (Long) resultSet.getObject(4),
                        resultSet.getString(5),
                        resultSet.getTimestamp(6).toInstant(),
                        resultSet.getString(7),
                        resultSet.getString(8),
                        resultSet.getString(9),
                        resultSet.getString(10),
                        resultSet.getTimestamp(11) != null ? resultSet.getTimestamp(11).toInstant() : null,
                        resultSet.getTimestamp(12).toInstant());
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load schedule projection", ex);
        }
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for schedule projection repository");
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

    public record ScheduleUpsertCommand(
            String scheduleKey,
            String facilityId,
            String patientId,
            Long karteId,
            String orcaAppointmentId,
            Instant scheduledDatetime,
            String departmentCode,
            String physicianCode,
            String state,
            String linkedEncounterKey,
            Instant sourceUpdatedAt,
            Instant projectedAt
    ) {
    }

    public record ScheduleRow(
            String scheduleKey,
            String facilityId,
            String patientId,
            Long karteId,
            String orcaAppointmentId,
            Instant scheduledDatetime,
            String departmentCode,
            String physicianCode,
            String state,
            String linkedEncounterKey,
            Instant sourceUpdatedAt,
            Instant projectedAt
    ) {
    }
}
