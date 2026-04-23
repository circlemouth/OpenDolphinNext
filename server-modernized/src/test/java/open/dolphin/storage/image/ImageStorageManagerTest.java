package open.dolphin.storage.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Field;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import jakarta.transaction.Status;
import jakarta.transaction.Synchronization;
import jakarta.transaction.TransactionSynchronizationRegistry;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.ExtRefModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.storage.attachment.AttachmentStorageMode;
import open.dolphin.storage.attachment.AttachmentStorageSettings;
import open.dolphin.storage.objectstore.ObjectStorageClient;
import open.dolphin.storage.objectstore.ObjectStorageLocation;
import open.dolphin.storage.objectstore.ObjectStoragePutResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ImageStorageManagerTest {

    private ImageStorageManager manager;
    private ObjectStorageClient objectStorageClient;

    @BeforeEach
    void setUp() throws Exception {
        manager = new ImageStorageManager();
        objectStorageClient = mock(ObjectStorageClient.class);

        AttachmentStorageSettings.S3Settings s3Settings = new AttachmentStorageSettings.S3Settings(
                "test-bucket",
                "ap-northeast-1",
                URI.create("https://example.invalid"),
                "attachments",
                true,
                null,
                null,
                5,
                "access",
                "secret");
        AttachmentStorageSettings settings = new AttachmentStorageSettings(
                AttachmentStorageMode.S3,
                new AttachmentStorageSettings.DatabaseSettings(null),
                s3Settings,
                null);

        setField(manager, "settings", settings);
        setField(manager, "objectStorageClient", objectStorageClient);
    }

    @Test
    void uploadToObjectStoreOutsideTransaction_setsObjectMetadata() {
        SchemaModel schema = buildSchema("image/png", "payload".getBytes(StandardCharsets.UTF_8));
        ObjectStorageLocation location = new ObjectStorageLocation(
                "s3", "test-bucket", "images/doc-20/img-10.png", "v1", "etag-image");
        when(objectStorageClient.putObject(any())).thenReturn(new ObjectStoragePutResult(location));

        boolean uploaded = manager.uploadToObjectStoreOutsideTransaction(schema);

        assertThat(uploaded).isTrue();
        assertThat(schema.getUri()).isEqualTo("s3://test-bucket/images/doc-20/img-10.png");
        assertThat(schema.getDigest()).isEqualTo(sha256Hex("payload".getBytes(StandardCharsets.UTF_8)));
        assertThat(schema.getStorageProvider()).isEqualTo("s3");
        assertThat(schema.getStorageBucket()).isEqualTo("test-bucket");
        assertThat(schema.getStorageKey()).isEqualTo("images/doc-20/img-10.png");
        assertThat(schema.getStorageVersionId()).isEqualTo("v1");
        assertThat(schema.getStorageEtag()).isEqualTo("etag-image");
        assertThat(schema.getImageBytes()).isNull();
    }

    @Test
    void populateBinary_usesStoredLocationMetadata() {
        byte[] payload = "image-download".getBytes(StandardCharsets.UTF_8);
        SchemaModel schema = buildSchema("image/png", null);
        schema.setStorageBucket("test-bucket");
        schema.setStorageKey("images/doc-20/img-10.png");
        when(objectStorageClient.getObject(any())).thenReturn(new ByteArrayInputStream(payload));

        manager.populateBinary(schema);

        assertThat(schema.getImageBytes()).containsExactly(payload);
        verify(objectStorageClient).getObject(any());
    }

    @Test
    void uploadToObjectStoreOutsideTransaction_isIdempotentForExistingExternalImage() {
        SchemaModel schema = buildSchema("image/png", null);
        schema.setUri("s3://test-bucket/images/doc-20/img-10.png");
        schema.setDigest("digest");

        boolean uploaded = manager.uploadToObjectStoreOutsideTransaction(schema);

        assertThat(uploaded).isFalse();
        verify(objectStorageClient, never()).putObject(any());
    }

    @Test
    void disabledModeFailsClosedForExternalImages() throws Exception {
        setField(manager, "settings", new AttachmentStorageSettings(
                AttachmentStorageMode.DISABLED,
                null,
                null,
                null));
        setField(manager, "objectStorageClient", null);
        SchemaModel schema = buildSchema("image/png", "payload".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> manager.persistExternalAssets(List.of(schema)))
                .isInstanceOf(open.dolphin.storage.attachment.AttachmentStorageException.class)
                .hasMessageContaining("disabled");
        assertThatThrownBy(() -> manager.populateBinary(externalSchema()))
                .isInstanceOf(open.dolphin.storage.attachment.AttachmentStorageException.class)
                .hasMessageContaining("disabled");
    }

    @Test
    void scheduleDeleteExternalAssetAfterCommit_waitsForCommit() throws Exception {
        TransactionSynchronizationRegistry registry = mock(TransactionSynchronizationRegistry.class);
        when(registry.getTransactionStatus()).thenReturn(Status.STATUS_ACTIVE);
        setField(manager, "registry", registry);
        SchemaModel schema = buildSchema("image/png", null);
        schema.setStorageBucket("test-bucket");
        schema.setStorageKey("images/doc-20/img-10.png");

        manager.scheduleDeleteExternalAssetAfterCommit(schema);

        ArgumentCaptor<Synchronization> captor = ArgumentCaptor.forClass(Synchronization.class);
        verify(registry).registerInterposedSynchronization(captor.capture());
        verify(objectStorageClient, never()).deleteObject(any());

        captor.getValue().afterCompletion(Status.STATUS_COMMITTED);
        verify(objectStorageClient).deleteObject(any());
    }

    private static SchemaModel buildSchema(String contentType, byte[] imageBytes) {
        SchemaModel schema = new SchemaModel();
        schema.setId(10L);
        schema.setImageBytes(imageBytes);

        DocumentModel document = new DocumentModel();
        document.setId(20L);
        schema.setDocumentModel(document);
        KarteBean karte = new KarteBean();
        karte.setId(30L);
        schema.setKarteBean(karte);

        ExtRefModel extRef = new ExtRefModel();
        extRef.setContentType(contentType);
        extRef.setTitle("schema");
        extRef.setHref("schema.png");
        schema.setExtRefModel(extRef);
        return schema;
    }

    private static SchemaModel externalSchema() {
        SchemaModel schema = buildSchema("image/png", null);
        schema.setStorageBucket("test-bucket");
        schema.setStorageKey("images/doc-20/img-10.png");
        return schema;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static String sha256Hex(byte[] value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
