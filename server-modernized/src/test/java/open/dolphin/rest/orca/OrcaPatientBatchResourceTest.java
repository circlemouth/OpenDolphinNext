package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.util.Map;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.service.DefaultOrcaLiveGateway;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.orca.transport.StubOrcaTransport;
import open.dolphin.rest.dto.orca.FormerNameHistoryRequest;
import open.dolphin.rest.dto.orca.FormerNameHistoryResponse;
import open.dolphin.rest.dto.orca.InsuranceCombinationRequest;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientIdListRequest;
import open.dolphin.rest.dto.orca.PatientIdListResponse;
import open.dolphin.rest.dto.orca.PatientNameSearchRequest;
import open.dolphin.rest.dto.orca.PatientSearchResponse;
import org.junit.jupiter.api.Test;

class OrcaPatientBatchResourceTest {

    private OrcaLiveGateway createService() {
        return new DefaultOrcaLiveGateway(new StubOrcaTransport(), new OrcaXmlMapper());
    }

    @Test
    void patientIdListRequiresStartDate() {
        OrcaPatientBatchResource resource = new OrcaPatientBatchResource();
        resource.setWrapperService(createService());
        assertThrows(WebApplicationException.class, () -> resource.patientIdList(null, new PatientIdListRequest()));
    }

    @Test
    void patientBatchReturnsTwoPatients() {
        OrcaPatientBatchResource resource = new OrcaPatientBatchResource();
        resource.setWrapperService(createService());

        PatientBatchRequest request = new PatientBatchRequest();
        request.getPatientIds().add("000001");
        request.getPatientIds().add("000002");

        PatientBatchResponse response = resource.patientBatch(
                createRequest("F001:doctor01", "/api/orca/official/patients/batch", Map.of()), request);
        assertEquals(2, response.getPatients().size());
        assertEquals(2, response.getTargetPatientCount());
        assertEquals(0, response.getNoTargetPatientCount());
        assertGeneratedRunId(response.getRunId());
    }

    @Test
    void patientBatchRejectsMissingFacility() {
        OrcaPatientBatchResource resource = new OrcaPatientBatchResource();
        resource.setWrapperService(createService());

        PatientBatchRequest request = new PatientBatchRequest();
        request.getPatientIds().add("000001");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.patientBatch(createRequest(null, "/api/orca/official/patients/batch", Map.of()), request));
        assertEquals(401, ex.getResponse().getStatus());
    }

    @Test
    void patientSearchRequiresWholeName() {
        OrcaPatientBatchResource resource = new OrcaPatientBatchResource();
        resource.setWrapperService(createService());
        PatientNameSearchRequest request = new PatientNameSearchRequest();
        assertThrows(WebApplicationException.class, () -> resource.patientSearch(null, request));
    }

    @Test
    void patientSearchRejectsBirthEndDateWithoutStart() {
        OrcaPatientBatchResource resource = new OrcaPatientBatchResource();
        resource.setWrapperService(createService());
        PatientNameSearchRequest request = new PatientNameSearchRequest();
        request.setName("山田");
        request.setBirthEndDate(LocalDate.of(1980, 1, 1));
        assertThrows(WebApplicationException.class, () -> resource.patientSearch(null, request));
    }

    @Test
    void patientSearchRejectsReverseBirthRange() {
        OrcaPatientBatchResource resource = new OrcaPatientBatchResource();
        resource.setWrapperService(createService());
        PatientNameSearchRequest request = new PatientNameSearchRequest();
        request.setName("山田");
        request.setBirthStartDate(LocalDate.of(1985, 1, 1));
        request.setBirthEndDate(LocalDate.of(1980, 1, 1));
        assertThrows(WebApplicationException.class, () -> resource.patientSearch(null, request));
    }

    @Test
    void patientSearchReturnsPaginationIndicators() {
        OrcaPatientBatchResource resource = new OrcaPatientBatchResource();
        resource.setWrapperService(createService());
        PatientNameSearchRequest request = new PatientNameSearchRequest();
        request.setName("山田");

        PatientSearchResponse response = resource.patientSearch(
                createRequest("F001:doctor01", "/api/orca/official/patients/name-search", Map.of()), request);
        assertEquals(1, response.getTargetPatientCount());
        assertEquals(0, response.getNoTargetPatientCount());
    }

    @Test
    void formerNamesReturnsHistory() {
        OrcaPatientBatchResource resource = new OrcaPatientBatchResource();
        resource.setWrapperService(createService());
        FormerNameHistoryRequest request = new FormerNameHistoryRequest();
        request.setPatientId("000020");

        FormerNameHistoryResponse response = resource.formerNames(
                createRequest("F001:doctor01", "/api/orca/official/patients/former-names", Map.of()), request);
        assertEquals(2, response.getFormerNames().size());
    }

    @Test
    void patientIdListReturnsTargetCountWithTestFlag() {
        OrcaPatientBatchResource resource = new OrcaPatientBatchResource();
        resource.setWrapperService(createService());
        PatientIdListRequest request = new PatientIdListRequest();
        request.setStartDate(LocalDate.of(2025, 11, 1));
        request.setIncludeTestPatient(true);

        PatientIdListResponse response = resource.patientIdList(
                createRequest("F001:doctor01", "/api/orca/official/patients/id-list", Map.of()), request);
        assertEquals(2, response.getTargetPatientCount());
        assertEquals("0", response.getPatients().get(0).getTestPatientFlag());
    }

    @Test
    void insuranceCombinationsRejectsReverseRange() {
        OrcaPatientBatchResource resource = new OrcaPatientBatchResource();
        resource.setWrapperService(createService());
        InsuranceCombinationRequest request = new InsuranceCombinationRequest();
        request.setPatientId("000019");
        request.setRangeStart("2025-12-01");
        request.setRangeEnd("2025-11-01");

        assertThrows(WebApplicationException.class, () ->
                resource.insuranceCombinations(createRequest("F001:doctor01", "/api/orca/official/insurance/combinations", Map.of()), request));
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
                                return headers.get(String.valueOf(args[0]));
                            }
                            return null;
                        default:
                            return null;
                    }
                });
    }

    private void assertGeneratedRunId(String runId) {
        assertNotNull(runId);
        assertTrue(runId.matches("\\d{8}T\\d{6}Z"));
    }
}
