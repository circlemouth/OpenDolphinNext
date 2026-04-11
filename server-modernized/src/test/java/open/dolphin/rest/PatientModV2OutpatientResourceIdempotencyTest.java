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
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.rest.dto.orca.OfficialPatientCreateRequest;
import open.dolphin.rest.dto.orca.OfficialPatientMutationResponse;
import open.dolphin.rest.dto.orca.OfficialPatientPayload;
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
        when(request.getRequestURI()).thenReturn("/api/orca/official/patientmodv2/outpatient/create");
        when(request.getHeader("X-Run-Id")).thenReturn("20260125T112249Z");

        Response response = resource.createPatient(request, createRequest("00001", "山田 太郎", "ヤマダ タロウ"));
        assertEquals(200, response.getStatus());
        OfficialPatientMutationResponse body = (OfficialPatientMutationResponse) response.getEntity();
        assertEquals(Boolean.TRUE, body.getIdempotent());
        assertEquals("existing_patient", body.getIdempotentReason());
        assertEquals(99L, body.getPatientDbId());
        assertFalse(service.addCalled);
        assertNotNull(body.getRunId());
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
        when(request.getRequestURI()).thenReturn("/api/orca/official/patientmodv2/outpatient/create");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.createPatient(request, createRequest("00001", "山田 花子", "ヤマダ ハナコ")));
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
        when(request.getRequestURI()).thenReturn("/api/orca/official/patientmodv2/outpatient/create");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.createPatient(request, createRequest("AB-001", "山田 花子", "ヤマダ ハナコ")));
        assertEquals(400, ex.getResponse().getStatus());
        assertFalse(service.addCalled);
    }

    @Test
    void mutateRejectsMissingFacility() {
        StubPatientService service = new StubPatientService();
        PatientModV2OutpatientResource resource = new PatientModV2OutpatientResource();
        resource.setPatientServiceBean(service);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn(null);
        when(request.getRequestURI()).thenReturn("/api/orca/official/patientmodv2/outpatient/create");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.createPatient(request, createRequest("00001", "山田 花子", "ヤマダ ハナコ")));
        assertEquals(401, ex.getResponse().getStatus());
        assertFalse(service.addCalled);
    }

    private static OfficialPatientCreateRequest createRequest(String patientId, String wholeName, String wholeNameKana) {
        OfficialPatientPayload patient = new OfficialPatientPayload();
        patient.setPatientId(patientId);
        patient.setWholeName(wholeName);
        patient.setWholeNameKana(wholeNameKana);
        patient.setBirthDate("1980-01-01");
        patient.setSex("1");
        patient.setTelephone("0311112222");
        patient.setZipCode("100-0001");
        patient.setAddressLine("東京都千代田区");

        OfficialPatientCreateRequest request = new OfficialPatientCreateRequest();
        request.setPatient(patient);
        return request;
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
