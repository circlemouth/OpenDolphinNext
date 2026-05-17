package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class PrescriptionAuthorityMutationRequest {

    private String patientId;
    private String encounterId;
    private String chartRevisionId;
    private Long expectedRevisionId;
    private String expectedStatus;
    private String expectedContentHash;
    private String clientMutationId;
    private String reasonCode;
    private String reasonText;
    private PrescriptionOrder order;

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getEncounterId() {
        return encounterId;
    }

    public void setEncounterId(String encounterId) {
        this.encounterId = encounterId;
    }

    public String getChartRevisionId() {
        return chartRevisionId;
    }

    public void setChartRevisionId(String chartRevisionId) {
        this.chartRevisionId = chartRevisionId;
    }

    public Long getExpectedRevisionId() {
        return expectedRevisionId;
    }

    public void setExpectedRevisionId(Long expectedRevisionId) {
        this.expectedRevisionId = expectedRevisionId;
    }

    public String getExpectedStatus() {
        return expectedStatus;
    }

    public void setExpectedStatus(String expectedStatus) {
        this.expectedStatus = expectedStatus;
    }

    public String getExpectedContentHash() {
        return expectedContentHash;
    }

    public void setExpectedContentHash(String expectedContentHash) {
        this.expectedContentHash = expectedContentHash;
    }

    public String getClientMutationId() {
        return clientMutationId;
    }

    public void setClientMutationId(String clientMutationId) {
        this.clientMutationId = clientMutationId;
    }

    public String getReasonCode() {
        return reasonCode;
    }

    public void setReasonCode(String reasonCode) {
        this.reasonCode = reasonCode;
    }

    public String getReasonText() {
        return reasonText;
    }

    public void setReasonText(String reasonText) {
        this.reasonText = reasonText;
    }

    public PrescriptionOrder getOrder() {
        return order;
    }

    public void setOrder(PrescriptionOrder order) {
        this.order = order;
    }
}
