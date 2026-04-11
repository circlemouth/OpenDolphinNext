package open.dolphin.rest.dto.orca;

public class ChartSupportIncomeInfoRequest {

    private String patientId;
    private String performDate;
    private String performMonth;
    private String performYear;

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

    public String getPerformMonth() {
        return performMonth;
    }

    public void setPerformMonth(String performMonth) {
        this.performMonth = performMonth;
    }

    public String getPerformYear() {
        return performYear;
    }

    public void setPerformYear(String performYear) {
        this.performYear = performYear;
    }
}
