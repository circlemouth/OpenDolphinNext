package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Date;
import java.util.HexFormat;
import java.util.List;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.PatientImageEntryResponse;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.attachment.AttachmentStorageMode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PatientImageServiceBeanTest {

    @TempDir
    Path tempDir;

    private PatientImageServiceBean service;
    private EntityManager em;
    private PatientServiceBean patientServiceBean;
    private UserServiceBean userServiceBean;
    private KarteServiceBean karteServiceBean;
    private AttachmentStorageManager attachmentStorageManager;

    @BeforeEach
    void setUp() throws Exception {
        service = new PatientImageServiceBean();
        em = mock(EntityManager.class);
        patientServiceBean = mock(PatientServiceBean.class);
        userServiceBean = mock(UserServiceBean.class);
        karteServiceBean = mock(KarteServiceBean.class);
        attachmentStorageManager = mock(AttachmentStorageManager.class);

        setField(service, "em", em);
        setField(service, "patientServiceBean", patientServiceBean);
        setField(service, "userServiceBean", userServiceBean);
        setField(service, "karteServiceBean", karteServiceBean);
        setField(service, "attachmentStorageManager", attachmentStorageManager);
    }

    @Test
    void uploadImage_usesAttachmentIdAssignedDuringSave() throws Exception {
        byte[] payload = new byte[] {1, 2, 3};
        Path payloadPath = writePayload("image.png", payload);
        PatientModel patient = new PatientModel();
        patient.setId(1L);
        patient.setFacilityId("F001");
        patient.setPatientId("P001");

        KarteBean karte = new KarteBean();
        karte.setId(2L);

        UserModel actor = new UserModel();
        actor.setUserId("F001:doctor01");

        when(patientServiceBean.getPatientById("F001", "P001")).thenReturn(patient);
        when(patientServiceBean.ensureKarteByPatientPk(1L)).thenReturn(karte);
        when(userServiceBean.getUser("F001:doctor01")).thenReturn(actor);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.prepareExternalAssetForPersist(any(), any(), eq((long) payload.length)))
                .thenAnswer(invocation -> {
                    AttachmentModel attachment = invocation.getArgument(0);
                    InputStream stream = invocation.getArgument(1);
                    assertThat(stream.readAllBytes()).containsExactly(payload);
                    attachment.setUri("s3://test-bucket/attachments/pending/F001/P001/image.png");
                    attachment.setDigest(sha256Hex(payload));
                    return true;
                });
        when(karteServiceBean.addDocument(any())).thenAnswer(invocation -> {
            open.dolphin.infomodel.DocumentModel document = invocation.getArgument(0);
            AttachmentModel attachment = document.getAttachment().get(0);
            assertThat(attachment.getDigest()).isEqualTo(sha256Hex(payload));
            assertThat(attachment.getContentBytes()).isNull();
            attachment.setId(99L);
            document.setId(10L);
            return 10L;
        });

        PatientImageServiceBean.UploadResult result = service.uploadImage(
                "F001",
                "P001",
                "F001:doctor01",
                "image.png",
                "image/png",
                payloadPath,
                payload.length);

        assertThat(result.documentId()).isEqualTo(10L);
        assertThat(result.attachmentId()).isEqualTo(99L);
        verify(em, never()).createQuery(anyString(), eq(Long.class));
        verify(attachmentStorageManager).prepareExternalAssetForPersist(any(), any(), eq((long) payload.length));
    }

    @Test
    void uploadImage_externalizesToS3BeforePersistWhenAttachmentStorageIsS3() throws Exception {
        byte[] payload = new byte[] {1, 2, 3, 4};
        Path payloadPath = writePayload("image.png", payload);
        PatientModel patient = new PatientModel();
        patient.setId(1L);
        patient.setFacilityId("F001");
        patient.setPatientId("P001");

        KarteBean karte = new KarteBean();
        karte.setId(2L);

        UserModel actor = new UserModel();
        actor.setUserId("F001:doctor01");

        when(patientServiceBean.getPatientById("F001", "P001")).thenReturn(patient);
        when(patientServiceBean.ensureKarteByPatientPk(1L)).thenReturn(karte);
        when(userServiceBean.getUser("F001:doctor01")).thenReturn(actor);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.prepareExternalAssetForPersist(any(), any(), eq((long) payload.length)))
                .thenAnswer(invocation -> {
                    AttachmentModel attachment = invocation.getArgument(0);
                    attachment.setUri("s3://test-bucket/attachments/doc-20/att-10-image.png");
                    attachment.setDigest("digest-from-stream");
                    return true;
                });
        when(karteServiceBean.addDocument(any())).thenAnswer(invocation -> {
            open.dolphin.infomodel.DocumentModel document = invocation.getArgument(0);
            AttachmentModel attachment = document.getAttachment().get(0);
            assertThat(attachment.getContentBytes()).isNull();
            assertThat(attachment.getUri()).isEqualTo("s3://test-bucket/attachments/doc-20/att-10-image.png");
            assertThat(attachment.getDigest()).isEqualTo("digest-from-stream");
            attachment.setId(99L);
            document.setId(10L);
            return 10L;
        });

        PatientImageServiceBean.UploadResult result = service.uploadImage(
                "F001",
                "P001",
                "F001:doctor01",
                "image.png",
                "image/png",
                payloadPath,
                payload.length);

        assertThat(result.documentId()).isEqualTo(10L);
        assertThat(result.attachmentId()).isEqualTo(99L);
        verify(attachmentStorageManager).prepareExternalAssetForPersist(any(), any(), eq((long) payload.length));
    }

    private Path writePayload(String fileName, byte[] bytes) throws Exception {
        Path path = tempDir.resolve(fileName);
        Files.write(path, bytes);
        return path;
    }

    @Test
    void listImages_readsMetadataProjectionOnly() {
        @SuppressWarnings("unchecked")
        TypedQuery<Object[]> query = mock(TypedQuery.class);
        Date now = Date.from(Instant.parse("2026-03-09T08:00:00Z"));
        when(em.createQuery(anyString(), eq(Object[].class))).thenReturn(query);
        when(query.setParameter("fid", "F001")).thenReturn(query);
        when(query.setParameter("pid", "P001")).thenReturn(query);
        when(query.setParameter("rel", PatientImageServiceBean.LINK_RELATION_PATIENT_IMAGE_PHASEA)).thenReturn(query);
        when(query.getResultList()).thenReturn(List.<Object[]>of(
                new Object[] {10L, "image.png", "image/png", 123L, now, now}));

        List<PatientImageEntryResponse> result = service.listImages("F001", "P001");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getImageId()).isEqualTo(10L);
        assertThat(result.get(0).getFileName()).isEqualTo("image.png");
        assertThat(result.get(0).getContentType()).isEqualTo("image/png");
        assertThat(result.get(0).getSize()).isEqualTo(123L);
        assertThat(result.get(0).getCreatedAt()).isEqualTo("2026-03-09T08:00:00Z");
    }

    @Test
    void getImageForDownload_readsMetadataProjectionOnly() {
        @SuppressWarnings("unchecked")
        TypedQuery<Object[]> query = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Object[].class))).thenReturn(query);
        when(query.setParameter("id", 10L)).thenReturn(query);
        when(query.setParameter("fid", "F001")).thenReturn(query);
        when(query.setParameter("pid", "P001")).thenReturn(query);
        when(query.setParameter("rel", PatientImageServiceBean.LINK_RELATION_PATIENT_IMAGE_PHASEA)).thenReturn(query);
        when(query.getSingleResult()).thenReturn(new Object[] {
                10L, "image.png", "image/png", 123L, "s3://bucket/patient/image.png", "digest-1", null
        });

        PatientImageServiceBean.DownloadHandle result = service.getImageForDownload("F001", "P001", 10L);

        assertThat(result).isNotNull();
        assertThat(result.attachmentId()).isEqualTo(10L);
        assertThat(result.fileName()).isEqualTo("image.png");
        assertThat(result.contentType()).isEqualTo("image/png");
        assertThat(result.contentSize()).isEqualTo(123L);
        assertThat(result.uri()).isEqualTo("s3://bucket/patient/image.png");
        assertThat(result.digest()).isEqualTo("digest-1");
    }

    @Test
    void getImageForDownload_rejectsRowWithoutExternalUriAndDigest() {
        @SuppressWarnings("unchecked")
        TypedQuery<Object[]> query = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Object[].class))).thenReturn(query);
        when(query.setParameter("id", 11L)).thenReturn(query);
        when(query.setParameter("fid", "F001")).thenReturn(query);
        when(query.setParameter("pid", "P001")).thenReturn(query);
        when(query.setParameter("rel", PatientImageServiceBean.LINK_RELATION_PATIENT_IMAGE_PHASEA)).thenReturn(query);
        when(query.getSingleResult()).thenReturn(new Object[] {
                11L, "scan.png", "image/png", 3L, null, "digest-inline"
        });

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.getImageForDownload("F001", "P001", 11L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("uri and digest");
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static String sha256Hex(byte[] value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
    }
}
