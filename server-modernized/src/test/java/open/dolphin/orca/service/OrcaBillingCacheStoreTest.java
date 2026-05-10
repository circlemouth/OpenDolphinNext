package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import javax.sql.DataSource;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
import open.dolphin.rest.dto.orca.OrcaReportResponse;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class OrcaBillingCacheStoreTest {

    private static final String REQUEST_XML = "<data><request>sanitized</request></data>";
    private static final String RESPONSE_BODY = "{\"Api_Result\":\"0000\",\"Data_Id\":\"D-001\"}";

    @Test
    void savesIncomeInfoAsOrcaDerivedCacheWithoutRawInvoiceOrInsuranceValues() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);
            OrcaBillingCacheStore store = new OrcaBillingCacheStore();
            store.dataSource = dataSource;

            ChartSupportIncomeInfoResponse response = new ChartSupportIncomeInfoResponse();
            response.setOk(true);
            response.setApiOk(true);
            response.setStatus(200);
            response.setApiResult("0000");
            response.setApiResultMessage("OK");
            response.setUnpaidMoneyTotal(1200.0);
            ChartSupportIncomeInfoResponse.Entry entry = new ChartSupportIncomeInfoResponse.Entry();
            entry.setPerformDate("2026-03-22");
            entry.setInvoiceNumber("INV-SECRET-001");
            entry.setInsuranceCombinationNumber("INS-SECRET-001");
            entry.setAcMoney(1200.0);
            response.getEntries().add(entry);

            store.saveIncomeInfo(new OrcaBillingCacheStore.IncomeInfoCommand(
                    "F001", "00001", "2026-03-22", REQUEST_XML, RESPONSE_BODY, response, null));

            try (Connection connection = dataSource.getConnection()) {
                String summary = singleText(connection,
                        "select normalized_summary_json::text from opendolphin.orca_billing_cache");
                assertFalse(summary.contains("INV-SECRET-001"));
                assertFalse(summary.contains("INS-SECRET-001"));
                assertTrue(summary.contains("invoiceNumberHash"));
                assertEquals("ORCA", singleText(connection,
                        "select source_system from opendolphin.orca_billing_cache"));
                assertEquals("CURRENT", singleText(connection,
                        "select cache_status from opendolphin.orca_billing_cache"));
            }
        }
    }

    @Test
    void savesReportAsSnapshotWithoutRawInvoiceOrDataIdValues() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);
            OrcaBillingCacheStore store = new OrcaBillingCacheStore();
            store.dataSource = dataSource;

            OrcaReportResponse response = new OrcaReportResponse();
            response.setOk(true);
            response.setStatus(200);
            response.setApiResult("0000");
            response.setApiResultMessage("OK");
            response.setDataId("DATA-SECRET-001");
            response.setFormId("FORM-1");
            response.setFormName("Receipt");

            store.saveReportSnapshot(new OrcaBillingCacheStore.ReportSnapshotCommand(
                    "F001", "00001", "invoicereceipt", "INV-SECRET-002",
                    REQUEST_XML, RESPONSE_BODY, response, null));

            try (Connection connection = dataSource.getConnection()) {
                String summary = singleText(connection,
                        "select summary_json::text from opendolphin.orca_report_snapshot");
                assertFalse(summary.contains("INV-SECRET-002"));
                assertFalse(summary.contains("DATA-SECRET-001"));
                assertTrue(summary.contains("dataIdHash"));
                assertTrue(summary.contains("serverStorageObjectKey"));
                assertTrue(summary.contains("storageUploadStatus"));
                assertTrue(summary.contains("reportBinaryAvailable"));
                assertTrue(summary.contains("storageRetentionEnforced"));
                assertFalse(summary.contains("00001"));
                assertEquals("INVOICE_RECEIPT", singleText(connection,
                        "select report_type from opendolphin.orca_report_snapshot"));
                assertEquals("ORCA", singleText(connection,
                        "select source_system from opendolphin.orca_report_snapshot"));
                assertEquals("NOT_UPLOADED", singleText(connection,
                        "select storage_upload_status from opendolphin.orca_report_snapshot"));
                String storageKey = singleText(connection,
                        "select server_storage_object_key from opendolphin.orca_report_snapshot");
                String storageDigest = singleText(connection,
                        "select server_storage_digest from opendolphin.orca_report_snapshot");
                assertTrue(storageKey.startsWith("orca-reports/"));
                assertTrue(storageKey.endsWith(".json"));
                assertFalse(storageKey.contains("F001"));
                assertFalse(storageKey.contains("00001"));
                assertFalse(storageKey.contains("INV-SECRET-002"));
                assertFalse(storageKey.contains("DATA-SECRET-001"));
                assertEquals(64, storageDigest.length());
            }
        }
    }

    @Test
    void schemaRejectsInvalidSourceSystemAndRawHashShape() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);
            try (Connection connection = dataSource.getConnection()) {
                assertThrows(Exception.class, () -> execute(connection, """
                        INSERT INTO opendolphin.orca_billing_cache (
                            facility_id, source_system, cache_status, orca_patient_id, base_date, request_hash
                        ) VALUES ('F001', 'LOCAL', 'CURRENT', '00001', '20260322', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
                        """));
                assertThrows(Exception.class, () -> execute(connection, """
                        INSERT INTO opendolphin.orca_report_snapshot (
                            facility_id, source_api, report_type, snapshot_status, orca_patient_id, request_hash
                        ) VALUES ('F001', 'invoice_receiptv2', 'INVOICE_RECEIPT', 'CURRENT', '00001', 'raw-request-body')
                        """));
                assertThrows(Exception.class, () -> execute(connection, """
                        INSERT INTO opendolphin.orca_report_snapshot (
                            facility_id, source_api, report_type, snapshot_status, orca_patient_id,
                            request_hash, storage_upload_status, storage_uploaded_at, storage_retention_until
                        ) VALUES (
                            'F001', 'invoice_receiptv2', 'INVOICE_RECEIPT', 'CURRENT', '00001',
                            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
                            'UPLOADED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days'
                        )
                        """));
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

    private static String singleText(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            rs.next();
            return rs.getString(1);
        }
    }

    private static void execute(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.executeUpdate();
        }
    }
}
