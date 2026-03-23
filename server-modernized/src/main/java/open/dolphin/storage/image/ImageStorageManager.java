package open.dolphin.storage.image;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.Collection;
import java.util.HexFormat;
import java.util.Objects;
import java.util.Optional;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import open.dolphin.infomodel.ExtRefModel;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.storage.attachment.AttachmentStorageConfigLoader;
import open.dolphin.storage.attachment.AttachmentStorageException;
import open.dolphin.storage.attachment.AttachmentStorageSettings;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;
import software.amazon.awssdk.utils.IoUtils;

@ApplicationScoped
public class ImageStorageManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(ImageStorageManager.class);

    @Inject
    AttachmentStorageConfigLoader configLoader;

    private AttachmentStorageSettings settings;
    private S3Client s3Client;

    @PostConstruct
    void init() {
        settings = configLoader.load();
        if (!settings.getMode().isS3()) {
            throw new AttachmentStorageException("Unsupported image storage mode: " + settings.getMode());
        }
        AttachmentStorageSettings.S3Settings s3Settings = settings.getS3()
                .orElseThrow(() -> new AttachmentStorageException("S3 settings are missing"));
        s3Client = createClient(s3Settings);
    }

    @PreDestroy
    void shutdown() {
        if (s3Client != null) {
            s3Client.close();
        }
    }

    public void persistExternalAssets(Collection<SchemaModel> schemas) {
        if (schemas == null || schemas.isEmpty()) {
            return;
        }
        requireS3Mode();
        for (SchemaModel schema : schemas) {
            uploadToS3(schema);
        }
    }

    public void populateBinary(SchemaModel schema) {
        if (schema == null || schema.getImageBytes() != null) {
            return;
        }
        if (!hasText(schema.getUri())) {
            throw new AttachmentStorageException("Image " + schema.getId() + " has no external uri");
        }
        S3ObjectLocation location = resolveLocation(schema.getUri())
                .orElseThrow(() -> new AttachmentStorageException("Invalid image uri: " + schema.getUri()));
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(location.bucket())
                .key(location.key())
                .build();
        try (software.amazon.awssdk.core.ResponseInputStream<GetObjectResponse> response = s3Client.getObject(request)) {
            schema.setImageBytes(IoUtils.toByteArray((InputStream) response));
        } catch (IOException ex) {
            throw new AttachmentStorageException("Failed to download image " + location.key(), ex);
        }
    }

    public void deleteExternalAsset(SchemaModel schema) {
        if (schema == null || !hasText(schema.getUri())) {
            return;
        }
        requireS3Mode();
        resolveLocation(schema.getUri()).ifPresent(location -> {
            try {
                s3Client.deleteObject(DeleteObjectRequest.builder()
                        .bucket(location.bucket())
                        .key(location.key())
                        .build());
            } catch (Exception ex) {
                LOGGER.warn("Failed to delete image {}: {}", schema.getUri(), ex.getMessage());
            }
        });
    }

    private void uploadToS3(SchemaModel schema) {
        if (schema == null || schema.getImageBytes() == null || schema.getImageBytes().length == 0) {
            return;
        }
        if (hasText(schema.getUri()) && hasText(schema.getDigest())) {
            return;
        }
        AttachmentStorageSettings.S3Settings s3Settings = settings.getS3()
                .orElseThrow(() -> new AttachmentStorageException("S3 settings missing"));
        byte[] bytes = schema.getImageBytes();
        schema.setDigest(hasText(schema.getDigest()) ? schema.getDigest() : sha256Hex(bytes));
        String key = resolveKey(schema);
        PutObjectRequest.Builder builder = PutObjectRequest.builder()
                .bucket(s3Settings.getBucket())
                .key(key)
                .contentLength((long) bytes.length);
        String contentType = resolveContentType(schema);
        if (contentType != null) {
            builder.contentType(contentType);
        }
        s3Settings.getServerSideEncryption()
                .map(String::toUpperCase)
                .ifPresent(mode -> applyServerSideEncryption(builder, mode, s3Settings));
        s3Client.putObject(builder.build(), RequestBody.fromBytes(bytes));
        schema.setUri("s3://" + s3Settings.getBucket() + "/" + key);
        schema.setImageBytes(null);
    }

    private String resolveKey(SchemaModel schema) {
        long documentId = schema.getDocumentModel() != null ? schema.getDocumentModel().getId() : 0L;
        long imageId = schema.getId();
        String suffix = ".bin";
        ExtRefModel extRef = schema.getExtRefModel();
        if (extRef != null && hasText(extRef.getContentType())) {
            suffix = contentTypeSuffix(extRef.getContentType());
        }
        return "images/doc-" + documentId + "/img-" + imageId + suffix;
    }

    private String resolveContentType(SchemaModel schema) {
        ExtRefModel extRef = schema.getExtRefModel();
        return extRef != null && hasText(extRef.getContentType()) ? extRef.getContentType() : null;
    }

    private String contentTypeSuffix(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            default -> ".bin";
        };
    }

    private boolean isS3Enabled() {
        return settings != null && settings.getMode().isS3();
    }

    private Optional<S3ObjectLocation> resolveLocation(String uri) {
        if (!hasText(uri) || !uri.startsWith("s3://")) {
            return Optional.empty();
        }
        String withoutScheme = uri.substring("s3://".length());
        int slash = withoutScheme.indexOf('/');
        if (slash <= 0 || slash == withoutScheme.length() - 1) {
            return Optional.empty();
        }
        return Optional.of(new S3ObjectLocation(
                withoutScheme.substring(0, slash),
                withoutScheme.substring(slash + 1)));
    }

    private S3Client createClient(AttachmentStorageSettings.S3Settings s3Settings) {
        S3ClientBuilder builder = S3Client.builder()
                .region(Region.of(s3Settings.getRegion()))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(s3Settings.isForcePathStyle())
                        .build());
        s3Settings.getEndpoint().ifPresent(builder::endpointOverride);
        if (hasText(s3Settings.getAccessKey()) && hasText(s3Settings.getSecretKey())) {
            builder.credentialsProvider(StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(s3Settings.getAccessKey(), s3Settings.getSecretKey())));
        }
        return builder.build();
    }

    private void applyServerSideEncryption(PutObjectRequest.Builder builder,
                                           String mode,
                                           AttachmentStorageSettings.S3Settings s3Settings) {
        if ("AES256".equalsIgnoreCase(mode)) {
            builder.serverSideEncryption(ServerSideEncryption.AES256);
        } else if ("AWS:KMS".equalsIgnoreCase(mode) || "KMS".equalsIgnoreCase(mode)) {
            builder.serverSideEncryption(ServerSideEncryption.AWS_KMS);
            s3Settings.getKmsKeyId().ifPresent(builder::ssekmsKeyId);
        }
    }

    private String sha256Hex(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to calculate SHA-256", ex);
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private void requireS3Mode() {
        if (!isS3Enabled()) {
            throw new AttachmentStorageException("Unsupported image storage mode: "
                    + (settings != null ? settings.getMode() : "null"));
        }
    }

    private record S3ObjectLocation(String bucket, String key) {
    }
}
