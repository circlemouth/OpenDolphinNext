package open.dolphin.storage.attachment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;

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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.AbortableInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

class AttachmentStorageManagerTest {

    private AttachmentStorageManager manager;
    private S3Client s3Client;

    @BeforeEach
    void setUp() throws Exception {
        manager = new AttachmentStorageManager();
        s3Client = mock(S3Client.class);

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
        setField(manager, "s3Client", s3Client);
    }

    @Test
    void uploadToS3OutsideTransaction_setsUriDigestAndClearsBytes() {
        AttachmentModel attachment = buildAttachment("report.txt", "payload".getBytes(StandardCharsets.UTF_8));

        boolean uploaded = manager.uploadToS3OutsideTransaction(attachment);

        assertThat(uploaded).isTrue();
        assertThat(attachment.getUri()).isEqualTo("s3://test-bucket/attachments/doc-20/att-10-report.txt");
        assertThat(attachment.getDigest()).isEqualTo(sha256Hex("payload".getBytes(StandardCharsets.UTF_8)));
        assertThat(attachment.getContentBytes()).isNull();
        verify(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }

    @Test
    void uploadToS3OutsideTransaction_handlesPdfPayload() {
        byte[] pdfBytes = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"
                .getBytes(StandardCharsets.UTF_8);
        AttachmentModel attachment = buildAttachment("report.pdf", "application/pdf", pdfBytes);

        boolean uploaded = manager.uploadToS3OutsideTransaction(attachment);

        assertThat(uploaded).isTrue();
        assertThat(attachment.getUri()).isEqualTo("s3://test-bucket/attachments/doc-20/att-10-report.pdf");
        assertThat(attachment.getDigest()).isEqualTo(sha256Hex(pdfBytes));
        assertThat(attachment.getContentBytes()).isNull();
        verify(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }

    @Test
    void uploadToS3OutsideTransaction_isIdempotentWithoutTransientLocation() {
        AttachmentModel attachment = buildAttachment("report.txt", null);
        attachment.setUri("s3://test-bucket/attachments/doc-20/att-10-report.txt");
        attachment.setDigest(sha256Hex("payload".getBytes(StandardCharsets.UTF_8)));

        boolean uploaded = manager.uploadToS3OutsideTransaction(attachment);

        assertThat(uploaded).isFalse();
        verify(s3Client, never()).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }

    @Test
    void populateBinary_downloadsFromUriWhenBytesAreExternalized() {
        byte[] payload = "from-s3".getBytes(StandardCharsets.UTF_8);
        AttachmentModel attachment = buildAttachment("report.txt", null);
        attachment.setUri("s3://test-bucket/attachments/doc-20/att-10-report.txt");
        when(s3Client.getObject(any(GetObjectRequest.class))).thenReturn(new ResponseInputStream<>(
                GetObjectResponse.builder().build(),
                AbortableInputStream.create(new ByteArrayInputStream(payload))));

        manager.populateBinary(attachment);

        assertThat(attachment.getContentBytes()).containsExactly(payload);
        verify(s3Client).getObject(any(GetObjectRequest.class));
    }

    @Test
    void writeBinaryTo_streamsFromS3WithoutMaterializingContentBytes() throws Exception {
        byte[] payload = "stream-from-s3".getBytes(StandardCharsets.UTF_8);
        AttachmentModel attachment = buildAttachment("report.txt", null);
        attachment.setUri("s3://test-bucket/attachments/doc-20/att-10-report.txt");
        when(s3Client.getObject(any(GetObjectRequest.class))).thenReturn(new ResponseInputStream<>(
                GetObjectResponse.builder().build(),
                AbortableInputStream.create(new ByteArrayInputStream(payload))));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        manager.writeBinaryTo(attachment, out);

        assertThat(out.toByteArray()).containsExactly(payload);
        assertThat(attachment.getContentBytes()).isNull();
    }

    @Test
    void populateBinary_downloadsPdfBytesWithoutMutation() {
        byte[] payload = "%PDF-1.4\nmock\n".getBytes(StandardCharsets.UTF_8);
        AttachmentModel attachment = buildAttachment("report.pdf", "application/pdf", null);
        attachment.setUri("s3://test-bucket/attachments/doc-20/att-10-report.pdf");
        when(s3Client.getObject(any(GetObjectRequest.class))).thenReturn(new ResponseInputStream<>(
                GetObjectResponse.builder().build(),
                AbortableInputStream.create(new ByteArrayInputStream(payload))));

        manager.populateBinary(attachment);

        assertThat(attachment.getContentBytes()).containsExactly(payload);
    }

    @Test
    void populateBinary_rejectsAttachmentWithoutBytesAndUri() {
        AttachmentModel attachment = buildAttachment("report.txt", null);

        assertThatThrownBy(() -> manager.populateBinary(attachment))
                .isInstanceOf(AttachmentStorageException.class)
                .hasMessageContaining("neither inline bytes nor external uri");
    }

    @Test
    void uploadToS3OutsideTransaction_acceptsStreamPayload() {
        byte[] payload = "stream-upload".getBytes(StandardCharsets.UTF_8);
        AttachmentModel attachment = buildAttachment("stream.txt", "text/plain", null);
        doAnswer(invocation -> {
            RequestBody body = invocation.getArgument(1, RequestBody.class);
            try (InputStream in = body.contentStreamProvider().newStream()) {
                while (in.read() != -1) {
                    // consume stream to trigger digest updates
                }
            }
            return null;
        }).when(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));

        boolean uploaded = manager.uploadToS3OutsideTransaction(
                attachment,
                new ByteArrayInputStream(payload),
                payload.length);

        assertThat(uploaded).isTrue();
        assertThat(attachment.getUri()).isEqualTo("s3://test-bucket/attachments/doc-20/att-10-stream.txt");
        assertThat(attachment.getDigest()).isEqualTo(sha256Hex(payload));
        verify(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }

    @Test
    void prepareExternalAssetForPersist_streamsUploadAndRegistersRollbackHook() throws Exception {
        byte[] payload = "persist-stream".getBytes(StandardCharsets.UTF_8);
        AttachmentModel attachment = buildAttachment("stream.txt", "text/plain", null);
        TransactionSynchronizationRegistry registry = mock(TransactionSynchronizationRegistry.class);
        when(registry.getTransactionStatus()).thenReturn(Status.STATUS_ACTIVE);
        setField(manager, "registry", registry);
        doAnswer(invocation -> {
            RequestBody body = invocation.getArgument(1, RequestBody.class);
            try (InputStream in = body.contentStreamProvider().newStream()) {
                while (in.read() != -1) {
                    // consume stream to trigger digest updates
                }
            }
            return null;
        }).when(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));

        boolean uploaded = manager.prepareExternalAssetForPersist(
                attachment,
                new ByteArrayInputStream(payload),
                payload.length);

        assertThat(uploaded).isTrue();
        assertThat(attachment.getUri()).isEqualTo("s3://test-bucket/attachments/doc-20/att-10-stream.txt");
        assertThat(attachment.getDigest()).isEqualTo(sha256Hex(payload));
        assertThat(attachment.getContentBytes()).isNull();
        verify(registry).registerInterposedSynchronization(any(Synchronization.class));
    }

    @Test
    void scheduleDeleteExternalAssetAfterCommit_deletesImmediatelyWhenNoTransaction() throws Exception {
        TransactionSynchronizationRegistry registry = mock(TransactionSynchronizationRegistry.class);
        when(registry.getTransactionStatus()).thenReturn(Status.STATUS_NO_TRANSACTION);
        setField(manager, "registry", registry);

        AttachmentModel attachment = buildAttachment("report.txt", null);
        attachment.setUri("s3://test-bucket/attachments/doc-20/att-10-report.txt");

        manager.scheduleDeleteExternalAssetAfterCommit(attachment);

        verify(s3Client).deleteObject(any(DeleteObjectRequest.class));
        verify(registry, never()).registerInterposedSynchronization(any());
    }

    @Test
    void scheduleDeleteExternalAssetAfterCommit_deletesOnlyAfterCommit() throws Exception {
        TransactionSynchronizationRegistry registry = mock(TransactionSynchronizationRegistry.class);
        when(registry.getTransactionStatus()).thenReturn(Status.STATUS_ACTIVE);
        setField(manager, "registry", registry);

        AttachmentModel attachment = buildAttachment("report.txt", null);
        attachment.setUri("s3://test-bucket/attachments/doc-20/att-10-report.txt");

        manager.scheduleDeleteExternalAssetAfterCommit(attachment);

        ArgumentCaptor<Synchronization> captor = ArgumentCaptor.forClass(Synchronization.class);
        verify(registry).registerInterposedSynchronization(captor.capture());
        verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));

        captor.getValue().afterCompletion(Status.STATUS_ROLLEDBACK);
        verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));

        captor.getValue().afterCompletion(Status.STATUS_COMMITTED);
        verify(s3Client).deleteObject(any(DeleteObjectRequest.class));
    }

    private static AttachmentModel buildAttachment(String fileName, byte[] bytes) {
        return buildAttachment(fileName, "text/plain", bytes);
    }

    private static AttachmentModel buildAttachment(String fileName, String contentType, byte[] bytes) {
        AttachmentModel attachment = new AttachmentModel();
        attachment.setId(10L);
        attachment.setFileName(fileName);
        attachment.setContentType(contentType);
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
