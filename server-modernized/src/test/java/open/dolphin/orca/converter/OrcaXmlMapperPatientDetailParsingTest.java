package open.dolphin.orca.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientDetail;
import open.dolphin.rest.dto.orca.PatientSearchResponse;
import org.junit.jupiter.api.Test;

class OrcaXmlMapperPatientDetailParsingTest {

    @Test
    void parsesAddressConcatenationAndPhoneNumbers() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <xmlio2>
                  <patientlst2res>
                    <Api_Result>0000</Api_Result>
                    <Api_Result_Message>正常終了</Api_Result_Message>
                    <Target_Patient_Count>1</Target_Patient_Count>
                    <No_Target_Patient_Count>0</No_Target_Patient_Count>
                    <Patient_Information>
                      <Patient_ID>000001</Patient_ID>
                      <WholeName>山田太郎</WholeName>
                      <WholeName_inKana>ヤマダタロウ</WholeName_inKana>
                      <BirthDate>1975-04-01</BirthDate>
                      <Sex>1</Sex>
                      <Home_Address_Information>
                        <Address_ZipCode>1510053</Address_ZipCode>
                        <WholeAddress1>東京都</WholeAddress1>
                        <WholeAddress2>渋谷区</WholeAddress2>
                      </Home_Address_Information>
                      <PhoneNumber_Information>
                        <PhoneNumber1>0312345678</PhoneNumber1>
                        <PhoneNumber2>09012345678</PhoneNumber2>
                      </PhoneNumber_Information>
                      <Outpatient_Class>1</Outpatient_Class>
                    </Patient_Information>
                  </patientlst2res>
                </xmlio2>
                """;

        OrcaXmlMapper mapper = new OrcaXmlMapper();
        PatientBatchResponse response = mapper.toPatientBatch(xml);
        assertNotNull(response);
        assertEquals(1, response.getPatients().size());

        PatientDetail detail = response.getPatients().get(0);
        assertEquals("1510053", detail.getZipCode());
        assertEquals("東京都渋谷区", detail.getAddress());
        assertEquals("0312345678", detail.getPhoneNumber1());
        assertEquals("09012345678", detail.getPhoneNumber2());
    }

    @Test
    void parsesPatientSearchResponseUsingOfficialPatientlst3StubShape() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <xmlio2>
                  <patientlst2res>
                    <Api_Result>0000</Api_Result>
                    <Api_Result_Message>正常終了</Api_Result_Message>
                    <Target_Patient_Count>1</Target_Patient_Count>
                    <No_Target_Patient_Count>0</No_Target_Patient_Count>
                    <Patient_Information>
                      <Patient_ID>000001</Patient_ID>
                      <WholeName>山田太郎</WholeName>
                      <WholeName_inKana>ヤマダタロウ</WholeName_inKana>
                      <BirthDate>1975-04-01</BirthDate>
                      <Sex>1</Sex>
                    </Patient_Information>
                  </patientlst2res>
                </xmlio2>
                """;

        OrcaXmlMapper mapper = new OrcaXmlMapper();
        PatientSearchResponse response = mapper.toPatientSearch(xml, "山田");
        assertNotNull(response);
        assertEquals("0000", response.getApiResult());
        assertEquals(1, response.getTargetPatientCount());
        assertEquals(1, response.getPatients().size());
        assertEquals("000001", response.getPatients().get(0).getSummary().getPatientId());
        assertEquals("山田", response.getSearchTerm());
    }
}
