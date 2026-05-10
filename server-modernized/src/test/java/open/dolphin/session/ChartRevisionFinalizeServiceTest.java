package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import open.dolphin.infomodel.ChartDocumentModel;
import open.dolphin.infomodel.ChartRevisionEventModel;
import open.dolphin.infomodel.ChartRevisionEventType;
import open.dolphin.infomodel.ChartRevisionModel;
import open.dolphin.infomodel.ChartRevisionStatus;
import open.dolphin.rest.dto.chart.ChartRevisionFinalizeRequest;
import open.dolphin.rest.dto.chart.ChartRevisionFinalizeResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ChartRevisionFinalizeServiceTest {

    private ChartRevisionFinalizeService service;
    private EntityManager em;

    @BeforeEach
    void setUp() throws Exception {
        service = new ChartRevisionFinalizeService();
        em = mock(EntityManager.class);
        setField(service, "em", em);
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
        assertThat(revision.getFinalizeContextJson()).contains("\"orcaPatientId\":\"00001\"");
        assertThat(revision.getFinalizeContextJson()).doesNotContain("Sanitized Patient");
        assertThat(document.getCurrentRevisionId()).isEqualTo(20L);

        ArgumentCaptor<ChartRevisionEventModel> eventCaptor = ArgumentCaptor.forClass(ChartRevisionEventModel.class);
        verify(em).persist(eventCaptor.capture());
        ChartRevisionEventModel event = eventCaptor.getValue();
        assertThat(event.getEventType()).isEqualTo(ChartRevisionEventType.FINALIZED);
        assertThat(event.getAfterSummaryJson()).contains(response.getContentHash());
        assertThat(event.getAfterSummaryJson()).doesNotContain("Sanitized Patient");
        verify(em).flush();
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

    private void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
