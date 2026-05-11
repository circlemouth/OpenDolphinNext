package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import open.dolphin.infomodel.ChartDocumentModel;
import open.dolphin.infomodel.ChartRevisionEntryMode;
import open.dolphin.infomodel.ChartRevisionEventModel;
import open.dolphin.infomodel.ChartRevisionEventType;
import open.dolphin.infomodel.ChartRevisionModel;
import open.dolphin.infomodel.ChartRevisionStatus;
import open.dolphin.rest.dto.chart.ChartRevisionFinalizeRequest;
import open.dolphin.rest.dto.chart.ChartRevisionFinalizeResponse;
import open.dolphin.rest.dto.chart.ChartRevisionChangeRequest;
import open.dolphin.rest.dto.chart.ChartRevisionChangeResponse;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.AuditTrailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ChartRevisionFinalizeServiceTest {

    private ChartRevisionFinalizeService service;
    private EntityManager em;
    private AuditTrailService auditTrailService;

    @BeforeEach
    void setUp() throws Exception {
        service = new ChartRevisionFinalizeService();
        em = mock(EntityManager.class);
        auditTrailService = mock(AuditTrailService.class);
        setField(service, "em", em);
        setField(service, "auditTrailService", auditTrailService);
    }

    @Test
    void finalizeRevisionRequiresContextAndRecordsServerContentHash() {
        ChartDocumentModel document = chartDocument();
        ChartRevisionModel revision = draftRevision();
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(document);
        when(em.find(ChartRevisionModel.class, 20L)).thenReturn(revision);

        ChartRevisionFinalizeResponse response = service.finalizeRevision(10L, 20L, "F001", validRequest());

        assertThat(response.getStatus()).isEqualTo("FINAL");
        assertThat(response.getContentHash()).matches("[0-9a-f]{64}");
        assertThat(revision.getStatus()).isEqualTo(ChartRevisionStatus.FINAL);
        assertThat(revision.getContentHash()).isEqualTo(response.getContentHash());
        assertThat(revision.getFinalizedByUserId()).isEqualTo(101L);
        assertThat(revision.getOrcaPatientId()).isEqualTo("00001");
        assertThat(revision.getEncounterId()).isEqualTo("ENC-001");
        assertThat(revision.getDepartmentCode()).isEqualTo("01");
        assertThat(revision.getPhysicianCode()).isEqualTo("10001");
        assertThat(revision.getInsuranceCombinationNumber()).isEqualTo("0001");
        assertThat(revision.getEntryMode()).isEqualTo(ChartRevisionEntryMode.DIRECT);
        assertThat(revision.getDelegatedByUserId()).isNull();
        assertThat(revision.getFinalizeContextJson()).contains("\"orcaPatientId\":\"00001\"");
        assertThat(revision.getFinalizeContextJson()).contains("\"enteredByUserId\":101");
        assertThat(revision.getFinalizeContextJson()).contains("\"entryMode\":\"DIRECT\"");
        assertThat(revision.getFinalizeContextJson()).doesNotContain("Sanitized Patient");
        assertThat(revision.getSnapshotManifestJson()).contains("\"snapshotVersion\":1");
        assertThat(revision.getSnapshotManifestJson()).contains("\"patientSnapshotStatus\":\"IDENTIFIER_ONLY\"");
        assertThat(revision.getSnapshotManifestJson()).contains("\"prescriptionCandidateSnapshotStatus\":\"PENDING_WORKER_INTEGRATION\"");
        assertThat(revision.getSnapshotManifestJson()).doesNotContain("Sanitized Patient");
        assertThat(document.getCurrentRevisionId()).isEqualTo(20L);

        ArgumentCaptor<ChartRevisionEventModel> eventCaptor = ArgumentCaptor.forClass(ChartRevisionEventModel.class);
        verify(em).persist(eventCaptor.capture());
        ChartRevisionEventModel event = eventCaptor.getValue();
        assertThat(event.getEventType()).isEqualTo(ChartRevisionEventType.FINALIZED);
        assertThat(event.getAfterSummaryJson()).contains(response.getContentHash());
        assertThat(event.getAfterSummaryJson()).contains("\"entryMode\":\"DIRECT\"");
        assertThat(event.getAfterSummaryJson()).contains("\"hasSnapshotManifest\":true");
        assertThat(event.getAfterSummaryJson()).doesNotContain("Sanitized Patient");
        verify(em).flush();
    }

    @Test
    void finalizeRevisionRecordsDelegatedEntryMetadataFromStoredEnteredAndFinalizer() {
        ChartDocumentModel document = chartDocument();
        ChartRevisionModel revision = draftRevision();
        revision.setEnteredByUserId(303L);
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(document);
        when(em.find(ChartRevisionModel.class, 20L)).thenReturn(revision);
        ChartRevisionFinalizeRequest request = validRequest();
        request.setEntryMode("DELEGATED");
        request.setDelegatedByUserId(101L);

        ChartRevisionFinalizeResponse response = service.finalizeRevision(10L, 20L, "F001", request);

        assertThat(response.getStatus()).isEqualTo("FINAL");
        assertThat(revision.getEnteredByUserId()).isEqualTo(303L);
        assertThat(revision.getFinalizedByUserId()).isEqualTo(101L);
        assertThat(revision.getEntryMode()).isEqualTo(ChartRevisionEntryMode.DELEGATED);
        assertThat(revision.getDelegatedByUserId()).isEqualTo(101L);
        assertThat(revision.getFinalizeContextJson()).contains("\"enteredByUserId\":303");
        assertThat(revision.getFinalizeContextJson()).contains("\"entryMode\":\"DELEGATED\"");
        assertThat(revision.getFinalizeContextJson()).contains("\"delegatedByUserId\":101");
        assertThat(revision.getFinalizeContextJson()).contains("\"finalizedByUserId\":101");
    }

    @Test
    void finalizeRevisionRejectsClientClaimedDirectModeWhenEnteredAndFinalizerDiffer() {
        ChartDocumentModel document = chartDocument();
        ChartRevisionModel revision = draftRevision();
        revision.setEnteredByUserId(303L);
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(document);
        when(em.find(ChartRevisionModel.class, 20L)).thenReturn(revision);
        ChartRevisionFinalizeRequest request = validRequest();
        request.setEntryMode("DIRECT");

        Throwable thrown = catchThrowable(() -> service.finalizeRevision(10L, 20L, "F001", request));

        assertThat(thrown).isInstanceOf(WebApplicationException.class);
        assertThat(((WebApplicationException) thrown).getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void finalizeRevisionRejectsClientClaimedDelegatedModeWhenSameUserFinalizes() {
        ChartDocumentModel document = chartDocument();
        ChartRevisionModel revision = draftRevision();
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(document);
        when(em.find(ChartRevisionModel.class, 20L)).thenReturn(revision);
        ChartRevisionFinalizeRequest request = validRequest();
        request.setEntryMode("DELEGATED");
        request.setDelegatedByUserId(101L);

        Throwable thrown = catchThrowable(() -> service.finalizeRevision(10L, 20L, "F001", request));

        assertThat(thrown).isInstanceOf(WebApplicationException.class);
        assertThat(((WebApplicationException) thrown).getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void finalizeRevisionRejectsMissingRequiredPatientContextBeforeLookup() {
        ChartRevisionFinalizeRequest request = validRequest();
        request.setOrcaPatientId(" ");

        Throwable thrown = catchThrowable(() -> service.finalizeRevision(10L, 20L, "F001", request));

        assertThat(thrown).isInstanceOf(WebApplicationException.class);
        assertThat(((WebApplicationException) thrown).getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void finalizeRevisionRejectsNonDraftRevision() {
        ChartDocumentModel document = chartDocument();
        ChartRevisionModel revision = draftRevision();
        revision.setStatus(ChartRevisionStatus.FINAL);
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(document);
        when(em.find(ChartRevisionModel.class, 20L)).thenReturn(revision);

        Throwable thrown = catchThrowable(() -> service.finalizeRevision(10L, 20L, "F001", validRequest()));

        assertThat(thrown).isInstanceOf(WebApplicationException.class);
        assertThat(((WebApplicationException) thrown).getResponse().getStatus()).isEqualTo(409);
    }

    @Test
    void finalizeRevisionRejectsChartRevisionMismatch() {
        ChartDocumentModel document = chartDocument();
        ChartRevisionModel revision = draftRevision();
        revision.setChartDocumentId(99L);
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(document);
        when(em.find(ChartRevisionModel.class, 20L)).thenReturn(revision);

        Throwable thrown = catchThrowable(() -> service.finalizeRevision(10L, 20L, "F001", validRequest()));

        assertThat(thrown).isInstanceOf(WebApplicationException.class);
        assertThat(((WebApplicationException) thrown).getResponse().getStatus()).isEqualTo(404);
    }

    @Test
    void amendRevisionCreatesNewRevisionAndEventWithoutMutatingSource() {
        ChartDocumentModel document = chartDocument();
        ChartRevisionModel source = finalizedRevision();
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(document);
        when(em.find(ChartRevisionModel.class, 20L)).thenReturn(source);
        TypedQuery<Integer> query = mock(TypedQuery.class);
        when(em.createQuery(
                "select max(r.revisionNumber) from ChartRevisionModel r where r.chartDocumentId = :chartId",
                Integer.class)).thenReturn(query);
        when(query.setParameter("chartId", 10L)).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        org.mockito.Mockito.doAnswer(invocation -> {
            Object entity = invocation.getArgument(0);
            if (entity instanceof ChartRevisionModel revision && revision.getId() == null) {
                revision.setId(21L);
            }
            if (entity instanceof ChartRevisionEventModel event && event.getId() == null) {
                event.setId(31L);
            }
            return null;
        }).when(em).persist(org.mockito.Mockito.any());

        ChartRevisionChangeResponse response = service.amendRevision(10L, 20L, "F001", changeRequest());

        assertThat(response.getEventType()).isEqualTo("AMENDED");
        assertThat(response.getStatus()).isEqualTo("AMENDED");
        assertThat(response.getContentHash()).matches("[0-9a-f]{64}");
        assertThat(source.getStatus()).isEqualTo(ChartRevisionStatus.FINAL);

        ArgumentCaptor<Object> persistCaptor = ArgumentCaptor.forClass(Object.class);
        verify(em, org.mockito.Mockito.times(2)).persist(persistCaptor.capture());
        ChartRevisionModel newRevision = persistCaptor.getAllValues().stream()
                .filter(ChartRevisionModel.class::isInstance)
                .map(ChartRevisionModel.class::cast)
                .findFirst()
                .orElseThrow();
        assertThat(newRevision.getStatus()).isEqualTo(ChartRevisionStatus.AMENDED);
        assertThat(newRevision.getRevisionNumber()).isEqualTo(2);
        assertThat(newRevision.getTitle()).isEqualTo("Amended title");
        assertThat(newRevision.getEnteredByUserId()).isEqualTo(source.getEnteredByUserId());
        assertThat(newRevision.getEntryMode()).isEqualTo(source.getEntryMode());
        assertThat(newRevision.getDelegatedByUserId()).isEqualTo(source.getDelegatedByUserId());
        assertThat(newRevision.getSnapshotManifestJson()).isEqualTo(source.getSnapshotManifestJson());
        assertThat(newRevision.getFinalizedByUserId()).isEqualTo(202L);

        ChartRevisionEventModel event = persistCaptor.getAllValues().stream()
                .filter(ChartRevisionEventModel.class::isInstance)
                .map(ChartRevisionEventModel.class::cast)
                .findFirst()
                .orElseThrow();
        assertThat(event.getEventType()).isEqualTo(ChartRevisionEventType.AMENDED);
        assertThat(event.getReasonText()).isEqualTo("Clinically necessary correction");
        assertThat(event.getBeforeSummaryJson()).contains("\"status\":\"FINAL\"");
        assertThat(event.getAfterSummaryJson()).doesNotContain("Sanitized Patient");

        ArgumentCaptor<AuditEventPayload> auditCaptor = ArgumentCaptor.forClass(AuditEventPayload.class);
        verify(auditTrailService).record(auditCaptor.capture());
        AuditEventPayload audit = auditCaptor.getValue();
        assertThat(audit.getAction()).isEqualTo("CHART_REVISION_EVENT_RECORDED");
        assertThat(audit.getResource()).isEqualTo("/api/charts/{chartId}/revisions/{revisionId}/amend");
        assertThat(audit.getActorId()).isEqualTo("202");
        assertThat(audit.getDetails())
                .containsEntry("facilityId", "F001")
                .containsEntry("subjectType", "chart_revision")
                .containsEntry("subjectId", "10:20")
                .containsEntry("chartId", 10L)
                .containsEntry("sourceRevisionId", 20L)
                .containsEntry("newRevisionId", 21L)
                .containsEntry("eventId", 31L)
                .containsEntry("eventType", "AMENDED")
                .containsEntry("hasReasonCode", true)
                .containsEntry("outcome", "SUCCESS");
        assertThat(audit.getDetails()).doesNotContainKey("reasonText");
    }

    @Test
    void cancelRevisionRequiresReasonAndRecordsEventWithoutNewRevision() {
        ChartDocumentModel document = chartDocument();
        ChartRevisionModel source = finalizedRevision();
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(document);
        when(em.find(ChartRevisionModel.class, 20L)).thenReturn(source);
        org.mockito.Mockito.doAnswer(invocation -> {
            Object entity = invocation.getArgument(0);
            if (entity instanceof ChartRevisionEventModel event && event.getId() == null) {
                event.setId(32L);
            }
            return null;
        }).when(em).persist(org.mockito.Mockito.any());

        ChartRevisionChangeResponse response = service.cancelRevision(10L, 20L, "F001", cancelRequest());

        assertThat(response.getEventType()).isEqualTo("CANCELLED");
        assertThat(response.getStatus()).isEqualTo("CANCELLED");
        assertThat(response.getNewRevisionId()).isNull();
        assertThat(source.getStatus()).isEqualTo(ChartRevisionStatus.FINAL);

        ArgumentCaptor<ChartRevisionEventModel> eventCaptor = ArgumentCaptor.forClass(ChartRevisionEventModel.class);
        verify(em).persist(eventCaptor.capture());
        assertThat(eventCaptor.getValue().getEventType()).isEqualTo(ChartRevisionEventType.CANCELLED);
        assertThat(eventCaptor.getValue().getReasonText()).isEqualTo("Wrong encounter selected");

        ArgumentCaptor<AuditEventPayload> auditCaptor = ArgumentCaptor.forClass(AuditEventPayload.class);
        verify(auditTrailService).record(auditCaptor.capture());
        assertThat(auditCaptor.getValue().getResource())
                .isEqualTo("/api/charts/{chartId}/revisions/{revisionId}/cancel");
        assertThat(auditCaptor.getValue().getDetails())
                .containsEntry("eventType", "CANCELLED")
                .containsEntry("newRevisionId", null)
                .containsEntry("hasReasonCode", true);
    }

    @Test
    void amendRevisionRejectsMissingReason() {
        ChartRevisionChangeRequest request = changeRequest();
        request.setReasonText(" ");

        Throwable thrown = catchThrowable(() -> service.amendRevision(10L, 20L, "F001", request));

        assertThat(thrown).isInstanceOf(WebApplicationException.class);
        assertThat(((WebApplicationException) thrown).getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void amendRevisionRejectsDraftSource() {
        ChartDocumentModel document = chartDocument();
        ChartRevisionModel source = draftRevision();
        when(em.find(ChartDocumentModel.class, 10L)).thenReturn(document);
        when(em.find(ChartRevisionModel.class, 20L)).thenReturn(source);

        Throwable thrown = catchThrowable(() -> service.amendRevision(10L, 20L, "F001", changeRequest()));

        assertThat(thrown).isInstanceOf(WebApplicationException.class);
        assertThat(((WebApplicationException) thrown).getResponse().getStatus()).isEqualTo(409);
    }

    private ChartDocumentModel chartDocument() {
        ChartDocumentModel document = new ChartDocumentModel();
        document.setId(10L);
        document.setFacilityId("F001");
        return document;
    }

    private ChartRevisionModel draftRevision() {
        ChartRevisionModel revision = new ChartRevisionModel();
        revision.setId(20L);
        revision.setChartDocumentId(10L);
        revision.setRevisionNumber(1);
        revision.setStatus(ChartRevisionStatus.DRAFT);
        revision.setTitle("Progress note");
        revision.setEnteredByUserId(101L);
        return revision;
    }

    private ChartRevisionModel finalizedRevision() {
        ChartRevisionModel revision = draftRevision();
        revision.setStatus(ChartRevisionStatus.FINAL);
        revision.setContentHash("a".repeat(64));
        revision.setEntryMode(ChartRevisionEntryMode.DIRECT);
        revision.setFinalizedByUserId(101L);
        revision.setOrcaPatientId("00001");
        revision.setEncounterId("ENC-001");
        revision.setEncounterDate(java.time.LocalDate.parse("2026-05-10"));
        revision.setOrcaAcceptanceId("ACC-001");
        revision.setDepartmentCode("01");
        revision.setPhysicianCode("10001");
        revision.setInsuranceCombinationNumber("0001");
        revision.setFinalizeContextJson("{\"orcaPatientId\":\"00001\"}");
        revision.setSnapshotManifestJson("{\"snapshotVersion\":1,\"source\":\"CHART_FINALIZE\"}");
        return revision;
    }

    private ChartRevisionFinalizeRequest validRequest() {
        ChartRevisionFinalizeRequest request = new ChartRevisionFinalizeRequest();
        request.setOrcaPatientId("00001");
        request.setPatientName("Sanitized Patient");
        request.setPatientBirthDate("1980-01-01");
        request.setPatientGender("U");
        request.setEncounterId("ENC-001");
        request.setEncounterDate("2026-05-10");
        request.setOrcaAcceptanceId("ACC-001");
        request.setDepartmentCode("01");
        request.setPhysicianCode("10001");
        request.setInsuranceCombinationNumber("0001");
        request.setFinalizedByUserId(101L);
        request.setContentJson("{\"soap\":{\"s\":\"stable subjective\",\"o\":\"stable objective\"}}");
        return request;
    }

    private ChartRevisionChangeRequest changeRequest() {
        ChartRevisionChangeRequest request = new ChartRevisionChangeRequest();
        request.setActorUserId(202L);
        request.setReasonCode("CORRECTION");
        request.setReasonText("Clinically necessary correction");
        request.setTitle("Amended title");
        request.setContentJson("{\"soap\":{\"a\":\"amended assessment\"}}");
        return request;
    }

    private ChartRevisionChangeRequest cancelRequest() {
        ChartRevisionChangeRequest request = new ChartRevisionChangeRequest();
        request.setActorUserId(202L);
        request.setReasonCode("WRONG_ENCOUNTER");
        request.setReasonText("Wrong encounter selected");
        return request;
    }

    private void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
