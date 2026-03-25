package open.dolphin.rest.orca;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.LocalDate;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.orca.service.DiseaseProjectionService;
import open.dolphin.rest.dto.orca.DiseaseImportResponse;
import open.dolphin.rest.dto.orca.DiseaseMutationRequest;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import open.orca.rest.ORCAConnection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OrcaDiseaseResourceTest extends RuntimeDelegateTestSupport {

    private OrcaDiseaseResource resource;
    private RecordingSessionAuditDispatcher auditDispatcher;
    private HttpServletRequest servletRequest;

    @BeforeEach
    void setUp() throws Exception {
        resetFixture();
    }

    private void resetFixture() throws Exception {
        resource = new OrcaDiseaseResource();
        auditDispatcher = new RecordingSessionAuditDispatcher();
        injectField(resource, "sessionAuditDispatcher", auditDispatcher);
        injectField(resource, "patientServiceBean", new FakePatientServiceBean());
        injectField(resource, "karteServiceBean", new FakeKarteServiceBean());
        injectField(resource, "userServiceBean", new FakeUserServiceBean());
        injectField(resource, "diseaseProjectionService", new DiseaseProjectionService());

        servletRequest = (HttpServletRequest)
                Proxy.newProxyInstance(getClass().getClassLoader(), new Class[]{HttpServletRequest.class}, (proxy, method, args) -> {
                    String name = method.getName();
                    if ("getRemoteUser".equals(name)) {
                        return "F001:doctor01";
                    }
                    if ("getRemoteAddr".equals(name)) {
                        return "127.0.0.1";
                    }
                    if ("getRequestURI".equals(name)) {
                        return "/api/orca/disease";
                    }
                    if ("isSecure".equals(name)) {
                        return false;
                    }
                    if ("getScheme".equals(name)) {
                        return "http";
                    }
                    if ("getServerName".equals(name)) {
                        return "localhost";
                    }
                    if ("getServerPort".equals(name)) {
                        return 8080;
                    }
                    if ("getHeader".equals(name) && args != null && args.length == 1) {
                        String header = String.valueOf(args[0]);
                        return switch (header) {
                            case "X-Request-Id" -> "req-disease-mutation";
                            case "X-Trace-Id" -> "trace-disease-mutation";
                            case "User-Agent" -> "JUnit";
                            default -> null;
                        };
                    }
                    return null;
                });
    }

    @Test
    void postDiseaseRejectsBlankDiagnosisName() throws Exception {
        List<Object[]> cases = List.of(
                new Object[]{"create", null},
                new Object[]{"create", ""},
                new Object[]{"create", "  "},
                new Object[]{"update", null},
                new Object[]{"update", ""},
                new Object[]{"update", "  "});

        for (Object[] testCase : cases) {
            resetFixture();
            String operation = (String) testCase[0];
            String diagnosisName = (String) testCase[1];
            DiseaseMutationRequest payload = new DiseaseMutationRequest();
            payload.setPatientId("00001");
            DiseaseMutationRequest.MutationEntry entry = new DiseaseMutationRequest.MutationEntry();
            entry.setOperation(operation);
            entry.setDiagnosisName(diagnosisName);
            entry.setStartDate("2025-01-01");
            if ("update".equals(operation)) {
                entry.setDiagnosisId(100L);
            }
            payload.setOperations(List.of(entry));

            WebApplicationException exception = catchThrowableOfType(
                    () -> resource.postDisease(servletRequest, payload), WebApplicationException.class);
            assertNotNull(exception);
            Response response = exception.getResponse();
            assertNotNull(response);
            assertEquals(400, response.getStatus());
            Map<String, Object> body = getErrorBody(exception);
            assertEquals(Boolean.TRUE, body.get("validationError"));
            assertEquals("diagnosisName", body.get("field"));
            assertEquals("invalid_request", body.get("error"));
            assertEquals("invalid_request", body.get("code"));
            assertEquals("diagnosisName is required", body.get("message"));
            assertEquals(400, body.get("status"));

            assertNotNull(auditDispatcher.payload);
            assertEquals("ORCA_DISEASE_MUTATION", auditDispatcher.payload.getAction());
            Map<String, Object> details = auditDispatcher.payload.getDetails();
            assertEquals("F001", details.get("facilityId"));
            assertEquals("00001", details.get("patientId"));
            assertEquals(Boolean.TRUE, details.get("validationError"));
            assertEquals("diagnosisName", details.get("field"));
            assertEquals(operation, details.get("operation"));
            assertEquals("invalid_request", details.get("errorCode"));
            assertEquals("diagnosisName is required", details.get("errorMessage"));
            assertEquals(400, details.get("httpStatus"));
            assertEquals("failed", details.get("status"));
            assertEquals(AuditEventEnvelope.Outcome.FAILURE, auditDispatcher.outcome);
        }
    }

    @Test
    void postDiseaseAllowsBlankDiagnosisNameOnDelete() {
        DiseaseMutationRequest payload = new DiseaseMutationRequest();
        payload.setPatientId("00001");
        DiseaseMutationRequest.MutationEntry entry = new DiseaseMutationRequest.MutationEntry();
        entry.setOperation("delete");
        entry.setDiagnosisId(200L);
        entry.setDiagnosisName("");
        payload.setOperations(List.of(entry));

        assertNotNull(resource.postDisease(servletRequest, payload));
        assertNotNull(auditDispatcher.payload);
        assertEquals("ORCA_DISEASE_MUTATION", auditDispatcher.payload.getAction());
        Map<String, Object> details = auditDispatcher.payload.getDetails();
        assertEquals(1, details.get("removed"));
        assertEquals(AuditEventEnvelope.Outcome.SUCCESS, auditDispatcher.outcome);
    }

    @Test
    void postDiseaseRejectsInvalidStartDate() {
        DiseaseMutationRequest payload = new DiseaseMutationRequest();
        payload.setPatientId("00001");
        DiseaseMutationRequest.MutationEntry entry = new DiseaseMutationRequest.MutationEntry();
        entry.setOperation("create");
        entry.setDiagnosisName("テスト病名");
        entry.setStartDate("2025/01/01");
        payload.setOperations(List.of(entry));

        WebApplicationException exception = catchThrowableOfType(
                () -> resource.postDisease(servletRequest, payload), WebApplicationException.class);
        assertNotNull(exception);
        assertEquals(400, exception.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(exception);
        assertEquals(Boolean.TRUE, body.get("validationError"));
        assertEquals("startDate", body.get("field"));
        assertEquals("startDate must be yyyy-MM-dd", body.get("message"));

        assertNotNull(auditDispatcher.payload);
        assertEquals("ORCA_DISEASE_MUTATION", auditDispatcher.payload.getAction());
        Map<String, Object> details = auditDispatcher.payload.getDetails();
        assertEquals(Boolean.TRUE, details.get("validationError"));
        assertEquals("startDate", details.get("field"));
        assertEquals("create", details.get("operation"));
        assertEquals("invalid_request", details.get("errorCode"));
        assertEquals("startDate must be yyyy-MM-dd", details.get("errorMessage"));
        assertEquals(400, details.get("httpStatus"));
        assertEquals(AuditEventEnvelope.Outcome.FAILURE, auditDispatcher.outcome);
    }

    @Test
    void postDiseaseSkipsNullOperationEntries() {
        DiseaseMutationRequest payload = new DiseaseMutationRequest();
        payload.setPatientId("00001");
        DiseaseMutationRequest.MutationEntry emptyEntry = new DiseaseMutationRequest.MutationEntry();
        DiseaseMutationRequest.MutationEntry validEntry = new DiseaseMutationRequest.MutationEntry();
        validEntry.setOperation("create");
        validEntry.setDiagnosisName("テスト病名");
        validEntry.setStartDate("2025-01-01");
        payload.setOperations(Arrays.asList(null, emptyEntry, validEntry));

        assertNotNull(resource.postDisease(servletRequest, payload));
        assertNotNull(auditDispatcher.payload);
        assertEquals("ORCA_DISEASE_MUTATION", auditDispatcher.payload.getAction());
        Map<String, Object> details = auditDispatcher.payload.getDetails();
        assertEquals(1, details.get("created"));
        assertEquals(AuditEventEnvelope.Outcome.SUCCESS, auditDispatcher.outcome);
    }

    @Test
    void getDiseasesReturns404WhenKarteMissingWithApiResult() throws Exception {
        resetFixture();
        injectField(resource, "karteServiceBean", new NullKarteServiceBean());

        WebApplicationException ex = catchThrowableOfType(
                () -> resource.getDiseases(servletRequest, "00001", null, null, false),
                WebApplicationException.class);

        assertNotNull(ex);
        assertEquals(404, ex.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(ex);
        assertEquals("karte_not_found", body.get("error"));
        assertEquals("10", body.get("apiResult"));
        assertEquals("該当データなし", body.get("apiResultMessage"));
        assertEquals("karte", body.get("precondition"));
        assertEquals("missing", body.get("preconditionStatus"));
    }

    @Test
    void getDiseasesFailsClosedWhenOrcaDatasourceUnavailable() throws Exception {
        resetFixture();
        injectField(resource, "orcaConnection", new UnavailableOrcaConnection());

        WebApplicationException ex = catchThrowableOfType(
                () -> resource.getDiseases(servletRequest, "00001", null, null, false),
                WebApplicationException.class);

        assertNotNull(ex);
        assertEquals(503, ex.getResponse().getStatus());
        DiseaseImportResponse body = (DiseaseImportResponse) ex.getResponse().getEntity();
        assertNotNull(body);
        assertEquals("E90", body.getApiResult());
        assertEquals("orca_datasource_unavailable", body.getErrorCode());
        assertEquals("ORCA datasource is unavailable", body.getErrorMessage());
        assertNotNull(auditDispatcher.payload);
        assertEquals(AuditEventEnvelope.Outcome.FAILURE, auditDispatcher.outcome);
        assertThat(auditDispatcher.payload.getDetails()).containsEntry("status", "orca_unavailable");
    }

    @Test
    void postDiseaseReturns404WhenKarteMissing() throws Exception {
        resetFixture();
        injectField(resource, "karteServiceBean", new NullKarteServiceBean());

        DiseaseMutationRequest payload = new DiseaseMutationRequest();
        payload.setPatientId("00001");
        DiseaseMutationRequest.MutationEntry entry = new DiseaseMutationRequest.MutationEntry();
        entry.setOperation("create");
        entry.setDiagnosisName("テスト病名");
        payload.setOperations(List.of(entry));

        WebApplicationException ex = catchThrowableOfType(
                () -> resource.postDisease(servletRequest, payload),
                WebApplicationException.class);

        assertNotNull(ex);
        assertEquals(404, ex.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(ex);
        assertEquals("karte_not_found", body.get("error"));
        assertEquals("10", body.get("apiResult"));
        assertEquals("該当データなし", body.get("apiResultMessage"));
        assertEquals("karte", body.get("precondition"));
        assertEquals("missing", body.get("preconditionStatus"));
    }

    @Test
    void formatDateIsThreadSafe() throws Exception {
        resetFixture();
        var method = OrcaDiseaseResource.class.getDeclaredMethod("formatDate", Date.class);
        method.setAccessible(true);
        Date target = new Date(1735603200000L); // 2024-12-31T00:00:00Z

        var executor = Executors.newFixedThreadPool(8);
        List<Future<String>> futures = new ArrayList<>();
        for (int i = 0; i < 300; i++) {
            futures.add(executor.submit(() -> (String) method.invoke(resource, target)));
        }
        for (Future<String> f : futures) {
            assertEquals("2024-12-31", f.get());
        }
        executor.shutdown();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> getErrorBody(WebApplicationException exception) {
        return (Map<String, Object>) exception.getResponse().getEntity();
    }

    private static void injectField(Object target, String fieldName, Object value) throws Exception {
        Class<?> type = target.getClass();
        Field field = null;
        while (type != null && field == null) {
            try {
                field = type.getDeclaredField(fieldName);
            } catch (NoSuchFieldException ignored) {
                type = type.getSuperclass();
            }
        }
        if (field == null) {
            throw new NoSuchFieldException(fieldName);
        }
        field.setAccessible(true);
        field.set(target, value);
    }

    private static final class RecordingSessionAuditDispatcher extends SessionAuditDispatcher {
        private AuditEventPayload payload;
        private AuditEventEnvelope.Outcome outcome;

        @Override
        public AuditEventEnvelope record(AuditEventPayload payload, AuditEventEnvelope.Outcome overrideOutcome,
                String errorCode, String errorMessage) {
            this.payload = payload;
            this.outcome = overrideOutcome;
            return null;
        }
    }

    private static final class FakePatientServiceBean extends PatientServiceBean {
        @Override
        public PatientModel getPatientById(String fid, String pid) {
            PatientModel patient = new PatientModel();
            patient.setPatientId(pid);
            patient.setFullName("テスト患者");
            patient.setKanaName("テスト");
            patient.setBirthday(LocalDate.parse("1990-01-01"));
            patient.setGender("F");
            return patient;
        }
    }

    private static final class FakeKarteServiceBean extends KarteServiceBean {
        @Override
        public KarteBean getKarte(String facilityId, String patientId, Date fromDate) {
            KarteBean karte = new KarteBean();
            karte.setId(20L);
            return karte;
        }

        @Override
        public List<Long> addDiagnosis(List<open.dolphin.infomodel.RegisteredDiagnosisModel> addList) {
            List<Long> ids = new ArrayList<>();
            long seed = 1000L;
            for (int i = 0; i < addList.size(); i++) {
                ids.add(seed + i);
            }
            return ids;
        }

        @Override
        public int updateDiagnosis(List<open.dolphin.infomodel.RegisteredDiagnosisModel> updateList) {
            return updateList.size();
        }

        @Override
        public int removeDiagnosis(List<Long> removeList) {
            return removeList.size();
        }
    }

    private static final class NullKarteServiceBean extends KarteServiceBean {
        @Override
        public KarteBean getKarte(String facilityId, String patientId, Date fromDate) {
            return null;
        }
    }

    private static final class FakeUserServiceBean extends UserServiceBean {
        @Override
        public UserModel getUser(String userId) {
            UserModel user = new UserModel();
            user.setUserId(userId);
            user.setCommonName("テスト医師");
            return user;
        }
    }

    private static final class UnavailableOrcaConnection extends ORCAConnection {
        @Override
        public java.sql.Connection getConnection() throws java.sql.SQLException {
            throw new java.sql.SQLException("ORCA datasource unavailable");
        }
    }
}
