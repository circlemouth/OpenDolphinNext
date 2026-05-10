package open.dolphin.rest.dto.orca;

public class BillingOrcaTemporaryMedicalReconcileResponse {

    private boolean ok;
    private String runId;
    private String traceId;
    private Long transmissionId;
    private Long snapshotId;
    private String encounterKey;
    private String scheduleKey;
    private String patientId;
    private String requestClass;
    private String operationStatus;
    private boolean needsUserReview = true;
    private boolean rawSensitiveFieldsExcluded = true;
    private boolean clientProvidedIdentifiersTrusted;
    private boolean serverDerivedAuthorityRequired = true;
    private String apiResult;
    private String apiResultMessage;
    private Integer httpStatus;
    private int temporaryMedicalRowCount;
    private int matchingTemporaryMedicalRowCount;
    private boolean medicalUidPresent;
    private String medicalMode;
    private String medicalMode2;
    private boolean resendBlocked;
    private String resendBlockReason;
    private String reconciliationStatus;
    private String message;

    public boolean isOk() {
        return ok;
    }

    public void setOk(boolean ok) {
        this.ok = ok;
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

    public String getRequestClass() {
        return requestClass;
    }

    public void setRequestClass(String requestClass) {
        this.requestClass = requestClass;
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

    public boolean isRawSensitiveFieldsExcluded() {
        return rawSensitiveFieldsExcluded;
    }

    public void setRawSensitiveFieldsExcluded(boolean rawSensitiveFieldsExcluded) {
        this.rawSensitiveFieldsExcluded = rawSensitiveFieldsExcluded;
    }

    public boolean isClientProvidedIdentifiersTrusted() {
        return clientProvidedIdentifiersTrusted;
    }

    public void setClientProvidedIdentifiersTrusted(boolean clientProvidedIdentifiersTrusted) {
        this.clientProvidedIdentifiersTrusted = clientProvidedIdentifiersTrusted;
    }

    public boolean isServerDerivedAuthorityRequired() {
        return serverDerivedAuthorityRequired;
    }

    public void setServerDerivedAuthorityRequired(boolean serverDerivedAuthorityRequired) {
        this.serverDerivedAuthorityRequired = serverDerivedAuthorityRequired;
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

    public int getTemporaryMedicalRowCount() {
        return temporaryMedicalRowCount;
    }

    public void setTemporaryMedicalRowCount(int temporaryMedicalRowCount) {
        this.temporaryMedicalRowCount = temporaryMedicalRowCount;
    }

    public int getMatchingTemporaryMedicalRowCount() {
        return matchingTemporaryMedicalRowCount;
    }

    public void setMatchingTemporaryMedicalRowCount(int matchingTemporaryMedicalRowCount) {
        this.matchingTemporaryMedicalRowCount = matchingTemporaryMedicalRowCount;
    }

    public boolean isMedicalUidPresent() {
        return medicalUidPresent;
    }

    public void setMedicalUidPresent(boolean medicalUidPresent) {
        this.medicalUidPresent = medicalUidPresent;
    }

    public String getMedicalMode() {
        return medicalMode;
    }

    public void setMedicalMode(String medicalMode) {
        this.medicalMode = medicalMode;
    }

    public String getMedicalMode2() {
        return medicalMode2;
    }

    public void setMedicalMode2(String medicalMode2) {
        this.medicalMode2 = medicalMode2;
    }

    public boolean isResendBlocked() {
        return resendBlocked;
    }

    public void setResendBlocked(boolean resendBlocked) {
        this.resendBlocked = resendBlocked;
    }

    public String getResendBlockReason() {
        return resendBlockReason;
    }

    public void setResendBlockReason(String resendBlockReason) {
        this.resendBlockReason = resendBlockReason;
    }

    public String getReconciliationStatus() {
        return reconciliationStatus;
    }

    public void setReconciliationStatus(String reconciliationStatus) {
        this.reconciliationStatus = reconciliationStatus;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
