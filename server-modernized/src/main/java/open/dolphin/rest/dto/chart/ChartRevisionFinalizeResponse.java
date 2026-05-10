package open.dolphin.rest.dto.chart;

public class ChartRevisionFinalizeResponse {

    private long chartId;
    private long revisionId;
    private String status;
    private String contentHash;
    private String finalizedAt;
    private Long finalizedByUserId;

    public long getChartId() {
        return chartId;
    }

    public void setChartId(long chartId) {
        this.chartId = chartId;
    }

    public long getRevisionId() {
        return revisionId;
    }

    public void setRevisionId(long revisionId) {
        this.revisionId = revisionId;
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

    public String getFinalizedAt() {
        return finalizedAt;
    }

    public void setFinalizedAt(String finalizedAt) {
        this.finalizedAt = finalizedAt;
    }

    public Long getFinalizedByUserId() {
        return finalizedByUserId;
    }

    public void setFinalizedByUserId(Long finalizedByUserId) {
        this.finalizedByUserId = finalizedByUserId;
    }
}
