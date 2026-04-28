package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDate;

/**
 * Server-derived acceptmodv2 operation request.
 *
 * Client-provided ORCA identifiers are intentionally absent; the server re-reads
 * acceptlstv2 and resolves the selected row from a sanitized row hash.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class AcceptanceOperationRequest {

    private String requestNumber;
    private LocalDate acceptanceDate;
    private String classCode;
    private String targetRowHash;
    private String duplicateLiveCheckpoint;

    public String getRequestNumber() {
        return requestNumber;
    }

    public void setRequestNumber(String requestNumber) {
        this.requestNumber = requestNumber;
    }

    public LocalDate getAcceptanceDate() {
        return acceptanceDate;
    }

    public void setAcceptanceDate(LocalDate acceptanceDate) {
        this.acceptanceDate = acceptanceDate;
    }

    public String getClassCode() {
        return classCode;
    }

    public void setClassCode(String classCode) {
        this.classCode = classCode;
    }

    public String getTargetRowHash() {
        return targetRowHash;
    }

    public void setTargetRowHash(String targetRowHash) {
        this.targetRowHash = targetRowHash;
    }

    public String getDuplicateLiveCheckpoint() {
        return duplicateLiveCheckpoint;
    }

    public void setDuplicateLiveCheckpoint(String duplicateLiveCheckpoint) {
        this.duplicateLiveCheckpoint = duplicateLiveCheckpoint;
    }
}
