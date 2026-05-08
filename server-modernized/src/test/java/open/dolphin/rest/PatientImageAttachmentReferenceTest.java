package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.UserServiceBean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PatientImageAttachmentReferenceTest {

    private KarteDocumentWriteResource resource;

    @Mock
    private KarteServiceBean karteServiceBean;

    @Mock
    private UserServiceBean userServiceBean;

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
        setField(resource, "objectMapper", new ObjectMapper());
        setField(resource, "httpServletRequest", request);
        setField(resource, "em", em);

        when(request.getRemoteUser()).thenReturn("F001:user01");
    }

    @Test
    void postDocument_rejectsCrossFacilityAttachmentReference() {
        when(karteServiceBean.findFacilityIdByAttachmentId(901L)).thenReturn("F999");

        assertThatThrownBy(() -> resource.postDocument("""
                {
                  "attachment": [
                    {"id": 901}
                  ]
                }
                """))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(throwable -> {
                    WebApplicationException ex = (WebApplicationException) throwable;
                    assertThat(ex.getResponse().getStatus()).isEqualTo(403);
                });
    }

    @Test
    void postDocument_rejectsClientSuppliedResolvedAttachmentMetadata() {
        assertThatThrownBy(() -> resource.postDocument("""
                {
                  "attachment": [
                    {"id": 0, "uri": "client-supplied-placeholder", "digest": "client-supplied-digest"}
                  ]
                }
                """))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(throwable -> {
                    WebApplicationException ex = (WebApplicationException) throwable;
                    assertThat(ex.getResponse().getStatus()).isEqualTo(400);
                });
    }

    @Test
    void postDocument_rejectsNonPatientImageReference() {
        when(karteServiceBean.findFacilityIdByAttachmentId(901L)).thenReturn("F001");
        when(em.createQuery(anyString(), eq(AttachmentModel.class))).thenReturn(attachmentQuery);
        when(attachmentQuery.setParameter("id", 901L)).thenReturn(attachmentQuery);
        when(attachmentQuery.getSingleResult()).thenReturn(buildSourceAttachment("other_relation"));

        assertThatThrownBy(() -> resource.postDocument("""
                {
                  "attachment": [
                    {"id": 901}
                  ]
                }
                """))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(throwable -> {
                    WebApplicationException ex = (WebApplicationException) throwable;
                    assertThat(ex.getResponse().getStatus()).isEqualTo(409);
                });
    }

    private static AttachmentModel buildSourceAttachment(String linkRelation) {
        AttachmentModel source = new AttachmentModel();
        source.setId(901L);
        source.setFileName("scan.png");
        source.setContentType("image/png");
        source.setContentSize(100L);
        source.setDigest("digest-901");
        source.setUri("s3://bucket/patient-images/P-100/scan.png");
        source.setLinkRelation(linkRelation);

        KarteBean karte = new KarteBean();
        karte.setId(77L);
        PatientModel patient = new PatientModel();
        patient.setFacilityId("F001");
        patient.setPatientId("P-100");
        karte.setPatientModel(patient);
        source.setKarteBean(karte);
        return source;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
