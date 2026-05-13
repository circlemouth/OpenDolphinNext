package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Modifier;
import java.time.LocalDate;
import java.util.Map;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.orca.service.OrcaPatientCacheStore;
import open.dolphin.orca.sync.OrcaPatientSyncService;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.OfficialPatientCreateRequest;
import open.dolphin.rest.dto.orca.OfficialPatientMutationResponse;
import open.dolphin.rest.dto.orca.OfficialPatientPayload;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.session.PatientServiceBean;
import org.junit.jupiter.api.Test;

class PatientModV2OutpatientResourceIdempotencyTest {

    @Test
    void resourceClassIsProxyableForJaxRsCdiInjection() {
        assertFalse(Modifier.isFinal(PatientModV2OutpatientResource.class.getModifiers()));
    }

    @Test
    void createReturnsIdempotentWhenExistingMatches() {
        StubPatientService service = new StubPatientService();
        PatientModel existing = buildPatient("facility", "00001", "山田 太郎", "ヤマダ タロウ");
        existing.setId(99L);
        service.existing = existing;

        PatientModV2OutpatientResource resource = new PatientModV2OutpatientResource();
        resource.setPatientServiceBean(service);
        resource.setOrcaTransport(new PatientGetOnlyTransport());
        resource.setOrcaLiveGateway(org.mockito.Mockito.mock(OrcaLiveGateway.class));
        resource.setOrcaPatientSyncService(new SuccessfulImportService());
        resource.setPatientCacheStore(new RecordingPatientCacheStore());

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
        assertEquals(Boolean.FALSE, body.getOrcaMutationPrepared());
        assertEquals(Boolean.FALSE, body.getOrcaMutationSent());
        assertEquals(Boolean.TRUE, body.getCanonicalRefetched());
        assertEquals(Boolean.TRUE, body.getLocalSynced());
        assertEquals("patientgetv2", body.getCanonicalSourceApi());
        assertEquals("CURRENT", body.getCanonicalCacheStatus());
        assertEquals("ORCA_PATIENT_FOUND", body.getCanonicalBusinessStatus());
        assertTrue(((Map<?, ?>) body.getAuditEvent().getDetails()).containsKey("operationId"));
        assertEquals("facility", ((Map<?, ?>) body.getAuditEvent().getDetails()).get("resolvedFacilityId"));
        assertEquals("facility:doctor1", ((Map<?, ?>) body.getAuditEvent().getDetails()).get("actor"));
        assertEquals("00001", ((Map<?, ?>) body.getAuditEvent().getDetails()).get("orcaPatientId"));
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
        when(request.getHeader("X-Facility-Id")).thenReturn("spoofed-facility");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.createPatient(request, createRequest("00001", "山田 花子", "ヤマダ ハナコ")));
        assertEquals(401, ex.getResponse().getStatus());
        assertFalse(service.addCalled);
    }

    @Test
    void createIgnoresSpoofedFacilityHeaderAndUsesAuthenticatedRemoteUserFacility() {
        StubPatientService service = new StubPatientService();
        service.existing = buildPatient("facility-a", "00077", "山田 太郎", "ヤマダ タロウ");
        service.existing.setId(177L);
        RecordingImportService importService = new RecordingImportService();
        FacilityRecordingTransport transport = new FacilityRecordingTransport("facility-a");

        PatientModV2OutpatientResource resource = new PatientModV2OutpatientResource();
        resource.setPatientServiceBean(service);
        resource.setOrcaTransport(transport);
        resource.setOrcaLiveGateway(org.mockito.Mockito.mock(OrcaLiveGateway.class));
        resource.setOrcaPatientSyncService(importService);
        resource.setPatientCacheStore(new RecordingPatientCacheStore());

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("facility-a:doctor1");
        when(request.getRequestURI()).thenReturn("/api/orca/official/patientmodv2/outpatient/create");
        when(request.getHeader("X-Facility-Id")).thenReturn("facility-b");
        when(request.getHeader("X-Run-Id")).thenReturn("20260125T112249Z");

        Response response = resource.createPatient(request, createRequest(null, "山田 太郎", "ヤマダ タロウ"));

        assertEquals(200, response.getStatus());
        assertEquals("facility-a", transport.lastPatientModFacility);
        assertEquals("facility-a", transport.lastPatientGetFacility);
        assertEquals("facility-a", importService.lastFacilityId);
        OfficialPatientMutationResponse body = (OfficialPatientMutationResponse) response.getEntity();
        Map<?, ?> details = (Map<?, ?>) body.getAuditEvent().getDetails();
        assertEquals("facility-a", details.get("resolvedFacilityId"));
        assertEquals("00077", details.get("orcaPatientId"));
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

    private static final class PatientGetOnlyTransport implements OrcaTransport {
        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            if (endpoint != OrcaEndpoint.PATIENT_GET) {
                throw new AssertionError("idempotent existing create must not send patientmodv2");
            }
            return new OrcaTransportResult(null, "GET", 200,
                    "{\"Api_Result\":\"00\",\"Api_Result_Message\":\"OK\",\"Patient_Information\":{\"Patient_ID\":\"00001\",\"WholeName\":\"山田 太郎\",\"WholeName_inKana\":\"ヤマダ タロウ\",\"BirthDate\":\"1980-01-01\",\"Sex\":\"1\"}}",
                    "application/json", java.util.Map.of());
        }
    }

    private static final class SuccessfulImportService extends OrcaPatientSyncService {
        @Override
        public PatientImportResponse importPatients(String facilityId, open.dolphin.rest.dto.orca.PatientImportRequest request,
                String runId) {
            PatientImportResponse response = new PatientImportResponse();
            response.setApiResult("00");
            response.setFetchedCount(1);
            return response;
        }
    }

    private static final class RecordingImportService extends OrcaPatientSyncService {
        private String lastFacilityId;

        @Override
        public PatientImportResponse importPatients(String facilityId, open.dolphin.rest.dto.orca.PatientImportRequest request,
                String runId) {
            lastFacilityId = facilityId;
            PatientImportResponse response = new PatientImportResponse();
            response.setApiResult("00");
            response.setFetchedCount(1);
            return response;
        }
    }

    private static final class FacilityRecordingTransport implements OrcaTransport {
        private final String expectedFacilityId;
        private String lastPatientModFacility;
        private String lastPatientGetFacility;

        private FacilityRecordingTransport(String expectedFacilityId) {
            this.expectedFacilityId = expectedFacilityId;
        }

        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            assertEquals(expectedFacilityId, facilityId);
            if (endpoint == OrcaEndpoint.PATIENT_MOD) {
                lastPatientModFacility = facilityId;
                return new OrcaTransportResult(null, "POST", 200,
                        "<xmlio2><patientmodres><Api_Result>00</Api_Result><Api_Result_Message>OK</Api_Result_Message><Patient_ID>00077</Patient_ID></patientmodres></xmlio2>",
                        "application/xml", java.util.Map.of());
            }
            assertEquals(OrcaEndpoint.PATIENT_GET, endpoint);
            lastPatientGetFacility = facilityId;
            return new OrcaTransportResult(null, "GET", 200,
                    "{\"Api_Result\":\"00\",\"Api_Result_Message\":\"OK\",\"Patient_Information\":{\"Patient_ID\":\"00077\",\"WholeName\":\"山田 太郎\",\"WholeName_inKana\":\"ヤマダ タロウ\",\"BirthDate\":\"1980-01-01\",\"Sex\":\"1\"}}",
                    "application/json", java.util.Map.of());
        }
    }

    private static final class RecordingPatientCacheStore extends OrcaPatientCacheStore {
        @Override
        public long save(PatientCacheCommand command) {
            return 315L;
        }
    }
}
