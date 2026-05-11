package open.dolphin.reporting.api;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Chart revision provenance entry rendered into clinical report exports.
 */
public class ReportingChartRevisionEventPayload {

    private Long eventId;
    private Long chartRevisionId;
    private Long previousRevisionId;
    private Long newRevisionId;
    private String eventType;
    private Long actorUserId;
    private String occurredAt;
    private String reasonCode;
    private String reasonText;
    private String contentHash;
    private Map<String, Object> beforeSummary = new LinkedHashMap<>();
    private Map<String, Object> afterSummary = new LinkedHashMap<>();

    public Long getEventId() {
        return eventId;
    }

    public void setEventId(Long eventId) {
        this.eventId = eventId;
    }

    public Long getChartRevisionId() {
        return chartRevisionId;
    }

    public void setChartRevisionId(Long chartRevisionId) {
        this.chartRevisionId = chartRevisionId;
    }

    public Long getPreviousRevisionId() {
        return previousRevisionId;
    }

    public void setPreviousRevisionId(Long previousRevisionId) {
        this.previousRevisionId = previousRevisionId;
    }

    public Long getNewRevisionId() {
        return newRevisionId;
    }

    public void setNewRevisionId(Long newRevisionId) {
        this.newRevisionId = newRevisionId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public Long getActorUserId() {
        return actorUserId;
    }

    public void setActorUserId(Long actorUserId) {
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

    public String getContentHash() {
        return contentHash;
    }

    public void setContentHash(String contentHash) {
        this.contentHash = contentHash;
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
}
