package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

/**
 * Response payload for ORCA disease import endpoints.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DiseaseImportResponse {

    private String apiResult;
    private String apiResultMessage;
    private String errorCode;
    private String errorMessage;
    private String runId;
    private String patientId;
    private String baseDate;
    private String orcaMirrorStatus;
    private List<DiseaseEntry> diseases;
    private List<String> warnings;

    public String getApiResult() {
        return apiResult;
    }

    public void setApiResult(String apiResult) {
        this.apiResult = apiResult;
    }

    public String getApiResultMessage() {
        return apiResultMessage;
    }

    public void setApiResultMessage(String apiResultMessage) {
        this.apiResultMessage = apiResultMessage;
    }

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public void setErrorCode(String errorCode) {
        this.errorCode = errorCode;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getBaseDate() {
        return baseDate;
    }

    public void setBaseDate(String baseDate) {
        this.baseDate = baseDate;
    }

    public String getOrcaMirrorStatus() {
        return orcaMirrorStatus;
    }

    public void setOrcaMirrorStatus(String orcaMirrorStatus) {
        this.orcaMirrorStatus = orcaMirrorStatus;
    }

    public List<DiseaseEntry> getDiseases() {
        return diseases;
    }

    public void setDiseases(List<DiseaseEntry> diseases) {
        this.diseases = diseases;
    }

    public List<String> getWarnings() {
        return warnings;
    }

    public void setWarnings(List<String> warnings) {
        this.warnings = warnings;
    }

    public void addDisease(DiseaseEntry entry) {
        if (diseases == null) {
            diseases = new ArrayList<>();
        }
        diseases.add(entry);
    }

    public void addWarning(String warning) {
        if (warnings == null) {
            warnings = new ArrayList<>();
        }
        warnings.add(warning);
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DiseaseEntry {
        private Long diagnosisId;
        private String diagnosisName;
        private String diagnosisCode;
        private String departmentCode;
        private String insuranceCombinationNumber;
        private String startDate;
        private String endDate;
        private String outcome;
        private String category;
        private String suspectedFlag;
        private String note;
        private String layer;
        private String syncState;
        private Boolean readOnly;
        private Boolean candidateOnly;

        public Long getDiagnosisId() {
            return diagnosisId;
        }

        public void setDiagnosisId(Long diagnosisId) {
            this.diagnosisId = diagnosisId;
        }

        public String getDiagnosisName() {
            return diagnosisName;
        }

        public void setDiagnosisName(String diagnosisName) {
            this.diagnosisName = diagnosisName;
        }

        public String getDiagnosisCode() {
            return diagnosisCode;
        }

        public void setDiagnosisCode(String diagnosisCode) {
            this.diagnosisCode = diagnosisCode;
        }

        public String getDepartmentCode() {
            return departmentCode;
        }

        public void setDepartmentCode(String departmentCode) {
            this.departmentCode = departmentCode;
        }

        public String getInsuranceCombinationNumber() {
            return insuranceCombinationNumber;
        }

        public void setInsuranceCombinationNumber(String insuranceCombinationNumber) {
            this.insuranceCombinationNumber = insuranceCombinationNumber;
        }

        public String getStartDate() {
            return startDate;
        }

        public void setStartDate(String startDate) {
            this.startDate = startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public void setEndDate(String endDate) {
            this.endDate = endDate;
        }

        public String getOutcome() {
            return outcome;
        }

        public void setOutcome(String outcome) {
            this.outcome = outcome;
        }

        public String getCategory() {
            return category;
        }

        public void setCategory(String category) {
            this.category = category;
        }

        public String getSuspectedFlag() {
            return suspectedFlag;
        }

        public void setSuspectedFlag(String suspectedFlag) {
            this.suspectedFlag = suspectedFlag;
        }

        public String getNote() {
            return note;
        }

        public void setNote(String note) {
            this.note = note;
        }

        public String getLayer() {
            return layer;
        }

        public void setLayer(String layer) {
            this.layer = layer;
        }

        public String getSyncState() {
            return syncState;
        }

        public void setSyncState(String syncState) {
            this.syncState = syncState;
        }

        public Boolean getReadOnly() {
            return readOnly;
        }

        public void setReadOnly(Boolean readOnly) {
            this.readOnly = readOnly;
        }

        public Boolean getCandidateOnly() {
            return candidateOnly;
        }

        public void setCandidateOnly(Boolean candidateOnly) {
            this.candidateOnly = candidateOnly;
        }
    }
}
