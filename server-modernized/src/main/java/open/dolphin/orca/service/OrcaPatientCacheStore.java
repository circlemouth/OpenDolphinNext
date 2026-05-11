package open.dolphin.orca.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
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
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import javax.sql.DataSource;
import open.dolphin.rest.AbstractResource;

@ApplicationScoped
public class OrcaPatientCacheStore {

    private static final ObjectMapper JSON = AbstractResource.getSerializeMapper();

    private static final String SQL_UPSERT = """
            INSERT INTO opendolphin.orca_patient_cache (
                facility_id, orca_patient_id, internal_patient_id, source_system, source_api,
                source_request_id, source_trace_id, fetched_at, cache_expires_at,
                cache_status, business_status, raw_response_hash,
                normalized_payload_json, response_summary_json
            ) VALUES (?, ?, ?, 'ORCA', 'patientgetv2', ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), cast(? as jsonb))
            ON CONFLICT (facility_id, orca_patient_id) DO UPDATE SET
                internal_patient_id = EXCLUDED.internal_patient_id,
                source_request_id = EXCLUDED.source_request_id,
                source_trace_id = EXCLUDED.source_trace_id,
                fetched_at = EXCLUDED.fetched_at,
                cache_expires_at = EXCLUDED.cache_expires_at,
                cache_status = EXCLUDED.cache_status,
                business_status = EXCLUDED.business_status,
                raw_response_hash = EXCLUDED.raw_response_hash,
                normalized_payload_json = EXCLUDED.normalized_payload_json,
                response_summary_json = EXCLUDED.response_summary_json,
                updated_at = CURRENT_TIMESTAMP
            RETURNING orca_patient_cache_id
            """;

    private static final String SQL_SELECT = """
            SELECT orca_patient_cache_id, facility_id, orca_patient_id, internal_patient_id,
                   source_api, source_request_id, source_trace_id, fetched_at, cache_expires_at,
                   cache_status, business_status, raw_response_hash,
                   normalized_payload_json::text, response_summary_json::text
              FROM opendolphin.orca_patient_cache
             WHERE facility_id = ?
               AND orca_patient_id = ?
             ORDER BY fetched_at DESC, orca_patient_cache_id DESC
             LIMIT 1
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public long save(PatientCacheCommand command) {
        Objects.requireNonNull(command, "command");
        requireText(command.facilityId(), "facilityId");
        requireText(command.orcaPatientId(), "orcaPatientId");
        requireText(command.rawResponseBody(), "rawResponseBody");
        requireText(command.cacheStatus(), "cacheStatus");
        requireText(command.businessStatus(), "businessStatus");
        Instant fetchedAt = command.fetchedAt() != null ? command.fetchedAt() : Instant.now();
        Instant cacheExpiresAt = command.cacheExpiresAt() != null ? command.cacheExpiresAt() : fetchedAt.plusSeconds(900);
        String rawResponseHash = sha256Hex(command.rawResponseBody());
        String normalizedPayloadJson = toJson(toNormalizedPayload(command));
        String responseSummaryJson = toJson(toResponseSummary(command, rawResponseHash));

        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_UPSERT)) {
            statement.setString(1, command.facilityId().trim());
            statement.setString(2, command.orcaPatientId().trim());
            if (command.internalPatientId() != null) {
                statement.setLong(3, command.internalPatientId());
            } else {
                statement.setObject(3, null);
            }
            statement.setString(4, normalize(command.sourceRequestId()));
            statement.setString(5, normalize(command.sourceTraceId()));
            statement.setTimestamp(6, Timestamp.from(fetchedAt));
            statement.setTimestamp(7, Timestamp.from(cacheExpiresAt));
            statement.setString(8, command.cacheStatus().trim());
            statement.setString(9, command.businessStatus().trim());
            statement.setString(10, rawResponseHash);
            statement.setString(11, normalizedPayloadJson);
            statement.setString(12, responseSummaryJson);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new SQLException("ORCA patient cache upsert returned no id");
                }
                return resultSet.getLong(1);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to save ORCA patient cache", ex);
        }
    }

    public PatientCacheRow findLatest(String facilityId, String orcaPatientId) {
        if (normalize(facilityId) == null || normalize(orcaPatientId) == null || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT)) {
            statement.setString(1, facilityId.trim());
            statement.setString(2, orcaPatientId.trim());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                Long internalPatientId = resultSet.getObject("internal_patient_id") != null
                        ? resultSet.getLong("internal_patient_id")
                        : null;
                return new PatientCacheRow(
                        resultSet.getLong("orca_patient_cache_id"),
                        resultSet.getString("facility_id"),
                        resultSet.getString("orca_patient_id"),
                        internalPatientId,
                        resultSet.getString("source_api"),
                        resultSet.getString("source_request_id"),
                        resultSet.getString("source_trace_id"),
                        toInstant(resultSet.getTimestamp("fetched_at")),
                        toInstant(resultSet.getTimestamp("cache_expires_at")),
                        resultSet.getString("cache_status"),
                        resultSet.getString("business_status"),
                        resultSet.getString("raw_response_hash"),
                        resultSet.getString("normalized_payload_json"),
                        resultSet.getString("response_summary_json"));
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load ORCA patient cache", ex);
        }
    }

    private static Map<String, Object> toNormalizedPayload(PatientCacheCommand command) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("apiResult", command.apiResult());
        payload.put("apiResultMessage", command.apiResultMessage());
        payload.put("orcaPatientId", command.orcaPatientId());
        payload.put("sourceSystem", "ORCA");
        payload.put("sourceApi", "patientgetv2");
        payload.put("cacheStatus", command.cacheStatus());
        payload.put("businessStatus", command.businessStatus());
        Map<String, Object> patient = new LinkedHashMap<>();
        patient.put("patientId", command.orcaPatientId());
        patient.put("wholeName", command.wholeName());
        patient.put("wholeNameKana", command.wholeNameKana());
        patient.put("birthDate", command.birthDate());
        patient.put("sex", command.sex());
        patient.put("addressSummary", command.addressSummary());
        patient.put("phoneSummary", command.phoneSummary());
        payload.put("patient", patient);
        return payload;
    }

    private static Map<String, Object> toResponseSummary(PatientCacheCommand command, String rawResponseHash) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("apiResult", command.apiResult());
        summary.put("businessStatus", command.businessStatus());
        summary.put("cacheStatus", command.cacheStatus());
        summary.put("rawResponseHash", rawResponseHash);
        summary.put("rawResponseStored", Boolean.FALSE);
        return summary;
    }

    public static PatientCacheCommand fromOrcaResponse(String facilityId,
            String requestedPatientId,
            String sourceRequestId,
            String sourceTraceId,
            Instant fetchedAt,
            String rawResponseBody) {
        PatientResponseSummary summary = PatientResponseSummary.parse(rawResponseBody, requestedPatientId);
        String businessStatus = summary.businessStatus();
        String cacheStatus = switch (businessStatus) {
            case "ORCA_PATIENT_FOUND" -> "CURRENT";
            case "ORCA_PATIENT_NOT_FOUND" -> "NOT_FOUND";
            case "ORCA_PATIENT_WARNING", "ORCA_PATIENT_UNMATCHED", "ORCA_PATIENT_NEEDS_REVIEW" -> "NEEDS_REVIEW";
            default -> "UNAVAILABLE";
        };
        return new PatientCacheCommand(
                facilityId,
                summary.patientId() != null ? summary.patientId() : requestedPatientId,
                null,
                sourceRequestId,
                sourceTraceId,
                fetchedAt,
                fetchedAt != null ? fetchedAt.plusSeconds(900) : null,
                cacheStatus,
                businessStatus,
                summary.apiResult(),
                summary.apiResultMessage(),
                summary.wholeName(),
                summary.wholeNameKana(),
                summary.birthDate(),
                summary.sex(),
                summary.addressSummary(),
                summary.phoneSummary(),
                rawResponseBody);
    }

    private static String toJson(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize ORCA patient cache payload", ex);
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

    public record PatientCacheCommand(
            String facilityId,
            String orcaPatientId,
            Long internalPatientId,
            String sourceRequestId,
            String sourceTraceId,
            Instant fetchedAt,
            Instant cacheExpiresAt,
            String cacheStatus,
            String businessStatus,
            String apiResult,
            String apiResultMessage,
            String wholeName,
            String wholeNameKana,
            String birthDate,
            String sex,
            String addressSummary,
            String phoneSummary,
            String rawResponseBody) {
    }

    public record PatientCacheRow(
            long id,
            String facilityId,
            String orcaPatientId,
            Long internalPatientId,
            String sourceApi,
            String sourceRequestId,
            String sourceTraceId,
            Instant fetchedAt,
            Instant cacheExpiresAt,
            String cacheStatus,
            String businessStatus,
            String rawResponseHash,
            String normalizedPayloadJson,
            String responseSummaryJson) {
    }

    public record PatientResponseSummary(
            String apiResult,
            String apiResultMessage,
            String patientId,
            String wholeName,
            String wholeNameKana,
            String birthDate,
            String sex,
            String addressSummary,
            String phoneSummary,
            String businessStatus) {

        static PatientResponseSummary parse(String rawResponseBody, String requestedPatientId) {
            if (rawResponseBody == null || rawResponseBody.isBlank()) {
                return new PatientResponseSummary(null, null, requestedPatientId, null, null, null, null, null, null,
                        "ORCA_PATIENT_UNAVAILABLE");
            }
            String trimmed = rawResponseBody.trim();
            if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                return parseJson(trimmed, requestedPatientId);
            }
            return parseText(trimmed, requestedPatientId);
        }

        private static PatientResponseSummary parseJson(String rawResponseBody, String requestedPatientId) {
            try {
                JsonNode root = JSON.readTree(rawResponseBody);
                JsonNode patient = firstObject(root, "Patient_Information", "patientInformation", "patient");
                String apiResult = firstText(root, "Api_Result", "apiResult");
                String apiResultMessage = firstText(root, "Api_Result_Message", "apiResultMessage");
                String patientId = firstText(patient, "Patient_ID", "patientId");
                return new PatientResponseSummary(
                        apiResult,
                        apiResultMessage,
                        patientId != null ? patientId : requestedPatientId,
                        firstText(patient, "WholeName", "wholeName"),
                        firstText(patient, "WholeName_inKana", "wholeNameKana"),
                        firstText(patient, "BirthDate", "birthDate"),
                        firstText(patient, "Sex", "sex"),
                        firstText(patient, "WholeAddress1", "address", "addressSummary"),
                        firstText(patient, "PhoneNumber1", "telephone", "phoneSummary"),
                        classifyBusinessStatus(apiResult, apiResultMessage, patientId != null));
            } catch (JsonProcessingException | IllegalArgumentException ex) {
                return new PatientResponseSummary(null, null, requestedPatientId, null, null, null, null, null, null,
                        "ORCA_PATIENT_NEEDS_REVIEW");
            }
        }

        private static PatientResponseSummary parseText(String rawResponseBody, String requestedPatientId) {
            String apiResult = extractTagValue(rawResponseBody, "Api_Result");
            String apiResultMessage = extractTagValue(rawResponseBody, "Api_Result_Message");
            String patientId = extractTagValue(rawResponseBody, "Patient_ID");
            return new PatientResponseSummary(
                    apiResult,
                    apiResultMessage,
                    patientId != null ? patientId : requestedPatientId,
                    extractTagValue(rawResponseBody, "WholeName"),
                    extractTagValue(rawResponseBody, "WholeName_inKana"),
                    extractTagValue(rawResponseBody, "BirthDate"),
                    extractTagValue(rawResponseBody, "Sex"),
                    extractTagValue(rawResponseBody, "WholeAddress1"),
                    extractTagValue(rawResponseBody, "PhoneNumber1"),
                    classifyBusinessStatus(apiResult, apiResultMessage, patientId != null));
        }

        private static String classifyBusinessStatus(String apiResult, String message, boolean patientPresent) {
            String normalized = normalize(apiResult);
            if (isPatientNotFound(normalized, message)) {
                return "ORCA_PATIENT_NOT_FOUND";
            }
            if (isAllZero(normalized) && patientPresent) {
                return "ORCA_PATIENT_FOUND";
            }
            if (isAllZero(normalized)) {
                return "ORCA_PATIENT_NEEDS_REVIEW";
            }
            if (normalized == null) {
                return "ORCA_PATIENT_UNAVAILABLE";
            }
            return "ORCA_PATIENT_WARNING";
        }

        private static boolean isPatientNotFound(String apiResult, String message) {
            if ("10".equals(apiResult)) {
                return true;
            }
            String normalizedMessage = normalize(message);
            return normalizedMessage != null && normalizedMessage.contains("患者") && normalizedMessage.contains("ありません");
        }

        private static boolean isAllZero(String value) {
            if (value == null || value.isBlank()) {
                return false;
            }
            for (int i = 0; i < value.length(); i++) {
                if (value.charAt(i) != '0') {
                    return false;
                }
            }
            return true;
        }

        private static JsonNode firstObject(JsonNode root, String... names) {
            for (String name : names) {
                JsonNode node = findRecursive(root, name);
                if (node != null && node.isArray() && node.size() > 0) {
                    node = node.get(0);
                }
                if (node != null && node.isObject()) {
                    return node;
                }
            }
            return null;
        }

        private static String firstText(JsonNode root, String... names) {
            if (root == null) {
                return null;
            }
            for (String name : names) {
                JsonNode node = findRecursive(root, name);
                if (node != null && node.isArray() && node.size() > 0) {
                    node = node.get(0);
                }
                if (node != null && node.isValueNode()) {
                    String text = node.asText();
                    return normalize(text);
                }
            }
            return null;
        }

        private static JsonNode findRecursive(JsonNode node, String fieldName) {
            if (node == null || fieldName == null) {
                return null;
            }
            if (node.isObject() && node.has(fieldName)) {
                return node.get(fieldName);
            }
            if (node.isContainerNode()) {
                for (JsonNode child : node) {
                    JsonNode found = findRecursive(child, fieldName);
                    if (found != null) {
                        return found;
                    }
                }
            }
            return null;
        }

        private static String extractTagValue(String payload, String tag) {
            if (payload == null || tag == null) {
                return null;
            }
            String open = "<" + tag;
            int start = payload.indexOf(open);
            if (start < 0) {
                return null;
            }
            int openEnd = payload.indexOf('>', start);
            if (openEnd < 0) {
                return null;
            }
            String close = "</" + tag + ">";
            int closeStart = payload.indexOf(close, openEnd + 1);
            if (closeStart < 0) {
                return null;
            }
            return normalize(payload.substring(openEnd + 1, closeStart));
        }
    }
}
