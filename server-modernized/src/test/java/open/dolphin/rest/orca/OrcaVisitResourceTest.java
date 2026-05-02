package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import open.dolphin.rest.dto.orca.AcceptanceInventoryRequest;
import open.dolphin.rest.dto.orca.AcceptanceInventoryResponse;
import open.dolphin.rest.dto.orca.AcceptanceOperationRequest;
import open.dolphin.rest.dto.orca.MedicalIdentifierPreflightRequest;
import open.dolphin.rest.dto.orca.MedicalIdentifierPreflightResponse;
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
    void visitListProjectedFallbackUsesPersistedServerDerivedOfficialIdentifiers() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitPatientListResponse stub = new VisitPatientListResponse();
        stub.setApiResult("00");
        stub.setApiResultMessage("OK");
        stub.setVisitDate("2026-04-13");
        when(wrapperService.getVisitList(anyString(), any(VisitPatientListRequest.class))).thenReturn(stub);

        EncounterProjectionRepository encounterProjectionRepository = mock(EncounterProjectionRepository.class);
        when(encounterProjectionRepository.findByFacilityAndAcceptanceRange(anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(new EncounterProjectionRepository.EncounterRow(
                        "F001:ACCEPT-200",
                        "F001",
                        "000200",
                        20L,
                        "F001:ACCEPT-S",
                        "ACCEPT-200",
                        Instant.parse("2026-04-13T00:00:00Z"),
                        "checked_in",
                        null,
                        null,
                        null,
                        "doctor01",
                        null,
                        """
                        {"rawSensitiveFieldsExcluded":true,"clientProvidedIdentifiersTrusted":false,"serverDerivedAuthorityRequired":true,"officialVisitIdentifiers":{"departmentCode":"01","physicianCode":"10001","insuranceCombinationNumber":"0001","voucherNumber":"V-200","sequentialNumber":"S-200"}}
                        """,
                        null,
                        1L,
                        Instant.parse("2026-04-13T00:00:01Z"))));

        ProjectionPatientSummaryRepository projectionPatientSummaryRepository = mock(ProjectionPatientSummaryRepository.class);
        PatientSummary patient = new PatientSummary();
        patient.setPatientId("000200");
        when(projectionPatientSummaryRepository.findByFacilityAndPatientId("F001", "000200")).thenReturn(patient);

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
        assertEquals("F001:S-200", merged.getScheduleKey());
        assertEquals("F001:V-200", merged.getEncounterKey());
        assertEquals("01", merged.getDepartmentCode());
        assertEquals("10001", merged.getPhysicianCode());
        assertEquals("0001", merged.getInsuranceCombinationNumber());
        assertEquals("V-200", merged.getVoucherNumber());
        assertEquals("S-200", merged.getSequentialNumber());
        assertEquals("000200", merged.getPatient().getPatientId());
        assertTrue(response.isFallbackUsed());
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
    void acceptanceInventoryReturnsSanitizedReadonlyRows() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        AcceptanceInventoryResponse stub = new AcceptanceInventoryResponse();
        stub.setApiResult("00");
        stub.setApiResultMessage("OK");
        stub.setTargetReady(true);
        stub.setTargetReadyRowCount(1);
        AcceptanceInventoryResponse.AcceptanceInventoryRow row =
                new AcceptanceInventoryResponse.AcceptanceInventoryRow();
        row.setRowHash("a".repeat(64));
        row.setHasAcceptanceId(true);
        row.setHasPatientId(true);
        row.setHasAcceptanceDate(true);
        row.setHasAcceptanceTime(true);
        row.setHasDepartmentCode(true);
        row.setHasPhysicianCode(true);
        row.setHasInsuranceCombinationNumber(true);
        stub.getRows().add(row);
        when(wrapperService.getAcceptanceInventory(anyString(), any(AcceptanceInventoryRequest.class))).thenReturn(stub);

        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);

        AcceptanceInventoryRequest request = new AcceptanceInventoryRequest();
        request.setAcceptanceDate(LocalDate.of(2026, 4, 27));
        request.setClassCode("active");

        AcceptanceInventoryResponse response =
                resource.acceptanceInventory(createRequest("F001:doctor01", Map.of()), request);

        assertEquals("00", response.getApiResult());
        assertTrue(response.isTargetReady());
        assertTrue(response.isRawSensitiveFieldsExcluded());
        assertEquals(1, response.getRows().size());
        assertEquals("01", request.getClassCode());
        verify(wrapperService).getAcceptanceInventory("F001", request);
    }

    @Test
    void acceptanceInventoryInternalServerFieldsAreNotSerialized() throws Exception {
        AcceptanceInventoryResponse.AcceptanceInventoryRow row =
                new AcceptanceInventoryResponse.AcceptanceInventoryRow();
        row.setRowHash("a".repeat(64));
        row.setServerAcceptanceId("SERVER-A1");
        row.setServerPatientId("000001");
        row.setServerAcceptanceDate("2026-04-28");
        row.setServerAcceptanceTime("09:10:00");
        row.setServerDepartmentCode("01");
        row.setServerPhysicianCode("10001");
        row.setServerMedicalInformation("server-medical-presence");

        String json = new ObjectMapper().writeValueAsString(row);

        assertTrue(json.contains("rowHash"));
        assertTrue(!json.contains("serverAcceptanceId"));
        assertTrue(!json.contains("SERVER-A1"));
        assertTrue(!json.contains("serverPatientId"));
        assertTrue(!json.contains("000001"));
    }

    @Test
    void acceptanceInventoryRejectsMissingRemoteUser() {
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(createService());

        AcceptanceInventoryRequest request = new AcceptanceInventoryRequest();
        request.setAcceptanceDate(LocalDate.of(2026, 4, 27));

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.acceptanceInventory(null, request));
        assertRestError(ex, Response.Status.UNAUTHORIZED.getStatusCode(), "remote_user_missing");
    }

    @Test
    void acceptanceInventoryRejectsUnsupportedClass() {
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(createService());

        AcceptanceInventoryRequest request = new AcceptanceInventoryRequest();
        request.setAcceptanceDate(LocalDate.of(2026, 4, 27));
        request.setClassCode("04");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.acceptanceInventory(createRequest("F001:doctor01", Map.of()), request));
        assertRestError(ex, Response.Status.BAD_REQUEST.getStatusCode(), "orca.acceptance.inventory.invalid");
    }

    @Test
    void serverDerivedRn02AcceptanceOperationUsesOnlyInventoryResolvedIdentifiers() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        String rowHash = "b".repeat(64);
        AcceptanceInventoryResponse inventory = new AcceptanceInventoryResponse();
        AcceptanceInventoryResponse.AcceptanceInventoryRow row =
                new AcceptanceInventoryResponse.AcceptanceInventoryRow();
        row.setRowHash(rowHash);
        row.setHasAcceptanceId(true);
        row.setHasPatientId(true);
        row.setHasAcceptanceDate(true);
        row.setHasAcceptanceTime(true);
        row.setHasDepartmentCode(true);
        row.setHasPhysicianCode(true);
        row.setHasInsuranceCombinationNumber(true);
        row.setServerAcceptanceId("SERVER-A1");
        row.setServerPatientId("000001");
        row.setServerAcceptanceDate("2026-04-28");
        row.setServerAcceptanceTime("09:10:00");
        row.setServerDepartmentCode("01");
        row.setServerPhysicianCode("10001");
        row.setServerMedicalInformation("server-medical-presence");
        inventory.getRows().add(row);
        when(wrapperService.getAcceptanceInventory(anyString(), any(AcceptanceInventoryRequest.class))).thenReturn(inventory);
        VisitMutationResponse stub = new VisitMutationResponse();
        stub.setApiResult("00");
        stub.setApiResultMessage("OK");
        when(wrapperService.mutateVisit(anyString(), any(VisitMutationRequest.class))).thenReturn(stub);

        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);

        AcceptanceOperationRequest request = new AcceptanceOperationRequest();
        request.setRequestNumber("02");
        request.setAcceptanceDate(LocalDate.of(2026, 4, 28));
        request.setClassCode("01");
        request.setTargetRowHash(rowHash);
        request.setDuplicateLiveCheckpoint(
                "acceptmodv2:rn02:trial:acceptlstv2-target-row:" + rowHash + ":date-2026-04-28:request-02");

        VisitMutationResponse response =
                resource.mutateServerDerivedAcceptance(createRequest("F001:doctor01", Map.of()), request);

        assertEquals("00", response.getApiResult());
        verify(wrapperService).getAcceptanceInventory(eq("F001"), argThat(candidate ->
                LocalDate.of(2026, 4, 28).equals(candidate.getAcceptanceDate())
                        && "01".equals(candidate.getClassCode())));
        verify(wrapperService).mutateVisit(eq("F001"), argThat(candidate ->
                "02".equals(candidate.getRequestNumber())
                        && "SERVER-A1".equals(candidate.getAcceptanceId())
                        && "000001".equals(candidate.getPatientId())
                        && "2026-04-28".equals(candidate.getAcceptanceDate())
                        && "09:10:00".equals(candidate.getAcceptanceTime())
                        && "01".equals(candidate.getDepartmentCode())
                        && "10001".equals(candidate.getPhysicianCode())));
    }

    @Test
    void serverDerivedRn02AcceptanceOperationRejectsTargetDriftBeforeMutation() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        when(wrapperService.getAcceptanceInventory(anyString(), any(AcceptanceInventoryRequest.class)))
                .thenReturn(new AcceptanceInventoryResponse());

        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);

        String rowHash = "c".repeat(64);
        AcceptanceOperationRequest request = new AcceptanceOperationRequest();
        request.setRequestNumber("02");
        request.setAcceptanceDate(LocalDate.of(2026, 4, 28));
        request.setClassCode("01");
        request.setTargetRowHash(rowHash);
        request.setDuplicateLiveCheckpoint(
                "acceptmodv2:rn02:trial:acceptlstv2-target-row:" + rowHash + ":date-2026-04-28:request-02");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.mutateServerDerivedAcceptance(createRequest("F001:doctor01", Map.of()), request));

        assertRestError(ex, Response.Status.CONFLICT.getStatusCode(), "orca.acceptance.operation.target_drift");
        verify(wrapperService, never()).mutateVisit(anyString(), any(VisitMutationRequest.class));
    }

    @Test
    void serverDerivedRn02AcceptanceOperationRejectsCheckpointMismatch() {
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(createService());

        AcceptanceOperationRequest request = new AcceptanceOperationRequest();
        request.setRequestNumber("02");
        request.setAcceptanceDate(LocalDate.of(2026, 4, 28));
        request.setClassCode("01");
        request.setTargetRowHash("d".repeat(64));
        request.setDuplicateLiveCheckpoint("wrong");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.mutateServerDerivedAcceptance(createRequest("F001:doctor01", Map.of()), request));

        assertRestError(ex, Response.Status.BAD_REQUEST.getStatusCode(), "orca.acceptance.operation.invalid");
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
    void visitMutationReconcilesAndProjectsServerDerivedOfficialIdentifiers() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitMutationResponse stub = new VisitMutationResponse();
        stub.setApiResult("K3");
        stub.setApiResultMessage("受付登録終了");
        stub.setAcceptanceId("A-100");
        stub.setAcceptanceDate("2025-11-16");
        stub.setAcceptanceTime("09:00:00");
        PatientSummary patient = new PatientSummary();
        patient.setPatientId("000100");
        stub.setPatient(patient);
        when(wrapperService.mutateVisit(anyString(), any(VisitMutationRequest.class))).thenReturn(stub);

        AcceptanceInventoryResponse inventory = new AcceptanceInventoryResponse();
        AcceptanceInventoryResponse.AcceptanceInventoryRow selected = acceptanceInventoryRow(
                "hash-selected", "A-100", "000100", "2025-11-16", "09:00:00", "01", "10001");
        inventory.getRows().add(selected);
        when(wrapperService.getAcceptanceInventory(anyString(), any(AcceptanceInventoryRequest.class))).thenReturn(inventory);

        MedicalIdentifierPreflightResponse identifierPreflight = new MedicalIdentifierPreflightResponse();
        identifierPreflight.setSelectedAcceptanceTargetReady(true);
        identifierPreflight.setMedicalSanitizedRowCount(1);
        MedicalIdentifierPreflightResponse.MedicalIdentifierRow medicalRow =
                new MedicalIdentifierPreflightResponse.MedicalIdentifierRow();
        medicalRow.setHasPerformDate(true);
        medicalRow.setHasDepartmentCode(true);
        medicalRow.setHasInvoiceNumber(true);
        medicalRow.setHasSequentialNumber(true);
        medicalRow.setHasInsuranceCombinationNumber(true);
        medicalRow.setRawSensitiveFieldsExcluded(true);
        medicalRow.setServerPerformDate("2025-11-16");
        medicalRow.setServerDepartmentCode("01");
        medicalRow.setServerInvoiceNumber("INV-100");
        medicalRow.setServerSequentialNumber("S-100");
        medicalRow.setServerInsuranceCombinationNumber("0001");
        identifierPreflight.getMedicalRows().add(medicalRow);
        when(wrapperService.getMedicalIdentifierPreflight(anyString(), any(MedicalIdentifierPreflightRequest.class)))
                .thenReturn(identifierPreflight);

        EncounterProjectionRepository encounterProjectionRepository = mock(EncounterProjectionRepository.class);
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);
        resource.encounterProjectionRepository = encounterProjectionRepository;

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000100");
        request.setAcceptanceDate("2025-11-16");
        request.setAcceptanceTime("09:00:00");
        request.setDepartmentCode("01");
        request.setPhysicianCode("10001");

        VisitMutationResponse response = resource.mutateVisit(createRequest("F001:doctor01", Map.of()), request);

        assertEquals("K3", response.getApiResult());
        assertEquals("A-100", response.getAcceptanceId());
        assertEquals("INV-100", response.getVoucherNumber());
        assertEquals("S-100", response.getSequentialNumber());
        assertEquals("0001", response.getInsuranceCombinationNumber());
        assertTrue(response.getWarnings().contains(
                "acceptance_official_identifiers_reconciled_from_server_readonly_preflight"));
        verify(encounterProjectionRepository).upsertCheckedIn(argThat(command ->
                "F001:A-100".equals(command.encounterKey())
                        && "F001".equals(command.facilityId())
                        && "000100".equals(command.patientId())
                        && "A-100".equals(command.orcaAcceptanceId())
                        && command.worklistFlagsJson().contains("\"clientProvidedIdentifiersTrusted\":false")
                        && command.worklistFlagsJson().contains("\"serverDerivedAuthorityRequired\":true")
                        && command.worklistFlagsJson().contains("\"voucherNumber\":\"INV-100\"")
                        && command.worklistFlagsJson().contains("\"sequentialNumber\":\"S-100\"")
                        && command.worklistFlagsJson().contains("\"insuranceCombinationNumber\":\"0001\"")));
    }

    @Test
    void visitMutationProjectsProvisionalMedicalModContextFromServerDerivedAcceptance() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitMutationResponse stub = new VisitMutationResponse();
        stub.setApiResult("K3");
        stub.setApiResultMessage("受付登録終了");
        stub.setAcceptanceId("A-300");
        stub.setAcceptanceDate("2025-11-16");
        stub.setAcceptanceTime("09:00:00");
        PatientSummary patient = new PatientSummary();
        patient.setPatientId("000300");
        stub.setPatient(patient);
        when(wrapperService.mutateVisit(anyString(), any(VisitMutationRequest.class))).thenReturn(stub);

        AcceptanceInventoryResponse inventory = new AcceptanceInventoryResponse();
        AcceptanceInventoryResponse.AcceptanceInventoryRow selected = acceptanceInventoryRow(
                "hash-provisional", "A-300", "000300", "2025-11-16", "09:00:00", "01", "10001");
        inventory.getRows().add(selected);
        when(wrapperService.getAcceptanceInventory(anyString(), any(AcceptanceInventoryRequest.class))).thenReturn(inventory);

        MedicalIdentifierPreflightResponse identifierPreflight = new MedicalIdentifierPreflightResponse();
        identifierPreflight.setSelectedAcceptanceTargetReady(true);
        when(wrapperService.getMedicalIdentifierPreflight(anyString(), any(MedicalIdentifierPreflightRequest.class)))
                .thenReturn(identifierPreflight);

        EncounterProjectionRepository encounterProjectionRepository = mock(EncounterProjectionRepository.class);
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);
        resource.encounterProjectionRepository = encounterProjectionRepository;

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000300");
        request.setAcceptanceDate("2025-11-16");
        request.setAcceptanceTime("09:00:00");
        request.setDepartmentCode("01");
        request.setPhysicianCode("10001");

        VisitMutationResponse response = resource.mutateVisit(createRequest("F001:doctor01", Map.of()), request);

        assertEquals("A-300", response.getVoucherNumber());
        assertEquals("1", response.getSequentialNumber());
        assertEquals("0001", response.getInsuranceCombinationNumber());
        assertTrue(response.getWarnings().contains(
                "acceptance_provisional_medicalmodv2_context_server_derived_from_acceptlstv2"));
        verify(encounterProjectionRepository).upsertCheckedIn(argThat(command ->
                "F001:A-300".equals(command.encounterKey())
                        && command.worklistFlagsJson().contains("\"provisionalMedicalModV2Context\":true")
                        && command.worklistFlagsJson().contains("\"voucherNumber\":\"A-300\"")
                        && command.worklistFlagsJson().contains("\"sequentialNumber\":\"1\"")
                        && command.worklistFlagsJson().contains("\"clientProvidedIdentifiersTrusted\":false")));
    }

    @Test
    void visitMutationReconcilesDuplicateAcceptanceFromServerDerivedInventory() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitMutationResponse duplicate = new VisitMutationResponse();
        duplicate.setApiResult("16");
        duplicate.setApiResultMessage("診療科・保険組合せで既に受付済みです");
        when(wrapperService.mutateVisit(anyString(), any(VisitMutationRequest.class))).thenReturn(duplicate);

        AcceptanceInventoryResponse inventory = new AcceptanceInventoryResponse();
        AcceptanceInventoryResponse.AcceptanceInventoryRow unrelated = acceptanceInventoryRow(
                "hash-other", "A-999", "000999", "2025-11-16", "09:10:00", "02", "10001");
        AcceptanceInventoryResponse.AcceptanceInventoryRow selected = acceptanceInventoryRow(
                "hash-selected", "A-016", "000016", "2025-11-16", "09:05:00", "01", "10001");
        inventory.getRows().add(unrelated);
        inventory.getRows().add(selected);
        when(wrapperService.getAcceptanceInventory(anyString(), any(AcceptanceInventoryRequest.class))).thenReturn(inventory);
        MedicalIdentifierPreflightResponse identifierPreflight = new MedicalIdentifierPreflightResponse();
        identifierPreflight.setSelectedAcceptanceTargetReady(true);
        identifierPreflight.setMedicalSanitizedRowCount(1);
        MedicalIdentifierPreflightResponse.MedicalIdentifierRow medicalRow =
                new MedicalIdentifierPreflightResponse.MedicalIdentifierRow();
        medicalRow.setHasPerformDate(true);
        medicalRow.setHasDepartmentCode(true);
        medicalRow.setHasInvoiceNumber(true);
        medicalRow.setHasSequentialNumber(true);
        medicalRow.setHasInsuranceCombinationNumber(true);
        medicalRow.setRawSensitiveFieldsExcluded(true);
        medicalRow.setServerPerformDate("20251116");
        medicalRow.setServerDepartmentCode("01");
        medicalRow.setServerInvoiceNumber("INV-016");
        medicalRow.setServerSequentialNumber("1");
        medicalRow.setServerInsuranceCombinationNumber("MED-0001");
        identifierPreflight.getMedicalRows().add(medicalRow);
        when(wrapperService.getMedicalIdentifierPreflight(anyString(), any(MedicalIdentifierPreflightRequest.class)))
                .thenReturn(identifierPreflight);

        EncounterProjectionRepository encounterProjectionRepository = mock(EncounterProjectionRepository.class);
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);
        resource.encounterProjectionRepository = encounterProjectionRepository;

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000016");
        request.setAcceptanceDate("2025-11-16");
        request.setAcceptanceTime("09:00:00");
        request.setDepartmentCode("01");
        request.setPhysicianCode("10001");

        VisitMutationResponse response = resource.mutateVisit(createRequest("F001:doctor01", Map.of()), request);

        assertEquals("16", response.getApiResult());
        assertEquals("A-016", response.getAcceptanceId());
        assertEquals("F001:A-016", response.getEncounterKey());
        assertEquals("INV-016", response.getVoucherNumber());
        assertEquals("1", response.getSequentialNumber());
        assertEquals("MED-0001", response.getInsuranceCombinationNumber());
        assertEquals("000016", response.getPatient().getPatientId());
        assertTrue(response.getWarnings().contains("duplicate_acceptance_reconciled_from_server_derived_acceptlstv2"));
        assertTrue(response.getWarnings().contains(
                "duplicate_acceptance_official_identifiers_reconciled_from_server_readonly_preflight"));
        verify(wrapperService).getAcceptanceInventory(eq("F001"), argThat(candidate ->
                LocalDate.of(2025, 11, 16).equals(candidate.getAcceptanceDate())
                        && "01".equals(candidate.getClassCode())));
        verify(wrapperService).getMedicalIdentifierPreflight(eq("F001"), argThat(candidate ->
                LocalDate.of(2025, 11, 16).equals(candidate.getAcceptanceDate())
                        && "01".equals(candidate.getClassCode())
                        && "01".equals(candidate.getMedicalGetClassCode())
                        && "hash-selected".equals(candidate.getTargetRowHash())));
        verify(encounterProjectionRepository).upsertCheckedIn(argThat(command ->
                "F001:A-016".equals(command.encounterKey())
                        && "F001".equals(command.facilityId())
                        && "000016".equals(command.patientId())
                        && "A-016".equals(command.orcaAcceptanceId())
                        && command.worklistFlagsJson().contains("\"clientProvidedIdentifiersTrusted\":false")
                        && command.worklistFlagsJson().contains("\"voucherNumber\":\"INV-016\"")
                        && command.worklistFlagsJson().contains("\"sequentialNumber\":\"1\"")
                        && command.worklistFlagsJson().contains("\"insuranceCombinationNumber\":\"MED-0001\"")));
    }

    @Test
    void visitMutationDuplicateAcceptanceDoesNotReconcileAmbiguousInventory() {
        OrcaLiveGateway wrapperService = mock(OrcaLiveGateway.class);
        VisitMutationResponse duplicate = new VisitMutationResponse();
        duplicate.setApiResult("16");
        when(wrapperService.mutateVisit(anyString(), any(VisitMutationRequest.class))).thenReturn(duplicate);

        AcceptanceInventoryResponse inventory = new AcceptanceInventoryResponse();
        inventory.getRows().add(acceptanceInventoryRow("hash-1", "A-016-A", "000016", "2025-11-16", "09:05:00", "01", "10001"));
        inventory.getRows().add(acceptanceInventoryRow("hash-2", "A-016-B", "000016", "2025-11-16", "09:15:00", "01", "10001"));
        when(wrapperService.getAcceptanceInventory(anyString(), any(AcceptanceInventoryRequest.class))).thenReturn(inventory);

        EncounterProjectionRepository encounterProjectionRepository = mock(EncounterProjectionRepository.class);
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);
        resource.encounterProjectionRepository = encounterProjectionRepository;

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000016");
        request.setAcceptanceDate("2025-11-16");
        request.setAcceptanceTime("09:00:00");
        request.setDepartmentCode("01");
        request.setPhysicianCode("10001");

        VisitMutationResponse response = resource.mutateVisit(createRequest("F001:doctor01", Map.of()), request);

        assertEquals("16", response.getApiResult());
        assertNull(response.getAcceptanceId());
        assertNull(response.getEncounterKey());
        verify(encounterProjectionRepository, never()).upsertCheckedIn(any());
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

    private AcceptanceInventoryResponse.AcceptanceInventoryRow acceptanceInventoryRow(String rowHash,
            String acceptanceId,
            String patientId,
            String acceptanceDate,
            String acceptanceTime,
            String departmentCode,
            String physicianCode) {
        AcceptanceInventoryResponse.AcceptanceInventoryRow row = new AcceptanceInventoryResponse.AcceptanceInventoryRow();
        row.setRowHash(rowHash);
        row.setHasAcceptanceId(true);
        row.setHasPatientId(true);
        row.setHasAcceptanceDate(true);
        row.setHasAcceptanceTime(true);
        row.setHasDepartmentCode(true);
        row.setHasPhysicianCode(true);
        row.setHasInsuranceCombinationNumber(true);
        row.setRawSensitiveFieldsExcluded(true);
        row.setServerAcceptanceId(acceptanceId);
        row.setServerPatientId(patientId);
        row.setServerAcceptanceDate(acceptanceDate);
        row.setServerAcceptanceTime(acceptanceTime);
        row.setServerDepartmentCode(departmentCode);
        row.setServerPhysicianCode(physicianCode);
        row.setServerInsuranceCombinationNumber("0001");
        return row;
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
