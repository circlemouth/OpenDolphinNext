package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.HashMap;
import java.util.Map;
import open.dolphin.encounter.EncounterProjectionRepository;
import open.dolphin.encounter.ProjectionPatientSummaryRepository;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.service.DefaultOrcaLiveGateway;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.orca.transport.StubOrcaTransport;
import open.dolphin.rest.ReceptionRealtimeSseSupport;
import open.dolphin.rest.dto.orca.PatientSummary;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import open.dolphin.rest.dto.orca.VisitMutationResponse;
import open.dolphin.rest.dto.orca.VisitPatientListRequest;
import open.dolphin.rest.dto.orca.VisitPatientListResponse;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.session.KarteServiceBean;
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
    void visitListProjectedFallbackDoesNotSynthesizeVoucherOrSequential() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitPatientListResponse stub = new VisitPatientListResponse();
        stub.setApiResult("00");
        stub.setApiResultMessage("OK");
        stub.setVisitDate("2026-04-13");
        when(wrapperService.getVisitList(anyString(), any(VisitPatientListRequest.class))).thenReturn(stub);

        EncounterProjectionRepository encounterProjectionRepository = mock(EncounterProjectionRepository.class);
        when(encounterProjectionRepository.findByFacilityAndAcceptanceRange(anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(new EncounterProjectionRepository.EncounterRow(
                        "F001:E100",
                        "F001",
                        "000001",
                        10L,
                        "F001:S100",
                        "ACCEPT-100",
                        Instant.parse("2026-04-13T00:00:00Z"),
                        "checked_in",
                        null,
                        null,
                        null,
                        "doctor01",
                        null,
                        null,
                        null,
                        1L,
                        Instant.parse("2026-04-13T00:00:01Z"))));

        ProjectionPatientSummaryRepository projectionPatientSummaryRepository = mock(ProjectionPatientSummaryRepository.class);
        PatientSummary patient = new PatientSummary();
        patient.setPatientId("000001");
        patient.setWholeName("患者一郎");
        when(projectionPatientSummaryRepository.findByFacilityAndPatientId("F001", "000001")).thenReturn(patient);

        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);
        resource.encounterProjectionRepository = encounterProjectionRepository;
        resource.projectionPatientSummaryRepository = projectionPatientSummaryRepository;

        VisitPatientListRequest request = new VisitPatientListRequest();
        request.setRequestNumber("01");
        request.setVisitDate(LocalDate.of(2026, 4, 13));

        VisitPatientListResponse response = resource.visitList(createRequest("F001:doctor01", Map.of()), request);

        assertEquals(1, response.getVisits().size());
        VisitPatientListResponse.VisitEntry merged = response.getVisits().get(0);
        assertEquals("F001:S100", merged.getScheduleKey());
        assertEquals("F001:E100", merged.getEncounterKey());
        assertNull(merged.getVoucherNumber());
        assertNull(merged.getSequentialNumber());
        assertEquals("000001", merged.getPatient().getPatientId());
        assertTrue(response.isFallbackUsed());
        assertEquals(1, response.getRecordsReturned());
    }

    @Test
    void visitListProjectsEncounterRowsForAcceptedVisitsWhenMissing() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitPatientListResponse stub = new VisitPatientListResponse();
        stub.setApiResult("00");
        stub.setApiResultMessage("OK");
        stub.setVisitDate("2026-04-17");
        VisitPatientListResponse.VisitEntry visit = new VisitPatientListResponse.VisitEntry();
        visit.setVoucherNumber("A-100");
        visit.setSequentialNumber("1");
        visit.setUpdateDate("2026-04-17");
        visit.setUpdateTime("09:30");
        PatientSummary patient = new PatientSummary();
        patient.setPatientId("000001");
        visit.setPatient(patient);
        stub.getVisits().add(visit);
        when(wrapperService.getVisitList(anyString(), any(VisitPatientListRequest.class))).thenReturn(stub);

        EncounterProjectionRepository encounterProjectionRepository = mock(EncounterProjectionRepository.class);
        when(encounterProjectionRepository.findByEncounterKey("F001:A-100")).thenReturn(null);
        KarteServiceBean karteServiceBean = mock(KarteServiceBean.class);
        KarteBean karte = new KarteBean();
        karte.setId(10L);
        when(karteServiceBean.getKarte("F001", "000001", null)).thenReturn(karte);

        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);
        resource.encounterProjectionRepository = encounterProjectionRepository;
        resource.karteServiceBean = karteServiceBean;

        VisitPatientListRequest request = new VisitPatientListRequest();
        request.setRequestNumber("01");
        request.setVisitDate(LocalDate.of(2026, 4, 17));

        VisitPatientListResponse response = resource.visitList(createRequest("F001:doctor01", Map.of()), request);

        assertEquals("F001:A-100", response.getVisits().get(0).getEncounterKey());
        assertEquals("F001:1", response.getVisits().get(0).getScheduleKey());
        verify(encounterProjectionRepository).upsertCheckedIn(argThat(command ->
                "F001:A-100".equals(command.encounterKey())
                        && "F001".equals(command.facilityId())
                        && "000001".equals(command.patientId())
                        && Long.valueOf(10L).equals(command.karteId())
                        && "F001:1".equals(command.scheduleKey())
                        && "A-100".equals(command.orcaAcceptanceId())
                        && "checked_in".equals(command.businessState())));
    }

    @Test
    void visitListDoesNotOverwriteExistingEncounterProjection() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitPatientListResponse stub = new VisitPatientListResponse();
        stub.setApiResult("00");
        stub.setApiResultMessage("OK");
        stub.setVisitDate("2026-04-17");
        VisitPatientListResponse.VisitEntry visit = new VisitPatientListResponse.VisitEntry();
        visit.setVoucherNumber("A-100");
        visit.setSequentialNumber("1");
        visit.setUpdateDate("2026-04-17");
        visit.setUpdateTime("09:30");
        PatientSummary patient = new PatientSummary();
        patient.setPatientId("000001");
        visit.setPatient(patient);
        stub.getVisits().add(visit);
        when(wrapperService.getVisitList(anyString(), any(VisitPatientListRequest.class))).thenReturn(stub);

        EncounterProjectionRepository encounterProjectionRepository = mock(EncounterProjectionRepository.class);
        when(encounterProjectionRepository.findByEncounterKey("F001:A-100")).thenReturn(new EncounterProjectionRepository.EncounterRow(
                "F001:A-100",
                "F001",
                "000001",
                10L,
                "F001:1",
                "A-100",
                Instant.parse("2026-04-17T00:30:00Z"),
                "chart_opened",
                Instant.parse("2026-04-17T00:40:00Z"),
                null,
                null,
                "doctor01",
                null,
                "{}",
                null,
                2L,
                Instant.parse("2026-04-17T00:40:01Z")));

        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);
        resource.encounterProjectionRepository = encounterProjectionRepository;

        VisitPatientListRequest request = new VisitPatientListRequest();
        request.setRequestNumber("01");
        request.setVisitDate(LocalDate.of(2026, 4, 17));

        resource.visitList(createRequest("F001:doctor01", Map.of()), request);

        verify(encounterProjectionRepository, never()).upsertCheckedIn(any());
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
    void visitMutationSuppressesAcceptancePushOnlyWhenExplicitlyConfigured() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitMutationResponse stub = new VisitMutationResponse();
        stub.setApiResult("0000");
        stub.setApiResultMessage("OK");
        when(wrapperService.mutateVisit(anyString(), any(VisitMutationRequest.class))).thenReturn(stub);

        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);
        resource.setConfigurationResolverForTest(new ServerConfigurationResolver(Map.of(
                ServerConfigurationResolver.KEY_ORCA_ACCEPTMOD_SUPPRESS_ACCEPTANCE_PUSH, "true")));

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000001");
        request.setAcceptanceDate("2025-11-16");
        request.setAcceptanceTime("09:00:00");
        request.setAcceptancePush("1");

        resource.mutateVisit(createRequest("F001:doctor01", Map.of()), request);

        verify(wrapperService).mutateVisit(anyString(), argThat(candidate -> candidate.getAcceptancePush() == null));
    }

    @Test
    void visitMutationProjectsAndPublishesWarnSuccessAcceptance() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitMutationResponse stub = new VisitMutationResponse();
        stub.setApiResult("K3");
        stub.setApiResultMessage("受付登録終了");
        stub.setAcceptanceId("A-100");
        stub.setAcceptanceDate("2025-11-16");
        stub.setAcceptanceTime("09:00:00");
        PatientSummary patient = new PatientSummary();
        patient.setPatientId("000001");
        stub.setPatient(patient);
        when(wrapperService.mutateVisit(anyString(), any(VisitMutationRequest.class))).thenReturn(stub);

        EncounterProjectionRepository encounterProjectionRepository = mock(EncounterProjectionRepository.class);
        ReceptionRealtimeSseSupport realtimeSseSupport = mock(ReceptionRealtimeSseSupport.class);

        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);
        resource.encounterProjectionRepository = encounterProjectionRepository;
        resource.setReceptionRealtimeSseSupportForTest(realtimeSseSupport);

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000001");
        request.setAcceptanceDate("2025-11-16");
        request.setAcceptanceTime("09:00:00");

        VisitMutationResponse response = resource.mutateVisit(
                createRequest("F001:doctor01", Map.of("X-Run-Id", "RUN-VISIT-K3")), request);

        assertEquals("F001:A-100", response.getEncounterKey());
        verify(encounterProjectionRepository).upsertCheckedIn(argThat(command ->
                "F001:A-100".equals(command.encounterKey())
                        && "F001".equals(command.facilityId())
                        && "000001".equals(command.patientId())
                        && "A-100".equals(command.orcaAcceptanceId())
                        && "checked_in".equals(command.businessState())));
        verify(realtimeSseSupport).publishReceptionUpdate("F001", "2025-11-16", "000001", "01", "RUN-VISIT-K3");
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
                            return "/api/orca/official/visits/mutation";
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
