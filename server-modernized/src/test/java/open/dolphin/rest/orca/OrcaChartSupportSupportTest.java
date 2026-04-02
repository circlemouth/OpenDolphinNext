package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
        payload.setClassCode("01");
        payload.setDepartmentCode("01");
        payload.setIncludeInitialConsultation(true);
        payload.setMedicalPush("Yes");
        payload.setMedicalUid("M-001");

        String xml = support.buildMedicalModV2RequestXml(payload);

        assertTrue(xml.contains("<Patient_ID type=\"string\">12345</Patient_ID>"));
        assertTrue(xml.contains("<Medical_Push type=\"string\">Yes</Medical_Push>"));
        assertTrue(xml.contains("<Medical_Uid type=\"string\">M-001</Medical_Uid>"));
        assertTrue(xml.contains("<Medical_Class type=\"string\">11</Medical_Class>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">110000010</Medication_Code>"));
    }

    @Test
    void buildMedicalModV2RequestXmlSerializesMedicationUnitAndGenericFlag() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("12345");
        payload.setPerformDate("2026-03-22T08:00:00");
        payload.setDepartmentCode("01");

        ChartSupportMedicalModV2Request.MedicalInformation information = new ChartSupportMedicalModV2Request.MedicalInformation();
        information.setMedicalClass("21");
        information.setMedicalClassName("処方");
        information.setMedicalClassNumber("2");
        ChartSupportMedicalModV2Request.Medication medication = new ChartSupportMedicalModV2Request.Medication();
        medication.setCode("620000001");
        medication.setName("アムロジピン");
        medication.setNumber("1");
        medication.setUnit("錠");
        medication.setGenericFlg("yes");
        information.setMedications(List.of(medication));
        payload.setMedicalInformation(List.of(information));

        String xml = support.buildMedicalModV2RequestXml(payload);

        assertTrue(xml.contains("<Medical_Class type=\"string\">21</Medical_Class>"));
        assertTrue(xml.contains("<Medical_Class_Name type=\"string\">処方</Medical_Class_Name>"));
        assertTrue(xml.contains("<Medical_Class_Number type=\"string\">2</Medical_Class_Number>"));
        assertTrue(xml.contains("<Medication_Number type=\"string\">1</Medication_Number>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">錠</Medication_Unit_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code_Name type=\"string\">錠</Medication_Unit_Code_Name>"));
        assertTrue(xml.contains("<Medication_Generic_Flg type=\"string\">yes</Medication_Generic_Flg>"));
    }

    @Test
    void buildMedicalModV2RequestXmlSerializesBodyPartAndMixedUnits() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("12345");
        payload.setPerformDate("2026-03-22T08:00:00");
        payload.setDepartmentCode("01");

        ChartSupportMedicalModV2Request.MedicalInformation information = new ChartSupportMedicalModV2Request.MedicalInformation();
        information.setMedicalClass("70");
        information.setMedicalClassName("放射線");
        information.setMedicalClassNumber("1");

        ChartSupportMedicalModV2Request.Medication bodyPart = new ChartSupportMedicalModV2Request.Medication();
        bodyPart.setCode("002001");
        bodyPart.setName("胸部");
        bodyPart.setNumber("1");
        bodyPart.setUnit("部位");

        ChartSupportMedicalModV2Request.Medication main = new ChartSupportMedicalModV2Request.Medication();
        main.setCode("170017510");
        main.setName("ＣＴ撮影");
        main.setNumber("1");
        main.setUnit("回");

        ChartSupportMedicalModV2Request.Medication material = new ChartSupportMedicalModV2Request.Medication();
        material.setCode("700000001");
        material.setName("造影剤");
        material.setNumber("1");
        material.setUnit("本");

        information.setMedications(List.of(bodyPart, main, material));
        payload.setMedicalInformation(List.of(information));

        String xml = support.buildMedicalModV2RequestXml(payload);

        assertTrue(xml.contains("<Medical_Class type=\"string\">70</Medical_Class>"));
        assertTrue(xml.contains("<Medical_Class_Number type=\"string\">1</Medical_Class_Number>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">002001</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">部位</Medication_Unit_Code>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">170017510</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">回</Medication_Unit_Code>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">700000001</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">本</Medication_Unit_Code>"));
    }

    @Test
    void parseMedicalModResponseMarksApiErrorAsFailure() {
        String xml = """
                <data>
                  <medicalmodres type="record">
                    <Api_Result>E90</Api_Result>
                    <Api_Result_Message>busy</Api_Result_Message>
                    <Medical_Uid>M-002</Medical_Uid>
                  </medicalmodres>
                </data>
                """;

        var response = support.parseMedicalModResponse(
                OrcaTransportResult.fallback(xml, "application/xml"),
                "run-1",
                "trace-1");

        assertFalse(response.isOk());
        assertFalse(response.isApiOk());
        assertEquals("M-002", response.getMedicalUid());
        assertEquals("busy", response.getError());
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
