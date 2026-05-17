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
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.rest.dto.orca.ChartEditSessionRequest;
import open.dolphin.rest.dto.orca.ChartEditSessionResponse;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ChartEditSessionResourceTest extends RuntimeDelegateTestSupport {

    private ChartEditSessionResource resource;
    private FakeChartEditSessionRepository repository;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() throws Exception {
        resource = new ChartEditSessionResource();
        repository = new FakeChartEditSessionRepository();
        injectField(resource, "patientServiceBean", new FakePatientServiceBean());
        injectField(resource, "chartEditSessionRepository", repository);
        injectField(resource, "sessionAuditDispatcher", new RecordingSessionAuditDispatcher());
        request = request("F001:doctor01", "HACKED-FACILITY");
    }

    @Test
    void acquireUsesServerFacilityAndReturnsLease() {
        ChartEditSessionRequest payload = payload();

        ChartEditSessionResponse response = resource.acquire(request, payload);

        assertEquals("00", response.getApiResult());
        assertEquals("owned", response.getLockStatus());
        assertEquals("lease-server", response.getLeaseId());
        assertNotNull(repository.lastCommand);
        assertEquals("F001", repository.lastCommand.facilityId());
        assertEquals("F001:doctor01", repository.lastCommand.actorUserId());
        assertEquals("P001", repository.lastCommand.patientId());
        assertEquals("patient:P001", repository.lastCommand.encounterScope());
    }

    @Test
    void acquireReturns409WhenAnotherTerminalHasActiveLease() {
        repository.nextResult = new ChartEditSessionRepository.EditSessionResult(
                false,
                "other-editor",
                "P001",
                "reception:R001",
                "lease-other",
                "RUN-OTHER",
                "tab-other",
                Instant.parse("2026-05-17T00:00:00Z"),
                Instant.parse("2026-05-17T00:00:30Z"),
                Instant.parse("2026-05-17T00:05:00Z"),
                false,
                "chart_edit_session_locked");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.acquire(request, payload()));

        assertEquals(409, ex.getResponse().getStatus());
        assertTrue(String.valueOf(ex.getResponse().getEntity()).contains("chart_edit_session_locked"));
    }

    private static ChartEditSessionRequest payload() {
        ChartEditSessionRequest payload = new ChartEditSessionRequest();
        payload.setPatientId("P001");
        payload.setReceptionId("R001");
        payload.setOwnerRunId("RUN-LOCK");
        payload.setOwnerTabSessionId("tab-1");
        payload.setTtlSeconds(300);
        return payload;
    }

    private static HttpServletRequest request(String remoteUser, String facilityHeader) {
        Map<String, Object> attributes = new HashMap<>();
        return (HttpServletRequest) Proxy.newProxyInstance(
                ChartEditSessionResourceTest.class.getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("getRemoteUser".equals(name)) {
                        return remoteUser;
                    }
                    if ("getRemoteAddr".equals(name)) {
                        return "127.0.0.1";
                    }
                    if ("getRequestURI".equals(name)) {
                        return "/api/local/charts/edit-sessions/acquire";
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
                        return switch (String.valueOf(args[0])) {
                            case "X-Run-Id" -> "20260517T203501Z";
                            case "X-Facility-Id" -> facilityHeader;
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

    private static final class FakeChartEditSessionRepository extends ChartEditSessionRepository {
        private EditSessionCommand lastCommand;
        private EditSessionResult nextResult;

        @Override
        EditSessionResult acquire(EditSessionCommand command) {
            lastCommand = command;
            if (nextResult != null) {
                return nextResult;
            }
            return new EditSessionResult(
                    true,
                    "owned",
                    command.patientId(),
                    command.encounterScope(),
                    "lease-server",
                    command.ownerRunId(),
                    command.ownerTabSessionId(),
                    Instant.parse("2026-05-17T00:00:00Z"),
                    Instant.parse("2026-05-17T00:00:00Z"),
                    Instant.parse("2026-05-17T00:05:00Z"),
                    false,
                    null);
        }
    }

    private static final class FakePatientServiceBean extends PatientServiceBean {
        @Override
        public PatientModel getPatientById(String fid, String pid) {
            if (!"F001".equals(fid) || !"P001".equals(pid)) {
                return null;
            }
            PatientModel patient = new PatientModel();
            patient.setId(100L);
            patient.setFacilityId(fid);
            patient.setPatientId(pid);
            patient.setFullName("Test Patient");
            patient.setBirthday(LocalDate.parse("1990-01-01"));
            return patient;
        }
    }

    private static final class RecordingSessionAuditDispatcher extends SessionAuditDispatcher {
        @Override
        public AuditEventEnvelope record(AuditEventPayload payload, AuditEventEnvelope.Outcome overrideOutcome,
                String errorCode, String errorMessage) {
            return null;
        }
    }
}
