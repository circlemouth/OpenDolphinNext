package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV2Request;

class OrcaChartSupportSupportTest {

    private final OrcaChartSupportSupport support = new OrcaChartSupportSupport();

    @Test
    void buildMedicalModV2RequestXmlIncludesInitialConsultation() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("12345");
        payload.setPerformDate("2026-03-22T08:00:00");
        payload.setDepartmentCode("01");
        payload.setIncludeInitialConsultation(true);

        String xml = support.buildMedicalModV2RequestXml(payload);

        assertTrue(xml.contains("<Patient_ID type=\"string\">12345</Patient_ID>"));
        assertTrue(xml.contains("<Medical_Class type=\"string\">11</Medical_Class>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">110000010</Medication_Code>"));
    }

    @Test
    void parseIncomeInfoResponseReadsNumericFields() {
        String xml = """
                <data>
                  <incomeinfores type="record">
                    <Api_Result>0000</Api_Result>
                    <Api_Result_Message>OK</Api_Result_Message>
                    <Information_Date>20260322</Information_Date>
                    <Information_Time>081500</Information_Time>
                    <Income_Information_child type="record">
                      <Perform_Date>2026-03-01</Perform_Date>
                      <Perform_End_Date>2026-03-31</Perform_End_Date>
                      <InOut>O</InOut>
                      <Invoice_Number>INV-1</Invoice_Number>
                      <Department_Name>Internal</Department_Name>
                      <Insurance_Combination_Number>ABCD</Insurance_Combination_Number>
                      <Cd_Information type="record">
                        <Ac_Money>100.5</Ac_Money>
                        <Ic_Money>20.25</Ic_Money>
                        <Ai_Money>3.5</Ai_Money>
                        <Oe_Money>1.0</Oe_Money>
                        <Ml_Smoney>0.0</Ml_Smoney>
                      </Cd_Information>
                    </Income_Information_child>
                  </incomeinfores>
                </data>
                """;

        ChartSupportIncomeInfoResponse response = support.parseIncomeInfoResponse(
                OrcaTransportResult.fallback(xml, "application/xml"),
                "run-1",
                "trace-1");

        assertEquals("0000", response.getApiResult());
        assertTrue(response.isOk());
        assertTrue(response.isApiOk());
        assertEquals(1, response.getEntries().size());
        ChartSupportIncomeInfoResponse.Entry entry = response.getEntries().get(0);
        assertEquals(100.5, entry.getAcMoney(), 0.0001);
        assertEquals(20.25, entry.getIcMoney(), 0.0001);
        assertNotNull(entry.getDepartmentName());
        assertEquals("Internal", entry.getDepartmentName());
    }
}
