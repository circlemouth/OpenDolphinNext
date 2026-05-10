package open.dolphin.db;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
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
                            (prescription_order_id, prescription_order_revision_id, event_type, actor_user_id)
                        VALUES
                            (%d, %d, 'CREATE', 'doctor-1')
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
}
