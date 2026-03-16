package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChartSupportContraindicationCheckResponse {

    private boolean ok;
    private boolean apiOk;
    private int status;
    private String apiResult;
    private String apiResultMessage;
    private String informationDate;
    private String informationTime;
    private List<Result> results = new ArrayList<>();
    private List<SymptomInfo> symptomInfo = new ArrayList<>();
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

    public List<Result> getResults() {
        return results;
    }

    public void setResults(List<Result> results) {
        this.results = results;
    }

    public List<SymptomInfo> getSymptomInfo() {
        return symptomInfo;
    }

    public void setSymptomInfo(List<SymptomInfo> symptomInfo) {
        this.symptomInfo = symptomInfo;
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
    public static class Result {
        private String medicationCode;
        private String medicationName;
        private String medicalResult;
        private String medicalResultMessage;
        private List<Warning> warnings = new ArrayList<>();

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

        public String getMedicalResult() {
            return medicalResult;
        }

        public void setMedicalResult(String medicalResult) {
            this.medicalResult = medicalResult;
        }

        public String getMedicalResultMessage() {
            return medicalResultMessage;
        }

        public void setMedicalResultMessage(String medicalResultMessage) {
            this.medicalResultMessage = medicalResultMessage;
        }

        public List<Warning> getWarnings() {
            return warnings;
        }

        public void setWarnings(List<Warning> warnings) {
            this.warnings = warnings;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Warning {
        private String contraCode;
        private String contraName;
        private String interactCode;
        private String administerDate;
        private String contextClass;

        public String getContraCode() {
            return contraCode;
        }

        public void setContraCode(String contraCode) {
            this.contraCode = contraCode;
        }

        public String getContraName() {
            return contraName;
        }

        public void setContraName(String contraName) {
            this.contraName = contraName;
        }

        public String getInteractCode() {
            return interactCode;
        }

        public void setInteractCode(String interactCode) {
            this.interactCode = interactCode;
        }

        public String getAdministerDate() {
            return administerDate;
        }

        public void setAdministerDate(String administerDate) {
            this.administerDate = administerDate;
        }

        public String getContextClass() {
            return contextClass;
        }

        public void setContextClass(String contextClass) {
            this.contextClass = contextClass;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SymptomInfo {
        private String code;
        private String content;
        private String detail;

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }

        public String getDetail() {
            return detail;
        }

        public void setDetail(String detail) {
            this.detail = detail;
        }
    }
}
