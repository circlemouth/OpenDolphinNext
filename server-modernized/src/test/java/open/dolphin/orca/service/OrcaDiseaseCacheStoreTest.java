package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.time.Instant;
import java.time.LocalDate;
import javax.sql.DataSource;
import open.dolphin.rest.dto.orca.DiseaseImportResponse;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class OrcaDiseaseCacheStoreTest {

    @Test
    void saveStoresDiseaseGetMirrorAsOrcaCacheWithoutRawResponsePayload() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaDiseaseCacheStore store = new OrcaDiseaseCacheStore();
            store.dataSource = dataSource;

            DiseaseImportResponse response = response("00001", "2026-05-08", "I10");
            long firstId = store.save(new OrcaDiseaseCacheStore.DiseaseCacheCommand(
                    "F001",
                    "00001",
                    "202605",
                    LocalDate.parse("2026-05-08"),
                    "01",
                    "0001",
                    "trace-100",
                    "trace-100",
                    Instant.parse("2026-05-10T10:50:26Z"),
                    Instant.parse("2026-05-10T11:05:26Z"),
                    "redacted-diseasegetv2-response-0000",
                    response));

            OrcaDiseaseCacheStore.DiseaseCacheRow row =
                    store.findLatest("F001", "00001", "202605", "01", "0001");
            assertNotNull(row);
            assertEquals(firstId, row.id());
            assertEquals("diseasegetv2", row.sourceApi());
            assertEquals("trace-100", row.sourceTraceId());
            assertEquals("202605", row.baseMonth());
            assertEquals(LocalDate.parse("2026-05-08"), row.performDate());
            assertEquals(64, row.rawResponseHash().length());
            assertTrue(row.normalizedPayloadJson().contains("\"orcaMirrorStatus\": \"connected\"")
                    || row.normalizedPayloadJson().contains("\"orcaMirrorStatus\":\"connected\""));
            assertTrue(row.normalizedPayloadJson().contains("\"diagnosisCode\": \"I10\"")
                    || row.normalizedPayloadJson().contains("\"diagnosisCode\":\"I10\""));
            assertFalse(row.normalizedPayloadJson().contains("<xmlio2>"));
            assertEquals("[]", row.warningsJson());
            assertEquals("[]", row.unmatchedJson());

            long secondId = store.save(new OrcaDiseaseCacheStore.DiseaseCacheCommand(
                    "F001",
                    "00001",
                    "202605",
                    LocalDate.parse("2026-05-08"),
                    "01",
                    "0001",
                    "trace-101",
                    "trace-101",
                    Instant.parse("2026-05-10T10:55:26Z"),
                    Instant.parse("2026-05-10T11:10:26Z"),
                    "redacted-diseasegetv2-response-0000-updated",
                    response("00001", "2026-05-08", "J00")));

            OrcaDiseaseCacheStore.DiseaseCacheRow updated =
                    store.findLatest("F001", "00001", "202605", "01", "0001");
            assertNotNull(updated);
            assertNotEquals(firstId, secondId);
            assertEquals(secondId, updated.id());
            assertEquals("trace-101", updated.sourceTraceId());
            assertTrue(updated.normalizedPayloadJson().contains("\"diagnosisCode\": \"J00\"")
                    || updated.normalizedPayloadJson().contains("\"diagnosisCode\":\"J00\""));
        }
    }

    private static DiseaseImportResponse response(String patientId, String baseDate, String diseaseCode) {
        DiseaseImportResponse response = new DiseaseImportResponse();
        response.setApiResult("0000");
        response.setApiResultMessage("OK");
        response.setPatientId(patientId);
        response.setBaseDate(baseDate);
        response.setOrcaMirrorStatus("connected");
        DiseaseImportResponse.DiseaseEntry entry = new DiseaseImportResponse.DiseaseEntry();
        entry.setDiagnosisCode(diseaseCode);
        entry.setDiagnosisName("ORCA mirror disease");
        entry.setDepartmentCode("01");
        entry.setInsuranceCombinationNumber("0001");
        entry.setStartDate("2026-05-01");
        response.setDiseases(java.util.List.of(entry));
        return response;
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
