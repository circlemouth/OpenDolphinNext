package open.dolphin.rest.dto.orca;

import java.util.ArrayList;
import java.util.List;

/**
 * Request payload for POST /api/orca/official/patients/import.
 */
public class PatientImportRequest {

    private final List<String> patientIds = new ArrayList<>();
    private boolean includeInsurance;

    public List<String> getPatientIds() {
        return patientIds;
    }

    public boolean isIncludeInsurance() {
        return includeInsurance;
    }

    public void setIncludeInsurance(boolean includeInsurance) {
        this.includeInsurance = includeInsurance;
    }
}
