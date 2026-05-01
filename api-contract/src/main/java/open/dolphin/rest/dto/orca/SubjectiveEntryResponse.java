package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Response payload for POST /api/local/charts/subjectives.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SubjectiveEntryResponse extends OrcaApiResponse {

    private String recordedAt;
    private String messageDetail;
    private String reasonCode;
    private Entry entry;

    public String getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(String recordedAt) {
        this.recordedAt = recordedAt;
    }

    public String getMessageDetail() {
        return messageDetail;
    }

    public void setMessageDetail(String messageDetail) {
        this.messageDetail = messageDetail;
    }

    public String getReasonCode() {
        return reasonCode;
    }

    public void setReasonCode(String reasonCode) {
        this.reasonCode = reasonCode;
    }

    public Entry getEntry() {
        return entry;
    }

    public void setEntry(Entry entry) {
        this.entry = entry;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Entry {
        private Long documentId;
        private String patientId;
        private String performDate;
        private String soapCategory;
        private String displaySection;
        private String body;
        private String recordedAt;
        private String authorUserId;
        private String authorName;

        public Long getDocumentId() {
            return documentId;
        }

        public void setDocumentId(Long documentId) {
            this.documentId = documentId;
        }

        public String getPatientId() {
            return patientId;
        }

        public void setPatientId(String patientId) {
            this.patientId = patientId;
        }

        public String getPerformDate() {
            return performDate;
        }

        public void setPerformDate(String performDate) {
            this.performDate = performDate;
        }

        public String getSoapCategory() {
            return soapCategory;
        }

        public void setSoapCategory(String soapCategory) {
            this.soapCategory = soapCategory;
        }

        public String getDisplaySection() {
            return displaySection;
        }

        public void setDisplaySection(String displaySection) {
            this.displaySection = displaySection;
        }

        public String getBody() {
            return body;
        }

        public void setBody(String body) {
            this.body = body;
        }

        public String getRecordedAt() {
            return recordedAt;
        }

        public void setRecordedAt(String recordedAt) {
            this.recordedAt = recordedAt;
        }

        public String getAuthorUserId() {
            return authorUserId;
        }

        public void setAuthorUserId(String authorUserId) {
            this.authorUserId = authorUserId;
        }

        public String getAuthorName() {
            return authorName;
        }

        public void setAuthorName(String authorName) {
            this.authorName = authorName;
        }
    }
}
