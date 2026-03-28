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
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.sync.OrcaPatientImportService;
import open.dolphin.orca.sync.OrcaPatientSyncPlanner;
import open.dolphin.orca.sync.OrcaPatientSyncRunner;
import open.dolphin.orca.sync.OrcaPatientSyncService;
import open.dolphin.orca.sync.OrcaSyncCursorStore;
import open.dolphin.orca.sync.OrcaSyncRunStore;
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

    @Inject
    private OrcaPatientImportService importService;

    @Inject
    private OrcaPatientSyncRunner syncRunner;

    @Inject
    private OrcaSyncCursorStore cursorStore;

    @Inject
    private OrcaSyncRunStore runStore;

    public OrcaPatientSyncResource() {
        // Default constructor for RESTEasy resource instantiation.
    }

    public OrcaPatientSyncResource(OrcaPatientImportService importService,
            OrcaPatientSyncRunner syncRunner,
            OrcaSyncCursorStore cursorStore,
            OrcaSyncRunStore runStore) {
        this.importService = Objects.requireNonNull(importService, "importService");
        this.syncRunner = Objects.requireNonNull(syncRunner, "syncRunner");
        this.cursorStore = Objects.requireNonNull(cursorStore, "cursorStore");
        this.runStore = Objects.requireNonNull(runStore, "runStore");
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
        String facilityId = requireFacilityId(request);
        details.put("facilityId", facilityId);
        String runId = (String) details.get("runId");
        try {
            PatientImportResponse response = importService.importPatients(facilityId, body, runId);
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
        String facilityId = requireFacilityId(request);
        details.put("facilityId", facilityId);
        String runId = (String) details.get("runId");
        try {
            PatientImportResponse response = syncRunner.run(facilityId, body, "api", runId);
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
        String facilityId = requireFacilityId(request);
        details.put("facilityId", facilityId);

        PatientSyncStatusResponse response = new PatientSyncStatusResponse();
        response.setFacilityId(facilityId);
        response.setStatePath("db:opendolphin.d_orca_sync_cursor,db:opendolphin.d_orca_sync_run");
        if (cursorStore != null) {
            OrcaSyncCursorStore.CursorRow cursor = cursorStore.load(facilityId, OrcaPatientSyncPlanner.STREAM_KIND);
            if (cursor != null) {
                response.setLastSyncDate(cursor.cursorValue());
                response.setLastRunId(cursor.lastAppliedRunId());
            }
        }
        if (runStore != null) {
            OrcaSyncRunStore.RunRow run = runStore.findLatest(facilityId, OrcaPatientSyncPlanner.STREAM_KIND);
            if (run != null) {
                if (response.getLastRunId() == null || response.getLastRunId().isBlank()) {
                    response.setLastRunId(run.runId());
                }
                Instant finishedAt = run.finishedAt();
                if (finishedAt != null) {
                    response.setLastSyncedAt(finishedAt.toString());
                }
                if ("partial".equals(run.status()) || "failed".equals(run.status())) {
                    response.setLastError(run.errorMessage());
                }
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
