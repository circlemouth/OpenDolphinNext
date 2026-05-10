package open.dolphin.rest.dto.orca;

import java.util.ArrayList;
import java.util.List;

public class BillingOrcaTransmissionReviewListResponse {

    private boolean ok;
    private List<Entry> entries = new ArrayList<>();
    private int limit;
    private int count;
    private String runId;
    private String traceId;

    public boolean isOk() {
        return ok;
    }

    public void setOk(boolean ok) {
        this.ok = ok;
    }

    public List<Entry> getEntries() {
        return entries;
    }

    public void setEntries(List<Entry> entries) {
        this.entries = entries != null ? entries : new ArrayList<>();
        this.count = this.entries.size();
    }

    public int getLimit() {
        return limit;
    }

    public void setLimit(int limit) {
        this.limit = limit;
    }

    public int getCount() {
        return count;
    }

    public void setCount(int count) {
        this.count = count;
    }

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

    public static class Entry {
        private Long transmissionId;
        private Long snapshotId;
        private String encounterKey;
        private String scheduleKey;
        private String patientId;
        private String state;
        private String operationStatus;
        private boolean needsUserReview;
        private boolean confirmationRequired;
        private String idempotencyKey;
        private boolean medicalUidPresent;
        private String apiResult;
        private String apiResultMessage;
        private Integer httpStatus;
        private String startedAt;
        private String completedAt;
        private String requestId;
        private String traceId;

        public Long getTransmissionId() {
            return transmissionId;
        }

        public void setTransmissionId(Long transmissionId) {
            this.transmissionId = transmissionId;
        }

        public Long getSnapshotId() {
            return snapshotId;
        }

        public void setSnapshotId(Long snapshotId) {
            this.snapshotId = snapshotId;
        }

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

        public String getPatientId() {
            return patientId;
        }

        public void setPatientId(String patientId) {
            this.patientId = patientId;
        }

        public String getState() {
            return state;
        }

        public void setState(String state) {
            this.state = state;
        }

        public String getOperationStatus() {
            return operationStatus;
        }

        public void setOperationStatus(String operationStatus) {
            this.operationStatus = operationStatus;
        }

        public boolean isNeedsUserReview() {
            return needsUserReview;
        }

        public void setNeedsUserReview(boolean needsUserReview) {
            this.needsUserReview = needsUserReview;
        }

        public boolean isConfirmationRequired() {
            return confirmationRequired;
        }

        public void setConfirmationRequired(boolean confirmationRequired) {
            this.confirmationRequired = confirmationRequired;
        }

        public String getIdempotencyKey() {
            return idempotencyKey;
        }

        public void setIdempotencyKey(String idempotencyKey) {
            this.idempotencyKey = idempotencyKey;
        }

        public boolean isMedicalUidPresent() {
            return medicalUidPresent;
        }

        public void setMedicalUidPresent(boolean medicalUidPresent) {
            this.medicalUidPresent = medicalUidPresent;
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

        public Integer getHttpStatus() {
            return httpStatus;
        }

        public void setHttpStatus(Integer httpStatus) {
            this.httpStatus = httpStatus;
        }

        public String getStartedAt() {
            return startedAt;
        }

        public void setStartedAt(String startedAt) {
            this.startedAt = startedAt;
        }

        public String getCompletedAt() {
            return completedAt;
        }

        public void setCompletedAt(String completedAt) {
            this.completedAt = completedAt;
        }

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
    }
}
