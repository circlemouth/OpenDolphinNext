package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Field;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.security.audit.AuthoritativeAuditRepository;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientImageServiceBean;
import open.dolphin.session.UserServiceBean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class KarteDocumentSnapshotContractTest {

    private KarteDocumentWriteResource resource;

    @Mock
    private KarteServiceBean karteServiceBean;

    @Mock
    private UserServiceBean userServiceBean;

    @Mock
    private AuthoritativeAuditRepository authoritativeAuditRepository;

    @Mock
    private HttpServletRequest request;

    @Mock
    private EntityManager em;

    @Mock
    private TypedQuery<AttachmentModel> attachmentQuery;

    @BeforeEach
    void setUp() throws Exception {
        resource = new KarteDocumentWriteResource();
        setField(resource, "karteServiceBean", karteServiceBean);
        setField(resource, "userServiceBean", userServiceBean);
        setField(resource, "authoritativeAuditRepository", authoritativeAuditRepository);
        setField(resource, "objectMapper", new ObjectMapper());
        setField(resource, "httpServletRequest", request);
        setField(resource, "em", em);

        when(request.getRemoteUser()).thenReturn("F001:user01");
        when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(true);
        when(karteServiceBean.findFacilityIdByAttachmentId(901L)).thenReturn("F001");
        when(karteServiceBean.findFacilityIdByKarteId(77L)).thenReturn("F001");
        when(em.createQuery(anyString(), eq(AttachmentModel.class))).thenReturn(attachmentQuery);
        when(attachmentQuery.setParameter("id", 901L)).thenReturn(attachmentQuery);
    }

    @Test
    void referenceOnlyPayload_usesSourcePatientAsSnapshotTruth() throws Exception {
        AttachmentModel source = buildSourceAttachment(901L, "P-100", 77L);
        UserModel actor = new UserModel();
        actor.setUserId("F001:user01");
        when(userServiceBean.getUser("F001:user01")).thenReturn(actor);
        when(attachmentQuery.getSingleResult()).thenReturn(source);
        when(karteServiceBean.addDocument(any())).thenReturn(2001L);

        String result = resource.postDocument("""
                {
                  "docInfoModel": {
                    "patientId": "P-SPOOFED"
                  },
                  "attachment": [
                    {
                      "id": 901,
                      "fileName": "spoofed.png"
                    }
                  ]
                }
                """);

        assertThat(result).isEqualTo("2001");
        ArgumentCaptor<open.dolphin.infomodel.DocumentModel> captor =
                ArgumentCaptor.forClass(open.dolphin.infomodel.DocumentModel.class);
        org.mockito.Mockito.verify(karteServiceBean).addDocument(captor.capture());
        open.dolphin.infomodel.DocumentModel captured = captor.getValue();
        assertThat(captured.getKarteBean().getId()).isEqualTo(77L);
        assertThat(captured.getDocInfoModel().getPatientId()).isEqualTo("P-100");
        assertThat(captured.getDocInfoModel().getTitle()).isEqualTo("文書画像参照");
        assertThat(captured.getDocInfoModel().getPurpose()).isEqualTo(open.dolphin.infomodel.IInfoModel.PURPOSE_RECORD);
        assertThat(captured.getDocInfoModel().getDocId()).isNotBlank();
        assertThat(captured.getAttachment()).hasSize(1);
        AttachmentModel reference = captured.getAttachment().get(0);
        assertThat(reference.getId()).isZero();
        assertThat(reference.getLinkId()).isEqualTo(901L);
        assertThat(reference.getLinkRelation()).isEqualTo(open.dolphin.storage.attachment.AttachmentStorageManager.LINK_RELATION_REFERENCE_ONLY);
        assertThat(reference.getUri()).isEqualTo("s3://bucket/patient-images/P-100/xray.png");
        assertThat(reference.getDigest()).isEqualTo("digest-901");
        assertThat(reference.getFileName()).isEqualTo("xray.png");
    }

    private static AttachmentModel buildSourceAttachment(long attachmentId, String patientId, long karteId) {
        AttachmentModel source = new AttachmentModel();
        source.setId(attachmentId);
        source.setFileName("xray.png");
        source.setContentType("image/png");
        source.setContentSize(1280L);
        source.setDigest("digest-901");
        source.setUri("s3://bucket/patient-images/P-100/xray.png");
        source.setStorageProvider("s3");
        source.setStorageBucket("bucket");
        source.setStorageKey("patient-images/P-100/xray.png");
        source.setLinkRelation(PatientImageServiceBean.LINK_RELATION_PATIENT_IMAGE_PHASEA);

        KarteBean karte = new KarteBean();
        karte.setId(karteId);
        PatientModel patient = new PatientModel();
        patient.setFacilityId("F001");
        patient.setPatientId(patientId);
        karte.setPatientModel(patient);
        source.setKarteBean(karte);

        UserModel creator = new UserModel();
        creator.setUserId("F001:source-user");
        source.setUserModel(creator);
        return source;
    }
    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
