package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.time.Instant;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class OrcaPatientCacheStoreTest {

    @Test
    void saveStoresPatientGetAsOrcaCacheWithoutRawResponsePayload() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaPatientCacheStore store = new OrcaPatientCacheStore();
            store.dataSource = dataSource;

            long id = store.save(OrcaPatientCacheStore.fromOrcaResponse(
                    "F001",
                    "00001",
                    "req-100",
                    "trace-100",
                    Instant.parse("2026-05-10T20:39:21Z"),
                    patientGetJson("00001", "0000", "正常終了")));

            OrcaPatientCacheStore.PatientCacheRow row = store.findLatest("F001", "00001");
            assertNotNull(row);
            assertEquals(id, row.id());
            assertEquals("patientgetv2", row.sourceApi());
            assertEquals("req-100", row.sourceRequestId());
            assertEquals("trace-100", row.sourceTraceId());
            assertEquals("CURRENT", row.cacheStatus());
            assertEquals("ORCA_PATIENT_FOUND", row.businessStatus());
            assertEquals(64, row.rawResponseHash().length());
            assertTrue(row.normalizedPayloadJson().contains("\"sourceSystem\":\"ORCA\"")
                    || row.normalizedPayloadJson().contains("\"sourceSystem\": \"ORCA\""));
            assertTrue(row.normalizedPayloadJson().contains("\"orcaPatientId\":\"00001\"")
                    || row.normalizedPayloadJson().contains("\"orcaPatientId\": \"00001\""));
            assertFalse(row.normalizedPayloadJson().contains("Patient_Information"));
            assertFalse(row.normalizedPayloadJson().contains("raw"));
        }
    }

    @Test
    void fromOrcaResponseClassifiesPatientNotFoundAsBusinessStatus() {
        OrcaPatientCacheStore.PatientCacheCommand command = OrcaPatientCacheStore.fromOrcaResponse(
                "F001",
                "99999",
                "req-101",
                "trace-101",
                Instant.parse("2026-05-10T20:39:21Z"),
                patientGetJson("99999", "10", "患者番号がありません"));

        assertEquals("ORCA_PATIENT_NOT_FOUND", command.businessStatus());
        assertEquals("NOT_FOUND", command.cacheStatus());
        assertEquals("99999", command.orcaPatientId());
    }

    private static String patientGetJson(String patientId, String apiResult, String message) {
        return """
                {
                  "Api_Result": "%s",
                  "Api_Result_Message": "%s",
                  "Patient_Information": {
                    "Patient_ID": "%s",
                    "WholeName": "SHOULD_NOT_BE_RAW",
                    "WholeName_inKana": "SHOULD_NOT_BE_RAW_KANA",
                    "BirthDate": "1980-01-01",
                    "Sex": "1",
                    "WholeAddress1": "SHOULD_NOT_BE_RAW_ADDRESS",
                    "PhoneNumber1": "SHOULD_NOT_BE_RAW_PHONE"
                  }
                }
                """.formatted(apiResult, message, patientId);
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
