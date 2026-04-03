package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.rest.dto.orca.PrescriptionClaimComment;
import open.dolphin.rest.dto.orca.PrescriptionDrug;
import open.dolphin.rest.dto.orca.PrescriptionOrder;
import open.dolphin.rest.dto.orca.PrescriptionOrderSaveResponse;
import open.dolphin.rest.dto.orca.PrescriptionRp;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OrcaPrescriptionOrderResourceTest extends RuntimeDelegateTestSupport {

    private OrcaPrescriptionOrderResource resource;
    private FakePrescriptionOrderRepository fakeRepository;
    private HttpServletRequest servletRequest;

    @BeforeEach
    void setUp() throws Exception {
        resource = new OrcaPrescriptionOrderResource();
        fakeRepository = new FakePrescriptionOrderRepository();

        injectField(resource, "sessionAuditDispatcher", new RecordingSessionAuditDispatcher());
        injectField(resource, "patientServiceBean", new FakePatientServiceBean());
        injectField(resource, "prescriptionOrderRepository", fakeRepository);

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
                        return "/api/orca/prescription-orders";
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
                            case "X-Request-Id" -> "req-rx-save";
                            case "X-Trace-Id" -> "trace-rx-save";
                            case "X-Run-Id" -> "20260403T000000Z";
                            case "User-Agent" -> "JUnit";
                            default -> null;
                        };
                    }
                    return null;
                });
    }

    @Test
    void saveOrderReturns400WhenClaimCommentCodeIsMissing() {
        PrescriptionOrder payload = buildPayload(null, "コードなしコメント");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.saveOrder(servletRequest, payload));

        assertValidationError(ex, "rps[0].drugs[0].claimComments[0].code");
        assertEquals(0, fakeRepository.saveCalls);
    }

    @Test
    void saveOrderPersistsWhenClaimCommentCodeIsPresent() {
        PrescriptionOrder payload = buildPayload("810000001", "患者希望");

        PrescriptionOrderSaveResponse response = resource.saveOrder(servletRequest, payload);

        assertNotNull(response);
        assertEquals("00", response.getApiResult());
        assertEquals(1, fakeRepository.saveCalls);
        assertEquals(101L, response.getOrderId());
        assertEquals("00001", response.getPatientId());
    }

    private static PrescriptionOrder buildPayload(String commentCode, String commentText) {
        PrescriptionClaimComment claimComment = new PrescriptionClaimComment();
        claimComment.setCode(commentCode);
        claimComment.setText(commentText);

        PrescriptionDrug drug = new PrescriptionDrug();
        drug.setCode("620000001");
        drug.setName("アムロジピン");
        drug.setQuantity("1");
        drug.setUnit("錠");
        drug.setGenericChangeAllowed(Boolean.TRUE);
        drug.setGeneralNamePrescription(Boolean.FALSE);
        drug.setDrugComment("食後");
        drug.setPatientRequested(Boolean.TRUE);
        drug.setClaimComments(List.of(claimComment));

        PrescriptionRp rp = new PrescriptionRp();
        rp.setRpNumber("rp-1");
        rp.setBundleName("処方RP");
        rp.setMedicalClass("212");
        rp.setMedicalClassNumber("1");
        rp.setUsageName("1日1回");
        rp.setStarted("2026-04-03");
        rp.setDrugs(List.of(drug));

        PrescriptionOrder payload = new PrescriptionOrder();
        payload.setPatientId("00001");
        payload.setEncounterDate("2026-04-03");
        payload.setPerformDate("2026-04-03");
        payload.setRps(List.of(rp));
        return payload;
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
        @Override
        public PatientModel getPatientById(String fid, String pid) {
            PatientModel patient = new PatientModel();
            patient.setId(100L);
            patient.setFacilityId(fid);
            patient.setPatientId(pid);
            patient.setFullName("テスト患者");
            patient.setKanaName("テストカンジャ");
            patient.setBirthday(LocalDate.parse("1990-01-01"));
            return patient;
        }
    }

    private static final class FakePrescriptionOrderRepository extends PrescriptionOrderRepository {
        private int saveCalls;

        @Override
        long save(String facilityId, String patientId, String encounterId, LocalDate encounterDate, LocalDate performDate,
                String payloadJson, java.time.Instant createdAt, String createdBy) {
            saveCalls += 1;
            return 101L;
        }
    }
}
