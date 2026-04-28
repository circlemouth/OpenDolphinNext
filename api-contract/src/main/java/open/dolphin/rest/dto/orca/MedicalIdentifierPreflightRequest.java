package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDate;

/**
 * Request for artifact-free ORCA identifier preflight.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class MedicalIdentifierPreflightRequest {

    private LocalDate acceptanceDate;
    private String classCode;
    private String targetRowHash;
    private String medicalGetClassCode;

    public LocalDate getAcceptanceDate() {
        return acceptanceDate;
    }

    public void setAcceptanceDate(LocalDate acceptanceDate) {
        this.acceptanceDate = acceptanceDate;
    }

    public String getClassCode() {
        return classCode;
    }

    public void setClassCode(String classCode) {
        this.classCode = classCode;
    }

    public String getTargetRowHash() {
        return targetRowHash;
    }

    public void setTargetRowHash(String targetRowHash) {
        this.targetRowHash = targetRowHash;
    }

    public String getMedicalGetClassCode() {
        return medicalGetClassCode;
    }

    public void setMedicalGetClassCode(String medicalGetClassCode) {
        this.medicalGetClassCode = medicalGetClassCode;
    }
}
