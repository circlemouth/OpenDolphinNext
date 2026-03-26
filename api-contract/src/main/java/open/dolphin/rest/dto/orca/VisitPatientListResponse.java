package open.dolphin.rest.dto.orca;

import java.util.ArrayList;
import java.util.List;

/**
 * Response payload for visit list wrapper.
 */
public class VisitPatientListResponse extends OrcaApiResponse {

    private String visitDate;
    private final List<VisitEntry> visits = new ArrayList<>();

    public String getVisitDate() {
        return visitDate;
    }

    public void setVisitDate(String visitDate) {
        this.visitDate = visitDate;
    }

    public List<VisitEntry> getVisits() {
        return visits;
    }

    public static class VisitEntry {
        private String scheduleKey;
        private String encounterKey;
        private String departmentCode;
        private String departmentName;
        private String physicianCode;
        private String physicianName;
        private String voucherNumber;
        private String sequentialNumber;
        private String insuranceCombinationNumber;
        private String updateDate;
        private String updateTime;
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

        public String getInsuranceCombinationNumber() {
            return insuranceCombinationNumber;
        }

        public void setInsuranceCombinationNumber(String insuranceCombinationNumber) {
            this.insuranceCombinationNumber = insuranceCombinationNumber;
        }

        public String getUpdateDate() {
            return updateDate;
        }

        public void setUpdateDate(String updateDate) {
            this.updateDate = updateDate;
        }

        public String getUpdateTime() {
            return updateTime;
        }

        public void setUpdateTime(String updateTime) {
            this.updateTime = updateTime;
        }

        public PatientSummary getPatient() {
            return patient;
        }

        public void setPatient(PatientSummary patient) {
            this.patient = patient;
        }
    }
}
