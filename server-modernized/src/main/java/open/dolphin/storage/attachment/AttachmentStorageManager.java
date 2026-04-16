package open.dolphin.storage.attachment;

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
import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.util.Collection;
import java.util.Objects;
import java.util.Optional;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.storage.objectstore.ObjectStorageClient;
import open.dolphin.storage.objectstore.ObjectStorageDeleteRequest;
import open.dolphin.storage.objectstore.ObjectStorageDigestSupport;
import open.dolphin.storage.objectstore.ObjectStorageGetRequest;
import open.dolphin.storage.objectstore.ObjectStorageLocation;
import open.dolphin.storage.objectstore.ObjectStoragePutRequest;
import open.dolphin.storage.objectstore.ObjectStoragePutResult;
import open.dolphin.storage.objectstore.S3CompatibleObjectStorageClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 添付ファイルの保存先を制御するマネージャー。
 */
@ApplicationScoped
public class AttachmentStorageManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(AttachmentStorageManager.class);
    private static final int STREAM_BUFFER_SIZE = 8192;
    private static final String STORAGE_PROVIDER_S3 = "s3";
    public static final String LINK_RELATION_REFERENCE_ONLY = "attachment_reference";

    @Inject
    AttachmentStorageConfigLoader configLoader;

    @Inject
    Instance<AttachmentStorageManager> selfReference;

    @Resource
    private TransactionSynchronizationRegistry registry;

    private AttachmentStorageSettings settings;
    private AttachmentKeyResolver keyResolver;
    private ObjectStorageClient objectStorageClient;

    @PostConstruct
    void init() {
        settings = configLoader.load();
        if (settings.getMode().isS3()) {
            AttachmentStorageSettings.S3Settings s3Settings = settings.getS3()
                    .orElseThrow(() -> new AttachmentStorageException("S3 settings are missing"));
            keyResolver = new AttachmentKeyResolver(s3Settings);
            objectStorageClient = new S3CompatibleObjectStorageClient(new S3CompatibleObjectStorageClient.Config(
                    s3Settings.getRegion(),
                    s3Settings.getEndpoint().orElse(null),
                    s3Settings.isForcePathStyle(),
                    s3Settings.getServerSideEncryption().orElse(null),
                    s3Settings.getKmsKeyId().orElse(null),
                    s3Settings.getAccessKey(),
                    s3Settings.getSecretKey()));
            LOGGER.info("Attachment storage initialized in S3 mode (bucket={}, region={}, config={})",
                    s3Settings.getBucket(), s3Settings.getRegion(), settings.getSourcePath().orElse(null));
            return;
        }
        throw new AttachmentStorageException("Unsupported attachment storage mode: " + settings.getMode());
    }

    @PreDestroy
    void shutdown() {
        if (objectStorageClient != null) {
            objectStorageClient.close();
        }
    }

    public AttachmentStorageMode getMode() {
        return settings.getMode();
    }

    public boolean isBackendReachable() {
        if (settings == null) {
            return false;
        }
        requireS3Mode();
        AttachmentStorageSettings.S3Settings s3Settings = settings.getS3()
                .orElseThrow(() -> new AttachmentStorageException("S3 settings are missing"));
        return objectStorageClient != null && objectStorageClient.isBucketReachable(s3Settings.getBucket());
    }

    public void persistExternalAssets(Collection<AttachmentModel> attachments) {
        if (attachments == null || attachments.isEmpty()) {
            return;
        }
        requireS3Mode();
        AttachmentStorageManager invoker = selfReference != null && !selfReference.isUnsatisfied()
                ? selfReference.get()
                : this;
        attachments.stream()
                .filter(Objects::nonNull)
                .forEach(attachment -> {
                    if (invoker.uploadToS3OutsideTransaction(attachment)) {
                        registerRollbackHook(attachment);
                    }
                });
    }

    @Transactional(Transactional.TxType.NOT_SUPPORTED)
    public boolean uploadToS3OutsideTransaction(AttachmentModel attachment) {
        return uploadToS3(attachment);
    }

    @Transactional(Transactional.TxType.NOT_SUPPORTED)
    public boolean uploadToS3OutsideTransaction(AttachmentModel attachment, InputStream contentStream, long contentLength) {
        return uploadToS3(attachment, contentStream, contentLength);
    }

    public boolean prepareExternalAssetForPersist(AttachmentModel attachment, InputStream contentStream, long contentLength) {
        if (attachment == null) {
            return false;
        }
        requireS3Mode();
        AttachmentStorageManager invoker = selfReference != null && !selfReference.isUnsatisfied()
                ? selfReference.get()
                : this;
        boolean uploaded = invoker.uploadToS3OutsideTransaction(attachment, contentStream, contentLength);
        if (uploaded) {
            registerRollbackHook(attachment);
        }
        return uploaded;
    }

    public void populateBinary(AttachmentModel attachment) {
        if (attachment == null) {
            return;
        }
        if (attachment.getContentBytes() != null) {
            return;
        }
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            writeBinaryTo(attachment, out);
            attachment.setContentBytes(out.toByteArray());
        } catch (AttachmentStorageException ex) {
            throw ex;
        } catch (IOException ex) {
            throw new AttachmentStorageException("Failed to materialize attachment binary in memory", ex);
        } catch (Exception ex) {
            throw new AttachmentStorageException("Failed to materialize attachment binary in memory", ex);
        }
    }

    public void writeBinaryTo(AttachmentModel attachment, OutputStream output) throws IOException {
        if (attachment == null) {
            return;
        }
        Objects.requireNonNull(output, "output");

        if (attachment.getContentBytes() != null) {
            output.write(attachment.getContentBytes());
            return;
        }
        if (!hasText(attachment.getUri()) && !hasText(attachment.getStorageBucket())) {
            throw new AttachmentStorageException("Attachment " + attachment.getId()
                    + " has neither inline bytes nor external uri");
        }
        if (!settings.getMode().isS3()) {
            throw new AttachmentStorageException("Attachment " + attachment.getId()
                    + " requires external storage, but S3 mode is disabled");
        }
        ObjectStorageLocation location = resolveLocation(attachment).orElse(null);
        if (location == null) {
            throw new AttachmentStorageException("Attachment " + attachment.getId()
                    + " cannot resolve object location from uri=" + attachment.getUri());
        }

        try (InputStream stream = objectStorageClient.getObject(new ObjectStorageGetRequest(location))) {
            copy(stream, output);
        } catch (AttachmentStorageException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AttachmentStorageException("Failed to stream attachment " + location.key(), ex);
        }
    }

    public long resolveContentLength(AttachmentModel attachment) {
        if (attachment == null) {
            return -1L;
        }
        byte[] inline = attachment.getContentBytes();
        if (inline != null) {
            return inline.length;
        }
        return attachment.getContentSize() > 0 ? attachment.getContentSize() : -1L;
    }

    public void deleteExternalAsset(AttachmentModel attachment) {
        if (attachment == null) {
            return;
        }
        if (!isExternalAssetDeletionAllowed(attachment)) {
            return;
        }
        requireS3Mode();
        resolveLocation(attachment).ifPresent(location -> {
            try {
                objectStorageClient.deleteObject(new ObjectStorageDeleteRequest(location));
            } catch (Exception ex) {
                LOGGER.warn("Failed to delete object {} for attachment {}: {}",
                        location.toUri(), attachment.getId(), ex.getMessage());
            }
        });
    }

    public void scheduleDeleteExternalAssetAfterCommit(AttachmentModel attachment) {
        if (attachment == null || (!hasText(attachment.getUri()) && !hasText(attachment.getStorageBucket()))) {
            return;
        }
        if (!isExternalAssetDeletionAllowed(attachment)) {
            return;
        }
        requireS3Mode();
        AttachmentStorageManager invoker = selfReference != null && !selfReference.isUnsatisfied()
                ? selfReference.get()
                : this;
        if (registry == null) {
            invoker.deleteExternalAssetOutsideTransaction(attachment);
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
                        invoker.deleteExternalAssetOutsideTransaction(attachment);
                    }
                }
            });
            return;
        }
        invoker.deleteExternalAssetOutsideTransaction(attachment);
    }

    @Transactional(Transactional.TxType.NOT_SUPPORTED)
    public void deleteExternalAssetOutsideTransaction(AttachmentModel attachment) {
        deleteExternalAsset(attachment);
    }

    private void requireS3Mode() {
        if (settings == null || !settings.getMode().isS3()) {
            throw new AttachmentStorageException("Unsupported attachment storage mode: "
                    + (settings != null ? settings.getMode() : "null"));
        }
    }

    private boolean uploadToS3(AttachmentModel attachment) {
        if (attachment == null) {
            return false;
        }
        byte[] bytes = attachment.getContentBytes();
        if (isAlreadyExternalized(attachment, bytes)) {
            LOGGER.debug("Attachment {} is already externalized (uri={}, digest={}); skipping upload.",
                    attachment.getId(), attachment.getUri(), attachment.getDigest());
            return false;
        }
        if (bytes == null) {
            LOGGER.debug("Attachment {} has no binary payload; skip upload", attachment.getId());
            return false;
        }
        ensureDigest(attachment, bytes);
        return uploadStreamToS3(attachment, new ByteArrayInputStream(bytes), bytes.length, true);
    }

    private boolean uploadToS3(AttachmentModel attachment, InputStream contentStream, long contentLength) {
        if (attachment == null) {
            return false;
        }
        if (isAlreadyExternalized(attachment, attachment.getContentBytes())) {
            LOGGER.debug("Attachment {} is already externalized (uri={}, digest={}); skipping upload.",
                    attachment.getId(), attachment.getUri(), attachment.getDigest());
            return false;
        }
        if (contentStream == null || contentLength < 0L) {
            LOGGER.debug("Attachment {} has no stream payload or invalid contentLength={}; skip upload",
                    attachment.getId(), contentLength);
            return false;
        }
        return uploadStreamToS3(attachment, contentStream, contentLength, true);
    }

    private boolean uploadStreamToS3(AttachmentModel attachment,
                                     InputStream stream,
                                     long contentLength,
                                     boolean clearInlineBytesOnSuccess) {
        if (attachment == null || stream == null) {
            return false;
        }
        AttachmentStorageSettings.S3Settings s3Settings = settings.getS3()
                .orElseThrow(() -> new AttachmentStorageException("S3 settings missing"));
        String key = keyResolver.resolve(attachment);
        ObjectStorageLocation target = ObjectStorageLocation.s3(s3Settings.getBucket(), key);
        MessageDigest digest = ObjectStorageDigestSupport.newSha256Digest();
        try (DigestInputStream digestInput = new DigestInputStream(new BufferedInputStream(stream), digest)) {
            ObjectStoragePutResult result = objectStorageClient.putObject(new ObjectStoragePutRequest(
                    target,
                    digestInput,
                    contentLength,
                    attachment.getContentType()));
            attachment.setUri(result.location().toUri());
            ensureDigest(attachment, digest);
            applyStoredObjectMetadata(attachment, result.location());
            if (clearInlineBytesOnSuccess) {
                attachment.setContentBytes(null);
            }
            return true;
        } catch (Exception ex) {
            throw new AttachmentStorageException("Failed to upload attachment to object storage: " + key, ex);
        }
    }

    private void applyStoredObjectMetadata(AttachmentModel attachment, ObjectStorageLocation location) {
        attachment.setStorageProvider(location.provider());
        attachment.setStorageBucket(location.bucket());
        attachment.setStorageKey(location.key());
        attachment.setStorageVersionId(location.versionId());
        attachment.setStorageEtag(location.eTag());
    }

    private boolean isAlreadyExternalized(AttachmentModel attachment, byte[] bytes) {
        if (!hasText(attachment.getUri())) {
            return false;
        }
        if (!hasText(attachment.getDigest())) {
            return bytes == null;
        }
        return true;
    }

    private boolean isExternalAssetDeletionAllowed(AttachmentModel attachment) {
        return attachment == null || !LINK_RELATION_REFERENCE_ONLY.equals(attachment.getLinkRelation());
    }

    private void ensureDigest(AttachmentModel attachment, byte[] bytes) {
        if (attachment == null || hasText(attachment.getDigest()) || bytes == null) {
            return;
        }
        attachment.setDigest(ObjectStorageDigestSupport.sha256Hex(bytes));
    }

    private void ensureDigest(AttachmentModel attachment, MessageDigest digest) {
        if (attachment == null || hasText(attachment.getDigest()) || digest == null) {
            return;
        }
        attachment.setDigest(ObjectStorageDigestSupport.sha256Hex(digest));
    }

    private void registerRollbackHook(AttachmentModel attachment) {
        if (registry == null) {
            LOGGER.warn("TransactionSynchronizationRegistry is not available. Rollback for object upload {} cannot be guaranteed.",
                    attachment.getUri());
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
                        LOGGER.info("Transaction rolled back. Deleting object: {}", attachment.getUri());
                        deleteExternalAsset(attachment);
                    }
                }
            });
        } catch (Exception e) {
            LOGGER.warn("Failed to register synchronization for attachment {}: {}", attachment.getId(), e.getMessage());
        }
    }

    private Optional<ObjectStorageLocation> resolveLocation(AttachmentModel attachment) {
        if (attachment == null) {
            return Optional.empty();
        }
        if (hasText(attachment.getStorageBucket()) && hasText(attachment.getStorageKey())) {
            return Optional.of(new ObjectStorageLocation(
                    hasText(attachment.getStorageProvider()) ? attachment.getStorageProvider() : STORAGE_PROVIDER_S3,
                    attachment.getStorageBucket(),
                    attachment.getStorageKey(),
                    attachment.getStorageVersionId(),
                    attachment.getStorageEtag()));
        }
        AttachmentStorageSettings.S3Settings s3Settings = settings.getS3().orElse(null);
        if (s3Settings == null) {
            return Optional.empty();
        }
        String uri = attachment.getUri();
        if (!hasText(uri)) {
            return Optional.of(ObjectStorageLocation.s3(s3Settings.getBucket(), keyResolver.resolve(attachment)));
        }
        if (uri.startsWith("s3://")) {
            String withoutScheme = uri.substring("s3://".length());
            int slashIndex = withoutScheme.indexOf('/');
            if (slashIndex <= 0 || slashIndex + 1 >= withoutScheme.length()) {
                return Optional.empty();
            }
            String bucket = withoutScheme.substring(0, slashIndex);
            String key = withoutScheme.substring(slashIndex + 1);
            return Optional.of(ObjectStorageLocation.s3(bucket, key));
        }
        return Optional.of(ObjectStorageLocation.s3(s3Settings.getBucket(), uri));
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static void copy(InputStream input, OutputStream output) throws IOException {
        byte[] buffer = new byte[STREAM_BUFFER_SIZE];
        int read;
        while ((read = input.read(buffer)) >= 0) {
            if (read == 0) {
                continue;
            }
            output.write(buffer, 0, read);
        }
    }
}
