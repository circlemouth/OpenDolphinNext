package open.dolphin.rest.dto.orca;

import java.util.ArrayList;
import java.util.List;

public class OrcaMedicalCandidateResponse {

    private String apiResult;
    private String apiResultMessage;
    private String runId;
    private long candidateId;
    private String candidateStatus;
    private boolean sendable;
    private boolean nonAuthoritative = true;
    private String patientId;
    private String encounterId;
    private String chartRevisionId;
    private long prescriptionId;
    private long prescriptionRevisionId;
    private String prescriptionContentHash;
    private List<PrescriptionHistoryEvent> prescriptionHistory = new ArrayList<>();
    private List<ChartSupportMedicalModV2Request.MedicalInformation> medicalInformation = new ArrayList<>();
    private List<Issue> issues = new ArrayList<>();

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

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public long getCandidateId() {
        return candidateId;
    }

    public void setCandidateId(long candidateId) {
        this.candidateId = candidateId;
    }

    public String getCandidateStatus() {
        return candidateStatus;
    }

    public void setCandidateStatus(String candidateStatus) {
        this.candidateStatus = candidateStatus;
    }

    public boolean isSendable() {
        return sendable;
    }

    public void setSendable(boolean sendable) {
        this.sendable = sendable;
    }

    public boolean isNonAuthoritative() {
        return nonAuthoritative;
    }

    public void setNonAuthoritative(boolean nonAuthoritative) {
        this.nonAuthoritative = nonAuthoritative;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getEncounterId() {
        return encounterId;
    }

    public void setEncounterId(String encounterId) {
        this.encounterId = encounterId;
    }

    public String getChartRevisionId() {
        return chartRevisionId;
    }

    public void setChartRevisionId(String chartRevisionId) {
        this.chartRevisionId = chartRevisionId;
    }

    public long getPrescriptionId() {
        return prescriptionId;
    }

    public void setPrescriptionId(long prescriptionId) {
        this.prescriptionId = prescriptionId;
    }

    public long getPrescriptionRevisionId() {
        return prescriptionRevisionId;
    }

    public void setPrescriptionRevisionId(long prescriptionRevisionId) {
        this.prescriptionRevisionId = prescriptionRevisionId;
    }

    public String getPrescriptionContentHash() {
        return prescriptionContentHash;
    }

    public void setPrescriptionContentHash(String prescriptionContentHash) {
        this.prescriptionContentHash = prescriptionContentHash;
    }

    public List<PrescriptionHistoryEvent> getPrescriptionHistory() {
        return prescriptionHistory;
    }

    public void setPrescriptionHistory(List<PrescriptionHistoryEvent> prescriptionHistory) {
        this.prescriptionHistory = prescriptionHistory;
    }

    public List<ChartSupportMedicalModV2Request.MedicalInformation> getMedicalInformation() {
        return medicalInformation;
    }

    public void setMedicalInformation(List<ChartSupportMedicalModV2Request.MedicalInformation> medicalInformation) {
        this.medicalInformation = medicalInformation;
    }

    public List<Issue> getIssues() {
        return issues;
    }

    public void setIssues(List<Issue> issues) {
        this.issues = issues;
    }

    public static class Issue {
        private String code;
        private String message;
        private Integer rpSequence;
        private Integer itemSequence;

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public Integer getRpSequence() {
            return rpSequence;
        }

        public void setRpSequence(Integer rpSequence) {
            this.rpSequence = rpSequence;
        }

        public Integer getItemSequence() {
            return itemSequence;
        }

        public void setItemSequence(Integer itemSequence) {
            this.itemSequence = itemSequence;
        }
    }

    public static class PrescriptionHistoryEvent {
        private long prescriptionEventId;
        private long prescriptionRevisionId;
        private Integer revisionNumber;
        private String revisionStatus;
        private String eventType;
        private String reasonCode;
        private String reasonText;
        private String actorUserId;
        private String occurredAt;
        private String contentHash;
        private String eventHash;
        private String previousEventHash;

        public long getPrescriptionEventId() {
            return prescriptionEventId;
        }

        public void setPrescriptionEventId(long prescriptionEventId) {
            this.prescriptionEventId = prescriptionEventId;
        }

        public long getPrescriptionRevisionId() {
            return prescriptionRevisionId;
        }

        public void setPrescriptionRevisionId(long prescriptionRevisionId) {
            this.prescriptionRevisionId = prescriptionRevisionId;
        }

        public Integer getRevisionNumber() {
            return revisionNumber;
        }

        public void setRevisionNumber(Integer revisionNumber) {
            this.revisionNumber = revisionNumber;
        }

        public String getRevisionStatus() {
            return revisionStatus;
        }

        public void setRevisionStatus(String revisionStatus) {
            this.revisionStatus = revisionStatus;
        }

        public String getEventType() {
            return eventType;
        }

        public void setEventType(String eventType) {
            this.eventType = eventType;
        }

        public String getReasonCode() {
            return reasonCode;
        }

        public void setReasonCode(String reasonCode) {
            this.reasonCode = reasonCode;
        }

        public String getReasonText() {
            return reasonText;
        }

        public void setReasonText(String reasonText) {
            this.reasonText = reasonText;
        }

        public String getActorUserId() {
            return actorUserId;
        }

        public void setActorUserId(String actorUserId) {
            this.actorUserId = actorUserId;
        }

        public String getOccurredAt() {
            return occurredAt;
        }

        public void setOccurredAt(String occurredAt) {
            this.occurredAt = occurredAt;
        }

        public String getContentHash() {
            return contentHash;
        }

        public void setContentHash(String contentHash) {
            this.contentHash = contentHash;
        }

        public String getEventHash() {
            return eventHash;
        }

        public void setEventHash(String eventHash) {
            this.eventHash = eventHash;
        }

        public String getPreviousEventHash() {
            return previousEventHash;
        }

        public void setPreviousEventHash(String previousEventHash) {
            this.previousEventHash = previousEventHash;
        }
    }
}
