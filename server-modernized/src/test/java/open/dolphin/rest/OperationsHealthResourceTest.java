package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import open.dolphin.mbean.PvtService;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.rest.dto.OperationsHealthResponse;
import open.dolphin.rest.dto.OperationsReadinessCheck;
import open.dolphin.rest.dto.OperationsReadinessResponse;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.attachment.AttachmentStorageMode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class OperationsHealthResourceTest {

    @Mock
    private EntityManager em;

    @Mock
    private Query query;

    @Mock
    private RestOrcaTransport restOrcaTransport;

    @Mock
    private AttachmentStorageManager attachmentStorageManager;

    @Mock
    private PvtService pvtService;

    @InjectMocks
    private OperationsHealthResource resource;

    @AfterEach
    void tearDown() {
        System.clearProperty("opendolphin.patient.images.enabled");
    }

    @Test
    void healthReturnsUp() {
        Response response = resource.health();

        assertThat(response.getStatus()).isEqualTo(200);
        OperationsHealthResponse body = (OperationsHealthResponse) response.getEntity();
        assertThat(body.getStatus()).isEqualTo("UP");
        assertThat(body.getService()).isEqualTo("server-modernized");
    }

    @Test
    void readinessReturnsOkWhenAllChecksAreUp() {
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        when(restOrcaTransport.auditSummary()).thenReturn("orca.host=trial.orca.local,orca.port=443");
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.DATABASE);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "UP",
                "reasons", List.of()));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(200);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getStatus()).isEqualTo("UP");
        assertThat(body.getChecks().keySet()).containsExactly(
                "database",
                "orca",
                "attachmentStorage",
                "pvtQueue",
                "patientImages");
        OperationsReadinessCheck patientImages = body.getChecks().get("patientImages");
        assertThat(patientImages).isNotNull();
        assertThat(patientImages.getStatus()).isEqualTo("DISABLED");
        assertThat(patientImages.getEnabled()).isFalse();
    }

    @Test
    void readinessReturnsServiceUnavailableWhenCriticalCheckFails() {
        when(em.createNativeQuery(anyString())).thenThrow(new IllegalStateException("db unavailable"));
        when(restOrcaTransport.auditSummary()).thenReturn("orca.host=unknown");
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.DATABASE);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "DEGRADED",
                "reasons", List.of("poison_queue_non_empty")));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(503);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getStatus()).isEqualTo("DOWN");
    }
}
