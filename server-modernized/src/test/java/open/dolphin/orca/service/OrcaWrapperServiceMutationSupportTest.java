package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import org.junit.jupiter.api.Test;

class OrcaWrapperServiceMutationSupportTest {

    private final OrcaWrapperServiceMutationSupport support = new OrcaWrapperServiceMutationSupport();

    @Test
    void normalizeAcceptRequestNumberAcceptsRequestNumber04() {
        assertEquals("04", support.normalizeAcceptRequestNumber("04"));
        assertEquals("04", support.normalizeAcceptRequestNumber("claim-send"));
    }

    @Test
    void buildVisitMutationPayloadIncludesClaimSendInfoForRequestNumber04() {
        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("04");
        request.setPatientId("000001");
        request.setAcceptanceTime("09:00:00");
        request.setDepartmentCode("01");
        request.setClaimSendInfo("claim_send_info=02");

        String xml = support.buildVisitMutationPayload(request);

        assertTrue(xml.contains("<Request_Number>04</Request_Number>"));
        assertTrue(xml.contains("<Claim_Send_Info>02</Claim_Send_Info>"));
        assertTrue(xml.contains("<Acceptance_Time>09:00:00</Acceptance_Time>"));
        assertTrue(xml.contains("<Department_Code>01</Department_Code>"));
    }

    @Test
    void buildVisitMutationPayloadRejectsInvalidClaimSendInfo() {
        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("04");
        request.setPatientId("000001");
        request.setAcceptanceTime("09:00:00");
        request.setDepartmentCode("01");
        request.setClaimSendInfo("09");

        assertThrows(OrcaGatewayException.class, () -> support.buildVisitMutationPayload(request));
    }
}
