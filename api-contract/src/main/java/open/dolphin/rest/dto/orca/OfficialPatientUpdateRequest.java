package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Request payload for official ORCA patient update (patientmodv2 class=02).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class OfficialPatientUpdateRequest {

    private String runId;
    private OfficialPatientPayload patient;
    private OfficialPatientAuditMeta auditMeta;

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public OfficialPatientPayload getPatient() {
        return patient;
    }

    public void setPatient(OfficialPatientPayload patient) {
        this.patient = patient;
    }

    public OfficialPatientAuditMeta getAuditMeta() {
        return auditMeta;
    }

    public void setAuditMeta(OfficialPatientAuditMeta auditMeta) {
        this.auditMeta = auditMeta;
    }
}
