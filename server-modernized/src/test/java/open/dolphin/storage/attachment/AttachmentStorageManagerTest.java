package open.dolphin.storage.attachment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import jakarta.transaction.Status;
import jakarta.transaction.Synchronization;
import jakarta.transaction.TransactionSynchronizationRegistry;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.storage.objectstore.ObjectStorageClient;
import open.dolphin.storage.objectstore.ObjectStorageLocation;
import open.dolphin.storage.objectstore.ObjectStoragePutResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class AttachmentStorageManagerTest {

    private AttachmentStorageManager manager;
    private ObjectStorageClient objectStorageClient;

    @BeforeEach
    void setUp() throws Exception {
        manager = new AttachmentStorageManager();
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
        setField(manager, "keyResolver", new AttachmentKeyResolver(s3Settings));
        setField(manager, "objectStorageClient", objectStorageClient);
    }

    @Test
    void uploadToS3OutsideTransaction_setsResolvedLocationAndMetadata() {
        AttachmentModel attachment = buildAttachment("report.txt", "payload".getBytes(StandardCharsets.UTF_8));
        ObjectStorageLocation location = new ObjectStorageLocation(
                "s3", "test-bucket", "attachments/doc-20/att-10-report.txt", "v1", "etag-1");
        when(objectStorageClient.putObject(any())).thenReturn(new ObjectStoragePutResult(location));

        boolean uploaded = manager.uploadToS3OutsideTransaction(attachment);

        assertThat(uploaded).isTrue();
        assertThat(attachment.getUri()).isEqualTo("s3://test-bucket/attachments/doc-20/att-10-report.txt");
        assertThat(attachment.getDigest()).isEqualTo(sha256Hex("payload".getBytes(StandardCharsets.UTF_8)));
        assertThat(attachment.getStorageProvider()).isEqualTo("s3");
        assertThat(attachment.getStorageBucket()).isEqualTo("test-bucket");
        assertThat(attachment.getStorageKey()).isEqualTo("attachments/doc-20/att-10-report.txt");
        assertThat(attachment.getStorageVersionId()).isEqualTo("v1");
        assertThat(attachment.getStorageEtag()).isEqualTo("etag-1");
        assertThat(attachment.getContentBytes()).isNull();
        verify(objectStorageClient).putObject(any());
    }

    @Test
    void uploadToS3OutsideTransaction_isIdempotentWhenUriAndDigestAlreadyExist() {
        AttachmentModel attachment = buildAttachment("report.txt", null);
        attachment.setUri("s3://test-bucket/attachments/doc-20/att-10-report.txt");
        attachment.setDigest(sha256Hex("payload".getBytes(StandardCharsets.UTF_8)));

        boolean uploaded = manager.uploadToS3OutsideTransaction(attachment);

        assertThat(uploaded).isFalse();
        verify(objectStorageClient, never()).putObject(any());
    }

    @Test
    void populateBinary_downloadsFromObjectStorageWhenInlineBytesAreMissing() {
        byte[] payload = "from-s3".getBytes(StandardCharsets.UTF_8);
        AttachmentModel attachment = buildAttachment("report.txt", null);
        attachment.setStorageBucket("test-bucket");
        attachment.setStorageKey("attachments/doc-20/att-10-report.txt");
        when(objectStorageClient.getObject(any())).thenReturn(new ByteArrayInputStream(payload));

        manager.populateBinary(attachment);

        assertThat(attachment.getContentBytes()).containsExactly(payload);
        verify(objectStorageClient).getObject(any());
    }

    @Test
    void writeBinaryTo_streamsExternalBytesWithoutMaterializingAttachment() throws Exception {
        byte[] payload = "stream-from-s3".getBytes(StandardCharsets.UTF_8);
        AttachmentModel attachment = buildAttachment("report.txt", null);
        attachment.setStorageBucket("test-bucket");
        attachment.setStorageKey("attachments/doc-20/att-10-report.txt");
        when(objectStorageClient.getObject(any())).thenReturn(new ByteArrayInputStream(payload));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        manager.writeBinaryTo(attachment, out);

        assertThat(out.toByteArray()).containsExactly(payload);
        assertThat(attachment.getContentBytes()).isNull();
    }

    @Test
    void populateBinary_rejectsAttachmentWithoutInlineOrExternalLocation() {
        AttachmentModel attachment = buildAttachment("report.txt", null);

        assertThatThrownBy(() -> manager.populateBinary(attachment))
                .isInstanceOf(AttachmentStorageException.class)
                .hasMessageContaining("neither inline bytes nor external uri");
    }

    @Test
    void isBackendReachable_usesObjectStorageBucketProbe() {
        when(objectStorageClient.isBucketReachable("test-bucket")).thenReturn(true);

        assertThat(manager.isBackendReachable()).isTrue();
    }

    @Test
    void prepareExternalAssetForPersist_registersRollbackHook() throws Exception {
        byte[] payload = "persist-stream".getBytes(StandardCharsets.UTF_8);
        AttachmentModel attachment = buildAttachment("stream.txt", null);
        ObjectStorageLocation location = new ObjectStorageLocation(
                "s3", "test-bucket", "attachments/doc-20/att-10-stream.txt", "v9", "etag-9");
        TransactionSynchronizationRegistry registry = mock(TransactionSynchronizationRegistry.class);
        when(registry.getTransactionStatus()).thenReturn(Status.STATUS_ACTIVE);
        doAnswer(invocation -> {
            open.dolphin.storage.objectstore.ObjectStoragePutRequest request =
                    invocation.getArgument(0, open.dolphin.storage.objectstore.ObjectStoragePutRequest.class);
            try (InputStream in = request.contentStream()) {
                while (in.read() != -1) {
                    // consume stream so DigestInputStream updates the digest
                }
            }
            return new ObjectStoragePutResult(location);
        }).when(objectStorageClient).putObject(any());
        setField(manager, "registry", registry);

        boolean uploaded = manager.prepareExternalAssetForPersist(
                attachment,
                new ByteArrayInputStream(payload),
                payload.length);

        assertThat(uploaded).isTrue();
        assertThat(attachment.getDigest()).isEqualTo(sha256Hex(payload));
        verify(registry).registerInterposedSynchronization(any(Synchronization.class));
    }

    @Test
    void scheduleDeleteExternalAssetAfterCommit_deletesImmediatelyWithoutTransaction() throws Exception {
        TransactionSynchronizationRegistry registry = mock(TransactionSynchronizationRegistry.class);
        when(registry.getTransactionStatus()).thenReturn(Status.STATUS_NO_TRANSACTION);
        setField(manager, "registry", registry);
        AttachmentModel attachment = buildAttachment("report.txt", null);
        attachment.setStorageBucket("test-bucket");
        attachment.setStorageKey("attachments/doc-20/att-10-report.txt");

        manager.scheduleDeleteExternalAssetAfterCommit(attachment);

        verify(objectStorageClient).deleteObject(any());
        verify(registry, never()).registerInterposedSynchronization(any());
    }

    @Test
    void scheduleDeleteExternalAssetAfterCommit_waitsForCommit() throws Exception {
        TransactionSynchronizationRegistry registry = mock(TransactionSynchronizationRegistry.class);
        when(registry.getTransactionStatus()).thenReturn(Status.STATUS_ACTIVE);
        setField(manager, "registry", registry);
        AttachmentModel attachment = buildAttachment("report.txt", null);
        attachment.setStorageBucket("test-bucket");
        attachment.setStorageKey("attachments/doc-20/att-10-report.txt");

        manager.scheduleDeleteExternalAssetAfterCommit(attachment);

        ArgumentCaptor<Synchronization> captor = ArgumentCaptor.forClass(Synchronization.class);
        verify(registry).registerInterposedSynchronization(captor.capture());
        verify(objectStorageClient, never()).deleteObject(any());

        captor.getValue().afterCompletion(Status.STATUS_ROLLEDBACK);
        verify(objectStorageClient, never()).deleteObject(any());

        captor.getValue().afterCompletion(Status.STATUS_COMMITTED);
        verify(objectStorageClient).deleteObject(any());
    }

    private static AttachmentModel buildAttachment(String fileName, byte[] bytes) {
        AttachmentModel attachment = new AttachmentModel();
        attachment.setId(10L);
        attachment.setFileName(fileName);
        attachment.setContentType("text/plain");
        attachment.setContentBytes(bytes);

        DocumentModel document = new DocumentModel();
        document.setId(20L);
        KarteBean karte = new KarteBean();
        karte.setId(30L);
        PatientModel patient = new PatientModel();
        patient.setFacilityId("F001");
        patient.setPatientId("P001");
        karte.setPatientModel(patient);
        document.setKarteBean(karte);
        attachment.setDocumentModel(document);
        return attachment;
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
