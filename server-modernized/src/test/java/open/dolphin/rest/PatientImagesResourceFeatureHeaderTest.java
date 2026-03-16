package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.rest.dto.PatientImageEntryResponse;
import open.dolphin.session.PatientImageServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PatientImagesResourceFeatureHeaderTest extends RuntimeDelegateTestSupport {

    private static final String PATIENT_ID = "00001";

    private PatientImagesResource resource;
    private HttpServletRequest request;
    private HttpServletResponse response;
    private PatientServiceBean patientServiceBean;
    private PatientImageServiceBean patientImageServiceBean;

    @BeforeEach
    void setUp() throws Exception {
        request = mock(HttpServletRequest.class);
        response = mock(HttpServletResponse.class);
        patientServiceBean = mock(PatientServiceBean.class);
        patientImageServiceBean = mock(PatientImageServiceBean.class);

        resource = new PatientImagesResource();
        setField(resource, "httpServletRequest", request);
        setField(resource, "httpServletResponse", response);
        setField(resource, "patientServiceBean", patientServiceBean);
        setField(resource, "patientImageServiceBean", patientImageServiceBean);
        System.setProperty("opendolphin.patient.images.enabled", "true");

        when(request.getRemoteUser()).thenReturn("F001:doctor01");
        when(request.getRequestURI()).thenReturn("/openDolphin/api/patients/" + PATIENT_ID + "/images");
    }

    @AfterEach
    void tearDown() {
        System.clearProperty("opendolphin.patient.images.enabled");
    }

    @Test
    void list_doesNotRequireFeatureHeaders() {
        when(patientServiceBean.getPatientById("F001", PATIENT_ID)).thenReturn(new PatientModel());

        PatientImageEntryResponse entry = new PatientImageEntryResponse();
        entry.setImageId(10L);
        when(patientImageServiceBean.listImages("F001", PATIENT_ID)).thenReturn(List.of(entry));

        Response response = resource.list(PATIENT_ID);
        @SuppressWarnings("unchecked")
        List<PatientImageEntryResponse> items = (List<PatientImageEntryResponse>) response.getEntity();

        assertEquals(1, items.size());
        assertEquals("/openDolphin/api/patients/00001/images/10", items.get(0).getDownloadUrl());
        assertEquals("private, no-store, max-age=0, must-revalidate", response.getHeaderString("Cache-Control"));
        verify(this.response).setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    }

    @Test
    void list_ignoresLegacyHeader() {
        when(request.getHeader("X-Feature-Images")).thenReturn("1");
        when(patientServiceBean.getPatientById("F001", PATIENT_ID)).thenReturn(new PatientModel());

        PatientImageEntryResponse entry = new PatientImageEntryResponse();
        entry.setImageId(11L);
        when(patientImageServiceBean.listImages("F001", PATIENT_ID)).thenReturn(List.of(entry));

        Response response = resource.list(PATIENT_ID);

        assertEquals(200, response.getStatus());
        verify(patientImageServiceBean).listImages("F001", PATIENT_ID);
    }

    @Test
    void list_requiresAuthorizationWithoutFeatureHeaders() {
        when(patientServiceBean.getPatientById("F001", PATIENT_ID)).thenReturn(null);

        WebApplicationException ex = assertThrows(WebApplicationException.class, () -> resource.list(PATIENT_ID));

        assertEquals(404, ex.getResponse().getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
        assertEquals("not_found", body.get("error"));
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Class<?> type = target.getClass();
        Field field = null;
        while (type != null && field == null) {
            try {
                field = type.getDeclaredField(name);
            } catch (NoSuchFieldException ignored) {
                type = type.getSuperclass();
            }
        }
        if (field == null) {
            throw new NoSuchFieldException(name);
        }
        field.setAccessible(true);
        field.set(target, value);
    }
}
