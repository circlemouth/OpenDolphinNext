package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModResponse;
import org.junit.jupiter.api.Test;

class OrcaBillingCorrectionScenarioSupportTest {

    @Test
    void medicalModWarningsRemainCorrectionNotesAndDoNotInventPaidConfirmation() {
        OrcaChartSupportSupport support = new OrcaChartSupportSupport();

        ChartSupportMedicalModResponse response = support.parseMedicalModResponse(
                OrcaTransportResult.fallback("""
                        <data>
                          <medicalres type="record">
                            <Api_Result type="string">00</Api_Result>
                            <Api_Result_Message type="string">OK</Api_Result_Message>
                            <Invoice_Number type="string">INV-001</Invoice_Number>
                            <Data_Id type="string">DATA-001</Data_Id>
                            <Medical_Warning_Info type="array">
                              <Medical_Warning_Info_child type="record">
                                <Medical_Warning type="string">W01</Medical_Warning>
                                <Medical_Warning_Message type="string">補正候補あり</Medical_Warning_Message>
                                <Medical_Warning_Position type="string">1</Medical_Warning_Position>
                                <Medical_Warning_Item_Position type="string">2</Medical_Warning_Item_Position>
                                <Medical_Warning_Code type="string">WARN-01</Medical_Warning_Code>
                              </Medical_Warning_Info_child>
                            </Medical_Warning_Info>
                          </medicalres>
                        </data>
                        """, "application/xml"),
                "RUN-1",
                "TRACE-1");

        assertTrue(response.isOk());
        assertEquals("INV-001", response.getInvoiceNumber());
        assertEquals("DATA-001", response.getDataId());
        assertEquals("ORCA_WARNING", response.getOperationStatus());
        assertTrue(response.isNeedsUserReview());
        assertEquals(1, response.getMedicalWarnings().size());
        assertEquals("補正候補あり", response.getMedicalWarnings().get(0).getMedicalWarningMessage());
    }

    @Test
    void medicalModBusinessRejectAndTransportFailureUseFixedReviewStatuses() {
        OrcaChartSupportSupport support = new OrcaChartSupportSupport();

        ChartSupportMedicalModResponse businessRejected = support.parseMedicalModResponse(
                OrcaTransportResult.fallback("""
                        <data>
                          <medicalres type="record">
                            <Api_Result type="string">80</Api_Result>
                            <Api_Result_Message type="string">受付できません</Api_Result_Message>
                          </medicalres>
                        </data>
                        """, "application/xml"),
                "RUN-REJECT",
                "TRACE-REJECT");
        assertEquals("ORCA_REJECTED", businessRejected.getOperationStatus());
        assertTrue(businessRejected.isNeedsUserReview());

        ChartSupportMedicalModResponse transportFailed = support.parseMedicalModResponse(
                new OrcaTransportResult(null, "POST", 503, """
                        <data>
                          <medicalres type="record">
                            <Api_Result type="string">00</Api_Result>
                          </medicalres>
                        </data>
                        """, "application/xml", java.util.Map.of()),
                "RUN-NET",
                "TRACE-NET");
        assertEquals("NETWORK_FAILED", transportFailed.getOperationStatus());
        assertTrue(transportFailed.isNeedsUserReview());
    }

    @Test
    void incomeInfoKeepsConfirmationSourceSeparateFromMedicalModResponse() {
        OrcaChartSupportSupport support = new OrcaChartSupportSupport();

        ChartSupportIncomeInfoResponse response = support.parseIncomeInfoResponse(
                OrcaTransportResult.fallback("""
                        <data>
                          <incomeinfores type="record">
                            <Api_Result type="string">0000</Api_Result>
                            <Api_Result_Message type="string">OK</Api_Result_Message>
                            <Income_Information type="array">
                              <Income_Information_child type="record">
                                <Perform_Date type="string">2026-04-17</Perform_Date>
                                <Invoice_Number type="string">INV-001</Invoice_Number>
                                <Department_Name type="string">内科</Department_Name>
                                <Cd_Information type="record">
                                  <Ac_Money type="string">1200</Ac_Money>
                                  <Ic_Money type="string">1200</Ic_Money>
                                </Cd_Information>
                              </Income_Information_child>
                            </Income_Information>
                          </incomeinfores>
                        </data>
                        """, "application/xml"),
                "RUN-2",
                "TRACE-2");

        assertTrue(response.isOk());
        assertEquals(1, response.getEntries().size());
        assertEquals("INV-001", response.getEntries().get(0).getInvoiceNumber());
        assertEquals(1200.0, response.getEntries().get(0).getIcMoney(), 0.0001);
        assertEquals("RUN-2", response.getRunId());
    }
}
