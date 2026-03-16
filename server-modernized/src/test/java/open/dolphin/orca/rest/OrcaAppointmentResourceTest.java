package open.dolphin.orca.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.util.Map;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.service.OrcaWrapperService;
import open.dolphin.orca.transport.StubOrcaTransport;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.rest.dto.orca.AppointmentMutationRequest;
import open.dolphin.rest.dto.orca.AppointmentMutationResponse;
import open.dolphin.rest.dto.orca.BillingSimulationRequest;
import open.dolphin.rest.dto.orca.BillingSimulationRequest.BillingItem;
import open.dolphin.rest.dto.orca.BillingSimulationResponse;
import open.dolphin.rest.dto.orca.OrcaAppointmentListRequest;
import open.dolphin.rest.dto.orca.OrcaAppointmentListResponse;
import open.dolphin.rest.dto.orca.PatientAppointmentListRequest;
import open.dolphin.rest.dto.orca.PatientAppointmentListResponse;
import open.dolphin.rest.dto.orca.PatientSummary;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import org.junit.jupiter.api.Test;

class OrcaAppointmentResourceTest {

    private OrcaWrapperService createService() {
        return new OrcaWrapperService(new StubOrcaTransport(), new OrcaXmlMapper());
    }

    @Test
    void listAppointmentsReturnsStubPayload() {
        OrcaAppointmentResource resource = new OrcaAppointmentResource();
        resource.setWrapperService(createService());

        OrcaAppointmentListRequest request = new OrcaAppointmentListRequest();
        request.setAppointmentDate(LocalDate.of(2025, 11, 13));

        OrcaAppointmentListResponse response = resource.listAppointments(null, request);
        assertEquals("2025-11-13", response.getAppointmentDate());
        assertEquals(1, response.getSlots().size());
        assertEquals("0000", response.getApiResult());
        assertEquals("正常終了", response.getApiResultMessage());
        assertGeneratedRunId(response.getRunId());
        assertEquals(OrcaWrapperService.BLOCKER_TAG, response.getBlockerTag());
        assertEquals(1, response.getRecordsReturned());
        assertEquals("server", response.getDataSourceTransition());
    }

    @Test
    void listAppointmentsAcceptsRange() {
        OrcaAppointmentResource resource = new OrcaAppointmentResource();
        resource.setWrapperService(createService());

        OrcaAppointmentListRequest request = new OrcaAppointmentListRequest();
        request.setFromDate(LocalDate.of(2025, 11, 13));
        request.setToDate(LocalDate.of(2025, 11, 14));

        OrcaAppointmentListResponse response = resource.listAppointments(null, request);
        assertEquals("2025-11-13/2025-11-14", response.getAppointmentDate());
        assertEquals(2, response.getSlots().size());
        assertEquals("0000", response.getApiResult());
        assertEquals("正常終了", response.getApiResultMessage());
        assertGeneratedRunId(response.getRunId());
        assertEquals(2, response.getRecordsReturned());
        assertEquals("server", response.getDataSourceTransition());
    }

    @Test
    void listAppointmentsAcceptsMaxRange31Days() {
        OrcaAppointmentResource resource = new OrcaAppointmentResource();
        resource.setWrapperService(createService());

        OrcaAppointmentListRequest request = new OrcaAppointmentListRequest();
        request.setFromDate(LocalDate.of(2025, 1, 1));
        request.setToDate(LocalDate.of(2025, 1, 31));

        OrcaAppointmentListResponse response = resource.listAppointments(null, request);
        assertEquals("2025-01-01/2025-01-31", response.getAppointmentDate());
        assertEquals(31, response.getSlots().size());
    }

    @Test
    void listAppointmentsRejectsWideRange() {
        OrcaAppointmentResource resource = new OrcaAppointmentResource();
        resource.setWrapperService(createService());

        OrcaAppointmentListRequest request = new OrcaAppointmentListRequest();
        request.setFromDate(LocalDate.of(2025, 1, 1));
        request.setToDate(LocalDate.of(2025, 2, 15));

        assertThrows(WebApplicationException.class, () -> resource.listAppointments(null, request));
    }

    @Test
    void patientAppointmentsReturnsStubPayload() {
        OrcaAppointmentResource resource = new OrcaAppointmentResource();
        resource.setWrapperService(createService());

        PatientAppointmentListRequest request = new PatientAppointmentListRequest();
        request.setPatientId("000001");
        request.setBaseDate(LocalDate.of(2025, 11, 12));

        PatientAppointmentListResponse response = resource.patientAppointments(null, request);
        assertEquals("0000", response.getApiResult());
        assertEquals("正常終了", response.getApiResultMessage());
        assertEquals(1, response.getReservations().size());
        assertEquals("000001", response.getPatient().getPatientId());
        assertGeneratedRunId(response.getRunId());
    }

    @Test
    void estimateBillingRequiresPatientId() {
        OrcaAppointmentResource resource = new OrcaAppointmentResource();
        resource.setWrapperService(createService());

        BillingSimulationRequest request = new BillingSimulationRequest();
        request.setPerformDate(LocalDate.of(2025, 11, 12));
        BillingItem item = new BillingItem();
        item.setMedicalCode("D000");
        item.setQuantity(1);
        request.getItems().add(item);

        assertThrows(WebApplicationException.class, () -> resource.estimateBilling(null, request));
    }

    @Test
    void estimateBillingReturnsBreakdown() {
        OrcaAppointmentResource resource = new OrcaAppointmentResource();
        resource.setWrapperService(createService());

        BillingSimulationRequest request = new BillingSimulationRequest();
        request.setPatientId("000001");
        request.setDepartmentCode("01");
        request.setPerformDate(LocalDate.of(2025, 11, 12));
        BillingItem item = new BillingItem();
        item.setMedicalCode("D000");
        item.setQuantity(1);
        request.getItems().add(item);

        BillingSimulationResponse response = resource.estimateBilling(null, request);
        assertEquals(450, response.getTotalPoint());
        assertEquals(2, response.getBreakdown().size());
        assertNotNull(response.getPatient());
        assertEquals("0000", response.getApiResult());
        assertEquals("正常終了", response.getApiResultMessage());
        assertGeneratedRunId(response.getRunId());
    }

    @Test
    void mutateAppointmentReturnsStubPayload() {
        OrcaAppointmentResource resource = new OrcaAppointmentResource();
        resource.setWrapperService(createService());

        AppointmentMutationRequest request = new AppointmentMutationRequest();
        request.setRequestNumber("01");
        request.setAppointmentDate("2025-11-20");
        request.setAppointmentTime("10:30:00");
        PatientSummary patient = new PatientSummary();
        patient.setPatientId("000001");
        patient.setWholeName("山田太郎");
        request.setPatient(patient);

        AppointmentMutationResponse response = resource.mutateAppointment(
                createRequest("F001:doctor01", "/api/orca/appointments/mutation", Map.of("X-Run-Id", "RUN-APPT-001")), request);
        assertEquals("0000", response.getApiResult());
        assertEquals("正常終了", response.getApiResultMessage());
        assertEquals("AP-20251120-001", response.getAppointmentId());
        assertEquals("000001", response.getPatient().getPatientId());
        assertEquals("RUN-APPT-001", response.getRunId());
    }

    @Test
    void listAppointmentsRecordsTraceIdInAuditDetails() throws Exception {
        OrcaAppointmentResource resource = new OrcaAppointmentResource();
        resource.setWrapperService(createService());

        RecordingSessionAuditDispatcher dispatcher = new RecordingSessionAuditDispatcher();
        injectField(resource, "sessionAuditDispatcher", dispatcher);

        OrcaAppointmentListRequest request = new OrcaAppointmentListRequest();
        request.setAppointmentDate(LocalDate.of(2025, 11, 13));

        HttpServletRequest servletRequest = createRequest(
                "F001:doctor01",
                "/api/orca/appointments/list",
                Map.of("X-Trace-Id", "trace-appointment", "X-Request-Id", "req-appointment", "X-Run-Id", "RUN-TRACE-001"));

        resource.listAppointments(servletRequest, request);

        assertNotNull(dispatcher.payload, "Audit payload should be captured");
        assertEquals("trace-appointment", dispatcher.payload.getTraceId());
        assertEquals("req-appointment", dispatcher.payload.getRequestId());
        assertNotNull(dispatcher.payload.getDetails());
        assertEquals("trace-appointment", dispatcher.payload.getDetails().get("traceId"));
        assertEquals("RUN-TRACE-001", dispatcher.payload.getDetails().get("runId"));
    }

    private HttpServletRequest createRequest(String remoteUser, String uri, Map<String, String> headers) {
        return (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    switch (method.getName()) {
                        case "getRemoteUser":
                            return remoteUser;
                        case "getRequestURI":
                            return uri;
                        case "getRemoteAddr":
                            return "127.0.0.1";
                        case "getHeader":
                            if (args != null && args.length == 1) {
                                String key = String.valueOf(args[0]);
                                return headers.get(key);
                            }
                            return null;
                        default:
                            return null;
                    }
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

    private void assertGeneratedRunId(String runId) {
        assertNotNull(runId);
        assertTrue(runId.matches("\\d{8}T\\d{6}Z"));
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
}
