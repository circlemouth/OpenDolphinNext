package open.dolphin.storage.objectstore;

import java.io.InputStream;
import java.net.URI;
import java.util.Objects;
import java.util.Optional;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;

public final class S3CompatibleObjectStorageClient implements ObjectStorageClient {

    public record Config(
            String region,
            URI endpoint,
            boolean forcePathStyle,
            String serverSideEncryption,
            String kmsKeyId,
            String accessKey,
            String secretKey) {
        public Config {
            if (region == null || region.isBlank()) {
                throw new IllegalArgumentException("region is required");
            }
            if (accessKey == null || accessKey.isBlank()) {
                throw new IllegalArgumentException("accessKey is required");
            }
            if (secretKey == null || secretKey.isBlank()) {
                throw new IllegalArgumentException("secretKey is required");
            }
        }
    }

    private final S3Client delegate;
    private final String serverSideEncryption;
    private final String kmsKeyId;

    public S3CompatibleObjectStorageClient(Config config) {
        Objects.requireNonNull(config, "config");
        this.delegate = createClient(config);
        this.serverSideEncryption = trimToNull(config.serverSideEncryption());
        this.kmsKeyId = trimToNull(config.kmsKeyId());
    }

    S3CompatibleObjectStorageClient(S3Client delegate, String serverSideEncryption, String kmsKeyId) {
        this.delegate = Objects.requireNonNull(delegate, "delegate");
        this.serverSideEncryption = trimToNull(serverSideEncryption);
        this.kmsKeyId = trimToNull(kmsKeyId);
    }

    @Override
    public ObjectStoragePutResult putObject(ObjectStoragePutRequest request) {
        Objects.requireNonNull(request, "request");
        ObjectStorageLocation location = request.location();
        PutObjectRequest.Builder builder = PutObjectRequest.builder()
                .bucket(location.bucket())
                .key(location.key())
                .contentLength(request.contentLength());
        if (request.contentType() != null && !request.contentType().isBlank()) {
            builder.contentType(request.contentType());
        }
        applyServerSideEncryption(builder);
        PutObjectResponse response = delegate.putObject(
                builder.build(),
                RequestBody.fromInputStream(request.contentStream(), request.contentLength()));
        String versionId = response != null ? trimToNull(response.versionId()) : null;
        String eTag = response != null ? trimToNull(response.eTag()) : null;
        return new ObjectStoragePutResult(location.withVersionAndEtag(versionId, eTag));
    }

    @Override
    public InputStream getObject(ObjectStorageGetRequest request) {
        Objects.requireNonNull(request, "request");
        ObjectStorageLocation location = request.location();
        GetObjectRequest getRequest = GetObjectRequest.builder()
                .bucket(location.bucket())
                .key(location.key())
                .build();
        return delegate.getObject(getRequest);
    }

    @Override
    public void deleteObject(ObjectStorageDeleteRequest request) {
        Objects.requireNonNull(request, "request");
        ObjectStorageLocation location = request.location();
        DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                .bucket(location.bucket())
                .key(location.key())
                .build();
        delegate.deleteObject(deleteRequest);
    }

    @Override
    public boolean isBucketReachable(String bucket) {
        if (bucket == null || bucket.isBlank()) {
            return false;
        }
        try {
            delegate.headBucket(HeadBucketRequest.builder().bucket(bucket.trim()).build());
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    @Override
    public void close() {
        delegate.close();
    }

    private void applyServerSideEncryption(PutObjectRequest.Builder builder) {
        if (serverSideEncryption == null) {
            return;
        }
        if ("AES256".equalsIgnoreCase(serverSideEncryption)) {
            builder.serverSideEncryption(ServerSideEncryption.AES256);
            return;
        }
        if ("AWS:KMS".equalsIgnoreCase(serverSideEncryption) || "KMS".equalsIgnoreCase(serverSideEncryption)) {
            builder.serverSideEncryption(ServerSideEncryption.AWS_KMS);
            Optional.ofNullable(kmsKeyId).ifPresent(builder::ssekmsKeyId);
        }
    }

    private static S3Client createClient(Config config) {
        S3ClientBuilder builder = S3Client.builder()
                .region(Region.of(config.region().trim()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(config.accessKey().trim(), config.secretKey().trim())))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(config.forcePathStyle())
                        .build());
        Optional.ofNullable(config.endpoint()).ifPresent(builder::endpointOverride);
        return builder.build();
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
