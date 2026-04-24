package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ChartSupportSubjectivesModV2Request {

    private String patientId;
    private String performDate;
    private String inOut;
    private String departmentCode;
    private String insuranceCombinationNumber;
    private String subjectivesCode;
    private String subjectivesDetailRecord;

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

    public String getInOut() {
        return inOut;
    }

    public void setInOut(String inOut) {
        this.inOut = inOut;
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

    public String getSubjectivesCode() {
        return subjectivesCode;
    }

    public void setSubjectivesCode(String subjectivesCode) {
        this.subjectivesCode = subjectivesCode;
    }

    public String getSubjectivesDetailRecord() {
        return subjectivesDetailRecord;
    }

    public void setSubjectivesDetailRecord(String subjectivesDetailRecord) {
        this.subjectivesDetailRecord = subjectivesDetailRecord;
    }
}
