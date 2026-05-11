package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModResponse;
import open.dolphin.security.audit.AuthoritativeAuditRepository;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class OrcaBillingCorrectionScenarioSupportTest {

    @Test
    void medicalModWarningsRemainCorrectionNotesAndDoNotInventPaidConfirmation() {
        OrcaChartSupportSupport support = new OrcaChartSupportSupport();

        ChartSupportMedicalModResponse response = support.parseMedicalModResponse(
                OrcaTransportResult.fallback("""
                        <data>
                          <medicalres type="record">
                            <Api_Result type="string">00</Api_Result>
                            <Api_Result_Message type="string">OK</Api_Result_Message>
                            <Invoice_Number type="string">INV-001</Invoice_Number>
                            <Data_Id type="string">DATA-001</Data_Id>
                            <Medical_Warning_Info type="array">
                              <Medical_Warning_Info_child type="record">
                                <Medical_Warning type="string">W01</Medical_Warning>
                                <Medical_Warning_Message type="string">補正候補あり</Medical_Warning_Message>
                                <Medical_Warning_Position type="string">1</Medical_Warning_Position>
                                <Medical_Warning_Item_Position type="string">2</Medical_Warning_Item_Position>
                                <Medical_Warning_Code type="string">WARN-01</Medical_Warning_Code>
                              </Medical_Warning_Info_child>
                            </Medical_Warning_Info>
                          </medicalres>
                        </data>
                        """, "application/xml"),
                "RUN-1",
                "TRACE-1");

        assertTrue(response.isOk());
        assertEquals("INV-001", response.getInvoiceNumber());
        assertEquals("DATA-001", response.getDataId());
        assertEquals("ORCA_WARNING", response.getOperationStatus());
        assertTrue(response.isNeedsUserReview());
        assertEquals(1, response.getMedicalWarnings().size());
        assertEquals("補正候補あり", response.getMedicalWarnings().get(0).getMedicalWarningMessage());
    }

    @Test
    void medicalModBusinessRejectAndTransportFailureUseFixedReviewStatuses() {
        OrcaChartSupportSupport support = new OrcaChartSupportSupport();

        ChartSupportMedicalModResponse businessRejected = support.parseMedicalModResponse(
                OrcaTransportResult.fallback("""
                        <data>
                          <medicalres type="record">
                            <Api_Result type="string">80</Api_Result>
                            <Api_Result_Message type="string">受付できません</Api_Result_Message>
                          </medicalres>
                        </data>
                        """, "application/xml"),
                "RUN-REJECT",
                "TRACE-REJECT");
        assertEquals("ORCA_REJECTED", businessRejected.getOperationStatus());
        assertTrue(businessRejected.isNeedsUserReview());

        ChartSupportMedicalModResponse transportFailed = support.parseMedicalModResponse(
                new OrcaTransportResult(null, "POST", 503, """
                        <data>
                          <medicalres type="record">
                            <Api_Result type="string">00</Api_Result>
                          </medicalres>
                        </data>
                        """, "application/xml", java.util.Map.of()),
                "RUN-NET",
                "TRACE-NET");
        assertEquals("NETWORK_FAILED", transportFailed.getOperationStatus());
        assertTrue(transportFailed.isNeedsUserReview());
    }

    @Test
    void closeAndSendUnknownResponsePersistsSanitizedReviewClassification() {
        LocalEncounterBillingWorkflowResource resource = new LocalEncounterBillingWorkflowResource();

        ChartSupportMedicalModResponse response = resource.unknownMedicalResponse("RUN-UNKNOWN", "TRACE-UNKNOWN");
        String serialized = resource.serializeResponse(response, true);

        assertEquals("UNKNOWN", response.getOperationStatus());
        assertTrue(response.isNeedsUserReview());
        assertTrue(serialized.contains("\"operationStatus\":\"UNKNOWN\""));
        assertTrue(serialized.contains("\"needsUserReview\":true"));
        assertTrue(serialized.contains("\"confirmationRequired\":true"));
    }

    @Test
    void billingMutationsFailClosedWhenAuditWritePathIsUnavailable() {
        LocalEncounterBillingWorkflowResource resource = new LocalEncounterBillingWorkflowResource();
        resource.authoritativeAuditRepository = new StubAuditRepository(false);

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.requireAuditWritePathAvailable(null));

        assertEquals(Response.Status.SERVICE_UNAVAILABLE.getStatusCode(), ex.getResponse().getStatus());
        assertTrue(String.valueOf(ex.getResponse().getEntity()).contains("audit_log_write_unavailable"));
    }

    @Test
    void temporaryMedicalReconcileUsesServerSnapshotAndReturnsSanitizedMatch() {
        LocalEncounterBillingWorkflowResource resource = new LocalEncounterBillingWorkflowResource();
        BillingOrcaWorkflowRepository.TransmissionReviewRecord record =
                new BillingOrcaWorkflowRepository.TransmissionReviewRecord(
                        42L,
                        100L,
                        "FAC-1",
                        "encounter-1",
                        "idem-1",
                        "ORCA_UNKNOWN",
                        null,
                        "unknown",
                        "result_unknown",
                        200,
                        "REQ-1",
                        "TRACE-1",
                        "00012",
                        "schedule-1",
                        java.time.Instant.parse("2026-05-10T15:00:00Z"),
                        null,
                        """
                        {"visitDate":"2026-05-10","departmentCode":"01","rawSensitiveFieldsExcluded":true,"clientProvidedIdentifiersTrusted":false,"serverDerivedAuthorityRequired":true}
                        """);

        String payload = resource.buildTemporaryMedicalGetPayload(record);
        assertTrue(payload.contains("<tmedicalgetreq type=\"record\">"));
        assertTrue(payload.contains("<Perform_Date type=\"string\">2026-05-10</Perform_Date>"));
        assertTrue(payload.contains("<InOut type=\"string\">2</InOut>"));
        assertTrue(payload.contains("<Department_Code type=\"string\">01</Department_Code>"));
        assertTrue(payload.contains("<Patient_ID type=\"string\">00012</Patient_ID>"));
        assertTrue(!payload.contains("Insurance_Combination_Number"));
        assertTrue(!payload.contains("Medical_Uid"));

        var response = new open.dolphin.rest.dto.orca.BillingOrcaTemporaryMedicalReconcileResponse();
        resource.applyTemporaryMedicalGetResult(
                response,
                record,
                OrcaTransportResult.fallback("""
                        <xmlio2>
                          <tmedicalgetres type="record">
                            <Api_Result type="string">00</Api_Result>
                            <Api_Result_Message type="string">処理終了</Api_Result_Message>
                            <Tmedical_List_Information type="array">
                              <Tmedical_List_Information_child type="record">
                                <Patient_Information type="record">
                                  <Patient_ID type="string">00012</Patient_ID>
                                  <WholeName type="string">日医 太郎</WholeName>
                                </Patient_Information>
                                <Department_Code type="string">01</Department_Code>
                                <Insurance_Combination_Number type="string">0002</Insurance_Combination_Number>
                                <Medical_Uid type="string">secret-medical-uid</Medical_Uid>
                                <Medical_Mode type="string">0</Medical_Mode>
                                <Medical_Mode2 type="string">0</Medical_Mode2>
                              </Tmedical_List_Information_child>
                            </Tmedical_List_Information>
                          </tmedicalgetres>
                        </xmlio2>
                        """, "application/xml"));

        assertTrue(response.isOk(), "status=" + response.getReconciliationStatus()
                + " rows=" + response.getTemporaryMedicalRowCount()
                + " matches=" + response.getMatchingTemporaryMedicalRowCount()
                + " api=" + response.getApiResult());
        assertEquals("ORCA_TEMPORARY_MEDICAL_FOUND", response.getOperationStatus());
        assertEquals("TEMPORARY_MEDICAL_FOUND", response.getReconciliationStatus());
        assertEquals(1, response.getTemporaryMedicalRowCount());
        assertEquals(1, response.getMatchingTemporaryMedicalRowCount());
        assertTrue(response.isMedicalUidPresent());
        assertEquals("0", response.getMedicalMode());
        assertEquals("0", response.getMedicalMode2());
        assertTrue(!response.isResendBlocked());
        assertTrue(response.isRawSensitiveFieldsExcluded());
        assertTrue(!response.isClientProvidedIdentifiersTrusted());
        assertTrue(response.isServerDerivedAuthorityRequired());
    }

    @Test
    void temporaryMedicalReconcileRequiresSnapshotVisitDateAndDepartment() {
        LocalEncounterBillingWorkflowResource resource = new LocalEncounterBillingWorkflowResource();
        BillingOrcaWorkflowRepository.TransmissionReviewRecord missingVisitDate =
                new BillingOrcaWorkflowRepository.TransmissionReviewRecord(
                        43L,
                        101L,
                        "FAC-1",
                        "encounter-missing-visit-date",
                        "idem-missing-visit-date",
                        "ORCA_UNKNOWN",
                        null,
                        "unknown",
                        "result_unknown",
                        200,
                        "REQ-2",
                        "TRACE-2",
                        "00012",
                        "schedule-2",
                        Instant.parse("2026-05-10T15:00:00Z"),
                        null,
                        """
                        {"departmentCode":"01","rawSensitiveFieldsExcluded":true,"clientProvidedIdentifiersTrusted":false,"serverDerivedAuthorityRequired":true}
                        """);
        BillingOrcaWorkflowRepository.TransmissionReviewRecord missingDepartment =
                new BillingOrcaWorkflowRepository.TransmissionReviewRecord(
                        44L,
                        102L,
                        "FAC-1",
                        "encounter-missing-department",
                        "idem-missing-department",
                        "ORCA_UNKNOWN",
                        null,
                        "unknown",
                        "result_unknown",
                        200,
                        "REQ-3",
                        "TRACE-3",
                        "00012",
                        "schedule-3",
                        Instant.parse("2026-05-10T15:00:00Z"),
                        null,
                        """
                        {"visitDate":"2026-05-10","rawSensitiveFieldsExcluded":true,"clientProvidedIdentifiersTrusted":false,"serverDerivedAuthorityRequired":true}
                        """);

        IllegalArgumentException visitDateError = assertThrows(IllegalArgumentException.class,
                () -> resource.buildTemporaryMedicalGetPayload(missingVisitDate));
        IllegalArgumentException departmentError = assertThrows(IllegalArgumentException.class,
                () -> resource.buildTemporaryMedicalGetPayload(missingDepartment));

        assertTrue(visitDateError.getMessage().contains("visitDate"));
        assertTrue(departmentError.getMessage().contains("departmentCode"));
    }

    @Test
    void temporaryMedicalReconcileRequiresSanitizedServerDerivedSnapshot() {
        LocalEncounterBillingWorkflowResource resource = new LocalEncounterBillingWorkflowResource();
        BillingOrcaWorkflowRepository.TransmissionReviewRecord clientTrustedSnapshot =
                new BillingOrcaWorkflowRepository.TransmissionReviewRecord(
                        45L,
                        103L,
                        "FAC-1",
                        "encounter-client-trusted",
                        "idem-client-trusted",
                        "ORCA_UNKNOWN",
                        null,
                        "unknown",
                        "result_unknown",
                        200,
                        "REQ-4",
                        "TRACE-4",
                        "00012",
                        "schedule-4",
                        Instant.parse("2026-05-10T15:00:00Z"),
                        null,
                        """
                        {"visitDate":"2026-05-10","departmentCode":"01","rawSensitiveFieldsExcluded":true,"clientProvidedIdentifiersTrusted":true,"serverDerivedAuthorityRequired":true}
                        """);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> resource.buildTemporaryMedicalGetPayload(clientTrustedSnapshot));

        assertTrue(ex.getMessage().contains("server-derived"));
    }

    @Test
    void temporaryMedicalReconcileDoesNotMatchDifferentPerformDate() {
        LocalEncounterBillingWorkflowResource resource = new LocalEncounterBillingWorkflowResource();
        BillingOrcaWorkflowRepository.TransmissionReviewRecord record =
                new BillingOrcaWorkflowRepository.TransmissionReviewRecord(
                        46L,
                        104L,
                        "FAC-1",
                        "encounter-date-mismatch",
                        "idem-date-mismatch",
                        "ORCA_UNKNOWN",
                        null,
                        "unknown",
                        "result_unknown",
                        200,
                        "REQ-5",
                        "TRACE-5",
                        "00012",
                        "schedule-5",
                        Instant.parse("2026-05-10T15:00:00Z"),
                        null,
                        """
                        {"visitDate":"2026-05-10","departmentCode":"01","rawSensitiveFieldsExcluded":true,"clientProvidedIdentifiersTrusted":false,"serverDerivedAuthorityRequired":true}
                        """);

        var response = new open.dolphin.rest.dto.orca.BillingOrcaTemporaryMedicalReconcileResponse();
        resource.applyTemporaryMedicalGetResult(
                response,
                record,
                OrcaTransportResult.fallback("""
                        <xmlio2>
                          <tmedicalgetres type="record">
                            <Api_Result type="string">00</Api_Result>
                            <Api_Result_Message type="string">処理終了</Api_Result_Message>
                            <Tmedical_List_Information type="array">
                              <Tmedical_List_Information_child type="record">
                                <Patient_Information type="record">
                                  <Patient_ID type="string">00012</Patient_ID>
                                </Patient_Information>
                                <Perform_Date type="string">2026-05-11</Perform_Date>
                                <Department_Code type="string">01</Department_Code>
                                <Medical_Uid type="string">secret-medical-uid</Medical_Uid>
                                <Medical_Mode type="string">0</Medical_Mode>
                                <Medical_Mode2 type="string">0</Medical_Mode2>
                              </Tmedical_List_Information_child>
                            </Tmedical_List_Information>
                          </tmedicalgetres>
                        </xmlio2>
                        """, "application/xml"));

        assertTrue(!response.isOk());
        assertEquals("NEEDS_REVIEW", response.getOperationStatus());
        assertEquals("TEMPORARY_MEDICAL_NOT_FOUND", response.getReconciliationStatus());
        assertEquals(1, response.getTemporaryMedicalRowCount());
        assertEquals(0, response.getMatchingTemporaryMedicalRowCount());
        assertTrue(!response.isMedicalUidPresent());
    }

    @Test
    void temporaryMedicalReconcileBlocksResendWhenOrcaModeIsLocked() {
        LocalEncounterBillingWorkflowResource resource = new LocalEncounterBillingWorkflowResource();
        BillingOrcaWorkflowRepository.TransmissionReviewRecord record =
                new BillingOrcaWorkflowRepository.TransmissionReviewRecord(
                        41L,
                        19L,
                        "FAC-1",
                        "encounter-billing",
                        "idem-locked",
                        "ORCA_UNKNOWN",
                        null,
                        "unknown",
                        "result_unknown",
                        200,
                        "REQ-LOCKED",
                        "TRACE-LOCKED",
                        "00012",
                        "schedule-billing",
                        Instant.parse("2026-05-10T01:00:00Z"),
                        null,
                        """
                                {
                                  "visitDate":"2026-05-10",
                                  "departmentCode":"01",
                                  "rawSensitiveFieldsExcluded":true,
                                  "clientProvidedIdentifiersTrusted":false,
                                  "serverDerivedAuthorityRequired":true
                                }
                                """);

        var response = new open.dolphin.rest.dto.orca.BillingOrcaTemporaryMedicalReconcileResponse();
        resource.applyTemporaryMedicalGetResult(
                response,
                record,
                OrcaTransportResult.fallback("""
                        <xmlio2>
                          <tmedicalgetres type="record">
                            <Api_Result type="string">00</Api_Result>
                            <Api_Result_Message type="string">処理終了</Api_Result_Message>
                            <Tmedical_List_Information type="array">
                              <Tmedical_List_Information_child type="record">
                                <Patient_Information type="record">
                                  <Patient_ID type="string">00012</Patient_ID>
                                </Patient_Information>
                                <Department_Code type="string">01</Department_Code>
                                <Medical_Uid type="string">secret-medical-uid</Medical_Uid>
                                <Medical_Mode type="string">0</Medical_Mode>
                                <Medical_Mode2 type="string">2</Medical_Mode2>
                              </Tmedical_List_Information_child>
                            </Tmedical_List_Information>
                          </tmedicalgetres>
                        </xmlio2>
                        """, "application/xml"));

        assertTrue(!response.isOk());
        assertTrue(response.isResendBlocked());
        assertEquals("ORCA_TEMPORARY_MEDICAL_MODE_LOCKED", response.getResendBlockReason());
        assertEquals("ORCA_RESEND_BLOCKED", response.getOperationStatus());
        assertEquals("TEMPORARY_MEDICAL_FOUND_RESEND_BLOCKED", response.getReconciliationStatus());
        assertEquals(1, response.getMatchingTemporaryMedicalRowCount());
        assertEquals("2", response.getMedicalMode2());
        assertTrue(response.getMessage().contains("再送"));
    }

    @Test
    void incomeInfoKeepsConfirmationSourceSeparateFromMedicalModResponse() {
        OrcaChartSupportSupport support = new OrcaChartSupportSupport();

        ChartSupportIncomeInfoResponse response = support.parseIncomeInfoResponse(
                OrcaTransportResult.fallback("""
                        <data>
                          <incomeinfores type="record">
                            <Api_Result type="string">0000</Api_Result>
                            <Api_Result_Message type="string">OK</Api_Result_Message>
                            <Income_Information type="array">
                              <Income_Information_child type="record">
                                <Perform_Date type="string">2026-04-17</Perform_Date>
                                <Invoice_Number type="string">INV-001</Invoice_Number>
                                <Department_Name type="string">内科</Department_Name>
                                <Cd_Information type="record">
                                  <Ac_Money type="string">1200</Ac_Money>
                                  <Ic_Money type="string">1200</Ic_Money>
                                </Cd_Information>
                              </Income_Information_child>
                            </Income_Information>
                          </incomeinfores>
                        </data>
                        """, "application/xml"),
                "RUN-2",
                "TRACE-2");

        assertTrue(response.isOk());
        assertEquals(1, response.getEntries().size());
        assertEquals("INV-001", response.getEntries().get(0).getInvoiceNumber());
        assertEquals(1200.0, response.getEntries().get(0).getIcMoney(), 0.0001);
        assertEquals("RUN-2", response.getRunId());
    }

    private static final class StubAuditRepository extends AuthoritativeAuditRepository {
        private final boolean available;

        private StubAuditRepository(boolean available) {
            this.available = available;
        }

        @Override
        public boolean isWritePathAvailable() {
            return available;
        }
    }
}
