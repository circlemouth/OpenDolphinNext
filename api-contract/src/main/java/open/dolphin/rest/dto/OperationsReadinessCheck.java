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
    private Boolean connected;
    private Integer facilityCount;
    private String workerStatus;
    private String reasonCode;
    private String lastConnectedAt;
    private String lastEventAt;
    private String lastError;
    private Boolean recoveryEnabled;
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

    public Boolean getConnected() {
        return connected;
    }

    public void setConnected(Boolean connected) {
        this.connected = connected;
    }

    public Integer getFacilityCount() {
        return facilityCount;
    }

    public void setFacilityCount(Integer facilityCount) {
        this.facilityCount = facilityCount;
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

    public String getLastConnectedAt() {
        return lastConnectedAt;
    }

    public void setLastConnectedAt(String lastConnectedAt) {
        this.lastConnectedAt = lastConnectedAt;
    }

    public String getLastEventAt() {
        return lastEventAt;
    }

    public void setLastEventAt(String lastEventAt) {
        this.lastEventAt = lastEventAt;
    }

    public String getLastError() {
        return lastError;
    }

    public void setLastError(String lastError) {
        this.lastError = lastError;
    }

    public Boolean getRecoveryEnabled() {
        return recoveryEnabled;
    }

    public void setRecoveryEnabled(Boolean recoveryEnabled) {
        this.recoveryEnabled = recoveryEnabled;
    }

    public List<String> getReasonCodes() {
        return reasonCodes;
    }

    public void setReasonCodes(List<String> reasonCodes) {
        this.reasonCodes = reasonCodes;
    }
}
