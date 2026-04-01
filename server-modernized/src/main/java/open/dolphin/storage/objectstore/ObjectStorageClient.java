package open.dolphin.storage.objectstore;

import java.io.InputStream;

public interface ObjectStorageClient extends AutoCloseable {

    ObjectStoragePutResult putObject(ObjectStoragePutRequest request);

    InputStream getObject(ObjectStorageGetRequest request);

    void deleteObject(ObjectStorageDeleteRequest request);

    boolean isBucketReachable(String bucket);

    @Override
    void close();
}
