package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.time.Instant;
import java.time.LocalDate;
import javax.sql.DataSource;
import open.dolphin.rest.dto.orca.ChartSupportDiseaseModV3Response;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class OrcaDiseaseOperationStoreTest {

    @Test
    void saveCompletedStoresHashesAndSanitizedSummariesForIdempotencyLookup() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaDiseaseOperationStore store = new OrcaDiseaseOperationStore();
            store.dataSource = dataSource;

            ChartSupportDiseaseModV3Response response = new ChartSupportDiseaseModV3Response();
            response.setApiResult("0000");
            response.setBusinessAccepted(true);
            response.setResponseClassification("businessAccepted");
            response.setOperationStatus("ORCA_WARNING");
            response.setNeedsUserReview(true);
            ChartSupportDiseaseModV3Response.DiseaseWarning warning =
                    new ChartSupportDiseaseModV3Response.DiseaseWarning();
            warning.setCode("W001");
            warning.setMessageCategory("warning_like");
            response.setWarnings(java.util.List.of(warning));

            String requestXml = "<data><diseasereq><Patient_ID>00001</Patient_ID></diseasereq></data>";
            String responseBody = "<xmlio2><diseaseres><Api_Result>0000</Api_Result></diseaseres></xmlio2>";
            String idempotencyKey = OrcaDiseaseOperationStore.idempotencyKey("create", requestXml);

            long id = store.saveCompleted(new OrcaDiseaseOperationStore.OperationCommand(
                    "F001",
                    "create",
                    idempotencyKey,
                    "F001:doctor01",
                    Instant.parse("2026-05-10T11:22:25Z"),
                    Instant.parse("2026-05-10T11:22:26Z"),
                    Instant.parse("2026-05-10T11:22:27Z"),
                    "00001",
                    null,
                    null,
                    LocalDate.parse("2026-05-08"),
                    "01",
                    "10001",
                    "0001",
                    1,
                    requestXml,
                    responseBody,
                    response));

            OrcaDiseaseOperationStore.OperationRow row =
                    store.findByIdempotencyKey("F001", idempotencyKey);
            assertNotNull(row);
            assertEquals(id, row.id());
            assertEquals("ORCA_WARNING", row.operationStatus());
            assertTrue(row.needsUserReview());
            assertEquals(64, row.requestHash().length());
            assertEquals(64, row.responseHash().length());
            assertFalse(row.requestHash().contains("Patient_ID"));
            assertFalse(row.responseHash().contains("Api_Result"));
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
