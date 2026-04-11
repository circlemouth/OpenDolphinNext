package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Response payload for POST /api/local/charts/subjectives.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SubjectiveEntryResponse extends OrcaApiResponse {

    private String recordedAt;
    private String messageDetail;

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
}
