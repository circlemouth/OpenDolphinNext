package open.dolphin.encounter;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import javax.sql.DataSource;

@ApplicationScoped
public class EncounterProjectionRepository {

    private static final String SQL_UPSERT_CHECKED_IN = """
            INSERT INTO opendolphin.encounter_projection (
                encounter_key, facility_id, patient_id, karte_id, schedule_key, orca_acceptance_id,
                acceptance_datetime, business_state, chart_opened_at, billed_at, cancelled_at,
                owner_user_id, memo, worklist_flags, last_orca_sync_at, state_version, projected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), ?, ?, ?)
            ON CONFLICT (encounter_key) DO UPDATE SET
                facility_id = EXCLUDED.facility_id,
                patient_id = EXCLUDED.patient_id,
                karte_id = EXCLUDED.karte_id,
                schedule_key = EXCLUDED.schedule_key,
                orca_acceptance_id = EXCLUDED.orca_acceptance_id,
                acceptance_datetime = EXCLUDED.acceptance_datetime,
                business_state = EXCLUDED.business_state,
                chart_opened_at = EXCLUDED.chart_opened_at,
                billed_at = EXCLUDED.billed_at,
                cancelled_at = EXCLUDED.cancelled_at,
                owner_user_id = EXCLUDED.owner_user_id,
                memo = EXCLUDED.memo,
                worklist_flags = EXCLUDED.worklist_flags,
                last_orca_sync_at = EXCLUDED.last_orca_sync_at,
                state_version = EXCLUDED.state_version,
                projected_at = EXCLUDED.projected_at
            """;

    private static final String SQL_TRANSITION = """
            UPDATE opendolphin.encounter_projection
               SET business_state = ?,
                   chart_opened_at = COALESCE(?, chart_opened_at),
                   billed_at = COALESCE(?, billed_at),
                   cancelled_at = COALESCE(?, cancelled_at),
                   owner_user_id = COALESCE(?, owner_user_id),
                   memo = COALESCE(?, memo),
                   worklist_flags = cast(? as jsonb),
                   last_orca_sync_at = COALESCE(?, last_orca_sync_at),
                   state_version = state_version + 1,
                   projected_at = ?
             WHERE encounter_key = ?
            """;

    private static final String SQL_SELECT = """
            SELECT encounter_key, facility_id, patient_id, karte_id, schedule_key, orca_acceptance_id,
                   acceptance_datetime, business_state, chart_opened_at, billed_at, cancelled_at,
                   owner_user_id, memo, worklist_flags::text, last_orca_sync_at, state_version, projected_at
              FROM opendolphin.encounter_projection
             WHERE encounter_key = ?
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public void upsertCheckedIn(EncounterUpsertCommand command) {
        require(command.encounterKey(), "encounterKey");
        require(command.facilityId(), "facilityId");
        require(command.patientId(), "patientId");
        require(command.orcaAcceptanceId(), "orcaAcceptanceId");
        require(command.businessState(), "businessState");
        if (command.acceptanceDatetime() == null || command.projectedAt() == null) {
            throw new IllegalArgumentException("acceptanceDatetime/projectedAt is required");
        }
        String worklistFlags = normalize(command.worklistFlagsJson());
        if (worklistFlags == null) {
            worklistFlags = "{}";
        }
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPSERT_CHECKED_IN)) {
            statement.setString(1, command.encounterKey().trim());
            statement.setString(2, command.facilityId().trim());
            statement.setString(3, command.patientId().trim());
            statement.setObject(4, command.karteId());
            statement.setString(5, normalize(command.scheduleKey()));
            statement.setString(6, command.orcaAcceptanceId().trim());
            statement.setTimestamp(7, Timestamp.from(command.acceptanceDatetime()));
            statement.setString(8, command.businessState().trim());
            statement.setObject(9, toTimestamp(command.chartOpenedAt()));
            statement.setObject(10, toTimestamp(command.billedAt()));
            statement.setObject(11, toTimestamp(command.cancelledAt()));
            statement.setString(12, normalize(command.ownerUserId()));
            statement.setString(13, normalize(command.memo()));
            statement.setString(14, worklistFlags);
            statement.setObject(15, toTimestamp(command.lastOrcaSyncAt()));
            statement.setLong(16, command.stateVersion());
            statement.setTimestamp(17, Timestamp.from(command.projectedAt()));
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to upsert encounter projection", ex);
        }
    }

    public void transitionState(String encounterKey, String businessState, Instant chartOpenedAt, Instant billedAt, Instant cancelledAt,
            String ownerUserId, String memo, String worklistFlagsJson, Instant lastOrcaSyncAt, Instant projectedAt) {
        require(encounterKey, "encounterKey");
        require(businessState, "businessState");
        if (projectedAt == null) {
            throw new IllegalArgumentException("projectedAt is required");
        }
        String effectiveFlags = normalize(worklistFlagsJson);
        if (effectiveFlags == null) {
            effectiveFlags = "{}";
        }
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_TRANSITION)) {
            statement.setString(1, businessState.trim());
            statement.setObject(2, toTimestamp(chartOpenedAt));
            statement.setObject(3, toTimestamp(billedAt));
            statement.setObject(4, toTimestamp(cancelledAt));
            statement.setString(5, normalize(ownerUserId));
            statement.setString(6, normalize(memo));
            statement.setString(7, effectiveFlags);
            statement.setObject(8, toTimestamp(lastOrcaSyncAt));
            statement.setTimestamp(9, Timestamp.from(projectedAt));
            statement.setString(10, encounterKey.trim());
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to transition encounter projection", ex);
        }
    }

    public EncounterRow findByEncounterKey(String encounterKey) {
        if (normalize(encounterKey) == null || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT)) {
            statement.setString(1, encounterKey.trim());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return new EncounterRow(
                        resultSet.getString(1),
                        resultSet.getString(2),
                        resultSet.getString(3),
                        (Long) resultSet.getObject(4),
                        resultSet.getString(5),
                        resultSet.getString(6),
                        resultSet.getTimestamp(7).toInstant(),
                        resultSet.getString(8),
                        toInstant(resultSet.getTimestamp(9)),
                        toInstant(resultSet.getTimestamp(10)),
                        toInstant(resultSet.getTimestamp(11)),
                        resultSet.getString(12),
                        resultSet.getString(13),
                        resultSet.getString(14),
                        toInstant(resultSet.getTimestamp(15)),
                        resultSet.getLong(16),
                        resultSet.getTimestamp(17).toInstant());
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load encounter projection", ex);
        }
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for encounter projection repository");
        }
        return dataSource;
    }

    private static Timestamp toTimestamp(Instant value) {
        return value != null ? Timestamp.from(value) : null;
    }

    private static Instant toInstant(Timestamp value) {
        return value != null ? value.toInstant() : null;
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

    public record EncounterUpsertCommand(
            String encounterKey,
            String facilityId,
            String patientId,
            Long karteId,
            String scheduleKey,
            String orcaAcceptanceId,
            Instant acceptanceDatetime,
            String businessState,
            Instant chartOpenedAt,
            Instant billedAt,
            Instant cancelledAt,
            String ownerUserId,
            String memo,
            String worklistFlagsJson,
            Instant lastOrcaSyncAt,
            long stateVersion,
            Instant projectedAt
    ) {
    }

    public record EncounterRow(
            String encounterKey,
            String facilityId,
            String patientId,
            Long karteId,
            String scheduleKey,
            String orcaAcceptanceId,
            Instant acceptanceDatetime,
            String businessState,
            Instant chartOpenedAt,
            Instant billedAt,
            Instant cancelledAt,
            String ownerUserId,
            String memo,
            String worklistFlagsJson,
            Instant lastOrcaSyncAt,
            long stateVersion,
            Instant projectedAt
    ) {
    }
}
