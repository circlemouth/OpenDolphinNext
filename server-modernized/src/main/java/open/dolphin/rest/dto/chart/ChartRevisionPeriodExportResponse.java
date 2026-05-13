package open.dolphin.rest.dto.chart;

import java.util.ArrayList;
import java.util.List;

public class ChartRevisionPeriodExportResponse {

    private String fromDate;
    private String toDate;
    private Boolean patientFilterApplied;
    private Integer exportSchemaVersion;
    private String exportHashAlgorithm;
    private String exportHash;
    private Integer chartCount;
    private List<ChartRevisionExportResponse> charts = new ArrayList<>();

    public String getFromDate() {
        return fromDate;
    }

    public void setFromDate(String fromDate) {
        this.fromDate = fromDate;
    }

    public String getToDate() {
        return toDate;
    }

    public void setToDate(String toDate) {
        this.toDate = toDate;
    }

    public Boolean getPatientFilterApplied() {
        return patientFilterApplied;
    }

    public void setPatientFilterApplied(Boolean patientFilterApplied) {
        this.patientFilterApplied = patientFilterApplied;
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

    public Integer getChartCount() {
        return chartCount;
    }

    public void setChartCount(Integer chartCount) {
        this.chartCount = chartCount;
    }

    public List<ChartRevisionExportResponse> getCharts() {
        return new ArrayList<>(charts);
    }

    public void setCharts(List<ChartRevisionExportResponse> charts) {
        this.charts = charts == null ? new ArrayList<>() : new ArrayList<>(charts);
    }
}
