package open.dolphin.rest.dto.orca;

public class ChartEditSessionRequest {

    private String patientId;
    private String encounterId;
    private String receptionId;
    private String appointmentId;
    private String ownerTabSessionId;
    private String ownerRunId;
    private String leaseId;
    private Boolean forceTakeover;
    private Integer ttlSeconds;

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

    public String getReceptionId() {
        return receptionId;
    }

    public void setReceptionId(String receptionId) {
        this.receptionId = receptionId;
    }

    public String getAppointmentId() {
        return appointmentId;
    }

    public void setAppointmentId(String appointmentId) {
        this.appointmentId = appointmentId;
    }

    public String getOwnerTabSessionId() {
        return ownerTabSessionId;
    }

    public void setOwnerTabSessionId(String ownerTabSessionId) {
        this.ownerTabSessionId = ownerTabSessionId;
    }

    public String getOwnerRunId() {
        return ownerRunId;
    }

    public void setOwnerRunId(String ownerRunId) {
        this.ownerRunId = ownerRunId;
    }

    public String getLeaseId() {
        return leaseId;
    }

    public void setLeaseId(String leaseId) {
        this.leaseId = leaseId;
    }

    public Boolean getForceTakeover() {
        return forceTakeover;
    }

    public void setForceTakeover(Boolean forceTakeover) {
        this.forceTakeover = forceTakeover;
    }

    public Integer getTtlSeconds() {
        return ttlSeconds;
    }

    public void setTtlSeconds(Integer ttlSeconds) {
        this.ttlSeconds = ttlSeconds;
    }
}
