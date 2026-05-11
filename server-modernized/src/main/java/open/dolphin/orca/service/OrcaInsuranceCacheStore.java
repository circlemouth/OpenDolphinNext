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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import javax.sql.DataSource;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.dto.orca.InsuranceCombination;
import open.dolphin.rest.dto.orca.InsuranceCombinationResponse;

@ApplicationScoped
public class OrcaInsuranceCacheStore {

    private static final ObjectMapper JSON = AbstractResource.getSerializeMapper();

    private static final String SQL_SELECT_CACHE = """
            SELECT orca_insurance_cache_id, row_hash, cache_status
              FROM opendolphin.orca_insurance_cache
             WHERE facility_id = ?
               AND orca_patient_id = ?
               AND base_date = ?
               AND insurance_combination_number = ?
             LIMIT 1
            """;

    private static final String SQL_UPSERT_CACHE = """
            INSERT INTO opendolphin.orca_insurance_cache (
                facility_id, orca_patient_id, base_date, insurance_combination_number,
                insurance_provider_class, insurance_provider_name, rate_admission, rate_outpatient,
                certificate_start_date, certificate_expired_date, public_insurance_count,
                source_system, source_api, source_request_id, source_trace_id, fetched_at, cache_expires_at,
                cache_status, row_hash, normalized_payload_json, response_summary_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ORCA', 'insuranceinf1v2', ?, ?, ?, ?, ?, ?,
                      cast(? as jsonb), cast(? as jsonb))
            ON CONFLICT (facility_id, orca_patient_id, base_date, insurance_combination_number) DO UPDATE SET
                insurance_provider_class = EXCLUDED.insurance_provider_class,
                insurance_provider_name = EXCLUDED.insurance_provider_name,
                rate_admission = EXCLUDED.rate_admission,
                rate_outpatient = EXCLUDED.rate_outpatient,
                certificate_start_date = EXCLUDED.certificate_start_date,
                certificate_expired_date = EXCLUDED.certificate_expired_date,
                public_insurance_count = EXCLUDED.public_insurance_count,
                source_request_id = EXCLUDED.source_request_id,
                source_trace_id = EXCLUDED.source_trace_id,
                fetched_at = EXCLUDED.fetched_at,
                cache_expires_at = EXCLUDED.cache_expires_at,
                cache_status = EXCLUDED.cache_status,
                row_hash = EXCLUDED.row_hash,
                normalized_payload_json = EXCLUDED.normalized_payload_json,
                response_summary_json = EXCLUDED.response_summary_json,
                updated_at = CURRENT_TIMESTAMP
            RETURNING orca_insurance_cache_id
            """;

    private static final String SQL_INSERT_SNAPSHOT = """
            INSERT INTO opendolphin.encounter_insurance_snapshot (
                encounter_key, insurance_slot, snapshot_json, facility_id, chart_revision_id,
                orca_patient_id, acceptance_date, orca_acceptance_id, department_code, physician_code,
                insurance_combination_number, source_cache_id, source_system, snapshot_reason,
                snapshot_created_at, response_summary_json
            ) VALUES (?, ?, cast(? as jsonb), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ORCA', ?, ?, cast(? as jsonb))
            ON CONFLICT (encounter_key, insurance_slot) DO NOTHING
            RETURNING encounter_key
            """;

    private static final String SQL_SELECT_SNAPSHOT = """
            SELECT encounter_key, insurance_slot, facility_id, chart_revision_id, orca_patient_id,
                   acceptance_date, orca_acceptance_id, department_code, physician_code,
                   insurance_combination_number, source_cache_id, snapshot_reason,
                   snapshot_created_at, snapshot_json::text, response_summary_json::text
              FROM opendolphin.encounter_insurance_snapshot
             WHERE encounter_key = ?
               AND insurance_slot = ?
             LIMIT 1
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public InsuranceCacheResult saveInsuranceCombinations(InsuranceCacheCommand command) {
        Objects.requireNonNull(command, "command");
        requireText(command.facilityId(), "facilityId");
        requireText(command.orcaPatientId(), "orcaPatientId");
        requireText(command.baseDate(), "baseDate");
        Instant fetchedAt = command.fetchedAt() != null ? command.fetchedAt() : Instant.now();
        Instant cacheExpiresAt = command.cacheExpiresAt() != null ? command.cacheExpiresAt() : fetchedAt.plusSeconds(900);
        InsuranceCombinationResponse response = command.response() != null
                ? command.response()
                : new InsuranceCombinationResponse();

        int upserted = 0;
        int diffDetected = 0;
        int needsReview = 0;
        try (Connection connection = requireDataSource().getConnection()) {
            for (InsuranceCombination combination : response.getCombinations()) {
                InsuranceCacheRow row = toCacheRow(command, combination, fetchedAt);
                ExistingCacheRow existing = findExistingCache(connection, row);
                String status = row.insuranceCombinationNumber() == null ? "NEEDS_REVIEW"
                        : existing != null && !Objects.equals(existing.rowHash(), row.rowHash())
                                ? "DIFF_DETECTED"
                                : "CURRENT";
                if ("DIFF_DETECTED".equals(status)) {
                    diffDetected++;
                }
                if ("NEEDS_REVIEW".equals(status)) {
                    needsReview++;
                }
                upsertCache(connection, command, row, fetchedAt, cacheExpiresAt, status,
                        existing != null && !Objects.equals(existing.rowHash(), row.rowHash()));
                upserted++;
            }
            return new InsuranceCacheResult(upserted, diffDetected, needsReview);
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to save ORCA insurance cache", ex);
        }
    }

    public SnapshotResult createEncounterSnapshot(EncounterInsuranceSnapshotCommand command) {
        Objects.requireNonNull(command, "command");
        requireText(command.encounterKey(), "encounterKey");
        requireText(command.insuranceSlot(), "insuranceSlot");
        requireText(command.facilityId(), "facilityId");
        requireText(command.orcaPatientId(), "orcaPatientId");
        requireText(command.insuranceCombinationNumber(), "insuranceCombinationNumber");
        Instant snapshotCreatedAt = command.snapshotCreatedAt() != null ? command.snapshotCreatedAt() : Instant.now();
        Map<String, Object> payload = snapshotPayload(command);
        Map<String, Object> summary = snapshotSummary(command, false, List.of());

        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_INSERT_SNAPSHOT)) {
            statement.setString(1, command.encounterKey().trim());
            statement.setString(2, command.insuranceSlot().trim());
            statement.setString(3, toJson(payload));
            statement.setString(4, command.facilityId().trim());
            if (command.chartRevisionId() != null) {
                statement.setLong(5, command.chartRevisionId());
            } else {
                statement.setObject(5, null);
            }
            statement.setString(6, command.orcaPatientId().trim());
            statement.setString(7, normalize(command.acceptanceDate()));
            statement.setString(8, normalize(command.orcaAcceptanceId()));
            statement.setString(9, normalize(command.departmentCode()));
            statement.setString(10, normalize(command.physicianCode()));
            statement.setString(11, command.insuranceCombinationNumber().trim());
            if (command.sourceCacheId() != null) {
                statement.setLong(12, command.sourceCacheId());
            } else {
                statement.setObject(12, null);
            }
            statement.setString(13, firstText(command.snapshotReason(), "CHART_CONTEXT"));
            statement.setTimestamp(14, Timestamp.from(snapshotCreatedAt));
            statement.setString(15, toJson(summary));
            try (ResultSet resultSet = statement.executeQuery()) {
                if (resultSet.next()) {
                    return new SnapshotResult(true, false, List.of());
                }
            }
            SnapshotRow existing = findSnapshot(command.encounterKey(), command.insuranceSlot());
            List<String> changedFields = snapshotChangedFields(existing, command);
            return new SnapshotResult(false, !changedFields.isEmpty(), changedFields);
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to create encounter insurance snapshot", ex);
        }
    }

    public SnapshotRow findSnapshot(String encounterKey, String insuranceSlot) {
        if (normalize(encounterKey) == null || normalize(insuranceSlot) == null || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_SNAPSHOT)) {
            statement.setString(1, encounterKey.trim());
            statement.setString(2, insuranceSlot.trim());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                Long chartRevisionId = resultSet.getObject("chart_revision_id") != null
                        ? resultSet.getLong("chart_revision_id")
                        : null;
                Long sourceCacheId = resultSet.getObject("source_cache_id") != null
                        ? resultSet.getLong("source_cache_id")
                        : null;
                Timestamp createdAt = resultSet.getTimestamp("snapshot_created_at");
                return new SnapshotRow(
                        resultSet.getString("encounter_key"),
                        resultSet.getString("insurance_slot"),
                        resultSet.getString("facility_id"),
                        chartRevisionId,
                        resultSet.getString("orca_patient_id"),
                        resultSet.getString("acceptance_date"),
                        resultSet.getString("orca_acceptance_id"),
                        resultSet.getString("department_code"),
                        resultSet.getString("physician_code"),
                        resultSet.getString("insurance_combination_number"),
                        sourceCacheId,
                        resultSet.getString("snapshot_reason"),
                        createdAt != null ? createdAt.toInstant() : null,
                        resultSet.getString("snapshot_json"),
                        resultSet.getString("response_summary_json"));
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load encounter insurance snapshot", ex);
        }
    }

    private ExistingCacheRow findExistingCache(Connection connection, InsuranceCacheRow row) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_SELECT_CACHE)) {
            statement.setString(1, row.facilityId());
            statement.setString(2, row.orcaPatientId());
            statement.setString(3, row.baseDate());
            statement.setString(4, row.insuranceCombinationNumber());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return new ExistingCacheRow(
                        resultSet.getLong("orca_insurance_cache_id"),
                        resultSet.getString("row_hash"),
                        resultSet.getString("cache_status"));
            }
        }
    }

    private void upsertCache(Connection connection,
            InsuranceCacheCommand command,
            InsuranceCacheRow row,
            Instant fetchedAt,
            Instant cacheExpiresAt,
            String status,
            boolean diffDetected) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_UPSERT_CACHE)) {
            statement.setString(1, row.facilityId());
            statement.setString(2, row.orcaPatientId());
            statement.setString(3, row.baseDate());
            statement.setString(4, row.insuranceCombinationNumber());
            statement.setString(5, row.insuranceProviderClass());
            statement.setString(6, row.insuranceProviderName());
            statement.setString(7, row.rateAdmission());
            statement.setString(8, row.rateOutpatient());
            statement.setString(9, row.certificateStartDate());
            statement.setString(10, row.certificateExpiredDate());
            statement.setInt(11, row.publicInsuranceCount());
            statement.setString(12, normalize(command.sourceRequestId()));
            statement.setString(13, normalize(command.sourceTraceId()));
            statement.setTimestamp(14, Timestamp.from(fetchedAt));
            statement.setTimestamp(15, Timestamp.from(cacheExpiresAt));
            statement.setString(16, status);
            statement.setString(17, row.rowHash());
            statement.setString(18, toJson(normalizedPayload(row, status)));
            statement.setString(19, toJson(responseSummary(row, status, diffDetected)));
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new SQLException("ORCA insurance cache upsert returned no id");
                }
            }
        }
    }

    private static InsuranceCacheRow toCacheRow(InsuranceCacheCommand command,
            InsuranceCombination combination,
            Instant fetchedAt) {
        String combinationNumber = normalize(combination != null ? combination.getCombinationNumber() : null);
        String providerClass = normalize(combination != null ? combination.getInsuranceProviderClass() : null);
        String providerName = normalize(combination != null ? combination.getInsuranceProviderName() : null);
        String rateAdmission = normalize(combination != null ? combination.getRateAdmission() : null);
        String rateOutpatient = normalize(combination != null ? combination.getRateOutpatient() : null);
        String startDate = normalize(combination != null ? combination.getCertificateStartDate() : null);
        String expiredDate = normalize(combination != null ? combination.getCertificateExpiredDate() : null);
        int publicInsuranceCount = combination != null ? combination.getPublicInsurances().size() : 0;
        String hashSeed = String.join("|",
                command.facilityId().trim(),
                command.orcaPatientId().trim(),
                command.baseDate().trim(),
                firstText(combinationNumber, ""),
                firstText(providerClass, ""),
                firstText(providerName, ""),
                firstText(rateAdmission, ""),
                firstText(rateOutpatient, ""),
                firstText(startDate, ""),
                firstText(expiredDate, ""),
                String.valueOf(publicInsuranceCount),
                "");
        return new InsuranceCacheRow(
                command.facilityId().trim(),
                command.orcaPatientId().trim(),
                command.baseDate().trim(),
                combinationNumber,
                providerClass,
                providerName,
                rateAdmission,
                rateOutpatient,
                startDate,
                expiredDate,
                publicInsuranceCount,
                sha256Hex(hashSeed));
    }

    private static Map<String, Object> normalizedPayload(InsuranceCacheRow row, String status) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sourceSystem", "ORCA");
        payload.put("sourceApi", "insuranceinf1v2");
        payload.put("orcaPatientId", row.orcaPatientId());
        payload.put("baseDate", row.baseDate());
        payload.put("insuranceCombinationNumber", row.insuranceCombinationNumber());
        payload.put("insuranceProviderClass", row.insuranceProviderClass());
        payload.put("insuranceProviderName", row.insuranceProviderName());
        payload.put("rateAdmission", row.rateAdmission());
        payload.put("rateOutpatient", row.rateOutpatient());
        payload.put("certificateStartDate", row.certificateStartDate());
        payload.put("certificateExpiredDate", row.certificateExpiredDate());
        payload.put("publicInsuranceCount", row.publicInsuranceCount());
        payload.put("cacheStatus", status);
        payload.put("rawResponseStored", Boolean.FALSE);
        return payload;
    }

    private static Map<String, Object> responseSummary(InsuranceCacheRow row, String status, boolean diffDetected) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("cacheStatus", status);
        summary.put("diffDetected", diffDetected);
        summary.put("rowHash", row.rowHash());
        summary.put("insuranceCombinationNumber", row.insuranceCombinationNumber());
        summary.put("publicInsuranceCount", row.publicInsuranceCount());
        summary.put("rawResponseStored", Boolean.FALSE);
        return summary;
    }

    private static Map<String, Object> snapshotPayload(EncounterInsuranceSnapshotCommand command) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sourceSystem", "ORCA");
        payload.put("snapshotReason", firstText(command.snapshotReason(), "CHART_CONTEXT"));
        payload.put("orcaPatientId", command.orcaPatientId());
        payload.put("acceptanceDate", command.acceptanceDate());
        payload.put("orcaAcceptanceId", command.orcaAcceptanceId());
        payload.put("departmentCode", command.departmentCode());
        payload.put("physicianCode", command.physicianCode());
        payload.put("insuranceCombinationNumber", command.insuranceCombinationNumber());
        payload.put("sourceCacheId", command.sourceCacheId());
        payload.put("rawResponseStored", Boolean.FALSE);
        return payload;
    }

    private static Map<String, Object> snapshotSummary(EncounterInsuranceSnapshotCommand command,
            boolean diffDetected,
            List<String> changedFields) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("snapshotReason", firstText(command.snapshotReason(), "CHART_CONTEXT"));
        summary.put("diffDetected", diffDetected);
        summary.put("changedFields", changedFields);
        summary.put("insuranceCombinationNumber", command.insuranceCombinationNumber());
        summary.put("rawResponseStored", Boolean.FALSE);
        return summary;
    }

    private static List<String> snapshotChangedFields(SnapshotRow existing, EncounterInsuranceSnapshotCommand next) {
        List<String> changed = new ArrayList<>();
        if (existing == null) {
            return changed;
        }
        compare(changed, "facilityId", existing.facilityId(), next.facilityId());
        compare(changed, "orcaPatientId", existing.orcaPatientId(), next.orcaPatientId());
        compare(changed, "acceptanceDate", existing.acceptanceDate(), next.acceptanceDate());
        compare(changed, "orcaAcceptanceId", existing.orcaAcceptanceId(), next.orcaAcceptanceId());
        compare(changed, "departmentCode", existing.departmentCode(), next.departmentCode());
        compare(changed, "physicianCode", existing.physicianCode(), next.physicianCode());
        compare(changed, "insuranceCombinationNumber", existing.insuranceCombinationNumber(),
                next.insuranceCombinationNumber());
        return changed;
    }

    private static void compare(List<String> changed, String field, String previous, String next) {
        if (!Objects.equals(normalize(previous), normalize(next))) {
            changed.add(field);
        }
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
            throw new IllegalStateException("Failed to serialize ORCA insurance payload", ex);
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

    private static void requireText(String value, String field) {
        if (normalize(value) == null) {
            throw new IllegalArgumentException(field + " is required");
        }
    }

    private static String firstText(String value, String fallback) {
        String normalized = normalize(value);
        return normalized != null ? normalized : normalize(fallback);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record InsuranceCacheCommand(
            String facilityId,
            String orcaPatientId,
            String baseDate,
            String sourceRequestId,
            String sourceTraceId,
            Instant fetchedAt,
            Instant cacheExpiresAt,
            InsuranceCombinationResponse response) {
        public InsuranceCacheCommand {
            response = copyResponse(response);
        }

        @Override
        public InsuranceCombinationResponse response() {
            return copyResponse(response);
        }
    }

    public record InsuranceCacheResult(int upsertedCount, int diffDetectedCount, int needsReviewCount) {
    }

    public record EncounterInsuranceSnapshotCommand(
            String encounterKey,
            String insuranceSlot,
            String facilityId,
            Long chartRevisionId,
            String orcaPatientId,
            String acceptanceDate,
            String orcaAcceptanceId,
            String departmentCode,
            String physicianCode,
            String insuranceCombinationNumber,
            Long sourceCacheId,
            String snapshotReason,
            Instant snapshotCreatedAt) {
    }

    public record SnapshotResult(boolean created, boolean diffDetected, List<String> changedFields) {
        public SnapshotResult {
            changedFields = changedFields == null ? List.of() : List.copyOf(changedFields);
        }

        @Override
        public List<String> changedFields() {
            return List.copyOf(changedFields);
        }
    }

    public record SnapshotRow(
            String encounterKey,
            String insuranceSlot,
            String facilityId,
            Long chartRevisionId,
            String orcaPatientId,
            String acceptanceDate,
            String orcaAcceptanceId,
            String departmentCode,
            String physicianCode,
            String insuranceCombinationNumber,
            Long sourceCacheId,
            String snapshotReason,
            Instant snapshotCreatedAt,
            String snapshotJson,
            String responseSummaryJson) {
    }

    private record ExistingCacheRow(long id, String rowHash, String cacheStatus) {
    }

    private record InsuranceCacheRow(
            String facilityId,
            String orcaPatientId,
            String baseDate,
            String insuranceCombinationNumber,
            String insuranceProviderClass,
            String insuranceProviderName,
            String rateAdmission,
            String rateOutpatient,
            String certificateStartDate,
            String certificateExpiredDate,
            int publicInsuranceCount,
            String rowHash) {
    }

    private static InsuranceCombinationResponse copyResponse(InsuranceCombinationResponse response) {
        if (response == null) {
            return null;
        }
        InsuranceCombinationResponse copy = JSON.convertValue(response, InsuranceCombinationResponse.class);
        copy.getCombinations().clear();
        for (InsuranceCombination combination : response.getCombinations()) {
            copy.getCombinations().add(JSON.convertValue(combination, InsuranceCombination.class));
        }
        return copy;
    }
}
