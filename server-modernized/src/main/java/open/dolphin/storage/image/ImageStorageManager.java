package open.dolphin.storage.image;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.transaction.Status;
import jakarta.transaction.Synchronization;
import jakarta.transaction.Transactional;
import jakarta.transaction.TransactionSynchronizationRegistry;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.Collection;
import java.util.Objects;
import java.util.Optional;
import open.dolphin.infomodel.ExtRefModel;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.storage.attachment.AttachmentStorageConfigLoader;
import open.dolphin.storage.attachment.AttachmentStorageException;
import open.dolphin.storage.attachment.AttachmentStorageSettings;
import open.dolphin.storage.objectstore.ObjectStorageClient;
import open.dolphin.storage.objectstore.ObjectStorageDeleteRequest;
import open.dolphin.storage.objectstore.ObjectStorageDigestSupport;
import open.dolphin.storage.objectstore.ObjectStorageGetRequest;
import open.dolphin.storage.objectstore.ObjectStorageLocation;
import open.dolphin.storage.objectstore.ObjectStoragePutRequest;
import open.dolphin.storage.objectstore.ObjectStoragePutResult;
import open.dolphin.storage.objectstore.S3CompatibleObjectStorageClient;
import software.amazon.awssdk.utils.IoUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ApplicationScoped
public class ImageStorageManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(ImageStorageManager.class);
    private static final String STORAGE_PROVIDER_S3 = "s3";

    @Inject
    AttachmentStorageConfigLoader configLoader;

    @Inject
    Instance<ImageStorageManager> selfReference;

    @Resource
    private TransactionSynchronizationRegistry registry;

    private AttachmentStorageSettings settings;
    private ObjectStorageClient objectStorageClient;

    @PostConstruct
    void init() {
        settings = configLoader.load();
        if (!settings.getMode().isS3()) {
            throw new AttachmentStorageException("Unsupported image storage mode: " + settings.getMode());
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

    public void persistExternalAssets(Collection<SchemaModel> schemas) {
        if (schemas == null || schemas.isEmpty()) {
            return;
        }
        requireS3Mode();
        ImageStorageManager invoker = selfReference != null && !selfReference.isUnsatisfied()
                ? selfReference.get()
                : this;
        for (SchemaModel schema : schemas) {
            if (invoker.uploadToObjectStoreOutsideTransaction(schema)) {
                registerRollbackHook(schema);
            }
        }
    }

    @Transactional(Transactional.TxType.NOT_SUPPORTED)
    public boolean uploadToObjectStoreOutsideTransaction(SchemaModel schema) {
        return uploadToObjectStore(schema);
    }

    public void populateBinary(SchemaModel schema) {
        if (schema == null || schema.getImageBytes() != null) {
            return;
        }
        if (!hasText(schema.getUri()) && !hasText(schema.getStorageBucket())) {
            throw new AttachmentStorageException("Image " + schema.getId() + " has no external uri");
        }
        ObjectStorageLocation location = resolveLocation(schema)
                .orElseThrow(() -> new AttachmentStorageException("Invalid image uri: " + schema.getUri()));
        try (InputStream response = objectStorageClient.getObject(new ObjectStorageGetRequest(location))) {
            schema.setImageBytes(IoUtils.toByteArray(response));
        } catch (IOException ex) {
            throw new AttachmentStorageException("Failed to download image " + location.key(), ex);
        }
    }

    public void deleteExternalAsset(SchemaModel schema) {
        if (schema == null || (!hasText(schema.getUri()) && !hasText(schema.getStorageBucket()))) {
            return;
        }
        requireS3Mode();
        resolveLocation(schema).ifPresent(location -> {
            try {
                objectStorageClient.deleteObject(new ObjectStorageDeleteRequest(location));
            } catch (Exception ex) {
                LOGGER.warn("Failed to delete image {}: {}", location.toUri(), ex.getMessage());
            }
        });
    }

    public void scheduleDeleteExternalAssetAfterCommit(SchemaModel schema) {
        if (schema == null || (!hasText(schema.getUri()) && !hasText(schema.getStorageBucket()))) {
            return;
        }
        requireS3Mode();
        ImageStorageManager invoker = selfReference != null && !selfReference.isUnsatisfied()
                ? selfReference.get()
                : this;
        if (registry == null) {
            invoker.deleteExternalAssetOutsideTransaction(schema);
            return;
        }
        int txStatus = registry.getTransactionStatus();
        if (txStatus == Status.STATUS_ACTIVE
                || txStatus == Status.STATUS_MARKED_ROLLBACK
                || txStatus == Status.STATUS_PREPARING
                || txStatus == Status.STATUS_PREPARED
                || txStatus == Status.STATUS_COMMITTING
                || txStatus == Status.STATUS_ROLLING_BACK) {
            registry.registerInterposedSynchronization(new Synchronization() {
                @Override
                public void beforeCompletion() {
                    // no-op
                }

                @Override
                public void afterCompletion(int status) {
                    if (status == Status.STATUS_COMMITTED) {
                        invoker.deleteExternalAssetOutsideTransaction(schema);
                    }
                }
            });
            return;
        }
        invoker.deleteExternalAssetOutsideTransaction(schema);
    }

    @Transactional(Transactional.TxType.NOT_SUPPORTED)
    public void deleteExternalAssetOutsideTransaction(SchemaModel schema) {
        deleteExternalAsset(schema);
    }

    private boolean uploadToObjectStore(SchemaModel schema) {
        if (schema == null || schema.getImageBytes() == null || schema.getImageBytes().length == 0) {
            return false;
        }
        if (isAlreadyExternalized(schema)) {
            return false;
        }
        AttachmentStorageSettings.S3Settings s3Settings = settings.getS3()
                .orElseThrow(() -> new AttachmentStorageException("S3 settings missing"));
        byte[] bytes = schema.getImageBytes();
        ensureDigest(schema, bytes);
        String key = resolveKey(schema);
        ObjectStorageLocation target = ObjectStorageLocation.s3(s3Settings.getBucket(), key);
        MessageDigest digest = ObjectStorageDigestSupport.newSha256Digest();
        try (InputStream digestInput = new java.security.DigestInputStream(
                new java.io.BufferedInputStream(new ByteArrayInputStream(bytes)),
                digest)) {
            ObjectStoragePutResult result = objectStorageClient.putObject(new ObjectStoragePutRequest(
                    target,
                    digestInput,
                    bytes.length,
                    resolveContentType(schema)));
            schema.setUri(result.location().toUri());
            ensureDigest(schema, digest);
            applyStoredObjectMetadata(schema, result.location());
            schema.setImageBytes(null);
            return true;
        } catch (Exception ex) {
            throw new AttachmentStorageException("Failed to upload image to object storage: " + key, ex);
        }
    }

    private void applyStoredObjectMetadata(SchemaModel schema, ObjectStorageLocation location) {
        schema.setStorageProvider(location.provider());
        schema.setStorageBucket(location.bucket());
        schema.setStorageKey(location.key());
        schema.setStorageVersionId(location.versionId());
        schema.setStorageEtag(location.eTag());
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

    private void registerRollbackHook(SchemaModel schema) {
        if (registry == null) {
            LOGGER.warn("TransactionSynchronizationRegistry is not available. Rollback for object upload {} cannot be guaranteed.",
                    schema.getUri());
            return;
        }
        try {
            registry.registerInterposedSynchronization(new Synchronization() {
                @Override
                public void beforeCompletion() {
                    // No action needed
                }

                @Override
                public void afterCompletion(int status) {
                    if (status != Status.STATUS_COMMITTED) {
                        LOGGER.info("Transaction rolled back. Deleting object: {}", schema.getUri());
                        deleteExternalAsset(schema);
                    }
                }
            });
        } catch (Exception e) {
            LOGGER.warn("Failed to register synchronization for schema {}: {}", schema.getId(), e.getMessage());
        }
    }

    private boolean isAlreadyExternalized(SchemaModel schema) {
        if (!hasText(schema.getUri())) {
            return false;
        }
        return hasText(schema.getDigest()) || schema.getImageBytes() == null;
    }

    private void ensureDigest(SchemaModel schema, byte[] bytes) {
        if (schema == null || hasText(schema.getDigest()) || bytes == null) {
            return;
        }
        schema.setDigest(ObjectStorageDigestSupport.sha256Hex(bytes));
    }

    private void ensureDigest(SchemaModel schema, MessageDigest digest) {
        if (schema == null || hasText(schema.getDigest()) || digest == null) {
            return;
        }
        schema.setDigest(ObjectStorageDigestSupport.sha256Hex(digest));
    }

    private Optional<ObjectStorageLocation> resolveLocation(SchemaModel schema) {
        if (schema == null) {
            return Optional.empty();
        }
        if (hasText(schema.getStorageBucket()) && hasText(schema.getStorageKey())) {
            return Optional.of(new ObjectStorageLocation(
                    hasText(schema.getStorageProvider()) ? schema.getStorageProvider() : STORAGE_PROVIDER_S3,
                    schema.getStorageBucket(),
                    schema.getStorageKey(),
                    schema.getStorageVersionId(),
                    schema.getStorageEtag()));
        }
        String uri = schema.getUri();
        if (!hasText(uri) || !uri.startsWith("s3://")) {
            return Optional.empty();
        }
        String withoutScheme = uri.substring("s3://".length());
        int slash = withoutScheme.indexOf('/');
        if (slash <= 0 || slash == withoutScheme.length() - 1) {
            return Optional.empty();
        }
        return Optional.of(ObjectStorageLocation.s3(
                withoutScheme.substring(0, slash),
                withoutScheme.substring(slash + 1)));
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private void requireS3Mode() {
        if (settings == null || !settings.getMode().isS3()) {
            throw new AttachmentStorageException("Unsupported image storage mode: "
                    + (settings != null ? settings.getMode() : "null"));
        }
    }
}
