package open.dolphin.rest.dto.localsummary;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class LocalMedicalSummaryResponse {

    private String requestId;
    private String traceId;
    private String runId;
    private String fetchedAt;
    private Integer recordsReturned;
    private String outcome;
    private String sourcePath;
    private Payload payload = new Payload();

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public String getFetchedAt() {
        return fetchedAt;
    }

    public void setFetchedAt(String fetchedAt) {
        this.fetchedAt = fetchedAt;
    }

    public Integer getRecordsReturned() {
        return recordsReturned;
    }

    public void setRecordsReturned(Integer recordsReturned) {
        this.recordsReturned = recordsReturned;
    }

    public String getOutcome() {
        return outcome;
    }

    public void setOutcome(String outcome) {
        this.outcome = outcome;
    }

    public String getSourcePath() {
        return sourcePath;
    }

    public void setSourcePath(String sourcePath) {
        this.sourcePath = sourcePath;
    }

    public Payload getPayload() {
        return payload;
    }

    public void setPayload(Payload payload) {
        this.payload = payload != null ? payload : new Payload();
    }

    public static class Payload {
        private List<MedicalSummaryItem> outpatientList = new ArrayList<>();
        private OrcaContext orcaContext;

        public List<MedicalSummaryItem> getOutpatientList() {
            return outpatientList;
        }

        public void setOutpatientList(List<MedicalSummaryItem> outpatientList) {
            this.outpatientList = outpatientList != null ? outpatientList : new ArrayList<>();
        }

        public OrcaContext getOrcaContext() {
            return orcaContext;
        }

        public void setOrcaContext(OrcaContext orcaContext) {
            this.orcaContext = orcaContext;
        }
    }

    public static class MedicalSummaryItem {
        private String encounterKey;
        private String scheduleKey;
        private PatientSummary patient;
        private String department;
        private String physician;
        private Integer recordsReturned;
        private String outcome;
        private Map<String, MedicalSection> sections = new LinkedHashMap<>();

        public String getEncounterKey() {
            return encounterKey;
        }

        public void setEncounterKey(String encounterKey) {
            this.encounterKey = encounterKey;
        }

        public String getScheduleKey() {
            return scheduleKey;
        }

        public void setScheduleKey(String scheduleKey) {
            this.scheduleKey = scheduleKey;
        }

        public PatientSummary getPatient() {
            return patient;
        }

        public void setPatient(PatientSummary patient) {
            this.patient = patient;
        }

        public String getDepartment() {
            return department;
        }

        public void setDepartment(String department) {
            this.department = department;
        }

        public String getPhysician() {
            return physician;
        }

        public void setPhysician(String physician) {
            this.physician = physician;
        }

        public Integer getRecordsReturned() {
            return recordsReturned;
        }

        public void setRecordsReturned(Integer recordsReturned) {
            this.recordsReturned = recordsReturned;
        }

        public String getOutcome() {
            return outcome;
        }

        public void setOutcome(String outcome) {
            this.outcome = outcome;
        }

        public Map<String, MedicalSection> getSections() {
            return sections;
        }

        public void setSections(Map<String, MedicalSection> sections) {
            this.sections = sections != null ? sections : new LinkedHashMap<>();
        }
    }

    public static class PatientSummary {
        private String patientId;
        private String wholeName;

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
    }

    public static class OrcaContext {
        private String encounterKey;
        private String orcaAcceptanceId;
        private String acceptanceDate;
        private String acceptanceTime;
        private String departmentCode;
        private String physicianCode;
        private String insuranceCombinationNumber;
        private String linkStatus;
        private String warningStatus;
        private List<String> changedFields = new ArrayList<>();
        private String cacheFetchedAt;
        private String cacheExpiresAt;
        private String patientCacheStatus;
        private String patientBusinessStatus;
        private String patientWarningStatus;
        private String patientCacheFetchedAt;
        private String patientCacheExpiresAt;
        private String insuranceCacheStatus;
        private String insuranceWarningStatus;
        private List<String> insuranceChangedFields = new ArrayList<>();
        private String insuranceCacheFetchedAt;
        private String insuranceCacheExpiresAt;

        public String getEncounterKey() {
            return encounterKey;
        }

        public void setEncounterKey(String encounterKey) {
            this.encounterKey = encounterKey;
        }

        public String getOrcaAcceptanceId() {
            return orcaAcceptanceId;
        }

        public void setOrcaAcceptanceId(String orcaAcceptanceId) {
            this.orcaAcceptanceId = orcaAcceptanceId;
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

        public String getLinkStatus() {
            return linkStatus;
        }

        public void setLinkStatus(String linkStatus) {
            this.linkStatus = linkStatus;
        }

        public String getWarningStatus() {
            return warningStatus;
        }

        public void setWarningStatus(String warningStatus) {
            this.warningStatus = warningStatus;
        }

        public List<String> getChangedFields() {
            return changedFields;
        }

        public void setChangedFields(List<String> changedFields) {
            this.changedFields = changedFields != null ? changedFields : new ArrayList<>();
        }

        public String getCacheFetchedAt() {
            return cacheFetchedAt;
        }

        public void setCacheFetchedAt(String cacheFetchedAt) {
            this.cacheFetchedAt = cacheFetchedAt;
        }

        public String getCacheExpiresAt() {
            return cacheExpiresAt;
        }

        public void setCacheExpiresAt(String cacheExpiresAt) {
            this.cacheExpiresAt = cacheExpiresAt;
        }

        public String getPatientCacheStatus() {
            return patientCacheStatus;
        }

        public void setPatientCacheStatus(String patientCacheStatus) {
            this.patientCacheStatus = patientCacheStatus;
        }

        public String getPatientBusinessStatus() {
            return patientBusinessStatus;
        }

        public void setPatientBusinessStatus(String patientBusinessStatus) {
            this.patientBusinessStatus = patientBusinessStatus;
        }

        public String getPatientWarningStatus() {
            return patientWarningStatus;
        }

        public void setPatientWarningStatus(String patientWarningStatus) {
            this.patientWarningStatus = patientWarningStatus;
        }

        public String getPatientCacheFetchedAt() {
            return patientCacheFetchedAt;
        }

        public void setPatientCacheFetchedAt(String patientCacheFetchedAt) {
            this.patientCacheFetchedAt = patientCacheFetchedAt;
        }

        public String getPatientCacheExpiresAt() {
            return patientCacheExpiresAt;
        }

        public void setPatientCacheExpiresAt(String patientCacheExpiresAt) {
            this.patientCacheExpiresAt = patientCacheExpiresAt;
        }

        public String getInsuranceCacheStatus() {
            return insuranceCacheStatus;
        }

        public void setInsuranceCacheStatus(String insuranceCacheStatus) {
            this.insuranceCacheStatus = insuranceCacheStatus;
        }

        public String getInsuranceWarningStatus() {
            return insuranceWarningStatus;
        }

        public void setInsuranceWarningStatus(String insuranceWarningStatus) {
            this.insuranceWarningStatus = insuranceWarningStatus;
        }

        public List<String> getInsuranceChangedFields() {
            return insuranceChangedFields;
        }

        public void setInsuranceChangedFields(List<String> insuranceChangedFields) {
            this.insuranceChangedFields = insuranceChangedFields != null ? insuranceChangedFields : new ArrayList<>();
        }

        public String getInsuranceCacheFetchedAt() {
            return insuranceCacheFetchedAt;
        }

        public void setInsuranceCacheFetchedAt(String insuranceCacheFetchedAt) {
            this.insuranceCacheFetchedAt = insuranceCacheFetchedAt;
        }

        public String getInsuranceCacheExpiresAt() {
            return insuranceCacheExpiresAt;
        }

        public void setInsuranceCacheExpiresAt(String insuranceCacheExpiresAt) {
            this.insuranceCacheExpiresAt = insuranceCacheExpiresAt;
        }
    }

    public static class MedicalSection {
        private String outcome;
        private Integer recordsReturned;
        private String message;
        private List<MedicalSectionItem> items = new ArrayList<>();

        public String getOutcome() {
            return outcome;
        }

        public void setOutcome(String outcome) {
            this.outcome = outcome;
        }

        public Integer getRecordsReturned() {
            return recordsReturned;
        }

        public void setRecordsReturned(Integer recordsReturned) {
            this.recordsReturned = recordsReturned;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public List<MedicalSectionItem> getItems() {
            return items;
        }

        public void setItems(List<MedicalSectionItem> items) {
            this.items = items != null ? items : new ArrayList<>();
        }
    }

    public static class MedicalSectionItem {
        private String name;
        private String code;
        private String date;
        private String status;
        private String dose;
        private String frequency;
        private String days;
        private String result;
        private String value;
        private String unit;
        private String text;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getDate() {
            return date;
        }

        public void setDate(String date) {
            this.date = date;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public String getDose() {
            return dose;
        }

        public void setDose(String dose) {
            this.dose = dose;
        }

        public String getFrequency() {
            return frequency;
        }

        public void setFrequency(String frequency) {
            this.frequency = frequency;
        }

        public String getDays() {
            return days;
        }

        public void setDays(String days) {
            this.days = days;
        }

        public String getResult() {
            return result;
        }

        public void setResult(String result) {
            this.result = result;
        }

        public String getValue() {
            return value;
        }

        public void setValue(String value) {
            this.value = value;
        }

        public String getUnit() {
            return unit;
        }

        public void setUnit(String unit) {
            this.unit = unit;
        }

        public String getText() {
            return text;
        }

        public void setText(String text) {
            this.text = text;
        }
    }
}
