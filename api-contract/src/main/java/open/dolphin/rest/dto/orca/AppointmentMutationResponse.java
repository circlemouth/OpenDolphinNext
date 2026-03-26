package open.dolphin.rest.dto.orca;

import java.util.ArrayList;
import java.util.List;

/**
 * Response payload for POST /orca/appointments/mutation.
 */
public class AppointmentMutationResponse extends OrcaApiResponse {

    private String resKey;
    private String scheduleKey;
    private String encounterKey;
    private String appointmentId;
    private String appointmentDate;
    private String appointmentTime;
    private String departmentCode;
    private String departmentName;
    private String physicianCode;
    private String physicianName;
    private String medicalInformation;
    private String appointmentInformation;
    private String appointmentNote;
    private String visitInformation;
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

    public String getAppointmentId() {
        return appointmentId;
    }

    public void setAppointmentId(String appointmentId) {
        this.appointmentId = appointmentId;
    }

    public String getAppointmentDate() {
        return appointmentDate;
    }

    public void setAppointmentDate(String appointmentDate) {
        this.appointmentDate = appointmentDate;
    }

    public String getAppointmentTime() {
        return appointmentTime;
    }

    public void setAppointmentTime(String appointmentTime) {
        this.appointmentTime = appointmentTime;
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

    public String getAppointmentInformation() {
        return appointmentInformation;
    }

    public void setAppointmentInformation(String appointmentInformation) {
        this.appointmentInformation = appointmentInformation;
    }

    public String getAppointmentNote() {
        return appointmentNote;
    }

    public void setAppointmentNote(String appointmentNote) {
        this.appointmentNote = appointmentNote;
    }

    public String getVisitInformation() {
        return visitInformation;
    }

    public void setVisitInformation(String visitInformation) {
        this.visitInformation = visitInformation;
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
