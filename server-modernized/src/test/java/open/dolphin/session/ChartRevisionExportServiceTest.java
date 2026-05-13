package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import open.dolphin.infomodel.ChartDocumentModel;
import open.dolphin.infomodel.ChartRevisionEventModel;
import open.dolphin.infomodel.ChartRevisionEventType;
import open.dolphin.infomodel.ChartRevisionModel;
import open.dolphin.infomodel.ChartRevisionStatus;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.reporting.ReportingResult;
import open.dolphin.reporting.api.ReportingPayload;
import open.dolphin.rest.dto.chart.ChartRevisionExportResponse;
import open.dolphin.rest.dto.chart.ChartRevisionPeriodExportResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ChartRevisionExportServiceTest {

    private ChartRevisionExportService service;
    private EntityManager em;

    @BeforeEach
    void setUp() throws Exception {
        System.setProperty("open.dolphin.templates.dir", reportingTemplateRoot().toString());
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
        assertThat(response.getPrescriptionEvents()).isEmpty();
        assertThat(response.getOrcaEvents()).isEmpty();
        assertThat(response.getRevisions().get(1).getStatus()).isEqualTo("AMENDED");
        assertThat(response.getRevisions().get(0).getSnapshotManifest())
                .containsEntry("snapshotVersion", 1L)
                .containsEntry("patientSnapshotStatus", "SNAPSHOT_RECORDED")
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
                + "\"patientSnapshotStatus\":\"SNAPSHOT_RECORDED\","
                + "\"patientName\":\"Do Not Export\"}");
        ChartRevisionEventModel firstEvent = amendedEvent();
        firstEvent.setReasonText("Authorization: Basic first-secret\n<?xml version=\"1.0\"?><xml>raw</xml>");
        stubExportQueries(List.of(firstRevision), List.of(firstEvent));
        String firstHash = service.exportChart(10L, "F001").getExportHash();

        ChartRevisionModel secondRevision = finalRevision();
        secondRevision.setSnapshotManifestJson("{\"patientName\":\"Different Excluded Name\","
                + "\"patientSnapshotStatus\":\"SNAPSHOT_RECORDED\","
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
                + "\"patientSnapshotStatus\":\"SNAPSHOT_RECORDED\","
                + "\"patientSnapshotReference\":\"orca_patient_cache:101\","
                + "\"patientSnapshotHash\":\"" + "1".repeat(64) + "\","
                + "\"acceptanceSnapshotStatus\":\"SNAPSHOT_RECORDED\","
                + "\"acceptanceSnapshotReference\":\"orca_acceptance_cache:202\","
                + "\"acceptanceSnapshotHash\":\"" + "2".repeat(64) + "\","
                + "\"insuranceSnapshotStatus\":\"SNAPSHOT_RECORDED\","
                + "\"insuranceSnapshotReference\":\"encounter_insurance_snapshot:303\","
                + "\"insuranceSnapshotHash\":\"" + "3".repeat(64) + "\","
                + "\"diseaseSnapshotStatus\":\"SNAPSHOT_RECORDED\","
                + "\"diseaseSnapshotReference\":\"orca_disease_snapshot:404\","
                + "\"diseaseSnapshotHash\":\"" + "4".repeat(64) + "\","
                + "\"prescriptionCandidateSnapshotStatus\":\"SNAPSHOT_RECORDED\","
                + "\"prescriptionCandidateSnapshotReference\":\"orca_medical_candidate:505\","
                + "\"prescriptionCandidateSnapshotHash\":\"" + "5".repeat(64) + "\","
                + "\"prescriptionOrderId\":606,"
                + "\"prescriptionOrderRevisionId\":707,"
                + "\"prescriptionContentHash\":\"" + "6".repeat(64) + "\","
                + "\"orcaTransmissionSnapshotStatus\":\"SNAPSHOT_RECORDED\","
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
                + "\"patientSnapshotStatus\":\"SNAPSHOT_RECORDED\","
                + "\"patientSnapshotReference\":\"orca_patient_cache:101\","
                + "\"patientSnapshotHash\":\"" + "1".repeat(64) + "\","
                + "\"prescriptionCandidateSnapshotStatus\":\"SNAPSHOT_RECORDED\","
                + "\"prescriptionCandidateSnapshotReference\":\"orca_medical_candidate:999\","
                + "\"prescriptionCandidateSnapshotHash\":\"" + "9".repeat(64) + "\","
                + "\"prescriptionOrderId\":606,"
                + "\"prescriptionOrderRevisionId\":707,"
                + "\"prescriptionContentHash\":\"" + "8".repeat(64) + "\","
                + "\"orcaTransmissionSnapshotStatus\":\"SNAPSHOT_RECORDED\","
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
    void exportChartIncludesPrescriptionHistoryAndSanitizesUnsafePayloads() {
        stubExportQueries(List.of(finalRevision()), List.of(finalizedEvent()), List.<Object[]>of(prescriptionEventRow(
                401L,
                "CHANGE",
                "Authorization: Basic secret\n<?xml version=\"1.0\"?><xml>raw</xml>",
                "{\"status\":\"FINAL\",\"patientName\":\"Do Not Export\",\"rawOrcaBody\":\"<xml>raw</xml>\"}",
                "{\"eventType\":\"CHANGE\",\"contentHash\":\"" + "8".repeat(64)
                        + "\",\"rawSensitiveFieldsExcluded\":true,\"insuranceDetail\":\"secret\"}",
                "9".repeat(64))));

        ChartRevisionExportResponse response = service.exportChart(10L, "F001");

        assertThat(response.getPrescriptionEvents()).hasSize(1);
        assertThat(response.getPrescriptionEvents().get(0).getPrescriptionOrderId()).isEqualTo(301L);
        assertThat(response.getPrescriptionEvents().get(0).getPrescriptionRevisionId()).isEqualTo(401L);
        assertThat(response.getPrescriptionEvents().get(0).getChartRevisionId()).isEqualTo("20");
        assertThat(response.getPrescriptionEvents().get(0).getEventType()).isEqualTo("CHANGE");
        assertThat(response.getPrescriptionEvents().get(0).getReasonText())
                .contains("Authorization: [redacted]")
                .contains("[redacted-xml-body]")
                .doesNotContain("Basic secret")
                .doesNotContain("<xml>");
        assertThat(response.getPrescriptionEvents().get(0).getBeforeSummary())
                .containsEntry("status", "FINAL")
                .doesNotContainKey("patientName")
                .doesNotContainKey("rawOrcaBody");
        assertThat(response.getPrescriptionEvents().get(0).getAfterSummary())
                .containsEntry("contentHash", "8".repeat(64))
                .containsEntry("rawSensitiveFieldsExcluded", true)
                .doesNotContainKey("insuranceDetail");

        stubExportQueries(List.of(finalRevision()), List.of(finalizedEvent()), List.<Object[]>of(prescriptionEventRow(
                402L,
                "STOP",
                "clinically different reason",
                "{\"status\":\"FINAL\"}",
                "{\"eventType\":\"STOP\",\"contentHash\":\"" + "7".repeat(64) + "\"}",
                "a".repeat(64))));

        ChartRevisionExportResponse changed = service.exportChart(10L, "F001");

        assertThat(changed.getExportHash()).matches("[0-9a-f]{64}");
        assertThat(changed.getExportHash()).isNotEqualTo(response.getExportHash());
    }

    @Test
    void exportChartCsvIncludesPrescriptionHistoryRows() {
        stubExportQueries(List.of(finalRevision()), List.of(finalizedEvent()), List.<Object[]>of(prescriptionEventRow(
                401L,
                "CANCEL",
                "=HYPERLINK(\"https://example.test\",\"Authorization: Basic secret\")",
                "{\"status\":\"FINAL\"}",
                "{\"eventType\":\"CANCEL\",\"contentHash\":\"" + "8".repeat(64) + "\"}",
                "9".repeat(64))));

        String csv = service.exportChartCsv(10L, "F001");

        assertThat(csv).contains("\"prescriptionEvent\",\"10\",\"20\",\"20\",\"2\",\"CHANGED\",\"401\",\"CANCEL\"");
        assertThat(csv).contains("\"'=HYPERLINK(\"\"https://example.test\"\",\"\"Authorization: [redacted]");
        assertThat(csv).contains("after.contentHash=" + "8".repeat(64));
        assertThat(csv).doesNotContain("Basic secret");
    }

    @Test
    void exportChartIncludesOrcaHistoryAndSanitizesUnsafePayloads() {
        stubExportQueries(
                List.of(finalRevision()),
                List.of(finalizedEvent()),
                List.of(),
                List.<Object[]>of(orcaEventRow(
                        "ORCA_ACCEPTED",
                        "HTTP_OK",
                        "{\"operationStatus\":\"ORCA_ACCEPTED\",\"rawOrcaBody\":\"<xml>raw</xml>\","
                                + "\"Authorization\":\"Basic secret\",\"needsUserReview\":false}",
                        "{\"apiResult\":\"00\",\"apiResultMessageCategory\":\"INFO\","
                                + "\"rawResponse\":\"<?xml version=\\\"1.0\\\"?><xml>raw</xml>\","
                                + "\"rawSensitiveFieldsExcluded\":true}",
                        "8".repeat(64))));

        ChartRevisionExportResponse response = service.exportChart(10L, "F001");

        assertThat(response.getOrcaEvents()).hasSize(1);
        assertThat(response.getOrcaEvents().get(0).getOrcaOperationId()).isEqualTo(801L);
        assertThat(response.getOrcaEvents().get(0).getChartRevisionId()).isEqualTo("20");
        assertThat(response.getOrcaEvents().get(0).getOperationScope()).isEqualTo("MEDICAL");
        assertThat(response.getOrcaEvents().get(0).getOperationType()).isEqualTo("TEMPORARY_MEDICAL_CREATE");
        assertThat(response.getOrcaEvents().get(0).getRequestHash()).isEqualTo("7".repeat(64));
        assertThat(response.getOrcaEvents().get(0).getResponseHash()).isEqualTo("8".repeat(64));
        assertThat(response.getOrcaEvents().get(0).getLatestTransmissionId()).isEqualTo(901L);
        assertThat(response.getOrcaEvents().get(0).getTransportStatus()).isEqualTo("HTTP_OK");
        assertThat(response.getOrcaEvents().get(0).getReconciliationStatus()).isEqualTo("MATCHED");
        assertThat(response.getOrcaEvents().get(0).getOperationSummary())
                .containsEntry("operationStatus", "ORCA_ACCEPTED")
                .containsEntry("needsUserReview", false)
                .doesNotContainKey("rawOrcaBody")
                .doesNotContainKey("Authorization");
        assertThat(response.getOrcaEvents().get(0).getTransmissionSummary())
                .containsEntry("apiResult", "00")
                .containsEntry("rawSensitiveFieldsExcluded", true)
                .doesNotContainKey("rawResponse");

        stubExportQueries(
                List.of(finalRevision()),
                List.of(finalizedEvent()),
                List.of(),
                List.<Object[]>of(orcaEventRow(
                        "ORCA_WARNING",
                        "HTTP_OK",
                        "{\"operationStatus\":\"ORCA_WARNING\",\"needsUserReview\":true}",
                        "{\"apiResult\":\"K1\",\"apiResultMessageCategory\":\"WARN\"}",
                        "9".repeat(64))));

        ChartRevisionExportResponse changed = service.exportChart(10L, "F001");

        assertThat(changed.getExportHash()).matches("[0-9a-f]{64}");
        assertThat(changed.getExportHash()).isNotEqualTo(response.getExportHash());
    }

    @Test
    void exportChartCsvIncludesOrcaHistoryRowsAndNeutralizesSpreadsheetFormulaInjection() {
        stubExportQueries(
                List.of(finalRevision()),
                List.of(finalizedEvent()),
                List.of(),
                List.<Object[]>of(orcaEventRow(
                        "=ORCA_ACCEPTED",
                        "+HTTP_OK",
                        "{\"operationStatus\":\"=ORCA_ACCEPTED\",\"rawOrcaBody\":\"<xml>raw</xml>\"}",
                        "{\"apiResult\":\"00\",\"rawSensitiveFieldsExcluded\":true}",
                        "8".repeat(64))));

        String csv = service.exportChartCsv(10L, "F001");

        assertThat(csv).contains("\"orcaEvent\",\"10\",\"20\",\"20\",,\"'=ORCA_ACCEPTED\",\"801\"");
        assertThat(csv).contains("\"TEMPORARY_MEDICAL_CREATE\",,\"901\",\"doctor01\"");
        assertThat(csv).contains("\"MATCHED\",\"'+HTTP_OK\"");
        assertThat(csv).contains("transmission.rawSensitiveFieldsExcluded=true");
        assertThat(csv).doesNotContain("rawOrcaBody");
        assertThat(csv).doesNotContain("<xml>");
    }

    @Test
    void exportChartReportingPayloadUsesServerDerivedPatientAndHistoryProjection() {
        stubExportQueries(
                List.of(finalRevision()),
                List.of(amendedEvent()),
                List.<Object[]>of(prescriptionEventRow(
                        401L,
                        "CHANGE",
                        "Authorization: Basic secret\n<?xml version=\"1.0\"?><xml>raw</xml>",
                        "{\"status\":\"FINAL\",\"patientName\":\"Do Not Export\"}",
                        "{\"eventType\":\"CHANGE\",\"contentHash\":\"" + "8".repeat(64)
                                + "\",\"rawSensitiveFieldsExcluded\":true}",
                        "9".repeat(64))),
                List.<Object[]>of(orcaEventRow(
                        "ORCA_ACCEPTED",
                        "HTTP_OK",
                        "{\"operationStatus\":\"ORCA_ACCEPTED\",\"rawOrcaBody\":\"<xml>raw</xml>\"}",
                        "{\"apiResult\":\"00\",\"rawSensitiveFieldsExcluded\":true}",
                        "8".repeat(64))));
        when(em.find(PatientModel.class, 501L)).thenReturn(patient("F001"));

        ReportingPayload payload = service.exportChartReportingPayload(10L, "F001");

        assertThat(payload.getOutputFileName()).isEqualTo("chart-revisions-10.pdf");
        assertThat(payload.getPatient().getFullName()).isEqualTo("Test Patient");
        assertThat(payload.getPatient().getBirthDate()).isEqualTo("1980-04-12");
        assertThat(payload.getDocumentTitle()).isEqualTo("Progress note");
        assertThat(payload.getEncounterDate()).isEqualTo("2026-05-10");
        assertThat(payload.getAttendingDoctor()).isEqualTo("10001");
        assertThat(payload.getChartRevisionEvents()).hasSize(1);
        assertThat(payload.getPrescriptionEvents()).hasSize(1);
        assertThat(payload.getOrcaEvents()).hasSize(1);
        assertThat(payload.getPrescriptionEvents().get(0).getReasonText())
                .contains("Authorization: [redacted]")
                .contains("[redacted-xml-body]")
                .doesNotContain("Basic secret")
                .doesNotContain("<xml>");
        assertThat(payload.getPrescriptionEvents().get(0).getBeforeSummary()).doesNotContainKey("patientName");
        assertThat(payload.getOrcaEvents().get(0).getOperationSummary()).doesNotContainKey("rawOrcaBody");
        assertThat(payload.getSummaryItems())
                .anySatisfy(item -> {
                    assertThat(item.getLabel()).isEqualTo("Export hash");
                    assertThat(item.getValue()).matches("[0-9a-f]{64}");
                })
                .anySatisfy(item -> {
                    assertThat(item.getLabel()).isEqualTo("Prescription event count");
                    assertThat(item.getValue()).isEqualTo("1");
                })
                .anySatisfy(item -> {
                    assertThat(item.getLabel()).isEqualTo("ORCA event count");
                    assertThat(item.getValue()).isEqualTo("1");
                });
    }

    @Test
    void exportChartPdfRendersServerDerivedPayload() {
        stubExportQueries(List.of(finalRevision()), List.of(finalizedEvent()));
        when(em.find(PatientModel.class, 501L)).thenReturn(patient("F001"));

        ReportingResult pdf = service.exportChartPdf(10L, "F001");

        assertThat(pdf.getFileName()).isEqualTo("chart-revisions-10.pdf");
        assertThat(new String(pdf.getData(), 0, 4)).isEqualTo("%PDF");
    }

    @Test
    void exportChartPeriodUsesServerDerivedChartExportsAndHash() {
        stubPeriodChartIds(List.of(10L));
        stubExportQueries(List.of(finalRevision()), List.of(finalizedEvent()));

        ChartRevisionPeriodExportResponse response =
                service.exportChartPeriod("F001", "2026-05-01", "2026-05-31", 501L);

        assertThat(response.getFromDate()).isEqualTo("2026-05-01");
        assertThat(response.getToDate()).isEqualTo("2026-05-31");
        assertThat(response.getPatientFilterApplied()).isTrue();
        assertThat(response.getExportSchemaVersion()).isEqualTo(1);
        assertThat(response.getExportHashAlgorithm()).isEqualTo("SHA-256");
        assertThat(response.getExportHash()).matches("[0-9a-f]{64}");
        assertThat(response.getChartCount()).isEqualTo(1);
        assertThat(response.getCharts()).hasSize(1);
        assertThat(response.getCharts().get(0).getChartId()).isEqualTo(10L);
        assertThat(response.getCharts().get(0).getExportHash()).matches("[0-9a-f]{64}");
    }

    @Test
    void exportChartPeriodCsvAggregatesSanitizedRows() {
        ChartRevisionEventModel event = amendedEvent();
        event.setReasonText("=HYPERLINK(\"https://example.test\",\"Authorization: Basic secret\")");
        stubPeriodChartIds(List.of(10L));
        stubExportQueries(List.of(finalRevision()), List.of(event));

        String csv = service.exportChartPeriodCsv("F001", "2026-05-01", "2026-05-31", null);

        assertThat(csv).contains("\"recordType\",\"chartId\",\"currentRevisionId\"");
        assertThat(csv).contains("\"revision\",\"10\",\"20\",\"20\",\"1\",\"FINAL\"");
        assertThat(csv).contains("\"event\",\"10\",\"20\",\"20\",,,\"31\",\"AMENDED\"");
        assertThat(csv).contains("\"'=HYPERLINK(\"\"https://example.test\"\",\"\"Authorization: [redacted]");
        assertThat(csv).doesNotContain("Basic secret");
    }

    @Test
    void exportChartPeriodPdfRendersCoverAndServerDerivedChartPayloads() {
        stubPeriodChartIds(List.of(10L));
        stubExportQueries(List.of(finalRevision()), List.of(finalizedEvent()));
        when(em.find(PatientModel.class, 501L)).thenReturn(patient("F001"));

        ReportingResult pdf = service.exportChartPeriodPdf("F001", "2026-05-01", "2026-05-31", null);

        assertThat(pdf.getFileName()).isEqualTo("chart-revisions-2026-05-01-2026-05-31.pdf");
        assertThat(new String(pdf.getData(), 0, 4)).isEqualTo("%PDF");
        assertThat(pdf.getData().length).isGreaterThan(1000);
    }

    @Test
    void exportChartPeriodRejectsInvalidDateRange() {
        Throwable thrown = catchThrowable(() -> service.exportChartPeriod("F001", "2026-06-01", "2026-05-01", null));

        assertThat(thrown).isInstanceOf(WebApplicationException.class);
        assertThat(((WebApplicationException) thrown).getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void exportChartCsvIncludesHistoryAndNeutralizesSpreadsheetFormulaInjection() {
        ChartRevisionEventModel event = amendedEvent();
        event.setReasonText("=HYPERLINK(\"https://example.test\",\"Authorization: Basic secret\")");
        stubExportQueries(List.of(finalRevision()), List.of(event));

        String csv = service.exportChartCsv(10L, "F001");

        assertThat(csv).contains("\"recordType\",\"chartId\",\"currentRevisionId\"");
        assertThat(csv).contains("\"revision\",\"10\",\"20\",\"20\",\"1\",\"FINAL\"");
        assertThat(csv).contains("snapshot.patientSnapshotStatus=SNAPSHOT_RECORDED");
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

    @Test
    void exportChartReportingPayloadRejectsCrossFacilityPatientReference() {
        stubExportQueries(List.of(finalRevision()), List.of(finalizedEvent()));
        when(em.find(PatientModel.class, 501L)).thenReturn(patient("F999"));

        Throwable thrown = catchThrowable(() -> service.exportChartReportingPayload(10L, "F001"));

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
        document.setKarteId(601L);
        document.setPatientId(501L);
        document.setCurrentRevisionId(currentRevisionId);
        return document;
    }

    private PatientModel patient(String facilityId) {
        PatientModel patient = new PatientModel();
        patient.setId(501L);
        patient.setFacilityId(facilityId);
        patient.setPatientId("P-501");
        patient.setFullName("Test Patient");
        patient.setBirthday(LocalDate.parse("1980-04-12"));
        return patient;
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
                + "\"patientSnapshotStatus\":\"SNAPSHOT_RECORDED\","
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
        stubExportQueries(document, revisions, events, List.of());
    }

    private void stubExportQueries(List<ChartRevisionModel> revisions, List<ChartRevisionEventModel> events,
            List<Object[]> prescriptionEvents) {
        Long currentRevisionId = revisions.isEmpty() ? null : revisions.get(revisions.size() - 1).getId();
        stubExportQueries(chartDocument(currentRevisionId), revisions, events, prescriptionEvents);
    }

    private void stubExportQueries(ChartDocumentModel document, List<ChartRevisionModel> revisions,
            List<ChartRevisionEventModel> events, List<Object[]> prescriptionEvents) {
        stubExportQueries(document, revisions, events, prescriptionEvents, List.of());
    }

    private void stubExportQueries(List<ChartRevisionModel> revisions, List<ChartRevisionEventModel> events,
            List<Object[]> prescriptionEvents, List<Object[]> orcaEvents) {
        Long currentRevisionId = revisions.isEmpty() ? null : revisions.get(revisions.size() - 1).getId();
        stubExportQueries(chartDocument(currentRevisionId), revisions, events, prescriptionEvents, orcaEvents);
    }

    private void stubExportQueries(ChartDocumentModel document, List<ChartRevisionModel> revisions,
            List<ChartRevisionEventModel> events, List<Object[]> prescriptionEvents, List<Object[]> orcaEvents) {
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(document);
        TypedQuery<ChartRevisionModel> revisionQuery = mock(TypedQuery.class);
        TypedQuery<ChartRevisionEventModel> eventQuery = mock(TypedQuery.class);
        Query prescriptionQuery = mock(Query.class);
        Query orcaQuery = mock(Query.class);
        when(em.createQuery(startsWith("select r from ChartRevisionModel"), eq(ChartRevisionModel.class)))
                .thenReturn(revisionQuery);
        when(em.createQuery(startsWith("select e from ChartRevisionEventModel"), eq(ChartRevisionEventModel.class)))
                .thenReturn(eventQuery);
        when(em.createNativeQuery(startsWith("SELECT po.prescription_order_id"))).thenReturn(prescriptionQuery);
        when(em.createNativeQuery(startsWith("SELECT oo.orca_operation_id"))).thenReturn(orcaQuery);
        when(revisionQuery.setParameter("chartId", 10L)).thenReturn(revisionQuery);
        when(eventQuery.setParameter("chartId", 10L)).thenReturn(eventQuery);
        when(prescriptionQuery.setParameter(eq("facilityId"), eq("F001"))).thenReturn(prescriptionQuery);
        when(prescriptionQuery.setParameter(eq("chartRevisionIds"), org.mockito.ArgumentMatchers.any()))
                .thenReturn(prescriptionQuery);
        when(orcaQuery.setParameter(eq("facilityId"), eq("F001"))).thenReturn(orcaQuery);
        when(orcaQuery.setParameter(eq("chartRevisionIds"), org.mockito.ArgumentMatchers.any())).thenReturn(orcaQuery);
        when(revisionQuery.getResultList()).thenReturn(revisions);
        when(eventQuery.getResultList()).thenReturn(events);
        when(prescriptionQuery.getResultList()).thenReturn(prescriptionEvents);
        when(orcaQuery.getResultList()).thenReturn(orcaEvents);
    }

    private void stubPeriodChartIds(List<Object> chartIds) {
        Query periodQuery = mock(Query.class);
        when(em.createNativeQuery(startsWith("SELECT DISTINCT cd.id"))).thenReturn(periodQuery);
        when(periodQuery.setParameter(eq("facilityId"), eq("F001"))).thenReturn(periodQuery);
        when(periodQuery.setParameter(eq("fromDate"), any(LocalDate.class))).thenReturn(periodQuery);
        when(periodQuery.setParameter(eq("toDate"), any(LocalDate.class))).thenReturn(periodQuery);
        when(periodQuery.setParameter(eq("patientId"), eq(501L))).thenReturn(periodQuery);
        when(periodQuery.getResultList()).thenReturn(chartIds);
    }

    private Object[] prescriptionEventRow(Long prescriptionRevisionId, String eventType, String reasonText,
            String beforeSummaryJson, String afterSummaryJson, String eventHash) {
        return new Object[]{
                301L,
                prescriptionRevisionId,
                "20",
                2,
                "CHANGED",
                "8".repeat(64),
                401L,
                eventType,
                "doctor01",
                Timestamp.from(Instant.parse("2026-05-11T11:00:00Z")),
                "RX_REASON",
                reasonText,
                beforeSummaryJson,
                afterSummaryJson,
                eventHash
        };
    }

    private Object[] orcaEventRow(String operationStatus, String transportStatus, String operationSummaryJson,
            String transmissionSummaryJson, String responseHash) {
        return new Object[]{
                801L,
                "20",
                "MEDICAL",
                "TEMPORARY_MEDICAL_CREATE",
                "api21/medicalmod",
                operationStatus,
                "doctor01",
                Timestamp.from(Instant.parse("2026-05-11T11:10:00Z")),
                Timestamp.from(Instant.parse("2026-05-11T11:12:00Z")),
                "7".repeat(64),
                responseHash,
                1,
                false,
                901L,
                operationStatus,
                transportStatus,
                2,
                Timestamp.from(Instant.parse("2026-05-11T11:11:00Z")),
                Timestamp.from(Instant.parse("2026-05-11T11:12:00Z")),
                "7".repeat(64),
                responseHash,
                "MATCHED",
                operationSummaryJson,
                transmissionSummaryJson
        };
    }

    private void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }

    private Path reportingTemplateRoot() {
        Path rootRelative = Paths.get("server-modernized", "reporting", "templates").toAbsolutePath();
        if (Files.isDirectory(rootRelative)) {
            return rootRelative;
        }
        return Paths.get("reporting", "templates").toAbsolutePath();
    }
}
