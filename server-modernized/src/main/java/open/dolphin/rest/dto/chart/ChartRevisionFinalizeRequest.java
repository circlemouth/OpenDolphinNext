package open.dolphin.rest.dto.chart;

public class ChartRevisionFinalizeRequest {

    private String orcaPatientId;
    private String patientName;
    private String patientBirthDate;
    private String patientGender;
    private String encounterId;
    private String encounterDate;
    private String orcaAcceptanceId;
    private String noAcceptanceReason;
    private String departmentCode;
    private String physicianCode;
    private String insuranceCombinationNumber;
    private Long finalizedByUserId;
    private String contentJson;

    public String getOrcaPatientId() {
        return orcaPatientId;
    }

    public void setOrcaPatientId(String orcaPatientId) {
        this.orcaPatientId = orcaPatientId;
    }

    public String getPatientName() {
        return patientName;
    }

    public void setPatientName(String patientName) {
        this.patientName = patientName;
    }

    public String getPatientBirthDate() {
        return patientBirthDate;
    }

    public void setPatientBirthDate(String patientBirthDate) {
        this.patientBirthDate = patientBirthDate;
    }

    public String getPatientGender() {
        return patientGender;
    }

    public void setPatientGender(String patientGender) {
        this.patientGender = patientGender;
    }

    public String getEncounterId() {
        return encounterId;
    }

    public void setEncounterId(String encounterId) {
        this.encounterId = encounterId;
    }

    public String getEncounterDate() {
        return encounterDate;
    }

    public void setEncounterDate(String encounterDate) {
        this.encounterDate = encounterDate;
    }

    public String getOrcaAcceptanceId() {
        return orcaAcceptanceId;
    }

    public void setOrcaAcceptanceId(String orcaAcceptanceId) {
        this.orcaAcceptanceId = orcaAcceptanceId;
    }

    public String getNoAcceptanceReason() {
        return noAcceptanceReason;
    }

    public void setNoAcceptanceReason(String noAcceptanceReason) {
        this.noAcceptanceReason = noAcceptanceReason;
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

    public Long getFinalizedByUserId() {
        return finalizedByUserId;
    }

    public void setFinalizedByUserId(Long finalizedByUserId) {
        this.finalizedByUserId = finalizedByUserId;
    }

    public String getContentJson() {
        return contentJson;
    }

    public void setContentJson(String contentJson) {
        this.contentJson = contentJson;
    }
}
