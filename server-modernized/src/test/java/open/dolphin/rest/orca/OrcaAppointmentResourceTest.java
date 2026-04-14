package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.util.Map;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.service.DefaultOrcaLiveGateway;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.orca.transport.StubOrcaTransport;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.rest.dto.orca.AppointmentMutationRequest;
import open.dolphin.rest.dto.orca.AppointmentMutationResponse;
import open.dolphin.rest.dto.orca.BillingSimulationRequest;
import open.dolphin.rest.dto.orca.BillingSimulationRequest.BillingItem;
import open.dolphin.rest.dto.orca.BillingSimulationResponse;
import open.dolphin.rest.dto.orca.OrcaAppointmentListRequest;
import open.dolphin.rest.dto.orca.OrcaAppointmentListResponse;
import open.dolphin.rest.dto.orca.OrcaMedicalInformationListResponse;
import open.dolphin.rest.dto.orca.PatientAppointmentListRequest;
import open.dolphin.rest.dto.orca.PatientAppointmentListResponse;
import open.dolphin.rest.dto.orca.PatientSummary;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import org.junit.jupiter.api.Test;

class OrcaAppointmentResourceTest {

    private OrcaLiveGateway createService() {
        return new DefaultOrcaLiveGateway(new StubOrcaTransport(), new OrcaXmlMapper());
    }

    @Test
    void listAppointmentsReturnsStubPayload() {
        OrcaAppointmentResource resource = new OrcaAppointmentResource();
        resource.setWrapperService(createService());

        OrcaAppointmentListRequest request = new OrcaAppointmentListRequest();
        request.setAppointmentDate(LocalDate.of(2025, 11, 13));

        OrcaAppointmentListResponse response = resource.listAppointments(
                createRequest("F001:doctor01", "/api/orca/official/appointments/list", Map.of()), request);
        assertEquals("2025-11-13", response.getAppointmentDate());
        assertEquals(1, response.getSlots().size());
        assertEquals("F001:AP-20251113-001", response.getSlots().get(0).getScheduleKey());
        assertNull(response.getSlots().get(0).getEncounterKey());
        assertEquals("0000", response.getApiResult());
        assertEquals("正常終了", response.getApiResultMessage());
        assertGeneratedRunId(response.getRunId());
        assertNull(response.getBlockerTag());
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

        OrcaAppointmentListResponse response = resource.listAppointments(
                createRequest("F001:doctor01", "/api/orca/official/appointments/list", Map.of()), request);
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

        OrcaAppointmentListResponse response = resource.listAppointments(
                createRequest("F001:doctor01", "/api/orca/official/appointments/list", Map.of()), request);
        assertEquals("2025-01-01/2025-01-31", response.getAppointmentDate());
        assertEquals(31, response.getSlots().size());
    }

    @Test
    void listAppointmentsRejectsMissingFacility() {
        OrcaAppointmentResource resource = new OrcaAppointmentResource();
        resource.setWrapperService(createService());

        OrcaAppointmentListRequest request = new OrcaAppointmentListRequest();
        request.setAppointmentDate(LocalDate.of(2025, 11, 13));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.listAppointments(createRequest(null, "/api/orca/official/appointments/list", Map.of()), request));
        assertRestError(ex, Response.Status.UNAUTHORIZED.getStatusCode(), "facility_missing");
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

        PatientAppointmentListResponse response = resource.patientAppointments(
                createRequest("F001:doctor01", "/api/orca/official/appointments/patient", Map.of()), request);
        assertEquals("0000", response.getApiResult());
        assertEquals("正常終了", response.getApiResultMessage());
        assertEquals(1, response.getReservations().size());
        assertEquals("F001:AP-20251113-001", response.getReservations().get(0).getScheduleKey());
        assertEquals("000001", response.getPatient().getPatientId());
        assertGeneratedRunId(response.getRunId());
    }

    @Test
    void medicalInformationOptionsReturnsStubPayload() {
        OrcaAppointmentResource resource = new OrcaAppointmentResource();
        resource.setWrapperService(createService());

        OrcaMedicalInformationListResponse response = resource.medicalInformationOptions(
                createRequest("F001:doctor01", "/api/orca/official/appointments/medical-information", Map.of()));

        assertEquals("00", response.getApiResult());
        assertEquals("OK", response.getApiResultMessage());
        assertEquals(2, response.getItems().size());
        assertEquals("01", response.getItems().get(0).getCode());
        assertEquals("診察", response.getItems().get(0).getName());
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

        BillingSimulationResponse response = resource.estimateBilling(
                createRequest("F001:doctor01", "/api/orca/official/billing/estimate", Map.of()), request);
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
                createRequest("F001:doctor01", "/api/orca/official/appointments/mutation", Map.of("X-Run-Id", "RUN-APPT-001")), request);
        assertEquals("0000", response.getApiResult());
        assertEquals("正常終了", response.getApiResultMessage());
        assertEquals("AP-20251120-001", response.getAppointmentId());
        assertEquals("F001:AP-20251120-001", response.getScheduleKey());
        assertNull(response.getEncounterKey());
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
                "/api/orca/official/appointments/list",
                Map.of("X-Trace-Id", "trace-appointment", "X-Request-Id", "req-appointment", "X-Run-Id", "RUN-TRACE-001"));

        resource.listAppointments(servletRequest, request);

        assertNotNull(dispatcher.payload, "Audit payload should be captured");
        assertEquals("trace-appointment", dispatcher.payload.getTraceId());
        assertEquals("req-appointment", dispatcher.payload.getRequestId());
        assertNotNull(dispatcher.payload.getDetails());
        assertEquals("trace-appointment", dispatcher.payload.getDetails().get("traceId"));
        assertEquals("RUN-TRACE-001", dispatcher.payload.getDetails().get("runId"));
        assertEquals("official", dispatcher.payload.getDetails().get("scope"));
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
                        case "isSecure":
                            return Boolean.FALSE;
                        case "getScheme":
                            return "http";
                        case "getServerPort":
                            return 80;
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

    private void assertRestError(WebApplicationException ex, int status, String code) {
        assertEquals(status, ex.getResponse().getStatus());
        Object entity = ex.getResponse().getEntity();
        assertNotNull(entity);
        assertTrue(entity instanceof Map);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) entity;
        assertEquals(code, body.get("errorCode"));
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
