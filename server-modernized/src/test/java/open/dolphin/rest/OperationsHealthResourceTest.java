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
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.orca.push.OrcaPushClientRegistry;
import open.dolphin.orca.push.OrcaPushStateStore;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import open.dolphin.rest.dto.OperationsHealthResponse;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.attachment.AttachmentStorageMode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OperationsHealthResourceTest {

    private EntityManager em;
    private Query query;
    private StubRestOrcaTransport restOrcaTransport;
    private AttachmentStorageManager attachmentStorageManager;
    private PvtService pvtService;
    private OrcaConnectionConfigStore orcaConnectionConfigStore;
    private OperationsReadinessEvaluator evaluator;
    private OperationsHealthResource resource;

    @BeforeEach
    void setUp() throws Exception {
        em = org.mockito.Mockito.mock(EntityManager.class);
        query = org.mockito.Mockito.mock(Query.class);
        attachmentStorageManager = org.mockito.Mockito.mock(AttachmentStorageManager.class);
        pvtService = org.mockito.Mockito.mock(PvtService.class);
        orcaConnectionConfigStore = org.mockito.Mockito.mock(OrcaConnectionConfigStore.class);
        restOrcaTransport = new StubRestOrcaTransport();

        evaluator = new OperationsReadinessEvaluator();
        setField(OperationsReadinessEvaluator.class, evaluator, "em", em);
        setField(OperationsReadinessEvaluator.class, evaluator, "restOrcaTransport", restOrcaTransport);
        setField(OperationsReadinessEvaluator.class, evaluator, "attachmentStorageManager", attachmentStorageManager);
        setField(OperationsReadinessEvaluator.class, evaluator, "pvtService", pvtService);
        setField(OperationsReadinessEvaluator.class, evaluator, "configurationResolver",
                TestServerConfigurationResolvers.resolver());
        setField(OperationsReadinessEvaluator.class, evaluator, "orcaConnectionConfigStore", orcaConnectionConfigStore);
        setField(OperationsReadinessEvaluator.class, evaluator, "orcaPushClientRegistry", new StubPushClientRegistry(false));
        setField(OperationsReadinessEvaluator.class, evaluator, "orcaPushStateStore", new StubPushStateStore());

        resource = new OperationsHealthResource();
        setField(OperationsHealthResource.class, resource, "readinessEvaluator", evaluator);
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
    void readinessReturnsMinimalStatusOnlyWhenAllChecksAreUp() {
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        restOrcaTransport.probeResult =
                new RestOrcaTransport.ProbeResult(true, "weborca", true, false, null);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.DATABASE);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(true);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "UP",
                "reasonCodes", List.of()));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getEntity()).isEqualTo(Map.of("status", "UP"));
    }

    @Test
    void readinessReturnsDownWithoutDetailedChecksWhenCriticalCheckFails() {
        when(em.createNativeQuery(anyString())).thenThrow(new IllegalStateException("db unavailable"));
        restOrcaTransport.probeResult =
                new RestOrcaTransport.ProbeResult(false, "weborca", true, false,
                        RestOrcaTransport.REASON_CODE_PROBE_FAILED);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(false);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "DEGRADED",
                "reasonCodes", List.of(PvtService.REASON_CODE_PVT_QUEUE_OVER_CAPACITY)));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(503);
        assertThat(response.getEntity()).isEqualTo(Map.of("status", "DOWN"));
    }

    @Test
    void readinessReturnsDownWhenOrcaPushEnabledWithoutConfiguration() throws Exception {
        setField(OperationsReadinessEvaluator.class, evaluator, "configurationResolver",
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ORCA_PUSH_ENABLED, "true",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_MEDICAL_ENABLED, "true"));
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        restOrcaTransport.probeResult =
                new RestOrcaTransport.ProbeResult(true, "weborca", true, false, null);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.DATABASE);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(true);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "UP",
                "reasonCodes", List.of()));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(503);
        assertThat(response.getEntity()).isEqualTo(Map.of("status", "DOWN"));
    }

    private static void setField(Class<?> owner, Object target, String fieldName, Object value) throws Exception {
        Field field = owner.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static final class StubRestOrcaTransport extends RestOrcaTransport {
        private RestOrcaTransport.ProbeResult probeResult =
                RestOrcaTransport.unavailableProbe(RestOrcaTransport.REASON_CODE_TRANSPORT_NOT_READY);

        @Override
        public RestOrcaTransport.ProbeResult probeReadiness() {
            return probeResult;
        }
    }

    private static final class StubPushClientRegistry extends OrcaPushClientRegistry {
        private final boolean connected;

        private StubPushClientRegistry(boolean connected) {
            this.connected = connected;
        }

        @Override
        public boolean isConnected() {
            return connected;
        }
    }

    private static final class StubPushStateStore extends OrcaPushStateStore {
    }
}
