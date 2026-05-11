package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import javax.sql.DataSource;
import open.dolphin.rest.dto.orca.InsuranceCombination;
import open.dolphin.rest.dto.orca.InsuranceCombinationResponse;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class OrcaInsuranceCacheStoreTest {

    @Test
    void saveInsuranceCombinationsStoresSanitizedCacheAndDetectsDiff() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaInsuranceCacheStore store = new OrcaInsuranceCacheStore();
            store.dataSource = dataSource;
            insertEncounterLink(dataSource, "enc-1");

            InsuranceCombinationResponse first = response(combination("0001", "01", "協会", "30", "10"));
            OrcaInsuranceCacheStore.InsuranceCacheResult firstResult =
                    store.saveInsuranceCombinations(command(first));
            assertEquals(1, firstResult.upsertedCount());
            assertEquals(0, firstResult.diffDetectedCount());
            assertEquals("CLEAR", linkInsuranceWarning(dataSource, "enc-1"));
            assertEquals("CURRENT", linkInsuranceCacheStatus(dataSource, "enc-1"));

            InsuranceCombinationResponse changed = response(combination("0001", "01", "協会", "20", "10"));
            OrcaInsuranceCacheStore.InsuranceCacheResult changedResult =
                    store.saveInsuranceCombinations(command(changed));
            assertEquals(1, changedResult.diffDetectedCount());
            assertEquals("ORCA_INSURANCE_DIFF_DETECTED", linkInsuranceWarning(dataSource, "enc-1"));
            assertEquals("DIFF_DETECTED", linkInsuranceCacheStatus(dataSource, "enc-1"));
            String changedFields = linkInsuranceChangedFields(dataSource, "enc-1");
            assertTrue(changedFields.contains("insuranceCombinationSummary"));
            assertFalse(changedFields.contains("SHOULD_NOT_STORE_NUMBER"));
            assertFalse(changedFields.contains("SHOULD_NOT_STORE_WHOLE_NAME"));

            try (Connection connection = dataSource.getConnection();
                 PreparedStatement statement = connection.prepareStatement("""
                         SELECT cache_status, normalized_payload_json::text, response_summary_json::text
                           FROM opendolphin.orca_insurance_cache
                          WHERE facility_id = 'F001'
                            AND orca_patient_id = '000019'
                            AND insurance_combination_number = '0001'
                         """)) {
                try (ResultSet resultSet = statement.executeQuery()) {
                    assertTrue(resultSet.next());
                    assertEquals("DIFF_DETECTED", resultSet.getString("cache_status"));
                    String payload = resultSet.getString("normalized_payload_json");
                    String summary = resultSet.getString("response_summary_json");
                    assertTrue(payload.contains("\"sourceSystem\":\"ORCA\"")
                            || payload.contains("\"sourceSystem\": \"ORCA\""));
                    assertTrue(payload.contains("\"publicInsuranceCount\":0")
                            || payload.contains("\"publicInsuranceCount\": 0"));
                    assertFalse(payload.contains("SHOULD_NOT_STORE_NUMBER"));
                    assertFalse(payload.contains("SHOULD_NOT_STORE_WHOLE_NAME"));
                    assertTrue(summary.contains("\"rawResponseStored\":false")
                            || summary.contains("\"rawResponseStored\": false"));
                }
            }
        }
    }

    @Test
    void encounterInsuranceSnapshotIsImmutableAndReportsCurrentDiff() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaInsuranceCacheStore store = new OrcaInsuranceCacheStore();
            store.dataSource = dataSource;

            OrcaInsuranceCacheStore.EncounterInsuranceSnapshotCommand first =
                    snapshotCommand("0001", "01", "100");
            OrcaInsuranceCacheStore.SnapshotResult created = store.createEncounterSnapshot(first);
            assertTrue(created.created());
            assertFalse(created.diffDetected());

            OrcaInsuranceCacheStore.EncounterInsuranceSnapshotCommand changed =
                    snapshotCommand("0002", "02", "100");
            OrcaInsuranceCacheStore.SnapshotResult blockedOverwrite = store.createEncounterSnapshot(changed);
            assertFalse(blockedOverwrite.created());
            assertTrue(blockedOverwrite.diffDetected());
            assertTrue(blockedOverwrite.changedFields().contains("insuranceCombinationNumber"));
            assertTrue(blockedOverwrite.changedFields().contains("departmentCode"));

            OrcaInsuranceCacheStore.SnapshotRow row = store.findSnapshot("enc-1", "primary");
            assertNotNull(row);
            assertEquals("0001", row.insuranceCombinationNumber());
            assertEquals("01", row.departmentCode());
            assertTrue(row.snapshotJson().contains("\"rawResponseStored\":false")
                    || row.snapshotJson().contains("\"rawResponseStored\": false"));
        }
    }

    private static OrcaInsuranceCacheStore.InsuranceCacheCommand command(InsuranceCombinationResponse response) {
        return new OrcaInsuranceCacheStore.InsuranceCacheCommand(
                "F001",
                "000019",
                "2026-05-10",
                "req-200",
                "trace-200",
                Instant.parse("2026-05-10T22:19:55Z"),
                Instant.parse("2026-05-10T22:34:55Z"),
                response);
    }

    private static InsuranceCombinationResponse response(InsuranceCombination combination) {
        InsuranceCombinationResponse response = new InsuranceCombinationResponse();
        response.getCombinations().add(combination);
        return response;
    }

    private static InsuranceCombination combination(String number,
            String providerClass,
            String providerName,
            String rateOutpatient,
            String rateAdmission) {
        InsuranceCombination combination = new InsuranceCombination();
        combination.setCombinationNumber(number);
        combination.setInsuranceProviderClass(providerClass);
        combination.setInsuranceProviderNumber("SHOULD_NOT_STORE_NUMBER");
        combination.setInsuranceProviderName(providerName);
        combination.setInsuredPersonNumber("SHOULD_NOT_STORE_NUMBER");
        combination.setInsuredPersonWholeName("SHOULD_NOT_STORE_WHOLE_NAME");
        combination.setRateOutpatient(rateOutpatient);
        combination.setRateAdmission(rateAdmission);
        combination.setCertificateStartDate("2026-05-01");
        combination.setCertificateExpiredDate("2026-05-31");
        return combination;
    }

    private static OrcaInsuranceCacheStore.EncounterInsuranceSnapshotCommand snapshotCommand(
            String combinationNumber,
            String departmentCode,
            String sourceCacheId) {
        return new OrcaInsuranceCacheStore.EncounterInsuranceSnapshotCommand(
                "enc-1",
                "primary",
                "F001",
                10L,
                "000019",
                "2026-05-10",
                "accept-1",
                departmentCode,
                "dr-1",
                combinationNumber,
                Long.valueOf(sourceCacheId),
                "FINALIZE",
                Instant.parse("2026-05-10T22:19:55Z"));
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

    private static void insertEncounterLink(DataSource dataSource, String encounterKey) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     INSERT INTO opendolphin.encounter_orca_acceptance_link (
                         encounter_key, facility_id, patient_id, orca_acceptance_key, orca_acceptance_id,
                         orca_patient_id, acceptance_date, link_status, warning_status, insurance_combination_number
                     ) VALUES (?, 'F001', '000019', 'A-001', 'A-001', '000019', '2026-05-10',
                         'CURRENT', 'CLEAR', '0001')
                     """)) {
            statement.setString(1, encounterKey);
            statement.executeUpdate();
        }
    }

    private static String linkInsuranceWarning(DataSource dataSource, String encounterKey) throws Exception {
        return queryString(dataSource,
                "select insurance_warning_status from opendolphin.encounter_orca_acceptance_link where encounter_key = ?",
                encounterKey);
    }

    private static String linkInsuranceCacheStatus(DataSource dataSource, String encounterKey) throws Exception {
        return queryString(dataSource,
                "select insurance_cache_status from opendolphin.encounter_orca_acceptance_link where encounter_key = ?",
                encounterKey);
    }

    private static String linkInsuranceChangedFields(DataSource dataSource, String encounterKey) throws Exception {
        return queryString(dataSource,
                "select insurance_changed_fields_json::text from opendolphin.encounter_orca_acceptance_link where encounter_key = ?",
                encounterKey);
    }

    private static String queryString(DataSource dataSource, String sql, String value) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, value);
            try (ResultSet resultSet = statement.executeQuery()) {
                assertTrue(resultSet.next());
                return resultSet.getString(1);
            }
        }
    }
}
