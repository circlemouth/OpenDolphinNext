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
import open.dolphin.infomodel.UserModel;
import open.dolphin.orca.service.DiseaseProjectionService;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
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
        setField(resource, "userServiceBean", new StubUserServiceBean());
        setField(resource, "diseaseProjectionService", new DiseaseProjectionService());
        request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("F001:doctor01");
        when(request.getHeader("X-Trace-Id")).thenReturn("trace-100");
    }

    @Test
    void getDiagnosesReturnsLocalSummaryRoutePayload() {
        Map<String, Object> response = resource.getDiagnoses(request, "00001", "2026-03-25", null, false);

        assertEquals("00001", response.get("patientId"));
        assertEquals(1001L, response.get("karteId"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> diseases = (List<Map<String, Object>>) response.get("diseases");
        assertEquals(1, diseases.size());
        assertEquals(55L, diseases.get(0).get("diagnosisId"));
        assertEquals("insurance-local", diseases.get(0).get("layer"));
        assertEquals(false, diseases.get(0).get("readOnly"));
    }

    @Test
    void getDiagnosesAddsReadOnlyOrcaMirrorAndMarksDiffWithoutTrustingClientFacility() throws Exception {
        StubOrcaTransport transport = new StubOrcaTransport(orcaDiseaseResponse("ORCA参照病名", "I10"));
        setField(resource, "orcaTransport", transport);

        Map<String, Object> response = resource.getDiagnoses(request, "00001", null, "2026-05-08", false);

        assertEquals("connected", response.get("orcaMirrorStatus"));
        assertEquals("F001", transport.facilityId());
        assertEquals(OrcaEndpoint.DISEASE_GET, transport.endpoint());
        org.junit.jupiter.api.Assertions.assertTrue(transport.requestBody().contains("<Patient_ID type=\"string\">00001</Patient_ID>"));
        org.junit.jupiter.api.Assertions.assertTrue(transport.requestBody().contains("<Base_Date type=\"string\">20260508</Base_Date>"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> diseases = (List<Map<String, Object>>) response.get("diseases");
        assertEquals(2, diseases.size());
        assertEquals("conflict", diseases.get(0).get("syncState"));
        Map<String, Object> mirror = diseases.get(1);
        assertEquals("orca-mirror", mirror.get("layer"));
        assertEquals("ORCA参照病名", mirror.get("diagnosisName"));
        assertEquals(true, mirror.get("readOnly"));
        assertEquals("conflict", mirror.get("syncState"));
    }

    @Test
    void getDiagnosesKeepsLocalDiseasesAndSanitizesMirrorFailure() throws Exception {
        setField(resource, "orcaTransport", new FailingOrcaTransport());

        Map<String, Object> response = resource.getDiagnoses(request, "00001", null, "2026-05-08", false);

        assertEquals("unavailable", response.get("orcaMirrorStatus"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> diseases = (List<Map<String, Object>>) response.get("diseases");
        assertEquals(1, diseases.size());
        assertEquals("insurance-local", diseases.get(0).get("layer"));
        org.junit.jupiter.api.Assertions.assertFalse(response.toString().contains("https://orca.internal.example"));
    }

    @Test
    void getDiagnosesRejectsFacilityMismatchBeforeOrcaMirrorLookup() throws Exception {
        setField(resource, "patientServiceBean", new RejectingPatientServiceBean());

        WebApplicationException exception = assertThrows(WebApplicationException.class,
                () -> resource.getDiagnoses(request, "00001", null, "2026-05-08", false));

        assertEquals(404, exception.getResponse().getStatus());
    }

    @Test
    void mutateDiagnosesRejectsMissingKarteId() {
        WebApplicationException exception = assertThrows(WebApplicationException.class, () -> resource.mutateDiagnoses(
                request,
                Map.of(
                        "patientId", "00001",
                        "operations", List.of(Map.of("operation", "delete", "diagnosisId", 55L)))));
        assertEquals(400, exception.getResponse().getStatus());
    }

    @Test
    void mutateDiagnosesRejectsCreateWithoutDiagnosisId() {
        WebApplicationException exception = assertThrows(WebApplicationException.class, () -> resource.mutateDiagnoses(
                request,
                Map.of(
                        "patientId", "00001",
                        "karteId", 1001L,
                        "operations", List.of(Map.of(
                                "operation", "create",
                                "diagnosisName", "感冒",
                                "startDate", "2026-03-25")))));
        assertEquals(400, exception.getResponse().getStatus());
    }

    @Test
    void mutateDiagnosesRejectsMirrorLayerAuthoring() {
        WebApplicationException exception = assertThrows(WebApplicationException.class, () -> resource.mutateDiagnoses(
                request,
                Map.of(
                        "patientId", "00001",
                        "karteId", 1001L,
                        "operations", List.of(Map.of(
                                "operation", "update",
                                "diagnosisId", 55L,
                                "diagnosisName", "感冒",
                                "startDate", "2026-03-25",
                                "layer", "orca-mirror")))));
        assertEquals(400, exception.getResponse().getStatus());
    }

    @Test
    void mutateDiagnosesRejectsCandidateOnlyAuthoring() {
        WebApplicationException exception = assertThrows(WebApplicationException.class, () -> resource.mutateDiagnoses(
                request,
                Map.of(
                        "patientId", "00001",
                        "karteId", 1001L,
                        "operations", List.of(Map.of(
                                "operation", "create",
                                "diagnosisId", -1L,
                                "diagnosisName", "候補病名",
                                "startDate", "2026-04-10",
                                "candidateOnly", true)))));
        assertEquals(400, exception.getResponse().getStatus());
    }

    @Test
    void mutateDiagnosesCreateRoundtripRecordsCategorySuspectedOutcomeAndDelete() {
        Map<String, Object> createResponse = resource.mutateDiagnoses(
                request,
                Map.of(
                        "patientId", "00001",
                        "karteId", 1001L,
                        "operations", List.of(Map.of(
                                "operation", "create",
                                "diagnosisId", -1L,
                                "diagnosisName", "主病名テスト",
                                "diagnosisCode", "I10",
                                "startDate", "2026-04-10",
                                "endDate", "2026-04-20",
                                "outcome", "治癒",
                                "category", "主病名",
                                "suspectedFlag", "疑い"))));

        assertEquals(List.of(101L), createResponse.get("createdDiagnosisIds"));
        RegisteredDiagnosisModel created = karteServiceBean.getLastAddedDiagnosis();
        assertEquals("主病名テスト", created.getDiagnosis());
        assertEquals("I10", created.getDiagnosisCode());
        assertEquals("治癒", created.getOutcome());
        assertEquals("主病名", created.getCategory());
        assertEquals("疑い", created.getCategoryDesc());
        assertEquals("2026-04-10", open.dolphin.infomodel.ModelUtils.getDateAsString(created.getStarted()));
        assertEquals("2026-04-20", open.dolphin.infomodel.ModelUtils.getDateAsString(created.getEnded()));

        Map<String, Object> readback = resource.getDiagnoses(request, "00001", "2026-04-01", null, false);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> diseases = (List<Map<String, Object>>) readback.get("diseases");
        assertEquals("主病名テスト", diseases.get(0).get("diagnosisName"));
        assertEquals("2026-04-10", diseases.get(0).get("startDate"));
        assertEquals("2026-04-20", diseases.get(0).get("endDate"));
        assertEquals("治癒", diseases.get(0).get("outcome"));
        assertEquals("主病名", diseases.get(0).get("category"));
        assertEquals("疑い", diseases.get(0).get("suspectedFlag"));

        Map<String, Object> deleteResponse = resource.mutateDiagnoses(
                request,
                Map.of(
                        "patientId", "00001",
                        "karteId", 1001L,
                        "operations", List.of(Map.of(
                                "operation", "delete",
                                "diagnosisId", 101L,
                                "diagnosisName", "主病名テスト"))));

        assertEquals(List.of(101L), deleteResponse.get("removedDiagnosisIds"));
        assertEquals(List.of(101L), karteServiceBean.getRemovedDiagnosisIds());
    }

    @Test
    void mutateDiagnosesUpdateRoundtripRecordsUpdatedFields() {
        Map<String, Object> updateResponse = resource.mutateDiagnoses(
                request,
                Map.of(
                        "patientId", "00001",
                        "karteId", 1001L,
                        "operations", List.of(Map.of(
                                "operation", "update",
                                "diagnosisId", 55L,
                                "diagnosisName", "更新後病名",
                                "diagnosisCode", "E11",
                                "startDate", "2026-04-11",
                                "outcome", "継続",
                                "category", "副病名"))));

        assertEquals(List.of(55L), updateResponse.get("updatedDiagnosisIds"));
        RegisteredDiagnosisModel updated = karteServiceBean.getLastUpdatedDiagnosis();
        assertEquals(55L, updated.getId());
        assertEquals("更新後病名", updated.getDiagnosis());
        assertEquals("E11", updated.getDiagnosisCode());
        assertEquals("継続", updated.getOutcome());
        assertEquals("副病名", updated.getCategory());
        assertEquals("2026-04-11", open.dolphin.infomodel.ModelUtils.getDateAsString(updated.getStarted()));
    }

    @Test
    void mutateDiagnosesDateOnlyInputIsPersistedAndReadBack() {
        resource.mutateDiagnoses(
                request,
                Map.of(
                        "patientId", "00001",
                        "karteId", 1001L,
                        "operations", List.of(Map.of(
                                "operation", "create",
                                "diagnosisId", -1L,
                                "diagnosisName", "日付のみ病名",
                                "startDate", "2026-04-10",
                                "endDate", "2026-04-20"))));

        RegisteredDiagnosisModel created = karteServiceBean.getLastAddedDiagnosis();
        assertEquals("2026-04-10", open.dolphin.infomodel.ModelUtils.getDateAsString(created.getStarted()));
        assertEquals("2026-04-20", open.dolphin.infomodel.ModelUtils.getDateAsString(created.getEnded()));

        Map<String, Object> readback = resource.getDiagnoses(request, "00001", "2026-04-01", null, false);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> diseases = (List<Map<String, Object>>) readback.get("diseases");
        assertEquals("2026-04-10", diseases.get(0).get("startDate"));
        assertEquals("2026-04-20", diseases.get(0).get("endDate"));
    }

    @Test
    void mutateDiagnosesRejectsInvalidDatesWithBadRequest() {
        WebApplicationException exception = assertThrows(WebApplicationException.class, () -> resource.mutateDiagnoses(
                request,
                Map.of(
                        "patientId", "00001",
                        "karteId", 1001L,
                        "operations", List.of(Map.of(
                                "operation", "create",
                                "diagnosisId", -1L,
                                "diagnosisName", "不正日付病名",
                                "startDate", "not-a-date",
                                "endDate", "still-not-a-date")))));
        assertEquals(400, exception.getResponse().getStatus());
    }

    @Test
    void mutateDiagnosesRejectsUnknownOutcomeWithBadRequest() {
        WebApplicationException exception = assertThrows(WebApplicationException.class, () -> resource.mutateDiagnoses(
                request,
                Map.of(
                        "patientId", "00001",
                        "karteId", 1001L,
                        "operations", List.of(Map.of(
                                "operation", "create",
                                "diagnosisId", -1L,
                                "diagnosisName", "未知転帰病名",
                                "startDate", "2026-04-10",
                                "outcome", "想定外の転帰")))));
        assertEquals(400, exception.getResponse().getStatus());
    }

    @Test
    void mutateDiagnosesRejectsEndDateBeforeStartDateWithBadRequest() {
        WebApplicationException exception = assertThrows(WebApplicationException.class, () -> resource.mutateDiagnoses(
                request,
                Map.of(
                        "patientId", "00001",
                        "karteId", 1001L,
                        "operations", List.of(Map.of(
                                "operation", "create",
                                "diagnosisId", -1L,
                                "diagnosisName", "逆転日付病名",
                                "startDate", "2026-04-20",
                                "endDate", "2026-04-10")))));
        assertEquals(400, exception.getResponse().getStatus());
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
        private List<Long> removedDiagnosisIds = List.of();

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

        @Override
        public List<Long> addDiagnosis(List<RegisteredDiagnosisModel> addList) {
            if (addList == null || addList.isEmpty()) {
                return List.of();
            }
            List<Long> ids = new ArrayList<>();
            for (RegisteredDiagnosisModel diagnosis : addList) {
                long id = 101L + diagnoses.size();
                diagnosis.setId(id);
                diagnoses.add(diagnosis);
                ids.add(id);
            }
            return ids;
        }

        @Override
        public int updateDiagnosis(List<RegisteredDiagnosisModel> updateList) {
            if (updateList == null || updateList.isEmpty()) {
                return 0;
            }
            diagnoses.addAll(updateList);
            return updateList.size();
        }

        @Override
        public int removeDiagnosis(List<Long> removeList) {
            removedDiagnosisIds = removeList != null ? List.copyOf(removeList) : List.of();
            diagnoses.removeIf(diagnosis -> removedDiagnosisIds.contains(diagnosis.getId()));
            return removedDiagnosisIds.size();
        }

        @Override
        public String findFacilityIdByDiagnosisId(long diagnosisId) {
            return diagnosisId == 55L || diagnosisId >= 101L ? "F001" : null;
        }

        RegisteredDiagnosisModel getLastAddedDiagnosis() {
            return diagnoses.get(diagnoses.size() - 1);
        }

        RegisteredDiagnosisModel getLastUpdatedDiagnosis() {
            return diagnoses.get(diagnoses.size() - 1);
        }

        List<Long> getRemovedDiagnosisIds() {
            return removedDiagnosisIds;
        }
    }

    private static final class StubUserServiceBean extends UserServiceBean {
        @Override
        public UserModel getUser(String userId) {
            UserModel user = new UserModel();
            user.setUserId(userId);
            return user;
        }
    }

    private static final class StubOrcaTransport implements OrcaTransport {
        private final String body;
        private String facilityId;
        private OrcaEndpoint endpoint;
        private String requestBody;

        StubOrcaTransport(String body) {
            this.body = body;
        }

        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            this.facilityId = facilityId;
            this.endpoint = endpoint;
            this.requestBody = request != null ? request.getBody() : null;
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
    }

    private static final class FailingOrcaTransport implements OrcaTransport {
        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            throw new RuntimeException("https://orca.internal.example/basic-secret");
        }
    }
}
