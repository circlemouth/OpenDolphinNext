package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDate;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.BillingSimulationRequest;
import open.dolphin.rest.dto.orca.OrcaAppointmentListRequest;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientNameSearchRequest;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import org.junit.jupiter.api.Test;

class OrcaWrapperServiceFailClosedTest {

    private final OrcaTransport failingTransport = new AlwaysFailTransport();
    private final OrcaWrapperService service = new OrcaWrapperService(failingTransport, new OrcaXmlMapper());

    @Test
    void appointmentListDoesNotFallbackToSamplePayloadWhenTransportFails() {
        OrcaAppointmentListRequest request = new OrcaAppointmentListRequest();
        request.setAppointmentDate(LocalDate.of(2025, 11, 13));

        assertThrows(OrcaGatewayException.class, () -> service.getAppointmentList(request));
    }

    @Test
    void patientBatchDoesNotFallbackToSamplePayloadWhenTransportFails() {
        PatientBatchRequest request = new PatientBatchRequest();
        request.getPatientIds().add("000001");

        assertThrows(OrcaGatewayException.class, () -> service.getPatientBatch(request));
    }

    @Test
    void patientSearchDoesNotFallbackToSamplePayloadWhenTransportFails() {
        PatientNameSearchRequest request = new PatientNameSearchRequest();
        request.setName("山田");

        assertThrows(OrcaGatewayException.class, () -> service.searchPatients(request));
    }

    @Test
    void visitMutationDoesNotFallbackToSamplePayloadWhenTransportFails() {
        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000001");
        request.setAcceptanceDate("2025-11-16");
        request.setAcceptanceTime("09:00:00");

        assertThrows(OrcaGatewayException.class, () -> service.mutateVisit(request));
    }

    @Test
    void billingSimulationDoesNotFallbackToSamplePayloadWhenTransportFails() {
        BillingSimulationRequest request = new BillingSimulationRequest();
        request.setPatientId("000001");
        request.setPerformDate(LocalDate.of(2025, 11, 12));
        BillingSimulationRequest.BillingItem item = new BillingSimulationRequest.BillingItem();
        item.setMedicalCode("D000");
        item.setQuantity(1);
        request.getItems().add(item);

        assertThrows(OrcaGatewayException.class, () -> service.simulateBilling(request));
    }

    private static final class AlwaysFailTransport implements OrcaTransport {

        @Override
        public String invoke(OrcaEndpoint endpoint, String requestXml) {
            throw new OrcaGatewayException("transport unavailable for " + endpoint.name());
        }

        @Override
        public OrcaTransportResult invokeDetailed(OrcaEndpoint endpoint, OrcaTransportRequest request) {
            throw new OrcaGatewayException("transport unavailable for " + endpoint.name());
        }
    }
}
