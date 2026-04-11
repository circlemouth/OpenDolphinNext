package open.dolphin.rest.dto.outpatient;

import java.util.ArrayList;
import java.util.List;

/**
 * Outpatient patient list response with audit/telemetry metadata.
 */
public class PatientOutpatientResponse {

    private String runId;
    private String traceId;
    private String requestId;
    private String routeNamespace;
    private String dataSource;
    private String dataSourceTransition;
    private boolean cacheHit;
    private boolean missingMaster;
    private boolean fallbackUsed;
    private String fetchedAt;
    private Integer recordsReturned;
    private String apiResult;
    private String apiResultMessage;
    private List<PatientRecord> patients = new ArrayList<>();
    private OutpatientFlagResponse.AuditEvent auditEvent;

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public String getRouteNamespace() {
        return routeNamespace;
    }

    public void setRouteNamespace(String routeNamespace) {
        this.routeNamespace = routeNamespace;
    }

    public String getDataSource() {
        return dataSource;
    }

    public void setDataSource(String dataSource) {
        this.dataSource = dataSource;
    }

    public String getDataSourceTransition() {
        return dataSourceTransition;
    }

    public void setDataSourceTransition(String dataSourceTransition) {
        this.dataSourceTransition = dataSourceTransition;
    }

    public boolean isCacheHit() {
        return cacheHit;
    }

    public void setCacheHit(boolean cacheHit) {
        this.cacheHit = cacheHit;
    }

    public boolean isMissingMaster() {
        return missingMaster;
    }

    public void setMissingMaster(boolean missingMaster) {
        this.missingMaster = missingMaster;
    }

    public boolean isFallbackUsed() {
        return fallbackUsed;
    }

    public void setFallbackUsed(boolean fallbackUsed) {
        this.fallbackUsed = fallbackUsed;
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

    public String getApiResult() {
        return apiResult;
    }

    public void setApiResult(String apiResult) {
        this.apiResult = apiResult;
    }

    public String getApiResultMessage() {
        return apiResultMessage;
    }

    public void setApiResultMessage(String apiResultMessage) {
        this.apiResultMessage = apiResultMessage;
    }

    public List<PatientRecord> getPatients() {
        return patients;
    }

    public void setPatients(List<PatientRecord> patients) {
        this.patients = patients != null ? patients : new ArrayList<>();
    }

    public OutpatientFlagResponse.AuditEvent getAuditEvent() {
        return auditEvent;
    }

    public void setAuditEvent(OutpatientFlagResponse.AuditEvent auditEvent) {
        this.auditEvent = auditEvent;
    }

    public static class PatientRecord {
        private String patientId;
        private String name;
        private String kana;
        private String birthDate;
        private String sex;
        private String phone;
        private String zip;
        private String address;
        private String insurance;
        private String memo;
        private String lastVisit;

        public String getPatientId() {
            return patientId;
        }

        public void setPatientId(String patientId) {
            this.patientId = patientId;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getKana() {
            return kana;
        }

        public void setKana(String kana) {
            this.kana = kana;
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

        public String getPhone() {
            return phone;
        }

        public void setPhone(String phone) {
            this.phone = phone;
        }

        public String getZip() {
            return zip;
        }

        public void setZip(String zip) {
            this.zip = zip;
        }

        public String getAddress() {
            return address;
        }

        public void setAddress(String address) {
            this.address = address;
        }

        public String getInsurance() {
            return insurance;
        }

        public void setInsurance(String insurance) {
            this.insurance = insurance;
        }

        public String getMemo() {
            return memo;
        }

        public void setMemo(String memo) {
            this.memo = memo;
        }

        public String getLastVisit() {
            return lastVisit;
        }

        public void setLastVisit(String lastVisit) {
            this.lastVisit = lastVisit;
        }
    }
}
