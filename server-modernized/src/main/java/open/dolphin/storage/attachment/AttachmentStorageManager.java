package open.dolphin.storage.attachment;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collection;
import java.util.HexFormat;
import java.util.Objects;
import java.util.Optional;
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
import open.dolphin.infomodel.AttachmentModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;
import software.amazon.awssdk.core.sync.RequestBody;

/**
 * 添付ファイルの保存先を制御するマネージャー。
 */
@ApplicationScoped
public class AttachmentStorageManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(AttachmentStorageManager.class);
    private static final int STREAM_BUFFER_SIZE = 8192;

    @Inject
    AttachmentStorageConfigLoader configLoader;

    @Inject
    Instance<AttachmentStorageManager> selfReference;

    @Resource
    private TransactionSynchronizationRegistry registry;

    private AttachmentStorageSettings settings;
    private AttachmentKeyResolver keyResolver;
    private S3Client s3Client;

    @PostConstruct
    void init() {
        settings = configLoader.load();
        if (settings.getMode().isS3()) {
            AttachmentStorageSettings.S3Settings s3Settings = settings.getS3()
                    .orElseThrow(() -> new AttachmentStorageException("S3 settings are missing"));
            keyResolver = new AttachmentKeyResolver(s3Settings);
            s3Client = createClient(s3Settings);
            LOGGER.info("Attachment storage initialized in S3 mode (bucket={}, region={}, config={})",
                    s3Settings.getBucket(), s3Settings.getRegion(), settings.getSourcePath().orElse(null));
        } else {
            LOGGER.info("Attachment storage initialized in database mode (config={})",
                    settings.getSourcePath().orElse(null));
        }
    }

    @PreDestroy
    void shutdown() {
        if (s3Client != null) {
            s3Client.close();
        }
    }

    public AttachmentStorageMode getMode() {
        return settings.getMode();
    }

    public boolean isBackendReachable() {
        if (settings == null) {
            return false;
        }
        if (!settings.getMode().isS3()) {
            return true;
        }
        try {
            AttachmentStorageSettings.S3Settings s3Settings = settings.getS3()
                    .orElseThrow(() -> new AttachmentStorageException("S3 settings are missing"));
            if (s3Client == null) {
                return false;
            }
            s3Client.headBucket(HeadBucketRequest.builder().bucket(s3Settings.getBucket()).build());
            return true;
        } catch (Exception ex) {
            LOGGER.warn("Attachment storage backend probe failed: {}", ex.getClass().getSimpleName());
            return false;
        }
    }

    public void persistExternalAssets(Collection<AttachmentModel> attachments) {
        if (!settings.getMode().isS3() || attachments == null || attachments.isEmpty()) {
            return;
        }
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
        if (!settings.getMode().isS3() || attachment == null) {
            return false;
        }
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
            byte[] data = out.toByteArray();
            attachment.setContentBytes(data);
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
        if (!hasText(attachment.getUri())) {
            throw new AttachmentStorageException("Attachment " + attachment.getId()
                    + " has neither inline bytes nor external uri");
        }
        if (!settings.getMode().isS3()) {
            throw new AttachmentStorageException("Attachment " + attachment.getId()
                    + " requires external storage, but S3 mode is disabled");
        }
        S3ObjectLocation location = resolveLocation(attachment).orElse(null);
        if (location == null) {
            throw new AttachmentStorageException("Attachment " + attachment.getId()
                    + " cannot resolve S3 object location from uri=" + attachment.getUri());
        }

        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(location.bucket)
                .key(location.key)
                .build();
        try (software.amazon.awssdk.core.ResponseInputStream<GetObjectResponse> response = s3Client.getObject(request)) {
            copy(response, output);
        } catch (AttachmentStorageException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AttachmentStorageException("Failed to stream attachment " + location.key, ex);
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
        if (!settings.getMode().isS3() || attachment == null) {
            return;
        }
        resolveLocation(attachment).ifPresent(location -> {
            try {
                s3Client.deleteObject(DeleteObjectRequest.builder()
                        .bucket(location.bucket)
                        .key(location.key)
                        .build());
            } catch (Exception ex) {
                LOGGER.warn("Failed to delete S3 object {} for attachment {}: {}",
                        location, attachment.getId(), ex.getMessage());
            }
        });
    }

    public void scheduleDeleteExternalAssetAfterCommit(AttachmentModel attachment) {
        if (!settings.getMode().isS3() || attachment == null || !hasText(attachment.getUri())) {
            return;
        }
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
        PutObjectRequest.Builder builder = PutObjectRequest.builder()
                .bucket(s3Settings.getBucket())
                .key(key)
                .contentLength(contentLength);
        if (attachment.getContentType() != null && !attachment.getContentType().isBlank()) {
            builder.contentType(attachment.getContentType());
        }
        s3Settings.getServerSideEncryption()
                .map(String::toUpperCase)
                .ifPresent(mode -> applyServerSideEncryption(builder, mode, s3Settings));

        try (DigestInputStream digestInput = new DigestInputStream(new BufferedInputStream(stream), newSha256Digest())) {
            s3Client.putObject(builder.build(), RequestBody.fromInputStream(digestInput, contentLength));
            String s3Uri = String.format("s3://%s/%s", s3Settings.getBucket(), key);
            attachment.setUri(s3Uri);
            ensureDigest(attachment, digestInput.getMessageDigest());
            if (clearInlineBytesOnSuccess) {
                attachment.setContentBytes(null);
            }
            return true;

        } catch (Exception ex) {
            throw new AttachmentStorageException("Failed to upload attachment to S3: " + key, ex);
        }
    }

    private boolean isAlreadyExternalized(AttachmentModel attachment, byte[] bytes) {
        if (!hasText(attachment.getUri())) {
            return false;
        }
        // 永続済み判定は transient location ではなく uri + digest を基準にする。
        if (!hasText(attachment.getDigest())) {
            return bytes == null;
        }
        return true;
    }

    private void ensureDigest(AttachmentModel attachment, byte[] bytes) {
        if (attachment == null || hasText(attachment.getDigest()) || bytes == null) {
            return;
        }
        attachment.setDigest(sha256Hex(bytes));
    }

    private void ensureDigest(AttachmentModel attachment, MessageDigest digest) {
        if (attachment == null || hasText(attachment.getDigest()) || digest == null) {
            return;
        }
        attachment.setDigest(HexFormat.of().formatHex(digest.digest()));
    }

    private void registerRollbackHook(AttachmentModel attachment) {
        if (registry == null) {
            LOGGER.warn("TransactionSynchronizationRegistry is not available. Rollback for S3 upload {} cannot be guaranteed.", attachment.getUri());
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
                        LOGGER.info("Transaction rolled back. Deleting S3 object: {}", attachment.getUri());
                        deleteExternalAsset(attachment);
                    }
                }
            });
        } catch (Exception e) {
            LOGGER.warn("Failed to register synchronization for attachment {}: {}", attachment.getId(), e.getMessage());
        }
    }

    private void applyServerSideEncryption(PutObjectRequest.Builder builder,
                                           String mode,
                                           AttachmentStorageSettings.S3Settings s3Settings) {
        if ("AES256".equalsIgnoreCase(mode)) {
            builder.serverSideEncryption(ServerSideEncryption.AES256);
        } else if ("aws:kms".equalsIgnoreCase(mode) || "KMS".equalsIgnoreCase(mode)) {
            builder.serverSideEncryption(ServerSideEncryption.AWS_KMS);
            s3Settings.getKmsKeyId().ifPresent(builder::ssekmsKeyId);
        }
    }

    private Optional<S3ObjectLocation> resolveLocation(AttachmentModel attachment) {
        AttachmentStorageSettings.S3Settings s3Settings = settings.getS3()
                .orElse(null);
        if (s3Settings == null) {
            return Optional.empty();
        }
        String uri = attachment.getUri();
        if (uri == null || uri.isBlank()) {
            return Optional.of(new S3ObjectLocation(s3Settings.getBucket(), keyResolver.resolve(attachment)));
        }
        if (uri.startsWith("s3://")) {
            String withoutScheme = uri.substring(5);
            int slashIndex = withoutScheme.indexOf('/');
            if (slashIndex <= 0) {
                return Optional.empty();
            }
            String bucket = withoutScheme.substring(0, slashIndex);
            String key = withoutScheme.substring(slashIndex + 1);
            return Optional.of(new S3ObjectLocation(bucket, key));
        }
        return Optional.of(new S3ObjectLocation(s3Settings.getBucket(), uri));
    }

    private S3Client createClient(AttachmentStorageSettings.S3Settings s3Settings) {
        S3Configuration serviceConfiguration = S3Configuration.builder()
                .pathStyleAccessEnabled(s3Settings.isForcePathStyle())
                .build();

        S3ClientBuilder builder = S3Client.builder()
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(s3Settings.getAccessKey(), s3Settings.getSecretKey())))
                .region(Region.of(s3Settings.getRegion()))
                .serviceConfiguration(serviceConfiguration);

        s3Settings.getEndpoint().ifPresent(builder::endpointOverride);
        return builder.build();
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String sha256Hex(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }

    private MessageDigest newSha256Digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 digest is unavailable", ex);
        }
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

    private static final class S3ObjectLocation {
        private final String bucket;
        private final String key;

        private S3ObjectLocation(String bucket, String key) {
            this.bucket = bucket;
            this.key = key;
        }

        @Override
        public String toString() {
            return String.format("s3://%s/%s", bucket, key);
        }
    }
}
