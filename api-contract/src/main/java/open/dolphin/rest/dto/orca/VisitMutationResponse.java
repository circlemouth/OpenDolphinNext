package open.dolphin.rest.dto.orca;

import java.util.ArrayList;
import java.util.List;

/**
 * Response payload for POST /orca/visits/mutation.
 */
public class VisitMutationResponse extends OrcaApiResponse {

    private String resKey;
    private String scheduleKey;
    private String encounterKey;
    private String acceptanceId;
    private String claimSendInfo;
    private String acceptanceDate;
    private String acceptanceTime;
    private String departmentCode;
    private String departmentName;
    private String physicianCode;
    private String physicianName;
    private String medicalInformation;
    private String insuranceCombinationNumber;
    private String voucherNumber;
    private String sequentialNumber;
    private String appointmentDate;
    private String visitNumber;
    private PatientSummary patient;
    private final List<String> warnings = new ArrayList<>();

    public String getResKey() {
        return resKey;
    }

    public void setResKey(String resKey) {
        this.resKey = resKey;
    }

    public String getScheduleKey() {
        return scheduleKey;
    }

    public void setScheduleKey(String scheduleKey) {
        this.scheduleKey = scheduleKey;
    }

    public String getEncounterKey() {
        return encounterKey;
    }

    public void setEncounterKey(String encounterKey) {
        this.encounterKey = encounterKey;
    }

    public String getAcceptanceId() {
        return acceptanceId;
    }

    public void setAcceptanceId(String acceptanceId) {
        this.acceptanceId = acceptanceId;
    }

    public String getClaimSendInfo() {
        return claimSendInfo;
    }

    public void setClaimSendInfo(String claimSendInfo) {
        this.claimSendInfo = claimSendInfo;
    }

    public String getAcceptanceDate() {
        return acceptanceDate;
    }

    public void setAcceptanceDate(String acceptanceDate) {
        this.acceptanceDate = acceptanceDate;
    }

    public String getAcceptanceTime() {
        return acceptanceTime;
    }

    public void setAcceptanceTime(String acceptanceTime) {
        this.acceptanceTime = acceptanceTime;
    }

    public String getDepartmentCode() {
        return departmentCode;
    }

    public void setDepartmentCode(String departmentCode) {
        this.departmentCode = departmentCode;
    }

    public String getDepartmentName() {
        return departmentName;
    }

    public void setDepartmentName(String departmentName) {
        this.departmentName = departmentName;
    }

    public String getPhysicianCode() {
        return physicianCode;
    }

    public void setPhysicianCode(String physicianCode) {
        this.physicianCode = physicianCode;
    }

    public String getPhysicianName() {
        return physicianName;
    }

    public void setPhysicianName(String physicianName) {
        this.physicianName = physicianName;
    }

    public String getMedicalInformation() {
        return medicalInformation;
    }

    public void setMedicalInformation(String medicalInformation) {
        this.medicalInformation = medicalInformation;
    }

    public String getInsuranceCombinationNumber() {
        return insuranceCombinationNumber;
    }

    public void setInsuranceCombinationNumber(String insuranceCombinationNumber) {
        this.insuranceCombinationNumber = insuranceCombinationNumber;
    }

    public String getVoucherNumber() {
        return voucherNumber;
    }

    public void setVoucherNumber(String voucherNumber) {
        this.voucherNumber = voucherNumber;
    }

    public String getSequentialNumber() {
        return sequentialNumber;
    }

    public void setSequentialNumber(String sequentialNumber) {
        this.sequentialNumber = sequentialNumber;
    }

    public String getAppointmentDate() {
        return appointmentDate;
    }

    public void setAppointmentDate(String appointmentDate) {
        this.appointmentDate = appointmentDate;
    }

    public String getVisitNumber() {
        return visitNumber;
    }

    public void setVisitNumber(String visitNumber) {
        this.visitNumber = visitNumber;
    }

    public PatientSummary getPatient() {
        return patient;
    }

    public void setPatient(PatientSummary patient) {
        this.patient = patient;
    }

    public List<String> getWarnings() {
        return warnings;
    }
}
