package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.time.LocalDate;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.ProgressCourse;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.orca.SubjectiveEntryRequest;
import open.dolphin.rest.dto.orca.SubjectiveEntryResponse;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LocalChartSubjectiveResourceTest extends RuntimeDelegateTestSupport {

    private LocalChartSubjectiveResource resource;
    private FakePatientServiceBean fakePatientServiceBean;
    private FakeKarteServiceBean fakeKarteServiceBean;
    private HttpServletRequest servletRequest;

    @BeforeEach
    void setUp() throws Exception {
        resource = new LocalChartSubjectiveResource();
        fakePatientServiceBean = new FakePatientServiceBean();
        fakeKarteServiceBean = new FakeKarteServiceBean();

        injectField(resource, "sessionAuditDispatcher", new RecordingSessionAuditDispatcher());
        injectField(resource, "patientServiceBean", fakePatientServiceBean);
        injectField(resource, "karteServiceBean", fakeKarteServiceBean);
        injectField(resource, "userServiceBean", new FakeUserServiceBean());

        Map<String, Object> attributes = new HashMap<>();
        servletRequest = (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("getRemoteUser".equals(name)) {
                        return "F001:doctor01";
                    }
                    if ("getRemoteAddr".equals(name)) {
                        return "127.0.0.1";
                    }
                    if ("getRequestURI".equals(name)) {
                        return "/api/local/charts/subjectives";
                    }
                    if ("getAttribute".equals(name) && args != null && args.length == 1) {
                        return attributes.get(args[0]);
                    }
                    if ("setAttribute".equals(name) && args != null && args.length == 2) {
                        attributes.put(String.valueOf(args[0]), args[1]);
                        return null;
                    }
                    if ("removeAttribute".equals(name) && args != null && args.length == 1) {
                        attributes.remove(String.valueOf(args[0]));
                        return null;
                    }
                    if ("getHeader".equals(name) && args != null && args.length == 1) {
                        String header = String.valueOf(args[0]);
                        return switch (header) {
                            case "X-Request-Id" -> "req-subjective";
                            case "X-Trace-Id" -> "trace-subjective";
                            case "X-Run-Id" -> "20260302T132537Z";
                            case "User-Agent" -> "JUnit";
                            default -> null;
                        };
                    }
                    return null;
                });
    }

    @Test
    void postSubjectiveReturns400WhenSoapCategoryIsMissing() {
        SubjectiveEntryRequest payload = new SubjectiveEntryRequest();
        payload.setPatientId("00001");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.postSubjective(servletRequest, payload));

        assertValidationError(ex, "soapCategory");
        assertEquals(0, fakeKarteServiceBean.getAddDocumentCalls());
    }

    @Test
    void postSubjectivePersistsDocumentInRealMode() {
        SubjectiveEntryRequest payload = new SubjectiveEntryRequest();
        payload.setPatientId("00001");
        payload.setSoapCategory("S");
        payload.setDisplaySection("free");
        payload.setPerformDate("2026-04-10");
        payload.setBody("咽頭痛あり");

        SubjectiveEntryResponse response = resource.postSubjective(servletRequest, payload);

        assertNotNull(response);
        assertEquals("00", response.getApiResult());
        assertEquals("local", response.getRouteNamespace());
        assertNotNull(response.getEntry());
        assertEquals(Long.valueOf(9001L), response.getEntry().getDocumentId());
        assertEquals("00001", response.getEntry().getPatientId());
        assertEquals("2026-04-10", response.getEntry().getPerformDate());
        assertEquals("S", response.getEntry().getSoapCategory());
        assertEquals("free", response.getEntry().getDisplaySection());
        assertEquals("咽頭痛あり", response.getEntry().getBody());
        assertEquals("doctor01", response.getEntry().getAuthorName());
        assertEquals(1, fakeKarteServiceBean.getAddDocumentCalls());

        DocumentModel saved = fakeKarteServiceBean.getLastAddedDocument();
        assertNotNull(saved);
        assertNotNull(saved.getDocInfoModel());
        assertEquals("主訴", saved.getDocInfoModel().getTitle());
        assertEquals(IInfoModel.DOCTYPE_KARTE, saved.getDocInfoModel().getDocType());
        assertEquals(IInfoModel.PURPOSE_RECORD, saved.getDocInfoModel().getPurpose());
        assertEquals("2026-04-10", open.dolphin.infomodel.ModelUtils.getDateAsString(saved.getStarted()));
        assertNotNull(saved.getModules());
        assertEquals(1, saved.getModules().size());

        ModuleModel module = saved.getModules().get(0);
        assertEquals(IInfoModel.MODULE_PROGRESS_COURSE, module.getModuleInfoBean().getEntity());
        assertEquals(IInfoModel.ROLE_SOA_SPEC, module.getModuleInfoBean().getStampRole());
        assertNotNull(module.getBeanJson());
        assertTrue(module.getBeanJson().contains("\"schemaVersion\":1"));
        assertTrue(module.getBeanJson().contains("\"moduleType\":\"progressCourse\""));
        assertNotNull(module.getModel());
        assertTrue(module.getModel() instanceof ProgressCourse);
        ProgressCourse progress = (ProgressCourse) module.getModel();
        assertEquals("咽頭痛あり", progress.getFreeText());
    }

    @Test
    void postSubjectivePersistsPlanCategoryWithPlanStampRole() {
        SubjectiveEntryRequest payload = new SubjectiveEntryRequest();
        payload.setPatientId("00001");
        payload.setSoapCategory("P");
        payload.setPerformDate("2026-04-11");
        payload.setBody("処方継続");

        SubjectiveEntryResponse response = resource.postSubjective(servletRequest, payload);

        assertEquals("00", response.getApiResult());
        DocumentModel saved = fakeKarteServiceBean.getLastAddedDocument();
        assertNotNull(saved);
        assertEquals("2026-04-11", open.dolphin.infomodel.ModelUtils.getDateAsString(saved.getStarted()));
        ModuleModel module = saved.getModules().get(0);
        assertEquals(IInfoModel.ROLE_P_SPEC, module.getModuleInfoBean().getStampRole());
        ProgressCourse progress = (ProgressCourse) module.getModel();
        assertEquals("処方継続", progress.getFreeText());
    }

    @Test
    void postSubjectiveReturnsSafeConfigurationRequiredWhenDocumentIntegrityConfigIsMissing() {
        fakeKarteServiceBean.setFailure(new IllegalStateException("document.integrity.mode must be enforce"));
        SubjectiveEntryRequest payload = validSubjectiveRequest();

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.postSubjective(servletRequest, payload));

        assertSafePersistenceError(ex, "configuration_required", false);
    }

    @Test
    void postSubjectiveReturnsSafeDocumentIntegrityUnavailableForIntegrityRuntimeFailure() {
        fakeKarteServiceBean.setFailure(new IllegalStateException("document integrity active key is not configured"));
        SubjectiveEntryRequest payload = validSubjectiveRequest();

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.postSubjective(servletRequest, payload));

        assertSafePersistenceError(ex, "document_integrity_unavailable", false);
    }

    @Test
    void postSubjectiveReturnsSafeRetryableServerErrorForUnexpectedPersistenceFailure() {
        fakeKarteServiceBean.setFailure(new IllegalStateException("database temporarily unavailable"));
        SubjectiveEntryRequest payload = validSubjectiveRequest();

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.postSubjective(servletRequest, payload));

        assertSafePersistenceError(ex, "retryable_server_error", true);
    }

    @Test
    void postSubjectiveInvalidPerformDateReturns400WithoutPersisting() {
        SubjectiveEntryRequest payload = new SubjectiveEntryRequest();
        payload.setPatientId("00001");
        payload.setSoapCategory("S");
        payload.setPerformDate("not-a-date");
        payload.setBody("不正日付でも登録される現状確認");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.postSubjective(servletRequest, payload));

        assertValidationError(ex, "performDate");
        assertEquals(0, fakeKarteServiceBean.getAddDocumentCalls());
    }

    @Test
    void postSubjectiveReturns400WhenDisplaySectionDoesNotMatchSoapCategory() {
        SubjectiveEntryRequest payload = new SubjectiveEntryRequest();
        payload.setPatientId("00001");
        payload.setSoapCategory("O");
        payload.setDisplaySection("free");
        payload.setBody("free は S としてのみ保存できる");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.postSubjective(servletRequest, payload));

        assertValidationError(ex, "displaySection");
        assertEquals(0, fakeKarteServiceBean.getAddDocumentCalls());
    }

    @Test
    void postSubjectiveReturns400WhenPatientIdIsBlank() {
        SubjectiveEntryRequest payload = new SubjectiveEntryRequest();
        payload.setPatientId(" ");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.postSubjective(servletRequest, payload));

        assertValidationError(ex, "patientId");
    }

    @Test
    void postSubjectiveReturns400WhenSoapCategoryIsInvalid() {
        SubjectiveEntryRequest payload = new SubjectiveEntryRequest();
        payload.setPatientId("00001");
        payload.setSoapCategory("X");
        payload.setBody("主訴テキスト");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.postSubjective(servletRequest, payload));

        assertValidationError(ex, "soapCategory");
    }

    @Test
    void postSubjectiveReturns400WhenBodyIsBlank() {
        SubjectiveEntryRequest payload = new SubjectiveEntryRequest();
        payload.setPatientId("00001");
        payload.setSoapCategory("S");
        payload.setBody(" ");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.postSubjective(servletRequest, payload));

        assertValidationError(ex, "body");
    }

    @Test
    void postSubjectiveReturns400WhenBodyTooLong() {
        SubjectiveEntryRequest payload = new SubjectiveEntryRequest();
        payload.setPatientId("00001");
        payload.setSoapCategory("S");
        payload.setBody("a".repeat(1001));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.postSubjective(servletRequest, payload));

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
        assertNotNull(body);
        assertEquals(400, ex.getResponse().getStatus());
        assertEquals("invalid_request", body.get("error"));
        assertEquals(Boolean.TRUE, body.get("validationError"));
    }

    @SuppressWarnings("unchecked")
    private static void assertValidationError(WebApplicationException ex, String field) {
        assertNotNull(ex);
        assertEquals(400, ex.getResponse().getStatus());
        Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
        assertNotNull(body);
        assertEquals("invalid_request", body.get("error"));
        assertEquals(field, body.get("field"));
        assertEquals(Boolean.TRUE, body.get("validationError"));
    }

    @SuppressWarnings("unchecked")
    private static void assertSafePersistenceError(WebApplicationException ex, String classification,
            boolean retryable) {
        assertNotNull(ex);
        assertEquals(503, ex.getResponse().getStatus());
        Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
        assertNotNull(body);
        assertEquals(classification, body.get("error"));
        assertEquals(classification, body.get("code"));
        assertEquals(classification, body.get("classification"));
        assertEquals(Boolean.valueOf(retryable), body.get("retryable"));
        assertEquals("20260302T132537Z", body.get("runId"));
        String serialized = body.toString();
        assertTrue(!serialized.contains("document.integrity.mode"));
        assertTrue(!serialized.contains("database temporarily unavailable"));
        assertTrue(!serialized.contains("active key"));
    }

    private static SubjectiveEntryRequest validSubjectiveRequest() {
        SubjectiveEntryRequest payload = new SubjectiveEntryRequest();
        payload.setPatientId("00001");
        payload.setSoapCategory("S");
        payload.setDisplaySection("free");
        payload.setPerformDate("2026-04-10");
        payload.setBody("咽頭痛あり");
        return payload;
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
        @Override
        public AuditEventEnvelope record(AuditEventPayload payload, AuditEventEnvelope.Outcome overrideOutcome,
                String errorCode, String errorMessage) {
            return null;
        }
    }

    private static final class FakePatientServiceBean extends PatientServiceBean {
        private final PatientModel patient;
        private final KarteBean karte;

        private FakePatientServiceBean() {
            patient = new PatientModel();
            patient.setId(100L);
            patient.setFacilityId("F001");
            patient.setPatientId("00001");
            patient.setFullName("テスト患者");
            patient.setKanaName("テスト");
            patient.setBirthday(LocalDate.parse("1990-01-01"));
            patient.setGender("F");

            karte = new KarteBean();
            karte.setId(20L);
            karte.setPatient(patient);
        }

        @Override
        public PatientModel getPatientById(String fid, String pid) {
            if (!"00001".equals(pid)) {
                return null;
            }
            return patient;
        }

        @Override
        public KarteBean ensureKarteByPatientPk(long patientPk) {
            if (patientPk != patient.getId()) {
                return null;
            }
            return karte;
        }
    }

    private static final class FakeKarteServiceBean extends KarteServiceBean {
        private int addDocumentCalls;
        private DocumentModel lastAddedDocument;
        private RuntimeException failure;

        int getAddDocumentCalls() {
            return addDocumentCalls;
        }

        DocumentModel getLastAddedDocument() {
            return lastAddedDocument;
        }

        void setFailure(RuntimeException failure) {
            this.failure = failure;
        }

        @Override
        public long addDocument(DocumentModel document) {
            addDocumentCalls++;
            if (failure != null) {
                throw failure;
            }
            lastAddedDocument = document;
            return 9000L + addDocumentCalls;
        }
    }

    private static final class FakeUserServiceBean extends UserServiceBean {
        @Override
        public UserModel getUser(String uid) {
            if (uid == null || uid.isBlank()) {
                return null;
            }
            UserModel user = new UserModel();
            user.setId(300L);
            user.setUserId(uid);
            user.setCommonName("doctor01");
            return user;
        }
    }
}
