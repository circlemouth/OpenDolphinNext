package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.persistence.PersistenceException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Objects;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.sync.OrcaPatientImportService;
import open.dolphin.orca.sync.OrcaPatientSyncRunner;
import open.dolphin.rest.dto.orca.PatientImportRequest;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.rest.dto.orca.PatientSyncRequest;
import open.dolphin.session.framework.SessionOperation;

/**
 * ORCA patient import/sync endpoints (ORCA -> local d_patient upsert).
 */
@Path("/orca/official")
@SessionOperation
public class OrcaPatientSyncResource extends AbstractOrcaWrapperResource {

    @Inject
    private OrcaPatientImportService importService;

    @Inject
    private OrcaPatientSyncRunner syncRunner;

    public OrcaPatientSyncResource() {
        // Default constructor for RESTEasy resource instantiation.
    }

    public OrcaPatientSyncResource(OrcaPatientImportService importService,
            OrcaPatientSyncRunner syncRunner) {
        this.importService = Objects.requireNonNull(importService, "importService");
        this.syncRunner = Objects.requireNonNull(syncRunner, "syncRunner");
    }

    @POST
    @Path("/patients/import")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public PatientImportResponse importPatients(@Context HttpServletRequest request, PatientImportRequest body) {
        if (body == null || body.getPatientIds() == null || body.getPatientIds().isEmpty()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", "patientImport");
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.patient.import.invalid", "patientIds must contain at least one entry");
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.import.invalid",
                    "patientIds must contain at least one entry");
        }
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", "patientImport");
        details.put("patientIdCount", body.getPatientIds().size());
        String facilityId = requireFacilityId(request);
        details.put("facilityId", facilityId);
        String runId = (String) details.get("runId");
        try {
            PatientImportResponse response = importService.importPatients(facilityId, body, runId);
            applyResponseMetadata(response, details);
            markSuccessDetails(details);
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            throw mapImportFailure(request, details, ex);
        }
    }

    @POST
    @Path("/patients/sync/run")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public PatientImportResponse syncPatients(@Context HttpServletRequest request, PatientSyncRequest body) {
        if (body == null || body.getStartDate() == null) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", "patientSyncRun");
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.patient.sync.invalid", "startDate is required");
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.sync.invalid",
                    "startDate is required");
        }
        if (body.getEndDate() != null && body.getEndDate().isBefore(body.getStartDate())) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", "patientSyncRun");
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.patient.sync.invalid", "endDate must be on or after startDate");
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.sync.invalid",
                    "endDate must be on or after startDate");
        }
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", "patientSyncRun");
        putAuditDetail(details, "startDate", body.getStartDate());
        putAuditDetail(details, "endDate", body.getEndDate() != null ? body.getEndDate() : body.getStartDate());
        details.put("classCode", body.getClassCode());
        details.put("includeTestPatient", body.isIncludeTestPatient());
        details.put("includeInsurance", body.isIncludeInsurance());
        String facilityId = requireFacilityId(request);
        details.put("facilityId", facilityId);
        String runId = (String) details.get("runId");
        try {
            PatientImportResponse response = syncRunner.run(facilityId, body, "api", runId);
            applyResponseMetadata(response, details);
            markSuccessDetails(details);
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.BAD_GATEWAY.getStatusCode(),
                    "orca.patient.sync.error", ex.getMessage());
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    private WebApplicationException mapImportFailure(HttpServletRequest request, Map<String, Object> details, RuntimeException ex) {
        if (ex instanceof WebApplicationException webApplicationException) {
            return webApplicationException;
        }
        Response.Status status = Response.Status.SERVICE_UNAVAILABLE;
        String errorCode = "orca.patient.import.unavailable";
        String message = "患者取り込みのローカル同期に失敗しました。";
        OrcaGatewayException gatewayFailure = findCause(ex, OrcaGatewayException.class);
        if (gatewayFailure != null) {
            status = resolveGatewayFailureStatus(gatewayFailure);
            errorCode = "orca.patient.import.gateway";
            message = gatewayFailure.getMessage() != null && !gatewayFailure.getMessage().isBlank()
                    ? gatewayFailure.getMessage()
                    : "ORCA患者取り込みに失敗しました。";
        } else if (findCause(ex, IllegalArgumentException.class) != null) {
            status = Response.Status.BAD_REQUEST;
            errorCode = "orca.patient.import.invalid";
            message = ex.getMessage() != null && !ex.getMessage().isBlank()
                    ? ex.getMessage()
                    : "patient import request is invalid";
        } else if (findCause(ex, PersistenceException.class) != null || findCauseByClassName(ex,
                "org.hibernate.exception.ConstraintViolationException")) {
            errorCode = "orca.patient.import.local_sync_unavailable";
            message = "患者取り込みのローカル同期に失敗しました。ローカル患者テーブルの整合性を確認してください。";
        }
        markFailureDetails(details, status.getStatusCode(), errorCode, message);
        recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
        return restError(request, status, errorCode, message, details, ex);
    }

    private Response.Status resolveGatewayFailureStatus(OrcaGatewayException exception) {
        if (exception == null || exception.getMessage() == null) {
            return Response.Status.BAD_GATEWAY;
        }
        String normalized = exception.getMessage().trim().toLowerCase();
        if (normalized.contains("settings") || normalized.contains("not available")
                || normalized.contains("incomplete")) {
            return Response.Status.SERVICE_UNAVAILABLE;
        }
        if (normalized.contains("required") || normalized.contains("must be")
                || normalized.contains("missing required fields")) {
            return Response.Status.BAD_REQUEST;
        }
        return Response.Status.BAD_GATEWAY;
    }

    private <T extends Throwable> T findCause(Throwable throwable, Class<T> type) {
        Throwable current = throwable;
        while (current != null) {
            if (type.isInstance(current)) {
                return type.cast(current);
            }
            current = current.getCause();
        }
        return null;
    }

    private boolean findCauseByClassName(Throwable throwable, String className) {
        Throwable current = throwable;
        while (current != null) {
            if (current.getClass().getName().equals(className)) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

}
