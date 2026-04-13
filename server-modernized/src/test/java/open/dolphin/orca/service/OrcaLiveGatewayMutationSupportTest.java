package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import org.junit.jupiter.api.Test;

class OrcaLiveGatewayMutationSupportTest {

    private final OrcaLiveGatewayMutationSupport support = new OrcaLiveGatewayMutationSupport();

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

    @Test
    void buildVisitMutationPayloadUsesCanonicalCodesWithoutClientSideNormalization() {
        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000001");
        request.setAcceptanceDate("2026-04-13");
        request.setAcceptanceTime("09:15:00");
        request.setAcceptancePush("1");
        request.setDepartmentCode("07");
        request.setPhysicianCode("0001");
        request.setMedicalInformation("02");

        String xml = support.buildVisitMutationPayload(request);

        assertTrue(xml.contains("<Acceptance_Push>1</Acceptance_Push>"));
        assertTrue(xml.contains("<Department_Code>07</Department_Code>"));
        assertTrue(xml.contains("<Physician_Code>0001</Physician_Code>"));
        assertTrue(xml.contains("<Medical_Information>02</Medical_Information>"));
        assertTrue(!xml.contains("<Physician_Code>10001</Physician_Code>"));
    }

    @Test
    void buildVisitMutationPayloadOmitsMedicalInformationWhenUnselected() {
        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000001");
        request.setAcceptanceDate("2026-04-13");
        request.setAcceptanceTime("09:15:00");
        request.setDepartmentCode("01");
        request.setPhysicianCode("10001");
        request.setMedicalInformation("   ");

        String xml = support.buildVisitMutationPayload(request);

        assertTrue(!xml.contains("<Medical_Information>"));
    }
}
