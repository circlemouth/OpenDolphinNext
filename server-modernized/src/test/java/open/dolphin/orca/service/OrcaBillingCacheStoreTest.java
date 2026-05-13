package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import javax.sql.DataSource;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
import open.dolphin.rest.dto.orca.OrcaReportResponse;
import open.dolphin.storage.attachment.AttachmentStorageMode;
import open.dolphin.storage.attachment.AttachmentStorageSettings;
import open.dolphin.storage.objectstore.ObjectStorageClient;
import open.dolphin.storage.objectstore.ObjectStorageDeleteRequest;
import open.dolphin.storage.objectstore.ObjectStorageGetRequest;
import open.dolphin.storage.objectstore.ObjectStorageLocation;
import open.dolphin.storage.objectstore.ObjectStoragePutRequest;
import open.dolphin.storage.objectstore.ObjectStoragePutResult;
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
            entry.setDepartmentName("内科");
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
                assertEquals("incomeinfv2", singleText(connection,
                        "select source_api from opendolphin.orca_billing_cache"));
                assertEquals("2026-03-22", singleText(connection,
                        "select visit_date from opendolphin.orca_billing_cache"));
                assertEquals("内科", singleText(connection,
                        "select department from opendolphin.orca_billing_cache"));
                assertEquals("INS-SECRET-001", singleText(connection,
                        "select insurance_combination from opendolphin.orca_billing_cache"));
                assertEquals("true", singleText(connection,
                        "select (fetched_at is not null)::text from opendolphin.orca_billing_cache"));
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

    @Test
    void uploadsReportBinaryOnlyWhenDigestAndSnapshotMetadataMatch() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);
            OrcaBillingCacheStore store = new OrcaBillingCacheStore();
            store.dataSource = dataSource;

            OrcaReportResponse response = new OrcaReportResponse();
            response.setOk(true);
            response.setStatus(200);
            response.setApiResult("0000");
            response.setDataId("DATA-SECRET-003");
            response.setFormId("FORM-2");

            store.saveReportSnapshot(new OrcaBillingCacheStore.ReportSnapshotCommand(
                    "F001", "00001", "statement", "INV-SECRET-003",
                    REQUEST_XML, RESPONSE_BODY, response, null));

            long snapshotId;
            String storageKey;
            String storageDigest;
            try (Connection connection = dataSource.getConnection()) {
                snapshotId = singleLong(connection,
                        "select orca_report_snapshot_id from opendolphin.orca_report_snapshot");
                storageKey = singleText(connection,
                        "select server_storage_object_key from opendolphin.orca_report_snapshot");
                storageDigest = singleText(connection,
                        "select server_storage_digest from opendolphin.orca_report_snapshot");
            }

            FakeObjectStorageClient objectStorageClient = new FakeObjectStorageClient();
            OrcaReportBinaryStorageService service = new OrcaReportBinaryStorageService(
                    dataSource, s3Settings(), objectStorageClient);
            Instant uploadedAt = Instant.parse("2026-05-10T00:02:09Z");
            Instant retentionUntil = uploadedAt.plusSeconds(86400);

            OrcaReportBinaryStorageService.UploadResult result = service.uploadReportBinary(
                    new OrcaReportBinaryStorageService.UploadCommand(
                            snapshotId,
                            "F001",
                            storageKey,
                            storageDigest,
                            RESPONSE_BODY.getBytes(StandardCharsets.UTF_8),
                            "application/json",
                            uploadedAt,
                            retentionUntil));

            assertEquals(snapshotId, result.snapshotId());
            assertEquals(storageDigest, result.digest());
            assertEquals("s3://orca-report-test/" + storageKey, result.storageUri());
            assertEquals(storageKey, objectStorageClient.lastRequest.location().key());
            assertFalse(objectStorageClient.lastPayload.contains("DATA-SECRET-003"));

            try (Connection connection = dataSource.getConnection()) {
                assertEquals("UPLOADED", singleText(connection,
                        "select storage_upload_status from opendolphin.orca_report_snapshot"));
                assertEquals("true", singleText(connection,
                        "select (storage_uploaded_at is not null)::text from opendolphin.orca_report_snapshot"));
                assertEquals("true", singleText(connection,
                        "select (storage_retention_until >= storage_uploaded_at)::text from opendolphin.orca_report_snapshot"));
            }
        }
    }

    @Test
    void rejectsReportBinaryUploadBeforeObjectStorageWhenDigestDoesNotMatch() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);
            OrcaBillingCacheStore store = new OrcaBillingCacheStore();
            store.dataSource = dataSource;

            OrcaReportResponse response = new OrcaReportResponse();
            response.setOk(true);
            response.setStatus(200);
            response.setApiResult("0000");

            store.saveReportSnapshot(new OrcaBillingCacheStore.ReportSnapshotCommand(
                    "F001", "00001", "statement", "INV-SECRET-004",
                    REQUEST_XML, RESPONSE_BODY, response, null));

            long snapshotId;
            String storageKey;
            String storageDigest;
            try (Connection connection = dataSource.getConnection()) {
                snapshotId = singleLong(connection,
                        "select orca_report_snapshot_id from opendolphin.orca_report_snapshot");
                storageKey = singleText(connection,
                        "select server_storage_object_key from opendolphin.orca_report_snapshot");
                storageDigest = singleText(connection,
                        "select server_storage_digest from opendolphin.orca_report_snapshot");
            }

            FakeObjectStorageClient objectStorageClient = new FakeObjectStorageClient();
            OrcaReportBinaryStorageService service = new OrcaReportBinaryStorageService(
                    dataSource, s3Settings(), objectStorageClient);
            Instant uploadedAt = Instant.parse("2026-05-10T00:02:09Z");

            assertThrows(IllegalArgumentException.class, () -> service.uploadReportBinary(
                    new OrcaReportBinaryStorageService.UploadCommand(
                            snapshotId,
                            "F001",
                            storageKey,
                            storageDigest,
                            "tampered".getBytes(StandardCharsets.UTF_8),
                            "application/json",
                            uploadedAt,
                            uploadedAt.plusSeconds(86400))));
            assertEquals(0, objectStorageClient.putCount);
            try (Connection connection = dataSource.getConnection()) {
                assertEquals("NOT_UPLOADED", singleText(connection,
                        "select storage_upload_status from opendolphin.orca_report_snapshot"));
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

    private static long singleLong(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            rs.next();
            return rs.getLong(1);
        }
    }

    private static void execute(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.executeUpdate();
        }
    }

    private static AttachmentStorageSettings s3Settings() {
        return new AttachmentStorageSettings(
                AttachmentStorageMode.S3,
                null,
                new AttachmentStorageSettings.S3Settings(
                        "orca-report-test",
                        "ap-northeast-1",
                        null,
                        "attachments",
                        true,
                        null,
                        null,
                        64,
                        "access-key",
                        "secret-key"),
                null);
    }

    private static final class FakeObjectStorageClient implements ObjectStorageClient {
        private ObjectStoragePutRequest lastRequest;
        private String lastPayload;
        private int putCount;

        @Override
        public ObjectStoragePutResult putObject(ObjectStoragePutRequest request) {
            putCount++;
            lastRequest = request;
            try {
                lastPayload = new String(request.contentStream().readAllBytes(), StandardCharsets.UTF_8);
            } catch (Exception ex) {
                throw new IllegalStateException(ex);
            }
            return new ObjectStoragePutResult(request.location());
        }

        @Override
        public InputStream getObject(ObjectStorageGetRequest request) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteObject(ObjectStorageDeleteRequest request) {
        }

        @Override
        public boolean isBucketReachable(String bucket) {
            return true;
        }

        @Override
        public void close() {
        }
    }
}
