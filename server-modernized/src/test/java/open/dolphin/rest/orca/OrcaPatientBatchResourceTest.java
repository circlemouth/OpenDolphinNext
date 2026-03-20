package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.WebApplicationException;
import java.time.LocalDate;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.service.OrcaWrapperService;
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

    private OrcaWrapperService createService() {
        return new OrcaWrapperService(new StubOrcaTransport(), new OrcaXmlMapper());
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

        PatientBatchResponse response = resource.patientBatch(null, request);
        assertEquals(2, response.getPatients().size());
        assertEquals(2, response.getTargetPatientCount());
        assertEquals(0, response.getNoTargetPatientCount());
        assertGeneratedRunId(response.getRunId());
    }

    @Test
    void patientSearchRequiresNameOrKana() {
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

        PatientSearchResponse response = resource.patientSearch(null, request);
        assertEquals(1, response.getTargetPatientCount());
        assertEquals(0, response.getNoTargetPatientCount());
    }

    @Test
    void formerNamesReturnsHistory() {
        OrcaPatientBatchResource resource = new OrcaPatientBatchResource();
        resource.setWrapperService(createService());
        FormerNameHistoryRequest request = new FormerNameHistoryRequest();
        request.setPatientId("000020");

        FormerNameHistoryResponse response = resource.formerNames(null, request);
        assertEquals(2, response.getFormerNames().size());
    }

    @Test
    void patientIdListReturnsTargetCountWithTestFlag() {
        OrcaPatientBatchResource resource = new OrcaPatientBatchResource();
        resource.setWrapperService(createService());
        PatientIdListRequest request = new PatientIdListRequest();
        request.setStartDate(LocalDate.of(2025, 11, 1));
        request.setIncludeTestPatient(true);

        PatientIdListResponse response = resource.patientIdList(null, request);
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

        assertThrows(WebApplicationException.class, () -> resource.insuranceCombinations(null, request));
    }

    private void assertGeneratedRunId(String runId) {
        assertNotNull(runId);
        assertTrue(runId.matches("\\d{8}T\\d{6}Z"));
    }
}
