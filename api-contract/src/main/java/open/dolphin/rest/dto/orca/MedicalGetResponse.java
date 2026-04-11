package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Response payload for POST /api/local/charts/medical-records.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MedicalGetResponse extends OrcaApiResponse {

    private String generatedAt;
    private PatientSummary patient;
    private List<MedicalRecordEntry> records;
    private List<String> warnings;

    public static MedicalGetResponse success(String runId) {
        MedicalGetResponse response = new MedicalGetResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setGeneratedAt(Instant.now().toString());
        response.setRecords(new ArrayList<>());
        return response;
    }

    public String getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(String generatedAt) {
        this.generatedAt = generatedAt;
    }

    public PatientSummary getPatient() {
        return patient;
    }

    public void setPatient(PatientSummary patient) {
        this.patient = patient;
    }

    public List<MedicalRecordEntry> getRecords() {
        return records;
    }

    public void setRecords(List<MedicalRecordEntry> records) {
        this.records = records;
    }

    public List<String> getWarnings() {
        return warnings;
    }

    public void setWarnings(List<String> warnings) {
        this.warnings = warnings;
    }

    public void addRecord(MedicalRecordEntry entry) {
        if (records == null) {
            records = new ArrayList<>();
        }
        records.add(entry);
    }

    public void addWarning(String warning) {
        if (warnings == null) {
            warnings = new ArrayList<>();
        }
        warnings.add(warning);
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PatientSummary {
        private String patientId;
        private String wholeName;
        private String wholeNameKana;
        private String birthDate;
        private String sex;

        public String getPatientId() {
            return patientId;
        }

        public void setPatientId(String patientId) {
            this.patientId = patientId;
        }

        public String getWholeName() {
            return wholeName;
        }

        public void setWholeName(String wholeName) {
            this.wholeName = wholeName;
        }

        public String getWholeNameKana() {
            return wholeNameKana;
        }

        public void setWholeNameKana(String wholeNameKana) {
            this.wholeNameKana = wholeNameKana;
        }

        public String getBirthDate() {
            return birthDate;
        }

        public void setBirthDate(String birthDate) {
            this.birthDate = birthDate;
        }

        public String getSex() {
            return sex;
        }

        public void setSex(String sex) {
            this.sex = sex;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MedicalRecordEntry {
        private String performDate;
        private String departmentCode;
        private String departmentName;
        private String sequentialNumber;
        private String insuranceCombinationNumber;
        private String documentId;
        private String documentStatus;
        private String lastUpdated;

        public String getPerformDate() {
            return performDate;
        }

        public void setPerformDate(String performDate) {
            this.performDate = performDate;
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

        public String getDocumentId() {
            return documentId;
        }

        public void setDocumentId(String documentId) {
            this.documentId = documentId;
        }

        public String getDocumentStatus() {
            return documentStatus;
        }

        public void setDocumentStatus(String documentStatus) {
            this.documentStatus = documentStatus;
        }

        public String getLastUpdated() {
            return lastUpdated;
        }

        public void setLastUpdated(String lastUpdated) {
            this.lastUpdated = lastUpdated;
        }
    }
}
