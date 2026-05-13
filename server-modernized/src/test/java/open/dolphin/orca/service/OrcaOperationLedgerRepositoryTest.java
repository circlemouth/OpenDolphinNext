package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class OrcaOperationLedgerRepositoryTest {

    private static final String HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    @Test
    void recordsWarningAsNeedsReviewWithoutRawPayloadAndKeepsAuditTrace() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaOperationLedgerRepository repository = new OrcaOperationLedgerRepository();
            repository.dataSource = dataSource;

            OrcaOperationLedgerRepository.LedgerIds ids = repository.record(command(
                    "ORCA_WARNING",
                    "WARNING_NEEDS_REVIEW",
                    "PENDING",
                    "HTTP_OK",
                    "K1"));

            assertTrue(ids.recorded());
            try (Connection connection = dataSource.getConnection()) {
                assertEquals(1, countRows(connection,
                        "select count(*) from opendolphin.orca_operation where operation_status = 'ORCA_WARNING' and needs_user_review = true and central_audit_trace_id = 'trace-ledger-1'"));
                assertEquals(1, countRows(connection,
                        "select count(*) from opendolphin.orca_response_summary where operation_status = 'ORCA_WARNING' and warnings_json <> '[]'::jsonb"));
                assertEquals(1, countRows(connection,
                        "select count(*) from opendolphin.orca_reconciliation_result where reconciliation_status = 'PENDING' and needs_user_review = true"));
                assertEquals(0, countRows(connection,
                        "select count(*) from information_schema.columns where table_schema = 'opendolphin' and table_name in ('orca_operation','orca_transmission','orca_response_summary','orca_reconciliation_result') and column_name like '%raw%'"));
            }
        }
    }

    @Test
    void duplicateIdempotencyCreatesAnotherTransmissionButSingleOperation() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaOperationLedgerRepository repository = new OrcaOperationLedgerRepository();
            repository.dataSource = dataSource;
            repository.record(command("UNKNOWN", "UNKNOWN", "BLOCKED", "NETWORK_FAILED", null));
            repository.record(command("UNKNOWN", "UNKNOWN", "BLOCKED", "NETWORK_FAILED", null));

            try (Connection connection = dataSource.getConnection()) {
                assertEquals(1, countRows(connection,
                        "select count(*) from opendolphin.orca_operation where idempotency_key = 'idem-ledger-1'"));
                assertEquals(2, countRows(connection,
                        "select count(*) from opendolphin.orca_transmission where source_api = 'medicalmodv2'"));
                assertEquals(1, countRows(connection,
                        "select retry_count from opendolphin.orca_operation where idempotency_key = 'idem-ledger-1'"));
            }
        }
    }

    private static OrcaOperationLedgerRepository.RecordCommand command(
            String status,
            String unknownClassification,
            String reconciliationStatus,
            String transportStatus,
            String apiResult) {
        return new OrcaOperationLedgerRepository.RecordCommand(
                "F001",
                "MEDICAL",
                "MEDICAL_MOD",
                "medicalmodv2",
                status,
                "idem-ledger-1",
                "server-orca-transport",
                "00001",
                "2026-05-13",
                "01",
                "10001",
                "0001",
                HASH,
                status.equals("UNKNOWN") ? null : HASH,
                status.equals("UNKNOWN") ? null : 200,
                apiResult,
                apiResult == null ? "api_result_absent" : "warning_needs_review",
                transportStatus,
                status.equals("UNKNOWN") ? "NETWORK_FAILED" : null,
                true,
                "{\"rawSensitiveFieldsExcluded\":\"true\"}",
                "{\"rawSensitiveFieldsExcluded\":\"true\"}",
                status.equals("UNKNOWN") ? "{\"errorClass\":\"SocketTimeoutException\"}" : "{}",
                status.equals("ORCA_WARNING") ? "[{\"classification\":\"WARNING_NEEDS_REVIEW\"}]" : "[]",
                status.equals("UNKNOWN") ? "[{\"classification\":\"UNKNOWN\"}]" : "[]",
                "[]",
                "{\"rawSensitiveFieldsExcluded\":\"true\"}",
                "trace-ledger-1",
                "ORCA_HTTP",
                unknownClassification,
                reconciliationStatus,
                "TEMPORARY_MEDICAL_REFETCH",
                "tmedicalgetv2",
                "BLOCKED".equals(reconciliationStatus),
                "BLOCKED".equals(reconciliationStatus) ? "ORCA_RESULT_NOT_CONFIRMED" : null,
                "{\"status\":\"" + reconciliationStatus + "\"}",
                12L,
                Instant.now());
    }

    private static void migrate(DataSource dataSource) {
        Flyway.configure()
                .dataSource(dataSource)
                .defaultSchema("opendolphin")
                .schemas("opendolphin")
                .locations("classpath:db/migration")
                .load()
                .migrate();
    }

    private static int countRows(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet resultSet = statement.executeQuery()) {
            resultSet.next();
            return resultSet.getInt(1);
        }
    }
}
