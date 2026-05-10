package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
import open.dolphin.orca.push.OrcaPushConnectionStateStore;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import open.dolphin.rest.dto.OperationsHealthResponse;
import open.dolphin.rest.dto.OperationsReadinessResponse;
import open.dolphin.security.audit.AuthoritativeAuditRepository;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.attachment.AttachmentStorageMode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OperationsHealthResourceTest {

    private EntityManager em;
    private Query query;
    private RestOrcaTransport restOrcaTransport;
    private AttachmentStorageManager attachmentStorageManager;
    private PvtService pvtService;
    private OrcaConnectionConfigStore orcaConnectionConfigStore;
    private AuthoritativeAuditRepository authoritativeAuditRepository;
    private OperationsReadinessEvaluator evaluator;
    private OperationsHealthResource resource;

    @BeforeEach
    void setUp() throws Exception {
        em = org.mockito.Mockito.mock(EntityManager.class);
        query = org.mockito.Mockito.mock(Query.class);
        attachmentStorageManager = org.mockito.Mockito.mock(AttachmentStorageManager.class);
        pvtService = org.mockito.Mockito.mock(PvtService.class);
        orcaConnectionConfigStore = org.mockito.Mockito.mock(OrcaConnectionConfigStore.class);
        authoritativeAuditRepository = org.mockito.Mockito.mock(AuthoritativeAuditRepository.class);
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
        setField(OperationsReadinessEvaluator.class, evaluator, "authoritativeAuditRepository", authoritativeAuditRepository);

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
    void readinessReturnsDetailedChecksOnPublicHealthReadinessRoute() {
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        when(orcaConnectionConfigStore.getDefaultFacilityId()).thenReturn("F001");
        ((StubRestOrcaTransport) restOrcaTransport).probeResult =
                new RestOrcaTransport.ProbeResult(true, "weborca", true, false, null);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(true);
        when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(true);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "UP",
                "reasonCodes", List.of()));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(200);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getStatus()).isEqualTo("UP");
        assertThat(body.getChecks()).containsKeys(
                OperationsReadinessEvaluator.CHECK_DATABASE,
                OperationsReadinessEvaluator.CHECK_AUDIT_LOG,
                OperationsReadinessEvaluator.CHECK_ORCA,
                OperationsReadinessEvaluator.CHECK_ORCA_PUSH,
                OperationsReadinessEvaluator.CHECK_ATTACHMENT_STORAGE,
                OperationsReadinessEvaluator.CHECK_PVT_QUEUE,
                OperationsReadinessEvaluator.CHECK_PATIENT_IMAGES);
    }

    @Test
    void readinessReflectsClientAuthTruthWithoutLeakingConfiguredTargetMaterial() throws Exception {
        String rawBaseUrl = "https://facility.example.orca/secret-prefix";
        RestOrcaTransport realTransport = new RestOrcaTransport();
        setField(RestOrcaTransport.class, realTransport, "orcaConnectionConfigStore", orcaConnectionConfigStore);
        setField(RestOrcaTransport.class, realTransport, "configurationResolver",
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ORCA_TRANSPORT_CACHE_TTL_MS, "60000"));
        setField(OperationsReadinessEvaluator.class, evaluator, "restOrcaTransport", realTransport);

        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        when(orcaConnectionConfigStore.getDefaultFacilityId()).thenReturn("F001");
        when(orcaConnectionConfigStore.resolve("F001")).thenReturn(new OrcaConnectionConfigStore.ResolvedOrcaConnection(
                true,
                rawBaseUrl,
                null,
                null,
                true,
                null,
                null,
                null));
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(true);
        when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(true);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "UP",
                "reasonCodes", List.of()));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(503);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_ORCA).getClientAuthConfigured())
                .isEqualTo(Boolean.TRUE);
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_ORCA).getReasonCode())
                .isEqualTo(RestOrcaTransport.REASON_CODE_TRANSPORT_NOT_READY);
        String rendered = AbstractResource.getSerializeMapper().writeValueAsString(body);
        assertThat(rendered).doesNotContain("facility.example.orca");
        assertThat(rendered).doesNotContain("secret-prefix");
    }

    @Test
    void readinessReturnsDownWithSanitizedCheckPayloadWhenCriticalCheckFails() {
        when(em.createNativeQuery(anyString())).thenThrow(new IllegalStateException("db unavailable"));
        when(orcaConnectionConfigStore.getDefaultFacilityId()).thenReturn("F001");
        ((StubRestOrcaTransport) restOrcaTransport).probeResult =
                new RestOrcaTransport.ProbeResult(false, "weborca", true, false,
                        RestOrcaTransport.REASON_CODE_PROBE_FAILED);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(false);
        when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(false);
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
                .isEqualTo(RestOrcaTransport.REASON_CODE_PROBE_FAILED);
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_AUDIT_LOG).getReasonCode())
                .isEqualTo("audit_log_write_unavailable");
    }

    @Test
    void readinessReportsDisabledAttachmentStorageWithoutBackendDetails() throws Exception {
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        when(orcaConnectionConfigStore.getDefaultFacilityId()).thenReturn("F001");
        ((StubRestOrcaTransport) restOrcaTransport).probeResult =
                new RestOrcaTransport.ProbeResult(true, "weborca", true, false, null);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.DISABLED);
        when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(true);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "UP",
                "reasonCodes", List.of()));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(200);
        verify(attachmentStorageManager, never()).isBackendReachable();
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getStatus()).isEqualTo("UP");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_ATTACHMENT_STORAGE).getStatus())
                .isEqualTo("DISABLED");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_ATTACHMENT_STORAGE).getMode())
                .isEqualTo("disabled");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_ATTACHMENT_STORAGE).getReasonCode())
                .isEqualTo("attachment_storage_disabled");
        String rendered = AbstractResource.getSerializeMapper().writeValueAsString(body);
        assertThat(rendered).doesNotContain("bucket");
        assertThat(rendered).doesNotContain("endpoint");
        assertThat(rendered).doesNotContain("minio");
    }

    @Test
    void readinessFailsClosedWhenPatientImagesEnabledButAttachmentStorageIsDisabled() throws Exception {
        setField(OperationsReadinessEvaluator.class, evaluator, "configurationResolver",
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_PATIENT_IMAGES_ENABLED, "true"));
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        when(orcaConnectionConfigStore.getDefaultFacilityId()).thenReturn("F001");
        ((StubRestOrcaTransport) restOrcaTransport).probeResult =
                new RestOrcaTransport.ProbeResult(true, "weborca", true, false, null);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.DISABLED);
        when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(true);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "UP",
                "reasonCodes", List.of()));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(503);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getStatus()).isEqualTo("DOWN");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_ATTACHMENT_STORAGE).getStatus())
                .isEqualTo("DISABLED");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_PATIENT_IMAGES).getStatus())
                .isEqualTo("DOWN");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_PATIENT_IMAGES).getReasonCode())
                .isEqualTo("patient_images_storage_unavailable");
    }

    @Test
    void readinessReturnsDownWhenOrcaPushEnabledWithoutConfiguration() throws Exception {
        setField(OperationsReadinessEvaluator.class, evaluator, "configurationResolver",
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ORCA_PUSH_ENABLED, "true",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_MEDICAL_ENABLED, "true"));
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        when(orcaConnectionConfigStore.getDefaultFacilityId()).thenReturn("F001");
        ((StubRestOrcaTransport) restOrcaTransport).probeResult =
                new RestOrcaTransport.ProbeResult(true, "weborca", true, false, null);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(true);
        when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(true);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "UP",
                "reasonCodes", List.of()));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(503);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getStatus()).isEqualTo("DOWN");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_ORCA_PUSH).getReasonCode())
                .isEqualTo("orca_push_not_configured");
    }

    @Test
    void readinessDoesNotExposeOrcaPushRawLastError() throws Exception {
        setField(OperationsReadinessEvaluator.class, evaluator, "configurationResolver",
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ORCA_PUSH_ENABLED, "true",
                        ServerConfigurationResolver.KEY_ORCA_PUSH_MEDICAL_ENABLED, "true"));
        setField(OperationsReadinessEvaluator.class, evaluator, "orcaPushStateStore", new StubPushStateStore(List.of(
                new OrcaPushConnectionStateStore.FacilityPushConnectionState(
                        "F001",
                        "push",
                        OrcaPushConnectionStateStore.STATUS_DISCONNECTED,
                        "wss://facility.example.orca/push",
                        "2026-04-18T00:00:00Z",
                        null,
                        "java.net.ConnectException: failed https://" + "admin:pass@" + "facility.example.orca/secret-prefix"))));

        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        when(orcaConnectionConfigStore.getDefaultFacilityId()).thenReturn("F001");
        OrcaConnectionConfigRecord snapshot = new OrcaConnectionConfigRecord();
        snapshot.setPushUrl("wss://facility.example.orca/push");
        when(orcaConnectionConfigStore.getSnapshot()).thenReturn(snapshot);
        ((StubRestOrcaTransport) restOrcaTransport).probeResult =
                new RestOrcaTransport.ProbeResult(true, "weborca", true, false, null);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(true);
        when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(true);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "UP",
                "reasonCodes", List.of()));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(503);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_ORCA_PUSH).getReasonCode())
                .isEqualTo("orca_push_runtime_unavailable");
        String rendered = AbstractResource.getSerializeMapper().writeValueAsString(body);
        assertThat(rendered).doesNotContain("lastError");
        assertThat(rendered).doesNotContain("facility.example.orca");
        assertThat(rendered).doesNotContain("admin:pass");
        assertThat(rendered).doesNotContain("secret-prefix");
        assertThat(rendered).doesNotContain("ConnectException");
    }

    @Test
    void readinessFailsClosedWhenDefaultFacilityIsMissing() {
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(true);
        when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(true);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "UP",
                "reasonCodes", List.of()));
        when(orcaConnectionConfigStore.getDefaultFacilityId()).thenReturn(null);

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(503);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_ORCA).getReasonCode())
                .isEqualTo("facility_configuration_missing");
        assertThat(((StubRestOrcaTransport) restOrcaTransport).probeCalls).isZero();
    }

    @Test
    void readinessFailsClosedWhenAuditLogWritePathIsUnavailable() {
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(1);
        when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(false);
        when(orcaConnectionConfigStore.getDefaultFacilityId()).thenReturn("F001");
        ((StubRestOrcaTransport) restOrcaTransport).probeResult =
                new RestOrcaTransport.ProbeResult(true, "weborca", true, false, null);
        when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        when(attachmentStorageManager.isBackendReachable()).thenReturn(true);
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "UP",
                "reasonCodes", List.of()));

        Response response = resource.readiness();

        assertThat(response.getStatus()).isEqualTo(503);
        OperationsReadinessResponse body = (OperationsReadinessResponse) response.getEntity();
        assertThat(body.getStatus()).isEqualTo("DOWN");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_AUDIT_LOG).getStatus())
                .isEqualTo("DOWN");
        assertThat(body.getChecks().get(OperationsReadinessEvaluator.CHECK_AUDIT_LOG).getReasonCode())
                .isEqualTo("audit_log_write_unavailable");
    }

    private static void setField(Class<?> owner, Object target, String fieldName, Object value) throws Exception {
        Field field = owner.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static final class StubRestOrcaTransport extends RestOrcaTransport {
        private RestOrcaTransport.ProbeResult probeResult =
                RestOrcaTransport.unavailableProbe(RestOrcaTransport.REASON_CODE_TRANSPORT_NOT_READY);
        private int probeCalls;

        @Override
        public RestOrcaTransport.ProbeResult probeReadiness(String facilityId) {
            probeCalls++;
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

    private static final class StubPushStateStore extends OrcaPushConnectionStateStore {
        private final List<OrcaPushConnectionStateStore.FacilityPushConnectionState> states;

        private StubPushStateStore() {
            this(List.of());
        }

        private StubPushStateStore(List<OrcaPushConnectionStateStore.FacilityPushConnectionState> states) {
            this.states = states;
        }

        @Override
        public List<OrcaPushConnectionStateStore.FacilityPushConnectionState> listStates() {
            return states;
        }
    }
}
