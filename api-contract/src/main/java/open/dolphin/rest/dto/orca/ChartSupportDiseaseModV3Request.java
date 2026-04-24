package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ChartSupportDiseaseModV3Request {

    private String patientId;
    private String performDate;
    private String performTime;
    private String departmentCode;
    private String requestNumber;
    private List<DiseaseInformation> diseaseInformation = new ArrayList<>();

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

    public List<DiseaseInformation> getDiseaseInformation() {
        return diseaseInformation;
    }

    public void setDiseaseInformation(List<DiseaseInformation> diseaseInformation) {
        this.diseaseInformation = diseaseInformation;
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
    }
}
