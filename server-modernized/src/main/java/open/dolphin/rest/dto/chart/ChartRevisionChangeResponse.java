package open.dolphin.rest.dto.chart;

public class ChartRevisionChangeResponse {

    private long chartId;
    private long sourceRevisionId;
    private Long newRevisionId;
    private long eventId;
    private String eventType;
    private String status;
    private String contentHash;

    public long getChartId() {
        return chartId;
    }

    public void setChartId(long chartId) {
        this.chartId = chartId;
    }

    public long getSourceRevisionId() {
        return sourceRevisionId;
    }

    public void setSourceRevisionId(long sourceRevisionId) {
        this.sourceRevisionId = sourceRevisionId;
    }

    public Long getNewRevisionId() {
        return newRevisionId;
    }

    public void setNewRevisionId(Long newRevisionId) {
        this.newRevisionId = newRevisionId;
    }

    public long getEventId() {
        return eventId;
    }

    public void setEventId(long eventId) {
        this.eventId = eventId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
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
}
