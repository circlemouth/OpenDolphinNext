package open.dolphin.infomodel;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "chart_revision")
@SequenceGenerator(name = "opendolphin_hibernate_seq",
        sequenceName = "opendolphin.hibernate_sequence",
        allocationSize = 1)
public class ChartRevisionModel implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "opendolphin_hibernate_seq")
    private Long id;

    @Column(name = "chart_document_id", nullable = false)
    private Long chartDocumentId;

    @Column(name = "revision_number", nullable = false)
    private Integer revisionNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ChartRevisionStatus status;

    @Column(name = "source_document_id")
    private Long sourceDocumentId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "content_hash", length = 64)
    private String contentHash;

    @Column(name = "encounter_id", length = 128)
    private String encounterId;

    @Column(name = "encounter_date")
    private LocalDate encounterDate;

    @Column(name = "orca_patient_id", length = 64)
    private String orcaPatientId;

    @Column(name = "orca_acceptance_id", length = 128)
    private String orcaAcceptanceId;

    @Column(name = "no_acceptance_reason", length = 255)
    private String noAcceptanceReason;

    @Column(name = "department_code", length = 64)
    private String departmentCode;

    @Column(name = "physician_code", length = 64)
    private String physicianCode;

    @Column(name = "insurance_combination_number", length = 64)
    private String insuranceCombinationNumber;

    @Column(name = "finalize_context_json", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String finalizeContextJson;

    @Column(name = "entered_by_user_id", nullable = false)
    private Long enteredByUserId;

    @Column(name = "finalized_by_user_id")
    private Long finalizedByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "finalized_at")
    private Instant finalizedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (finalizeContextJson == null || finalizeContextJson.isBlank()) {
            finalizeContextJson = "{}";
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
        if (finalizeContextJson == null || finalizeContextJson.isBlank()) {
            finalizeContextJson = "{}";
        }
    }

    public boolean isDirectWriteLocked() {
        return status != null && status != ChartRevisionStatus.DRAFT;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getChartDocumentId() {
        return chartDocumentId;
    }

    public void setChartDocumentId(Long chartDocumentId) {
        this.chartDocumentId = chartDocumentId;
    }

    public Integer getRevisionNumber() {
        return revisionNumber;
    }

    public void setRevisionNumber(Integer revisionNumber) {
        this.revisionNumber = revisionNumber;
    }

    public ChartRevisionStatus getStatus() {
        return status;
    }

    public void setStatus(ChartRevisionStatus status) {
        this.status = status;
    }

    public Long getSourceDocumentId() {
        return sourceDocumentId;
    }

    public void setSourceDocumentId(Long sourceDocumentId) {
        this.sourceDocumentId = sourceDocumentId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContentHash() {
        return contentHash;
    }

    public void setContentHash(String contentHash) {
        this.contentHash = contentHash;
    }

    public String getEncounterId() {
        return encounterId;
    }

    public void setEncounterId(String encounterId) {
        this.encounterId = encounterId;
    }

    public LocalDate getEncounterDate() {
        return encounterDate;
    }

    public void setEncounterDate(LocalDate encounterDate) {
        this.encounterDate = encounterDate;
    }

    public String getOrcaPatientId() {
        return orcaPatientId;
    }

    public void setOrcaPatientId(String orcaPatientId) {
        this.orcaPatientId = orcaPatientId;
    }

    public String getOrcaAcceptanceId() {
        return orcaAcceptanceId;
    }

    public void setOrcaAcceptanceId(String orcaAcceptanceId) {
        this.orcaAcceptanceId = orcaAcceptanceId;
    }

    public String getNoAcceptanceReason() {
        return noAcceptanceReason;
    }

    public void setNoAcceptanceReason(String noAcceptanceReason) {
        this.noAcceptanceReason = noAcceptanceReason;
    }

    public String getDepartmentCode() {
        return departmentCode;
    }

    public void setDepartmentCode(String departmentCode) {
        this.departmentCode = departmentCode;
    }

    public String getPhysicianCode() {
        return physicianCode;
    }

    public void setPhysicianCode(String physicianCode) {
        this.physicianCode = physicianCode;
    }

    public String getInsuranceCombinationNumber() {
        return insuranceCombinationNumber;
    }

    public void setInsuranceCombinationNumber(String insuranceCombinationNumber) {
        this.insuranceCombinationNumber = insuranceCombinationNumber;
    }

    public String getFinalizeContextJson() {
        return finalizeContextJson;
    }

    public void setFinalizeContextJson(String finalizeContextJson) {
        this.finalizeContextJson = finalizeContextJson;
    }

    public Long getEnteredByUserId() {
        return enteredByUserId;
    }

    public void setEnteredByUserId(Long enteredByUserId) {
        this.enteredByUserId = enteredByUserId;
    }

    public Long getFinalizedByUserId() {
        return finalizedByUserId;
    }

    public void setFinalizedByUserId(Long finalizedByUserId) {
        this.finalizedByUserId = finalizedByUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getFinalizedAt() {
        return finalizedAt;
    }

    public void setFinalizedAt(Instant finalizedAt) {
        this.finalizedAt = finalizedAt;
    }
}
