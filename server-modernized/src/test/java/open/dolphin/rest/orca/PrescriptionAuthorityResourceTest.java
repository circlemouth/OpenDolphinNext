package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.rest.dto.orca.PrescriptionAuthorityMutationRequest;
import open.dolphin.rest.dto.orca.PrescriptionAuthorityMutationResponse;
import open.dolphin.rest.dto.orca.PrescriptionDrug;
import open.dolphin.rest.dto.orca.PrescriptionOrder;
import open.dolphin.rest.dto.orca.PrescriptionRp;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.AuthoritativeAuditRepository;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PrescriptionAuthorityResourceTest extends RuntimeDelegateTestSupport {

    private PrescriptionAuthorityResource resource;
    private FakePrescriptionAuthorityRepository repository;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() throws Exception {
        resource = new PrescriptionAuthorityResource();
        repository = new FakePrescriptionAuthorityRepository();
        injectField(resource, "sessionAuditDispatcher", new RecordingSessionAuditDispatcher());
        injectField(resource, "patientServiceBean", new FakePatientServiceBean());
        injectField(resource, "prescriptionAuthorityRepository", repository);
        injectField(resource, "authoritativeAuditRepository", new StubAuditRepository(true));
        request = request("/api/local/prescription-orders/authority");
    }

    @Test
    void createDraftUsesServerFacilityAndStructuredItems() {
        PrescriptionAuthorityMutationRequest payload = new PrescriptionAuthorityMutationRequest();
        payload.setPatientId("00001");
        payload.setEncounterId("ENC-001");
        payload.setChartRevisionId("CHART-REV-001");
        payload.setOrder(order("CLIENT-PATIENT", "CLIENT-ENCOUNTER"));

        PrescriptionAuthorityMutationResponse response = resource.createDraft(request, payload);

        assertEquals("00", response.getApiResult());
        assertEquals(101L, response.getPrescriptionId());
        assertEquals("DRAFT", response.getStatus());
        assertEquals("F001", repository.facilityId);
        assertEquals("00001", repository.patientId);
        assertEquals("ENC-001", repository.encounterId);
        assertEquals("00001", repository.order.getPatientId());
        assertEquals("ENC-001", repository.order.getEncounterId());
    }

    @Test
    void changeRequiresReasonAndOrder() {
        PrescriptionAuthorityMutationRequest payload = new PrescriptionAuthorityMutationRequest();
        payload.setOrder(order("00001", "ENC-001"));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.change(request, 101L, payload));

        assertEquals(400, ex.getResponse().getStatus());
        assertTrue(String.valueOf(ex.getResponse().getEntity()).contains("reasonText"));
        assertEquals(0, repository.transitionCalls);
    }

    @Test
    void stopCreatesAppendOnlyEventWithoutClientOrderAuthority() {
        PrescriptionAuthorityMutationRequest payload = new PrescriptionAuthorityMutationRequest();
        payload.setPatientId("TAMPERED");
        payload.setReasonText("adverse event");

        PrescriptionAuthorityMutationResponse response = resource.stop(request, 101L, payload);

        assertEquals("STOPPED", response.getStatus());
        assertEquals("STOP", repository.eventType);
        assertEquals("STOPPED", repository.status);
        assertEquals("P-SERVER", response.getPatientId());
        assertEquals("adverse event", repository.reasonText);
    }

    @Test
    void resendRecordsAppendOnlyEventWithoutChangingPrescriptionStatus() {
        PrescriptionAuthorityMutationRequest payload = new PrescriptionAuthorityMutationRequest();
        payload.setReasonText("UNKNOWN reconciliation confirmed no duplicate");

        PrescriptionAuthorityMutationResponse response = resource.resend(request, 101L, payload);

        assertEquals("FINAL", response.getStatus());
        assertEquals("RESEND", repository.eventType);
        assertEquals("UNKNOWN reconciliation confirmed no duplicate", repository.reasonText);
    }

    @Test
    void finalizeReturns409WhenOrderIsNotDraft() {
        repository.finalizeFailure = new IllegalStateException("prescription_order_not_draft");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.finalizeDraft(request, 101L, new PrescriptionAuthorityMutationRequest()));

        assertEquals(409, ex.getResponse().getStatus());
        assertTrue(String.valueOf(ex.getResponse().getEntity()).contains("prescription_order_not_draft"));
    }

    @Test
    void mutationsFailClosedWhenAuditWritePathIsUnavailable() throws Exception {
        injectField(resource, "authoritativeAuditRepository", new StubAuditRepository(false));
        PrescriptionAuthorityMutationRequest payload = new PrescriptionAuthorityMutationRequest();
        payload.setPatientId("00001");
        payload.setOrder(order("00001", "ENC-001"));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.createDraft(request, payload));

        assertEquals(503, ex.getResponse().getStatus());
        assertTrue(String.valueOf(ex.getResponse().getEntity()).contains("audit_log_write_unavailable"));
        assertEquals(0, repository.createCalls);
    }

    private static PrescriptionOrder order(String patientId, String encounterId) {
        PrescriptionDrug drug = new PrescriptionDrug();
        drug.setCode("620000001");
        drug.setName("Structured Drug");
        drug.setQuantity("1");
        drug.setUnit("tablet");
        PrescriptionRp rp = new PrescriptionRp();
        rp.setUsageCode("001");
        rp.setUsageName("after meal");
        rp.setDrugs(List.of(drug));
        PrescriptionOrder order = new PrescriptionOrder();
        order.setPatientId(patientId);
        order.setEncounterId(encounterId);
        order.setEncounterDate("2026-05-10");
        order.setRps(List.of(rp));
        return order;
    }

    private HttpServletRequest request(String uri) {
        Map<String, Object> attributes = new HashMap<>();
        return (HttpServletRequest) Proxy.newProxyInstance(
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
                        return uri;
                    }
                    if ("getAttribute".equals(name) && args != null && args.length == 1) {
                        return attributes.get(args[0]);
                    }
                    if ("setAttribute".equals(name) && args != null && args.length == 2) {
                        attributes.put(String.valueOf(args[0]), args[1]);
                        return null;
                    }
                    if ("getHeader".equals(name) && args != null && args.length == 1) {
                        return switch (String.valueOf(args[0])) {
                            case "X-Run-Id" -> "20260510T211441Z";
                            case "User-Agent" -> "JUnit";
                            default -> null;
                        };
                    }
                    return null;
                });
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

    private static final class FakePrescriptionAuthorityRepository extends PrescriptionAuthorityRepository {
        private int createCalls;
        private int transitionCalls;
        private String facilityId;
        private String patientId;
        private String encounterId;
        private PrescriptionOrder order;
        private String status;
        private String eventType;
        private String reasonText;
        private IllegalStateException finalizeFailure;

        @Override
        PrescriptionMutationResult createDraft(String facilityId, String patientId, String encounterId,
                String chartRevisionId, PrescriptionOrder order, String actor, Instant now) {
            createCalls += 1;
            this.facilityId = facilityId;
            this.patientId = patientId;
            this.encounterId = encounterId;
            this.order = order;
            return new PrescriptionMutationResult(101L, 201L, "DRAFT", null, patientId, encounterId);
        }

        @Override
        PrescriptionMutationResult finalizeDraft(long orderId, String actor, Instant now) {
            if (finalizeFailure != null) {
                throw finalizeFailure;
            }
            return new PrescriptionMutationResult(orderId, 201L, "FINAL", "a".repeat(64), "P-SERVER", "ENC-SERVER");
        }

        @Override
        PrescriptionMutationResult transition(long orderId, String status, String eventType, String reasonCode,
                String reasonText, PrescriptionOrder order, String actor, Instant now, String contentHash) {
            transitionCalls += 1;
            this.status = status;
            this.eventType = eventType;
            this.reasonText = reasonText;
            this.order = order;
            return new PrescriptionMutationResult(orderId, 202L, status, contentHash, "P-SERVER", "ENC-SERVER");
        }

        @Override
        PrescriptionMutationResult recordResend(long orderId, String reasonCode, String reasonText, String actor, Instant now) {
            transitionCalls += 1;
            this.status = "FINAL";
            this.eventType = "RESEND";
            this.reasonText = reasonText;
            return new PrescriptionMutationResult(orderId, 202L, "FINAL", "a".repeat(64), "P-SERVER", "ENC-SERVER");
        }
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
            patient.setFullName("Test Patient");
            patient.setBirthday(LocalDate.parse("1990-01-01"));
            return patient;
        }
    }

    private static final class StubAuditRepository extends AuthoritativeAuditRepository {
        private final boolean available;

        private StubAuditRepository(boolean available) {
            this.available = available;
        }

        @Override
        public boolean isWritePathAvailable() {
            return available;
        }
    }
}
