package open.dolphin.rest.dto.chart;

import java.util.LinkedHashMap;
import java.util.Map;

public class ChartRevisionExportRevision {

    private Long revisionId;
    private Integer revisionNumber;
    private String status;
    private Long sourceDocumentId;
    private String title;
    private String contentHash;
    private String encounterId;
    private String encounterDate;
    private String departmentCode;
    private String physicianCode;
    private String insuranceCombinationNumber;
    private Map<String, Object> snapshotManifest = new LinkedHashMap<>();
    private Long enteredByUserId;
    private String entryMode;
    private Long delegatedByUserId;
    private Long finalizedByUserId;
    private String finalizedAt;

    public Long getRevisionId() {
        return revisionId;
    }

    public void setRevisionId(Long revisionId) {
        this.revisionId = revisionId;
    }

    public Integer getRevisionNumber() {
        return revisionNumber;
    }

    public void setRevisionNumber(Integer revisionNumber) {
        this.revisionNumber = revisionNumber;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
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

    public String getEncounterDate() {
        return encounterDate;
    }

    public void setEncounterDate(String encounterDate) {
        this.encounterDate = encounterDate;
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

    public Map<String, Object> getSnapshotManifest() {
        return snapshotManifest;
    }

    public void setSnapshotManifest(Map<String, Object> snapshotManifest) {
        this.snapshotManifest = snapshotManifest == null ? new LinkedHashMap<>() : new LinkedHashMap<>(snapshotManifest);
    }

    public Long getEnteredByUserId() {
        return enteredByUserId;
    }

    public void setEnteredByUserId(Long enteredByUserId) {
        this.enteredByUserId = enteredByUserId;
    }

    public String getEntryMode() {
        return entryMode;
    }

    public void setEntryMode(String entryMode) {
        this.entryMode = entryMode;
    }

    public Long getDelegatedByUserId() {
        return delegatedByUserId;
    }

    public void setDelegatedByUserId(Long delegatedByUserId) {
        this.delegatedByUserId = delegatedByUserId;
    }

    public Long getFinalizedByUserId() {
        return finalizedByUserId;
    }

    public void setFinalizedByUserId(Long finalizedByUserId) {
        this.finalizedByUserId = finalizedByUserId;
    }

    public String getFinalizedAt() {
        return finalizedAt;
    }

    public void setFinalizedAt(String finalizedAt) {
        this.finalizedAt = finalizedAt;
    }
}
