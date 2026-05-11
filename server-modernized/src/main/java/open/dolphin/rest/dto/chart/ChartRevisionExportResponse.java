package open.dolphin.rest.dto.chart;

import java.util.ArrayList;
import java.util.List;

public class ChartRevisionExportResponse {

    private Long chartId;
    private Long currentRevisionId;
    private Integer currentRevisionNumber;
    private String currentRevisionStatus;
    private String currentRevisionContentHash;
    private Integer exportSchemaVersion;
    private String exportHashAlgorithm;
    private String exportHash;
    private Integer revisionCount;
    private Integer eventCount;
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

    public Integer getCurrentRevisionNumber() {
        return currentRevisionNumber;
    }

    public void setCurrentRevisionNumber(Integer currentRevisionNumber) {
        this.currentRevisionNumber = currentRevisionNumber;
    }

    public String getCurrentRevisionStatus() {
        return currentRevisionStatus;
    }

    public void setCurrentRevisionStatus(String currentRevisionStatus) {
        this.currentRevisionStatus = currentRevisionStatus;
    }

    public String getCurrentRevisionContentHash() {
        return currentRevisionContentHash;
    }

    public void setCurrentRevisionContentHash(String currentRevisionContentHash) {
        this.currentRevisionContentHash = currentRevisionContentHash;
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

    public Integer getRevisionCount() {
        return revisionCount;
    }

    public void setRevisionCount(Integer revisionCount) {
        this.revisionCount = revisionCount;
    }

    public Integer getEventCount() {
        return eventCount;
    }

    public void setEventCount(Integer eventCount) {
        this.eventCount = eventCount;
    }

    public List<ChartRevisionExportRevision> getRevisions() {
        return new ArrayList<>(revisions);
    }

    public void setRevisions(List<ChartRevisionExportRevision> revisions) {
        this.revisions = revisions == null ? new ArrayList<>() : new ArrayList<>(revisions);
    }

    public List<ChartRevisionExportEvent> getEvents() {
        return new ArrayList<>(events);
    }

    public void setEvents(List<ChartRevisionExportEvent> events) {
        this.events = events == null ? new ArrayList<>() : new ArrayList<>(events);
    }
}
