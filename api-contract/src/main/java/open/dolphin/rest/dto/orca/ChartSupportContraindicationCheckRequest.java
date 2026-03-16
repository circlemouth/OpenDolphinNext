package open.dolphin.rest.dto.orca;

import java.util.ArrayList;
import java.util.List;

public class ChartSupportContraindicationCheckRequest {

    private String patientId;
    private String performMonth;
    private String checkTerm;
    private String requestNumber;
    private List<Medication> medications = new ArrayList<>();

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getPerformMonth() {
        return performMonth;
    }

    public void setPerformMonth(String performMonth) {
        this.performMonth = performMonth;
    }

    public String getCheckTerm() {
        return checkTerm;
    }

    public void setCheckTerm(String checkTerm) {
        this.checkTerm = checkTerm;
    }

    public String getRequestNumber() {
        return requestNumber;
    }

    public void setRequestNumber(String requestNumber) {
        this.requestNumber = requestNumber;
    }

    public List<Medication> getMedications() {
        return medications;
    }

    public void setMedications(List<Medication> medications) {
        this.medications = medications;
    }

    public static class Medication {
        private String medicationCode;
        private String medicationName;

        public String getMedicationCode() {
            return medicationCode;
        }

        public void setMedicationCode(String medicationCode) {
            this.medicationCode = medicationCode;
        }

        public String getMedicationName() {
            return medicationName;
        }

        public void setMedicationName(String medicationName) {
            this.medicationName = medicationName;
        }
    }
}
