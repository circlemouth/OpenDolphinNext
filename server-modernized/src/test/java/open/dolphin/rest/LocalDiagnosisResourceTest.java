package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.time.LocalDate;
import java.util.Date;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.orca.service.DiseaseProjectionService;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LocalDiagnosisResourceTest {

    private LocalDiagnosisResource resource;
    private HttpServletRequest request;
    private StubKarteServiceBean karteServiceBean;

    @BeforeEach
    void setUp() throws Exception {
        resource = new LocalDiagnosisResource();
        setField(resource, "patientServiceBean", new StubPatientServiceBean());
        karteServiceBean = new StubKarteServiceBean();
        setField(resource, "karteServiceBean", karteServiceBean);
        setField(resource, "diseaseProjectionService", new DiseaseProjectionService());
        request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("F001:doctor01");
        when(request.getHeader("X-Trace-Id")).thenReturn("trace-100");
    }

    @Test
    void getDiagnosesReturnsOrcaSourceOfTruthAndSeparatesPendingLocalPayload() {
        Map<String, Object> response = resource.getDiagnoses(request, "00001", "2026-03-25", null, false);

        assertEquals("00001", response.get("patientId"));
        assertEquals(1001L, response.get("karteId"));
        assertEquals("orca", response.get("sourceOfTruth"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> diseases = (List<Map<String, Object>>) response.get("diseases");
        assertEquals(0, diseases.size());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pending = (List<Map<String, Object>>) response.get("pendingLocalDiseases");
        assertEquals(1, pending.size());
        assertEquals(55L, pending.get(0).get("diagnosisId"));
        assertEquals("insurance-local", pending.get(0).get("layer"));
        assertEquals(false, pending.get(0).get("readOnly"));
    }

    @Test
    void getDiagnosesAddsReadOnlyOrcaMirrorAndMarksDiffWithoutTrustingClientFacility() throws Exception {
        StubOrcaTransport transport = new StubOrcaTransport(orcaDiseaseResponse("ORCA参照病名", "I10"));
        setField(resource, "orcaTransport", transport);

        Map<String, Object> response = resource.getDiagnoses(request, "00001", null, "2026-05-08", false);

        assertEquals("orca", response.get("sourceOfTruth"));
        assertEquals("connected", response.get("orcaMirrorStatus"));
        assertEquals("F001", transport.facilityId());
        assertEquals(OrcaEndpoint.DISEASE_GET, transport.endpoint());
        assertEquals(DiseaseProjectionService.DISEASE_GET_QUERY, transport.requestQuery());
        org.junit.jupiter.api.Assertions.assertTrue(transport.requestBody().contains("<Patient_ID type=\"string\">00001</Patient_ID>"));
        org.junit.jupiter.api.Assertions.assertTrue(transport.requestBody().contains("<Base_Date type=\"string\">2026-05-08</Base_Date>"));
        org.junit.jupiter.api.Assertions.assertFalse(transport.requestBody().contains("Request_Number"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> diseases = (List<Map<String, Object>>) response.get("diseases");
        assertEquals(1, diseases.size());
        Map<String, Object> mirror = diseases.get(0);
        assertEquals("orca-mirror", mirror.get("layer"));
        assertEquals("ORCA参照病名", mirror.get("diagnosisName"));
        assertEquals(true, mirror.get("readOnly"));
        assertEquals("conflict", mirror.get("syncState"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pending = (List<Map<String, Object>>) response.get("pendingLocalDiseases");
        assertEquals(1, pending.size());
        assertEquals("insurance-local", pending.get(0).get("layer"));
    }

    @Test
    void getDiagnosesTreatsOrcaNoDiseaseAsConnectedEmptyMirror() throws Exception {
        setField(resource, "orcaTransport", new StubOrcaTransport(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                        + "<xmlio2><disease_infores>"
                        + "<Api_Result>21</Api_Result>"
                        + "<Api_Result_Message>対象病名がありません</Api_Result_Message>"
                        + "</disease_infores></xmlio2>"));

        Map<String, Object> response = resource.getDiagnoses(request, "00001", null, "2026-05-08", false);

        assertEquals("connected", response.get("orcaMirrorStatus"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> diseases = (List<Map<String, Object>>) response.get("diseases");
        assertEquals(0, diseases.size());
    }

    @Test
    void getDiagnosesDoesNotMarkOrcaMirrorWhenNoLocalPendingDisease() throws Exception {
        setField(resource, "karteServiceBean", new EmptyDiagnosisKarteServiceBean());
        setField(resource, "orcaTransport", new StubOrcaTransport(orcaDiseaseResponse("ORCA登録済み病名", "I10")));

        Map<String, Object> response = resource.getDiagnoses(request, "00001", null, "2026-05-08", false);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> diseases = (List<Map<String, Object>>) response.get("diseases");
        assertEquals(1, diseases.size());
        assertEquals("none", diseases.get(0).get("syncState"));
        assertEquals(null, diseases.get(0).get("note"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pending = (List<Map<String, Object>>) response.get("pendingLocalDiseases");
        assertEquals(0, pending.size());
    }

    @Test
    void getDiagnosesDoesNotFallbackToLocalDiseasesAndSanitizesMirrorFailure() throws Exception {
        setField(resource, "orcaTransport", new FailingOrcaTransport());

        Map<String, Object> response = resource.getDiagnoses(request, "00001", null, "2026-05-08", false);

        assertEquals("orca", response.get("sourceOfTruth"));
        assertEquals("unavailable", response.get("orcaMirrorStatus"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> diseases = (List<Map<String, Object>>) response.get("diseases");
        assertEquals(0, diseases.size());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pending = (List<Map<String, Object>>) response.get("pendingLocalDiseases");
        assertEquals(1, pending.size());
        assertEquals("insurance-local", pending.get(0).get("layer"));
        org.junit.jupiter.api.Assertions.assertFalse(response.toString().contains("https://orca.internal.example"));
    }

    @Test
    void getDiagnosesRejectsFacilityMismatchBeforeOrcaMirrorLookup() throws Exception {
        setField(resource, "patientServiceBean", new RejectingPatientServiceBean());

        WebApplicationException exception = assertThrows(WebApplicationException.class,
                () -> resource.getDiagnoses(request, "00001", null, "2026-05-08", false));

        assertEquals(404, exception.getResponse().getStatus());
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static String orcaDiseaseResponse(String diseaseName, String diseaseCode) {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<xmlio2><diseasegetres>"
                + "<Api_Result>0000</Api_Result>"
                + "<Disease_Information type=\"array\">"
                + "<Disease_Information_child type=\"record\">"
                + "<Disease_Code type=\"string\">" + diseaseCode + "</Disease_Code>"
                + "<Disease_Name type=\"string\">" + diseaseName + "</Disease_Name>"
                + "<Disease_StartDate type=\"string\">20260501</Disease_StartDate>"
                + "<Department_Code type=\"string\">01</Department_Code>"
                + "</Disease_Information_child>"
                + "</Disease_Information>"
                + "</diseasegetres></xmlio2>";
    }

    private static final class StubPatientServiceBean extends PatientServiceBean {
        @Override
        public PatientModel getPatientById(String fid, String pid) {
            PatientModel patient = new PatientModel();
            patient.setFacilityId(fid);
            patient.setPatientId(pid);
            patient.setFullName("患者");
            patient.setBirthday(LocalDate.parse("1980-01-01"));
            return patient;
        }
    }

    private static final class RejectingPatientServiceBean extends PatientServiceBean {
        @Override
        public PatientModel getPatientById(String fid, String pid) {
            return null;
        }
    }

    private static final class StubKarteServiceBean extends KarteServiceBean {
        private final List<RegisteredDiagnosisModel> diagnoses = new ArrayList<>();
        @Override
        public KarteBean getKarte(String fid, String pid, Date fromDate) {
            KarteBean karte = new KarteBean();
            karte.setId(1001L);
            return karte;
        }

        @Override
        public List<RegisteredDiagnosisModel> getDiagnosis(long karteId, Date fromDate, boolean activeOnly) {
            if (!diagnoses.isEmpty()) {
                return List.copyOf(diagnoses);
            }
            RegisteredDiagnosisModel model = new RegisteredDiagnosisModel();
            model.setId(55L);
            model.setDiagnosis("感冒");
            model.setDiagnosisCode("A001");
            model.setStarted(new Date());
            return List.of(model);
        }
    }

    private static final class EmptyDiagnosisKarteServiceBean extends KarteServiceBean {
        @Override
        public KarteBean getKarte(String fid, String pid, Date fromDate) {
            KarteBean karte = new KarteBean();
            karte.setId(1001L);
            return karte;
        }

        @Override
        public List<RegisteredDiagnosisModel> getDiagnosis(long karteId, Date fromDate, boolean activeOnly) {
            return List.of();
        }
    }

    private static final class StubOrcaTransport implements OrcaTransport {
        private final String body;
        private String facilityId;
        private OrcaEndpoint endpoint;
        private String requestBody;
        private String requestQuery;

        StubOrcaTransport(String body) {
            this.body = body;
        }

        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            this.facilityId = facilityId;
            this.endpoint = endpoint;
            this.requestBody = request != null ? request.getBody() : null;
            this.requestQuery = request != null ? request.getQuery() : null;
            return new OrcaTransportResult(null, "POST", 200, body, "application/xml", Map.of());
        }

        String facilityId() {
            return facilityId;
        }

        OrcaEndpoint endpoint() {
            return endpoint;
        }

        String requestBody() {
            return requestBody;
        }

        String requestQuery() {
            return requestQuery;
        }
    }

    private static final class FailingOrcaTransport implements OrcaTransport {
        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            throw new RuntimeException("https://orca.internal.example/basic-secret");
        }
    }
}
