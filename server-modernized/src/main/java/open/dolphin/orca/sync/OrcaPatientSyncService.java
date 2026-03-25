package open.dolphin.orca.sync;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Objects;
import open.dolphin.rest.dto.orca.PatientImportRequest;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.rest.dto.orca.PatientSyncRequest;

/**
 * Imports/synchronizes ORCA patients into the local OpenDolphin patient table (d_patient),
 * using facilityId + ORCA patientId (Patient_ID) as the business key.
 */
@ApplicationScoped
public class OrcaPatientSyncService {
    private OrcaPatientImportService importService;
    private OrcaPatientSyncRunner syncRunner;

    public OrcaPatientSyncService() {
        // CDI
    }

    public OrcaPatientSyncService(OrcaPatientImportService importService,
            OrcaPatientSyncRunner syncRunner) {
        this.importService = importService;
        this.syncRunner = syncRunner;
    }

    @Inject
    void setImportService(OrcaPatientImportService importService) {
        this.importService = importService;
    }

    @Inject
    void setSyncRunner(OrcaPatientSyncRunner syncRunner) {
        this.syncRunner = syncRunner;
    }

    public PatientImportResponse importPatients(String facilityId, PatientImportRequest request, String runId) {
        requireFacilityId(facilityId);
        Objects.requireNonNull(request, "request");
        ensureDependencies();
        return importService.importPatients(facilityId, request, runId);
    }

    public PatientImportResponse syncPatients(String facilityId, PatientSyncRequest request, String runId) {
        requireFacilityId(facilityId);
        Objects.requireNonNull(request, "request");
        ensureDependencies();
        return syncRunner.run(facilityId, request, "api", runId);
    }

    private void requireFacilityId(String facilityId) {
        if (facilityId == null || facilityId.isBlank()) {
            throw new IllegalArgumentException("facilityId is required");
        }
    }

    private void ensureDependencies() {
        if (importService == null) {
            throw new IllegalStateException("OrcaPatientImportService is not available");
        }
        if (syncRunner == null) {
            throw new IllegalStateException("OrcaPatientSyncRunner is not available");
        }
    }
}
