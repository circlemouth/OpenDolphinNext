package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;
import open.dolphin.rest.dto.outpatient.OutpatientFlagResponse;
import open.dolphin.rest.dto.outpatient.PatientOutpatientResponse;

/**
 * Response payload for official ORCA patient create/update.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OfficialPatientMutationResponse extends OrcaApiResponse {

    private Long patientDbId;
    private String patientId;
    private PatientOutpatientResponse.PatientRecord patient;
    private Boolean idempotent;
    private String idempotentReason;
    private Boolean orcaMutationPrepared;
    private Boolean orcaMutationSent;
    private Boolean canonicalRefetched;
    private Boolean localSynced;
    private String canonicalSourceApi;
    private String canonicalCacheStatus;
    private String canonicalBusinessStatus;
    private OutpatientFlagResponse.AuditEvent auditEvent;

    public Long getPatientDbId() {
        return patientDbId;
    }

    public void setPatientDbId(Long patientDbId) {
        this.patientDbId = patientDbId;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public PatientOutpatientResponse.PatientRecord getPatient() {
        return patient;
    }

    public void setPatient(PatientOutpatientResponse.PatientRecord patient) {
        this.patient = patient;
    }

    public Boolean getIdempotent() {
        return idempotent;
    }

    public void setIdempotent(Boolean idempotent) {
        this.idempotent = idempotent;
    }

    public String getIdempotentReason() {
        return idempotentReason;
    }

    public void setIdempotentReason(String idempotentReason) {
        this.idempotentReason = idempotentReason;
    }

    public Boolean getOrcaMutationPrepared() {
        return orcaMutationPrepared;
    }

    public void setOrcaMutationPrepared(Boolean orcaMutationPrepared) {
        this.orcaMutationPrepared = orcaMutationPrepared;
    }

    public Boolean getOrcaMutationSent() {
        return orcaMutationSent;
    }

    public void setOrcaMutationSent(Boolean orcaMutationSent) {
        this.orcaMutationSent = orcaMutationSent;
    }

    public Boolean getCanonicalRefetched() {
        return canonicalRefetched;
    }

    public void setCanonicalRefetched(Boolean canonicalRefetched) {
        this.canonicalRefetched = canonicalRefetched;
    }

    public Boolean getLocalSynced() {
        return localSynced;
    }

    public void setLocalSynced(Boolean localSynced) {
        this.localSynced = localSynced;
    }

    public String getCanonicalSourceApi() {
        return canonicalSourceApi;
    }

    public void setCanonicalSourceApi(String canonicalSourceApi) {
        this.canonicalSourceApi = canonicalSourceApi;
    }

    public String getCanonicalCacheStatus() {
        return canonicalCacheStatus;
    }

    public void setCanonicalCacheStatus(String canonicalCacheStatus) {
        this.canonicalCacheStatus = canonicalCacheStatus;
    }

    public String getCanonicalBusinessStatus() {
        return canonicalBusinessStatus;
    }

    public void setCanonicalBusinessStatus(String canonicalBusinessStatus) {
        this.canonicalBusinessStatus = canonicalBusinessStatus;
    }

    public OutpatientFlagResponse.AuditEvent getAuditEvent() {
        return auditEvent;
    }

    public void setAuditEvent(OutpatientFlagResponse.AuditEvent auditEvent) {
        this.auditEvent = auditEvent;
    }
}
