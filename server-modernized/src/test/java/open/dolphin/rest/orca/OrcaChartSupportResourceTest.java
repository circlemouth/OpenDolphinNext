package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import open.dolphin.encounter.EncounterProjectionRepository;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.orca.transport.OrcaConnectionPolicyException;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.ChartSupportContraindicationCheckRequest;
import open.dolphin.rest.dto.orca.ChartSupportContraindicationCheckResponse;
import open.dolphin.rest.dto.orca.ChartSupportDiseaseModV3Request;
import open.dolphin.rest.dto.orca.ChartSupportDiseaseModV3Response;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoRequest;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetRequest;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV2Request;
import open.dolphin.rest.dto.orca.ChartSupportSubjectivesModV2Request;
import open.dolphin.rest.dto.orca.ChartSupportSubjectivesModV2Response;
import open.dolphin.session.PatientServiceBean;
import org.junit.jupiter.api.Test;

class OrcaChartSupportResourceTest {

    @Test
    void medicationGetDefaultsToRequestNumber02AndSendsNineDigitRequestCode() {
        CapturingTransport transport = new CapturingTransport();
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);

        HttpServletRequest request = buildRequest();
        ChartSupportMedicationGetRequest payload = new ChartSupportMedicationGetRequest();
        payload.setRequestCode("114030710");
        payload.setBaseDate("2026-03-22");

        ChartSupportMedicationGetResponse response = resource.medicationGet(request, payload);

        assertNotNull(response);
        assertEquals("02", transport.requestNumber());
        assertTrue(transport.requestXml().contains("<Request_Number type=\"string\">02</Request_Number>"));
        assertTrue(transport.requestXml().contains("<Request_Code type=\"string\">114030710</Request_Code>"));
        assertTrue(transport.requestXml().contains("<Base_Date type=\"string\">2026-03-22</Base_Date>"));
    }

    @Test
    void medicationGetRejectsNonNineDigitRequestCodeForSelectionLookup() {
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", new CapturingTransport());

        HttpServletRequest request = buildRequest();
        ChartSupportMedicationGetRequest payload = new ChartSupportMedicationGetRequest();
        payload.setRequestCode("12345");

        WebApplicationException exception = assertThrows(
                WebApplicationException.class,
                () -> resource.medicationGet(request, payload));

        assertEquals(400, exception.getResponse().getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) exception.getResponse().getEntity();
        assertEquals("payload.requestCode", body.get("field"));
        assertEquals("requestCode must be a 9-digit medical code for requestNumber 02", body.get("message"));
    }

    @Test
    void medicationGetRejectsNonAlphanumericRequestCodeForInputLookup() {
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", new CapturingTransport());

        HttpServletRequest request = buildRequest();
        ChartSupportMedicationGetRequest payload = new ChartSupportMedicationGetRequest();
        payload.setRequestNumber("01");
        payload.setRequestCode("A-100");
        payload.setBaseDate("2026-03-22");

        WebApplicationException exception = assertThrows(
                WebApplicationException.class,
                () -> resource.medicationGet(request, payload));

        assertEquals(400, exception.getResponse().getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) exception.getResponse().getEntity();
        assertEquals("payload.requestCode", body.get("field"));
        assertEquals("requestCode must be an alphanumeric input code for requestNumber 01", body.get("message"));
    }

    @Test
    void medicationGetRejectsMissingBaseDate() {
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", new CapturingTransport());

        HttpServletRequest request = buildRequest();
        ChartSupportMedicationGetRequest payload = new ChartSupportMedicationGetRequest();
        payload.setRequestCode("114030710");

        WebApplicationException exception = assertThrows(
                WebApplicationException.class,
                () -> resource.medicationGet(request, payload));

        assertEquals(400, exception.getResponse().getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) exception.getResponse().getEntity();
        assertEquals("payload.baseDate", body.get("field"));
        assertEquals("baseDate is required", body.get("message"));
    }

    @Test
    void medicationGetAllowsRequestNumber01WithInputCode() {
        CapturingTransport transport = new CapturingTransport("""
                <data>
                  <medicationgetres type="record">
                    <Information_Date type="string">2026-03-22</Information_Date>
                    <Information_Time type="string">08:01:00</Information_Time>
                    <Api_Result type="string">000</Api_Result>
                    <Api_Result_Message type="string">処理終了</Api_Result_Message>
                    <Request_Code type="string">Y00001</Request_Code>
                    <Base_Date type="string">2026-03-22</Base_Date>
                  </medicationgetres>
                </data>
                """);
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);

        HttpServletRequest request = buildRequest();
        ChartSupportMedicationGetRequest payload = new ChartSupportMedicationGetRequest();
        payload.setRequestNumber("01");
        payload.setRequestCode("Y00001");
        payload.setBaseDate("2026-03-22");

        ChartSupportMedicationGetResponse response = resource.medicationGet(request, payload);

        assertNotNull(response);
        assertEquals("01", transport.requestNumber());
        assertTrue(transport.requestXml().contains("<Request_Number type=\"string\">01</Request_Number>"));
        assertTrue(transport.requestXml().contains("<Request_Code type=\"string\">Y00001</Request_Code>"));
    }

    @Test
    void contraindicationCheckInvokesOfficialRouteWithDefaultRequestNumberAndCheckTerm() {
        CapturingTransport transport = new CapturingTransport("""
                <data>
                  <contraindicationcheckres type="record">
                    <Information_Date type="string">2026-03-22</Information_Date>
                    <Information_Time type="string">08:02:00</Information_Time>
                    <Api_Result type="string">000</Api_Result>
                    <Api_Result_Message type="string">処理終了</Api_Result_Message>
                  </contraindicationcheckres>
                </data>
                """);
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);

        HttpServletRequest request = buildRequest();
        ChartSupportContraindicationCheckRequest payload = new ChartSupportContraindicationCheckRequest();
        payload.setPatientId("12345");
        payload.setPerformMonth("2026-03");

        ChartSupportContraindicationCheckResponse response = resource.contraindicationCheck(request, payload);

        assertNotNull(response);
        assertEquals(OrcaEndpoint.CONTRAINDICATION_CHECK, transport.endpoint());
        assertTrue(transport.requestXml().contains("<Request_Number type=\"string\">01</Request_Number>"));
        assertTrue(transport.requestXml().contains("<Check_Term type=\"string\">1</Check_Term>"));
        assertTrue(transport.requestXml().contains("<Patient_ID type=\"string\">12345</Patient_ID>"));
        assertTrue(transport.requestXml().contains("<Perform_Month type=\"string\">2026-03</Perform_Month>"));
    }

    @Test
    void contraindicationCheckParsesWarningsAndSymptomInfo() {
        CapturingTransport transport = new CapturingTransport("""
                <data>
                  <contraindicationcheckres type="record">
                    <Information_Date type="string">2026-03-22</Information_Date>
                    <Information_Time type="string">08:02:00</Information_Time>
                    <Api_Result type="string">0000</Api_Result>
                    <Api_Result_Message type="string">処理終了</Api_Result_Message>
                    <Medical_Information type="array">
                      <Medical_Information_child type="record">
                        <Medication_Code type="string">620001234</Medication_Code>
                        <Medication_Name type="string">アスピリン</Medication_Name>
                        <Medical_Result type="string">W01</Medical_Result>
                        <Medical_Result_Message type="string">併用注意</Medical_Result_Message>
                        <Medical_Info type="array">
                          <Medical_Info_child type="record">
                            <Contra_Code type="string">C001</Contra_Code>
                            <Contra_Name type="string">禁忌A</Contra_Name>
                            <Interact_Code type="string">I001</Interact_Code>
                            <Administer_Date type="string">2026-03-01</Administer_Date>
                            <Context_Class type="string">01</Context_Class>
                          </Medical_Info_child>
                        </Medical_Info>
                      </Medical_Information_child>
                    </Medical_Information>
                    <Symptom_Information type="array">
                      <Symptom_Information_child type="record">
                        <Symptom_Code type="string">S001</Symptom_Code>
                        <Symptom_Content type="string">喘息</Symptom_Content>
                        <Symptom_Detail type="string">既往あり</Symptom_Detail>
                      </Symptom_Information_child>
                    </Symptom_Information>
                  </contraindicationcheckres>
                </data>
                """);
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);

        ChartSupportContraindicationCheckRequest payload = new ChartSupportContraindicationCheckRequest();
        payload.setPatientId("12345");
        payload.setPerformMonth("2026-03");

        ChartSupportContraindicationCheckResponse response = resource.contraindicationCheck(buildRequest(), payload);

        assertEquals("0000", response.getApiResult());
        assertEquals(1, response.getResults().size());
        assertEquals("620001234", response.getResults().get(0).getMedicationCode());
        assertEquals(1, response.getResults().get(0).getWarnings().size());
        assertEquals("C001", response.getResults().get(0).getWarnings().get(0).getContraCode());
        assertEquals(1, response.getSymptomInfo().size());
        assertEquals("S001", response.getSymptomInfo().get(0).getCode());
    }

    @Test
    void incomeInfoUsesOfficialRouteAndOfficialRequestShape() {
        CapturingTransport transport = new CapturingTransport("""
                <data>
                  <incomeinfores type="record">
                    <Api_Result type="string">0000</Api_Result>
                    <Api_Result_Message type="string">OK</Api_Result_Message>
                    <Income_Information_child type="record">
                      <Perform_Date type="string">2026-03-22</Perform_Date>
                      <Department_Name type="string">内科</Department_Name>
                      <Cd_Information type="record">
                        <Ac_Money type="string">1200</Ac_Money>
                      </Cd_Information>
                    </Income_Information_child>
                  </incomeinfores>
                </data>
                """);
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);

        ChartSupportIncomeInfoRequest payload = new ChartSupportIncomeInfoRequest();
        payload.setPatientId("12345");
        payload.setBaseDate("2026-03-22");

        ChartSupportIncomeInfoResponse response = resource.incomeInfo(buildRequest(), payload);

        assertEquals(OrcaEndpoint.INCOME_INFO, transport.endpoint());
        assertTrue(transport.requestXml().contains("<incomeinfv2req type=\"record\">"));
        assertTrue(transport.requestXml().contains("<private_objects type=\"record\">"));
        assertTrue(transport.requestXml().contains("<Patient_ID type=\"string\">12345</Patient_ID>"));
        assertTrue(transport.requestXml().contains("<Base_Date type=\"string\">2026-03-22</Base_Date>"));
        assertTrue(!transport.requestXml().contains("<Request_Number type=\"string\">"));
        assertEquals("0000", response.getApiResult());
        assertEquals(1, response.getEntries().size());
        assertEquals("2026-03-22", response.getEntries().get(0).getPerformDate());
        assertEquals("内科", response.getEntries().get(0).getDepartmentName());
        assertEquals(1200.0, response.getEntries().get(0).getAcMoney(), 0.0001);
        assertNull(response.getEntries().get(0).getIcMoney());
    }

    @Test
    void medicalModV2PropagatesTransportPolicyFailureForSanitizedMapperHandling() {
        CapturingTransport transport = new CapturingTransport(new OrcaConnectionPolicyException(
                "facility_configuration_missing",
                "ORCA facility configuration is not available"));
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);
        injectMedicalModAuthority(resource);

        OrcaConnectionPolicyException exception = assertThrows(
                OrcaConnectionPolicyException.class,
                () -> resource.medicalModV2(buildRequest(), newMedicalModPayload()));

        assertEquals("facility_configuration_missing", exception.getErrorCategory());
        assertEquals(OrcaEndpoint.MEDICAL_MOD, transport.endpoint());
        assertTrue(transport.requestXml().contains("<Patient_ID type=\"string\">12345</Patient_ID>"));
        assertTrue(transport.requestXml().contains("<Request_Number type=\"string\">01</Request_Number>"));
    }

    @Test
    void medicalModV2RejectsTamperedEncounterContextBeforeTransport() {
        CapturingTransport transport = new CapturingTransport();
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);
        injectMedicalModAuthority(resource);

        ChartSupportMedicalModV2Request payload = newMedicalModPayload();
        payload.setVoucherNumber("tampered");

        WebApplicationException exception = assertThrows(
                WebApplicationException.class,
                () -> resource.medicalModV2(buildRequest(), payload));

        assertEquals(400, exception.getResponse().getStatus());
        assertNull(transport.endpoint());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) exception.getResponse().getEntity();
        assertEquals("encounterContext", body.get("field"));
        assertEquals("server-derived encounter context was not found", body.get("message"));
    }

    @Test
    void subjectivesModV2UsesFixedOfficialEndpointAndDoesNotAcceptHttp200AloneAsBusinessSuccess() {
        CapturingTransport transport = new CapturingTransport("""
                <xmlio2>
                  <subjectivesmodres>
                    <Api_Result>0000</Api_Result>
                    <Api_Result_Message>OK</Api_Result_Message>
                  </subjectivesmodres>
                </xmlio2>
                """);
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);

        ChartSupportSubjectivesModV2Response response = resource.subjectivesModV2(
                buildRequest(),
                newSubjectivesPayload());

        assertEquals(OrcaEndpoint.SUBJECTIVES_MOD, transport.endpoint());
        assertEquals("class=01", transport.query());
        assertTrue(transport.requestXml().contains("<subjectivesmodreq type=\"record\">"));
        assertTrue(!transport.requestXml().contains("<Request_Number"));
        assertTrue(transport.requestXml().contains("<Patient_ID type=\"string\">00001</Patient_ID>"));
        assertTrue(transport.requestXml().contains("<Insurance_Combination_Number type=\"string\"></Insurance_Combination_Number>"));
        assertTrue(!transport.requestXml().contains(
                "<HealthInsurance_Information type=\"record\"><Insurance_Combination_Number type=\"string\">"));
        assertTrue(transport.requestXml().contains("<Subjectives_Detail_Record type=\"string\">07</Subjectives_Detail_Record>"));
        assertTrue(transport.requestXml().contains("<Subjectives_Code type=\"string\">phase4-no-live-subjective</Subjectives_Code>"));
        assertEquals("0000", response.getApiResult());
        assertEquals("notVerified", response.getResponseClassification());
        assertTrue(!response.isBusinessAccepted());
        assertEquals("ok_like", response.getApiResultMessageCategory());
        assertNull(response.getApiResultMessage());
    }

    @Test
    void subjectivesModV2ClassifiesTransportFailureBeforeBusinessOrParserResult() {
        CapturingTransport transport = new CapturingTransport(502, "Bad Gateway");
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);

        ChartSupportSubjectivesModV2Response response = resource.subjectivesModV2(
                buildRequest(),
                newSubjectivesPayload());

        assertEquals(OrcaEndpoint.SUBJECTIVES_MOD, transport.endpoint());
        assertEquals("class=01", transport.query());
        assertEquals(502, response.getStatus());
        assertEquals("transportRejected", response.getResponseClassification());
        assertTrue(!response.isBusinessAccepted());
        assertEquals("transport_error", response.getError());
    }

    @Test
    void subjectivesModV2RejectsNonOutpatientInOutBeforeOfficialInvoke() {
        CapturingTransport transport = new CapturingTransport();
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);
        ChartSupportSubjectivesModV2Request payload = newSubjectivesPayload();
        payload.setInOut("I");

        WebApplicationException exception = assertThrows(
                WebApplicationException.class,
                () -> resource.subjectivesModV2(buildRequest(), payload));

        assertEquals(400, exception.getResponse().getStatus());
        assertNull(transport.endpoint());
    }

    @Test
    void diseaseModV3UsesFixedOfficialEndpointAndOmitsRequestNumberAndClassQueryForCreate() {
        CapturingTransport transport = new CapturingTransport("""
                <xmlio2>
                  <diseaseres>
                    <Api_Result>0000</Api_Result>
                    <Api_Result_Message>正常終了</Api_Result_Message>
                  </diseaseres>
                </xmlio2>
                """);
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);
        injectDiseaseModAuthority(resource);

        ChartSupportDiseaseModV3Response response = resource.diseaseModV3(
                buildRequest(),
                newDiseasePayload());

        assertEquals(OrcaEndpoint.DISEASE_MOD_V3, transport.endpoint());
        assertNull(transport.query());
        assertTrue(transport.requestXml().contains("<diseasereq type=\"record\">"));
        assertTrue(!transport.requestXml().contains("<Request_Number"));
        assertTrue(transport.requestXml().contains("<Patient_ID type=\"string\">00001</Patient_ID>"));
        assertTrue(transport.requestXml().contains("<Disease_Single type=\"array\">"));
        assertTrue(transport.requestXml().contains("<Disease_Single_Code type=\"string\">3089002</Disease_Single_Code>"));
        assertTrue(!transport.requestXml().contains("<Disease_Code type=\"string\">3089002</Disease_Code>"));
        assertEquals("0000", response.getApiResult());
        assertEquals("notVerified", response.getResponseClassification());
        assertTrue(!response.isBusinessAccepted());
        assertEquals("ok_like", response.getApiResultMessageCategory());
        assertNull(response.getApiResultMessage());
    }

    @Test
    void diseaseModV3RejectsRequestNumber02BeforeOfficialInvoke() {
        CapturingTransport transport = new CapturingTransport();
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);
        ChartSupportDiseaseModV3Request payload = newDiseasePayload();
        payload.setRequestNumber("02");

        WebApplicationException exception = assertThrows(
                WebApplicationException.class,
                () -> resource.diseaseModV3(buildRequest(), payload));

        assertEquals(400, exception.getResponse().getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) exception.getResponse().getEntity();
        assertEquals("payload.requestNumber", body.get("field"));
        assertEquals("diseaseModV3 Request_Number is server-owned", body.get("message"));
        assertNull(transport.endpoint());
    }

    @Test
    void diseaseModV3RejectsRequestNumber01OutsideOrganizeOperationBeforeOfficialInvoke() {
        CapturingTransport transport = new CapturingTransport();
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);
        ChartSupportDiseaseModV3Request payload = newDiseasePayload();
        payload.setRequestNumber("01");

        WebApplicationException exception = assertThrows(
                WebApplicationException.class,
                () -> resource.diseaseModV3(buildRequest(), payload));

        assertEquals(400, exception.getResponse().getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) exception.getResponse().getEntity();
        assertEquals("payload.requestNumber", body.get("field"));
        assertEquals("diseaseModV3 Request_Number is server-owned", body.get("message"));
        assertNull(transport.endpoint());
    }

    @Test
    void diseaseModV3OrganizeDeletedDiseasesIsOnlyOperationThatEmitsRequestNumber01() {
        CapturingTransport transport = new CapturingTransport("""
                <xmlio2>
                  <diseaseres>
                    <Information_Date>2026-04-22</Information_Date>
                    <Information_Time>14:24:00</Information_Time>
                    <Api_Result>0000</Api_Result>
                    <Api_Result_Message>正常終了</Api_Result_Message>
                  </diseaseres>
                </xmlio2>
                """);
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);
        injectDiseaseModAuthority(resource);
        ChartSupportDiseaseModV3Request payload = newDiseasePayload();
        payload.setOperation("organizeDeletedDiseases");
        payload.setDiseaseInformation(List.of());
        ChartSupportDiseaseModV3Request.OrganizeInformation organize =
                new ChartSupportDiseaseModV3Request.OrganizeInformation();
        organize.setDepartmentCode("11");
        organize.setDiseaseStartDate("2026-04-01");
        payload.setOrganizeInformation(organize);

        ChartSupportDiseaseModV3Response response = resource.diseaseModV3(
                buildRequest(),
                payload);

        assertEquals(OrcaEndpoint.DISEASE_MOD_V3, transport.endpoint());
        assertNull(transport.query());
        assertEquals("01", transport.requestNumber());
        assertTrue(transport.requestXml().contains("<Organize_Information type=\"record\">"));
        assertTrue(transport.requestXml().contains("<Disease_StartDate type=\"string\">2026-04-01</Disease_StartDate>"));
        assertTrue(!transport.requestXml().contains("<Disease_Information_child type=\"record\">"));
        assertTrue(response.isBusinessAccepted());
    }

    private static HttpServletRequest buildRequest() {
        return (HttpServletRequest) Proxy.newProxyInstance(
                OrcaChartSupportResourceTest.class.getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("getRemoteUser".equals(name)) return "F001:doctor01";
                    if ("getRemoteAddr".equals(name)) return "127.0.0.1";
                    if ("getRequestURI".equals(name)) return "/api/orca/official/chart-support/medication-get";
                    if ("getHeader".equals(name) && args != null && args.length == 1) {
                        String header = String.valueOf(args[0]);
                        return switch (header) {
                            case "X-Request-Id" -> "req-medication-get";
                            case "X-Trace-Id" -> "trace-medication-get";
                            case "User-Agent" -> "JUnit";
                            default -> null;
                        };
                    }
                    return null;
                });
    }

    private static ChartSupportMedicalModV2Request newMedicalModPayload() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("12345");
        payload.setPerformDate("2026-03-22T08:00:00");
        payload.setDepartmentCode("01");
        payload.setPhysicianCode("10001");
        payload.setInsuranceCombinationNumber("0001");
        payload.setVoucherNumber("1234");
        payload.setSequentialNumber("1");
        payload.setClassCode("01");
        ChartSupportMedicalModV2Request.MedicalInformation information =
                new ChartSupportMedicalModV2Request.MedicalInformation();
        information.setMedicalClass("120");
        information.setMedicalClassNumber("1");
        ChartSupportMedicalModV2Request.Medication medication = new ChartSupportMedicalModV2Request.Medication();
        medication.setCode("120000001");
        medication.setName("test-medical");
        medication.setNumber("1");
        information.setMedications(List.of(medication));
        payload.setMedicalInformation(List.of(information));
        return payload;
    }

    private static void injectMedicalModAuthority(OrcaChartSupportResource resource) {
        EncounterProjectionRepository repository = mock(EncounterProjectionRepository.class);
        when(repository.findByFacilityAndAcceptanceRange(eq("F001"), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(new EncounterProjectionRepository.EncounterRow(
                        "F001:1234",
                        "F001",
                        "12345",
                        10L,
                        "F001:1",
                        "1234",
                        Instant.parse("2026-03-21T23:00:00Z"),
                        "checked_in",
                        null,
                        null,
                        null,
                        "doctor01",
                        null,
                        """
                        {"rawSensitiveFieldsExcluded":true,"clientProvidedIdentifiersTrusted":false,"serverDerivedAuthorityRequired":true,"officialVisitIdentifiers":{"departmentCode":"01","physicianCode":"10001","insuranceCombinationNumber":"0001","voucherNumber":"1234","sequentialNumber":"1"}}
                        """,
                        null,
                        1L,
                        Instant.parse("2026-03-21T23:00:01Z"))));
        injectField(resource, "encounterProjectionRepository", repository);
    }

    private static void injectDiseaseModAuthority(OrcaChartSupportResource resource) {
        PatientServiceBean patientServiceBean = mock(PatientServiceBean.class);
        when(patientServiceBean.getPatientById("F001", "00001")).thenReturn(mock(PatientModel.class));
        injectField(resource, "patientServiceBean", patientServiceBean);

        EncounterProjectionRepository repository = mock(EncounterProjectionRepository.class);
        when(repository.findByFacilityAndAcceptanceRange(eq("F001"), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(new EncounterProjectionRepository.EncounterRow(
                        "F001:5678",
                        "F001",
                        "00001",
                        20L,
                        "F001:2",
                        "5678",
                        Instant.parse("2026-04-21T23:00:00Z"),
                        "checked_in",
                        null,
                        null,
                        null,
                        "doctor01",
                        null,
                        """
                        {"rawSensitiveFieldsExcluded":true,"clientProvidedIdentifiersTrusted":false,"serverDerivedAuthorityRequired":true,"officialVisitIdentifiers":{"departmentCode":"11","physicianCode":"10001","insuranceCombinationNumber":"0001","voucherNumber":"5678","sequentialNumber":"1"}}
                        """,
                        null,
                        1L,
                        Instant.parse("2026-04-21T23:00:01Z"))));
        injectField(resource, "encounterProjectionRepository", repository);
    }

    private static ChartSupportSubjectivesModV2Request newSubjectivesPayload() {
        ChartSupportSubjectivesModV2Request payload = new ChartSupportSubjectivesModV2Request();
        payload.setPatientId("00001");
        payload.setPerformDate("2026-04");
        payload.setInOut("O");
        payload.setDepartmentCode("11");
        payload.setInsuranceCombinationNumber("");
        payload.setSubjectivesDetailRecord("07");
        payload.setSubjectivesCode("phase4-no-live-subjective");
        return payload;
    }

    private static ChartSupportDiseaseModV3Request newDiseasePayload() {
        ChartSupportDiseaseModV3Request payload = new ChartSupportDiseaseModV3Request();
        payload.setPatientId("00001");
        payload.setPerformDate("2026-04-22");
        payload.setPerformTime("14:23:00");
        payload.setDepartmentCode("11");
        ChartSupportDiseaseModV3Request.DiseaseInformation disease =
                new ChartSupportDiseaseModV3Request.DiseaseInformation();
        disease.setDiseaseCode("3089002");
        disease.setDiseaseName("皮膚腫瘍");
        disease.setDiseaseStartDate("2026-04-22");
        disease.setDiseaseInOut("O");
        disease.setDiseaseSuspectedFlag("S");
        disease.setInsuranceCombinationNumber("0001");
        ChartSupportDiseaseModV3Request.DiseaseComponent component =
                new ChartSupportDiseaseModV3Request.DiseaseComponent();
        component.setSeq(1);
        component.setComponentType("BODY");
        component.setCode("3089002");
        component.setName("皮膚腫瘍");
        component.setSourceMaster("ORCA disease master");
        disease.setComponents(List.of(component));
        payload.setDiseaseInformation(List.of(disease));
        return payload;
    }

    private static final class CapturingTransport implements OrcaTransport {
        private String requestXml;
        private String requestNumber;
        private final String responseXml;
        private final int status;
        private final RuntimeException failure;
        private OrcaEndpoint endpoint;
        private String query;

        CapturingTransport() {
            this("""
                    <data>
                      <medicationgetres type="record">
                        <Information_Date type="string">2026-03-22</Information_Date>
                        <Information_Time type="string">08:01:00</Information_Time>
                        <Api_Result type="string">000</Api_Result>
                        <Api_Result_Message type="string">処理終了</Api_Result_Message>
                        <Request_Code type="string">114030710</Request_Code>
                        <Base_Date type="string">2026-03-22</Base_Date>
                      </medicationgetres>
                    </data>
                    """);
        }

        CapturingTransport(String responseXml) {
            this(200, responseXml);
        }

        CapturingTransport(int status, String responseXml) {
            this.responseXml = responseXml;
            this.status = status;
            this.failure = null;
        }

        CapturingTransport(RuntimeException failure) {
            this.responseXml = null;
            this.status = 200;
            this.failure = failure;
        }

        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            this.endpoint = endpoint;
            requestXml = request.getBody();
            requestNumber = extractTag(requestXml, "Request_Number");
            query = request.getQuery();
            if (failure != null) {
                throw failure;
            }
            return new OrcaTransportResult(null, "POST", status, responseXml, "application/xml", Map.of());
        }

        String requestXml() {
            return requestXml;
        }

        String requestNumber() {
            return requestNumber;
        }

        OrcaEndpoint endpoint() {
            return endpoint;
        }

        String query() {
            return query;
        }

        private static String extractTag(String xml, String tagName) {
            String start = "<" + tagName + " type=\"string\">";
            String end = "</" + tagName + ">";
            if (xml == null || !xml.contains(start) || !xml.contains(end)) {
                return null;
            }
            int from = xml.indexOf(start) + start.length();
            int to = xml.indexOf(end);
            return xml.substring(from, to);
        }
    }

    private static void injectField(Object target, String fieldName, Object value) {
        try {
            var field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
