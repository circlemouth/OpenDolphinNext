package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.BadRequestException;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.service.OrcaPatientCacheStore;
import open.dolphin.orca.transport.StubOrcaTransport;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * runIdヘッダーの優先透過を検証する代表APIテスト（Patient API）。
 */
class OrcaPatientApiResourceRunIdTest extends RuntimeDelegateTestSupport {

    private OrcaPatientApiResource resource;
    private RecordingSessionAuditDispatcher auditDispatcher;
    private RecordingPatientCacheStore patientCacheStore;
    private HttpServletRequest servletRequest;

    @BeforeEach
    void setUp() throws Exception {
        resource = new OrcaPatientApiResource();
        auditDispatcher = new RecordingSessionAuditDispatcher();
        patientCacheStore = new RecordingPatientCacheStore();

        injectField(resource, "orcaTransport", new StubOrcaTransport());
        injectField(resource, "sessionAuditDispatcher", auditDispatcher);
        injectField(resource, "patientCacheStore", patientCacheStore);

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
                    if ("getHeader".equals(name) && args != null && args.length == 1) {
                        String header = String.valueOf(args[0]);
                        return switch (header) {
                            case "X-Request-Id" -> "req-patient";
                            case "X-Trace-Id" -> "trace-patient";
                            case "X-Run-Id" -> "run-patient";
                            case "User-Agent" -> "JUnit";
                            default -> null;
                        };
                    }
                    return null;
                });
    }

    @Test
    void getPatient_propagatesRunIdFromHeader() {
        var response = resource.getPatient(servletRequest, "00001", "01", "json");

        String headerRunId = response.getHeaderString("X-Run-Id");
        assertEquals(200, response.getStatus());
        assertEquals("run-patient", headerRunId);
        assertEquals("ORCA", response.getHeaderString("X-Orca-Source-System"));
        assertEquals("patientgetv2", response.getHeaderString("X-Orca-Source-Api"));
        assertEquals("NEEDS_REVIEW", response.getHeaderString("X-Orca-Cache-Status"));
        assertEquals("false", response.getHeaderString("X-Orca-Stale"));

        assertNotNull(auditDispatcher.payload);
        assertEquals("run-patient", auditDispatcher.payload.getDetails().get("runId"));
        assertEquals("official", auditDispatcher.payload.getDetails().get("scope"));
        assertEquals("00001", auditDispatcher.payload.getPatientId());
        assertEquals("patientgetv2", auditDispatcher.payload.getDetails().get("sourceApi"));
        assertEquals("NEEDS_REVIEW", auditDispatcher.payload.getDetails().get("cacheStatus"));
        assertEquals(Boolean.FALSE, auditDispatcher.payload.getDetails().get("stale"));
        assertEquals("req-patient", auditDispatcher.payload.getRequestId());
        assertEquals(AuditEventEnvelope.Outcome.SUCCESS, auditDispatcher.outcome);
        assertNotNull(patientCacheStore.command);
        assertEquals("F001", patientCacheStore.command.facilityId());
        assertEquals("00001", patientCacheStore.command.orcaPatientId());
        assertEquals("patientgetv2", auditDispatcher.payload.getDetails().get("sourceApi"));
    }

    @Test
    void getPatient_rejectsMissingIdAndRecordsFailureAudit() {
        BadRequestException exception = assertThrows(BadRequestException.class,
                () -> resource.getPatient(servletRequest, " ", "01", "json"));

        assertTrue(exception.getMessage().contains("id is required"));
        assertNotNull(auditDispatcher.payload);
        assertEquals("ORCA_OFFICIAL_GET_PATIENT", auditDispatcher.payload.getAction());
        assertEquals("/api/orca/official/patientgetv2", auditDispatcher.payload.getResource());
        assertEquals(AuditEventEnvelope.Outcome.FAILURE, auditDispatcher.outcome);
        assertEquals("failed", auditDispatcher.payload.getDetails().get("status"));
        assertEquals("official", auditDispatcher.payload.getDetails().get("scope"));
        assertEquals(400, auditDispatcher.payload.getDetails().get("httpStatus"));
        assertEquals("orca.patientget.error", auditDispatcher.payload.getDetails().get("errorCode"));
    }

    @Test
    void getPatient_rejectsXmlFormatAndRecordsFailureAudit() {
        BadRequestException exception = assertThrows(BadRequestException.class,
                () -> resource.getPatient(servletRequest, "00001", "01", "xml"));

        assertTrue(exception.getMessage().contains("format must be json"));
        assertNotNull(auditDispatcher.payload);
        assertEquals("ORCA_OFFICIAL_GET_PATIENT", auditDispatcher.payload.getAction());
        assertEquals(AuditEventEnvelope.Outcome.FAILURE, auditDispatcher.outcome);
        assertEquals("failed", auditDispatcher.payload.getDetails().get("status"));
        assertEquals("official", auditDispatcher.payload.getDetails().get("scope"));
        assertEquals(400, auditDispatcher.payload.getDetails().get("httpStatus"));
        assertEquals("orca.patientget.error", auditDispatcher.payload.getDetails().get("errorCode"));
    }

    private static void injectField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
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

    private static final class RecordingPatientCacheStore extends OrcaPatientCacheStore {
        private PatientCacheCommand command;

        @Override
        public long save(PatientCacheCommand command) {
            this.command = command;
            return 100L;
        }
    }
}
