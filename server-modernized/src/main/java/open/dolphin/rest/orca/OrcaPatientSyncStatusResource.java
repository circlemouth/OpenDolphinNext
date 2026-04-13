package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.time.Instant;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.sync.OrcaPatientSyncPlanner;
import open.dolphin.orca.sync.OrcaSyncCursorStore;
import open.dolphin.orca.sync.OrcaSyncRunStore;
import open.dolphin.rest.dto.orca.PatientSyncStatusResponse;

@Path("/admin/internal/orca/patients/sync")
public class OrcaPatientSyncStatusResource extends AbstractOrcaWrapperResource {

    @Inject
    private OrcaSyncCursorStore cursorStore;

    @Inject
    private OrcaSyncRunStore runStore;

    @GET
    @Path("/status")
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
        recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }
}
