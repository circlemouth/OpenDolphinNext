package open.dolphin.infomodel;

import java.io.Serializable;
import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "chart_revision_event")
@SequenceGenerator(name = "opendolphin_hibernate_seq",
        sequenceName = "opendolphin.hibernate_sequence",
        allocationSize = 1)
public class ChartRevisionEventModel implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "opendolphin_hibernate_seq")
    private Long id;

    @Column(name = "chart_document_id", nullable = false)
    private Long chartDocumentId;

    @Column(name = "chart_revision_id")
    private Long chartRevisionId;

    @Column(name = "previous_revision_id")
    private Long previousRevisionId;

    @Column(name = "new_revision_id")
    private Long newRevisionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 32)
    private ChartRevisionEventType eventType;

    @Column(name = "actor_user_id", nullable = false)
    private Long actorUserId;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "reason_code", length = 64)
    private String reasonCode;

    @Column(name = "reason_text", length = 1000)
    private String reasonText;

    @Column(name = "before_summary_json", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String beforeSummaryJson;

    @Column(name = "after_summary_json", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String afterSummaryJson;

    @Column(name = "event_hash", length = 64)
    private String eventHash;

    @PrePersist
    void prePersist() {
        if (occurredAt == null) {
            occurredAt = Instant.now();
        }
        if (beforeSummaryJson == null || beforeSummaryJson.isBlank()) {
            beforeSummaryJson = "{}";
        }
        if (afterSummaryJson == null || afterSummaryJson.isBlank()) {
            afterSummaryJson = "{}";
        }
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

    public Long getChartRevisionId() {
        return chartRevisionId;
    }

    public void setChartRevisionId(Long chartRevisionId) {
        this.chartRevisionId = chartRevisionId;
    }

    public Long getPreviousRevisionId() {
        return previousRevisionId;
    }

    public void setPreviousRevisionId(Long previousRevisionId) {
        this.previousRevisionId = previousRevisionId;
    }

    public Long getNewRevisionId() {
        return newRevisionId;
    }

    public void setNewRevisionId(Long newRevisionId) {
        this.newRevisionId = newRevisionId;
    }

    public ChartRevisionEventType getEventType() {
        return eventType;
    }

    public void setEventType(ChartRevisionEventType eventType) {
        this.eventType = eventType;
    }

    public Long getActorUserId() {
        return actorUserId;
    }

    public void setActorUserId(Long actorUserId) {
        this.actorUserId = actorUserId;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(Instant occurredAt) {
        this.occurredAt = occurredAt;
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

    public String getBeforeSummaryJson() {
        return beforeSummaryJson;
    }

    public void setBeforeSummaryJson(String beforeSummaryJson) {
        this.beforeSummaryJson = beforeSummaryJson;
    }

    public String getAfterSummaryJson() {
        return afterSummaryJson;
    }

    public void setAfterSummaryJson(String afterSummaryJson) {
        this.afterSummaryJson = afterSummaryJson;
    }

    public String getEventHash() {
        return eventHash;
    }

    public void setEventHash(String eventHash) {
        this.eventHash = eventHash;
    }
}
