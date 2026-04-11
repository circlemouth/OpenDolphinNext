package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Request payload for POST /api/local/charts/medical-records.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class MedicalGetRequest {

    private String patientId;
    private String fromDate;
    private String toDate;
    private Integer performMonths;
    private String departmentCode;
    private String sequentialNumber;
    private String insuranceCombinationNumber;
    private boolean includeVisitStatus;

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getFromDate() {
        return fromDate;
    }

    public void setFromDate(String fromDate) {
        this.fromDate = fromDate;
    }

    public String getToDate() {
        return toDate;
    }

    public void setToDate(String toDate) {
        this.toDate = toDate;
    }

    public Integer getPerformMonths() {
        return performMonths;
    }

    public void setPerformMonths(Integer performMonths) {
        this.performMonths = performMonths;
    }

    public String getDepartmentCode() {
        return departmentCode;
    }

    public void setDepartmentCode(String departmentCode) {
        this.departmentCode = departmentCode;
    }

    public String getSequentialNumber() {
        return sequentialNumber;
    }

    public void setSequentialNumber(String sequentialNumber) {
        this.sequentialNumber = sequentialNumber;
    }

    public String getInsuranceCombinationNumber() {
        return insuranceCombinationNumber;
    }

    public void setInsuranceCombinationNumber(String insuranceCombinationNumber) {
        this.insuranceCombinationNumber = insuranceCombinationNumber;
    }

    public boolean isIncludeVisitStatus() {
        return includeVisitStatus;
    }

    public void setIncludeVisitStatus(boolean includeVisitStatus) {
        this.includeVisitStatus = includeVisitStatus;
    }
}
