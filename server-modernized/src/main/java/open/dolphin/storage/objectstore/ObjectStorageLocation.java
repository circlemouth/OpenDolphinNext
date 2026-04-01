package open.dolphin.storage.objectstore;

import java.util.Objects;

public record ObjectStorageLocation(
        String provider,
        String bucket,
        String key,
        String versionId,
        String eTag) {

    public ObjectStorageLocation {
        provider = requireText(provider, "provider");
        bucket = requireText(bucket, "bucket");
        key = requireText(key, "key");
    }

    public static ObjectStorageLocation s3(String bucket, String key) {
        return new ObjectStorageLocation("s3", bucket, key, null, null);
    }

    public ObjectStorageLocation withVersionAndEtag(String resolvedVersionId, String resolvedEtag) {
        return new ObjectStorageLocation(provider, bucket, key, resolvedVersionId, resolvedEtag);
    }

    public String toUri() {
        if ("s3".equalsIgnoreCase(provider)) {
            return "s3://" + bucket + "/" + key;
        }
        return provider + "://" + bucket + "/" + key;
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return value.trim();
    }
}
