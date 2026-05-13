package open.dolphin.db;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import open.dolphin.rest.orca.PrescriptionOrderEventHashChainVerifier;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class PrescriptionAuthoritySchemaTest {

    @Test
    void prescriptionStatusIsEnumeratedAndFinalRowsRejectDirectOverwrite() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            Flyway.configure()
                    .dataSource(dataSource)
                    .defaultSchema("opendolphin")
                    .schemas("opendolphin")
                    .locations("classpath:db/migration")
                    .load()
                    .migrate();

            try (Connection connection = dataSource.getConnection();
                    Statement statement = connection.createStatement()) {
                long orderId = nextId(statement, """
                        INSERT INTO opendolphin.prescription_order
                            (facility_id, patient_id, encounter_id, chart_revision_id, created_by)
                        VALUES
                            ('F001', 'P001', 'ENC-001', 'REV-001', 'doctor-1')
                        RETURNING prescription_order_id
                        """);
                long revisionId = nextId(statement, """
                        INSERT INTO opendolphin.prescription_order_revision
                            (prescription_order_id, revision_number, created_by)
                        VALUES
                            (%d, 1, 'doctor-1')
                        RETURNING prescription_order_revision_id
                        """.formatted(orderId));

                statement.executeUpdate("""
                        INSERT INTO opendolphin.prescription_order_item
                            (prescription_order_revision_id, item_sequence, drug_code, drug_name, usage_code,
                             usage_name, dose_value, dose_unit, days, prescription_location, medication_route,
                             generic_name_prescription, doctor_comment)
                        VALUES
                            (%d, 1, '620000001', 'Structured Drug', '001', 'After meals', '1', 'tablet', 7,
                             'OUTSIDE', 'ORAL', false, 'server-side structured item')
                        """.formatted(revisionId));
                statement.executeUpdate("""
                        INSERT INTO opendolphin.prescription_order_event
                            (prescription_order_id, prescription_order_revision_id, event_type, actor_user_id,
                             previous_event_hash, event_hash)
                        VALUES
                            (%d, %d, 'CREATE', 'doctor-1', repeat('0', 64), repeat('1', 64))
                        """.formatted(orderId, revisionId));

                statement.executeUpdate("""
                        UPDATE opendolphin.prescription_order_revision
                           SET status = 'FINAL', content_hash = repeat('a', 64), finalized_by = 'doctor-1',
                               finalized_at = CURRENT_TIMESTAMP
                         WHERE prescription_order_revision_id = %d
                        """.formatted(revisionId));
                statement.executeUpdate("""
                        UPDATE opendolphin.prescription_order
                           SET status = 'FINAL', current_revision_id = %d
                         WHERE prescription_order_id = %d
                        """.formatted(revisionId, orderId));

                SQLException invalidStatus = assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        INSERT INTO opendolphin.prescription_order
                            (facility_id, patient_id, status, created_by)
                        VALUES
                            ('F001', 'P001', 'SIGNED', 'doctor-1')
                        """));
                assertEquals("23514", invalidStatus.getSQLState());

                SQLException orderRewrite = assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        UPDATE opendolphin.prescription_order
                           SET patient_id = 'P002'
                         WHERE prescription_order_id = %d
                        """.formatted(orderId)));
                assertPrescriptionOverwriteDenied(orderRewrite);

                SQLException revisionRewrite = assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        UPDATE opendolphin.prescription_order_revision
                           SET reason_text = 'client direct rewrite'
                         WHERE prescription_order_revision_id = %d
                        """.formatted(revisionId)));
                assertPrescriptionOverwriteDenied(revisionRewrite);

                SQLException itemRewrite = assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        UPDATE opendolphin.prescription_order_item
                           SET dose_value = '99'
                         WHERE prescription_order_revision_id = %d
                        """.formatted(revisionId)));
                assertPrescriptionOverwriteDenied(itemRewrite);

                SQLException eventRewrite = assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        UPDATE opendolphin.prescription_order_event
                           SET event_type = 'CHANGE'
                         WHERE prescription_order_id = %d
                        """.formatted(orderId)));
                assertTrue(eventRewrite.getMessage().contains("prescription_order_event_append_only"));

                statement.execute("SELECT set_config('opendolphin.prescription_authority_mutation', 'event', false)");
                long changedRevisionId = nextId(statement, """
                        INSERT INTO opendolphin.prescription_order_revision
                            (prescription_order_id, revision_number, status, reason_text, content_hash, finalized_by, finalized_at, created_by)
                        VALUES
                            (%d, 2, 'CHANGED', 'required clinical reason', repeat('b', 64), 'doctor-1', CURRENT_TIMESTAMP, 'doctor-1')
                        RETURNING prescription_order_revision_id
                        """.formatted(orderId));
                statement.executeUpdate("""
                        INSERT INTO opendolphin.prescription_order_item
                            (prescription_order_revision_id, item_sequence, drug_code, drug_name, usage_code,
                             usage_name, dose_value, dose_unit, days, prescription_location, medication_route,
                             generic_name_prescription, doctor_comment)
                        VALUES
                            (%d, 1, '620000002', 'Changed Structured Drug', '002', 'Before sleep', '1', 'tablet', 7,
                             'OUTSIDE', 'ORAL', false, 'server authority transition item')
                        """.formatted(changedRevisionId));
                statement.executeUpdate("""
                        UPDATE opendolphin.prescription_order
                           SET status = 'CHANGED', current_revision_id = %d
                         WHERE prescription_order_id = %d
                        """.formatted(changedRevisionId, orderId));
                statement.executeUpdate("""
                        INSERT INTO opendolphin.prescription_order_event
                            (prescription_order_id, prescription_order_revision_id, event_type, reason_text, actor_user_id,
                             previous_event_hash, event_hash)
                        VALUES
                            (%d, %d, 'CHANGE', 'required clinical reason', 'doctor-1', repeat('1', 64), repeat('2', 64))
                        """.formatted(orderId, changedRevisionId));
            }
        }
    }

    @Test
    void prescriptionEventHashChainVerifierDetectsTamperedHistoricalEvent() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            Flyway.configure()
                    .dataSource(dataSource)
                    .defaultSchema("opendolphin")
                    .schemas("opendolphin")
                    .locations("classpath:db/migration")
                    .load()
                    .migrate();

            try (Connection connection = dataSource.getConnection();
                    Statement statement = connection.createStatement()) {
                long orderId = nextId(statement, """
                        INSERT INTO opendolphin.prescription_order
                            (facility_id, patient_id, encounter_id, chart_revision_id, created_by)
                        VALUES
                            ('F001', 'P001', 'ENC-001', 'REV-001', 'doctor-1')
                        RETURNING prescription_order_id
                        """);
                long revisionId = nextId(statement, """
                        INSERT INTO opendolphin.prescription_order_revision
                            (prescription_order_id, revision_number, status, content_hash, finalized_by, finalized_at, created_by,
                             before_summary_json, after_summary_json)
                        VALUES
                            (%d, 1, 'FINAL', repeat('a', 64), 'doctor-1', '2026-05-13T10:00:00Z', 'doctor-1',
                             '{}'::jsonb, '{"drug":"A"}'::jsonb)
                        RETURNING prescription_order_revision_id
                        """.formatted(orderId));
                statement.executeUpdate("""
                        UPDATE opendolphin.prescription_order
                           SET current_revision_id = %d, status = 'FINAL'
                         WHERE prescription_order_id = %d
                        """.formatted(revisionId, orderId));
                insertHashedEvent(statement, orderId, revisionId, "FINALIZE", "doctor-1",
                        "2026-05-13T10:00:00Z", "{}", "{\"drug\": \"A\"}",
                        PrescriptionOrderEventHashChainVerifier.GENESIS_HASH);
                String firstHash = eventHash(statement, orderId, 1);
                insertHashedEvent(statement, orderId, revisionId, "RESEND", "doctor-1",
                        "2026-05-13T10:01:00Z", "{\"drug\": \"A\"}", "{\"drug\": \"A\"}", firstHash);

                assertTrue(PrescriptionOrderEventHashChainVerifier.verify(loadEventRows(statement, orderId)).isEmpty());

                statement.execute("ALTER TABLE opendolphin.prescription_order_event DISABLE TRIGGER USER");
                statement.executeUpdate("""
                        UPDATE opendolphin.prescription_order_event
                           SET after_summary_json = '{"drug":"TAMPERED"}'::jsonb
                         WHERE prescription_order_id = %d
                           AND event_type = 'FINALIZE'
                        """.formatted(orderId));
                statement.execute("ALTER TABLE opendolphin.prescription_order_event ENABLE TRIGGER USER");

                List<PrescriptionOrderEventHashChainVerifier.HashChainError> errors =
                        PrescriptionOrderEventHashChainVerifier.verify(loadEventRows(statement, orderId));
                assertTrue(errors.stream().anyMatch(error -> "event_hash_mismatch".equals(error.reason())));
            }
        }
    }

    private long nextId(Statement statement, String sql) throws SQLException {
        try (var resultSet = statement.executeQuery(sql)) {
            assertTrue(resultSet.next());
            return resultSet.getLong(1);
        }
    }

    private void assertPrescriptionOverwriteDenied(SQLException exception) {
        assertEquals("23514", exception.getSQLState());
        assertTrue(exception.getMessage().contains("prescription_order_finalized_update_denied"));
    }

    private void insertHashedEvent(Statement statement,
            long orderId,
            long revisionId,
            String eventType,
            String actor,
            String occurredAt,
            String beforeJson,
            String afterJson,
            String previousHash) throws SQLException {
        String eventHash = PrescriptionOrderEventHashChainVerifier.computeEventHash(
                orderId,
                revisionId,
                eventType,
                actor,
                Instant.parse(occurredAt),
                normalizeJson(statement, beforeJson),
                normalizeJson(statement, afterJson),
                previousHash);
        statement.executeUpdate("""
                INSERT INTO opendolphin.prescription_order_event
                    (prescription_order_id, prescription_order_revision_id, event_type, actor_user_id, occurred_at,
                     before_summary_json, after_summary_json, previous_event_hash, event_hash)
                VALUES
                    (%d, %d, '%s', '%s', '%s'::timestamptz, '%s'::jsonb, '%s'::jsonb, '%s', '%s')
                """.formatted(orderId, revisionId, eventType, actor, occurredAt, beforeJson, afterJson, previousHash, eventHash));
    }

    private String eventHash(Statement statement, long orderId, int offset) throws SQLException {
        try (ResultSet resultSet = statement.executeQuery("""
                SELECT event_hash
                  FROM opendolphin.prescription_order_event
                 WHERE prescription_order_id = %d
                 ORDER BY occurred_at ASC, prescription_order_event_id ASC
                 OFFSET %d
                 LIMIT 1
                """.formatted(orderId, offset - 1))) {
            assertTrue(resultSet.next());
            return resultSet.getString(1);
        }
    }

    private List<PrescriptionOrderEventHashChainVerifier.EventRow> loadEventRows(Statement statement, long orderId)
            throws SQLException {
        List<PrescriptionOrderEventHashChainVerifier.EventRow> rows = new ArrayList<>();
        try (ResultSet resultSet = statement.executeQuery("""
                SELECT prescription_order_event_id,
                       prescription_order_id,
                       prescription_order_revision_id,
                       event_type,
                       actor_user_id,
                       occurred_at,
                       before_summary_json::text,
                       after_summary_json::text,
                       previous_event_hash,
                       event_hash
                  FROM opendolphin.prescription_order_event
                 WHERE prescription_order_id = %d
                 ORDER BY occurred_at ASC, prescription_order_event_id ASC
                """.formatted(orderId))) {
            while (resultSet.next()) {
                rows.add(new PrescriptionOrderEventHashChainVerifier.EventRow(
                        resultSet.getLong(1),
                        resultSet.getLong(2),
                        resultSet.getLong(3),
                        resultSet.getString(4),
                        resultSet.getString(5),
                        resultSet.getTimestamp(6).toInstant(),
                        resultSet.getString(7),
                        resultSet.getString(8),
                        resultSet.getString(9),
                        resultSet.getString(10)));
            }
        }
        return rows;
    }

    private String normalizeJson(Statement statement, String json) throws SQLException {
        try (ResultSet resultSet = statement.executeQuery("SELECT '" + json.replace("'", "''") + "'::jsonb::text")) {
            assertTrue(resultSet.next());
            return resultSet.getString(1);
        }
    }
}
