package open.dolphin.rest.dto.chart;

public class ChartRevisionDraftResponse {

    private Long chartId;
    private Long revisionId;
    private Integer revisionNumber;
    private String status;
    private String documentKey;
    private Long docPk;

    public Long getChartId() {
        return chartId;
    }

    public void setChartId(Long chartId) {
        this.chartId = chartId;
    }

    public Long getRevisionId() {
        return revisionId;
    }

    public void setRevisionId(Long revisionId) {
        this.revisionId = revisionId;
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

    public String getDocumentKey() {
        return documentKey;
    }

    public void setDocumentKey(String documentKey) {
        this.documentKey = documentKey;
    }

    public Long getDocPk() {
        return docPk;
    }

    public void setDocPk(Long docPk) {
        this.docPk = docPk;
    }
}
