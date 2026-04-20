package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.time.LocalDate;
import open.dolphin.rest.dto.orca.InsuranceCombinationRequest;
import open.dolphin.rest.dto.orca.PatientAppointmentListRequest;
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
    void buildPatientSearchPayloadOmitsOptionalFieldsWhenUnselected() {
        PatientNameSearchRequest request = new PatientNameSearchRequest();
        request.setName("山田 太郎");

        String xml = support.buildPatientSearchPayload(request);

        assertTrue(xml.contains("<patientlst3req type=\"record\">"));
        assertTrue(xml.contains("<WholeName>山田 太郎</WholeName>"));
        assertFalse(xml.contains("<Birth_StartDate>"));
        assertFalse(xml.contains("<Birth_EndDate>"));
        assertFalse(xml.contains("<Sex>"));
        assertFalse(xml.contains("<InOut>"));
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

    @Test
    void buildInsuranceCombinationPayloadUsesOfficialPatientlst6Shape() {
        InsuranceCombinationRequest request = new InsuranceCombinationRequest();
        request.setPatientId("000019");
        request.setBaseDate("2026-04-20");
        request.setRangeStart("2026-04-01");
        request.setRangeEnd("2026-04-30");

        String xml = support.buildInsuranceCombinationPayload(request);

        assertTrue(xml.contains("path=/api01rv2/patientlst6v2"));
        assertTrue(xml.contains("<patientlst6req>"));
        assertTrue(xml.contains("<Reqest_Number>01</Reqest_Number>"));
        assertTrue(xml.contains("<Patient_ID>000019</Patient_ID>"));
        assertTrue(xml.contains("<Base_Date>2026-04-20</Base_Date>"));
        assertTrue(xml.contains("<Start_Date>2026-04-01</Start_Date>"));
        assertTrue(xml.contains("<End_Date>2026-04-30</End_Date>"));
    }

    @Test
    void buildInsuranceCombinationPayloadDoesNotUseLocalWrapperShapeOrPerformDate() {
        InsuranceCombinationRequest request = new InsuranceCombinationRequest();
        request.setPatientId("000019");
        request.setBaseDate("2026-04-20");

        String xml = support.buildInsuranceCombinationPayload(request);

        assertFalse(xml.contains("insurancecombinationreq"));
        assertFalse(xml.contains("Perform_Date"));
        assertTrue(xml.contains("<Start_Date>2026-04-20</Start_Date>"));
        assertTrue(xml.contains("<End_Date>2026-04-20</End_Date>"));
    }

    @Test
    void buildPatientAppointmentListPayloadUsesOfficialClassAndBodyShape() {
        PatientAppointmentListRequest request = new PatientAppointmentListRequest();
        request.setPatientId("000019");
        request.setBaseDate(LocalDate.of(2026, 4, 20));
        request.setDepartmentCode("01");

        String xml = support.buildPatientAppointmentListPayload(request);

        assertTrue(xml.contains("path=/api01rv2/appointlst2v2"));
        assertTrue(xml.contains("query=class=01"));
        assertTrue(xml.contains("<appointlst2req>"));
        assertTrue(xml.contains("<Patient_ID>000019</Patient_ID>"));
        assertTrue(xml.contains("<Base_Date>2026-04-20</Base_Date>"));
        assertFalse(xml.contains("<Department_Code>"));
    }
}
