package open.dolphin.reporting;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import open.dolphin.reporting.api.ReportingChartRevisionEventPayload;
import open.dolphin.reporting.api.ReportingOrcaEventPayload;
import open.dolphin.reporting.api.ReportingPayload;
import open.dolphin.reporting.api.ReportingPrescriptionEventPayload;
import org.junit.jupiter.api.Test;

class ReportingChartRevisionEventTest {

    @Test
    void chartRevisionEventsBecomeReportSummaryItemsWithRedactionAndAllowlist() {
        ReportingPayload payload = new ReportingPayload();
        payload.setChartRevisionEvents(Arrays.asList(chartRevisionEvent()));
        ReportContext.Builder builder = ReportContext.builder(Locale.JAPAN)
                .documentTitle("診療録")
                .patient("Sanitized Patient", LocalDate.of(1980, 1, 1))
                .attendingDoctor("doctor")
                .encounterDate(LocalDate.of(2026, 5, 10))
                .generatedAt(ZonedDateTime.of(2026, 5, 10, 12, 0, 0, 0, ZoneId.of("UTC")));

        new ReportingEngine().appendChartRevisionEvents(payload, builder);

        ReportContext context = builder.build();
        assertEquals(1, context.getSummaryItems().size());
        ReportSummaryItem item = context.getSummaryItems().get(0);
        assertEquals("診療録履歴: AMENDED", item.getLabel());
        assertEquals("Chart revision event: AMENDED", item.getLabelEn());
        assertTrue(item.getValue().contains("eventId=31"));
        assertTrue(item.getValue().contains("reasonCode=CORRECTION"));
        assertTrue(item.getValue().contains("Authorization: [redacted]"));
        assertTrue(item.getValue().contains("[redacted-xml-body]"));
        assertTrue(item.getValue().contains("before.status=FINAL"));
        assertTrue(item.getValue().contains("after.newRevisionCreated=true"));
        assertFalse(item.getValue().contains("Basic secret"));
        assertFalse(item.getValue().contains("csrfToken"));
        assertFalse(item.getValue().contains("rawOrcaBody"));
        assertFalse(item.getValue().contains("Patient_Name"));
    }

    @Test
    void prescriptionAndOrcaEventsBecomeReportSummaryItemsWithRedactionAndAllowlist() {
        ReportingPayload payload = new ReportingPayload();
        payload.setPrescriptionEvents(Arrays.asList(prescriptionEvent()));
        payload.setOrcaEvents(Arrays.asList(orcaEvent()));
        ReportContext.Builder builder = ReportContext.builder(Locale.JAPAN)
                .documentTitle("診療録")
                .patient("Sanitized Patient", LocalDate.of(1980, 1, 1))
                .attendingDoctor("doctor")
                .encounterDate(LocalDate.of(2026, 5, 10))
                .generatedAt(ZonedDateTime.of(2026, 5, 10, 12, 0, 0, 0, ZoneId.of("UTC")));

        ReportingEngine engine = new ReportingEngine();
        engine.appendPrescriptionEvents(payload, builder);
        engine.appendOrcaEvents(payload, builder);

        ReportContext context = builder.build();
        assertEquals(2, context.getSummaryItems().size());

        ReportSummaryItem prescription = context.getSummaryItems().get(0);
        assertEquals("処方履歴: CHANGE", prescription.getLabel());
        assertEquals("Prescription event: CHANGE", prescription.getLabelEn());
        assertTrue(prescription.getValue().contains("prescriptionOrderId=301"));
        assertTrue(prescription.getValue().contains("reasonCode=RX_REASON"));
        assertTrue(prescription.getValue().contains("Authorization: [redacted]"));
        assertTrue(prescription.getValue().contains("[redacted-xml-body]"));
        assertTrue(prescription.getValue().contains("after.contentHash=" + repeat("8", 64)));
        assertFalse(prescription.getValue().contains("Basic secret"));
        assertFalse(prescription.getValue().contains("rawOrcaBody"));
        assertFalse(prescription.getValue().contains("insuranceDetail"));

        ReportSummaryItem orca = context.getSummaryItems().get(1);
        assertEquals("ORCA連携履歴: ORCA_ACCEPTED", orca.getLabel());
        assertEquals("ORCA event: ORCA_ACCEPTED", orca.getLabelEn());
        assertTrue(orca.getValue().contains("orcaOperationId=801"));
        assertTrue(orca.getValue().contains("operationStatus=ORCA_ACCEPTED"));
        assertTrue(orca.getValue().contains("transportStatus=HTTP_OK"));
        assertTrue(orca.getValue().contains("operation.needsUserReview=false"));
        assertTrue(orca.getValue().contains("transmission.rawSensitiveFieldsExcluded=true"));
        assertFalse(orca.getValue().contains("idempotencyKey"));
        assertFalse(orca.getValue().contains("rawOrcaBody"));
        assertFalse(orca.getValue().contains("Patient_Name"));
        assertFalse(orca.getValue().contains("<xml>"));
    }

    private ReportingChartRevisionEventPayload chartRevisionEvent() {
        ReportingChartRevisionEventPayload event = new ReportingChartRevisionEventPayload();
        event.setEventId(31L);
        event.setChartRevisionId(20L);
        event.setPreviousRevisionId(20L);
        event.setNewRevisionId(21L);
        event.setEventType("AMENDED");
        event.setActorUserId(202L);
        event.setOccurredAt("2026-05-10T22:00:00Z");
        event.setReasonCode("CORRECTION");
        event.setReasonText("Authorization: Basic secret\n<?xml version=\"1.0\"?><xml>raw</xml>");
        event.setContentHash(repeat("a", 64));
        Map<String, Object> before = new LinkedHashMap<>();
        before.put("status", "FINAL");
        before.put("csrfToken", "secret");
        before.put("Patient_Name", "Do Not Export");
        Map<String, Object> after = new LinkedHashMap<>();
        after.put("eventType", "AMENDED");
        after.put("newRevisionCreated", true);
        after.put("rawOrcaBody", "<xml>raw</xml>");
        event.setBeforeSummary(before);
        event.setAfterSummary(after);
        return event;
    }

    private ReportingPrescriptionEventPayload prescriptionEvent() {
        ReportingPrescriptionEventPayload event = new ReportingPrescriptionEventPayload();
        event.setPrescriptionOrderId(301L);
        event.setPrescriptionRevisionId(401L);
        event.setChartRevisionId("20");
        event.setRevisionNumber(2);
        event.setStatus("CHANGED");
        event.setContentHash(repeat("8", 64));
        event.setEventId(501L);
        event.setEventType("CHANGE");
        event.setActorUserId("doctor01");
        event.setOccurredAt("2026-05-11T11:00:00Z");
        event.setReasonCode("RX_REASON");
        event.setReasonText("Authorization: Basic secret\n<?xml version=\"1.0\"?><xml>raw</xml>");
        event.setEventHash(repeat("9", 64));
        Map<String, Object> before = new LinkedHashMap<>();
        before.put("status", "FINAL");
        before.put("rawOrcaBody", "<xml>raw</xml>");
        Map<String, Object> after = new LinkedHashMap<>();
        after.put("contentHash", repeat("8", 64));
        after.put("rawSensitiveFieldsExcluded", true);
        after.put("insuranceDetail", "secret");
        event.setBeforeSummary(before);
        event.setAfterSummary(after);
        return event;
    }

    private ReportingOrcaEventPayload orcaEvent() {
        ReportingOrcaEventPayload event = new ReportingOrcaEventPayload();
        event.setOrcaOperationId(801L);
        event.setChartRevisionId("20");
        event.setOperationScope("MEDICAL");
        event.setOperationType("TEMPORARY_MEDICAL_CREATE");
        event.setSourceApi("api21/medicalmod");
        event.setOperationStatus("ORCA_ACCEPTED");
        event.setRequestedBy("doctor01");
        event.setRequestedAt("2026-05-11T11:10:00Z");
        event.setCompletedAt("2026-05-11T11:12:00Z");
        event.setRequestHash(repeat("7", 64));
        event.setResponseHash(repeat("8", 64));
        event.setRetryCount(1);
        event.setNeedsUserReview(false);
        event.setLatestTransmissionId(901L);
        event.setTransmissionStatus("ORCA_ACCEPTED");
        event.setTransportStatus("HTTP_OK");
        event.setAttemptNumber(2);
        event.setTransmissionStartedAt("2026-05-11T11:11:00Z");
        event.setTransmissionCompletedAt("2026-05-11T11:12:00Z");
        event.setTransmissionRequestHash(repeat("7", 64));
        event.setTransmissionResponseHash(repeat("8", 64));
        event.setReconciliationStatus("MATCHED");
        Map<String, Object> operation = new LinkedHashMap<>();
        operation.put("operationStatus", "ORCA_ACCEPTED");
        operation.put("needsUserReview", false);
        operation.put("idempotencyKey", "server-secret-key");
        operation.put("rawOrcaBody", "<xml>raw</xml>");
        Map<String, Object> transmission = new LinkedHashMap<>();
        transmission.put("apiResult", "00");
        transmission.put("rawSensitiveFieldsExcluded", true);
        transmission.put("Patient_Name", "Do Not Export");
        transmission.put("rawResponse", "<?xml version=\"1.0\"?><xml>raw</xml>");
        event.setOperationSummary(operation);
        event.setTransmissionSummary(transmission);
        return event;
    }

    private String repeat(String value, int count) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < count; i++) {
            builder.append(value);
        }
        return builder.toString();
    }
}
