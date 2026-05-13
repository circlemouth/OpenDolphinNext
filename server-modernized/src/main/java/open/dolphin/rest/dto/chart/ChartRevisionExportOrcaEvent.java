package open.dolphin.rest.dto.chart;

import java.util.LinkedHashMap;
import java.util.Map;

public class ChartRevisionExportOrcaEvent {

    private Long orcaOperationId;
    private String chartRevisionId;
    private String operationScope;
    private String operationType;
    private String sourceApi;
    private String operationStatus;
    private String requestedBy;
    private String requestedAt;
    private String completedAt;
    private String requestHash;
    private String responseHash;
    private Integer retryCount;
    private Boolean needsUserReview;
    private Long latestTransmissionId;
    private String transmissionStatus;
    private String transportStatus;
    private Integer attemptNumber;
    private String transmissionStartedAt;
    private String transmissionCompletedAt;
    private String transmissionRequestHash;
    private String transmissionResponseHash;
    private String reconciliationStatus;
    private Map<String, Object> operationSummary = new LinkedHashMap<>();
    private Map<String, Object> transmissionSummary = new LinkedHashMap<>();

    public Long getOrcaOperationId() {
        return orcaOperationId;
    }

    public void setOrcaOperationId(Long orcaOperationId) {
        this.orcaOperationId = orcaOperationId;
    }

    public String getChartRevisionId() {
        return chartRevisionId;
    }

    public void setChartRevisionId(String chartRevisionId) {
        this.chartRevisionId = chartRevisionId;
    }

    public String getOperationScope() {
        return operationScope;
    }

    public void setOperationScope(String operationScope) {
        this.operationScope = operationScope;
    }

    public String getOperationType() {
        return operationType;
    }

    public void setOperationType(String operationType) {
        this.operationType = operationType;
    }

    public String getSourceApi() {
        return sourceApi;
    }

    public void setSourceApi(String sourceApi) {
        this.sourceApi = sourceApi;
    }

    public String getOperationStatus() {
        return operationStatus;
    }

    public void setOperationStatus(String operationStatus) {
        this.operationStatus = operationStatus;
    }

    public String getRequestedBy() {
        return requestedBy;
    }

    public void setRequestedBy(String requestedBy) {
        this.requestedBy = requestedBy;
    }

    public String getRequestedAt() {
        return requestedAt;
    }

    public void setRequestedAt(String requestedAt) {
        this.requestedAt = requestedAt;
    }

    public String getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(String completedAt) {
        this.completedAt = completedAt;
    }

    public String getRequestHash() {
        return requestHash;
    }

    public void setRequestHash(String requestHash) {
        this.requestHash = requestHash;
    }

    public String getResponseHash() {
        return responseHash;
    }

    public void setResponseHash(String responseHash) {
        this.responseHash = responseHash;
    }

    public Integer getRetryCount() {
        return retryCount;
    }

    public void setRetryCount(Integer retryCount) {
        this.retryCount = retryCount;
    }

    public Boolean getNeedsUserReview() {
        return needsUserReview;
    }

    public void setNeedsUserReview(Boolean needsUserReview) {
        this.needsUserReview = needsUserReview;
    }

    public Long getLatestTransmissionId() {
        return latestTransmissionId;
    }

    public void setLatestTransmissionId(Long latestTransmissionId) {
        this.latestTransmissionId = latestTransmissionId;
    }

    public String getTransmissionStatus() {
        return transmissionStatus;
    }

    public void setTransmissionStatus(String transmissionStatus) {
        this.transmissionStatus = transmissionStatus;
    }

    public String getTransportStatus() {
        return transportStatus;
    }

    public void setTransportStatus(String transportStatus) {
        this.transportStatus = transportStatus;
    }

    public Integer getAttemptNumber() {
        return attemptNumber;
    }

    public void setAttemptNumber(Integer attemptNumber) {
        this.attemptNumber = attemptNumber;
    }

    public String getTransmissionStartedAt() {
        return transmissionStartedAt;
    }

    public void setTransmissionStartedAt(String transmissionStartedAt) {
        this.transmissionStartedAt = transmissionStartedAt;
    }

    public String getTransmissionCompletedAt() {
        return transmissionCompletedAt;
    }

    public void setTransmissionCompletedAt(String transmissionCompletedAt) {
        this.transmissionCompletedAt = transmissionCompletedAt;
    }

    public String getTransmissionRequestHash() {
        return transmissionRequestHash;
    }

    public void setTransmissionRequestHash(String transmissionRequestHash) {
        this.transmissionRequestHash = transmissionRequestHash;
    }

    public String getTransmissionResponseHash() {
        return transmissionResponseHash;
    }

    public void setTransmissionResponseHash(String transmissionResponseHash) {
        this.transmissionResponseHash = transmissionResponseHash;
    }

    public String getReconciliationStatus() {
        return reconciliationStatus;
    }

    public void setReconciliationStatus(String reconciliationStatus) {
        this.reconciliationStatus = reconciliationStatus;
    }

    public Map<String, Object> getOperationSummary() {
        return new LinkedHashMap<>(operationSummary);
    }

    public void setOperationSummary(Map<String, Object> operationSummary) {
        this.operationSummary = operationSummary == null ? new LinkedHashMap<>() : new LinkedHashMap<>(operationSummary);
    }

    public Map<String, Object> getTransmissionSummary() {
        return new LinkedHashMap<>(transmissionSummary);
    }

    public void setTransmissionSummary(Map<String, Object> transmissionSummary) {
        this.transmissionSummary = transmissionSummary == null
                ? new LinkedHashMap<>()
                : new LinkedHashMap<>(transmissionSummary);
    }
}
