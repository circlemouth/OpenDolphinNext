package open.dolphin.orca.service;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import javax.sql.DataSource;

@ApplicationScoped
public class OrcaOperationLedgerRepository {

    private static final String SQL_UPSERT_OPERATION = """
            INSERT INTO opendolphin.orca_operation (
                facility_id, operation_scope, operation_type, source_api, operation_status,
                idempotency_key, requested_by, requested_at, sent_at, completed_at,
                orca_patient_id, perform_date, department_code, physician_code,
                insurance_combination_number, request_hash, response_hash, retry_count,
                last_error_code, needs_user_review, request_summary_json, response_summary_json,
                central_audit_trace_id, central_audit_action, unknown_classification, reconciliation_status
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END,
                ?, CAST(? AS DATE), ?, ?, ?, ?, ?, 0, ?, ?, CAST(? AS JSONB), CAST(? AS JSONB),
                ?, ?, ?, ?
            )
            ON CONFLICT (facility_id, source_api, idempotency_key) DO UPDATE SET
                operation_status = EXCLUDED.operation_status,
                response_hash = COALESCE(EXCLUDED.response_hash, opendolphin.orca_operation.response_hash),
                completed_at = COALESCE(EXCLUDED.completed_at, opendolphin.orca_operation.completed_at),
                retry_count = opendolphin.orca_operation.retry_count + 1,
                last_error_code = EXCLUDED.last_error_code,
                needs_user_review = EXCLUDED.needs_user_review,
                response_summary_json = EXCLUDED.response_summary_json,
                central_audit_trace_id = COALESCE(EXCLUDED.central_audit_trace_id, opendolphin.orca_operation.central_audit_trace_id),
                central_audit_action = COALESCE(EXCLUDED.central_audit_action, opendolphin.orca_operation.central_audit_action),
                unknown_classification = EXCLUDED.unknown_classification,
                reconciliation_status = EXCLUDED.reconciliation_status,
                updated_at = CURRENT_TIMESTAMP
            RETURNING orca_operation_id
            """;

    private static final String SQL_INSERT_TRANSMISSION = """
            INSERT INTO opendolphin.orca_transmission (
                orca_operation_id, facility_id, source_api, transmission_status, attempt_number,
                request_hash, response_hash, http_status, api_result, api_result_message_category,
                transport_status, request_id, trace_id, completed_at, elapsed_ms,
                request_summary_json, response_summary_json, error_summary_json
            ) VALUES (
                ?, ?, ?, ?,
                COALESCE((SELECT MAX(attempt_number) + 1 FROM opendolphin.orca_transmission WHERE orca_operation_id = ?), 1),
                ?, ?, ?, ?, ?, ?, ?, ?,
                CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END,
                ?, CAST(? AS JSONB), CAST(? AS JSONB), CAST(? AS JSONB)
            )
            RETURNING orca_transmission_id
            """;

    private static final String SQL_INSERT_RESPONSE_SUMMARY = """
            INSERT INTO opendolphin.orca_response_summary (
                orca_operation_id, orca_transmission_id, facility_id, source_api, operation_status,
                api_result, api_result_message_category, needs_user_review, perform_date,
                department_code, physician_code, insurance_combination_number, response_hash,
                warnings_json, errors_json, unmatched_json, normalized_response_json
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS DATE), ?, ?, ?, ?,
                CAST(? AS JSONB), CAST(? AS JSONB), CAST(? AS JSONB), CAST(? AS JSONB)
            )
            """;

    private static final String SQL_INSERT_RECONCILIATION = """
            INSERT INTO opendolphin.orca_reconciliation_result (
                orca_operation_id, orca_transmission_id, facility_id, reconciliation_type,
                reconciliation_status, source_api, matched_count, total_count, needs_user_review,
                resend_blocked, resend_block_reason, actor_user_id, request_id, trace_id,
                response_hash, summary_json
            ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB))
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public LedgerIds record(RecordCommand command) {
        if (dataSource == null) {
            return LedgerIds.notRecorded();
        }
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                long operationId = upsertOperation(connection, command);
                long transmissionId = insertTransmission(connection, operationId, command);
                if (command.recordResponseSummary()) {
                    insertResponseSummary(connection, operationId, transmissionId, command);
                }
                if (command.recordReconciliation()) {
                    insertReconciliation(connection, operationId, transmissionId, command);
                }
                connection.commit();
                return new LedgerIds(operationId, transmissionId, true);
            } catch (SQLException | RuntimeException ex) {
                connection.rollback();
                throw ex;
            } finally {
                connection.setAutoCommit(true);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to record ORCA operation ledger", ex);
        }
    }

    private static long upsertOperation(Connection connection, RecordCommand command) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_UPSERT_OPERATION)) {
            statement.setString(1, command.facilityId());
            statement.setString(2, command.operationScope());
            statement.setString(3, command.operationType());
            statement.setString(4, command.sourceApi());
            statement.setString(5, command.operationStatus());
            statement.setString(6, command.idempotencyKey());
            statement.setString(7, command.requestedBy());
            statement.setBoolean(8, command.completed());
            statement.setString(9, command.orcaPatientId());
            statement.setString(10, command.performDate());
            statement.setString(11, command.departmentCode());
            statement.setString(12, command.physicianCode());
            statement.setString(13, command.insuranceCombinationNumber());
            statement.setString(14, command.requestHash());
            statement.setString(15, command.responseHash());
            statement.setString(16, command.lastErrorCode());
            statement.setBoolean(17, command.needsUserReview());
            statement.setString(18, command.requestSummaryJson());
            statement.setString(19, command.responseSummaryJson());
            statement.setString(20, command.traceId());
            statement.setString(21, command.centralAuditAction());
            statement.setString(22, command.unknownClassification());
            statement.setString(23, command.reconciliationStatus());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new SQLException("ORCA operation upsert returned no id");
                }
                return resultSet.getLong(1);
            }
        }
    }

    private static long insertTransmission(Connection connection, long operationId, RecordCommand command)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_INSERT_TRANSMISSION)) {
            statement.setLong(1, operationId);
            statement.setString(2, command.facilityId());
            statement.setString(3, command.sourceApi());
            statement.setString(4, command.operationStatus());
            statement.setLong(5, operationId);
            statement.setString(6, command.requestHash());
            statement.setString(7, command.responseHash());
            if (command.httpStatus() != null) {
                statement.setInt(8, command.httpStatus());
            } else {
                statement.setObject(8, null);
            }
            statement.setString(9, command.apiResult());
            statement.setString(10, command.apiResultMessageCategory());
            statement.setString(11, command.transportStatus());
            statement.setString(12, command.traceId());
            statement.setString(13, command.traceId());
            statement.setBoolean(14, command.completed());
            statement.setObject(15, command.elapsedMs());
            statement.setString(16, command.requestSummaryJson());
            statement.setString(17, command.responseSummaryJson());
            statement.setString(18, command.errorSummaryJson());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new SQLException("ORCA transmission insert returned no id");
                }
                return resultSet.getLong(1);
            }
        }
    }

    private static void insertResponseSummary(Connection connection, long operationId, long transmissionId,
            RecordCommand command) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_INSERT_RESPONSE_SUMMARY)) {
            statement.setLong(1, operationId);
            statement.setLong(2, transmissionId);
            statement.setString(3, command.facilityId());
            statement.setString(4, command.sourceApi());
            statement.setString(5, command.operationStatus());
            statement.setString(6, command.apiResult());
            statement.setString(7, command.apiResultMessageCategory());
            statement.setBoolean(8, command.needsUserReview());
            statement.setString(9, command.performDate());
            statement.setString(10, command.departmentCode());
            statement.setString(11, command.physicianCode());
            statement.setString(12, command.insuranceCombinationNumber());
            statement.setString(13, command.responseHash());
            statement.setString(14, command.warningsJson());
            statement.setString(15, command.errorsJson());
            statement.setString(16, command.unmatchedJson());
            statement.setString(17, command.normalizedResponseJson());
            statement.executeUpdate();
        }
    }

    private static void insertReconciliation(Connection connection, long operationId, long transmissionId,
            RecordCommand command) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SQL_INSERT_RECONCILIATION)) {
            statement.setLong(1, operationId);
            statement.setLong(2, transmissionId);
            statement.setString(3, command.facilityId());
            statement.setString(4, command.reconciliationType());
            statement.setString(5, command.reconciliationStatus());
            statement.setString(6, command.reconciliationSourceApi());
            statement.setBoolean(7, command.needsUserReview());
            statement.setBoolean(8, command.resendBlocked());
            statement.setString(9, command.resendBlockReason());
            statement.setString(10, command.requestedBy());
            statement.setString(11, command.traceId());
            statement.setString(12, command.traceId());
            statement.setString(13, command.responseHash());
            statement.setString(14, command.reconciliationSummaryJson());
            statement.executeUpdate();
        }
    }

    public record LedgerIds(long operationId, long transmissionId, boolean recorded) {
        public static LedgerIds notRecorded() {
            return new LedgerIds(-1L, -1L, false);
        }
    }

    public record RecordCommand(
            String facilityId,
            String operationScope,
            String operationType,
            String sourceApi,
            String operationStatus,
            String idempotencyKey,
            String requestedBy,
            String orcaPatientId,
            String performDate,
            String departmentCode,
            String physicianCode,
            String insuranceCombinationNumber,
            String requestHash,
            String responseHash,
            Integer httpStatus,
            String apiResult,
            String apiResultMessageCategory,
            String transportStatus,
            String lastErrorCode,
            boolean needsUserReview,
            String requestSummaryJson,
            String responseSummaryJson,
            String errorSummaryJson,
            String warningsJson,
            String errorsJson,
            String unmatchedJson,
            String normalizedResponseJson,
            String traceId,
            String centralAuditAction,
            String unknownClassification,
            String reconciliationStatus,
            String reconciliationType,
            String reconciliationSourceApi,
            boolean resendBlocked,
            String resendBlockReason,
            String reconciliationSummaryJson,
            Long elapsedMs,
            Instant recordedAt) {

        boolean completed() {
            return responseHash != null || lastErrorCode != null;
        }

        boolean recordResponseSummary() {
            return responseHash != null || lastErrorCode != null || needsUserReview;
        }

        boolean recordReconciliation() {
            return reconciliationStatus != null && reconciliationType != null && reconciliationSourceApi != null;
        }
    }
}
