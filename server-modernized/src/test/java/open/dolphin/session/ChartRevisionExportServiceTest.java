package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import open.dolphin.infomodel.ChartDocumentModel;
import open.dolphin.infomodel.ChartRevisionEventModel;
import open.dolphin.infomodel.ChartRevisionEventType;
import open.dolphin.infomodel.ChartRevisionModel;
import open.dolphin.infomodel.ChartRevisionStatus;
import open.dolphin.rest.dto.chart.ChartRevisionExportResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ChartRevisionExportServiceTest {

    private ChartRevisionExportService service;
    private EntityManager em;

    @BeforeEach
    void setUp() throws Exception {
        service = new ChartRevisionExportService();
        em = mock(EntityManager.class);
        setField(service, "em", em);
    }

    @Test
    void exportChartIncludesRevisionEventsAndSanitizesUnsafePayloads() {
        stubExportQueries(List.of(finalRevision(), amendedRevision()), List.of(finalizedEvent(), amendedEvent()));

        ChartRevisionExportResponse response = service.exportChart(10L, "F001");

        assertThat(response.getChartId()).isEqualTo(10L);
        assertThat(response.getCurrentRevisionId()).isEqualTo(21L);
        assertThat(response.getRevisions()).hasSize(2);
        assertThat(response.getRevisions().get(1).getStatus()).isEqualTo("AMENDED");
        assertThat(response.getRevisions().get(0).getSnapshotManifest())
                .containsEntry("snapshotVersion", 1L)
                .containsEntry("patientSnapshotStatus", "IDENTIFIER_ONLY")
                .doesNotContainKey("patientName")
                .doesNotContainKey("rawOrcaBody");
        assertThat(response.getEvents()).hasSize(2);
        assertThat(response.getEvents().get(0).getEventType()).isEqualTo("FINALIZED");
        assertThat(response.getEvents().get(0).getAfterSummary())
                .containsEntry("contentHash", "a".repeat(64))
                .containsEntry("hasOrcaAcceptanceId", true)
                .doesNotContainKey("patientName")
                .doesNotContainKey("rawOrcaBody");
        assertThat(response.getEvents().get(1).getReasonText()).contains("Authorization: [redacted]");
        assertThat(response.getEvents().get(1).getReasonText()).contains("[redacted-xml-body]");
        assertThat(response.getEvents().get(1).getReasonText()).doesNotContain("Basic secret");
        assertThat(response.getEvents().get(1).getReasonText()).doesNotContain("<xml>");
        assertThat(response.getEvents().get(1).getBeforeSummary()).doesNotContainKey("csrfToken");
    }

    @Test
    void exportChartCsvIncludesHistoryAndNeutralizesSpreadsheetFormulaInjection() {
        ChartRevisionEventModel event = amendedEvent();
        event.setReasonText("=HYPERLINK(\"https://example.test\",\"Authorization: Basic secret\")");
        stubExportQueries(List.of(finalRevision()), List.of(event));

        String csv = service.exportChartCsv(10L, "F001");

        assertThat(csv).contains("\"recordType\",\"chartId\",\"currentRevisionId\"");
        assertThat(csv).contains("\"revision\",\"10\",\"21\",\"20\",\"1\",\"FINAL\"");
        assertThat(csv).contains("snapshot.patientSnapshotStatus=IDENTIFIER_ONLY");
        assertThat(csv).contains("\"event\",\"10\",\"21\",\"20\",,,\"31\",\"AMENDED\"");
        assertThat(csv).contains("\"'=HYPERLINK(\"\"https://example.test\"\",\"\"Authorization: [redacted]");
        assertThat(csv).contains("after.eventType=AMENDED");
        assertThat(csv).doesNotContain("Basic secret");
        assertThat(csv).doesNotContain("csrfToken");
    }

    @Test
    void exportChartRejectsFacilityMismatch() {
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(chartDocument());

        Throwable thrown = catchThrowable(() -> service.exportChart(10L, "F999"));

        assertThat(thrown).isInstanceOf(WebApplicationException.class);
        assertThat(((WebApplicationException) thrown).getResponse().getStatus()).isEqualTo(403);
    }

    @Test
    void exportChartRejectsMissingDocument() {
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(null);

        Throwable thrown = catchThrowable(() -> service.exportChart(10L, "F001"));

        assertThat(thrown).isInstanceOf(WebApplicationException.class);
        assertThat(((WebApplicationException) thrown).getResponse().getStatus()).isEqualTo(404);
    }

    private ChartDocumentModel chartDocument() {
        ChartDocumentModel document = new ChartDocumentModel();
        document.setId(10L);
        document.setFacilityId("F001");
        document.setCurrentRevisionId(21L);
        return document;
    }

    private ChartRevisionModel finalRevision() {
        ChartRevisionModel revision = revision(20L, 1, ChartRevisionStatus.FINAL);
        revision.setFinalizedAt(Instant.parse("2026-05-10T21:00:00Z"));
        return revision;
    }

    private ChartRevisionModel amendedRevision() {
        ChartRevisionModel revision = revision(21L, 2, ChartRevisionStatus.AMENDED);
        revision.setFinalizedAt(Instant.parse("2026-05-10T22:00:00Z"));
        return revision;
    }

    private ChartRevisionModel revision(long id, int revisionNumber, ChartRevisionStatus status) {
        ChartRevisionModel revision = new ChartRevisionModel();
        revision.setId(id);
        revision.setChartDocumentId(10L);
        revision.setRevisionNumber(revisionNumber);
        revision.setStatus(status);
        revision.setTitle("Progress note");
        revision.setContentHash(id == 20L ? "a".repeat(64) : "b".repeat(64));
        revision.setEncounterId("ENC-001");
        revision.setEncounterDate(LocalDate.parse("2026-05-10"));
        revision.setDepartmentCode("01");
        revision.setPhysicianCode("10001");
        revision.setInsuranceCombinationNumber("0001");
        revision.setSnapshotManifestJson("{\"snapshotVersion\":1,\"source\":\"CHART_FINALIZE\","
                + "\"patientSnapshotStatus\":\"IDENTIFIER_ONLY\","
                + "\"patientName\":\"Do Not Export\","
                + "\"rawOrcaBody\":\"<xml>raw</xml>\"}");
        revision.setEnteredByUserId(101L);
        revision.setFinalizedByUserId(202L);
        return revision;
    }

    private ChartRevisionEventModel finalizedEvent() {
        ChartRevisionEventModel event = new ChartRevisionEventModel();
        event.setId(30L);
        event.setChartDocumentId(10L);
        event.setChartRevisionId(20L);
        event.setNewRevisionId(20L);
        event.setEventType(ChartRevisionEventType.FINALIZED);
        event.setActorUserId(101L);
        event.setOccurredAt(Instant.parse("2026-05-10T21:00:00Z"));
        event.setReasonCode("FINALIZE");
        event.setAfterSummaryJson("{\"contentHash\":\"" + "a".repeat(64)
                + "\",\"hasOrcaAcceptanceId\":true,\"patientName\":\"Do Not Export\","
                + "\"rawOrcaBody\":\"<xml>raw</xml>\"}");
        event.setBeforeSummaryJson("{\"status\":\"DRAFT\"}");
        event.setEventHash("c".repeat(64));
        return event;
    }

    private ChartRevisionEventModel amendedEvent() {
        ChartRevisionEventModel event = new ChartRevisionEventModel();
        event.setId(31L);
        event.setChartDocumentId(10L);
        event.setChartRevisionId(20L);
        event.setPreviousRevisionId(20L);
        event.setNewRevisionId(21L);
        event.setEventType(ChartRevisionEventType.AMENDED);
        event.setActorUserId(202L);
        event.setOccurredAt(Instant.parse("2026-05-10T22:00:00Z"));
        event.setReasonCode("CORRECTION");
        event.setReasonText("Authorization: Basic secret\n<?xml version=\"1.0\"?><xml>raw</xml>");
        event.setBeforeSummaryJson("{\"status\":\"FINAL\",\"csrfToken\":\"secret\"}");
        event.setAfterSummaryJson("{\"eventType\":\"AMENDED\",\"newRevisionCreated\":true}");
        event.setEventHash("d".repeat(64));
        return event;
    }

    private void stubExportQueries(List<ChartRevisionModel> revisions, List<ChartRevisionEventModel> events) {
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(chartDocument());
        TypedQuery<ChartRevisionModel> revisionQuery = mock(TypedQuery.class);
        TypedQuery<ChartRevisionEventModel> eventQuery = mock(TypedQuery.class);
        when(em.createQuery(startsWith("select r from ChartRevisionModel"), eq(ChartRevisionModel.class)))
                .thenReturn(revisionQuery);
        when(em.createQuery(startsWith("select e from ChartRevisionEventModel"), eq(ChartRevisionEventModel.class)))
                .thenReturn(eventQuery);
        when(revisionQuery.setParameter("chartId", 10L)).thenReturn(revisionQuery);
        when(eventQuery.setParameter("chartId", 10L)).thenReturn(eventQuery);
        when(revisionQuery.getResultList()).thenReturn(revisions);
        when(eventQuery.getResultList()).thenReturn(events);
    }

    private void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
