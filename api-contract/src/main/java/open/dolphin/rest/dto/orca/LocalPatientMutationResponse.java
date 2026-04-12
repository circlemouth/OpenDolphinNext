package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Response payload for POST /api/local/patients/mutation.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LocalPatientMutationResponse extends OrcaApiResponse {

    private Long patientDbId;
    private String patientId;
    private String warningMessage;
    private Boolean idempotent;
    private String idempotentReason;

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

    public String getWarningMessage() {
        return warningMessage;
    }

    public void setWarningMessage(String warningMessage) {
        this.warningMessage = warningMessage;
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
}
