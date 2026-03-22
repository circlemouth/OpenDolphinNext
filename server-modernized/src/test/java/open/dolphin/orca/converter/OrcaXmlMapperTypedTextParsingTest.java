package open.dolphin.orca.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

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
        assertEquals("0005", response.getVisits().get(0).getInsuranceCombinationNumber());
        assertEquals("00001", response.getVisits().get(0).getPatient().getPatientId());
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
}
