package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.service.DefaultOrcaLiveGateway;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.orca.transport.StubOrcaTransport;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import open.dolphin.rest.dto.orca.VisitMutationResponse;
import open.dolphin.rest.dto.orca.VisitPatientListRequest;
import open.dolphin.rest.dto.orca.VisitPatientListResponse;
import org.junit.jupiter.api.Test;

class OrcaVisitResourceTest {

    private OrcaLiveGateway createService() {
        return new DefaultOrcaLiveGateway(new StubOrcaTransport(), new OrcaXmlMapper());
    }

    @Test
    void visitListReturnsStubPayload() {
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(createService());

        VisitPatientListRequest request = new VisitPatientListRequest();
        request.setRequestNumber("01");
        request.setVisitDate(LocalDate.of(2025, 11, 12));

        VisitPatientListResponse response = resource.visitList(
                createRequest("F001:doctor01", Map.of()), request);
        assertEquals("0000", response.getApiResult());
        assertEquals("正常終了", response.getApiResultMessage());
        assertEquals(1, response.getVisits().size());
        assertEquals("2025-11-12", response.getVisitDate());
        assertEquals("F001:20251112001", response.getVisits().get(0).getEncounterKey());
        assertEquals("F001:1", response.getVisits().get(0).getScheduleKey());
        assertNotNull(response.getVisits().get(0).getPatient());
        assertGeneratedRunId(response.getRunId());
        assertEquals(1, response.getRecordsReturned());
        assertEquals("server", response.getDataSourceTransition());
    }

    @Test
    void visitListRejectsMissingDates() {
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(createService());

        VisitPatientListRequest request = new VisitPatientListRequest();
        request.setRequestNumber("01");

        WebApplicationException ex = assertThrows(WebApplicationException.class, () -> resource.visitList(null, request));
        assertRestError(ex, Response.Status.BAD_REQUEST.getStatusCode(), "orca.visit.invalid");
    }

    @Test
    void visitListRejectsMissingRequestNumber() {
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(createService());

        VisitPatientListRequest request = new VisitPatientListRequest();
        request.setVisitDate(LocalDate.of(2025, 11, 12));

        WebApplicationException ex = assertThrows(WebApplicationException.class, () -> resource.visitList(null, request));
        assertRestError(ex, Response.Status.BAD_REQUEST.getStatusCode(), "orca.visit.invalid");
    }

    @Test
    void visitListRejectsWideRange() {
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(createService());

        VisitPatientListRequest request = new VisitPatientListRequest();
        request.setRequestNumber("01");
        request.setFromDate(LocalDate.of(2025, 1, 1));
        request.setToDate(LocalDate.of(2025, 2, 2));

        WebApplicationException ex = assertThrows(WebApplicationException.class, () -> resource.visitList(null, request));
        assertRestError(ex, Response.Status.BAD_REQUEST.getStatusCode(), "orca.visit.range.tooWide");
    }

    @Test
    void visitListRejectsMissingFacility() {
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(createService());

        VisitPatientListRequest request = new VisitPatientListRequest();
        request.setRequestNumber("01");
        request.setVisitDate(LocalDate.of(2025, 11, 12));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.visitList(createRequest(null, Map.of()), request));
        assertRestError(ex, Response.Status.UNAUTHORIZED.getStatusCode(), "facility_missing");
    }

    @Test
    void visitMutationReturnsStubPayload() {
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(createService());

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000001");
        request.setAcceptanceDate("2025-11-16");
        request.setAcceptanceTime("09:00:00");

        VisitMutationResponse response = resource.mutateVisit(
                createRequest("F001:doctor01", Map.of("X-Run-Id", "RUN-VISIT-001")), request);
        assertEquals("0000", response.getApiResult());
        assertEquals("正常終了", response.getApiResultMessage());
        assertEquals("A20251116001", response.getAcceptanceId());
        assertEquals("F001:A20251116001", response.getEncounterKey());
        assertEquals("000001", response.getPatient().getPatientId());
        assertEquals("RUN-VISIT-001", response.getRunId());
    }

    @Test
    void visitMutationRejectsMissingRemoteUser() {
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(createService());

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000001");
        request.setAcceptanceDate("2025-11-16");
        request.setAcceptanceTime("09:00:00");

        WebApplicationException ex = assertThrows(WebApplicationException.class, () -> resource.mutateVisit(null, request));
        assertRestError(ex, Response.Status.UNAUTHORIZED.getStatusCode(), "remote_user_missing");
    }

    @Test
    void visitMutationRejectsNullBody() {
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(createService());

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.mutateVisit(createRequest("F001:doctor01", Map.of()), null));
        assertRestError(ex, Response.Status.BAD_REQUEST.getStatusCode(), "orca.visit.mutation.invalid");
    }

    @Test
    void visitMutationRejectsMissingAcceptanceTimestampForCreateRequests() {
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(createService());

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000001");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.mutateVisit(createRequest("F001:doctor01", Map.of()), request));
        assertRestError(ex, Response.Status.BAD_REQUEST.getStatusCode(), "orca.visit.mutation.invalid");
    }

    @Test
    void visitMutationAcceptsClaimSendInfoRequest() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitMutationResponse stub = new VisitMutationResponse();
        stub.setApiResult("0000");
        stub.setApiResultMessage("OK");
        when(wrapperService.mutateVisit(anyString(), any(VisitMutationRequest.class))).thenReturn(stub);

        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("04");
        request.setPatientId("000001");
        request.setAcceptanceDate("2025-11-16");
        request.setAcceptanceTime("09:00:00");
        request.setDepartmentCode("01");
        request.setClaimSendInfo("01");

        VisitMutationResponse response = resource.mutateVisit(createRequest("F001:doctor01", Map.of()), request);

        assertEquals("0000", response.getApiResult());
        verify(wrapperService).mutateVisit("F001", request);
    }

    @Test
    void visitMutationRejectsClaimSendInfoRequestWithoutClaimSendInfo() {
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(createService());

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("04");
        request.setPatientId("000001");
        request.setAcceptanceDate("2025-11-16");
        request.setAcceptanceTime("09:00:00");
        request.setDepartmentCode("01");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.mutateVisit(createRequest("F001:doctor01", Map.of()), request));
        assertRestError(ex, Response.Status.BAD_REQUEST.getStatusCode(), "orca.visit.mutation.invalid");
    }

    @Test
    void visitMutationAllowsQueryRequestWithoutAcceptanceTimestamp() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitMutationResponse stub = new VisitMutationResponse();
        stub.setApiResult("0000");
        stub.setApiResultMessage("OK");
        when(wrapperService.mutateVisit(anyString(), any(VisitMutationRequest.class))).thenReturn(stub);

        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("class=00");
        request.setPatientId("000001");

        VisitMutationResponse response = resource.mutateVisit(createRequest("F001:doctor01", Map.of()), request);
        assertEquals("0000", response.getApiResult());
        assertGeneratedRunId(response.getRunId());
        assertEquals("server", response.getDataSourceTransition());
        verify(wrapperService).mutateVisit("F001", request);
    }

    @Test
    void visitMutationPreservesApiResult21ForInsuranceMismatch() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitMutationResponse stub = new VisitMutationResponse();
        stub.setApiResult("21");
        stub.setApiResultMessage("保険の組み合わせが一致しません");
        when(wrapperService.mutateVisit(anyString(), any(VisitMutationRequest.class))).thenReturn(stub);

        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000021");
        request.setAcceptanceDate("2025-11-16");
        request.setAcceptanceTime("09:00:00");

        VisitMutationResponse response = resource.mutateVisit(createRequest("F001:doctor01", Map.of()), request);

        assertEquals("21", response.getApiResult());
        assertEquals("保険の組み合わせが一致しません", response.getApiResultMessage());
        assertGeneratedRunId(response.getRunId());
        verify(wrapperService).mutateVisit("F001", request);
    }

    @Test
    void visitMutationPreservesApiResult60ForMissingAcceptance() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitMutationResponse stub = new VisitMutationResponse();
        stub.setApiResult("60");
        stub.setApiResultMessage("受付は存在しません");
        when(wrapperService.mutateVisit(anyString(), any(VisitMutationRequest.class))).thenReturn(stub);

        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("02");
        request.setPatientId("000060");
        request.setAcceptanceId("A-060");

        VisitMutationResponse response = resource.mutateVisit(createRequest("F001:doctor01", Map.of()), request);

        assertEquals("60", response.getApiResult());
        assertEquals("受付は存在しません", response.getApiResultMessage());
        assertGeneratedRunId(response.getRunId());
        verify(wrapperService).mutateVisit("F001", request);
    }

    private HttpServletRequest createRequest(String remoteUser, Map<String, String> headers) {
        Map<String, Object> attributes = new HashMap<>();
        return (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    switch (method.getName()) {
                        case "getRemoteUser":
                            return remoteUser;
                        case "getRequestURI":
                            return "/api/orca/visits/mutation";
                        case "getRemoteAddr":
                            return "127.0.0.1";
                        case "getHeader":
                            if (args != null && args.length == 1) {
                                return headers.get(String.valueOf(args[0]));
                            }
                            return null;
                        case "getAttribute":
                            if (args != null && args.length == 1) {
                                return attributes.get(String.valueOf(args[0]));
                            }
                            return null;
                        case "setAttribute":
                            if (args != null && args.length == 2) {
                                attributes.put(String.valueOf(args[0]), args[1]);
                            }
                            return null;
                        default:
                            return null;
                    }
                });
    }

    @SuppressWarnings("unchecked")
    private void assertRestError(WebApplicationException ex, int status, String errorCode) {
        assertNotNull(ex);
        Response response = ex.getResponse();
        assertNotNull(response);
        assertEquals(status, response.getStatus());
        Object entity = response.getEntity();
        assertNotNull(entity);
        assertTrue(entity instanceof Map, "Expected error entity to be a Map, got: " + entity.getClass());
        Map<String, Object> body = (Map<String, Object>) entity;
        assertEquals(errorCode, body.get("errorCode"));
        assertEquals(status, body.get("status"));
    }

    private void assertGeneratedRunId(String runId) {
        assertNotNull(runId);
        assertTrue(runId.matches("\\d{8}T\\d{6}Z"));
    }
}
