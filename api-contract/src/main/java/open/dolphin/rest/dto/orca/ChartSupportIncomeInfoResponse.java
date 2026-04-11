package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChartSupportIncomeInfoResponse {

    private boolean ok;
    private boolean apiOk;
    private int status;
    private String apiResult;
    private String apiResultMessage;
    private String informationDate;
    private String informationTime;
    private List<Entry> entries = new ArrayList<>();
    private Double unpaidMoneyTotal;
    private Boolean unpaidMoneyInformationOverflow;
    private List<UnpaidMoneyEntry> unpaidMoneyInformation = new ArrayList<>();
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

    public List<Entry> getEntries() {
        return entries;
    }

    public void setEntries(List<Entry> entries) {
        this.entries = entries;
    }

    public Double getUnpaidMoneyTotal() {
        return unpaidMoneyTotal;
    }

    public void setUnpaidMoneyTotal(Double unpaidMoneyTotal) {
        this.unpaidMoneyTotal = unpaidMoneyTotal;
    }

    public Boolean getUnpaidMoneyInformationOverflow() {
        return unpaidMoneyInformationOverflow;
    }

    public void setUnpaidMoneyInformationOverflow(Boolean unpaidMoneyInformationOverflow) {
        this.unpaidMoneyInformationOverflow = unpaidMoneyInformationOverflow;
    }

    public List<UnpaidMoneyEntry> getUnpaidMoneyInformation() {
        return unpaidMoneyInformation;
    }

    public void setUnpaidMoneyInformation(List<UnpaidMoneyEntry> unpaidMoneyInformation) {
        this.unpaidMoneyInformation = unpaidMoneyInformation;
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
    public static class Entry {
        private String performDate;
        private String performEndDate;
        private String issuedDate;
        private String inOut;
        private String invoiceNumber;
        private String groupInvoiceNumber;
        private String departmentCode;
        private String departmentName;
        private String insuranceCombinationNumber;
        private Double acMoney;
        private Double icMoney;
        private Double aiMoney;
        private Double oeMoney;
        private Double mlSmoney;

        public String getPerformDate() {
            return performDate;
        }

        public void setPerformDate(String performDate) {
            this.performDate = performDate;
        }

        public String getPerformEndDate() {
            return performEndDate;
        }

        public void setPerformEndDate(String performEndDate) {
            this.performEndDate = performEndDate;
        }

        public String getIssuedDate() {
            return issuedDate;
        }

        public void setIssuedDate(String issuedDate) {
            this.issuedDate = issuedDate;
        }

        public String getInOut() {
            return inOut;
        }

        public void setInOut(String inOut) {
            this.inOut = inOut;
        }

        public String getInvoiceNumber() {
            return invoiceNumber;
        }

        public void setInvoiceNumber(String invoiceNumber) {
            this.invoiceNumber = invoiceNumber;
        }

        public String getGroupInvoiceNumber() {
            return groupInvoiceNumber;
        }

        public void setGroupInvoiceNumber(String groupInvoiceNumber) {
            this.groupInvoiceNumber = groupInvoiceNumber;
        }

        public String getDepartmentCode() {
            return departmentCode;
        }

        public void setDepartmentCode(String departmentCode) {
            this.departmentCode = departmentCode;
        }

        public String getDepartmentName() {
            return departmentName;
        }

        public void setDepartmentName(String departmentName) {
            this.departmentName = departmentName;
        }

        public String getInsuranceCombinationNumber() {
            return insuranceCombinationNumber;
        }

        public void setInsuranceCombinationNumber(String insuranceCombinationNumber) {
            this.insuranceCombinationNumber = insuranceCombinationNumber;
        }

        public Double getAcMoney() {
            return acMoney;
        }

        public void setAcMoney(Double acMoney) {
            this.acMoney = acMoney;
        }

        public Double getIcMoney() {
            return icMoney;
        }

        public void setIcMoney(Double icMoney) {
            this.icMoney = icMoney;
        }

        public Double getAiMoney() {
            return aiMoney;
        }

        public void setAiMoney(Double aiMoney) {
            this.aiMoney = aiMoney;
        }

        public Double getOeMoney() {
            return oeMoney;
        }

        public void setOeMoney(Double oeMoney) {
            this.oeMoney = oeMoney;
        }

        public Double getMlSmoney() {
            return mlSmoney;
        }

        public void setMlSmoney(Double mlSmoney) {
            this.mlSmoney = mlSmoney;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UnpaidMoneyEntry {
        private String performDate;
        private String inOut;
        private String invoiceNumber;
        private Double unpaidMoney;

        public String getPerformDate() {
            return performDate;
        }

        public void setPerformDate(String performDate) {
            this.performDate = performDate;
        }

        public String getInOut() {
            return inOut;
        }

        public void setInOut(String inOut) {
            this.inOut = inOut;
        }

        public String getInvoiceNumber() {
            return invoiceNumber;
        }

        public void setInvoiceNumber(String invoiceNumber) {
            this.invoiceNumber = invoiceNumber;
        }

        public Double getUnpaidMoney() {
            return unpaidMoney;
        }

        public void setUnpaidMoney(Double unpaidMoney) {
            this.unpaidMoney = unpaidMoney;
        }
    }
}
