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
import open.dolphin.reporting.api.ReportingPayload;
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

    private String repeat(String value, int count) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < count; i++) {
            builder.append(value);
        }
        return builder.toString();
    }
}
