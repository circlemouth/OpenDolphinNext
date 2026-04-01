package open.dolphin.storage.objectstore;

import java.util.Objects;

public record ObjectStoragePutResult(ObjectStorageLocation location) {
    public ObjectStoragePutResult {
        Objects.requireNonNull(location, "location");
    }
}
