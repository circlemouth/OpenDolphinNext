package open.dolphin.orca.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import open.dolphin.rest.dto.orca.AcceptanceInventoryResponse;
import open.dolphin.rest.dto.orca.MedicalIdentifierPreflightResponse;
import open.dolphin.rest.dto.orca.OrcaMedicalInformationListResponse;
import open.dolphin.rest.dto.orca.OrcaReceptionSelectorOptionsResponse;
import open.dolphin.rest.dto.orca.VisitMutationResponse;
import open.dolphin.rest.dto.orca.VisitPatientListResponse;
import org.junit.jupiter.api.Test;

class OrcaXmlMapperTypedTextParsingTest {

    @Test
    void parsesVisitListFieldsWithTypeAttributes() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <xmlio2>
                  <visitptlst01res>
                    <Api_Result type="string">00</Api_Result>
                    <Api_Result_Message type="string">処理終了</Api_Result_Message>
                    <Visit_Date type="string">2026-02-11</Visit_Date>
                    <Visit_List_Information type="array">
                      <Visit_List_Information_child type="record">
                        <Department_Code type="string">11</Department_Code>
                        <Department_Name type="string">整形外科</Department_Name>
                        <Physician_Code type="string">10005</Physician_Code>
                        <Physician_WholeName type="string">整形外科 五郎</Physician_WholeName>
                        <Voucher_Number type="string">V-1001</Voucher_Number>
                        <Sequential_Number type="string">S-1001</Sequential_Number>
                        <Insurance_Combination_Number type="string">0005</Insurance_Combination_Number>
                        <Update_Date type="string">2026-02-11</Update_Date>
                        <Update_Time type="string">09:01:02</Update_Time>
                        <Patient_Information type="record">
                          <Patient_ID type="string">00001</Patient_ID>
                          <WholeName type="string">事例 一</WholeName>
                          <WholeName_inKana type="string">ジレイ イチ</WholeName_inKana>
                          <BirthDate type="string">1990-01-01</BirthDate>
                          <Sex type="string">1</Sex>
                        </Patient_Information>
                      </Visit_List_Information_child>
                    </Visit_List_Information>
                  </visitptlst01res>
                </xmlio2>
                """;

        OrcaXmlMapper mapper = new OrcaXmlMapper();
        VisitPatientListResponse response = mapper.toVisitList(xml);

        assertNotNull(response);
        assertEquals("00", response.getApiResult());
        assertEquals("2026-02-11", response.getVisitDate());
        assertEquals(1, response.getVisits().size());
        assertEquals("11", response.getVisits().get(0).getDepartmentCode());
        assertEquals("10005", response.getVisits().get(0).getPhysicianCode());
        assertEquals("V-1001", response.getVisits().get(0).getVoucherNumber());
        assertEquals("S-1001", response.getVisits().get(0).getSequentialNumber());
        assertEquals("0005", response.getVisits().get(0).getInsuranceCombinationNumber());
        assertEquals("00001", response.getVisits().get(0).getPatient().getPatientId());
    }

    @Test
    void parsesAcceptanceInventoryAsSanitizedPresenceOnlyRows() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <xmlio2>
                  <acceptlstres>
                    <Api_Result type="string">00</Api_Result>
                    <Api_Result_Message type="string">処理終了</Api_Result_Message>
                    <Acceptlst_Information type="array">
                      <Acceptlst_Information_child type="record">
                        <Acceptance_Id type="string">A-20260427-001</Acceptance_Id>
                        <Acceptance_Date type="string">2026-04-27</Acceptance_Date>
                        <Acceptance_Time type="string">09:01:02</Acceptance_Time>
                        <Department_Code type="string">11</Department_Code>
                        <Physician_Code type="string">10005</Physician_Code>
                        <Medical_Information type="string">01</Medical_Information>
                        <Patient_Information type="record">
                          <Patient_ID type="string">00001</Patient_ID>
                          <WholeName type="string">事例 一</WholeName>
                          <WholeName_inKana type="string">ジレイ イチ</WholeName_inKana>
                        </Patient_Information>
                        <Insurance_Combination_Number type="string">0005</Insurance_Combination_Number>
                      </Acceptlst_Information_child>
                    </Acceptlst_Information>
                  </acceptlstres>
                </xmlio2>
                """;

        OrcaXmlMapper mapper = new OrcaXmlMapper();
        AcceptanceInventoryResponse response = mapper.toAcceptanceInventory(xml);

        assertNotNull(response);
        assertEquals("00", response.getApiResult());
        assertEquals(1, response.getRows().size());
        assertEquals(1, response.getTargetReadyRowCount());
        assertEquals(1, response.getSourceRowCount());
        assertTrue(response.isTargetReady());
        assertTrue(response.isRawSensitiveFieldsExcluded());
        assertTrue(response.getRows().get(0).isHasAcceptanceId());
        assertTrue(response.getRows().get(0).isHasPatientId());
        assertEquals(64, response.getRows().get(0).getRowHash().length());
    }

    @Test
    void parsesAcceptanceInventoryDateAndNestedInsuranceAsPresenceOnlyRows() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <xmlio2>
                  <acceptlstres>
                    <Api_Result type="string">00</Api_Result>
                    <Acceptance_Date type="string">2026-04-28</Acceptance_Date>
                    <Acceptlst_Information type="array">
                      <Acceptlst_Information_child type="record">
                        <Acceptance_Time type="string">09:01:02</Acceptance_Time>
                        <Acceptance_Id type="string">00001</Acceptance_Id>
                        <Department_Code type="string">01</Department_Code>
                        <Physician_Code type="string">10001</Physician_Code>
                        <Medical_Information type="string">01</Medical_Information>
                        <Patient_Information type="record">
                          <Patient_ID type="string">00001</Patient_ID>
                          <WholeName type="string">事例 一</WholeName>
                        </Patient_Information>
                        <HealthInsurance_Information type="record">
                          <Insurance_Combination_Number type="string">0001</Insurance_Combination_Number>
                        </HealthInsurance_Information>
                      </Acceptlst_Information_child>
                    </Acceptlst_Information>
                  </acceptlstres>
                </xmlio2>
                """;

        OrcaXmlMapper mapper = new OrcaXmlMapper();
        AcceptanceInventoryResponse response = mapper.toAcceptanceInventory(xml);

        assertNotNull(response);
        assertEquals(1, response.getRows().size());
        assertEquals(1, response.getTargetReadyRowCount());
        assertTrue(response.isTargetReady());
        assertTrue(response.getRows().get(0).isHasAcceptanceDate());
        assertTrue(response.getRows().get(0).isHasInsuranceCombinationNumber());
        assertTrue(response.getRows().get(0).isRawSensitiveFieldsExcluded());
        assertEquals(64, response.getRows().get(0).getRowHash().length());
    }

    @Test
    void parsesMedicalGetIdentifierSnapshotAsPresenceOnlyRows() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <xmlio2>
                  <medicalget01res type="record">
                    <Api_Result type="string">00</Api_Result>
                    <Api_Result_Message type="string">処理終了</Api_Result_Message>
                    <Patient_Information type="record">
                      <Patient_ID type="string">00012</Patient_ID>
                      <WholeName type="string">事例 一</WholeName>
                      <WholeName_inKana type="string">ジレイ イチ</WholeName_inKana>
                    </Patient_Information>
                    <Medical_List_Information type="array">
                      <Medical_List_Information_child type="record">
                        <Perform_Date type="string">2026-04-28</Perform_Date>
                        <Department_Code type="string">01</Department_Code>
                        <Department_Name type="string">内科</Department_Name>
                        <Sequential_Number type="string">1</Sequential_Number>
                        <Insurance_Combination_Number type="string">0002</Insurance_Combination_Number>
                        <Invoice_Number type="string">10001</Invoice_Number>
                        <HealthInsurance_Information type="record">
                          <InsuranceProvider_Class type="string">060</InsuranceProvider_Class>
                          <HealthInsuredPerson_Number type="string">1234567</HealthInsuredPerson_Number>
                        </HealthInsurance_Information>
                      </Medical_List_Information_child>
                    </Medical_List_Information>
                  </medicalget01res>
                </xmlio2>
                """;

        OrcaXmlMapper mapper = new OrcaXmlMapper();
        MedicalIdentifierPreflightResponse response = mapper.toMedicalIdentifierSnapshot(xml, "01");

        assertNotNull(response);
        assertEquals("00", response.getApiResult());
        assertEquals("01", response.getMedicalGetClassCode());
        assertEquals(1, response.getMedicalRows().size());
        assertEquals(1, response.getMedicalSourceRowCount());
        assertTrue(response.isRawSensitiveFieldsExcluded());
        assertTrue(response.getMedicalRows().get(0).isHasPerformDate());
        assertTrue(response.getMedicalRows().get(0).isHasDepartmentCode());
        assertTrue(response.getMedicalRows().get(0).isHasSequentialNumber());
        assertTrue(response.getMedicalRows().get(0).isHasInsuranceCombinationNumber());
        assertTrue(response.getMedicalRows().get(0).isHasInvoiceNumber());
        assertEquals(64, response.getMedicalRows().get(0).getRowHash().length());
    }

    @Test
    void parsesVisitMutationFieldsWithTypeAttributes() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <xmlio2>
                  <acceptres>
                    <Api_Result type="string">K3</Api_Result>
                    <Api_Result_Message type="string">受付登録終了</Api_Result_Message>
                    <Acceptance_Id type="string">A-20260211-001</Acceptance_Id>
                    <Claim_Send_Info type="string">02</Claim_Send_Info>
                    <Acceptance_Date type="string">2026-02-11</Acceptance_Date>
                    <Acceptance_Time type="string">09:12:34</Acceptance_Time>
                    <Department_Code type="string">11</Department_Code>
                    <Department_WholeName type="string">整形外科</Department_WholeName>
                    <Physician_Code type="string">10005</Physician_Code>
                    <Physician_WholeName type="string">整形外科 五郎</Physician_WholeName>
                    <Medical_Information type="string">外来受付</Medical_Information>
                    <Medical_Info type="record">
                      <Appointment_Date type="string">2026-02-11</Appointment_Date>
                      <Visit_Number type="string">1</Visit_Number>
                    </Medical_Info>
                    <Patient_Information type="record">
                      <Patient_ID type="string">00001</Patient_ID>
                      <WholeName type="string">事例 一</WholeName>
                      <WholeName_inKana type="string">ジレイ イチ</WholeName_inKana>
                      <BirthDate type="string">1990-01-01</BirthDate>
                      <Sex type="string">1</Sex>
                    </Patient_Information>
                  </acceptres>
                </xmlio2>
                """;

        OrcaXmlMapper mapper = new OrcaXmlMapper();
        VisitMutationResponse response = mapper.toVisitMutation(xml);

        assertNotNull(response);
        assertEquals("K3", response.getApiResult());
        assertEquals("A-20260211-001", response.getAcceptanceId());
        assertEquals("02", response.getClaimSendInfo());
        assertEquals("11", response.getDepartmentCode());
        assertEquals("10005", response.getPhysicianCode());
        assertEquals("00001", response.getPatient().getPatientId());
        assertEquals("1", response.getVisitNumber());
    }

    @Test
    void parsesMedicalInformationOptionsFromSystemManagementResponse() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <xmlio2>
                  <medicalinfres>
                    <Api_Result type="string">00</Api_Result>
                    <Api_Result_Message type="string">OK</Api_Result_Message>
                    <Medicalinf_Information type="array">
                      <Medicalinf_Information_child type="record">
                        <Medical_Information type="string">01</Medical_Information>
                        <Medical_Information_Name type="string">外来</Medical_Information_Name>
                      </Medicalinf_Information_child>
                      <Medicalinf_Information_child type="record">
                        <Medical_Information type="string">02</Medical_Information>
                        <Medical_Information_Name2 type="string">再診</Medical_Information_Name2>
                      </Medicalinf_Information_child>
                    </Medicalinf_Information>
                  </medicalinfres>
                </xmlio2>
                """;

        OrcaXmlMapper mapper = new OrcaXmlMapper();
        OrcaMedicalInformationListResponse response = mapper.toMedicalInformationList(xml);

        assertNotNull(response);
        assertEquals("00", response.getApiResult());
        assertEquals(2, response.getItems().size());
        assertEquals("01", response.getItems().get(0).getCode());
        assertEquals("外来", response.getItems().get(0).getName());
        assertEquals("02", response.getItems().get(1).getCode());
        assertEquals("再診", response.getItems().get(1).getName());
    }

    @Test
    void parsesDepartmentOptionsFromSystemManagementResponse() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <xmlio2>
                  <departmentres>
                    <Api_Result type="string">00</Api_Result>
                    <Api_Result_Message type="string">処理終了</Api_Result_Message>
                    <Department_Information type="array">
                      <Department_Information_child type="record">
                        <Code type="string">01</Code>
                        <WholeName type="string">内科</WholeName>
                      </Department_Information_child>
                    </Department_Information>
                  </departmentres>
                </xmlio2>
                """;

        OrcaXmlMapper mapper = new OrcaXmlMapper();
        OrcaReceptionSelectorOptionsResponse response = mapper.toDepartmentOptionList(xml);

        assertEquals("00", response.getApiResult());
        assertEquals(1, response.getDepartments().size());
        assertEquals("01", response.getDepartments().get(0).getCode());
        assertEquals("内科", response.getDepartments().get(0).getName());
        assertEquals(0, response.getPhysicians().size());
    }

    @Test
    void parsesPhysicianOptionsFromSystemManagementResponse() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <xmlio2>
                  <physicianres>
                    <Api_Result type="string">00</Api_Result>
                    <Api_Result_Message type="string">処理終了</Api_Result_Message>
                    <Physician_Information type="array">
                      <Physician_Information_child type="record">
                        <Code type="string">10001</Code>
                        <WholeName type="string">日本　一</WholeName>
                        <Department_Code1 type="string">01</Department_Code1>
                      </Physician_Information_child>
                    </Physician_Information>
                  </physicianres>
                </xmlio2>
                """;

        OrcaXmlMapper mapper = new OrcaXmlMapper();
        OrcaReceptionSelectorOptionsResponse response = mapper.toPhysicianOptionList(xml);

        assertEquals("00", response.getApiResult());
        assertEquals(0, response.getDepartments().size());
        assertEquals(1, response.getPhysicians().size());
        assertEquals("10001", response.getPhysicians().get(0).getCode());
        assertEquals("日本　一", response.getPhysicians().get(0).getName());
    }
}
