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
import open.dolphin.orca.config.OrcaConnectionConfigRecord;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.orca.push.OrcaPushClientRegistry;
import open.dolphin.orca.push.OrcaPushStateStore;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import open.dolphin.rest.dto.OperationsReadinessCheck;
import open.dolphin.rest.dto.OperationsReadinessResponse;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.attachment.AttachmentStorageMode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OperationsReadinessResourceTest {

    private EntityManager em;
    private Query query;
    private StubRestOrcaTransport restOrcaTransport;
    private AttachmentStorageManager attachmentStorageManager;
    private PvtService pvtService;
    private OrcaConnectionConfigStore orcaConnectionConfigStore;
    private OperationsReadinessEvaluator evaluator;
    private OperationsReadinessResource resource;

    @BeforeEach
    void setUp() throws Exception {
        em = org.mockito.Mockito.mock(EntityManager.class);
        query = org.mockito.Mockito.mock(Query.class);
        attachmentStorageManager = org.mockito.Mockito.mock(AttachmentStorageManager.class);
        pvtService = org.mockito.Mockito.mock(PvtService.class);
        orcaConnectionConfigStore = org.mockito.Mockito.mock(OrcaConnectionConfigStore.class);
        restOrcaTransport = new StubRestOrcaTransport();

        ServerConfigurationResolver resolver = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_PATIENT_IMAGES_ENABLED, "false");
        evaluator = new OperationsReadinessEvaluator();
        setField(OperationsReadinessEvaluator.class, evaluator, "em", em);
        setField(OperationsReadinessEvaluator.class, evaluator, "restOrcaTransport", restOrcaTransport);
        setField(OperationsReadinessEvaluator.class, evaluator, "attachmentStorageManager", attachmentStorageManager);
        setField(OperationsReadinessEvaluator.class, evaluator, "pvtService", pvtService);
        setField(OperationsReadinessEvaluator.class, evaluator, "configurationResolver", resolver);
        setField(OperationsReadinessEvaluator.class, evaluator, "orcaConnectionConfigStore", orcaConnectionConfigStore);
        setField(OperationsReadinessEvaluator.class, evaluator, "orcaPushClientRegistry", new StubPushClientRegistry(false));
        setField(OperationsReadinessEvaluator.class, evaluator, "orcaPushStateStore", new StubPushStateStore(List.of()));

        resource = new OperationsReadinessResource();
        setField(OperationsReadinessResource.class, resource, "readinessEvaluator", evaluator);
    }

    @Test
    void readinessReturnsSanitizedChecks() {
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        restOrcaTransport.probeResult =
                new RestOrcaTransport.ProbeResult(true, "weborca", true, false, null);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(true);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "DISABLED",
                "reasonCodes", List.of()));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(200);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getStatus()).isEqualTo("UP");
        OperationsReadinessCheck orca = body.getChecks().get(OperationsReadinessEvaluator.CHECK_ORCA);
        assertThat(orca.getStatus()).isEqualTo("UP");
        assertThat(orca.getMode()).isEqualTo("weborca");
        assertThat(orca.getCredentialConfigured()).isTrue();
        assertThat(orca.getClientAuthConfigured()).isFalse();
        assertThat(orca.getReasonCode()).isNull();
        OperationsReadinessCheck orcaPush = body.getChecks().get(OperationsReadinessEvaluator.CHECK_ORCA_PUSH);
        assertThat(orcaPush.getStatus()).isEqualTo("DISABLED");
        OperationsReadinessCheck patientImages = body.getChecks().get(OperationsReadinessEvaluator.CHECK_PATIENT_IMAGES);
        assertThat(patientImages.getStatus()).isEqualTo("DISABLED");
    }

    @Test
    void readinessReturnsDownWhenOrcaPushEnabledWithoutPushConfiguration() throws Exception {
        setField(OperationsReadinessEvaluator.class, evaluator, "configurationResolver",
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_PATIENT_IMAGES_ENABLED, "false",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_ENABLED, "true",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_MEDICAL_ENABLED, "true"));
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        restOrcaTransport.probeResult =
                new RestOrcaTransport.ProbeResult(true, "weborca", true, false, null);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(true);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "UP",
                "reasonCodes", List.of()));
        when(orcaConnectionConfigStore.getSnapshot()).thenReturn(new OrcaConnectionConfigRecord());

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(503);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getStatus()).isEqualTo("DOWN");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_ORCA_PUSH).getReasonCode())
                .isEqualTo("orca_push_not_configured");
    }

    @Test
    void readinessReturnsFixedReasonCodesForDownChecks() {
        when(em.createNativeQuery(anyString())).thenThrow(new IllegalStateException("db unavailable"));
        restOrcaTransport.probeResult =
                new RestOrcaTransport.ProbeResult(false, "onprem", false, false,
                        RestOrcaTransport.REASON_CODE_TRANSPORT_NOT_READY);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(false);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "DEGRADED",
                "reasonCodes", List.of(PvtService.REASON_CODE_PVT_QUEUE_OVER_CAPACITY)));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(503);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getStatus()).isEqualTo("DOWN");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_DATABASE).getReasonCode())
                .isEqualTo("database_unreachable");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_ORCA).getReasonCode())
                .isEqualTo(RestOrcaTransport.REASON_CODE_TRANSPORT_NOT_READY);
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_ORCA_PUSH).getStatus())
                .isEqualTo("DISABLED");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_ATTACHMENT_STORAGE).getReasonCode())
                .isEqualTo("attachment_storage_backend_unreachable");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_PVT_QUEUE).getReasonCodes())
                .containsExactly(PvtService.REASON_CODE_PVT_QUEUE_OVER_CAPACITY);
    }

    @Test
    void readinessReturnsUpWhenOrcaPushConnected() throws Exception {
        setField(OperationsReadinessEvaluator.class, evaluator, "configurationResolver",
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_PATIENT_IMAGES_ENABLED, "false",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_ENABLED, "true",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_SHADOW_MODE, "false",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_RECEPTION_ENABLED, "true"));
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        restOrcaTransport.probeResult =
                new RestOrcaTransport.ProbeResult(true, "weborca", true, false, null);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(true);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "UP",
                "reasonCodes", List.of()));
        OrcaConnectionConfigRecord configured = new OrcaConnectionConfigRecord();
        configured.setPushUrl("wss://push.example");
        when(orcaConnectionConfigStore.getSnapshot()).thenReturn(configured);
        setField(OperationsReadinessEvaluator.class, evaluator, "orcaPushClientRegistry", new StubPushClientRegistry(true));
        setField(OperationsReadinessEvaluator.class, evaluator, "orcaPushStateStore", new StubPushStateStore(List.of(
                new OrcaPushStateStore.FacilityPushState(
                        "F001", "CONNECTED", "wss://push.example",
                        "2026-03-22T10:00:00Z", null, "2026-03-22T10:01:00Z",
                        "U-1", "patient_accept", null, null, null, null, null))));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(200);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        OperationsReadinessCheck orcaPush = body.getChecks().get(OperationsReadinessEvaluator.CHECK_ORCA_PUSH);
        assertThat(orcaPush.getStatus()).isEqualTo("UP");
        assertThat(orcaPush.getConnected()).isTrue();
        assertThat(orcaPush.getFacilityCount()).isEqualTo(1);
        assertThat(orcaPush.getLastConnectedAt()).isEqualTo("2026-03-22T10:00:00Z");
        assertThat(orcaPush.getLastEventAt()).isEqualTo("2026-03-22T10:01:00Z");
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
        private final List<FacilityPushState> states;

        private StubPushStateStore(List<FacilityPushState> states) {
            this.states = states;
        }

        @Override
        public List<FacilityPushState> listStates() {
            return states;
        }
    }
}
