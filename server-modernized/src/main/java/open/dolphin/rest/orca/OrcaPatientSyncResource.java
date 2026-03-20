package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.sync.OrcaPatientSyncService;
import open.dolphin.orca.sync.OrcaPatientSyncStateStore;
import open.dolphin.rest.dto.orca.PatientImportRequest;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.rest.dto.orca.PatientSyncRequest;
import open.dolphin.rest.dto.orca.PatientSyncStatusResponse;
import open.dolphin.session.framework.SessionOperation;

/**
 * ORCA patient import/sync endpoints (ORCA -> local d_patient upsert).
 */
@Path("/orca")
@SessionOperation
public class OrcaPatientSyncResource extends AbstractOrcaWrapperResource {

    private OrcaPatientSyncService syncService;
    private OrcaPatientSyncStateStore stateStore;

    public OrcaPatientSyncResource() {
    }

    @Inject
    public OrcaPatientSyncResource(OrcaPatientSyncService syncService, OrcaPatientSyncStateStore stateStore) {
        this.syncService = syncService;
        this.stateStore = stateStore;
    }

    void setSyncService(OrcaPatientSyncService syncService) {
        this.syncService = syncService;
    }

    void setStateStore(OrcaPatientSyncStateStore stateStore) {
        this.stateStore = stateStore;
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
            recordAudit(request, ACTION_PATIENT_SYNC, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.import.invalid",
                    "patientIds must contain at least one entry");
        }
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", "patientImport");
        details.put("patientIdCount", body.getPatientIds().size());
        String facilityId = (String) details.get("facilityId");
        if (facilityId == null || facilityId.isBlank()) {
            markFailureDetails(details, Response.Status.UNAUTHORIZED.getStatusCode(),
                    "facility_missing", "Facility is required");
            recordAudit(request, ACTION_PATIENT_SYNC, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.UNAUTHORIZED, "facility_missing", "Facility is required");
        }
        String runId = (String) details.get("runId");
        try {
            PatientImportResponse response = syncService.importPatients(facilityId, body, runId);
            applyResponseMetadata(response, details);
            markSuccessDetails(details);
            recordAudit(request, ACTION_PATIENT_SYNC, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.BAD_GATEWAY.getStatusCode(),
                    "orca.patient.import.error", ex.getMessage());
            recordAudit(request, ACTION_PATIENT_SYNC, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
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
            recordAudit(request, ACTION_PATIENT_SYNC, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.sync.invalid",
                    "startDate is required");
        }
        if (body.getEndDate() != null && body.getEndDate().isBefore(body.getStartDate())) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", "patientSyncRun");
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.patient.sync.invalid", "endDate must be on or after startDate");
            recordAudit(request, ACTION_PATIENT_SYNC, details, AuditEventEnvelope.Outcome.FAILURE);
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
        String facilityId = (String) details.get("facilityId");
        if (facilityId == null || facilityId.isBlank()) {
            markFailureDetails(details, Response.Status.UNAUTHORIZED.getStatusCode(),
                    "facility_missing", "Facility is required");
            recordAudit(request, ACTION_PATIENT_SYNC, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.UNAUTHORIZED, "facility_missing", "Facility is required");
        }
        String runId = (String) details.get("runId");
        try {
            PatientImportResponse response = syncService.syncPatients(facilityId, body, runId);
            applyResponseMetadata(response, details);
            markSuccessDetails(details);
            recordAudit(request, ACTION_PATIENT_SYNC, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.BAD_GATEWAY.getStatusCode(),
                    "orca.patient.sync.error", ex.getMessage());
            recordAudit(request, ACTION_PATIENT_SYNC, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    @GET
    @Path("/patients/sync/status")
    @Produces(MediaType.APPLICATION_JSON)
    public PatientSyncStatusResponse syncStatus(@Context HttpServletRequest request) {
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", "patientSyncStatus");
        String facilityId = (String) details.get("facilityId");
        if (facilityId == null || facilityId.isBlank()) {
            markFailureDetails(details, Response.Status.UNAUTHORIZED.getStatusCode(),
                    "facility_missing", "Facility is required");
            recordAudit(request, ACTION_PATIENT_SYNC, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.UNAUTHORIZED, "facility_missing", "Facility is required");
        }

        PatientSyncStatusResponse response = new PatientSyncStatusResponse();
        response.setFacilityId(facilityId);
        response.setStatePath(stateStore != null ? stateStore.resolveStorageDescriptor() : null);
        if (stateStore != null) {
            OrcaPatientSyncStateStore.FacilityState state = stateStore.loadFacilityState(facilityId);
            if (state != null) {
                response.setLastSyncDate(state.lastSyncDate);
                response.setLastSyncedAt(state.lastSyncedAt);
                response.setLastRunId(state.lastRunId);
                response.setLastError(state.lastError);
            }
        }
        response.setApiResult("00");
        response.setApiResultMessage("OK");
        applyResponseMetadata(response, details);
        markSuccessDetails(details);
        recordAudit(request, ACTION_PATIENT_SYNC, details, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }
}
