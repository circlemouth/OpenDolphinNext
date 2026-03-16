package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.session.PatientServiceBean;
import org.junit.jupiter.api.Test;

class PatientModV2OutpatientResourceIdempotencyTest {

    @Test
    void createReturnsIdempotentWhenExistingMatches() {
        StubPatientService service = new StubPatientService();
        PatientModel existing = buildPatient("facility", "00001", "山田 太郎", "ヤマダ タロウ");
        existing.setId(99L);
        service.existing = existing;

        PatientModV2OutpatientResource resource = new PatientModV2OutpatientResource();
        resource.setPatientServiceBean(service);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("facility:doctor1");
        when(request.getRequestURI()).thenReturn("/api/orca/patient/mutation");
        when(request.getHeader("X-Run-Id")).thenReturn("20260125T112249Z");

        Map<String, Object> payload = new HashMap<>();
        payload.put("operation", "create");
        payload.put("patientId", "00001");
        payload.put("name", "山田 太郎");
        payload.put("kana", "ヤマダ タロウ");
        payload.put("birthDate", "1980-01-01");
        payload.put("sex", "1");
        payload.put("phone", "0311112222");
        payload.put("zip", "100-0001");
        payload.put("address", "東京都千代田区");

        Response response = resource.mutatePatient(request, payload);
        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertEquals(Boolean.TRUE, body.get("idempotent"));
        assertEquals("existing_patient", body.get("idempotentReason"));
        assertEquals(99L, body.get("patientDbId"));
        assertFalse(service.addCalled);
        assertNotNull(body.get("runId"));
    }

    @Test
    void createReturnsConflictWhenExistingDiffers() {
        StubPatientService service = new StubPatientService();
        PatientModel existing = buildPatient("facility", "00001", "山田 太郎", "ヤマダ タロウ");
        existing.setId(99L);
        service.existing = existing;

        PatientModV2OutpatientResource resource = new PatientModV2OutpatientResource();
        resource.setPatientServiceBean(service);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("facility:doctor1");
        when(request.getRequestURI()).thenReturn("/api/orca/patient/mutation");

        Map<String, Object> payload = new HashMap<>();
        payload.put("operation", "create");
        payload.put("patientId", "00001");
        payload.put("name", "山田 花子");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.mutatePatient(request, payload));
        assertEquals(409, ex.getResponse().getStatus());
        assertFalse(service.addCalled);
    }

    @Test
    void createRejectsNonNumericPatientId() {
        StubPatientService service = new StubPatientService();
        PatientModV2OutpatientResource resource = new PatientModV2OutpatientResource();
        resource.setPatientServiceBean(service);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("facility:doctor1");
        when(request.getRequestURI()).thenReturn("/api/orca/patient/mutation");

        Map<String, Object> payload = new HashMap<>();
        payload.put("operation", "create");
        payload.put("patientId", "AB-001");
        payload.put("name", "山田 花子");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.mutatePatient(request, payload));
        assertEquals(400, ex.getResponse().getStatus());
        assertFalse(service.addCalled);
    }

    private static PatientModel buildPatient(String facilityId, String patientId, String name, String kana) {
        PatientModel model = new PatientModel();
        model.setFacilityId(facilityId);
        model.setPatientId(patientId);
        model.setFullName(name);
        model.setKanaName(kana);
        model.setBirthday(LocalDate.parse("1980-01-01"));
        model.setGender("1");
        model.setTelephone("0311112222");
        SimpleAddressModel address = new SimpleAddressModel();
        address.setAddress("東京都千代田区");
        address.setZipCode("100-0001");
        model.setAddress(address);
        return model;
    }

    private static final class StubPatientService extends PatientServiceBean {
        private PatientModel existing;
        private boolean addCalled;

        @Override
        public PatientModel getPatientById(String fid, String pid) {
            return existing;
        }

        @Override
        public long addPatient(PatientModel patient) {
            addCalled = true;
            return 1L;
        }

        @Override
        public int update(PatientModel patient) {
            return 1;
        }
    }
}
