package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrcaReportRequest {

    private String patientId;
    private String invoiceNumber;
    private String outsideClass;
    private String orderClass;
    private String departmentCode;
    private String insuranceCombinationNumber;
    private String performMonth;
    private String startDay;
    private String lastPageNumber;
    private String lastRowNumber;

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public void setInvoiceNumber(String invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
    }

    public String getOutsideClass() {
        return outsideClass;
    }

    public void setOutsideClass(String outsideClass) {
        this.outsideClass = outsideClass;
    }

    public String getOrderClass() {
        return orderClass;
    }

    public void setOrderClass(String orderClass) {
        this.orderClass = orderClass;
    }

    public String getDepartmentCode() {
        return departmentCode;
    }

    public void setDepartmentCode(String departmentCode) {
        this.departmentCode = departmentCode;
    }

    public String getInsuranceCombinationNumber() {
        return insuranceCombinationNumber;
    }

    public void setInsuranceCombinationNumber(String insuranceCombinationNumber) {
        this.insuranceCombinationNumber = insuranceCombinationNumber;
    }

    public String getPerformMonth() {
        return performMonth;
    }

    public void setPerformMonth(String performMonth) {
        this.performMonth = performMonth;
    }

    public String getStartDay() {
        return startDay;
    }

    public void setStartDay(String startDay) {
        this.startDay = startDay;
    }

    public String getLastPageNumber() {
        return lastPageNumber;
    }

    public void setLastPageNumber(String lastPageNumber) {
        this.lastPageNumber = lastPageNumber;
    }

    public String getLastRowNumber() {
        return lastRowNumber;
    }

    public void setLastRowNumber(String lastRowNumber) {
        this.lastRowNumber = lastRowNumber;
    }
}
