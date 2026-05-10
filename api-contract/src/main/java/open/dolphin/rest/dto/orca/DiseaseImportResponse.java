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
    private String masterVersion;

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

    public String getMasterVersion() {
        return masterVersion;
    }

    public void setMasterVersion(String masterVersion) {
        this.masterVersion = masterVersion;
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
        private String displayName;
        private String karteName;
        private String departmentCode;
        private String insuranceCombinationNumber;
        private String startDate;
        private String endDate;
        private String outcome;
        private String orcaOutcomeSendCode;
        private String orcaOutcomeReceivedCode;
        private String category;
        private String suspectedFlag;
        private String note;
        private String layer;
        private String syncState;
        private String syncStatus;
        private String masterVersion;
        private String orcaSnapshotHash;
        private Boolean readOnly;
        private Boolean candidateOnly;
        private List<DiseaseComponent> components;
        private List<DiseaseSupplement> supplements;
        private List<DiseaseWarning> warnings;
        private List<DiseaseUnmatchInformation> unmatchInformation;

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

        public String getDisplayName() {
            return displayName;
        }

        public void setDisplayName(String displayName) {
            this.displayName = displayName;
        }

        public String getKarteName() {
            return karteName;
        }

        public void setKarteName(String karteName) {
            this.karteName = karteName;
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

        public String getOrcaOutcomeSendCode() {
            return orcaOutcomeSendCode;
        }

        public void setOrcaOutcomeSendCode(String orcaOutcomeSendCode) {
            this.orcaOutcomeSendCode = orcaOutcomeSendCode;
        }

        public String getOrcaOutcomeReceivedCode() {
            return orcaOutcomeReceivedCode;
        }

        public void setOrcaOutcomeReceivedCode(String orcaOutcomeReceivedCode) {
            this.orcaOutcomeReceivedCode = orcaOutcomeReceivedCode;
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

        public String getSyncStatus() {
            return syncStatus;
        }

        public void setSyncStatus(String syncStatus) {
            this.syncStatus = syncStatus;
        }

        public String getMasterVersion() {
            return masterVersion;
        }

        public void setMasterVersion(String masterVersion) {
            this.masterVersion = masterVersion;
        }

        public String getOrcaSnapshotHash() {
            return orcaSnapshotHash;
        }

        public void setOrcaSnapshotHash(String orcaSnapshotHash) {
            this.orcaSnapshotHash = orcaSnapshotHash;
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

        public List<DiseaseComponent> getComponents() {
            return components;
        }

        public void setComponents(List<DiseaseComponent> components) {
            this.components = components;
        }

        public List<DiseaseSupplement> getSupplements() {
            return supplements;
        }

        public void setSupplements(List<DiseaseSupplement> supplements) {
            this.supplements = supplements;
        }

        public List<DiseaseWarning> getWarnings() {
            return warnings;
        }

        public void setWarnings(List<DiseaseWarning> warnings) {
            this.warnings = warnings;
        }

        public List<DiseaseUnmatchInformation> getUnmatchInformation() {
            return unmatchInformation;
        }

        public void setUnmatchInformation(List<DiseaseUnmatchInformation> unmatchInformation) {
            this.unmatchInformation = unmatchInformation;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DiseaseComponent {
        private Integer seq;
        private String componentType;
        private String code;
        private String name;
        private String sourceMaster;
        private String validFrom;
        private String validTo;
        private String condition;

        public Integer getSeq() {
            return seq;
        }

        public void setSeq(Integer seq) {
            this.seq = seq;
        }

        public String getComponentType() {
            return componentType;
        }

        public void setComponentType(String componentType) {
            this.componentType = componentType;
        }

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getSourceMaster() {
            return sourceMaster;
        }

        public void setSourceMaster(String sourceMaster) {
            this.sourceMaster = sourceMaster;
        }

        public String getValidFrom() {
            return validFrom;
        }

        public void setValidFrom(String validFrom) {
            this.validFrom = validFrom;
        }

        public String getValidTo() {
            return validTo;
        }

        public void setValidTo(String validTo) {
            this.validTo = validTo;
        }

        public String getCondition() {
            return condition;
        }

        public void setCondition(String condition) {
            this.condition = condition;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DiseaseSupplement {
        private Integer seq;
        private String supplementCode;
        private String supplementName;

        public Integer getSeq() {
            return seq;
        }

        public void setSeq(Integer seq) {
            this.seq = seq;
        }

        public String getSupplementCode() {
            return supplementCode;
        }

        public void setSupplementCode(String supplementCode) {
            this.supplementCode = supplementCode;
        }

        public String getSupplementName() {
            return supplementName;
        }

        public void setSupplementName(String supplementName) {
            this.supplementName = supplementName;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DiseaseWarning {
        private String code;
        private String messageCategory;
        private Integer position;

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getMessageCategory() {
            return messageCategory;
        }

        public void setMessageCategory(String messageCategory) {
            this.messageCategory = messageCategory;
        }

        public Integer getPosition() {
            return position;
        }

        public void setPosition(Integer position) {
            this.position = position;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DiseaseUnmatchInformation {
        private String code;
        private String name;
        private String messageCategory;

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getMessageCategory() {
            return messageCategory;
        }

        public void setMessageCategory(String messageCategory) {
            this.messageCategory = messageCategory;
        }
    }
}
