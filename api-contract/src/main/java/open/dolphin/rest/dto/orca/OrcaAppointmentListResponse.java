package open.dolphin.rest.dto.orca;

import java.util.ArrayList;
import java.util.List;

/**
 * Response for appointment list wrapper.
 */
public class OrcaAppointmentListResponse extends OrcaApiResponse {

    private String appointmentDate;
    private final List<AppointmentSlot> slots = new ArrayList<>();

    public String getAppointmentDate() {
        return appointmentDate;
    }

    public void setAppointmentDate(String appointmentDate) {
        this.appointmentDate = appointmentDate;
    }

    public List<AppointmentSlot> getSlots() {
        return slots;
    }

    public static class AppointmentSlot {
        private String scheduleKey;
        private String encounterKey;
        private String appointmentTime;
        private String medicalInformation;
        private String departmentCode;
        private String departmentName;
        private String physicianCode;
        private String physicianName;
        private String visitInformation;
        private String appointmentId;
        private PatientSummary patient;

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

        public String getAppointmentTime() {
            return appointmentTime;
        }

        public void setAppointmentTime(String appointmentTime) {
            this.appointmentTime = appointmentTime;
        }

        public String getMedicalInformation() {
            return medicalInformation;
        }

        public void setMedicalInformation(String medicalInformation) {
            this.medicalInformation = medicalInformation;
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

        public String getVisitInformation() {
            return visitInformation;
        }

        public void setVisitInformation(String visitInformation) {
            this.visitInformation = visitInformation;
        }

        public String getAppointmentId() {
            return appointmentId;
        }

        public void setAppointmentId(String appointmentId) {
            this.appointmentId = appointmentId;
        }

        public PatientSummary getPatient() {
            return patient;
        }

        public void setPatient(PatientSummary patient) {
            this.patient = patient;
        }
    }
}
