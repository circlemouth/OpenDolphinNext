package open.dolphin.orca.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import javax.sql.DataSource;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
import open.dolphin.rest.dto.orca.OrcaReportResponse;
import open.dolphin.security.HashUtil;

@ApplicationScoped
public class OrcaBillingCacheStore {

    private static final ObjectMapper JSON = AbstractResource.getSerializeMapper();

    private static final String SQL_INSERT_BILLING_CACHE = """
            INSERT INTO opendolphin.orca_billing_cache (
                facility_id,
                source_api,
                cache_status,
                orca_patient_id,
                base_date,
                http_status,
                api_result,
                api_result_message_category,
                request_hash,
                response_hash,
                entry_count,
                invoice_hashes_json,
                unpaid_money_total,
                unpaid_money_overflow,
                normalized_summary_json,
                fetched_at,
                cache_expires_at
            ) VALUES (?, 'incomeinfv2', ?, ?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), ?, ?, cast(? as jsonb), ?, ?)
            """;

    private static final String SQL_INSERT_REPORT_SNAPSHOT = """
            INSERT INTO opendolphin.orca_report_snapshot (
                facility_id,
                source_api,
                report_type,
                snapshot_status,
                orca_patient_id,
                request_hash,
                response_hash,
                invoice_number_hash,
                data_id_hash,
                form_id,
                form_name,
                http_status,
                api_result,
                api_result_message_category,
                summary_json,
                fetched_at,
                snapshot_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), ?, 'ORCA_REPORT_FETCH')
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public void saveIncomeInfo(IncomeInfoCommand command) {
        Objects.requireNonNull(command, "command");
        requireText(command.facilityId(), "facilityId");
        requireText(command.orcaPatientId(), "orcaPatientId");
        requireText(command.baseDate(), "baseDate");
        requireText(command.requestBody(), "requestBody");
        Instant fetchedAt = command.fetchedAt() != null ? command.fetchedAt() : Instant.now();
        Instant cacheExpiresAt = fetchedAt.plusSeconds(900);
        ChartSupportIncomeInfoResponse response = command.response();
        String requestHash = HashUtil.sha256(command.requestBody());
        String responseHash = normalize(command.responseBody()) != null ? HashUtil.sha256(command.responseBody()) : null;
        String cacheStatus = response != null && response.isOk() ? "CURRENT" : "UNAVAILABLE";
        List<String> invoiceHashes = invoiceHashes(response);
        String summaryJson = toJson(incomeSummary(response, invoiceHashes));

        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_INSERT_BILLING_CACHE)) {
            statement.setString(1, command.facilityId().trim());
            statement.setString(2, cacheStatus);
            statement.setString(3, command.orcaPatientId().trim());
            statement.setString(4, command.baseDate().trim());
            statement.setObject(5, response != null ? response.getStatus() : null);
            statement.setString(6, response != null ? normalize(response.getApiResult()) : null);
            statement.setString(7, response != null ? normalize(response.getApiResultMessage()) : null);
            statement.setString(8, requestHash);
            statement.setString(9, responseHash);
            statement.setInt(10, response != null && response.getEntries() != null ? response.getEntries().size() : 0);
            statement.setString(11, toJson(invoiceHashes));
            if (response != null && response.getUnpaidMoneyTotal() != null) {
                statement.setDouble(12, response.getUnpaidMoneyTotal());
            } else {
                statement.setObject(12, null);
            }
            statement.setBoolean(13, response != null && Boolean.TRUE.equals(response.getUnpaidMoneyInformationOverflow()));
            statement.setString(14, summaryJson);
            statement.setTimestamp(15, Timestamp.from(fetchedAt));
            statement.setTimestamp(16, Timestamp.from(cacheExpiresAt));
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to persist sanitized ORCA billing cache", ex);
        }
    }

    public void saveReportSnapshot(ReportSnapshotCommand command) {
        Objects.requireNonNull(command, "command");
        requireText(command.facilityId(), "facilityId");
        requireText(command.orcaPatientId(), "orcaPatientId");
        requireText(command.reportType(), "reportType");
        requireText(command.requestBody(), "requestBody");
        Instant fetchedAt = command.fetchedAt() != null ? command.fetchedAt() : Instant.now();
        OrcaReportResponse response = command.response();
        String requestHash = HashUtil.sha256(command.requestBody());
        String responseHash = normalize(command.responseBody()) != null ? HashUtil.sha256(command.responseBody()) : null;
        String snapshotStatus = response != null && response.isOk() ? "CURRENT" : "UNAVAILABLE";
        String normalizedType = normalizeReportType(command.reportType());
        String sourceApi = sourceApiForReportType(normalizedType);
        String invoiceHash = normalize(command.invoiceNumber()) != null ? HashUtil.sha256(command.invoiceNumber().trim()) : null;
        String dataIdHash = response != null && normalize(response.getDataId()) != null
                ? HashUtil.sha256(response.getDataId().trim())
                : null;
        String summaryJson = toJson(reportSummary(response, invoiceHash, dataIdHash));

        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_INSERT_REPORT_SNAPSHOT)) {
            statement.setString(1, command.facilityId().trim());
            statement.setString(2, sourceApi);
            statement.setString(3, normalizedType);
            statement.setString(4, snapshotStatus);
            statement.setString(5, command.orcaPatientId().trim());
            statement.setString(6, requestHash);
            statement.setString(7, responseHash);
            statement.setString(8, invoiceHash);
            statement.setString(9, dataIdHash);
            statement.setString(10, response != null ? normalize(response.getFormId()) : null);
            statement.setString(11, response != null ? normalize(response.getFormName()) : null);
            statement.setObject(12, response != null ? response.getStatus() : null);
            statement.setString(13, response != null ? normalize(response.getApiResult()) : null);
            statement.setString(14, response != null ? normalize(response.getApiResultMessage()) : null);
            statement.setString(15, summaryJson);
            statement.setTimestamp(16, Timestamp.from(fetchedAt));
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to persist sanitized ORCA report snapshot", ex);
        }
    }

    private static Map<String, Object> incomeSummary(ChartSupportIncomeInfoResponse response, List<String> invoiceHashes) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("source", "ORCA");
        summary.put("api", "incomeinfv2");
        summary.put("ok", response != null && response.isOk());
        summary.put("apiOk", response != null && response.isApiOk());
        summary.put("entryCount", response != null && response.getEntries() != null ? response.getEntries().size() : 0);
        summary.put("invoiceHashes", invoiceHashes);
        summary.put("unpaidMoneyTotal", response != null ? response.getUnpaidMoneyTotal() : null);
        summary.put("unpaidMoneyOverflow", response != null && Boolean.TRUE.equals(response.getUnpaidMoneyInformationOverflow()));
        summary.put("entries", sanitizedIncomeEntries(response));
        return summary;
    }

    private static List<Map<String, Object>> sanitizedIncomeEntries(ChartSupportIncomeInfoResponse response) {
        if (response == null || response.getEntries() == null) {
            return List.of();
        }
        List<Map<String, Object>> entries = new ArrayList<>();
        for (ChartSupportIncomeInfoResponse.Entry entry : response.getEntries()) {
            if (entry == null) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("performDate", normalize(entry.getPerformDate()));
            row.put("performEndDate", normalize(entry.getPerformEndDate()));
            row.put("issuedDate", normalize(entry.getIssuedDate()));
            row.put("inOut", normalize(entry.getInOut()));
            row.put("departmentCode", normalize(entry.getDepartmentCode()));
            row.put("departmentName", normalize(entry.getDepartmentName()));
            row.put("invoiceNumberPresent", normalize(entry.getInvoiceNumber()) != null);
            row.put("invoiceNumberHash", hashNullable(entry.getInvoiceNumber()));
            row.put("groupInvoiceNumberPresent", normalize(entry.getGroupInvoiceNumber()) != null);
            row.put("groupInvoiceNumberHash", hashNullable(entry.getGroupInvoiceNumber()));
            row.put("insuranceCombinationNumberPresent", normalize(entry.getInsuranceCombinationNumber()) != null);
            row.put("insuranceCombinationNumberHash", hashNullable(entry.getInsuranceCombinationNumber()));
            row.put("acMoney", entry.getAcMoney());
            row.put("icMoney", entry.getIcMoney());
            row.put("aiMoney", entry.getAiMoney());
            row.put("oeMoney", entry.getOeMoney());
            row.put("mlSmoney", entry.getMlSmoney());
            entries.add(row);
        }
        return entries;
    }

    private static Map<String, Object> reportSummary(OrcaReportResponse response, String invoiceHash, String dataIdHash) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("source", "ORCA");
        summary.put("ok", response != null && response.isOk());
        summary.put("invoiceNumberPresent", invoiceHash != null);
        summary.put("invoiceNumberHash", invoiceHash);
        summary.put("dataIdPresent", dataIdHash != null);
        summary.put("dataIdHash", dataIdHash);
        summary.put("formId", response != null ? normalize(response.getFormId()) : null);
        summary.put("formName", response != null ? normalize(response.getFormName()) : null);
        return summary;
    }

    private static List<String> invoiceHashes(ChartSupportIncomeInfoResponse response) {
        if (response == null || response.getEntries() == null) {
            return List.of();
        }
        List<String> hashes = new ArrayList<>();
        for (ChartSupportIncomeInfoResponse.Entry entry : response.getEntries()) {
            if (entry != null && normalize(entry.getInvoiceNumber()) != null) {
                hashes.add(HashUtil.sha256(entry.getInvoiceNumber().trim()));
            }
        }
        return hashes;
    }

    private static String hashNullable(String value) {
        String normalized = normalize(value);
        return normalized != null ? HashUtil.sha256(normalized) : null;
    }

    private static String normalizeReportType(String type) {
        String normalized = requireText(type, "reportType").replace("-", "").replace("_", "").toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "prescription" -> "PRESCRIPTION";
            case "medicinenotebook" -> "MEDICINE_NOTEBOOK";
            case "karteno1" -> "KARTENO1";
            case "karteno3" -> "KARTENO3";
            case "invoicereceipt" -> "INVOICE_RECEIPT";
            case "statement" -> "STATEMENT";
            default -> throw new IllegalArgumentException("unsupported ORCA report type");
        };
    }

    private static String sourceApiForReportType(String type) {
        return switch (type) {
            case "PRESCRIPTION" -> "prescriptionv2";
            case "MEDICINE_NOTEBOOK" -> "medicine_notebookv2";
            case "KARTENO1" -> "karte_no1v2";
            case "KARTENO3" -> "karte_no3v2";
            case "INVOICE_RECEIPT" -> "invoice_receiptv2";
            case "STATEMENT" -> "statementv2";
            default -> throw new IllegalArgumentException("unsupported ORCA report type");
        };
    }

    private static String toJson(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize sanitized ORCA billing summary", ex);
        }
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String requireText(String value, String name) {
        String normalized = normalize(value);
        if (normalized == null) {
            throw new IllegalArgumentException(name + " is required");
        }
        return normalized;
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not configured");
        }
        return dataSource;
    }

    public record IncomeInfoCommand(
            String facilityId,
            String orcaPatientId,
            String baseDate,
            String requestBody,
            String responseBody,
            ChartSupportIncomeInfoResponse response,
            Instant fetchedAt) {
    }

    public record ReportSnapshotCommand(
            String facilityId,
            String orcaPatientId,
            String reportType,
            String invoiceNumber,
            String requestBody,
            String responseBody,
            OrcaReportResponse response,
            Instant fetchedAt) {
    }
}
