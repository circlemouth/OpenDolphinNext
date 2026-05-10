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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import javax.sql.DataSource;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.dto.orca.ChartSupportDiseaseModV3Request;
import open.dolphin.rest.dto.orca.ChartSupportDiseaseModV3Response;

@ApplicationScoped
public class OrcaDiseaseOperationStore {

    private static final ObjectMapper JSON = AbstractResource.getSerializeMapper();

    private static final String SQL_FIND = """
            SELECT orca_disease_operation_id, facility_id, idempotency_key, operation_status,
                   request_hash, response_hash, needs_user_review
              FROM opendolphin.orca_disease_operation
             WHERE facility_id = ?
               AND idempotency_key = ?
            """;

    private static final String SQL_INSERT = """
            INSERT INTO opendolphin.orca_disease_operation (
                facility_id, operation_type, operation_status, idempotency_key, requested_by,
                requested_at, sent_at, completed_at, orca_patient_id, encounter_id, chart_revision_id,
                perform_date, department_code, physician_code, insurance_combination_number,
                request_hash, response_hash, retry_count, last_error_code, needs_user_review,
                warnings_json, unmatched_json, request_summary_json, response_summary_json
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?,
                cast(? as jsonb), cast(? as jsonb), cast(? as jsonb), cast(? as jsonb)
            )
            RETURNING orca_disease_operation_id
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public OperationRow findByIdempotencyKey(String facilityId, String idempotencyKey) {
        if (normalize(facilityId) == null || normalize(idempotencyKey) == null || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_FIND)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, idempotencyKey.trim());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return new OperationRow(
                        resultSet.getLong("orca_disease_operation_id"),
                        resultSet.getString("facility_id"),
                        resultSet.getString("idempotency_key"),
                        resultSet.getString("operation_status"),
                        resultSet.getString("request_hash"),
                        resultSet.getString("response_hash"),
                        resultSet.getBoolean("needs_user_review"));
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load ORCA disease operation", ex);
        }
    }

    public long saveCompleted(OperationCommand command) {
        requireText(command.facilityId(), "facilityId");
        requireText(command.operation(), "operation");
        requireText(command.idempotencyKey(), "idempotencyKey");
        requireText(command.requestedBy(), "requestedBy");
        requireText(command.orcaPatientId(), "orcaPatientId");
        requireText(command.requestXml(), "requestXml");
        String requestHash = sha256Hex(command.requestXml());
        String responseHash = normalize(command.responseBody()) != null ? sha256Hex(command.responseBody()) : null;
        String status = normalize(command.response() != null ? command.response().getOperationStatus() : null);
        if (status == null) {
            status = "UNKNOWN";
        }
        Instant now = command.completedAt() != null ? command.completedAt() : Instant.now();

        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_INSERT)) {
            statement.setString(1, command.facilityId().trim());
            statement.setString(2, toOperationType(command.operation()));
            statement.setString(3, status);
            statement.setString(4, command.idempotencyKey().trim());
            statement.setString(5, command.requestedBy().trim());
            statement.setTimestamp(6, Timestamp.from(command.requestedAt() != null ? command.requestedAt() : now));
            statement.setTimestamp(7, Timestamp.from(command.sentAt() != null ? command.sentAt() : now));
            statement.setTimestamp(8, Timestamp.from(now));
            statement.setString(9, command.orcaPatientId().trim());
            statement.setString(10, normalize(command.encounterId()));
            statement.setString(11, normalize(command.chartRevisionId()));
            statement.setObject(12, command.performDate());
            statement.setString(13, normalize(command.departmentCode()));
            statement.setString(14, normalize(command.physicianCode()));
            statement.setString(15, normalize(command.insuranceCombinationNumber()));
            statement.setString(16, requestHash);
            statement.setString(17, responseHash);
            statement.setString(18, normalize(command.response() != null ? command.response().getError() : null));
            statement.setBoolean(19, command.response() != null && command.response().isNeedsUserReview());
            statement.setString(20, toJson(command.response() != null ? command.response().getWarnings() : List.of()));
            statement.setString(21, toJson(command.response() != null ? command.response().getUnmatchInformation() : List.of()));
            statement.setString(22, toJson(requestSummary(command)));
            statement.setString(23, toJson(responseSummary(command.response())));
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new IllegalStateException("Failed to save ORCA disease operation");
                }
                return resultSet.getLong(1);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to save ORCA disease operation", ex);
        }
    }

    public static String idempotencyKey(String operation, String requestXml) {
        requireText(requestXml, "requestXml");
        return "diseasev3:" + toOperationType(operation).toLowerCase(Locale.ROOT) + ":" + sha256Hex(requestXml);
    }

    private static Map<String, Object> requestSummary(OperationCommand command) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("operation", command.operation());
        summary.put("performDate", command.performDate() != null ? command.performDate().toString() : null);
        summary.put("departmentCode", normalize(command.departmentCode()));
        summary.put("physicianCodePresent", normalize(command.physicianCode()) != null);
        summary.put("insuranceCombinationNumberPresent", normalize(command.insuranceCombinationNumber()) != null);
        summary.put("diseaseInformationCount", command.diseaseInformationCount());
        return summary;
    }

    private static Map<String, Object> responseSummary(ChartSupportDiseaseModV3Response response) {
        Map<String, Object> summary = new LinkedHashMap<>();
        if (response == null) {
            summary.put("operationStatus", "UNKNOWN");
            summary.put("needsUserReview", true);
            return summary;
        }
        summary.put("apiResult", response.getApiResult());
        summary.put("responseClassification", response.getResponseClassification());
        summary.put("operationStatus", response.getOperationStatus());
        summary.put("needsUserReview", response.isNeedsUserReview());
        summary.put("warningCount", response.getWarnings() != null ? response.getWarnings().size() : 0);
        summary.put("unmatchCount", response.getUnmatchInformation() != null ? response.getUnmatchInformation().size() : 0);
        return summary;
    }

    private static String toOperationType(String operation) {
        String normalized = normalize(operation);
        if (normalized == null || "create".equals(normalized)) {
            return "CREATE";
        }
        return switch (normalized) {
            case "update" -> "UPDATE";
            case "delete" -> "DELETE";
            case "organizeDeletedDiseases" -> "ORGANIZE_DELETED_DISEASES";
            case "fetch" -> "FETCH";
            default -> throw new IllegalArgumentException("Unsupported ORCA disease operation: " + operation);
        };
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
            throw new IllegalStateException("Failed to serialize ORCA disease operation summary", ex);
        }
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

    public record OperationCommand(
            String facilityId,
            String operation,
            String idempotencyKey,
            String requestedBy,
            Instant requestedAt,
            Instant sentAt,
            Instant completedAt,
            String orcaPatientId,
            String encounterId,
            String chartRevisionId,
            LocalDate performDate,
            String departmentCode,
            String physicianCode,
            String insuranceCombinationNumber,
            int diseaseInformationCount,
            String requestXml,
            String responseBody,
            ChartSupportDiseaseModV3Response response) {
    }

    public record OperationRow(
            long id,
            String facilityId,
            String idempotencyKey,
            String operationStatus,
            String requestHash,
            String responseHash,
            boolean needsUserReview) {
    }
}
