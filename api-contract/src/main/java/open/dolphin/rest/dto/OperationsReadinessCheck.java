package open.dolphin.rest.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class OperationsReadinessCheck {

    private String status;
    private String mode;
    private Boolean credentialConfigured;
    private Boolean clientAuthConfigured;
    private Boolean backendReachable;
    private String workerStatus;
    private String reasonCode;
    private List<String> reasonCodes = new ArrayList<>();

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public Boolean getCredentialConfigured() {
        return credentialConfigured;
    }

    public void setCredentialConfigured(Boolean credentialConfigured) {
        this.credentialConfigured = credentialConfigured;
    }

    public Boolean getClientAuthConfigured() {
        return clientAuthConfigured;
    }

    public void setClientAuthConfigured(Boolean clientAuthConfigured) {
        this.clientAuthConfigured = clientAuthConfigured;
    }

    public Boolean getBackendReachable() {
        return backendReachable;
    }

    public void setBackendReachable(Boolean backendReachable) {
        this.backendReachable = backendReachable;
    }

    public String getWorkerStatus() {
        return workerStatus;
    }

    public void setWorkerStatus(String workerStatus) {
        this.workerStatus = workerStatus;
    }

    public String getReasonCode() {
        return reasonCode;
    }

    public void setReasonCode(String reasonCode) {
        this.reasonCode = reasonCode;
    }

    public List<String> getReasonCodes() {
        return reasonCodes;
    }

    public void setReasonCodes(List<String> reasonCodes) {
        this.reasonCodes = reasonCodes;
    }
}
