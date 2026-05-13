package open.dolphin.db;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class OrcaOperationLedgerSchemaTest {

    private static final String HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    @Test
    void operationLedgerPersistsSanitizedHashesAndRejectsInvalidStatus() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            try (Connection connection = dataSource.getConnection()) {
                long operationId = insertOperation(connection, "PREPARED", "idem-001", HASH);

                insertTransmission(connection, operationId, "ORCA_WARNING", "HTTP_OK", HASH);
                insertResponseSummary(connection, operationId, "ORCA_WARNING", HASH);
                insertReconciliation(connection, operationId, "NEEDS_REVIEW", 0, 1, HASH);
                assertEquals(1, countRows(connection,
                        "select count(*) from opendolphin.orca_operation where central_audit_trace_id = 'trace-001'"));

                SQLException invalidStatus = assertThrows(SQLException.class,
                        () -> insertOperation(connection, "SUCCESS", "idem-invalid-status", HASH));
                assertEquals("23514", invalidStatus.getSQLState());

                SQLException invalidHash = assertThrows(SQLException.class,
                        () -> insertOperation(connection, "PREPARED", "idem-invalid-hash", "raw-request-body"));
                assertEquals("23514", invalidHash.getSQLState());
            }
        }
    }

    @Test
    void operationLedgerConstrainedUnknownClassificationAndReconciliationStatus() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            try (Connection connection = dataSource.getConnection()) {
                insertOperation(connection, "UNKNOWN", "idem-unknown", HASH);

                SQLException invalidUnknown = assertThrows(SQLException.class, () -> {
                    try (PreparedStatement statement = connection.prepareStatement("""
                            UPDATE opendolphin.orca_operation
                               SET unknown_classification = 'SUCCESS'
                             WHERE idempotency_key = 'idem-unknown'
                            """)) {
                        statement.executeUpdate();
                    }
                });
                assertEquals("23514", invalidUnknown.getSQLState());

                SQLException invalidReconciliation = assertThrows(SQLException.class, () -> {
                    try (PreparedStatement statement = connection.prepareStatement("""
                            UPDATE opendolphin.orca_operation
                               SET reconciliation_status = 'REGISTERED'
                             WHERE idempotency_key = 'idem-unknown'
                            """)) {
                        statement.executeUpdate();
                    }
                });
                assertEquals("23514", invalidReconciliation.getSQLState());
            }
        }
    }

    @Test
    void operationLedgerDoesNotExposeRawBodyOrCredentialColumns() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            try (Connection connection = dataSource.getConnection()) {
                assertFalse(columnExistsLike(connection, "orca_operation", "%raw%"));
                assertFalse(columnExistsLike(connection, "orca_transmission", "%raw%"));
                assertFalse(columnExistsLike(connection, "orca_response_summary", "%raw%"));
                assertFalse(columnExistsLike(connection, "orca_reconciliation_result", "%raw%"));
                assertFalse(columnExistsLike(connection, "orca_operation", "%credential%"));
                assertFalse(columnExistsLike(connection, "orca_transmission", "%credential%"));
                assertFalse(columnExistsLike(connection, "orca_response_summary", "%credential%"));
                assertFalse(columnExistsLike(connection, "orca_reconciliation_result", "%credential%"));
                assertFalse(columnExistsLike(connection, "orca_operation", "%password%"));
                assertFalse(columnExistsLike(connection, "orca_transmission", "%password%"));
            }
        }
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

    private static long insertOperation(Connection connection, String status, String idempotencyKey, String requestHash)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO opendolphin.orca_operation (
                    facility_id,
                    operation_scope,
                    operation_type,
                    source_api,
                    operation_status,
                    idempotency_key,
                    requested_by,
                    orca_patient_id,
                    request_hash,
                    central_audit_trace_id,
                    central_audit_action,
                    unknown_classification,
                    reconciliation_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING orca_operation_id
                """)) {
            statement.setString(1, "F001");
            statement.setString(2, "MEDICAL");
            statement.setString(3, "SEND_MEDICAL_MOD_V2");
            statement.setString(4, "medicalmodv2");
            statement.setString(5, status);
            statement.setString(6, idempotencyKey);
            statement.setString(7, "user-1");
            statement.setString(8, "00001");
            statement.setString(9, requestHash);
            statement.setString(10, "trace-001");
            statement.setString(11, "ORCA_HTTP");
            statement.setString(12, status.equals("UNKNOWN") ? "UNKNOWN" : null);
            statement.setString(13, status.equals("UNKNOWN") ? "PENDING" : null);
            try (ResultSet rs = statement.executeQuery()) {
                rs.next();
                return rs.getLong(1);
            }
        }
    }

    private static void insertTransmission(Connection connection, long operationId, String status, String transportStatus,
            String requestHash) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO opendolphin.orca_transmission (
                    orca_operation_id,
                    facility_id,
                    source_api,
                    transmission_status,
                    transport_status,
                    request_hash
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """)) {
            statement.setLong(1, operationId);
            statement.setString(2, "F001");
            statement.setString(3, "medicalmodv2");
            statement.setString(4, status);
            statement.setString(5, transportStatus);
            statement.setString(6, requestHash);
            statement.executeUpdate();
        }
    }

    private static void insertResponseSummary(Connection connection, long operationId, String status, String responseHash)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO opendolphin.orca_response_summary (
                    orca_operation_id,
                    facility_id,
                    source_api,
                    operation_status,
                    needs_user_review,
                    response_hash,
                    warnings_json
                )
                VALUES (?, ?, ?, ?, ?, ?, '[{"code":"warning"}]'::jsonb)
                """)) {
            statement.setLong(1, operationId);
            statement.setString(2, "F001");
            statement.setString(3, "medicalmodv2");
            statement.setString(4, status);
            statement.setBoolean(5, true);
            statement.setString(6, responseHash);
            statement.executeUpdate();
        }
    }

    private static void insertReconciliation(Connection connection, long operationId, String status, int matchedCount,
            int totalCount, String responseHash) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO opendolphin.orca_reconciliation_result (
                    orca_operation_id,
                    facility_id,
                    reconciliation_type,
                    reconciliation_status,
                    source_api,
                    matched_count,
                    total_count,
                    response_hash
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """)) {
            statement.setLong(1, operationId);
            statement.setString(2, "F001");
            statement.setString(3, "POST_MUTATION_REFETCH");
            statement.setString(4, status);
            statement.setString(5, "tmedicalgetv2");
            statement.setInt(6, matchedCount);
            statement.setInt(7, totalCount);
            statement.setString(8, responseHash);
            statement.executeUpdate();
        }
    }

    private static boolean columnExistsLike(Connection connection, String table, String pattern) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT 1
                  FROM information_schema.columns
                 WHERE table_schema = 'opendolphin'
                   AND table_name = ?
                   AND column_name LIKE ?
                """)) {
            statement.setString(1, table);
            statement.setString(2, pattern);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static int countRows(Connection connection, String sql) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            rs.next();
            return rs.getInt(1);
        }
    }
}
