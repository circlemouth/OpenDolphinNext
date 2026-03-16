package open.dolphin.rest.dto.orca;

public class ChartSupportMedicalModV23Request {

    private String patientId;
    private String requestNumber;
    private String firstCalculationDate;
    private String lastVisitDate;
    private String departmentCode;

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getRequestNumber() {
        return requestNumber;
    }

    public void setRequestNumber(String requestNumber) {
        this.requestNumber = requestNumber;
    }

    public String getFirstCalculationDate() {
        return firstCalculationDate;
    }

    public void setFirstCalculationDate(String firstCalculationDate) {
        this.firstCalculationDate = firstCalculationDate;
    }

    public String getLastVisitDate() {
        return lastVisitDate;
    }

    public void setLastVisitDate(String lastVisitDate) {
        this.lastVisitDate = lastVisitDate;
    }

    public String getDepartmentCode() {
        return departmentCode;
    }

    public void setDepartmentCode(String departmentCode) {
        this.departmentCode = departmentCode;
    }
}
