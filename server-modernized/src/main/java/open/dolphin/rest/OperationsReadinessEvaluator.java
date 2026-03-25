package open.dolphin.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.mbean.PvtService;
import open.dolphin.orca.config.OrcaConnectionConfigRecord;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.orca.push.OrcaPushClientRegistry;
import open.dolphin.orca.push.OrcaPushConnectionStateStore;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;
import open.dolphin.rest.dto.OperationsReadinessCheck;
import open.dolphin.rest.dto.OperationsReadinessResponse;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.attachment.AttachmentStorageMode;

@ApplicationScoped
public class OperationsReadinessEvaluator {

    static final String CHECK_DATABASE = "database";
    static final String CHECK_ORCA = "orca";
    static final String CHECK_ORCA_PUSH = "orcaPush";
    static final String CHECK_ATTACHMENT_STORAGE = "attachmentStorage";
    static final String CHECK_PVT_QUEUE = "pvtQueue";
    static final String CHECK_PATIENT_IMAGES = "patientImages";

    private static final String DB_PING_SQL = "select 1";
    private static final String STATUS_UP = "UP";
    private static final String STATUS_DOWN = "DOWN";
    private static final String STATUS_DISABLED = "DISABLED";
    private static final String STATUS_DEGRADED = "DEGRADED";
    private static final String REASON_DATABASE_UNREACHABLE = "database_unreachable";
    private static final String REASON_ATTACHMENT_STORAGE_NOT_READY = "attachment_storage_not_ready";
    private static final String REASON_ATTACHMENT_STORAGE_BACKEND_UNREACHABLE = "attachment_storage_backend_unreachable";
    private static final String REASON_PATIENT_IMAGES_STORAGE_UNAVAILABLE = "patient_images_storage_unavailable";
    private static final String REASON_ORCA_PUSH_NOT_CONFIGURED = "orca_push_not_configured";
    private static final String REASON_ORCA_PUSH_RUNTIME_UNAVAILABLE = "orca_push_runtime_unavailable";

    @PersistenceContext
    EntityManager em;

    @Inject
    RestOrcaTransport restOrcaTransport;

    @Inject
    AttachmentStorageManager attachmentStorageManager;

    @Inject
    PvtService pvtService;

    @Inject
    ServerConfigurationResolver configurationResolver;

    @Inject
    OrcaConnectionConfigStore orcaConnectionConfigStore;

    @Inject
    OrcaPushClientRegistry orcaPushClientRegistry;

    @Inject
    OrcaPushConnectionStateStore orcaPushStateStore;

    public ReadinessSnapshot evaluate() {
        Map<String, OperationsReadinessCheck> checks = new LinkedHashMap<>();
        boolean databaseReady = checkDatabase(checks);
        boolean orcaReady = checkOrca(checks);
        boolean orcaPushReady = checkOrcaPush(checks);
        boolean storageReady = checkAttachmentStorage(checks);
        boolean pvtQueueReady = checkPvtQueue(checks);
        boolean patientImagesReady = checkPatientImages(checks, storageReady);

        boolean overallReady = databaseReady && orcaReady && orcaPushReady && storageReady && pvtQueueReady && patientImagesReady;
        OperationsReadinessResponse body = new OperationsReadinessResponse();
        body.setStatus(overallReady ? STATUS_UP : STATUS_DOWN);
        body.setChecks(checks);
        return new ReadinessSnapshot(
                overallReady ? STATUS_UP : STATUS_DOWN,
                overallReady ? Response.Status.OK : Response.Status.SERVICE_UNAVAILABLE,
                body);
    }

    private boolean checkDatabase(Map<String, OperationsReadinessCheck> checks) {
        OperationsReadinessCheck detail = new OperationsReadinessCheck();
        try {
            Object result = em != null ? em.createNativeQuery(DB_PING_SQL).getSingleResult() : null;
            boolean up = result != null;
            detail.setStatus(up ? STATUS_UP : STATUS_DOWN);
            if (!up) {
                detail.setReasonCode(REASON_DATABASE_UNREACHABLE);
            }
            checks.put(CHECK_DATABASE, detail);
            return up;
        } catch (RuntimeException ex) {
            detail.setStatus(STATUS_DOWN);
            detail.setReasonCode(REASON_DATABASE_UNREACHABLE);
            checks.put(CHECK_DATABASE, detail);
            return false;
        }
    }

    private boolean checkOrca(Map<String, OperationsReadinessCheck> checks) {
        OperationsReadinessCheck detail = new OperationsReadinessCheck();
        try {
            String facilityId = orcaConnectionConfigStore != null ? orcaConnectionConfigStore.getDefaultFacilityId() : null;
            RestOrcaTransport.ProbeResult probe = restOrcaTransport != null
                    ? restOrcaTransport.probeReadiness(facilityId)
                    : RestOrcaTransport.unavailableProbe(RestOrcaTransport.REASON_CODE_HTTP_CLIENT_UNAVAILABLE);
            boolean up = probe.reachable();
            detail.setStatus(up ? STATUS_UP : STATUS_DOWN);
            detail.setMode(probe.mode());
            detail.setCredentialConfigured(probe.credentialConfigured());
            detail.setClientAuthConfigured(probe.clientAuthConfigured());
            if (!up) {
                detail.setReasonCode(probe.reasonCode());
            }
            checks.put(CHECK_ORCA, detail);
            return up;
        } catch (RuntimeException ex) {
            detail.setStatus(STATUS_DOWN);
            detail.setReasonCode(RestOrcaTransport.REASON_CODE_PROBE_FAILED);
            checks.put(CHECK_ORCA, detail);
            return false;
        }
    }

    private boolean checkOrcaPush(Map<String, OperationsReadinessCheck> checks) {
        OperationsReadinessCheck detail = new OperationsReadinessCheck();
        try {
            ServerRuntimeConfiguration.OrcaPushSettings settings = orcaPushSettings();
            detail.setMode(settings.shadowMode() ? "shadow" : "live");
            detail.setRecoveryEnabled(settings.recoveryEnabled());
            if (!settings.enabled()) {
                detail.setStatus(STATUS_DISABLED);
                detail.setWorkerStatus(STATUS_DISABLED);
                detail.setConnected(Boolean.FALSE);
                detail.setFacilityCount(0);
                checks.put(CHECK_ORCA_PUSH, detail);
                return true;
            }
            List<OrcaPushConnectionStateStore.FacilityPushConnectionState> states =
                    orcaPushStateStore != null ? orcaPushStateStore.listStates() : List.of();
            detail.setFacilityCount(states.size());
            OrcaPushConnectionStateStore.FacilityPushConnectionState latestState = states.stream()
                    .max(java.util.Comparator.comparing(
                            OrcaPushConnectionStateStore.FacilityPushConnectionState::lastConnectedAt,
                            java.util.Comparator.nullsLast(String::compareTo)))
                    .orElse(null);
            if (latestState != null) {
                detail.setLastConnectedAt(latestState.lastConnectedAt());
                detail.setLastError(latestState.lastError());
                detail.setWorkerStatus(latestState.connectionStatus());
                detail.setConnected(OrcaPushConnectionStateStore.STATUS_CONNECTED.equals(latestState.connectionStatus()));
            } else {
                detail.setWorkerStatus(STATUS_DOWN);
                detail.setConnected(Boolean.FALSE);
            }
            if (!isPushConfigured()) {
                detail.setStatus(STATUS_DOWN);
                detail.setReasonCode(REASON_ORCA_PUSH_NOT_CONFIGURED);
                checks.put(CHECK_ORCA_PUSH, detail);
                return false;
            }
            boolean connected = orcaPushClientRegistry != null && orcaPushClientRegistry.isConnected();
            detail.setConnected(connected);
            if (connected) {
                detail.setStatus(STATUS_UP);
                checks.put(CHECK_ORCA_PUSH, detail);
                return true;
            }
            detail.setStatus(STATUS_DOWN);
            detail.setReasonCode(latestState != null && OrcaPushConnectionStateStore.STATUS_DEGRADED.equals(latestState.connectionStatus())
                    ? REASON_ORCA_PUSH_RUNTIME_UNAVAILABLE
                    : REASON_ORCA_PUSH_RUNTIME_UNAVAILABLE);
            checks.put(CHECK_ORCA_PUSH, detail);
            return false;
        } catch (RuntimeException ex) {
            detail.setStatus(STATUS_DOWN);
            detail.setWorkerStatus(STATUS_DOWN);
            detail.setConnected(Boolean.FALSE);
            detail.setReasonCode(REASON_ORCA_PUSH_RUNTIME_UNAVAILABLE);
            checks.put(CHECK_ORCA_PUSH, detail);
            return false;
        }
    }

    private boolean checkAttachmentStorage(Map<String, OperationsReadinessCheck> checks) {
        OperationsReadinessCheck detail = new OperationsReadinessCheck();
        try {
            AttachmentStorageMode mode = attachmentStorageManager != null ? attachmentStorageManager.getMode() : null;
            boolean backendReachable = attachmentStorageManager != null && attachmentStorageManager.isBackendReachable();
            boolean supportedMode = mode != null && mode.isS3();
            boolean up = supportedMode && backendReachable;
            detail.setStatus(up ? STATUS_UP : STATUS_DOWN);
            detail.setMode(mode != null ? mode.name().toLowerCase(java.util.Locale.ROOT) : null);
            detail.setBackendReachable(backendReachable);
            if (!up) {
                detail.setReasonCode(!supportedMode
                        ? REASON_ATTACHMENT_STORAGE_NOT_READY
                        : REASON_ATTACHMENT_STORAGE_BACKEND_UNREACHABLE);
            }
            checks.put(CHECK_ATTACHMENT_STORAGE, detail);
            return up;
        } catch (RuntimeException ex) {
            detail.setStatus(STATUS_DOWN);
            detail.setBackendReachable(Boolean.FALSE);
            detail.setReasonCode(REASON_ATTACHMENT_STORAGE_BACKEND_UNREACHABLE);
            checks.put(CHECK_ATTACHMENT_STORAGE, detail);
            return false;
        }
    }

    private boolean checkPvtQueue(Map<String, OperationsReadinessCheck> checks) {
        OperationsReadinessCheck detail = new OperationsReadinessCheck();
        try {
            Map<String, Object> workerHealth = pvtService != null ? pvtService.workerHealthBody() : Map.of();
            String workerStatus = String.valueOf(workerHealth.getOrDefault("status", STATUS_DOWN));
            boolean up = STATUS_UP.equalsIgnoreCase(workerStatus) || STATUS_DISABLED.equalsIgnoreCase(workerStatus);
            detail.setStatus(workerStatus.toUpperCase(java.util.Locale.ROOT));
            detail.setWorkerStatus(workerStatus);
            detail.setReasonCodes(asStringList(workerHealth.getOrDefault("reasonCodes", List.of())));
            checks.put(CHECK_PVT_QUEUE, detail);
            return up;
        } catch (RuntimeException ex) {
            detail.setStatus(STATUS_DOWN);
            detail.setWorkerStatus(STATUS_DOWN);
            detail.setReasonCodes(List.of(PvtService.REASON_CODE_PVT_WORKER_UNAVAILABLE));
            checks.put(CHECK_PVT_QUEUE, detail);
            return false;
        }
    }

    private boolean checkPatientImages(Map<String, OperationsReadinessCheck> checks, boolean attachmentStorageReady) {
        OperationsReadinessCheck detail = new OperationsReadinessCheck();
        try {
            ServerRuntimeConfiguration.PatientImagesSettings settings = patientImagesSettings();
            if (!settings.enabled()) {
                detail.setStatus(STATUS_DISABLED);
                checks.put(CHECK_PATIENT_IMAGES, detail);
                return true;
            }
            detail.setStatus(attachmentStorageReady ? STATUS_UP : STATUS_DOWN);
            if (!attachmentStorageReady) {
                detail.setReasonCode(REASON_PATIENT_IMAGES_STORAGE_UNAVAILABLE);
            }
            checks.put(CHECK_PATIENT_IMAGES, detail);
            return attachmentStorageReady;
        } catch (RuntimeException ex) {
            detail.setStatus(STATUS_DOWN);
            detail.setReasonCode(REASON_PATIENT_IMAGES_STORAGE_UNAVAILABLE);
            checks.put(CHECK_PATIENT_IMAGES, detail);
            return false;
        }
    }

    private ServerRuntimeConfiguration.OrcaPushSettings orcaPushSettings() {
        if (configurationResolver == null) {
            configurationResolver = new ServerConfigurationResolver();
        }
        return configurationResolver.orcaPush();
    }

    private ServerRuntimeConfiguration.PatientImagesSettings patientImagesSettings() {
        if (configurationResolver == null) {
            configurationResolver = new ServerConfigurationResolver();
        }
        return configurationResolver.patientImages();
    }

    private boolean isPushConfigured() {
        if (orcaConnectionConfigStore == null) {
            return false;
        }
        OrcaConnectionConfigRecord snapshot = orcaConnectionConfigStore.getSnapshot();
        return snapshot != null && snapshot.getPushUrl() != null && !snapshot.getPushUrl().isBlank();
    }

    private List<String> asStringList(Object value) {
        if (!(value instanceof Iterable<?> iterable)) {
            return List.of();
        }
        java.util.ArrayList<String> result = new java.util.ArrayList<>();
        for (Object item : iterable) {
            if (item != null) {
                result.add(String.valueOf(item));
            }
        }
        return List.copyOf(result);
    }

    public record ReadinessSnapshot(
            String status,
            Response.Status httpStatus,
            OperationsReadinessResponse body
    ) {
    }
}
