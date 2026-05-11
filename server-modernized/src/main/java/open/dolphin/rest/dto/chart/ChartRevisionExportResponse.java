package open.dolphin.rest.dto.chart;

import java.util.ArrayList;
import java.util.List;

public class ChartRevisionExportResponse {

    private Long chartId;
    private Long currentRevisionId;
    private Integer exportSchemaVersion;
    private String exportHashAlgorithm;
    private String exportHash;
    private List<ChartRevisionExportRevision> revisions = new ArrayList<>();
    private List<ChartRevisionExportEvent> events = new ArrayList<>();

    public Long getChartId() {
        return chartId;
    }

    public void setChartId(Long chartId) {
        this.chartId = chartId;
    }

    public Long getCurrentRevisionId() {
        return currentRevisionId;
    }

    public void setCurrentRevisionId(Long currentRevisionId) {
        this.currentRevisionId = currentRevisionId;
    }

    public Integer getExportSchemaVersion() {
        return exportSchemaVersion;
    }

    public void setExportSchemaVersion(Integer exportSchemaVersion) {
        this.exportSchemaVersion = exportSchemaVersion;
    }

    public String getExportHashAlgorithm() {
        return exportHashAlgorithm;
    }

    public void setExportHashAlgorithm(String exportHashAlgorithm) {
        this.exportHashAlgorithm = exportHashAlgorithm;
    }

    public String getExportHash() {
        return exportHash;
    }

    public void setExportHash(String exportHash) {
        this.exportHash = exportHash;
    }

    public List<ChartRevisionExportRevision> getRevisions() {
        return revisions;
    }

    public void setRevisions(List<ChartRevisionExportRevision> revisions) {
        this.revisions = revisions == null ? new ArrayList<>() : new ArrayList<>(revisions);
    }

    public List<ChartRevisionExportEvent> getEvents() {
        return events;
    }

    public void setEvents(List<ChartRevisionExportEvent> events) {
        this.events = events == null ? new ArrayList<>() : new ArrayList<>(events);
    }
}
