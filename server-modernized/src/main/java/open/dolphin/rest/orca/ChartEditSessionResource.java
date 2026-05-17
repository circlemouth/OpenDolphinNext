package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.rest.dto.orca.ChartEditSessionRequest;
import open.dolphin.rest.dto.orca.ChartEditSessionResponse;
import open.dolphin.session.PatientServiceBean;

@Path("/local/charts/edit-sessions")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class ChartEditSessionResource extends AbstractOrcaRestResource {

    private static final String AUDIT_ACTION = "CHART_EDIT_SESSION";
    private static final int DEFAULT_TTL_SECONDS = 300;
    private static final int MIN_TTL_SECONDS = 30;
    private static final int MAX_TTL_SECONDS = 900;

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private ChartEditSessionRepository chartEditSessionRepository;

    @POST
    @Path("/acquire")
    @Transactional
    public ChartEditSessionResponse acquire(@Context HttpServletRequest request, ChartEditSessionRequest payload) {
        return mutate(request, payload, "acquire");
    }

    @POST
    @Path("/heartbeat")
    @Transactional
    public ChartEditSessionResponse heartbeat(@Context HttpServletRequest request, ChartEditSessionRequest payload) {
        return mutate(request, payload, "heartbeat");
    }

    @POST
    @Path("/release")
    @Transactional
    public ChartEditSessionResponse release(@Context HttpServletRequest request, ChartEditSessionRequest payload) {
        return mutate(request, payload, "release");
    }

    private ChartEditSessionResponse mutate(HttpServletRequest request, ChartEditSessionRequest payload, String operation) {
        String runId = resolveRunId(request);
        String actor = requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        String patientId = requirePatientId(request, payload, facilityId, runId, operation);
        requirePatient(request, facilityId, patientId, runId, operation);
        String encounterScope = encounterScope(payload, patientId);
        long ttlSeconds = ttlSeconds(payload);

        ChartEditSessionRepository.EditSessionCommand command =
                new ChartEditSessionRepository.EditSessionCommand(
                        facilityId,
                        patientId,
                        encounterScope,
                        actor,
                        trimToNull(payload.getOwnerRunId()),
                        trimToNull(payload.getOwnerTabSessionId()),
                        trimToNull(payload.getLeaseId()),
                        Boolean.TRUE.equals(payload.getForceTakeover()),
                        ttlSeconds,
                        Instant.now());
        ChartEditSessionRepository.EditSessionResult result = switch (operation) {
            case "heartbeat" -> chartEditSessionRepository.heartbeat(command);
            case "release" -> chartEditSessionRepository.release(command);
            default -> chartEditSessionRepository.acquire(command);
        };
        Map<String, Object> audit = auditDetails(facilityId, patientId, runId, operation, result);
        if (!result.ok()) {
            markFailureDetails(audit, Response.Status.CONFLICT.getStatusCode(), result.errorCode(),
                    "Chart edit session is held by another active editor.");
            recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.FAILURE);
            Map<String, Object> details = new HashMap<>();
            details.put("lockStatus", result.lockStatus());
            details.put("ownerRunId", result.ownerRunId());
            details.put("ownerTabSessionId", result.ownerTabSessionId());
            details.put("expiresAt", iso(result.expiresAt()));
            throw restError(request, Response.Status.CONFLICT, result.errorCode(),
                    "Chart edit session is held by another active editor.", details, null);
        }
        markSuccessDetails(audit);
        recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.SUCCESS);
        return response(runId, result);
    }

    private String requirePatientId(HttpServletRequest request, ChartEditSessionRequest payload, String facilityId,
            String runId, String operation) {
        if (payload == null || trimToNull(payload.getPatientId()) == null) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("operation", operation);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "patientId");
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", "patientId is required");
            recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "patientId", "patientId is required");
        }
        return payload.getPatientId().trim();
    }

    private void requirePatient(HttpServletRequest request, String facilityId, String patientId, String runId,
            String operation) {
        PatientModel patient = patientServiceBean.getPatientById(facilityId, patientId);
        if (patient != null) {
            return;
        }
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("runId", runId);
        audit.put("operation", operation);
        markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(), "patient_not_found", "Patient not found");
        recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.FAILURE);
        throw restError(request, Response.Status.NOT_FOUND, "patient_not_found", "Patient not found");
    }

    private static String encounterScope(ChartEditSessionRequest payload, String patientId) {
        // The client may send reception/appointment identifiers for UI context, but the lease scope itself
        // is canonicalized server-side so a forged encounter id cannot bypass another terminal's patient lock.
        return "patient:" + patientId;
    }

    private static long ttlSeconds(ChartEditSessionRequest payload) {
        Integer input = payload != null ? payload.getTtlSeconds() : null;
        if (input == null) {
            return DEFAULT_TTL_SECONDS;
        }
        return Math.max(MIN_TTL_SECONDS, Math.min(MAX_TTL_SECONDS, input));
    }

    private static Map<String, Object> auditDetails(String facilityId, String patientId, String runId, String operation,
            ChartEditSessionRepository.EditSessionResult result) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("runId", runId);
        audit.put("operation", operation);
        audit.put("lockStatus", result.lockStatus());
        audit.put("encounterScope", result.encounterScope());
        audit.put("staleTakeover", result.staleTakeover());
        audit.put("expiresAt", iso(result.expiresAt()));
        return audit;
    }

    private static ChartEditSessionResponse response(String runId, ChartEditSessionRepository.EditSessionResult result) {
        ChartEditSessionResponse response = new ChartEditSessionResponse();
        response.setOk(true);
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setLockStatus(result.lockStatus());
        response.setPatientId(result.patientId());
        response.setEncounterScope(result.encounterScope());
        response.setLeaseId(result.leaseId());
        response.setOwnerRunId(result.ownerRunId());
        response.setOwnerTabSessionId(result.ownerTabSessionId());
        response.setAcquiredAt(iso(result.acquiredAt()));
        response.setHeartbeatAt(iso(result.heartbeatAt()));
        response.setExpiresAt(iso(result.expiresAt()));
        response.setStaleTakeover(result.staleTakeover());
        return response;
    }

    private static String iso(Instant value) {
        return value != null ? value.toString() : null;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
