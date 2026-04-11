package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;
import open.dolphin.rest.dto.outpatient.OutpatientFlagResponse;
import open.dolphin.rest.dto.outpatient.PatientOutpatientResponse;

/**
 * Response payload for official ORCA patient create/update.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OfficialPatientMutationResponse extends OrcaApiResponse {

    private Long patientDbId;
    private String patientId;
    private PatientOutpatientResponse.PatientRecord patient;
    private Boolean idempotent;
    private String idempotentReason;
    private OutpatientFlagResponse.AuditEvent auditEvent;

    public Long getPatientDbId() {
        return patientDbId;
    }

    public void setPatientDbId(Long patientDbId) {
        this.patientDbId = patientDbId;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public PatientOutpatientResponse.PatientRecord getPatient() {
        return patient;
    }

    public void setPatient(PatientOutpatientResponse.PatientRecord patient) {
        this.patient = patient;
    }

    public Boolean getIdempotent() {
        return idempotent;
    }

    public void setIdempotent(Boolean idempotent) {
        this.idempotent = idempotent;
    }

    public String getIdempotentReason() {
        return idempotentReason;
    }

    public void setIdempotentReason(String idempotentReason) {
        this.idempotentReason = idempotentReason;
    }

    public OutpatientFlagResponse.AuditEvent getAuditEvent() {
        return auditEvent;
    }

    public void setAuditEvent(OutpatientFlagResponse.AuditEvent auditEvent) {
        this.auditEvent = auditEvent;
    }
}
