package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.Collections;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.MedicalIdentifierPreflightRequest;
import open.dolphin.rest.dto.orca.MedicalIdentifierPreflightResponse;
import open.dolphin.rest.dto.orca.BillingSimulationRequest;
import open.dolphin.rest.dto.orca.OrcaAppointmentListRequest;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientNameSearchRequest;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import org.junit.jupiter.api.Test;

class DefaultOrcaLiveGatewayTest {

    private final OrcaTransport failingTransport = new AlwaysFailTransport();
    private final OrcaLiveGateway service = new DefaultOrcaLiveGateway(failingTransport, new OrcaXmlMapper());

    @Test
    void appointmentListDoesNotFallbackToSamplePayloadWhenTransportFails() {
        OrcaAppointmentListRequest request = new OrcaAppointmentListRequest();
        request.setAppointmentDate(LocalDate.of(2025, 11, 13));

        assertThrows(OrcaGatewayException.class, () -> service.getAppointmentList("F001", request));
    }

    @Test
    void patientBatchDoesNotFallbackToSamplePayloadWhenTransportFails() {
        PatientBatchRequest request = new PatientBatchRequest();
        request.getPatientIds().add("000001");

        assertThrows(OrcaGatewayException.class, () -> service.getPatientBatch("F001", request));
    }

    @Test
    void patientSearchDoesNotFallbackToSamplePayloadWhenTransportFails() {
        PatientNameSearchRequest request = new PatientNameSearchRequest();
        request.setName("山田");

        assertThrows(OrcaGatewayException.class, () -> service.searchPatients("F001", request));
    }

    @Test
    void visitMutationDoesNotFallbackToSamplePayloadWhenTransportFails() {
        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("01");
        request.setPatientId("000001");
        request.setAcceptanceDate("2025-11-16");
        request.setAcceptanceTime("09:00:00");

        assertThrows(OrcaGatewayException.class, () -> service.mutateVisit("F001", request));
    }

    @Test
    void billingSimulationDoesNotFallbackToSamplePayloadWhenTransportFails() {
        BillingSimulationRequest request = new BillingSimulationRequest();
        request.setPatientId("000001");
        request.setPerformDate(LocalDate.of(2025, 11, 12));
        BillingSimulationRequest.BillingItem item = new BillingSimulationRequest.BillingItem();
        item.setMedicalCode("D000");
        item.setQuantity(1);
        request.getItems().add(item);

        assertThrows(OrcaGatewayException.class, () -> service.simulateBilling("F001", request));
    }

    @Test
    void missingFacilityFailsClosedBeforeTransportInvocation() {
        PatientBatchRequest request = new PatientBatchRequest();
        request.getPatientIds().add("000001");

        assertThrows(OrcaGatewayException.class, () -> service.getPatientBatch(" ", request));
    }

    @Test
    void identifierPreflightPreservesSanitizedAcceptanceTargetWhenMedicalGetFails() {
        OrcaLiveGateway gateway = new DefaultOrcaLiveGateway(new AcceptanceThenMedicalGetFailTransport(), new OrcaXmlMapper());
        MedicalIdentifierPreflightRequest request = new MedicalIdentifierPreflightRequest();
        request.setAcceptanceDate(LocalDate.of(2026, 4, 29));
        request.setClassCode("01");
        request.setMedicalGetClassCode("01");

        MedicalIdentifierPreflightResponse response = gateway.getMedicalIdentifierPreflight("F001", request);

        assertEquals("/api/orca/official/visits/identifier-preflight", response.getEndpoint());
        assertEquals("01", response.getAcceptanceClassCode());
        assertEquals("01", response.getMedicalGetClassCode());
        assertEquals("2026-04-29", response.getAcceptanceDate());
        assertEquals(1, response.getAcceptanceSourceRowCount());
        assertEquals(1, response.getAcceptanceTargetReadyRowCount());
        assertEquals(64, response.getSelectedAcceptanceRowHash().length());
        assertTrue(response.isSelectedAcceptanceTargetReady());
        assertFalse(response.isIdentifierPreflightReady());
        assertEquals(0, response.getMedicalSanitizedRowCount());
        assertEquals("orca_gateway_error", response.getSanitizedErrorCode());
        assertEquals("medicalgetv2_unavailable_or_rejected", response.getSanitizedValidationError());
        assertTrue(response.isRawSensitiveFieldsExcluded());
        assertFalse(response.isClientProvidedIdentifiersTrusted());
    }

    @Test
    void identifierPreflightUsesVisitListIdentifierProofWhenMedicalGetHasNoReadyRows() {
        OrcaLiveGateway gateway = new DefaultOrcaLiveGateway(new AcceptanceMedicalGetApi15ThenVisitReadyTransport(),
                new OrcaXmlMapper());
        MedicalIdentifierPreflightRequest request = new MedicalIdentifierPreflightRequest();
        request.setAcceptanceDate(LocalDate.of(2026, 4, 29));
        request.setClassCode("01");
        request.setMedicalGetClassCode("01");

        MedicalIdentifierPreflightResponse response = gateway.getMedicalIdentifierPreflight("F001", request);

        assertEquals("15", response.getApiResult());
        assertEquals(1, response.getMedicalSanitizedRowCount());
        assertEquals(1, response.getVisitSourceRowCount());
        assertEquals(1, response.getVisitSanitizedRowCount());
        assertEquals(1, response.getVisitReadyRowCount());
        assertEquals("/api01rv2/visitptlstv2", response.getVisitListEndpoint());
        assertEquals("visitptlstv2_request_01_visit_date_readonly_identifier_proof",
                response.getVisitListRequestClass());
        assertEquals(64, response.getVisitRows().get(0).getRowHash().length());
        assertTrue(response.getVisitRows().get(0).isHasPatientId());
        assertTrue(response.getVisitRows().get(0).isHasVisitDate());
        assertTrue(response.getVisitRows().get(0).isHasVoucherNumber());
        assertTrue(response.getVisitRows().get(0).isHasSequentialNumber());
        assertTrue(response.getVisitRows().get(0).isHasInsuranceCombinationNumber());
        assertTrue(response.isIdentifierPreflightReady());
        assertFalse(response.isClientProvidedIdentifiersTrusted());
    }

    @Test
    void identifierPreflightRejectsVisitListRowsForDifferentPatient() {
        OrcaLiveGateway gateway = new DefaultOrcaLiveGateway(new AcceptanceMedicalGetApi15ThenVisitMismatchedTransport(),
                new OrcaXmlMapper());
        MedicalIdentifierPreflightRequest request = new MedicalIdentifierPreflightRequest();
        request.setAcceptanceDate(LocalDate.of(2026, 4, 29));
        request.setClassCode("01");
        request.setMedicalGetClassCode("01");

        MedicalIdentifierPreflightResponse response = gateway.getMedicalIdentifierPreflight("F001", request);

        assertEquals(1, response.getVisitSourceRowCount());
        assertEquals(1, response.getVisitSanitizedRowCount());
        assertEquals(0, response.getVisitReadyRowCount());
        assertFalse(response.isIdentifierPreflightReady());
    }

    private static final class AlwaysFailTransport implements OrcaTransport {

        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            throw new OrcaGatewayException("transport unavailable for " + endpoint.name());
        }
    }

    private static final class AcceptanceThenMedicalGetFailTransport implements OrcaTransport {

        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            if (endpoint == OrcaEndpoint.ACCEPTANCE_LIST) {
                String xml = """
                        <xmlio2>
                          <acceptlstres type="record">
                            <Api_Result type="string">00</Api_Result>
                            <Acceptance_Date type="string">2026-04-29</Acceptance_Date>
                            <Acceptlst_Information type="array">
                              <Acceptlst_Information_child type="record">
                                <Acceptance_Id type="string">1</Acceptance_Id>
                                <Acceptance_Time type="string">09:00:00</Acceptance_Time>
                                <Department_Code type="string">01</Department_Code>
                                <Physician_Code type="string">10001</Physician_Code>
                                <Medical_Information type="string">01</Medical_Information>
                                <Patient_Information type="record">
                                  <Patient_ID type="string">00002</Patient_ID>
                                </Patient_Information>
                                <HealthInsurance_Information type="record">
                                  <Insurance_Combination_Number type="string">0001</Insurance_Combination_Number>
                                </HealthInsurance_Information>
                              </Acceptlst_Information_child>
                            </Acceptlst_Information>
                          </acceptlstres>
                        </xmlio2>
                        """;
                return new OrcaTransportResult(null, "POST", 200, xml, "application/xml", Collections.emptyMap());
            }
            if (endpoint == OrcaEndpoint.MEDICAL_GET) {
                throw new OrcaGatewayException("[http_status] ORCA HTTP response status 400");
            }
            throw new OrcaGatewayException("unexpected endpoint " + endpoint);
        }
    }

    private static final class AcceptanceMedicalGetApi15ThenVisitReadyTransport implements OrcaTransport {

        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            if (endpoint == OrcaEndpoint.ACCEPTANCE_LIST) {
                return new OrcaTransportResult(null, "POST", 200, """
                        <xmlio2>
                          <acceptlstres type="record">
                            <Api_Result type="string">00</Api_Result>
                            <Acceptance_Date type="string">2026-04-29</Acceptance_Date>
                            <Acceptlst_Information type="array">
                              <Acceptlst_Information_child type="record">
                                <Acceptance_Id type="string">1</Acceptance_Id>
                                <Acceptance_Time type="string">09:00:00</Acceptance_Time>
                                <Department_Code type="string">01</Department_Code>
                                <Physician_Code type="string">10001</Physician_Code>
                                <Medical_Information type="string">01</Medical_Information>
                                <Patient_Information type="record">
                                  <Patient_ID type="string">00002</Patient_ID>
                                  <WholeName type="string">must not leak</WholeName>
                                </Patient_Information>
                                <HealthInsurance_Information type="record">
                                  <Insurance_Combination_Number type="string">0001</Insurance_Combination_Number>
                                </HealthInsurance_Information>
                              </Acceptlst_Information_child>
                            </Acceptlst_Information>
                          </acceptlstres>
                        </xmlio2>
                        """, "application/xml", Collections.emptyMap());
            }
            if (endpoint == OrcaEndpoint.MEDICAL_GET) {
                return new OrcaTransportResult(null, "POST", 200, """
                        <xmlio2>
                          <medicalget01res type="record">
                            <Api_Result type="string">15</Api_Result>
                            <Api_Result_Message type="string">must not leak</Api_Result_Message>
                            <Medical_List_Information type="array">
                              <Medical_List_Information_child type="record">
                                <Perform_Date type="string">2026-04-29</Perform_Date>
                              </Medical_List_Information_child>
                            </Medical_List_Information>
                          </medicalget01res>
                        </xmlio2>
                        """, "application/xml", Collections.emptyMap());
            }
            if (endpoint == OrcaEndpoint.VISIT_LIST) {
                return new OrcaTransportResult(null, "POST", 200, """
                        <xmlio2>
                          <visitptlst01res type="record">
                            <Api_Result type="string">00</Api_Result>
                            <Visit_Date type="string">2026-04-29</Visit_Date>
                            <Visit_List_Information type="array">
                              <Visit_List_Information_child type="record">
                                <Department_Code type="string">01</Department_Code>
                                <Voucher_Number type="string">V-1</Voucher_Number>
                                <Sequential_Number type="string">1</Sequential_Number>
                                <Insurance_Combination_Number type="string">0001</Insurance_Combination_Number>
                                <Patient_Information type="record">
                                  <Patient_ID type="string">00002</Patient_ID>
                                  <WholeName type="string">must not leak</WholeName>
                                </Patient_Information>
                              </Visit_List_Information_child>
                            </Visit_List_Information>
                          </visitptlst01res>
                        </xmlio2>
                        """, "application/xml", Collections.emptyMap());
            }
            throw new OrcaGatewayException("unexpected endpoint " + endpoint);
        }
    }

    private static final class AcceptanceMedicalGetApi15ThenVisitMismatchedTransport implements OrcaTransport {

        private final AcceptanceMedicalGetApi15ThenVisitReadyTransport delegate =
                new AcceptanceMedicalGetApi15ThenVisitReadyTransport();

        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            if (endpoint != OrcaEndpoint.VISIT_LIST) {
                return delegate.invoke(facilityId, endpoint, request);
            }
            return new OrcaTransportResult(null, "POST", 200, """
                    <xmlio2>
                      <visitptlst01res type="record">
                        <Api_Result type="string">00</Api_Result>
                        <Visit_Date type="string">2026-04-29</Visit_Date>
                        <Visit_List_Information type="array">
                          <Visit_List_Information_child type="record">
                            <Department_Code type="string">01</Department_Code>
                            <Voucher_Number type="string">V-1</Voucher_Number>
                            <Sequential_Number type="string">1</Sequential_Number>
                            <Insurance_Combination_Number type="string">0001</Insurance_Combination_Number>
                            <Patient_Information type="record">
                              <Patient_ID type="string">99999</Patient_ID>
                              <WholeName type="string">must not leak</WholeName>
                            </Patient_Information>
                          </Visit_List_Information_child>
                        </Visit_List_Information>
                      </visitptlst01res>
                    </xmlio2>
                    """, "application/xml", Collections.emptyMap());
        }
    }
}
