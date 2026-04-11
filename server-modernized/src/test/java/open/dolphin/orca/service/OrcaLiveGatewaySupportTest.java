package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDate;
import open.dolphin.rest.dto.orca.PatientNameSearchRequest;
import open.dolphin.rest.dto.orca.VisitPatientListRequest;
import org.junit.jupiter.api.Test;

class OrcaLiveGatewaySupportTest {

    private final OrcaLiveGatewaySupport support = new OrcaLiveGatewaySupport();

    @Test
    void buildPatientSearchPayloadUsesOfficialPatientlst3Shape() {
        PatientNameSearchRequest request = new PatientNameSearchRequest();
        request.setName("山田 太郎");
        request.setKana("ヤマダ タロウ");
        request.setBirthStartDate(LocalDate.of(1980, 1, 1));
        request.setBirthEndDate(LocalDate.of(1980, 12, 31));
        request.setSex("1");
        request.setInOut("2");

        String xml = support.buildPatientSearchPayload(request);

        assertTrue(xml.contains("query=class=01"));
        assertTrue(xml.contains("<patientlst3req type=\"record\">"));
        assertTrue(xml.contains("<WholeName>山田 太郎</WholeName>"));
        assertTrue(!xml.contains("<WholeName_inKana>"));
        assertTrue(xml.contains("<Birth_StartDate>1980-01-01</Birth_StartDate>"));
        assertTrue(xml.contains("<Birth_EndDate>1980-12-31</Birth_EndDate>"));
        assertTrue(xml.contains("<Sex>1</Sex>"));
        assertTrue(xml.contains("<InOut>2</InOut>"));
    }

    @Test
    void buildPatientSearchPayloadRejectsMissingWholeName() {
        PatientNameSearchRequest request = new PatientNameSearchRequest();
        request.setKana("ヤマダ タロウ");

        assertThrows(RuntimeException.class, () -> support.buildPatientSearchPayload(request));
    }

    @Test
    void buildVisitListPayloadIncludesDepartmentCodeWhenSelected() {
        VisitPatientListRequest request = new VisitPatientListRequest();
        request.setRequestNumber("01");
        request.setVisitDate(LocalDate.of(2026, 4, 11));
        request.setDepartmentCode("11");

        String xml = support.buildVisitListPayload(
                request,
                new OrcaLiveGatewaySupport.DateRange(LocalDate.of(2026, 4, 11), LocalDate.of(2026, 4, 11)));

        assertTrue(xml.contains("<visitptlstreq type=\"record\">"));
        assertTrue(xml.contains("<Department_Code type=\"string\">11</Department_Code>"));
    }

    @Test
    void buildMedicalInformationOptionsPayloadUsesSystem01Class06() {
        String xml = support.buildMedicalInformationOptionsPayload();

        assertTrue(xml.contains("query=class=06"));
        assertTrue(xml.contains("<system01lstv2req type=\"record\">"));
        assertTrue(xml.contains("<Request_Number type=\"string\">06</Request_Number>"));
    }
}
