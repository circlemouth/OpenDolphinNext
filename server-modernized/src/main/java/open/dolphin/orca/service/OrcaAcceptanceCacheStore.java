package open.dolphin.orca.service;

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
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import javax.sql.DataSource;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.dto.orca.AcceptanceInventoryResponse;

@ApplicationScoped
public class OrcaAcceptanceCacheStore {

    private static final ObjectMapper JSON = AbstractResource.getSerializeMapper();

    private static final String SQL_SELECT = """
            SELECT orca_acceptance_cache_id, facility_id, orca_acceptance_key, orca_acceptance_id,
                   orca_patient_id, acceptance_date, acceptance_time, department_code, physician_code,
                   medical_information, insurance_combination_number, acceptance_status, event_type,
                   cancelled_at, row_hash
              FROM opendolphin.orca_acceptance_cache
             WHERE facility_id = ?
               AND acceptance_date = ?
               AND orca_acceptance_key = ?
             LIMIT 1
            """;

    private static final String SQL_UPSERT = """
            INSERT INTO opendolphin.orca_acceptance_cache (
                facility_id, orca_acceptance_key, orca_acceptance_id, orca_patient_id,
                acceptance_date, acceptance_time, department_code, physician_code,
                medical_information, insurance_combination_number, source_system, source_api,
                source_request_id, source_trace_id, fetched_at, cache_expires_at,
                acceptance_status, event_type, cancelled_at, row_hash,
                normalized_payload_json, response_summary_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ORCA', 'acceptlstv2', ?, ?, ?, ?,
                      ?, ?, NULL, ?, cast(? as jsonb), cast(? as jsonb))
            ON CONFLICT (facility_id, acceptance_date, orca_acceptance_key) DO UPDATE SET
                orca_acceptance_id = EXCLUDED.orca_acceptance_id,
                orca_patient_id = EXCLUDED.orca_patient_id,
                acceptance_time = EXCLUDED.acceptance_time,
                department_code = EXCLUDED.department_code,
                physician_code = EXCLUDED.physician_code,
                medical_information = EXCLUDED.medical_information,
                insurance_combination_number = EXCLUDED.insurance_combination_number,
                source_request_id = EXCLUDED.source_request_id,
                source_trace_id = EXCLUDED.source_trace_id,
                fetched_at = EXCLUDED.fetched_at,
                cache_expires_at = EXCLUDED.cache_expires_at,
                acceptance_status = EXCLUDED.acceptance_status,
                event_type = EXCLUDED.event_type,
                cancelled_at = NULL,
                row_hash = EXCLUDED.row_hash,
                normalized_payload_json = EXCLUDED.normalized_payload_json,
                response_summary_json = EXCLUDED.response_summary_json,
                updated_at = CURRENT_TIMESTAMP
            RETURNING orca_acceptance_cache_id
            """;

    private static final String SQL_MARK_CANCELLED = """
            UPDATE opendolphin.orca_acceptance_cache
               SET acceptance_status = 'CANCELLED',
                   event_type = 'ORCA_ACCEPTANCE_CANCELLED',
                   cancelled_at = ?,
                   fetched_at = ?,
                   source_request_id = ?,
                   source_trace_id = ?,
                   response_summary_json = cast(? as jsonb),
                   updated_at = CURRENT_TIMESTAMP
             WHERE facility_id = ?
               AND acceptance_date = ?
               AND acceptance_status IN ('CURRENT', 'DIFF_DETECTED', 'NEEDS_REVIEW')
               AND NOT (orca_acceptance_key = ANY (?))
            """;

    private static final String SQL_REFRESH_LINKS = """
            UPDATE opendolphin.encounter_orca_acceptance_link link
               SET orca_acceptance_id = COALESCE(cache.orca_acceptance_id, link.orca_acceptance_id),
                   orca_patient_id = cache.orca_patient_id,
                   acceptance_time = COALESCE(cache.acceptance_time, link.acceptance_time),
                   department_code = COALESCE(cache.department_code, link.department_code),
                   physician_code = COALESCE(cache.physician_code, link.physician_code),
                   medical_information = cache.medical_information,
                   insurance_combination_number = COALESCE(cache.insurance_combination_number,
                                                            link.insurance_combination_number),
                   source_api = cache.source_api,
                   link_status = cache.acceptance_status,
                   warning_status = CASE cache.acceptance_status
                       WHEN 'CANCELLED' THEN 'ORCA_ACCEPTANCE_CANCELLED'
                       WHEN 'DIFF_DETECTED' THEN 'ORCA_ACCEPTANCE_DIFF_DETECTED'
                       WHEN 'NEEDS_REVIEW' THEN 'ORCA_ACCEPTANCE_NEEDS_REVIEW'
                       WHEN 'CURRENT' THEN 'CLEAR'
                       ELSE 'ORCA_ACCEPTANCE_STALE_OR_UNRESOLVED'
                   END,
                   changed_fields_json = COALESCE(cache.response_summary_json -> 'changedFields', '[]'::jsonb),
                   cache_fetched_at = cache.fetched_at,
                   cache_expires_at = cache.cache_expires_at,
                   raw_sensitive_fields_excluded = TRUE,
                   client_provided_identifiers_trusted = FALSE,
                   server_derived_authority_required = TRUE,
                   updated_at = ?
              FROM opendolphin.orca_acceptance_cache cache
             WHERE link.facility_id = cache.facility_id
               AND link.acceptance_date = cache.acceptance_date
               AND (link.orca_acceptance_key = cache.orca_acceptance_key
                    OR link.orca_acceptance_id = cache.orca_acceptance_id)
               AND link.facility_id = ?
               AND link.acceptance_date = ?
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public AcceptanceCacheResult saveInventory(AcceptanceInventoryCommand command) {
        Objects.requireNonNull(command, "command");
        requireText(command.facilityId(), "facilityId");
        requireText(command.acceptanceDate(), "acceptanceDate");
        Instant fetchedAt = command.fetchedAt() != null ? command.fetchedAt() : Instant.now();
        Instant cacheExpiresAt = command.cacheExpiresAt() != null ? command.cacheExpiresAt() : fetchedAt.plusSeconds(300);
        AcceptanceInventoryResponse response = command.response() != null ? command.response() : new AcceptanceInventoryResponse();

        int upserted = 0;
        int diffDetected = 0;
        int needsReview = 0;
        Set<String> activeKeys = new LinkedHashSet<>();
        try (Connection connection = requireDataSource().getConnection()) {
            for (AcceptanceInventoryResponse.AcceptanceInventoryRow row : response.getRows()) {
                AcceptanceCacheRow next = toCacheRow(command, row, fetchedAt, cacheExpiresAt);
                activeKeys.add(next.orcaAcceptanceKey());
                AcceptanceCacheRow previous = findExisting(connection, next.facilityId(), next.acceptanceDate(),
                        next.orcaAcceptanceKey());
                List<String> changedFields = changedFields(previous, next);
                String status = resolveStatus(next, changedFields);
                String eventType = switch (status) {
                    case "DIFF_DETECTED" -> "ORCA_ACCEPTANCE_DIFF_DETECTED";
                    case "NEEDS_REVIEW" -> "ORCA_ACCEPTANCE_NEEDS_REVIEW";
                    default -> "ORCA_ACCEPTANCE_FETCHED";
                };
                if ("DIFF_DETECTED".equals(status)) {
                    diffDetected++;
                }
                if ("NEEDS_REVIEW".equals(status)) {
                    needsReview++;
                }
                upsert(connection, next, command, fetchedAt, cacheExpiresAt, status, eventType, changedFields);
                upserted++;
            }
            int cancelled = markCancelled(connection, command, fetchedAt, activeKeys);
            refreshEncounterLinks(connection, command, fetchedAt);
            return new AcceptanceCacheResult(upserted, diffDetected, cancelled, needsReview);
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to save ORCA acceptance cache", ex);
        }
    }

    private AcceptanceCacheRow findExisting(Connection connection, String facilityId, String acceptanceDate,
            String acceptanceKey) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_SELECT)) {
            statement.setString(1, facilityId);
            statement.setString(2, acceptanceDate);
            statement.setString(3, acceptanceKey);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return new AcceptanceCacheRow(
                        resultSet.getString("facility_id"),
                        resultSet.getString("orca_acceptance_key"),
                        resultSet.getString("orca_acceptance_id"),
                        resultSet.getString("orca_patient_id"),
                        resultSet.getString("acceptance_date"),
                        resultSet.getString("acceptance_time"),
                        resultSet.getString("department_code"),
                        resultSet.getString("physician_code"),
                        resultSet.getString("medical_information"),
                        resultSet.getString("insurance_combination_number"),
                        resultSet.getString("row_hash"),
                        resultSet.getString("acceptance_status"));
            }
        }
    }

    private void upsert(Connection connection,
            AcceptanceCacheRow row,
            AcceptanceInventoryCommand command,
            Instant fetchedAt,
            Instant cacheExpiresAt,
            String status,
            String eventType,
            List<String> changedFields) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_UPSERT)) {
            statement.setString(1, row.facilityId());
            statement.setString(2, row.orcaAcceptanceKey());
            statement.setString(3, row.orcaAcceptanceId());
            statement.setString(4, row.orcaPatientId());
            statement.setString(5, row.acceptanceDate());
            statement.setString(6, row.acceptanceTime());
            statement.setString(7, row.departmentCode());
            statement.setString(8, row.physicianCode());
            statement.setString(9, row.medicalInformation());
            statement.setString(10, row.insuranceCombinationNumber());
            statement.setString(11, normalize(command.sourceRequestId()));
            statement.setString(12, normalize(command.sourceTraceId()));
            statement.setTimestamp(13, Timestamp.from(fetchedAt));
            statement.setTimestamp(14, Timestamp.from(cacheExpiresAt));
            statement.setString(15, status);
            statement.setString(16, eventType);
            statement.setString(17, row.rowHash());
            statement.setString(18, toJson(normalizedPayload(row)));
            statement.setString(19, toJson(responseSummary(row, status, eventType, changedFields)));
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new SQLException("ORCA acceptance cache upsert returned no id");
                }
            }
        }
    }

    private int markCancelled(Connection connection,
            AcceptanceInventoryCommand command,
            Instant fetchedAt,
            Set<String> activeKeys) throws SQLException {
        String[] keys = activeKeys.toArray(String[]::new);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("eventType", "ORCA_ACCEPTANCE_CANCELLED");
        summary.put("acceptanceStatus", "CANCELLED");
        summary.put("rawResponseStored", Boolean.FALSE);
        summary.put("activeKeyCount", keys.length);
        try (PreparedStatement statement = connection.prepareStatement(SQL_MARK_CANCELLED)) {
            statement.setTimestamp(1, Timestamp.from(fetchedAt));
            statement.setTimestamp(2, Timestamp.from(fetchedAt));
            statement.setString(3, normalize(command.sourceRequestId()));
            statement.setString(4, normalize(command.sourceTraceId()));
            statement.setString(5, toJson(summary));
            statement.setString(6, command.facilityId().trim());
            statement.setString(7, command.acceptanceDate().trim());
            statement.setArray(8, connection.createArrayOf("varchar", keys));
            return statement.executeUpdate();
        }
    }

    private void refreshEncounterLinks(Connection connection,
            AcceptanceInventoryCommand command,
            Instant fetchedAt) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_REFRESH_LINKS)) {
            statement.setTimestamp(1, Timestamp.from(fetchedAt));
            statement.setString(2, command.facilityId().trim());
            statement.setString(3, command.acceptanceDate().trim());
            statement.executeUpdate();
        }
    }

    private static AcceptanceCacheRow toCacheRow(AcceptanceInventoryCommand command,
            AcceptanceInventoryResponse.AcceptanceInventoryRow row,
            Instant fetchedAt,
            Instant cacheExpiresAt) {
        String acceptanceDate = firstText(row != null ? row.getServerAcceptanceDate() : null, command.acceptanceDate());
        String acceptanceKey = firstText(row != null ? row.getServerAcceptanceId() : null, row != null ? row.getRowHash() : null);
        return new AcceptanceCacheRow(
                command.facilityId().trim(),
                acceptanceKey,
                normalize(row != null ? row.getServerAcceptanceId() : null),
                normalize(row != null ? row.getServerPatientId() : null),
                requireNormalized(acceptanceDate, "acceptanceDate"),
                normalize(row != null ? row.getServerAcceptanceTime() : null),
                normalize(row != null ? row.getServerDepartmentCode() : null),
                normalize(row != null ? row.getServerPhysicianCode() : null),
                normalize(row != null ? row.getServerMedicalInformation() : null),
                normalize(row != null ? row.getServerInsuranceCombinationNumber() : null),
                requireNormalized(row != null ? row.getRowHash() : null, "rowHash"),
                null);
    }

    private static String resolveStatus(AcceptanceCacheRow row, List<String> changedFields) {
        if (row.orcaAcceptanceId() == null || row.orcaPatientId() == null || row.acceptanceTime() == null
                || row.departmentCode() == null || row.physicianCode() == null
                || row.insuranceCombinationNumber() == null) {
            return "NEEDS_REVIEW";
        }
        if (changedFields != null && !changedFields.isEmpty()) {
            return "DIFF_DETECTED";
        }
        return "CURRENT";
    }

    private static List<String> changedFields(AcceptanceCacheRow previous, AcceptanceCacheRow next) {
        List<String> changed = new ArrayList<>();
        if (previous == null || "CANCELLED".equals(previous.acceptanceStatus())) {
            return changed;
        }
        compare(changed, "orcaPatientId", previous.orcaPatientId(), next.orcaPatientId());
        compare(changed, "acceptanceTime", previous.acceptanceTime(), next.acceptanceTime());
        compare(changed, "departmentCode", previous.departmentCode(), next.departmentCode());
        compare(changed, "physicianCode", previous.physicianCode(), next.physicianCode());
        compare(changed, "medicalInformation", previous.medicalInformation(), next.medicalInformation());
        compare(changed, "insuranceCombinationNumber", previous.insuranceCombinationNumber(),
                next.insuranceCombinationNumber());
        return changed;
    }

    private static void compare(List<String> changed, String field, String previous, String next) {
        if (!Objects.equals(normalize(previous), normalize(next))) {
            changed.add(field);
        }
    }

    private static Map<String, Object> normalizedPayload(AcceptanceCacheRow row) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sourceSystem", "ORCA");
        payload.put("sourceApi", "acceptlstv2");
        payload.put("acceptanceKey", row.orcaAcceptanceKey());
        payload.put("acceptanceId", row.orcaAcceptanceId());
        payload.put("patientId", row.orcaPatientId());
        payload.put("acceptanceDate", row.acceptanceDate());
        payload.put("acceptanceTime", row.acceptanceTime());
        payload.put("departmentCode", row.departmentCode());
        payload.put("physicianCode", row.physicianCode());
        payload.put("medicalInformation", row.medicalInformation());
        payload.put("insuranceCombinationNumber", row.insuranceCombinationNumber());
        payload.put("rawResponseStored", Boolean.FALSE);
        return payload;
    }

    private static Map<String, Object> responseSummary(AcceptanceCacheRow row,
            String status,
            String eventType,
            List<String> changedFields) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("acceptanceStatus", status);
        summary.put("eventType", eventType);
        summary.put("rowHash", row.rowHash());
        summary.put("changedFields", changedFields != null ? changedFields : List.of());
        summary.put("rawResponseStored", Boolean.FALSE);
        return summary;
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("DataSource is not configured");
        }
        return dataSource;
    }

    private static String toJson(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize ORCA acceptance cache payload", ex);
        }
    }

    private static void requireText(String value, String field) {
        requireNormalized(value, field);
    }

    private static String requireNormalized(String value, String field) {
        String normalized = normalize(value);
        if (normalized == null) {
            throw new IllegalArgumentException(field + " is required");
        }
        return normalized;
    }

    private static String firstText(String first, String second) {
        String normalized = normalize(first);
        return normalized != null ? normalized : normalize(second);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record AcceptanceInventoryCommand(
            String facilityId,
            String acceptanceDate,
            String sourceRequestId,
            String sourceTraceId,
            Instant fetchedAt,
            Instant cacheExpiresAt,
            AcceptanceInventoryResponse response) {
    }

    public record AcceptanceCacheResult(
            int upsertedCount,
            int diffDetectedCount,
            int cancelledCount,
            int needsReviewCount) {
    }

    private record AcceptanceCacheRow(
            String facilityId,
            String orcaAcceptanceKey,
            String orcaAcceptanceId,
            String orcaPatientId,
            String acceptanceDate,
            String acceptanceTime,
            String departmentCode,
            String physicianCode,
            String medicalInformation,
            String insuranceCombinationNumber,
            String rowHash,
            String acceptanceStatus) {
    }
}
