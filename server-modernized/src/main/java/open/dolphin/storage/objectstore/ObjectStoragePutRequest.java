package open.dolphin.storage.objectstore;

import java.io.InputStream;
import java.util.Objects;

public record ObjectStoragePutRequest(
        ObjectStorageLocation location,
        InputStream contentStream,
        long contentLength,
        String contentType) {

    public ObjectStoragePutRequest {
        Objects.requireNonNull(location, "location");
        Objects.requireNonNull(contentStream, "contentStream");
        if (contentLength < 0L) {
            throw new IllegalArgumentException("contentLength must be >= 0");
        }
    }
}
