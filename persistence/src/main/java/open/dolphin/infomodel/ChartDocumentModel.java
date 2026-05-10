package open.dolphin.infomodel;

import java.io.Serializable;
import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;

@Entity
@Table(name = "chart_document")
@SequenceGenerator(name = "opendolphin_hibernate_seq",
        sequenceName = "opendolphin.hibernate_sequence",
        allocationSize = 1)
public class ChartDocumentModel implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "opendolphin_hibernate_seq")
    private Long id;

    @Column(name = "document_key", nullable = false, length = 64)
    private String documentKey;

    @Column(name = "facility_id", nullable = false, length = 64)
    private String facilityId;

    @Column(name = "karte_id", nullable = false)
    private Long karteId;

    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    @Column(name = "legacy_document_id")
    private Long legacyDocumentId;

    @Column(name = "current_revision_id")
    private Long currentRevisionId;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDocumentKey() {
        return documentKey;
    }

    public void setDocumentKey(String documentKey) {
        this.documentKey = documentKey;
    }

    public String getFacilityId() {
        return facilityId;
    }

    public void setFacilityId(String facilityId) {
        this.facilityId = facilityId;
    }

    public Long getKarteId() {
        return karteId;
    }

    public void setKarteId(Long karteId) {
        this.karteId = karteId;
    }

    public Long getPatientId() {
        return patientId;
    }

    public void setPatientId(Long patientId) {
        this.patientId = patientId;
    }

    public Long getLegacyDocumentId() {
        return legacyDocumentId;
    }

    public void setLegacyDocumentId(Long legacyDocumentId) {
        this.legacyDocumentId = legacyDocumentId;
    }

    public Long getCurrentRevisionId() {
        return currentRevisionId;
    }

    public void setCurrentRevisionId(Long currentRevisionId) {
        this.currentRevisionId = currentRevisionId;
    }

    public Long getCreatedByUserId() {
        return createdByUserId;
    }

    public void setCreatedByUserId(Long createdByUserId) {
        this.createdByUserId = createdByUserId;
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
}
