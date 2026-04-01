package open.dolphin.storage.objectstore;

import java.util.Objects;

public record ObjectStorageGetRequest(ObjectStorageLocation location) {
    public ObjectStorageGetRequest {
        Objects.requireNonNull(location, "location");
    }
}
