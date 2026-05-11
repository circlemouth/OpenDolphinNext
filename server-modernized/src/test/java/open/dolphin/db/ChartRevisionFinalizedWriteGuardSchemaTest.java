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

class ChartRevisionFinalizedWriteGuardSchemaTest {

    @Test
    void finalizedChartRevisionRejectsDirectRevisionDocumentAndModuleMutation() throws Exception {
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
                TestIds ids = createFinalizedChart(statement);

                SQLException revisionRewrite = assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        UPDATE opendolphin.chart_revision
                           SET title = 'client direct rewrite'
                         WHERE id = %d
                        """.formatted(ids.revisionId)));
                assertDenied(revisionRewrite, "chart_revision_finalized_update_denied");

                SQLException revisionStatusDowngrade = assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        UPDATE opendolphin.chart_revision
                           SET status = 'DRAFT', finalized_at = NULL, finalized_by_user_id = NULL
                         WHERE id = %d
                        """.formatted(ids.revisionId)));
                assertDenied(revisionStatusDowngrade, "chart_revision_finalized_update_denied");

                SQLException documentTitleRewrite = assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        UPDATE opendolphin.d_document
                           SET title = 'client title rewrite'
                         WHERE id = %d
                        """.formatted(ids.legacyDocumentId)));
                assertDenied(documentTitleRewrite, "chart_document_finalized_update_denied");

                SQLException modulePayloadRewrite = assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        UPDATE opendolphin.d_module
                           SET bean_json = '{"soap":"tampered"}'::jsonb
                         WHERE id = %d
                        """.formatted(ids.moduleId)));
                assertDenied(modulePayloadRewrite, "chart_module_finalized_update_denied");

                SQLException currentRevisionRepoint = assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        UPDATE opendolphin.chart_document
                           SET current_revision_id = %d
                         WHERE id = %d
                        """.formatted(ids.draftRevisionId, ids.chartDocumentId)));
                assertDenied(currentRevisionRepoint, "chart_document_finalized_revision_repoint_denied");

                SQLException eventRewrite = assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        UPDATE opendolphin.chart_revision_event
                           SET reason_text = 'client direct rewrite'
                         WHERE id = %d
                        """.formatted(ids.eventId)));
                assertDenied(eventRewrite, "chart_revision_event_append_only");

                SQLException eventDelete = assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        DELETE FROM opendolphin.chart_revision_event
                         WHERE id = %d
                        """.formatted(ids.eventId)));
                assertDenied(eventDelete, "chart_revision_event_append_only");
            }
        }
    }

    private TestIds createFinalizedChart(Statement statement) throws SQLException {
        long facilityId = nextId(statement, """
                INSERT INTO opendolphin.d_facility
                    (address, facilityid, facilityname, membertype, registereddate, telephone, zipcode)
                VALUES
                    ('sanitized address', 'F001', 'Sanitized Facility', 'member', CURRENT_DATE, '000', '0000000')
                RETURNING id
                """);
        long userId = nextId(statement, """
                INSERT INTO opendolphin.d_users
                    (commonname, email, membertype, password, registereddate, userid, facility_id)
                VALUES
                    ('doctor-1', 'doctor@example.invalid', 'doctor', 'hash-placeholder', CURRENT_DATE, 'doctor-1', %d)
                RETURNING id
                """.formatted(facilityId));
        long patientId = nextId(statement, """
                INSERT INTO opendolphin.d_patient
                    (facilityid, fullname, gender, patientid)
                VALUES
                    ('F001', 'Sanitized Patient', 'U', 'P001')
                RETURNING id
                """);
        long karteId = nextId(statement, """
                INSERT INTO opendolphin.d_karte
                    (created, patient_id)
                VALUES
                    (CURRENT_DATE, %d)
                RETURNING id
                """.formatted(patientId));
        long legacyDocumentId = nextId(statement, """
                INSERT INTO opendolphin.d_document
                    (confirmed, started, recorded, creator_id, karte_id, docid, doctype, title, purpose)
                VALUES
                    (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, %d, %d,
                     'DOC-001', 'karte', 'Initial title', 'record')
                RETURNING id
                """.formatted(userId, karteId));
        long moduleId = nextId(statement, """
                INSERT INTO opendolphin.d_module
                    (confirmed, started, recorded, creator_id, karte_id, name, role, stampnumber,
                     entity, bean_json, doc_id)
                VALUES
                    (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, %d, %d,
                     'SOAP', 'soap', 1, 'progressCourse', '{"soap":"original"}'::jsonb, %d)
                RETURNING id
                """.formatted(userId, karteId, legacyDocumentId));
        long chartDocumentId = nextId(statement, """
                INSERT INTO opendolphin.chart_document
                    (document_key, facility_id, karte_id, patient_id, legacy_document_id, created_by_user_id)
                VALUES
                    ('server-generated-chart-key', 'F001', %d, %d, %d, %d)
                RETURNING id
                """.formatted(karteId, patientId, legacyDocumentId, userId));
        long revisionId = nextId(statement, """
                INSERT INTO opendolphin.chart_revision
                    (chart_document_id, revision_number, status, source_document_id, title, content_hash,
                     entered_by_user_id, finalized_by_user_id, finalized_at, encounter_id, encounter_date,
                     orca_patient_id, orca_acceptance_id, department_code, physician_code,
                     insurance_combination_number, finalize_context_json)
                VALUES
                    (%d, 1, 'FINAL', %d, 'Initial title', repeat('a', 64), %d, %d, CURRENT_TIMESTAMP,
                     'ENC-001', CURRENT_DATE, '00001', 'ACC-001', '01', '10001', '0001',
                     '{"context":"present"}'::jsonb)
                RETURNING id
                """.formatted(chartDocumentId, legacyDocumentId, userId, userId));
        long draftRevisionId = nextId(statement, """
                INSERT INTO opendolphin.chart_revision
                    (chart_document_id, revision_number, status, source_document_id, title, entered_by_user_id)
                VALUES
                    (%d, 2, 'DRAFT', %d, 'Draft addendum', %d)
                RETURNING id
                """.formatted(chartDocumentId, legacyDocumentId, userId));
        statement.executeUpdate("""
                UPDATE opendolphin.chart_document
                   SET current_revision_id = %d
                 WHERE id = %d
                """.formatted(revisionId, chartDocumentId));
        long eventId = nextId(statement, """
                INSERT INTO opendolphin.chart_revision_event
                    (chart_document_id, chart_revision_id, new_revision_id, event_type, actor_user_id,
                     reason_code, reason_text, before_summary_json, after_summary_json, event_hash)
                VALUES
                    (%d, %d, %d, 'FINALIZED', %d, 'FINALIZE', 'Finalized by server',
                     '{"status":"DRAFT"}'::jsonb,
                     '{"status":"FINAL","contentHash":"%s"}'::jsonb,
                     repeat('b', 64))
                RETURNING id
                """.formatted(chartDocumentId, revisionId, revisionId, userId, "a".repeat(64)));
        return new TestIds(chartDocumentId, revisionId, draftRevisionId, legacyDocumentId, moduleId, eventId);
    }

    private long nextId(Statement statement, String sql) throws SQLException {
        try (var resultSet = statement.executeQuery(sql)) {
            assertTrue(resultSet.next());
            return resultSet.getLong(1);
        }
    }

    private void assertDenied(SQLException exception, String message) {
        assertEquals("23514", exception.getSQLState());
        assertTrue(exception.getMessage().contains(message));
    }

    private record TestIds(long chartDocumentId, long revisionId, long draftRevisionId,
            long legacyDocumentId, long moduleId, long eventId) {
    }
}
