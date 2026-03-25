package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import open.dolphin.rest.dto.orca.InsuranceCombinationRequest;

class OrcaLiveGatewaySupportTest {

    @Test
    void insuranceCombinationPayloadUsesBaseDateContract() {
        OrcaLiveGatewaySupport support = new OrcaLiveGatewaySupport();
        InsuranceCombinationRequest request = new InsuranceCombinationRequest();
        request.setPatientId("000019");
        request.setBaseDate(LocalDate.of(2025, 3, 21).toString());
        request.setRangeStart("2025-03-01");
        request.setRangeEnd("2025-03-31");

        String payload = support.buildInsuranceCombinationPayload(request);

        assertTrue(payload.contains("<Perform_Date>2025-03-21</Perform_Date>"));
        assertTrue(payload.contains("<Patient_ID>000019</Patient_ID>"));
    }
}
