package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChartSupportMedicalModResponse {

    private boolean ok;
    private boolean apiOk;
    private int status;
    private String apiResult;
    private String apiResultMessage;
    private String informationDate;
    private String informationTime;
    private String medicalUid;
    private String invoiceNumber;
    private String dataId;
    private List<MedicalWarning> medicalWarnings = new ArrayList<>();
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

    public String getMedicalUid() {
        return medicalUid;
    }

    public void setMedicalUid(String medicalUid) {
        this.medicalUid = medicalUid;
    }

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public void setInvoiceNumber(String invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
    }

    public String getDataId() {
        return dataId;
    }

    public void setDataId(String dataId) {
        this.dataId = dataId;
    }

    public List<MedicalWarning> getMedicalWarnings() {
        return medicalWarnings;
    }

    public void setMedicalWarnings(List<MedicalWarning> medicalWarnings) {
        this.medicalWarnings = medicalWarnings;
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
    public static class MedicalWarning {
        private String medicalWarning;
        private String medicalWarningMessage;
        private Integer medicalWarningPosition;
        private Integer medicalWarningItemPosition;
        private String medicalWarningCode;

        public String getMedicalWarning() {
            return medicalWarning;
        }

        public void setMedicalWarning(String medicalWarning) {
            this.medicalWarning = medicalWarning;
        }

        public String getMedicalWarningMessage() {
            return medicalWarningMessage;
        }

        public void setMedicalWarningMessage(String medicalWarningMessage) {
            this.medicalWarningMessage = medicalWarningMessage;
        }

        public Integer getMedicalWarningPosition() {
            return medicalWarningPosition;
        }

        public void setMedicalWarningPosition(Integer medicalWarningPosition) {
            this.medicalWarningPosition = medicalWarningPosition;
        }

        public Integer getMedicalWarningItemPosition() {
            return medicalWarningItemPosition;
        }

        public void setMedicalWarningItemPosition(Integer medicalWarningItemPosition) {
            this.medicalWarningItemPosition = medicalWarningItemPosition;
        }

        public String getMedicalWarningCode() {
            return medicalWarningCode;
        }

        public void setMedicalWarningCode(String medicalWarningCode) {
            this.medicalWarningCode = medicalWarningCode;
        }
    }
}
