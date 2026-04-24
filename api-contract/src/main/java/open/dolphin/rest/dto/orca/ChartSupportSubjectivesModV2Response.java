package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChartSupportSubjectivesModV2Response {

    private boolean ok;
    private boolean apiOk;
    private boolean businessAccepted;
    private int status;
    private String apiResult;
    private String apiResultMessage;
    private String apiResultMessageCategory;
    private String responseClassification;
    private String informationDate;
    private String informationTime;
    private String runId;
    private String traceId;
    private String error;

    public boolean isOk() {
        return ok;
    }

    public void setOk(boolean ok) {
        this.ok = ok;
    }

    public boolean isApiOk() {
        return apiOk;
    }

    public void setApiOk(boolean apiOk) {
        this.apiOk = apiOk;
    }

    public boolean isBusinessAccepted() {
        return businessAccepted;
    }

    public void setBusinessAccepted(boolean businessAccepted) {
        this.businessAccepted = businessAccepted;
    }

    public int getStatus() {
        return status;
    }

    public void setStatus(int status) {
        this.status = status;
    }

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

    public String getApiResultMessageCategory() {
        return apiResultMessageCategory;
    }

    public void setApiResultMessageCategory(String apiResultMessageCategory) {
        this.apiResultMessageCategory = apiResultMessageCategory;
    }

    public String getResponseClassification() {
        return responseClassification;
    }

    public void setResponseClassification(String responseClassification) {
        this.responseClassification = responseClassification;
    }

    public String getInformationDate() {
        return informationDate;
    }

    public void setInformationDate(String informationDate) {
        this.informationDate = informationDate;
    }

    public String getInformationTime() {
        return informationTime;
    }

    public void setInformationTime(String informationTime) {
        this.informationTime = informationTime;
    }

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
}
