package open.dolphin.encounter;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
public class EncounterProjectionRepository {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {
    };

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

    private static final String SQL_SELECT_BY_RANGE = """
            SELECT encounter_key, facility_id, patient_id, karte_id, schedule_key, orca_acceptance_id,
                   acceptance_datetime, business_state, chart_opened_at, billed_at, cancelled_at,
                   owner_user_id, memo, worklist_flags::text, last_orca_sync_at, state_version, projected_at
              FROM opendolphin.encounter_projection
             WHERE facility_id = ?
               AND acceptance_datetime >= ?
               AND acceptance_datetime < ?
             ORDER BY acceptance_datetime ASC, encounter_key ASC
            """;

    private static final String SQL_SELECT_ORCA_CONTEXT = """
            SELECT encounter_key, facility_id, orca_acceptance_id, acceptance_date, acceptance_time,
                   department_code, physician_code, insurance_combination_number, link_status,
                   warning_status, changed_fields_json::text, cache_fetched_at, cache_expires_at,
                   patient_cache_status, patient_business_status, patient_warning_status,
                   patient_cache_fetched_at, patient_cache_expires_at, insurance_cache_status,
                   insurance_warning_status, insurance_changed_fields_json::text,
                   insurance_cache_fetched_at, insurance_cache_expires_at
              FROM opendolphin.encounter_orca_acceptance_link
             WHERE encounter_key = ?
            """;

    private static final String SQL_SYNC_ACCEPTANCE_LINK = """
            INSERT INTO opendolphin.encounter_orca_acceptance_link (
                encounter_key, facility_id, patient_id, orca_acceptance_key, orca_acceptance_id,
                orca_patient_id, acceptance_date, acceptance_time, department_code, physician_code,
                medical_information, insurance_combination_number, source_system, source_api,
                link_status, warning_status, changed_fields_json, cache_fetched_at, cache_expires_at,
                raw_sensitive_fields_excluded, client_provided_identifiers_trusted, server_derived_authority_required,
                linked_at, updated_at
            )
            SELECT ep.encounter_key,
                   ep.facility_id,
                   ep.patient_id,
                   ep.orca_acceptance_id,
                   COALESCE(cache.orca_acceptance_id, ep.orca_acceptance_id),
                   cache.orca_patient_id,
                   to_char(ep.acceptance_datetime AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD'),
                   COALESCE(cache.acceptance_time, to_char(ep.acceptance_datetime AT TIME ZONE 'Asia/Tokyo', 'HH24MI')),
                   COALESCE(cache.department_code, ep.worklist_flags #>> '{officialVisitIdentifiers,departmentCode}'),
                   COALESCE(cache.physician_code, ep.worklist_flags #>> '{officialVisitIdentifiers,physicianCode}'),
                   cache.medical_information,
                   COALESCE(cache.insurance_combination_number,
                            ep.worklist_flags #>> '{officialVisitIdentifiers,insuranceCombinationNumber}'),
                   'ORCA',
                   COALESCE(cache.source_api, 'acceptlstv2'),
                   COALESCE(cache.acceptance_status, 'UNKNOWN'),
                   CASE cache.acceptance_status
                       WHEN 'CANCELLED' THEN 'ORCA_ACCEPTANCE_CANCELLED'
                       WHEN 'DIFF_DETECTED' THEN 'ORCA_ACCEPTANCE_DIFF_DETECTED'
                       WHEN 'NEEDS_REVIEW' THEN 'ORCA_ACCEPTANCE_NEEDS_REVIEW'
                       WHEN 'CURRENT' THEN 'CLEAR'
                       ELSE 'ORCA_ACCEPTANCE_STALE_OR_UNRESOLVED'
                   END,
                   COALESCE(cache.response_summary_json -> 'changedFields', '[]'::jsonb),
                   cache.fetched_at,
                   cache.cache_expires_at,
                   TRUE,
                   FALSE,
                   TRUE,
                   ep.projected_at,
                   ep.projected_at
              FROM opendolphin.encounter_projection ep
              LEFT JOIN opendolphin.orca_acceptance_cache cache
                ON cache.facility_id = ep.facility_id
               AND cache.acceptance_date = to_char(ep.acceptance_datetime AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD')
               AND (cache.orca_acceptance_id = ep.orca_acceptance_id
                    OR cache.orca_acceptance_key = ep.orca_acceptance_id)
             WHERE ep.encounter_key = ?
            ON CONFLICT (encounter_key) DO UPDATE SET
                facility_id = EXCLUDED.facility_id,
                patient_id = EXCLUDED.patient_id,
                orca_acceptance_key = EXCLUDED.orca_acceptance_key,
                orca_acceptance_id = EXCLUDED.orca_acceptance_id,
                orca_patient_id = EXCLUDED.orca_patient_id,
                acceptance_date = EXCLUDED.acceptance_date,
                acceptance_time = EXCLUDED.acceptance_time,
                department_code = EXCLUDED.department_code,
                physician_code = EXCLUDED.physician_code,
                medical_information = EXCLUDED.medical_information,
                insurance_combination_number = EXCLUDED.insurance_combination_number,
                source_api = EXCLUDED.source_api,
                link_status = EXCLUDED.link_status,
                warning_status = EXCLUDED.warning_status,
                changed_fields_json = EXCLUDED.changed_fields_json,
                cache_fetched_at = EXCLUDED.cache_fetched_at,
                cache_expires_at = EXCLUDED.cache_expires_at,
                raw_sensitive_fields_excluded = TRUE,
                client_provided_identifiers_trusted = FALSE,
                server_derived_authority_required = TRUE,
                updated_at = EXCLUDED.updated_at
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
            syncAcceptanceLink(connection, command.encounterKey().trim());
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
                return mapRow(resultSet);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load encounter projection", ex);
        }
    }

    public List<EncounterRow> findByFacilityAndAcceptanceRange(String facilityId, Instant fromInclusive, Instant toExclusive) {
        if (normalize(facilityId) == null || fromInclusive == null || toExclusive == null || dataSource == null) {
            return List.of();
        }
        List<EncounterRow> rows = new ArrayList<>();
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_BY_RANGE)) {
            statement.setString(1, facilityId.trim());
            statement.setTimestamp(2, Timestamp.from(fromInclusive));
            statement.setTimestamp(3, Timestamp.from(toExclusive));
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    rows.add(mapRow(resultSet));
                }
            }
            return rows;
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load encounter projections by range", ex);
        }
    }

    public EncounterOrcaContextRow findOrcaContextByEncounterKey(String encounterKey) {
        if (normalize(encounterKey) == null || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_ORCA_CONTEXT)) {
            statement.setString(1, encounterKey.trim());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return mapOrcaContextRow(resultSet);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load encounter ORCA context", ex);
        }
    }

    private EncounterRow mapRow(ResultSet resultSet) throws SQLException {
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

    private EncounterOrcaContextRow mapOrcaContextRow(ResultSet resultSet) throws SQLException {
        return new EncounterOrcaContextRow(
                resultSet.getString(1),
                resultSet.getString(2),
                resultSet.getString(3),
                resultSet.getString(4),
                resultSet.getString(5),
                resultSet.getString(6),
                resultSet.getString(7),
                resultSet.getString(8),
                resultSet.getString(9),
                resultSet.getString(10),
                parseStringList(resultSet.getString(11)),
                toInstant(resultSet.getTimestamp(12)),
                toInstant(resultSet.getTimestamp(13)),
                resultSet.getString(14),
                resultSet.getString(15),
                resultSet.getString(16),
                toInstant(resultSet.getTimestamp(17)),
                toInstant(resultSet.getTimestamp(18)),
                resultSet.getString(19),
                resultSet.getString(20),
                parseStringList(resultSet.getString(21)),
                toInstant(resultSet.getTimestamp(22)),
                toInstant(resultSet.getTimestamp(23)));
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for encounter projection repository");
        }
        return dataSource;
    }

    private void syncAcceptanceLink(Connection connection, String encounterKey) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_SYNC_ACCEPTANCE_LINK)) {
            statement.setString(1, encounterKey);
            statement.executeUpdate();
        }
    }

    private static Timestamp toTimestamp(Instant value) {
        return value != null ? Timestamp.from(value) : null;
    }

    private static Instant toInstant(Timestamp value) {
        return value != null ? value.toInstant() : null;
    }

    private static List<String> parseStringList(String json) {
        String normalized = normalize(json);
        if (normalized == null) {
            return List.of();
        }
        try {
            List<String> values = OBJECT_MAPPER.readValue(normalized, STRING_LIST);
            return values.stream()
                    .map(EncounterProjectionRepository::normalize)
                    .filter(value -> value != null)
                    .toList();
        } catch (JsonProcessingException ex) {
            return List.of();
        }
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

    public record EncounterOrcaContextRow(
            String encounterKey,
            String facilityId,
            String orcaAcceptanceId,
            String acceptanceDate,
            String acceptanceTime,
            String departmentCode,
            String physicianCode,
            String insuranceCombinationNumber,
            String linkStatus,
            String warningStatus,
            List<String> changedFields,
            Instant cacheFetchedAt,
            Instant cacheExpiresAt,
            String patientCacheStatus,
            String patientBusinessStatus,
            String patientWarningStatus,
            Instant patientCacheFetchedAt,
            Instant patientCacheExpiresAt,
            String insuranceCacheStatus,
            String insuranceWarningStatus,
            List<String> insuranceChangedFields,
            Instant insuranceCacheFetchedAt,
            Instant insuranceCacheExpiresAt
    ) {
        public EncounterOrcaContextRow {
            changedFields = changedFields == null ? List.of() : List.copyOf(changedFields);
            insuranceChangedFields = insuranceChangedFields == null ? List.of() : List.copyOf(insuranceChangedFields);
        }

        @Override
        public List<String> changedFields() {
            return List.copyOf(changedFields);
        }

        @Override
        public List<String> insuranceChangedFields() {
            return List.copyOf(insuranceChangedFields);
        }
    }
}
