package open.dolphin.rest.dto.orca;

public class ChartSupportIncomeInfoRequest {

    private String patientId;
    private String baseDate;

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
}
