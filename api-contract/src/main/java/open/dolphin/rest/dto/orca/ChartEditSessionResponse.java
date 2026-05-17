package open.dolphin.rest.dto.orca;

public class ChartEditSessionResponse {

    private boolean ok;
    private String apiResult;
    private String apiResultMessage;
    private String runId;
    private String lockStatus;
    private String patientId;
    private String encounterScope;
    private String leaseId;
    private String ownerRunId;
    private String ownerTabSessionId;
    private String expiresAt;
    private String acquiredAt;
    private String heartbeatAt;
    private Boolean staleTakeover;

    public boolean isOk() {
        return ok;
    }

    public void setOk(boolean ok) {
        this.ok = ok;
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

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public String getLockStatus() {
        return lockStatus;
    }

    public void setLockStatus(String lockStatus) {
        this.lockStatus = lockStatus;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getEncounterScope() {
        return encounterScope;
    }

    public void setEncounterScope(String encounterScope) {
        this.encounterScope = encounterScope;
    }

    public String getLeaseId() {
        return leaseId;
    }

    public void setLeaseId(String leaseId) {
        this.leaseId = leaseId;
    }

    public String getOwnerRunId() {
        return ownerRunId;
    }

    public void setOwnerRunId(String ownerRunId) {
        this.ownerRunId = ownerRunId;
    }

    public String getOwnerTabSessionId() {
        return ownerTabSessionId;
    }

    public void setOwnerTabSessionId(String ownerTabSessionId) {
        this.ownerTabSessionId = ownerTabSessionId;
    }

    public String getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(String expiresAt) {
        this.expiresAt = expiresAt;
    }

    public String getAcquiredAt() {
        return acquiredAt;
    }

    public void setAcquiredAt(String acquiredAt) {
        this.acquiredAt = acquiredAt;
    }

    public String getHeartbeatAt() {
        return heartbeatAt;
    }

    public void setHeartbeatAt(String heartbeatAt) {
        this.heartbeatAt = heartbeatAt;
    }

    public Boolean getStaleTakeover() {
        return staleTakeover;
    }

    public void setStaleTakeover(Boolean staleTakeover) {
        this.staleTakeover = staleTakeover;
    }
}
