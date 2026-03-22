package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV23Request;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV2Request;
import open.dolphin.rest.dto.orca.ChartSupportContraindicationCheckRequest;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoRequest;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetRequest;
import open.dolphin.rest.dto.orca.ChartSupportContraindicationCheckResponse;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetResponse;
import open.dolphin.rest.orca.OrcaChartSupportResource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.mockito.ArgumentCaptor;

class OrcaChartSupportResourceTest {

    private OrcaChartSupportResource resource;
    private OrcaTransport orcaTransport;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() throws Exception {
        resource = new OrcaChartSupportResource();
        orcaTransport = mock(OrcaTransport.class);
        request = mock(HttpServletRequest.class);

        setField(resource, "orcaTransport", orcaTransport);
        setField(resource, "sessionAuditDispatcher", null);

        when(request.getRemoteUser()).thenReturn("FACILITY:user");
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-CHART");
        when(request.getRequestURI()).thenReturn("/openDolphin/api/orca/chart-support/medical-mod-v2");
    }

    @Test
    void medicalModV2BuildsTransportRequestAndParsesResponse() {
        when(orcaTransport.invokeDetailed(any(), any(OrcaTransportRequest.class)))
                .thenReturn(OrcaTransportResult.fallback(
                        """
                        <xmlio2>
                          <medicalmodres>
                            <Api_Result>0000</Api_Result>
                            <Api_Result_Message>正常終了</Api_Result_Message>
                            <Invoice_Number>INV-01</Invoice_Number>
                            <Data_Id>DATA-01</Data_Id>
                            <Medical_Warning_Info>
                              <Medical_Warning_Info_child>
                                <Medical_Warning>W01</Medical_Warning>
                                <Medical_Warning_Message>warning</Medical_Warning_Message>
                              </Medical_Warning_Info_child>
                            </Medical_Warning_Info>
                          </medicalmodres>
                        </xmlio2>
                        """, "application/xml"));

        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("P001");
        payload.setPerformDate("2026-03-15T09:30:00");
        payload.setClassCode("class=04");
        payload.setDepartmentCode("01");
        payload.setIncludeInitialConsultation(true);
        payload.setMedicalPush("Yes");

        ChartSupportMedicalModResponse response = resource.medicalModV2(request, payload);

        assertTrue(response.isOk());
        assertTrue(response.isApiOk());
        assertEquals("0000", response.getApiResult());
        assertEquals("INV-01", response.getInvoiceNumber());
        assertEquals("DATA-01", response.getDataId());
        assertEquals(1, response.getMedicalWarnings().size());

        ArgumentCaptor<OrcaTransportRequest> captor = ArgumentCaptor.forClass(OrcaTransportRequest.class);
        verify(orcaTransport).invokeDetailed(eq(OrcaEndpoint.MEDICAL_MOD), captor.capture());
        assertEquals("class=04", captor.getValue().getQuery());
        assertTrue(captor.getValue().getBody().contains("<Medical_Push type=\"string\">Yes</Medical_Push>"));
    }

    @Test
    void medicalModV23ReturnsValidationErrorWhenPatientMissing() {
        ChartSupportMedicalModV23Request payload = new ChartSupportMedicalModV23Request();
        payload.setDepartmentCode("01");

        try {
            resource.medicalModV23(request, payload);
        } catch (jakarta.ws.rs.WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
            return;
        }
        throw new AssertionError("Expected validation error");
    }

    @Test
    void medicalModV2RejectsInvalidClassCode() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("P001");
        payload.setPerformDate("2026-03-15T09:30:00");
        payload.setDepartmentCode("01");
        payload.setClassCode("09");

        try {
            resource.medicalModV2(request, payload);
        } catch (jakarta.ws.rs.WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
            return;
        }
        throw new AssertionError("Expected validation error");
    }

    @Test
    void medicalModV2RequiresMedicalUidForClass02And03() {
        ChartSupportMedicalModV2Request payload = new ChartSupportMedicalModV2Request();
        payload.setPatientId("P001");
        payload.setPerformDate("2026-03-15T09:30:00");
        payload.setDepartmentCode("01");
        payload.setClassCode("02");

        try {
            resource.medicalModV2(request, payload);
        } catch (jakarta.ws.rs.WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
            return;
        }
        throw new AssertionError("Expected validation error");
    }

    @Test
    void medicalModV23MarksTransportFailure() {
        when(orcaTransport.invokeDetailed(any(), any(OrcaTransportRequest.class)))
                .thenReturn(new OrcaTransportResult(
                        null,
                        "POST",
                        500,
                        """
                        <xmlio2>
                          <medicalmodv23res>
                            <Api_Result>E90</Api_Result>
                            <Api_Result_Message>failed</Api_Result_Message>
                          </medicalmodv23res>
                        </xmlio2>
                        """,
                        "application/xml",
                        null));

        ChartSupportMedicalModV23Request payload = new ChartSupportMedicalModV23Request();
        payload.setPatientId("P001");
        payload.setDepartmentCode("01");

        ChartSupportMedicalModResponse response = resource.medicalModV23(request, payload);

        assertFalse(response.isOk());
        assertFalse(response.isApiOk());
        assertEquals("E90", response.getApiResult());
        assertEquals("failed", response.getError());
    }

    @Test
    void medicationGetBuildsRequestAndParsesResponse() {
        when(orcaTransport.invokeDetailed(any(), any(OrcaTransportRequest.class)))
                .thenReturn(OrcaTransportResult.fallback(
                        """
                        <xmlio2>
                          <medicationgetres>
                            <Api_Result>0000</Api_Result>
                            <Api_Result_Message>OK</Api_Result_Message>
                            <Information_Date>2026-03-15</Information_Date>
                            <Information_Time>09:30:00</Information_Time>
                            <Medication_Code>123456</Medication_Code>
                            <Medication_Name>パラセタモール</Medication_Name>
                            <Medication_Name_inKana>パンテトール</Medication_Name_inKana>
                            <StartDate>2026-03-01</StartDate>
                            <EndDate>2026-03-31</EndDate>
                            <Request_Code>RC-1</Request_Code>
                            <Selection_Information>
                              <Selection_Expression_Information>
                                <Selection_Expression_Information_child>
                                  <Comment_Code>C01</Comment_Code>
                                  <Comment_Name>コメント</Comment_Name>
                                  <Category>MED</Category>
                                  <Item_Number>001</Item_Number>
                                  <Item_Number_Branch>01</Item_Number_Branch>
                                </Selection_Expression_Information_child>
                              </Selection_Expression_Information>
                            </Selection_Information>
                          </medicationgetres>
                        </xmlio2>
                        """, "application/xml"));

        ChartSupportMedicationGetRequest payload = new ChartSupportMedicationGetRequest();
        payload.setRequestCode("123456");

        ChartSupportMedicationGetResponse response = resource.medicationGet(request, payload);

        assertTrue(response.isOk());
        assertTrue(response.isApiOk());
        assertEquals("0000", response.getApiResult());
        assertEquals("123456", response.getMedication().getMedicationCode());
        assertEquals("C01", response.getSelections().get(0).getCommentCode());

        ArgumentCaptor<OrcaTransportRequest> captor = ArgumentCaptor.forClass(OrcaTransportRequest.class);
        verify(orcaTransport).invokeDetailed(eq(OrcaEndpoint.MEDICATION_GET), captor.capture());
        assertTrue(captor.getValue().getBody().contains("<Request_Code type=\"string\">123456</Request_Code>"));
        assertTrue(captor.getValue().getBody().contains("<medicationgetreq"));
    }

    @Test
    void medicationGetRequiresRequestCode() {
        ChartSupportMedicationGetRequest payload = new ChartSupportMedicationGetRequest();
        try {
            resource.medicationGet(request, payload);
        } catch (jakarta.ws.rs.WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
            return;
        }
        throw new AssertionError("Expected validation error");
    }

    @Test
    void contraindicationCheckBuildsRequestAndParsesResponse() {
        when(orcaTransport.invokeDetailed(any(), any(OrcaTransportRequest.class)))
                .thenReturn(OrcaTransportResult.fallback(
                        """
                        <xmlio2>
                          <contraindication_checkres>
                            <Api_Result>0000</Api_Result>
                            <Api_Result_Message>OK</Api_Result_Message>
                            <Information_Date>2026-03-15</Information_Date>
                            <Information_Time>09:30:00</Information_Time>
                            <Medical_Information>
                              <Medical_Information_child>
                                <Medication_Code>123456</Medication_Code>
                                <Medication_Name>パラセタモール</Medication_Name>
                                <Medical_Result>0</Medical_Result>
                                <Medical_Result_Message>none</Medical_Result_Message>
                                <Medical_Info>
                                  <Medical_Info_child>
                                    <Contra_Code>C01</Contra_Code>
                                    <Contra_Name>併用不可</Contra_Name>
                                    <Interact_Code>I01</Interact_Code>
                                    <Administer_Date>2026-03-20</Administer_Date>
                                    <Context_Class>1</Context_Class>
                                  </Medical_Info_child>
                                </Medical_Info>
                              </Medical_Information_child>
                            </Medical_Information>
                            <Symptom_Information>
                              <Symptom_Information_child>
                                <Symptom_Code>S01</Symptom_Code>
                                <Symptom_Content>副作用</Symptom_Content>
                                <Symptom_Detail>詳記</Symptom_Detail>
                              </Symptom_Information_child>
                            </Symptom_Information>
                          </contraindication_checkres>
                        </xmlio2>
                        """, "application/xml"));

        ChartSupportContraindicationCheckRequest payload = new ChartSupportContraindicationCheckRequest();
        payload.setPatientId("P001");
        payload.setPerformMonth("2026-03");
        payload.setRequestNumber("01");
        ChartSupportContraindicationCheckRequest.Medication medication = new ChartSupportContraindicationCheckRequest.Medication();
        medication.setMedicationCode("123456");
        medication.setMedicationName("パラセタモール");
        payload.getMedications().add(medication);

        ChartSupportContraindicationCheckResponse response = resource.contraindicationCheck(request, payload);

        assertTrue(response.isOk());
        assertTrue(response.isApiOk());
        assertEquals("0000", response.getApiResult());
        assertEquals(1, response.getResults().size());
        assertEquals(1, response.getResults().get(0).getWarnings().size());
        assertEquals("S01", response.getSymptomInfo().get(0).getCode());

        ArgumentCaptor<OrcaTransportRequest> captor = ArgumentCaptor.forClass(OrcaTransportRequest.class);
        verify(orcaTransport).invokeDetailed(eq(OrcaEndpoint.CONTRAINDICATION_CHECK), captor.capture());
        assertTrue(captor.getValue().getBody().contains("<contraindication_checkreq"));
        assertTrue(captor.getValue().getBody().contains("<Medication_Code type=\"string\">123456</Medication_Code>"));
    }

    @Test
    void contraindicationCheckRequiresPatientAndMonth() {
        ChartSupportContraindicationCheckRequest payload = new ChartSupportContraindicationCheckRequest();
        payload.setRequestNumber("01");
        try {
            resource.contraindicationCheck(request, payload);
        } catch (jakarta.ws.rs.WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
            return;
        }
        throw new AssertionError("Expected validation error");
    }

    @Test
    void incomeInfoBuildsRequestAndParsesResponse() {
        when(orcaTransport.invokeDetailed(any(), any(OrcaTransportRequest.class)))
                .thenReturn(OrcaTransportResult.fallback(
                        """
                        <xmlio2>
                          <incomeinfv2res>
                            <Api_Result>0000</Api_Result>
                            <Api_Result_Message>OK</Api_Result_Message>
                            <Information_Date>2026-03-15</Information_Date>
                            <Information_Time>09:30:00</Information_Time>
                            <Income_Information>
                              <Income_Information_child>
                                <Perform_Date>2026-03-01</Perform_Date>
                                <Perform_End_Date>2026-03-31</Perform_End_Date>
                                <InOut>O</InOut>
                                <Invoice_Number>INV-01</Invoice_Number>
                                <Department_Name>内科</Department_Name>
                                <Insurance_Combination_Number>01</Insurance_Combination_Number>
                                <Cd_Information>
                                  <Ac_Money>100</Ac_Money>
                                  <Ic_Money>10</Ic_Money>
                                  <Ai_Money>1</Ai_Money>
                                  <Oe_Money>2</Oe_Money>
                                  <Ml_Smoney>0.5</Ml_Smoney>
                                </Cd_Information>
                              </Income_Information_child>
                            </Income_Information>
                          </incomeinfv2res>
                        </xmlio2>
                        """, "application/xml"));

        ChartSupportIncomeInfoRequest payload = new ChartSupportIncomeInfoRequest();
        payload.setPatientId("P001");
        payload.setPerformMonth("2026-03");

        ChartSupportIncomeInfoResponse response = resource.incomeInfo(request, payload);

        assertTrue(response.isOk());
        assertTrue(response.isApiOk());
        assertEquals("0000", response.getApiResult());
        assertEquals(1, response.getEntries().size());
        assertEquals(100d, response.getEntries().get(0).getAcMoney());

        ArgumentCaptor<OrcaTransportRequest> captor = ArgumentCaptor.forClass(OrcaTransportRequest.class);
        verify(orcaTransport).invokeDetailed(eq(OrcaEndpoint.INCOME_INFO), captor.capture());
        assertTrue(captor.getValue().getBody().contains("<incomeinfreq"));
        assertTrue(captor.getValue().getBody().contains("<Perform_Month type=\"string\">2026-03</Perform_Month>"));
    }

    @Test
    void incomeInfoRequiresPatientAndDateInfo() {
        ChartSupportIncomeInfoRequest payload = new ChartSupportIncomeInfoRequest();
        try {
            resource.incomeInfo(request, payload);
        } catch (jakarta.ws.rs.WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
            return;
        }
        throw new AssertionError("Expected validation error");
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Class<?> type = target.getClass();
        while (type != null) {
            try {
                var field = type.getDeclaredField(name);
                field.setAccessible(true);
                field.set(target, value);
                return;
            } catch (NoSuchFieldException ex) {
                type = type.getSuperclass();
            }
        }
        throw new NoSuchFieldException(name);
    }
}
