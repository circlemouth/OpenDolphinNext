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
        assertThat(response.getCurrentRevisionNumber()).isEqualTo(2);
        assertThat(response.getCurrentRevisionStatus()).isEqualTo("AMENDED");
        assertThat(response.getCurrentRevisionContentHash()).isEqualTo("b".repeat(64));
        assertThat(response.getExportSchemaVersion()).isEqualTo(1);
        assertThat(response.getExportHashAlgorithm()).isEqualTo("SHA-256");
        assertThat(response.getExportHash()).matches("[0-9a-f]{64}");
        assertThat(response.getRevisionCount()).isEqualTo(2);
        assertThat(response.getEventCount()).isEqualTo(2);
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
    void exportChartReportsRecordCountsAndIncludesThemInHashContract() {
        stubExportQueries(List.of(finalRevision()), List.of(amendedEvent()));

        ChartRevisionExportResponse oneEvent = service.exportChart(10L, "F001");

        stubExportQueries(List.of(finalRevision()), List.of(finalizedEvent(), amendedEvent()));

        ChartRevisionExportResponse twoEvents = service.exportChart(10L, "F001");

        assertThat(oneEvent.getRevisionCount()).isEqualTo(1);
        assertThat(oneEvent.getEventCount()).isEqualTo(1);
        assertThat(twoEvents.getRevisionCount()).isEqualTo(1);
        assertThat(twoEvents.getEventCount()).isEqualTo(2);
        assertThat(twoEvents.getExportHash()).matches("[0-9a-f]{64}");
        assertThat(twoEvents.getExportHash()).isNotEqualTo(oneEvent.getExportHash());
    }

    @Test
    void exportChartReportsCurrentRevisionMetadataAndIncludesItInHashContract() {
        stubExportQueries(List.of(finalRevision(), amendedRevision()), List.of(finalizedEvent(), amendedEvent()));

        ChartRevisionExportResponse amendedCurrent = service.exportChart(10L, "F001");

        stubExportQueries(chartDocument(20L), List.of(finalRevision(), amendedRevision()),
                List.of(finalizedEvent(), amendedEvent()));

        ChartRevisionExportResponse finalCurrent = service.exportChart(10L, "F001");

        assertThat(amendedCurrent.getCurrentRevisionNumber()).isEqualTo(2);
        assertThat(amendedCurrent.getCurrentRevisionStatus()).isEqualTo("AMENDED");
        assertThat(amendedCurrent.getCurrentRevisionContentHash()).isEqualTo("b".repeat(64));
        assertThat(finalCurrent.getCurrentRevisionNumber()).isEqualTo(1);
        assertThat(finalCurrent.getCurrentRevisionStatus()).isEqualTo("FINAL");
        assertThat(finalCurrent.getCurrentRevisionContentHash()).isEqualTo("a".repeat(64));
        assertThat(finalCurrent.getExportHash()).matches("[0-9a-f]{64}");
        assertThat(finalCurrent.getExportHash()).isNotEqualTo(amendedCurrent.getExportHash());
    }

    @Test
    void exportChartHashChangesWhenSanitizedEventPayloadChanges() {
        ChartRevisionEventModel firstEvent = amendedEvent();
        stubExportQueries(List.of(finalRevision()), List.of(firstEvent));
        String firstHash = service.exportChart(10L, "F001").getExportHash();

        ChartRevisionEventModel secondEvent = amendedEvent();
        secondEvent.setReasonText("Clinically different reason");
        stubExportQueries(List.of(finalRevision()), List.of(secondEvent));
        String secondHash = service.exportChart(10L, "F001").getExportHash();

        assertThat(firstHash).matches("[0-9a-f]{64}");
        assertThat(secondHash).matches("[0-9a-f]{64}");
        assertThat(secondHash).isNotEqualTo(firstHash);
    }

    @Test
    void exportChartHashUsesCanonicalAllowlistedProjection() {
        ChartRevisionModel firstRevision = finalRevision();
        firstRevision.setSnapshotManifestJson("{\"snapshotVersion\":1,\"source\":\"CHART_FINALIZE\","
                + "\"patientSnapshotStatus\":\"IDENTIFIER_ONLY\","
                + "\"patientName\":\"Do Not Export\"}");
        ChartRevisionEventModel firstEvent = amendedEvent();
        firstEvent.setReasonText("Authorization: Basic first-secret\n<?xml version=\"1.0\"?><xml>raw</xml>");
        stubExportQueries(List.of(firstRevision), List.of(firstEvent));
        String firstHash = service.exportChart(10L, "F001").getExportHash();

        ChartRevisionModel secondRevision = finalRevision();
        secondRevision.setSnapshotManifestJson("{\"patientName\":\"Different Excluded Name\","
                + "\"patientSnapshotStatus\":\"IDENTIFIER_ONLY\","
                + "\"source\":\"CHART_FINALIZE\","
                + "\"rawOrcaBody\":\"<xml>raw</xml>\","
                + "\"snapshotVersion\":1}");
        ChartRevisionEventModel secondEvent = amendedEvent();
        secondEvent.setReasonText("Authorization: Basic second-secret\n<?xml version=\"1.0\"?><xml>different</xml>");
        stubExportQueries(List.of(secondRevision), List.of(secondEvent));
        String secondHash = service.exportChart(10L, "F001").getExportHash();

        assertThat(firstHash).matches("[0-9a-f]{64}");
        assertThat(secondHash).isEqualTo(firstHash);
    }

    @Test
    void exportChartIncludesSanitizedWorkerSnapshotReferencesInHashMaterial() {
        ChartRevisionModel firstRevision = finalRevision();
        firstRevision.setSnapshotManifestJson("{\"snapshotVersion\":1,\"source\":\"CHART_FINALIZE\","
                + "\"patientSnapshotStatus\":\"SNAPSHOT_REFERENCED\","
                + "\"patientSnapshotReference\":\"orca_patient_cache:101\","
                + "\"patientSnapshotHash\":\"" + "1".repeat(64) + "\","
                + "\"acceptanceSnapshotStatus\":\"SNAPSHOT_REFERENCED\","
                + "\"acceptanceSnapshotReference\":\"orca_acceptance_cache:202\","
                + "\"acceptanceSnapshotHash\":\"" + "2".repeat(64) + "\","
                + "\"insuranceSnapshotStatus\":\"SNAPSHOT_REFERENCED\","
                + "\"insuranceSnapshotReference\":\"encounter_insurance_snapshot:303\","
                + "\"insuranceSnapshotHash\":\"" + "3".repeat(64) + "\","
                + "\"diseaseSnapshotStatus\":\"SNAPSHOT_REFERENCED\","
                + "\"diseaseSnapshotReference\":\"orca_disease_snapshot:404\","
                + "\"diseaseSnapshotHash\":\"" + "4".repeat(64) + "\","
                + "\"prescriptionCandidateSnapshotStatus\":\"SNAPSHOT_REFERENCED\","
                + "\"prescriptionCandidateSnapshotReference\":\"orca_medical_candidate:505\","
                + "\"prescriptionCandidateSnapshotHash\":\"" + "5".repeat(64) + "\","
                + "\"prescriptionOrderId\":606,"
                + "\"prescriptionOrderRevisionId\":707,"
                + "\"prescriptionContentHash\":\"" + "6".repeat(64) + "\","
                + "\"orcaTransmissionSnapshotStatus\":\"SNAPSHOT_REFERENCED\","
                + "\"orcaOperationReference\":\"orca_operation:808\","
                + "\"orcaOperationStatus\":\"ORCA_ACCEPTED\","
                + "\"orcaTransmissionReference\":\"orca_transmission:909\","
                + "\"orcaTransmissionHash\":\"" + "7".repeat(64) + "\","
                + "\"orcaReconciliationStatus\":\"MATCHED\","
                + "\"snapshotCapturedAt\":\"2026-05-11T10:00:00Z\","
                + "\"rawSensitiveFieldsExcluded\":true,"
                + "\"patientName\":\"Do Not Export\","
                + "\"rawOrcaBody\":\"<xml>raw</xml>\","
                + "\"Authorization\":\"Basic secret\"}");
        stubExportQueries(List.of(firstRevision), List.of(finalizedEvent()));

        ChartRevisionExportResponse first = service.exportChart(10L, "F001");

        assertThat(first.getRevisions().get(0).getSnapshotManifest())
                .containsEntry("patientSnapshotReference", "orca_patient_cache:101")
                .containsEntry("acceptanceSnapshotReference", "orca_acceptance_cache:202")
                .containsEntry("insuranceSnapshotReference", "encounter_insurance_snapshot:303")
                .containsEntry("diseaseSnapshotReference", "orca_disease_snapshot:404")
                .containsEntry("prescriptionCandidateSnapshotReference", "orca_medical_candidate:505")
                .containsEntry("prescriptionOrderId", 606L)
                .containsEntry("prescriptionOrderRevisionId", 707L)
                .containsEntry("prescriptionContentHash", "6".repeat(64))
                .containsEntry("orcaOperationReference", "orca_operation:808")
                .containsEntry("orcaOperationStatus", "ORCA_ACCEPTED")
                .containsEntry("orcaTransmissionReference", "orca_transmission:909")
                .containsEntry("orcaTransmissionHash", "7".repeat(64))
                .containsEntry("orcaReconciliationStatus", "MATCHED")
                .containsEntry("rawSensitiveFieldsExcluded", true)
                .doesNotContainKey("patientName")
                .doesNotContainKey("rawOrcaBody")
                .doesNotContainKey("Authorization");

        ChartRevisionModel secondRevision = finalRevision();
        secondRevision.setSnapshotManifestJson("{\"snapshotVersion\":1,\"source\":\"CHART_FINALIZE\","
                + "\"patientSnapshotStatus\":\"SNAPSHOT_REFERENCED\","
                + "\"patientSnapshotReference\":\"orca_patient_cache:101\","
                + "\"patientSnapshotHash\":\"" + "1".repeat(64) + "\","
                + "\"prescriptionCandidateSnapshotStatus\":\"SNAPSHOT_REFERENCED\","
                + "\"prescriptionCandidateSnapshotReference\":\"orca_medical_candidate:999\","
                + "\"prescriptionCandidateSnapshotHash\":\"" + "9".repeat(64) + "\","
                + "\"prescriptionOrderId\":606,"
                + "\"prescriptionOrderRevisionId\":707,"
                + "\"prescriptionContentHash\":\"" + "8".repeat(64) + "\","
                + "\"orcaTransmissionSnapshotStatus\":\"SNAPSHOT_REFERENCED\","
                + "\"orcaOperationReference\":\"orca_operation:808\","
                + "\"orcaOperationStatus\":\"ORCA_ACCEPTED\","
                + "\"orcaTransmissionReference\":\"orca_transmission:909\","
                + "\"orcaTransmissionHash\":\"" + "7".repeat(64) + "\","
                + "\"orcaReconciliationStatus\":\"MATCHED\","
                + "\"rawSensitiveFieldsExcluded\":true}");
        stubExportQueries(List.of(secondRevision), List.of(finalizedEvent()));

        ChartRevisionExportResponse second = service.exportChart(10L, "F001");

        assertThat(second.getExportHash()).matches("[0-9a-f]{64}");
        assertThat(second.getExportHash()).isNotEqualTo(first.getExportHash());
    }

    @Test
    void exportChartCsvIncludesHistoryAndNeutralizesSpreadsheetFormulaInjection() {
        ChartRevisionEventModel event = amendedEvent();
        event.setReasonText("=HYPERLINK(\"https://example.test\",\"Authorization: Basic secret\")");
        stubExportQueries(List.of(finalRevision()), List.of(event));

        String csv = service.exportChartCsv(10L, "F001");

        assertThat(csv).contains("\"recordType\",\"chartId\",\"currentRevisionId\"");
        assertThat(csv).contains("\"revision\",\"10\",\"20\",\"20\",\"1\",\"FINAL\"");
        assertThat(csv).contains("snapshot.patientSnapshotStatus=IDENTIFIER_ONLY");
        assertThat(csv).contains("\"event\",\"10\",\"20\",\"20\",,,\"31\",\"AMENDED\"");
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

    @Test
    void exportChartRejectsMissingCurrentRevisionInExportList() {
        stubExportQueries(chartDocument(99L), List.of(finalRevision()), List.of(finalizedEvent()));

        Throwable thrown = catchThrowable(() -> service.exportChart(10L, "F001"));

        assertThat(thrown).isInstanceOf(WebApplicationException.class);
        assertThat(((WebApplicationException) thrown).getResponse().getStatus()).isEqualTo(409);
    }

    private ChartDocumentModel chartDocument() {
        return chartDocument(21L);
    }

    private ChartDocumentModel chartDocument(Long currentRevisionId) {
        ChartDocumentModel document = new ChartDocumentModel();
        document.setId(10L);
        document.setFacilityId("F001");
        document.setCurrentRevisionId(currentRevisionId);
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
        Long currentRevisionId = revisions.isEmpty() ? null : revisions.get(revisions.size() - 1).getId();
        stubExportQueries(chartDocument(currentRevisionId), revisions, events);
    }

    private void stubExportQueries(ChartDocumentModel document, List<ChartRevisionModel> revisions,
            List<ChartRevisionEventModel> events) {
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(document);
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
