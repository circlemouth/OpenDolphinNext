package open.dolphin.orca.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import javax.sql.DataSource;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.dto.orca.DiseaseImportResponse;

@ApplicationScoped
public class OrcaDiseaseCacheStore {

    private static final DateTimeFormatter BASE_MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyyMM");
    private static final ObjectMapper JSON = AbstractResource.getSerializeMapper();

    private static final String SQL_DELETE_CONTEXT = """
            DELETE FROM opendolphin.orca_disease_cache
             WHERE facility_id = ?
               AND orca_patient_id = ?
               AND base_month = ?
               AND COALESCE(department_code, '') = COALESCE(?, '')
               AND COALESCE(insurance_combination_number, '') = COALESCE(?, '')
            """;

    private static final String SQL_INSERT = """
            INSERT INTO opendolphin.orca_disease_cache (
                facility_id, orca_patient_id, base_month, perform_date, department_code,
                insurance_combination_number, source_system, source_api, source_request_id,
                source_trace_id, fetched_at, cache_expires_at, raw_response_hash,
                normalized_payload_json, warnings_json, unmatched_json
            ) VALUES (?, ?, ?, ?, ?, ?, 'ORCA', 'diseasegetv2', ?, ?, ?, ?, ?, cast(? as jsonb), cast(? as jsonb), cast(? as jsonb))
            RETURNING orca_disease_cache_id
            """;

    private static final String SQL_SELECT = """
            SELECT orca_disease_cache_id, facility_id, orca_patient_id, base_month, perform_date,
                   department_code, insurance_combination_number, source_api, source_request_id,
                   source_trace_id, fetched_at, cache_expires_at, raw_response_hash,
                   normalized_payload_json::text, warnings_json::text, unmatched_json::text
              FROM opendolphin.orca_disease_cache
             WHERE facility_id = ?
               AND orca_patient_id = ?
               AND base_month = ?
               AND COALESCE(department_code, '') = COALESCE(?, '')
               AND COALESCE(insurance_combination_number, '') = COALESCE(?, '')
             ORDER BY fetched_at DESC, orca_disease_cache_id DESC
             LIMIT 1
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public long save(DiseaseCacheCommand command) {
        Objects.requireNonNull(command, "command");
        requireText(command.facilityId(), "facilityId");
        requireText(command.orcaPatientId(), "orcaPatientId");
        requireText(command.rawResponseBody(), "rawResponseBody");
        Instant fetchedAt = command.fetchedAt() != null ? command.fetchedAt() : Instant.now();
        Instant cacheExpiresAt = command.cacheExpiresAt() != null ? command.cacheExpiresAt() : fetchedAt.plusSeconds(900);
        LocalDate performDate = command.performDate() != null ? command.performDate() : LocalDate.now();
        String baseMonth = normalize(command.baseMonth());
        if (baseMonth == null) {
            baseMonth = BASE_MONTH_FORMAT.format(performDate);
        }
        String normalizedPayloadJson = toJson(toNormalizedPayload(command.response()));
        String warningsJson = toJson(command.response() != null && command.response().getWarnings() != null
                ? command.response().getWarnings()
                : List.of());
        String unmatchedJson = toJson(List.of());
        String rawResponseHash = sha256Hex(command.rawResponseBody());

        try (Connection connection = requireDataSource().getConnection()) {
            boolean localTransaction = connection.getAutoCommit();
            if (localTransaction) {
                connection.setAutoCommit(false);
            }
            try {
                deleteExisting(connection, command.facilityId(), command.orcaPatientId(), baseMonth,
                        command.departmentCode(), command.insuranceCombinationNumber());
                long id = insert(connection, command, baseMonth, performDate, fetchedAt, cacheExpiresAt,
                        rawResponseHash, normalizedPayloadJson, warningsJson, unmatchedJson);
                if (localTransaction) {
                    connection.commit();
                }
                return id;
            } catch (Exception ex) {
                if (localTransaction) {
                    connection.rollback();
                }
                throw ex;
            } finally {
                if (localTransaction) {
                    connection.setAutoCommit(true);
                }
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to save ORCA disease cache", ex);
        }
    }

    public DiseaseCacheRow findLatest(String facilityId, String orcaPatientId, String baseMonth,
            String departmentCode, String insuranceCombinationNumber) {
        if (normalize(facilityId) == null || normalize(orcaPatientId) == null || normalize(baseMonth) == null || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, orcaPatientId.trim());
            statement.setString(3, baseMonth.trim());
            statement.setString(4, normalize(departmentCode));
            statement.setString(5, normalize(insuranceCombinationNumber));
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return new DiseaseCacheRow(
                        resultSet.getLong("orca_disease_cache_id"),
                        resultSet.getString("facility_id"),
                        resultSet.getString("orca_patient_id"),
                        resultSet.getString("base_month"),
                        resultSet.getObject("perform_date", LocalDate.class),
                        resultSet.getString("department_code"),
                        resultSet.getString("insurance_combination_number"),
                        resultSet.getString("source_api"),
                        resultSet.getString("source_request_id"),
                        resultSet.getString("source_trace_id"),
                        toInstant(resultSet.getTimestamp("fetched_at")),
                        toInstant(resultSet.getTimestamp("cache_expires_at")),
                        resultSet.getString("raw_response_hash"),
                        resultSet.getString("normalized_payload_json"),
                        resultSet.getString("warnings_json"),
                        resultSet.getString("unmatched_json"));
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load ORCA disease cache", ex);
        }
    }

    private void deleteExisting(Connection connection, String facilityId, String orcaPatientId, String baseMonth,
            String departmentCode, String insuranceCombinationNumber) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_DELETE_CONTEXT)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, orcaPatientId.trim());
            statement.setString(3, baseMonth.trim());
            statement.setString(4, normalize(departmentCode));
            statement.setString(5, normalize(insuranceCombinationNumber));
            statement.executeUpdate();
        }
    }

    private long insert(Connection connection, DiseaseCacheCommand command, String baseMonth, LocalDate performDate,
            Instant fetchedAt, Instant cacheExpiresAt, String rawResponseHash, String normalizedPayloadJson,
            String warningsJson, String unmatchedJson) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_INSERT)) {
            statement.setString(1, command.facilityId().trim());
            statement.setString(2, command.orcaPatientId().trim());
            statement.setString(3, baseMonth);
            statement.setObject(4, performDate);
            statement.setString(5, normalize(command.departmentCode()));
            statement.setString(6, normalize(command.insuranceCombinationNumber()));
            statement.setString(7, normalize(command.sourceRequestId()));
            statement.setString(8, normalize(command.sourceTraceId()));
            statement.setTimestamp(9, Timestamp.from(fetchedAt));
            statement.setTimestamp(10, Timestamp.from(cacheExpiresAt));
            statement.setString(11, rawResponseHash);
            statement.setString(12, normalizedPayloadJson);
            statement.setString(13, warningsJson);
            statement.setString(14, unmatchedJson);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new SQLException("ORCA disease cache insert returned no id");
                }
                return resultSet.getLong(1);
            }
        }
    }

    private static Map<String, Object> toNormalizedPayload(DiseaseImportResponse response) {
        Map<String, Object> payload = new LinkedHashMap<>();
        if (response == null) {
            payload.put("diseases", List.of());
            return payload;
        }
        payload.put("apiResult", response.getApiResult());
        payload.put("apiResultMessage", response.getApiResultMessage());
        payload.put("patientId", response.getPatientId());
        payload.put("baseDate", response.getBaseDate());
        payload.put("orcaMirrorStatus", response.getOrcaMirrorStatus());
        payload.put("masterVersion", response.getMasterVersion());
        payload.put("diseases", response.getDiseases() != null ? response.getDiseases() : List.of());
        return payload;
    }

    private static String toJson(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize ORCA disease cache payload", ex);
        }
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hashed.length * 2);
            for (byte b : hashed) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("DataSource is not configured");
        }
        return dataSource;
    }

    private static void requireText(String value, String field) {
        if (normalize(value) == null) {
            throw new IllegalArgumentException(field + " is required");
        }
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static Instant toInstant(Timestamp timestamp) {
        return timestamp != null ? timestamp.toInstant() : null;
    }

    public record DiseaseCacheCommand(
            String facilityId,
            String orcaPatientId,
            String baseMonth,
            LocalDate performDate,
            String departmentCode,
            String insuranceCombinationNumber,
            String sourceRequestId,
            String sourceTraceId,
            Instant fetchedAt,
            Instant cacheExpiresAt,
            String rawResponseBody,
            DiseaseImportResponse response) {
    }

    public record DiseaseCacheRow(
            long id,
            String facilityId,
            String orcaPatientId,
            String baseMonth,
            LocalDate performDate,
            String departmentCode,
            String insuranceCombinationNumber,
            String sourceApi,
            String sourceRequestId,
            String sourceTraceId,
            Instant fetchedAt,
            Instant cacheExpiresAt,
            String rawResponseHash,
            String normalizedPayloadJson,
            String warningsJson,
            String unmatchedJson) {
    }
}
