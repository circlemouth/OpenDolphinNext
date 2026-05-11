package open.dolphin.orca.service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.ByteArrayInputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import javax.sql.DataSource;
import open.dolphin.storage.attachment.AttachmentStorageConfigLoader;
import open.dolphin.storage.attachment.AttachmentStorageException;
import open.dolphin.storage.attachment.AttachmentStorageSettings;
import open.dolphin.storage.objectstore.ObjectStorageClient;
import open.dolphin.storage.objectstore.ObjectStorageDeleteRequest;
import open.dolphin.storage.objectstore.ObjectStorageDigestSupport;
import open.dolphin.storage.objectstore.ObjectStorageLocation;
import open.dolphin.storage.objectstore.ObjectStoragePutRequest;
import open.dolphin.storage.objectstore.ObjectStoragePutResult;
import open.dolphin.storage.objectstore.S3CompatibleObjectStorageClient;

@ApplicationScoped
public class OrcaReportBinaryStorageService {

    private static final String CONTENT_TYPE_JSON = "application/json";
    private static final String SQL_SELECT_REPORT_SNAPSHOT = """
            SELECT 1
              FROM opendolphin.orca_report_snapshot
             WHERE orca_report_snapshot_id = ?
               AND facility_id = ?
               AND server_storage_object_key = ?
               AND server_storage_digest = ?
               AND snapshot_status = 'CURRENT'
               AND storage_upload_status IN ('NOT_UPLOADED', 'UPLOAD_FAILED')
            """;
    private static final String SQL_MARK_UPLOADED = """
            UPDATE opendolphin.orca_report_snapshot
               SET storage_upload_status = 'UPLOADED',
                   storage_uploaded_at = ?,
                   storage_retention_until = ?
             WHERE orca_report_snapshot_id = ?
               AND facility_id = ?
               AND server_storage_object_key = ?
               AND server_storage_digest = ?
               AND snapshot_status = 'CURRENT'
               AND storage_upload_status IN ('NOT_UPLOADED', 'UPLOAD_FAILED')
            """;

    @Inject
    AttachmentStorageConfigLoader configLoader;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    private AttachmentStorageSettings settings;
    private ObjectStorageClient objectStorageClient;

    public OrcaReportBinaryStorageService() {
    }

    OrcaReportBinaryStorageService(
            DataSource dataSource,
            AttachmentStorageSettings settings,
            ObjectStorageClient objectStorageClient) {
        this.dataSource = dataSource;
        this.settings = settings;
        this.objectStorageClient = objectStorageClient;
    }

    @PostConstruct
    void init() {
        if (settings != null) {
            return;
        }
        settings = configLoader.load();
        if (settings.getMode().isDisabled()) {
            objectStorageClient = null;
            return;
        }
        if (!settings.getMode().isS3()) {
            throw new AttachmentStorageException("Unsupported ORCA report storage mode: " + settings.getMode());
        }
        AttachmentStorageSettings.S3Settings s3Settings = settings.getS3()
                .orElseThrow(() -> new AttachmentStorageException("S3 settings are missing"));
        objectStorageClient = new S3CompatibleObjectStorageClient(new S3CompatibleObjectStorageClient.Config(
                s3Settings.getRegion(),
                s3Settings.getEndpoint().orElse(null),
                s3Settings.isForcePathStyle(),
                s3Settings.getServerSideEncryption().orElse(null),
                s3Settings.getKmsKeyId().orElse(null),
                s3Settings.getAccessKey(),
                s3Settings.getSecretKey()));
    }

    @PreDestroy
    void shutdown() {
        if (objectStorageClient != null) {
            objectStorageClient.close();
        }
    }

    public UploadResult uploadReportBinary(UploadCommand command) {
        Objects.requireNonNull(command, "command");
        requireS3Mode();
        long snapshotId = requirePositive(command.snapshotId(), "snapshotId");
        String facilityId = requireText(command.facilityId(), "facilityId");
        String objectKey = requireReportObjectKey(command.serverStorageObjectKey());
        String expectedDigest = requireSha256(command.serverStorageDigest(), "serverStorageDigest");
        byte[] content = requireContent(command.contentBytes());
        Instant uploadedAt = command.uploadedAt() != null ? command.uploadedAt() : Instant.now();
        Instant retentionUntil = requireRetentionUntil(command.retentionUntil(), uploadedAt);
        String actualDigest = ObjectStorageDigestSupport.sha256Hex(content);
        if (!expectedDigest.equals(actualDigest)) {
            throw new IllegalArgumentException("ORCA report binary digest does not match snapshot metadata");
        }
        verifySnapshotReady(snapshotId, facilityId, objectKey, expectedDigest);

        AttachmentStorageSettings.S3Settings s3Settings = settings.getS3()
                .orElseThrow(() -> new AttachmentStorageException("S3 settings are missing"));
        ObjectStorageLocation target = ObjectStorageLocation.s3(s3Settings.getBucket(), objectKey);
        ObjectStoragePutResult result = objectStorageClient.putObject(new ObjectStoragePutRequest(
                target,
                new ByteArrayInputStream(content),
                content.length,
                normalize(command.contentType()) != null ? command.contentType().trim() : CONTENT_TYPE_JSON));
        ObjectStorageLocation stored = result.location();
        if (!s3Settings.getBucket().equals(stored.bucket()) || !objectKey.equals(stored.key())) {
            throw new AttachmentStorageException("ORCA report object storage returned unexpected location");
        }
        try {
            markUploaded(snapshotId, facilityId, objectKey, expectedDigest, uploadedAt, retentionUntil);
        } catch (RuntimeException ex) {
            deleteUploadedObject(stored);
            throw ex;
        }
        return new UploadResult(snapshotId, stored.toUri(), expectedDigest, uploadedAt, retentionUntil);
    }

    private void deleteUploadedObject(ObjectStorageLocation stored) {
        try {
            objectStorageClient.deleteObject(new ObjectStorageDeleteRequest(stored));
        } catch (RuntimeException ignored) {
            // The DB remains the authority; do not mask the failed metadata update.
        }
    }

    private void verifySnapshotReady(long snapshotId, String facilityId, String objectKey, String expectedDigest) {
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_REPORT_SNAPSHOT)) {
            statement.setLong(1, snapshotId);
            statement.setString(2, facilityId);
            statement.setString(3, objectKey);
            statement.setString(4, expectedDigest);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    throw new IllegalStateException("ORCA report snapshot is not eligible for binary upload");
                }
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to verify ORCA report snapshot storage metadata", ex);
        }
    }

    private void markUploaded(
            long snapshotId,
            String facilityId,
            String objectKey,
            String expectedDigest,
            Instant uploadedAt,
            Instant retentionUntil) {
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_MARK_UPLOADED)) {
            statement.setTimestamp(1, Timestamp.from(uploadedAt));
            statement.setTimestamp(2, Timestamp.from(retentionUntil));
            statement.setLong(3, snapshotId);
            statement.setString(4, facilityId);
            statement.setString(5, objectKey);
            statement.setString(6, expectedDigest);
            if (statement.executeUpdate() != 1) {
                throw new IllegalStateException("ORCA report snapshot upload state was not updated");
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to mark ORCA report snapshot binary uploaded", ex);
        }
    }

    private void requireS3Mode() {
        if (settings == null || !settings.getMode().isS3() || objectStorageClient == null) {
            throw new AttachmentStorageException("ORCA report binary storage is not ready");
        }
    }

    private static long requirePositive(long value, String name) {
        if (value <= 0L) {
            throw new IllegalArgumentException(name + " must be positive");
        }
        return value;
    }

    private static String requireReportObjectKey(String value) {
        String normalized = requireText(value, "serverStorageObjectKey");
        if (!normalized.startsWith("orca-reports/") || normalized.contains("..") || normalized.contains("\\")) {
            throw new IllegalArgumentException("serverStorageObjectKey is not a server-generated ORCA report key");
        }
        return normalized;
    }

    private static String requireSha256(String value, String name) {
        String normalized = requireText(value, name).toLowerCase(Locale.ROOT);
        if (!normalized.matches("^[0-9a-f]{64}$")) {
            throw new IllegalArgumentException(name + " must be a sha256 hex digest");
        }
        return normalized;
    }

    private static byte[] requireContent(byte[] contentBytes) {
        if (contentBytes == null || contentBytes.length == 0) {
            throw new IllegalArgumentException("contentBytes is required");
        }
        return contentBytes.clone();
    }

    private static Instant requireRetentionUntil(Instant retentionUntil, Instant uploadedAt) {
        if (retentionUntil == null || retentionUntil.isBefore(uploadedAt)) {
            throw new IllegalArgumentException("retentionUntil must be greater than or equal to uploadedAt");
        }
        return retentionUntil;
    }

    private static String requireText(String value, String name) {
        String normalized = normalize(value);
        if (normalized == null) {
            throw new IllegalArgumentException(name + " is required");
        }
        return normalized;
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not configured");
        }
        return dataSource;
    }

    public record UploadCommand(
            long snapshotId,
            String facilityId,
            String serverStorageObjectKey,
            String serverStorageDigest,
            byte[] contentBytes,
            String contentType,
            Instant uploadedAt,
            Instant retentionUntil) {
    }

    public record UploadResult(
            long snapshotId,
            String storageUri,
            String digest,
            Instant uploadedAt,
            Instant retentionUntil) {
    }
}
