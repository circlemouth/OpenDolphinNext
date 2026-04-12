package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.time.LocalDate;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.rest.dto.orca.MedicalGetRequest;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LocalChartMedicalResourceTest extends RuntimeDelegateTestSupport {

    private LocalChartMedicalResource resource;
    private HttpServletRequest servletRequest;

    @BeforeEach
    void setUp() throws Exception {
        resource = new LocalChartMedicalResource();
        injectField(resource, "sessionAuditDispatcher", new RecordingSessionAuditDispatcher());
        injectField(resource, "patientServiceBean", new FakePatientServiceBean());
        injectField(resource, "karteServiceBean", new NullKarteServiceBean());

        servletRequest = (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("getRemoteUser".equals(name)) {
                        return "F001:doctor01";
                    }
                    if ("getRequestURI".equals(name)) {
                        return "/api/local/charts/medical-records";
                    }
                    if ("getHeader".equals(name) && args != null && args.length == 1) {
                        return "trace-medical";
                    }
                    return null;
                });
    }

    @Test
    void returns404AndApiResultWhenKarteMissing() {
        MedicalGetRequest request = new MedicalGetRequest();
        request.setPatientId("00001");

        WebApplicationException ex = org.assertj.core.api.Assertions.catchThrowableOfType(
                () -> resource.postMedicalRecords(servletRequest, request),
                WebApplicationException.class);

        assertNotNull(ex);
        assertEquals(404, ex.getResponse().getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
        assertEquals("karte_not_found", body.get("error"));
        assertEquals("10", body.get("apiResult"));
        assertEquals("該当データなし", body.get("apiResultMessage"));
        assertEquals("karte", body.get("precondition"));
        assertEquals("missing", body.get("preconditionStatus"));
    }

    @Test
    void returns404WhenPatientMissing() throws Exception {
        resource = new LocalChartMedicalResource();
        injectField(resource, "sessionAuditDispatcher", new RecordingSessionAuditDispatcher());
        injectField(resource, "patientServiceBean", new MissingPatientServiceBean());
        injectField(resource, "karteServiceBean", new NullKarteServiceBean());

        MedicalGetRequest request = new MedicalGetRequest();
        request.setPatientId("00001");

        WebApplicationException ex = org.assertj.core.api.Assertions.catchThrowableOfType(
                () -> resource.postMedicalRecords(servletRequest, request),
                WebApplicationException.class);

        assertNotNull(ex);
        assertEquals(404, ex.getResponse().getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
        assertEquals("patient_not_found", body.get("error"));
        assertEquals("10", body.get("apiResult"));
        assertEquals("該当データなし", body.get("apiResultMessage"));
    }

    @Test
    void returns400WhenFromDateAfterToDate() {
        MedicalGetRequest request = new MedicalGetRequest();
        request.setPatientId("00001");
        request.setFromDate("2026-02-01");
        request.setToDate("2026-01-01");

        WebApplicationException ex = org.assertj.core.api.Assertions.catchThrowableOfType(
                () -> resource.postMedicalRecords(servletRequest, request),
                WebApplicationException.class);

        assertNotNull(ex);
        assertEquals(400, ex.getResponse().getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
        assertEquals("invalid_request", body.get("error"));
        assertEquals("fromDate", body.get("field"));
        assertEquals(Boolean.TRUE, body.get("validationError"));
    }

    @Test
    void dateFormatterIsThreadSafe() throws Exception {
        var method = LocalChartMedicalResource.class.getDeclaredMethod("formatDate", Date.class);
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

    private static final class RecordingSessionAuditDispatcher extends SessionAuditDispatcher {
        @Override
        public open.dolphin.audit.AuditEventEnvelope record(open.dolphin.security.audit.AuditEventPayload payload,
                open.dolphin.audit.AuditEventEnvelope.Outcome overrideOutcome,
                String errorCode, String errorMessage) {
            return null;
        }
    }

    private static void injectField(Object target, String fieldName, Object value) throws Exception {
        Class<?> type = target.getClass();
        java.lang.reflect.Field field = null;
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

    private static final class MissingPatientServiceBean extends PatientServiceBean {
        @Override
        public PatientModel getPatientById(String fid, String pid) {
            return null;
        }
    }

    private static final class NullKarteServiceBean extends KarteServiceBean {
        @Override
        public KarteBean getKarte(String facilityId, String patientId, Date fromDate) {
            return null;
        }

        @Override
        public List<DocInfoModel> getDocumentList(long karteId, Date fromDate, boolean confirmedOnly) {
            return List.of();
        }
    }
}
