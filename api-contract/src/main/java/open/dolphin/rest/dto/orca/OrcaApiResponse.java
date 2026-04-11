package open.dolphin.rest.dto.orca;

/**
 * Common fields shared by ORCA wrapper responses.
 */
public abstract class OrcaApiResponse {

    private String apiResult;
    private String apiResultMessage;
    private String runId;
    private String routeNamespace;
    private String traceId;
    private String requestId;
    private String blockerTag;
    private String dataSource;
    private String dataSourceTransition;
    private Integer recordsReturned;
    private boolean cacheHit;
    private boolean missingMaster;
    private boolean fallbackUsed;
    private String fetchedAt;

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

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public String getRouteNamespace() {
        return routeNamespace;
    }

    public void setRouteNamespace(String routeNamespace) {
        this.routeNamespace = routeNamespace;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public String getBlockerTag() {
        return blockerTag;
    }

    public void setBlockerTag(String blockerTag) {
        this.blockerTag = blockerTag;
    }

    public String getDataSource() {
        return dataSource;
    }

    public void setDataSource(String dataSource) {
        this.dataSource = dataSource;
    }

    public String getDataSourceTransition() {
        return dataSourceTransition;
    }

    public void setDataSourceTransition(String dataSourceTransition) {
        this.dataSourceTransition = dataSourceTransition;
    }

    public Integer getRecordsReturned() {
        return recordsReturned;
    }

    public void setRecordsReturned(Integer recordsReturned) {
        this.recordsReturned = recordsReturned;
    }

    public boolean isCacheHit() {
        return cacheHit;
    }

    public void setCacheHit(boolean cacheHit) {
        this.cacheHit = cacheHit;
    }

    public boolean isMissingMaster() {
        return missingMaster;
    }

    public void setMissingMaster(boolean missingMaster) {
        this.missingMaster = missingMaster;
    }

    public boolean isFallbackUsed() {
        return fallbackUsed;
    }

    public void setFallbackUsed(boolean fallbackUsed) {
        this.fallbackUsed = fallbackUsed;
    }

    public String getFetchedAt() {
        return fetchedAt;
    }

    public void setFetchedAt(String fetchedAt) {
        this.fetchedAt = fetchedAt;
    }
}
