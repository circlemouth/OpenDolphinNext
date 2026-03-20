package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OperationsHealthResourceTest {

    private EntityManager em;

    private Query query;

    private StubRestOrcaTransport restOrcaTransport;

    private AttachmentStorageManager attachmentStorageManager;

    private PvtService pvtService;

    private OperationsHealthResource resource;

    @BeforeEach
    void setUp() throws Exception {
        em = org.mockito.Mockito.mock(EntityManager.class);
        query = org.mockito.Mockito.mock(Query.class);
        attachmentStorageManager = org.mockito.Mockito.mock(AttachmentStorageManager.class);
        pvtService = org.mockito.Mockito.mock(PvtService.class);
        restOrcaTransport = new StubRestOrcaTransport();
        resource = new OperationsHealthResource();
        setField("em", em);
        setField("restOrcaTransport", restOrcaTransport);
        setField("attachmentStorageManager", attachmentStorageManager);
        setField("pvtService", pvtService);
    }

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
        restOrcaTransport.probeResult =
                new RestOrcaTransport.ProbeResult(true, 401, "https://trial.orca.local/", "orca.host=trial.orca.local,orca.port=443", null, null);
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
        restOrcaTransport.probeResult =
                new RestOrcaTransport.ProbeResult(false, null, null, RestOrcaTransport.UNKNOWN_AUDIT_SUMMARY, "SocketTimeoutException", "timed out");
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.DATABASE);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "DEGRADED",
                "reasons", List.of("poison_queue_non_empty")));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(503);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getStatus()).isEqualTo("DOWN");
    }

    private void setField(String fieldName, Object value) throws Exception {
        Field field = OperationsHealthResource.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(resource, value);
    }

    private static final class StubRestOrcaTransport extends RestOrcaTransport {
        private RestOrcaTransport.ProbeResult probeResult =
                RestOrcaTransport.unavailableProbe("transport_unavailable", "probe not configured");

        @Override
        public RestOrcaTransport.ProbeResult probeReadiness() {
            return probeResult;
        }
    }
}
