package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import javax.sql.DataSource;
import open.dolphin.rest.dto.orca.AcceptanceInventoryResponse;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class OrcaAcceptanceCacheStoreTest {

    @Test
    void saveInventoryRecordsDiffAndCancellationWithoutDeletingRows() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaAcceptanceCacheStore store = new OrcaAcceptanceCacheStore();
            store.dataSource = dataSource;

            OrcaAcceptanceCacheStore.AcceptanceCacheResult first = store.saveInventory(command(inventory(row(
                    "A-001", "00001", "2026-05-10", "0900", "01", "10001", "01", "10", "a".repeat(64)))));
            assertEquals(1, first.upsertedCount());
            assertEquals(0, first.diffDetectedCount());
            assertEquals(0, first.cancelledCount());
            assertEquals("CURRENT", status(dataSource, "A-001"));

            OrcaAcceptanceCacheStore.AcceptanceCacheResult changed = store.saveInventory(command(inventory(row(
                    "A-001", "00001", "2026-05-10", "0900", "02", "10001", "01", "10", "b".repeat(64)))));
            assertEquals(1, changed.upsertedCount());
            assertEquals(1, changed.diffDetectedCount());
            assertEquals("DIFF_DETECTED", status(dataSource, "A-001"));
            assertTrue(summary(dataSource, "A-001").contains("departmentCode"));
            assertFalse(summary(dataSource, "A-001").contains("Patient_Information"));

            insertEncounterAcceptanceLink(dataSource, "F001:E001", "A-001");
            OrcaAcceptanceCacheStore.AcceptanceCacheResult cancelled = store.saveInventory(command(inventory()));
            assertEquals(0, cancelled.upsertedCount());
            assertEquals(1, cancelled.cancelledCount());
            assertEquals("CANCELLED", status(dataSource, "A-001"));
            assertEquals("ORCA_ACCEPTANCE_CANCELLED", linkWarningStatus(dataSource, "F001:E001"));
            assertEquals("checked_in", encounterBusinessState(dataSource, "F001:E001"));
            assertEquals(1, rowCount(dataSource));
        }
    }

    @Test
    void saveInventoryMarksIncompleteRowsNeedsReview() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaAcceptanceCacheStore store = new OrcaAcceptanceCacheStore();
            store.dataSource = dataSource;

            AcceptanceInventoryResponse.AcceptanceInventoryRow incomplete = row(
                    "A-002", "00002", "2026-05-10", "0915", "01", "10001", null, "10", "c".repeat(64));
            OrcaAcceptanceCacheStore.AcceptanceCacheResult result = store.saveInventory(command(inventory(incomplete)));

            assertEquals(1, result.upsertedCount());
            assertEquals(1, result.needsReviewCount());
            assertEquals("NEEDS_REVIEW", status(dataSource, "A-002"));
        }
    }

    private static OrcaAcceptanceCacheStore.AcceptanceInventoryCommand command(AcceptanceInventoryResponse response) {
        return new OrcaAcceptanceCacheStore.AcceptanceInventoryCommand(
                "F001",
                "2026-05-10",
                "req-acceptance",
                "trace-acceptance",
                Instant.parse("2026-05-10T21:49:03Z"),
                Instant.parse("2026-05-10T21:54:03Z"),
                response);
    }

    private static AcceptanceInventoryResponse inventory(AcceptanceInventoryResponse.AcceptanceInventoryRow... rows) {
        AcceptanceInventoryResponse response = new AcceptanceInventoryResponse();
        response.setApiResult("00");
        response.setApiResultMessage("OK");
        for (AcceptanceInventoryResponse.AcceptanceInventoryRow row : rows) {
            response.getRows().add(row);
        }
        return response;
    }

    private static AcceptanceInventoryResponse.AcceptanceInventoryRow row(String acceptanceId,
            String patientId,
            String date,
            String time,
            String department,
            String physician,
            String insurance,
            String medicalInformation,
            String rowHash) {
        AcceptanceInventoryResponse.AcceptanceInventoryRow row = new AcceptanceInventoryResponse.AcceptanceInventoryRow();
        row.setRowHash(rowHash);
        row.setServerAcceptanceId(acceptanceId);
        row.setServerPatientId(patientId);
        row.setServerAcceptanceDate(date);
        row.setServerAcceptanceTime(time);
        row.setServerDepartmentCode(department);
        row.setServerPhysicianCode(physician);
        row.setServerInsuranceCombinationNumber(insurance);
        row.setServerMedicalInformation(medicalInformation);
        return row;
    }

    private static String status(DataSource dataSource, String acceptanceId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     SELECT acceptance_status
                       FROM opendolphin.orca_acceptance_cache
                      WHERE orca_acceptance_id = ?
                     """)) {
            statement.setString(1, acceptanceId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return resultSet.getString(1);
            }
        }
    }

    private static String summary(DataSource dataSource, String acceptanceId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     SELECT response_summary_json::text
                       FROM opendolphin.orca_acceptance_cache
                      WHERE orca_acceptance_id = ?
                     """)) {
            statement.setString(1, acceptanceId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return resultSet.getString(1);
            }
        }
    }

    private static int rowCount(DataSource dataSource) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     SELECT count(*)
                       FROM opendolphin.orca_acceptance_cache
                     """);
             ResultSet resultSet = statement.executeQuery()) {
            resultSet.next();
            return resultSet.getInt(1);
        }
    }

    private static void insertEncounterAcceptanceLink(DataSource dataSource, String encounterKey, String acceptanceId)
            throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement encounter = connection.prepareStatement("""
                     INSERT INTO opendolphin.encounter_projection (
                         encounter_key, facility_id, patient_id, orca_acceptance_id, acceptance_datetime,
                         business_state, worklist_flags, projected_at
                     ) VALUES (?, 'F001', '00001', ?, '2026-05-10T09:00:00Z', 'checked_in', '{}'::jsonb,
                               '2026-05-10T09:01:00Z')
                     """);
             PreparedStatement link = connection.prepareStatement("""
                     INSERT INTO opendolphin.encounter_orca_acceptance_link (
                         encounter_key, facility_id, patient_id, orca_acceptance_key, orca_acceptance_id,
                         acceptance_date, link_status, warning_status
                     ) VALUES (?, 'F001', '00001', ?, ?, '2026-05-10', 'CURRENT', 'CLEAR')
                     """)) {
            encounter.setString(1, encounterKey);
            encounter.setString(2, acceptanceId);
            encounter.executeUpdate();
            link.setString(1, encounterKey);
            link.setString(2, acceptanceId);
            link.setString(3, acceptanceId);
            link.executeUpdate();
        }
    }

    private static String linkWarningStatus(DataSource dataSource, String encounterKey) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     SELECT warning_status
                       FROM opendolphin.encounter_orca_acceptance_link
                      WHERE encounter_key = ?
                     """)) {
            statement.setString(1, encounterKey);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return resultSet.getString(1);
            }
        }
    }

    private static String encounterBusinessState(DataSource dataSource, String encounterKey) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     SELECT business_state
                       FROM opendolphin.encounter_projection
                      WHERE encounter_key = ?
                     """)) {
            statement.setString(1, encounterKey);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return resultSet.getString(1);
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
}
