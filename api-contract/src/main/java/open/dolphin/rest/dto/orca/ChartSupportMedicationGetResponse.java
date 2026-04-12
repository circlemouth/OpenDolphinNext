package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChartSupportMedicationGetResponse {

    private boolean ok;
    private boolean apiOk;
    private int status;
    private String apiResult;
    private String apiResultMessage;
    private String informationDate;
    private String informationTime;
    private String reskey;
    private String baseDate;
    private Medication medication;
    private List<Selection> selections = new ArrayList<>();
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

    public String getReskey() {
        return reskey;
    }

    public void setReskey(String reskey) {
        this.reskey = reskey;
    }

    public String getBaseDate() {
        return baseDate;
    }

    public void setBaseDate(String baseDate) {
        this.baseDate = baseDate;
    }

    public Medication getMedication() {
        return medication;
    }

    public void setMedication(Medication medication) {
        this.medication = medication;
    }

    public List<Selection> getSelections() {
        return selections;
    }

    public void setSelections(List<Selection> selections) {
        this.selections = selections;
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

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Medication {
        private String medicationCode;
        private String medicationName;
        private String medicationNameKana;
        private String unitCode;
        private String unitName;
        private String startDate;
        private String endDate;
        private String requestCode;
        private Map<String, String> extraFields;

        public String getMedicationCode() {
            return medicationCode;
        }

        public void setMedicationCode(String medicationCode) {
            this.medicationCode = medicationCode;
        }

        public String getMedicationName() {
            return medicationName;
        }

        public void setMedicationName(String medicationName) {
            this.medicationName = medicationName;
        }

        public String getMedicationNameKana() {
            return medicationNameKana;
        }

        public void setMedicationNameKana(String medicationNameKana) {
            this.medicationNameKana = medicationNameKana;
        }

        public String getUnitCode() {
            return unitCode;
        }

        public void setUnitCode(String unitCode) {
            this.unitCode = unitCode;
        }

        public String getUnitName() {
            return unitName;
        }

        public void setUnitName(String unitName) {
            this.unitName = unitName;
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

        public String getRequestCode() {
            return requestCode;
        }

        public void setRequestCode(String requestCode) {
            this.requestCode = requestCode;
        }

        public Map<String, String> getExtraFields() {
            return extraFields;
        }

        public void setExtraFields(Map<String, String> extraFields) {
            this.extraFields = extraFields;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Selection {
        private String commentCode;
        private String commentName;
        private String category;
        private String conditionCategory;
        private String notUseComment;
        private String processCategory;
        private String selectionGrepName;
        private String itemNumber;
        private String itemNumberBranch;
        private Map<String, String> extraFields;

        public String getCommentCode() {
            return commentCode;
        }

        public void setCommentCode(String commentCode) {
            this.commentCode = commentCode;
        }

        public String getCommentName() {
            return commentName;
        }

        public void setCommentName(String commentName) {
            this.commentName = commentName;
        }

        public String getCategory() {
            return category;
        }

        public void setCategory(String category) {
            this.category = category;
        }

        public String getConditionCategory() {
            return conditionCategory;
        }

        public void setConditionCategory(String conditionCategory) {
            this.conditionCategory = conditionCategory;
        }

        public String getNotUseComment() {
            return notUseComment;
        }

        public void setNotUseComment(String notUseComment) {
            this.notUseComment = notUseComment;
        }

        public String getProcessCategory() {
            return processCategory;
        }

        public void setProcessCategory(String processCategory) {
            this.processCategory = processCategory;
        }

        public String getSelectionGrepName() {
            return selectionGrepName;
        }

        public void setSelectionGrepName(String selectionGrepName) {
            this.selectionGrepName = selectionGrepName;
        }

        public String getItemNumber() {
            return itemNumber;
        }

        public void setItemNumber(String itemNumber) {
            this.itemNumber = itemNumber;
        }

        public String getItemNumberBranch() {
            return itemNumberBranch;
        }

        public void setItemNumberBranch(String itemNumberBranch) {
            this.itemNumberBranch = itemNumberBranch;
        }

        public Map<String, String> getExtraFields() {
            return extraFields;
        }

        public void setExtraFields(Map<String, String> extraFields) {
            this.extraFields = extraFields;
        }
    }
}
