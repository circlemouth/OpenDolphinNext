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
    private String performDate;
    private String performTime;
    private String departmentCode;
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
        private String diseaseStartDate;
        private String diseaseEndDate;
        private String diseaseInOut;
        private String diseaseSuspectedFlag;
        private String diseaseOutCome;
        private String insuranceCombinationNumber;
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

        public String getInsuranceCombinationNumber() {
            return insuranceCombinationNumber;
        }

        public void setInsuranceCombinationNumber(String insuranceCombinationNumber) {
            this.insuranceCombinationNumber = insuranceCombinationNumber;
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
}
