package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * Request payload for POST /orca/disease and /orca/disease/v3.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class DiseaseMutationRequest {

    private String patientId;
    private String baseMonth;
    private String performDate;
    private String performTime;
    private String departmentCode;
    private String physicianCode;
    private String insuranceCombinationNumber;
    private List<MutationEntry> operations;

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

    public List<MutationEntry> getOperations() {
        return operations;
    }

    public void setOperations(List<MutationEntry> operations) {
        this.operations = operations;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class MutationEntry {
        private String operation; // create/update/delete
        private Long diagnosisId;
        private String diagnosisName;
        private String diagnosisCode;
        private String karteName;
        private String departmentCode;
        private String physicianCode;
        private String insuranceCombinationNumber;
        private String baseMonth;
        private String performDate;
        private String startDate;
        private String endDate;
        private String outcome;
        private String category;
        private String diseaseClass;
        private String diseaseReceiptPrint;
        private String diseaseReceiptPrintPeriod;
        private String insuranceDisease;
        private String dischargeCertificate;
        private String mainDiseaseClass;
        private String subDiseaseClass;
        private String suspectedFlag;
        private String note;
        private List<DiseaseComponent> components;
        private List<DiseaseSupplement> supplements;

        public String getOperation() {
            return operation;
        }

        public void setOperation(String operation) {
            this.operation = operation;
        }

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

        public String getDiseaseClass() {
            return diseaseClass;
        }

        public void setDiseaseClass(String diseaseClass) {
            this.diseaseClass = diseaseClass;
        }

        public String getDiseaseReceiptPrint() {
            return diseaseReceiptPrint;
        }

        public void setDiseaseReceiptPrint(String diseaseReceiptPrint) {
            this.diseaseReceiptPrint = diseaseReceiptPrint;
        }

        public String getDiseaseReceiptPrintPeriod() {
            return diseaseReceiptPrintPeriod;
        }

        public void setDiseaseReceiptPrintPeriod(String diseaseReceiptPrintPeriod) {
            this.diseaseReceiptPrintPeriod = diseaseReceiptPrintPeriod;
        }

        public String getInsuranceDisease() {
            return insuranceDisease;
        }

        public void setInsuranceDisease(String insuranceDisease) {
            this.insuranceDisease = insuranceDisease;
        }

        public String getDischargeCertificate() {
            return dischargeCertificate;
        }

        public void setDischargeCertificate(String dischargeCertificate) {
            this.dischargeCertificate = dischargeCertificate;
        }

        public String getMainDiseaseClass() {
            return mainDiseaseClass;
        }

        public void setMainDiseaseClass(String mainDiseaseClass) {
            this.mainDiseaseClass = mainDiseaseClass;
        }

        public String getSubDiseaseClass() {
            return subDiseaseClass;
        }

        public void setSubDiseaseClass(String subDiseaseClass) {
            this.subDiseaseClass = subDiseaseClass;
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
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DiseaseComponent {
        private Integer seq;
        private String componentType;
        private String code;
        private String name;
        private String sourceMaster;

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
