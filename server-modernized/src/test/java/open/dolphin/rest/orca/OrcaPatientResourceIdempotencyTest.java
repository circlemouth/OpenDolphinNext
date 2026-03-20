package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.time.LocalDate;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.rest.dto.orca.PatientMutationRequest;
import open.dolphin.rest.dto.orca.PatientMutationResponse;
import open.dolphin.session.PatientServiceBean;
import org.junit.jupiter.api.Test;

class OrcaPatientResourceIdempotencyTest {

    @Test
    void createReturnsIdempotentWhenExistingMatches() {
        StubPatientService service = new StubPatientService();
        PatientModel existing = buildPatient("facility", "00001", "山田 太郎", "ヤマダ タロウ");
        existing.setId(12L);
        service.existing = existing;

        OrcaPatientResource resource = new OrcaPatientResource();
        resource.setPatientServiceBean(service);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("facility:doctor1");
        when(request.getRequestURI()).thenReturn("/api/orca/patient/mutation");
        when(request.getHeader("X-Run-Id")).thenReturn("20260125T112249Z");

        PatientMutationRequest payload = new PatientMutationRequest();
        payload.setOperation("create");
        PatientMutationRequest.PatientPayload patient = new PatientMutationRequest.PatientPayload();
        patient.setPatientId("00001");
        patient.setWholeName("山田 太郎");
        patient.setWholeNameKana("ヤマダ タロウ");
        patient.setBirthDate("1980-01-01");
        patient.setSex("1");
        patient.setTelephone("0311112222");
        patient.setZipCode("100-0001");
        patient.setAddressLine("東京都千代田区");
        payload.setPatient(patient);

        PatientMutationResponse response = resource.mutatePatient(request, payload);

        assertEquals("00", response.getApiResult());
        assertEquals("登録済み", response.getApiResultMessage());
        assertEquals(Boolean.TRUE, response.getIdempotent());
        assertEquals("existing_patient", response.getIdempotentReason());
        assertEquals(12L, response.getPatientDbId());
        assertFalse(service.addCalled);
        assertNotNull(response.getRunId());
    }

    @Test
    void createReturnsConflictWhenExistingDiffers() {
        StubPatientService service = new StubPatientService();
        PatientModel existing = buildPatient("facility", "00001", "山田 太郎", "ヤマダ タロウ");
        existing.setId(12L);
        service.existing = existing;

        OrcaPatientResource resource = new OrcaPatientResource();
        resource.setPatientServiceBean(service);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("facility:doctor1");
        when(request.getRequestURI()).thenReturn("/api/orca/patient/mutation");

        PatientMutationRequest payload = new PatientMutationRequest();
        payload.setOperation("create");
        PatientMutationRequest.PatientPayload patient = new PatientMutationRequest.PatientPayload();
        patient.setPatientId("00001");
        patient.setWholeName("山田 花子");
        payload.setPatient(patient);

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.mutatePatient(request, payload));
        assertEquals(409, ex.getResponse().getStatus());
        assertFalse(service.addCalled);
    }

    @Test
    void updateReturnsSuccessWhenPatientExists() {
        StubPatientService service = new StubPatientService();
        PatientModel existing = buildPatient("facility", "00001", "山田 太郎", "ヤマダ タロウ");
        existing.setId(12L);
        service.existing = existing;

        OrcaPatientResource resource = new OrcaPatientResource();
        resource.setPatientServiceBean(service);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("facility:doctor1");
        when(request.getRequestURI()).thenReturn("/api/orca/patient/mutation");
        when(request.getHeader("X-Run-Id")).thenReturn("20260125T112249Z");

        PatientMutationRequest payload = new PatientMutationRequest();
        payload.setOperation("update");
        PatientMutationRequest.PatientPayload patient = new PatientMutationRequest.PatientPayload();
        patient.setPatientId("00001");
        patient.setWholeName("山田 太郎");
        patient.setWholeNameKana("ヤマダ タロウ");
        payload.setPatient(patient);

        PatientMutationResponse response = resource.mutatePatient(request, payload);

        assertEquals("00", response.getApiResult());
        assertEquals("更新完了", response.getApiResultMessage());
        assertEquals(12L, response.getPatientDbId());
        assertTrue(service.updateCalled);
    }

    @Test
    void updateReturnsNotFoundWhenPatientMissing() {
        StubPatientService service = new StubPatientService();

        OrcaPatientResource resource = new OrcaPatientResource();
        resource.setPatientServiceBean(service);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("facility:doctor1");
        when(request.getRequestURI()).thenReturn("/api/orca/patient/mutation");

        PatientMutationRequest payload = new PatientMutationRequest();
        payload.setOperation("update");
        PatientMutationRequest.PatientPayload patient = new PatientMutationRequest.PatientPayload();
        patient.setPatientId("00001");
        payload.setPatient(patient);

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.mutatePatient(request, payload));
        assertEquals(404, ex.getResponse().getStatus());
        assertFalse(service.updateCalled);
    }

    @Test
    void deleteReturnsExplicitUnsupportedError() {
        StubPatientService service = new StubPatientService();

        OrcaPatientResource resource = new OrcaPatientResource();
        resource.setPatientServiceBean(service);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("facility:doctor1");
        when(request.getRequestURI()).thenReturn("/api/orca/patient/mutation");

        PatientMutationRequest payload = new PatientMutationRequest();
        payload.setOperation("delete");
        PatientMutationRequest.PatientPayload patient = new PatientMutationRequest.PatientPayload();
        patient.setPatientId("00001");
        payload.setPatient(patient);

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.mutatePatient(request, payload));
        assertEquals(400, ex.getResponse().getStatus());
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
        private boolean updateCalled;

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
            updateCalled = true;
            return 1;
        }
    }
}
