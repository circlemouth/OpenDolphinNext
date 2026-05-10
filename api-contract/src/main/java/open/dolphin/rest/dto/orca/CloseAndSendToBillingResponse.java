package open.dolphin.rest.dto.orca;

public class CloseAndSendToBillingResponse {

    private boolean ok;
    private String status;
    private String state;
    private String encounterKey;
    private String scheduleKey;
    private String patientId;
    private Long snapshotId;
    private Long transmissionId;
    private String idempotencyKey;
    private String medicalUid;
    private String apiResult;
    private String apiResultMessage;
    private String message;
    private boolean confirmationRequired;
    private boolean needsUserReview;
    private String operationStatus;
    private int orderBundleCount;
    private int medicalInformationCount;
    private int diseaseSyncCount;
    private String runId;
    private String traceId;

    public boolean isOk() {
        return ok;
    }

    public void setOk(boolean ok) {
        this.ok = ok;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
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

    public Long getSnapshotId() {
        return snapshotId;
    }

    public void setSnapshotId(Long snapshotId) {
        this.snapshotId = snapshotId;
    }

    public Long getTransmissionId() {
        return transmissionId;
    }

    public void setTransmissionId(Long transmissionId) {
        this.transmissionId = transmissionId;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public String getMedicalUid() {
        return medicalUid;
    }

    public void setMedicalUid(String medicalUid) {
        this.medicalUid = medicalUid;
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

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public boolean isConfirmationRequired() {
        return confirmationRequired;
    }

    public void setConfirmationRequired(boolean confirmationRequired) {
        this.confirmationRequired = confirmationRequired;
    }

    public boolean isNeedsUserReview() {
        return needsUserReview;
    }

    public void setNeedsUserReview(boolean needsUserReview) {
        this.needsUserReview = needsUserReview;
    }

    public String getOperationStatus() {
        return operationStatus;
    }

    public void setOperationStatus(String operationStatus) {
        this.operationStatus = operationStatus;
    }

    public int getOrderBundleCount() {
        return orderBundleCount;
    }

    public void setOrderBundleCount(int orderBundleCount) {
        this.orderBundleCount = orderBundleCount;
    }

    public int getMedicalInformationCount() {
        return medicalInformationCount;
    }

    public void setMedicalInformationCount(int medicalInformationCount) {
        this.medicalInformationCount = medicalInformationCount;
    }

    public int getDiseaseSyncCount() {
        return diseaseSyncCount;
    }

    public void setDiseaseSyncCount(int diseaseSyncCount) {
        this.diseaseSyncCount = diseaseSyncCount;
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
}
