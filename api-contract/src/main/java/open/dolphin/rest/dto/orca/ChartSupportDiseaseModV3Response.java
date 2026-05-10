package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChartSupportDiseaseModV3Response {

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
    private boolean needsUserReview;
    private String operationStatus;
    private String unmatchInformationOverflow;
    private OrganizeInformation organizeInformation;
    private List<DiseaseWarning> warnings = new ArrayList<>();
    private List<DiseaseUnmatchInformation> unmatchInformation = new ArrayList<>();

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

    public boolean isNeedsUserReview() {
        return needsUserReview;
    }

    public void setNeedsUserReview(boolean needsUserReview) {
        this.needsUserReview = needsUserReview;
    }

    public String getOperationStatus() {
        return operationStatus;
    }

    public void setOperationStatus(String operationStatus) {
        this.operationStatus = operationStatus;
    }

    public String getUnmatchInformationOverflow() {
        return unmatchInformationOverflow;
    }

    public void setUnmatchInformationOverflow(String unmatchInformationOverflow) {
        this.unmatchInformationOverflow = unmatchInformationOverflow;
    }

    public OrganizeInformation getOrganizeInformation() {
        return organizeInformation;
    }

    public void setOrganizeInformation(OrganizeInformation organizeInformation) {
        this.organizeInformation = organizeInformation;
    }

    public List<DiseaseWarning> getWarnings() {
        return warnings;
    }

    public void setWarnings(List<DiseaseWarning> warnings) {
        this.warnings = warnings;
    }

    public List<DiseaseUnmatchInformation> getUnmatchInformation() {
        return unmatchInformation;
    }

    public void setUnmatchInformation(List<DiseaseUnmatchInformation> unmatchInformation) {
        this.unmatchInformation = unmatchInformation;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DiseaseWarning {
        private String code;
        private String messageCategory;
        private Integer position;

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getMessageCategory() {
            return messageCategory;
        }

        public void setMessageCategory(String messageCategory) {
            this.messageCategory = messageCategory;
        }

        public Integer getPosition() {
            return position;
        }

        public void setPosition(Integer position) {
            this.position = position;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DiseaseUnmatchInformation {
        private String code;
        private String name;
        private String supplementName;
        private String inOut;
        private String category;
        private String suspectedFlag;
        private String startDate;
        private String endDate;
        private String outcome;
        private String messageCategory;

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getSupplementName() {
            return supplementName;
        }

        public void setSupplementName(String supplementName) {
            this.supplementName = supplementName;
        }

        public String getInOut() {
            return inOut;
        }

        public void setInOut(String inOut) {
            this.inOut = inOut;
        }

        public String getCategory() {
            return category;
        }

        public void setCategory(String category) {
            this.category = category;
        }

        public String getSuspectedFlag() {
            return suspectedFlag;
        }

        public void setSuspectedFlag(String suspectedFlag) {
            this.suspectedFlag = suspectedFlag;
        }

        public String getStartDate() {
            return startDate;
        }

        public void setStartDate(String startDate) {
            this.startDate = startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public void setEndDate(String endDate) {
            this.endDate = endDate;
        }

        public String getOutcome() {
            return outcome;
        }

        public void setOutcome(String outcome) {
            this.outcome = outcome;
        }

        public String getMessageCategory() {
            return messageCategory;
        }

        public void setMessageCategory(String messageCategory) {
            this.messageCategory = messageCategory;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class OrganizeInformation {
        private String departmentCode;
        private String diseaseStartDate;

        public String getDepartmentCode() {
            return departmentCode;
        }

        public void setDepartmentCode(String departmentCode) {
            this.departmentCode = departmentCode;
        }

        public String getDiseaseStartDate() {
            return diseaseStartDate;
        }

        public void setDiseaseStartDate(String diseaseStartDate) {
            this.diseaseStartDate = diseaseStartDate;
        }
    }
}
