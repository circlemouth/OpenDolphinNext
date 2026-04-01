package open.dolphin.storage.objectstore;

import java.util.Objects;

public record ObjectStorageDeleteRequest(ObjectStorageLocation location) {
    public ObjectStorageDeleteRequest {
        Objects.requireNonNull(location, "location");
    }
}
