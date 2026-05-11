package open.dolphin.rest.dto.chart;

import java.util.LinkedHashMap;
import java.util.Map;

public class ChartRevisionExportPrescriptionEvent {

    private Long prescriptionOrderId;
    private Long prescriptionRevisionId;
    private String chartRevisionId;
    private Integer revisionNumber;
    private String status;
    private String contentHash;
    private Long eventId;
    private String eventType;
    private String actorUserId;
    private String occurredAt;
    private String reasonCode;
    private String reasonText;
    private Map<String, Object> beforeSummary = new LinkedHashMap<>();
    private Map<String, Object> afterSummary = new LinkedHashMap<>();
    private String eventHash;

    public Long getPrescriptionOrderId() {
        return prescriptionOrderId;
    }

    public void setPrescriptionOrderId(Long prescriptionOrderId) {
        this.prescriptionOrderId = prescriptionOrderId;
    }

    public Long getPrescriptionRevisionId() {
        return prescriptionRevisionId;
    }

    public void setPrescriptionRevisionId(Long prescriptionRevisionId) {
        this.prescriptionRevisionId = prescriptionRevisionId;
    }

    public String getChartRevisionId() {
        return chartRevisionId;
    }

    public void setChartRevisionId(String chartRevisionId) {
        this.chartRevisionId = chartRevisionId;
    }

    public Integer getRevisionNumber() {
        return revisionNumber;
    }

    public void setRevisionNumber(Integer revisionNumber) {
        this.revisionNumber = revisionNumber;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getContentHash() {
        return contentHash;
    }

    public void setContentHash(String contentHash) {
        this.contentHash = contentHash;
    }

    public Long getEventId() {
        return eventId;
    }

    public void setEventId(Long eventId) {
        this.eventId = eventId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
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

    public Map<String, Object> getBeforeSummary() {
        return beforeSummary;
    }

    public void setBeforeSummary(Map<String, Object> beforeSummary) {
        this.beforeSummary = beforeSummary == null ? new LinkedHashMap<>() : new LinkedHashMap<>(beforeSummary);
    }

    public Map<String, Object> getAfterSummary() {
        return afterSummary;
    }

    public void setAfterSummary(Map<String, Object> afterSummary) {
        this.afterSummary = afterSummary == null ? new LinkedHashMap<>() : new LinkedHashMap<>(afterSummary);
    }

    public String getEventHash() {
        return eventHash;
    }

    public void setEventHash(String eventHash) {
        this.eventHash = eventHash;
    }
}
