package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV2Request;
import org.junit.jupiter.api.Test;

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
        information.setMedicalClassName("Prescription");
        information.setMedicalClassNumber("2");
        ChartSupportMedicalModV2Request.Medication medication = new ChartSupportMedicalModV2Request.Medication();
        medication.setCode("620000001");
        medication.setName("amlodipine");
        medication.setNumber("1");
        medication.setUnit("tablet");
        medication.setGenericFlg("yes");
        information.setMedications(List.of(medication));
        payload.setMedicalInformation(List.of(information));

        String xml = support.buildMedicalModV2RequestXml(payload);

        assertTrue(xml.contains("<Medical_Class type=\"string\">21</Medical_Class>"));
        assertTrue(xml.contains("<Medical_Class_Name type=\"string\">Prescription</Medical_Class_Name>"));
        assertTrue(xml.contains("<Medical_Class_Number type=\"string\">2</Medical_Class_Number>"));
        assertTrue(xml.contains("<Medication_Number type=\"string\">1</Medication_Number>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">tablet</Medication_Unit_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code_Name type=\"string\">tablet</Medication_Unit_Code_Name>"));
        assertTrue(xml.contains("<Medication_Generic_Flg type=\"string\">yes</Medication_Generic_Flg>"));
    }

    @Test
    void buildMedicalModV2RequestXmlSerializesPrescriptionWithTwoDrugsAndComment() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("12345");
        payload.setPerformDate("2026-03-22T08:00:00");
        payload.setDepartmentCode("01");

        ChartSupportMedicalModV2Request.MedicalInformation information = new ChartSupportMedicalModV2Request.MedicalInformation();
        information.setMedicalClass("212");
        information.setMedicalClassName("Oral");
        information.setMedicalClassNumber("7");

        ChartSupportMedicalModV2Request.Medication firstDrug = new ChartSupportMedicalModV2Request.Medication();
        firstDrug.setCode("620000001");
        firstDrug.setName("amlodipine-5mg");
        firstDrug.setNumber("1");
        firstDrug.setUnit("tablet");
        firstDrug.setGenericFlg("no");

        ChartSupportMedicalModV2Request.Medication secondDrug = new ChartSupportMedicalModV2Request.Medication();
        secondDrug.setCode("620000002");
        secondDrug.setName("losartan-50mg");
        secondDrug.setNumber("1");
        secondDrug.setUnit("tablet");

        ChartSupportMedicalModV2Request.Medication comment = new ChartSupportMedicalModV2Request.Medication();
        comment.setCode("008200001");
        comment.setName("after-meal-comment");

        information.setMedications(List.of(firstDrug, secondDrug, comment));
        payload.setMedicalInformation(List.of(information));

        String xml = support.buildMedicalModV2RequestXml(payload);

        assertTrue(xml.contains("<Medical_Class type=\"string\">212</Medical_Class>"));
        assertTrue(xml.contains("<Medical_Class_Name type=\"string\">Oral</Medical_Class_Name>"));
        assertTrue(xml.contains("<Medical_Class_Number type=\"string\">7</Medical_Class_Number>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">620000001</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Generic_Flg type=\"string\">no</Medication_Generic_Flg>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">620000002</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">008200001</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Name type=\"string\">after-meal-comment</Medication_Name>"));
    }

    @Test
    void buildMedicalModV2RequestXmlSerializesRadiologyBodyPartMaterialAndCommentInOrder() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("12345");
        payload.setPerformDate("2026-03-22T08:00:00");
        payload.setDepartmentCode("01");

        ChartSupportMedicalModV2Request.MedicalInformation information = new ChartSupportMedicalModV2Request.MedicalInformation();
        information.setMedicalClass("700");
        information.setMedicalClassName("Radiology");
        information.setMedicalClassNumber("1");

        ChartSupportMedicalModV2Request.Medication bodyPart = new ChartSupportMedicalModV2Request.Medication();
        bodyPart.setCode("002001");
        bodyPart.setName("chest");
        bodyPart.setNumber("1");
        bodyPart.setUnit("part");

        ChartSupportMedicalModV2Request.Medication main = new ChartSupportMedicalModV2Request.Medication();
        main.setCode("170017510");
        main.setName("ct-scan");
        main.setNumber("1");
        main.setUnit("times");

        ChartSupportMedicalModV2Request.Medication material = new ChartSupportMedicalModV2Request.Medication();
        material.setCode("700000001");
        material.setName("contrast");
        material.setNumber("1");
        material.setUnit("bottle");

        ChartSupportMedicalModV2Request.Medication comment = new ChartSupportMedicalModV2Request.Medication();
        comment.setCode("0085001");
        comment.setName("caution");

        information.setMedications(List.of(bodyPart, main, material, comment));
        payload.setMedicalInformation(List.of(information));

        String xml = support.buildMedicalModV2RequestXml(payload);

        assertTrue(xml.contains("<Medical_Class type=\"string\">700</Medical_Class>"));
        assertTrue(xml.contains("<Medical_Class_Number type=\"string\">1</Medical_Class_Number>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">002001</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">part</Medication_Unit_Code>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">170017510</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">times</Medication_Unit_Code>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">700000001</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">bottle</Medication_Unit_Code>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">0085001</Medication_Code>"));
        assertTrue(
                xml.indexOf("<Medication_Code type=\"string\">002001</Medication_Code>")
                        < xml.indexOf("<Medication_Code type=\"string\">170017510</Medication_Code>"));
        assertTrue(
                xml.indexOf("<Medication_Code type=\"string\">170017510</Medication_Code>")
                        < xml.indexOf("<Medication_Code type=\"string\">700000001</Medication_Code>"));
        assertTrue(
                xml.indexOf("<Medication_Code type=\"string\">700000001</Medication_Code>")
                        < xml.indexOf("<Medication_Code type=\"string\">0085001</Medication_Code>"));
    }

    @Test
    void buildMedicalModV2RequestXmlSerializesBasicAndInstructionChargeGroups() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("12345");
        payload.setPerformDate("2026-03-22T08:00:00");
        payload.setDepartmentCode("01");

        ChartSupportMedicalModV2Request.MedicalInformation baseCharge = new ChartSupportMedicalModV2Request.MedicalInformation();
        baseCharge.setMedicalClass("110");
        baseCharge.setMedicalClassName("BaseCharge");
        baseCharge.setMedicalClassNumber("1");
        ChartSupportMedicalModV2Request.Medication initialConsultation = new ChartSupportMedicalModV2Request.Medication();
        initialConsultation.setCode("110000110");
        initialConsultation.setName("initial-consultation");
        initialConsultation.setNumber("1");
        initialConsultation.setUnit("times");
        baseCharge.setMedications(List.of(initialConsultation));

        ChartSupportMedicalModV2Request.MedicalInformation instructionCharge = new ChartSupportMedicalModV2Request.MedicalInformation();
        instructionCharge.setMedicalClass("130");
        instructionCharge.setMedicalClassName("Instruction");
        instructionCharge.setMedicalClassNumber("2");
        ChartSupportMedicalModV2Request.Medication homeInstruction = new ChartSupportMedicalModV2Request.Medication();
        homeInstruction.setCode("112007410");
        homeInstruction.setName("home-instruction");
        homeInstruction.setNumber("1");
        homeInstruction.setUnit("times");
        instructionCharge.setMedications(List.of(homeInstruction));

        payload.setMedicalInformation(List.of(baseCharge, instructionCharge));

        String xml = support.buildMedicalModV2RequestXml(payload);

        assertTrue(xml.contains("<Medical_Class type=\"string\">110</Medical_Class>"));
        assertTrue(xml.contains("<Medical_Class_Name type=\"string\">BaseCharge</Medical_Class_Name>"));
        assertTrue(xml.contains("<Medical_Class_Number type=\"string\">1</Medical_Class_Number>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">110000110</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">times</Medication_Unit_Code>"));
        assertTrue(xml.contains("<Medical_Class type=\"string\">130</Medical_Class>"));
        assertTrue(xml.contains("<Medical_Class_Name type=\"string\">Instruction</Medical_Class_Name>"));
        assertTrue(xml.contains("<Medical_Class_Number type=\"string\">2</Medical_Class_Number>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">112007410</Medication_Code>"));
    }

    @Test
    void buildMedicalModV2RequestXmlSerializesInjectionAdminRowAndCodedItems() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("12345");
        payload.setPerformDate("2026-03-22T08:00:00");
        payload.setDepartmentCode("01");

        ChartSupportMedicalModV2Request.MedicalInformation injection = new ChartSupportMedicalModV2Request.MedicalInformation();
        injection.setMedicalClass("310");
        injection.setMedicalClassName("Injection");
        injection.setMedicalClassNumber("2");

        ChartSupportMedicalModV2Request.Medication admin = new ChartSupportMedicalModV2Request.Medication();
        admin.setCode("4101");
        admin.setName("iv");

        ChartSupportMedicalModV2Request.Medication procedure = new ChartSupportMedicalModV2Request.Medication();
        procedure.setCode("830000001");
        procedure.setName("procedure");
        procedure.setNumber("1");
        procedure.setUnit("times");

        ChartSupportMedicalModV2Request.Medication drug = new ChartSupportMedicalModV2Request.Medication();
        drug.setCode("620000010");
        drug.setName("drug-a");
        drug.setNumber("1");
        drug.setUnit("ampoule");

        injection.setMedications(List.of(admin, procedure, drug));
        payload.setMedicalInformation(List.of(injection));

        String xml = support.buildMedicalModV2RequestXml(payload);

        assertTrue(xml.contains("<Medical_Class type=\"string\">310</Medical_Class>"));
        assertTrue(xml.contains("<Medical_Class_Name type=\"string\">Injection</Medical_Class_Name>"));
        assertTrue(xml.contains("<Medical_Class_Number type=\"string\">2</Medical_Class_Number>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">4101</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Name type=\"string\">iv</Medication_Name>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">830000001</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">times</Medication_Unit_Code>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">620000010</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">ampoule</Medication_Unit_Code>"));
        assertFalse(xml.contains("adminMemo"));
        assertFalse(xml.contains("userComment"));
        assertFalse(xml.contains("routeCode"));
        assertFalse(xml.contains("timingCode"));
        assertFalse(xml.contains("dosePerDay"));
    }

    @Test
    void buildMedicalModV2RequestXmlKeepsInjectionMainMaterialCommentOrder() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("12345");
        payload.setPerformDate("2026-03-22T08:00:00");
        payload.setDepartmentCode("01");

        ChartSupportMedicalModV2Request.MedicalInformation injection = new ChartSupportMedicalModV2Request.MedicalInformation();
        injection.setMedicalClass("310");
        injection.setMedicalClassName("Injection");
        injection.setMedicalClassNumber("3");

        ChartSupportMedicalModV2Request.Medication admin = new ChartSupportMedicalModV2Request.Medication();
        admin.setCode("4103");
        admin.setName("drip");

        ChartSupportMedicalModV2Request.Medication mainDrug = new ChartSupportMedicalModV2Request.Medication();
        mainDrug.setCode("620000012");
        mainDrug.setName("drug-c");
        mainDrug.setNumber("1");
        mainDrug.setUnit("ampoule");

        ChartSupportMedicalModV2Request.Medication dripSet = new ChartSupportMedicalModV2Request.Medication();
        dripSet.setCode("700000031");
        dripSet.setName("drip-set");
        dripSet.setNumber("1");
        dripSet.setUnit("set");

        ChartSupportMedicalModV2Request.Medication comment = new ChartSupportMedicalModV2Request.Medication();
        comment.setCode("0085001");
        comment.setName("after-drip");

        injection.setMedications(List.of(admin, mainDrug, dripSet, comment));
        payload.setMedicalInformation(List.of(injection));

        String xml = support.buildMedicalModV2RequestXml(payload);

        assertTrue(xml.indexOf("<Medication_Code type=\"string\">4103</Medication_Code>")
                < xml.indexOf("<Medication_Code type=\"string\">620000012</Medication_Code>"));
        assertTrue(xml.indexOf("<Medication_Code type=\"string\">620000012</Medication_Code>")
                < xml.indexOf("<Medication_Code type=\"string\">700000031</Medication_Code>"));
        assertTrue(xml.indexOf("<Medication_Code type=\"string\">700000031</Medication_Code>")
                < xml.indexOf("<Medication_Code type=\"string\">0085001</Medication_Code>"));
    }

    @Test
    void buildMedicalModV2RequestXmlSerializesTestOrderGroup() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("12345");
        payload.setPerformDate("2026-03-22T08:00:00");
        payload.setDepartmentCode("01");

        ChartSupportMedicalModV2Request.MedicalInformation test = new ChartSupportMedicalModV2Request.MedicalInformation();
        test.setMedicalClass("600");
        test.setMedicalClassName("Test");
        test.setMedicalClassNumber("1");

        ChartSupportMedicalModV2Request.Medication lab = new ChartSupportMedicalModV2Request.Medication();
        lab.setCode("160000010");
        lab.setName("lab-general");
        lab.setNumber("1");
        lab.setUnit("times");

        test.setMedications(List.of(lab));
        payload.setMedicalInformation(List.of(test));

        String xml = support.buildMedicalModV2RequestXml(payload);

        assertTrue(xml.contains("<Medical_Class type=\"string\">600</Medical_Class>"));
        assertTrue(xml.contains("<Medical_Class_Name type=\"string\">Test</Medical_Class_Name>"));
        assertTrue(xml.contains("<Medical_Class_Number type=\"string\">1</Medical_Class_Number>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">160000010</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">times</Medication_Unit_Code>"));
    }

    @Test
    void buildMedicalModV2RequestXmlSerializesTreatmentOrderGroup() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("12345");
        payload.setPerformDate("2026-03-22T08:00:00");
        payload.setDepartmentCode("01");

        ChartSupportMedicalModV2Request.MedicalInformation treatment = new ChartSupportMedicalModV2Request.MedicalInformation();
        treatment.setMedicalClass("400");
        treatment.setMedicalClassName("Treatment");
        treatment.setMedicalClassNumber("3");

        ChartSupportMedicalModV2Request.Medication main = new ChartSupportMedicalModV2Request.Medication();
        main.setCode("140000610");
        main.setName("wound-care");
        main.setNumber("1");
        main.setUnit("times");

        treatment.setMedications(List.of(main));
        payload.setMedicalInformation(List.of(treatment));

        String xml = support.buildMedicalModV2RequestXml(payload);

        assertTrue(xml.contains("<Medical_Class type=\"string\">400</Medical_Class>"));
        assertTrue(xml.contains("<Medical_Class_Name type=\"string\">Treatment</Medical_Class_Name>"));
        assertTrue(xml.contains("<Medical_Class_Number type=\"string\">3</Medical_Class_Number>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">140000610</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">times</Medication_Unit_Code>"));
    }

    @Test
    void buildMedicalModV2RequestXmlSerializesOtherOrderGroup() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("12345");
        payload.setPerformDate("2026-03-22T08:00:00");
        payload.setDepartmentCode("01");

        ChartSupportMedicalModV2Request.MedicalInformation other = new ChartSupportMedicalModV2Request.MedicalInformation();
        other.setMedicalClass("800");
        other.setMedicalClassName("Other");
        other.setMedicalClassNumber("4");

        ChartSupportMedicalModV2Request.Medication fee = new ChartSupportMedicalModV2Request.Medication();
        fee.setCode("180000210");
        fee.setName("certificate-fee");
        fee.setNumber("1");
        fee.setUnit("times");

        other.setMedications(List.of(fee));
        payload.setMedicalInformation(List.of(other));

        String xml = support.buildMedicalModV2RequestXml(payload);

        assertTrue(xml.contains("<Medical_Class type=\"string\">800</Medical_Class>"));
        assertTrue(xml.contains("<Medical_Class_Name type=\"string\">Other</Medical_Class_Name>"));
        assertTrue(xml.contains("<Medical_Class_Number type=\"string\">4</Medical_Class_Number>"));
        assertTrue(xml.contains("<Medication_Code type=\"string\">180000210</Medication_Code>"));
        assertTrue(xml.contains("<Medication_Unit_Code type=\"string\">times</Medication_Unit_Code>"));
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
