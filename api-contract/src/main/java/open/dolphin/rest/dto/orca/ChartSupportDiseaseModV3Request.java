package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ChartSupportDiseaseModV3Request {

    private String patientId;
    private String baseMonth;
    private String performDate;
    private String performTime;
    private String departmentCode;
    private String physicianCode;
    private String insuranceCombinationNumber;
    private String requestNumber;
    private String operation;
    private DiseaseInformation targetDisease;
    private OrganizeInformation organizeInformation;
    private List<DiseaseInformation> diseaseInformation = new ArrayList<>();
    private final List<String> forbiddenClientFields = new ArrayList<>();

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getBaseMonth() {
        return baseMonth;
    }

    public void setBaseMonth(String baseMonth) {
        this.baseMonth = baseMonth;
    }

    public String getPerformDate() {
        return performDate;
    }

    public void setPerformDate(String performDate) {
        this.performDate = performDate;
    }

    public String getPerformTime() {
        return performTime;
    }

    public void setPerformTime(String performTime) {
        this.performTime = performTime;
    }

    public String getDepartmentCode() {
        return departmentCode;
    }

    public void setDepartmentCode(String departmentCode) {
        this.departmentCode = departmentCode;
    }

    public String getPhysicianCode() {
        return physicianCode;
    }

    public void setPhysicianCode(String physicianCode) {
        this.physicianCode = physicianCode;
    }

    public String getInsuranceCombinationNumber() {
        return insuranceCombinationNumber;
    }

    public void setInsuranceCombinationNumber(String insuranceCombinationNumber) {
        this.insuranceCombinationNumber = insuranceCombinationNumber;
    }

    public String getRequestNumber() {
        return requestNumber;
    }

    public void setRequestNumber(String requestNumber) {
        this.requestNumber = requestNumber;
    }

    public String getOperation() {
        return operation;
    }

    public void setOperation(String operation) {
        this.operation = operation;
    }

    public DiseaseInformation getTargetDisease() {
        return targetDisease;
    }

    public void setTargetDisease(DiseaseInformation targetDisease) {
        this.targetDisease = targetDisease;
    }

    public OrganizeInformation getOrganizeInformation() {
        return organizeInformation;
    }

    public void setOrganizeInformation(OrganizeInformation organizeInformation) {
        this.organizeInformation = organizeInformation;
    }

    public List<DiseaseInformation> getDiseaseInformation() {
        return diseaseInformation;
    }

    public void setDiseaseInformation(List<DiseaseInformation> diseaseInformation) {
        this.diseaseInformation = diseaseInformation;
    }

    public List<String> getForbiddenClientFields() {
        return Collections.unmodifiableList(forbiddenClientFields);
    }

    @JsonAnySetter
    public void captureUnknownField(String name, Object value) {
        if (isForbiddenClientAuthorityField(name)) {
            forbiddenClientFields.add(name);
        }
    }

    public static boolean isForbiddenClientAuthorityField(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        String normalized = name.replace("_", "").replace("-", "").trim().toLowerCase(Locale.ROOT);
        return normalized.equals("requestnumber")
                || normalized.equals("rawxml")
                || normalized.equals("requestxml")
                || normalized.equals("xml")
                || normalized.equals("orcaurl")
                || normalized.equals("serverurl")
                || normalized.equals("baseurl")
                || normalized.equals("endpoint")
                || normalized.equals("url")
                || normalized.equals("host")
                || normalized.equals("port")
                || normalized.equals("facilityid")
                || normalized.equals("ownerid")
                || normalized.equals("owner");
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OrganizeInformation {
        private String departmentCode;
        private String diseaseStartDate;
        private final List<String> forbiddenClientFields = new ArrayList<>();

        public String getDepartmentCode() {
            return departmentCode;
        }

        public void setDepartmentCode(String departmentCode) {
            this.departmentCode = departmentCode;
        }

        public String getDiseaseStartDate() {
            return diseaseStartDate;
        }

        public void setDiseaseStartDate(String diseaseStartDate) {
            this.diseaseStartDate = diseaseStartDate;
        }

        public List<String> getForbiddenClientFields() {
            return Collections.unmodifiableList(forbiddenClientFields);
        }

        @JsonAnySetter
        public void captureUnknownField(String name, Object value) {
            if (ChartSupportDiseaseModV3Request.isForbiddenClientAuthorityField(name)) {
                forbiddenClientFields.add(name);
            }
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DiseaseInformation {
        private String diseaseCode;
        private String diseaseName;
        private String displayName;
        private String karteName;
        private String diseaseStartDate;
        private String diseaseEndDate;
        private String diseaseInOut;
        private String diseaseSuspectedFlag;
        private String diseaseOutCome;
        private String outcome;
        private String orcaOutcomeSendCode;
        private String orcaOutcomeReceivedCode;
        private String insuranceCombinationNumber;
        private String masterVersion;
        private String orcaSnapshotHash;
        private String syncStatus;
        private boolean uncodedAccepted;
        private List<DiseaseComponent> components = new ArrayList<>();
        private List<DiseaseSupplement> supplements = new ArrayList<>();
        private final List<String> forbiddenClientFields = new ArrayList<>();

        public String getDiseaseCode() {
            return diseaseCode;
        }

        public void setDiseaseCode(String diseaseCode) {
            this.diseaseCode = diseaseCode;
        }

        public String getDiseaseName() {
            return diseaseName;
        }

        public void setDiseaseName(String diseaseName) {
            this.diseaseName = diseaseName;
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

        public String getDiseaseStartDate() {
            return diseaseStartDate;
        }

        public void setDiseaseStartDate(String diseaseStartDate) {
            this.diseaseStartDate = diseaseStartDate;
        }

        public String getDiseaseEndDate() {
            return diseaseEndDate;
        }

        public void setDiseaseEndDate(String diseaseEndDate) {
            this.diseaseEndDate = diseaseEndDate;
        }

        public String getDiseaseInOut() {
            return diseaseInOut;
        }

        public void setDiseaseInOut(String diseaseInOut) {
            this.diseaseInOut = diseaseInOut;
        }

        public String getDiseaseSuspectedFlag() {
            return diseaseSuspectedFlag;
        }

        public void setDiseaseSuspectedFlag(String diseaseSuspectedFlag) {
            this.diseaseSuspectedFlag = diseaseSuspectedFlag;
        }

        public String getDiseaseOutCome() {
            return diseaseOutCome;
        }

        public void setDiseaseOutCome(String diseaseOutCome) {
            this.diseaseOutCome = diseaseOutCome;
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

        public String getInsuranceCombinationNumber() {
            return insuranceCombinationNumber;
        }

        public void setInsuranceCombinationNumber(String insuranceCombinationNumber) {
            this.insuranceCombinationNumber = insuranceCombinationNumber;
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

        public String getSyncStatus() {
            return syncStatus;
        }

        public void setSyncStatus(String syncStatus) {
            this.syncStatus = syncStatus;
        }

        public boolean isUncodedAccepted() {
            return uncodedAccepted;
        }

        public void setUncodedAccepted(boolean uncodedAccepted) {
            this.uncodedAccepted = uncodedAccepted;
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

        public List<String> getForbiddenClientFields() {
            return Collections.unmodifiableList(forbiddenClientFields);
        }

        @JsonAnySetter
        public void captureUnknownField(String name, Object value) {
            if (ChartSupportDiseaseModV3Request.isForbiddenClientAuthorityField(name)) {
                forbiddenClientFields.add(name);
            }
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
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

    @JsonIgnoreProperties(ignoreUnknown = true)
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
}
