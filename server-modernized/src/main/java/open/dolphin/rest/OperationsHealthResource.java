package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Locale;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.mbean.PvtService;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.rest.dto.OperationsHealthResponse;
import open.dolphin.rest.dto.OperationsReadinessCheck;
import open.dolphin.rest.dto.OperationsReadinessResponse;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.attachment.AttachmentStorageMode;

@Path("/health")
public class OperationsHealthResource extends AbstractResource {

    private static final String DB_PING_SQL = "select 1";
    private static final String FEATURE_ENV = "OPENDOLPHIN_PATIENT_IMAGES_ENABLED";
    private static final String FEATURE_PROPERTY = "opendolphin.patient.images.enabled";
    private static final String MAX_BYTES_ENV = "OPENDOLPHIN_IMAGES_MAX_BYTES";
    private static final String MAX_BYTES_PROPERTY = "opendolphin.images.max.bytes";
    private static final long DEFAULT_MAX_BYTES = 5L * 1024L * 1024L;
    private static final String MAX_WIDTH_ENV = "OPENDOLPHIN_IMAGES_MAX_WIDTH";
    private static final String MAX_WIDTH_PROPERTY = "opendolphin.images.max.width";
    private static final int DEFAULT_MAX_WIDTH = 4096;
    private static final String MAX_HEIGHT_ENV = "OPENDOLPHIN_IMAGES_MAX_HEIGHT";
    private static final String MAX_HEIGHT_PROPERTY = "opendolphin.images.max.height";
    private static final int DEFAULT_MAX_HEIGHT = 4096;

    @PersistenceContext
    private EntityManager em;

    @Inject
    private RestOrcaTransport restOrcaTransport;

    @Inject
    private AttachmentStorageManager attachmentStorageManager;

    @Inject
    private PvtService pvtService;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response health() {
        OperationsHealthResponse body = new OperationsHealthResponse();
        body.setStatus("UP");
        body.setService("server-modernized");
        return Response.ok(body).build();
    }

    @GET
    @Path("/readiness")
    @Produces(MediaType.APPLICATION_JSON)
    public Response readiness() {
        Map<String, OperationsReadinessCheck> checks = new LinkedHashMap<>();
        boolean databaseReady = checkDatabase(checks);
        boolean orcaReady = checkOrca(checks);
        boolean storageReady = checkAttachmentStorage(checks);
        boolean pvtQueueReady = checkPvtQueue(checks);
        boolean patientImagesReady = checkPatientImages(checks, storageReady);

        boolean overallReady = databaseReady && orcaReady && storageReady && pvtQueueReady && patientImagesReady;
        OperationsReadinessResponse body = new OperationsReadinessResponse();
        body.setStatus(overallReady ? "UP" : "DOWN");
        body.setChecks(checks);

        return Response.status(overallReady ? Response.Status.OK : Response.Status.SERVICE_UNAVAILABLE)
                .entity(body)
                .build();
    }

    private boolean checkDatabase(Map<String, OperationsReadinessCheck> checks) {
        OperationsReadinessCheck detail = new OperationsReadinessCheck();
        try {
            Object result = em != null ? em.createNativeQuery(DB_PING_SQL).getSingleResult() : null;
            boolean up = result != null;
            detail.setStatus(up ? "UP" : "DOWN");
            detail.setResult(result);
            checks.put("database", detail);
            return up;
        } catch (RuntimeException ex) {
            detail.setStatus("DOWN");
            detail.setError(ex.getClass().getSimpleName());
            detail.setMessage(ex.getMessage());
            checks.put("database", detail);
            return false;
        }
    }

    private boolean checkOrca(Map<String, OperationsReadinessCheck> checks) {
        OperationsReadinessCheck detail = new OperationsReadinessCheck();
        try {
            String auditSummary = restOrcaTransport != null ? restOrcaTransport.auditSummary() : "orca.host=unknown";
            boolean up = restOrcaTransport != null && !auditSummary.contains("orca.host=unknown");
            detail.setStatus(up ? "UP" : "DOWN");
            detail.setAuditSummary(auditSummary);
            checks.put("orca", detail);
            return up;
        } catch (RuntimeException ex) {
            detail.setStatus("DOWN");
            detail.setError(ex.getClass().getSimpleName());
            detail.setMessage(ex.getMessage());
            checks.put("orca", detail);
            return false;
        }
    }

    private boolean checkAttachmentStorage(Map<String, OperationsReadinessCheck> checks) {
        OperationsReadinessCheck detail = new OperationsReadinessCheck();
        try {
            AttachmentStorageMode mode = attachmentStorageManager != null ? attachmentStorageManager.getMode() : null;
            boolean up = mode != null;
            detail.setStatus(up ? "UP" : "DOWN");
            detail.setMode(mode != null ? mode.name().toLowerCase(Locale.ROOT) : "unavailable");
            checks.put("attachmentStorage", detail);
            return up;
        } catch (RuntimeException ex) {
            detail.setStatus("DOWN");
            detail.setError(ex.getClass().getSimpleName());
            detail.setMessage(ex.getMessage());
            checks.put("attachmentStorage", detail);
            return false;
        }
    }

    private boolean checkPvtQueue(Map<String, OperationsReadinessCheck> checks) {
        OperationsReadinessCheck detail = new OperationsReadinessCheck();
        try {
            Map<String, Object> workerHealth = pvtService != null ? pvtService.workerHealthBody() : Map.of();
            String status = String.valueOf(workerHealth.getOrDefault("status", "DOWN"));
            boolean up = "UP".equalsIgnoreCase(status) || "DISABLED".equalsIgnoreCase(status);
            detail.setStatus(up ? "UP" : "DOWN");
            detail.setWorkerStatus(status);
            detail.setReasons(asStringList(workerHealth.getOrDefault("reasons", java.util.List.of())));
            checks.put("pvtQueue", detail);
            return up;
        } catch (RuntimeException ex) {
            detail.setStatus("DOWN");
            detail.setError(ex.getClass().getSimpleName());
            detail.setMessage(ex.getMessage());
            checks.put("pvtQueue", detail);
            return false;
        }
    }

    private boolean checkPatientImages(Map<String, OperationsReadinessCheck> checks, boolean attachmentStorageReady) {
        OperationsReadinessCheck detail = new OperationsReadinessCheck();
        try {
            boolean enabled = isPatientImagesEnabled();
            detail.setEnabled(enabled);
            detail.setMaxBytes(resolveLong(MAX_BYTES_PROPERTY, MAX_BYTES_ENV, DEFAULT_MAX_BYTES));
            detail.setMaxWidth((int) resolveLong(MAX_WIDTH_PROPERTY, MAX_WIDTH_ENV, DEFAULT_MAX_WIDTH));
            detail.setMaxHeight((int) resolveLong(MAX_HEIGHT_PROPERTY, MAX_HEIGHT_ENV, DEFAULT_MAX_HEIGHT));
            if (!enabled) {
                detail.setStatus("DISABLED");
                checks.put("patientImages", detail);
                return true;
            }
            detail.setStatus(attachmentStorageReady ? "UP" : "DOWN");
            if (!attachmentStorageReady) {
                detail.setMessage("attachmentStorage is DOWN");
            }
            checks.put("patientImages", detail);
            return attachmentStorageReady;
        } catch (RuntimeException ex) {
            detail.setStatus("DOWN");
            detail.setError(ex.getClass().getSimpleName());
            detail.setMessage(ex.getMessage());
            checks.put("patientImages", detail);
            return false;
        }
    }

    private boolean isPatientImagesEnabled() {
        return isTruthy(System.getProperty(FEATURE_PROPERTY)) || isTruthy(System.getenv(FEATURE_ENV));
    }

    private long resolveLong(String propertyKey, String envKey, long defaultValue) {
        String fromProperty = System.getProperty(propertyKey);
        if (fromProperty != null && !fromProperty.isBlank()) {
            return parseLongOrDefault(fromProperty, defaultValue);
        }
        String fromEnv = System.getenv(envKey);
        if (fromEnv != null && !fromEnv.isBlank()) {
            return parseLongOrDefault(fromEnv, defaultValue);
        }
        return defaultValue;
    }

    private long parseLongOrDefault(String value, long defaultValue) {
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private boolean isTruthy(String value) {
        if (value == null) {
            return false;
        }
        String trimmed = value.trim();
        return "1".equals(trimmed)
                || "true".equalsIgnoreCase(trimmed)
                || "yes".equalsIgnoreCase(trimmed)
                || "on".equalsIgnoreCase(trimmed);
    }

    private List<String> asStringList(Object value) {
        if (!(value instanceof Iterable<?> iterable)) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (Object item : iterable) {
            if (item != null) {
                result.add(String.valueOf(item));
            }
        }
        return result;
    }
}
