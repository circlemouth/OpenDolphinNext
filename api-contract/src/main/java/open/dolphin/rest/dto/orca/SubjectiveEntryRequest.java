package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Request payload for POST /api/local/charts/subjectives.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class SubjectiveEntryRequest {

    private String patientId;
    private String performDate;
    private String soapCategory;
    private String displaySection;
    private String physicianCode;
    private String body;
    private String entryId;
    private String expectedEntryHash;
    private String baseRevisionId;

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

    public String getPhysicianCode() {
        return physicianCode;
    }

    public void setPhysicianCode(String physicianCode) {
        this.physicianCode = physicianCode;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public String getEntryId() {
        return entryId;
    }

    public void setEntryId(String entryId) {
        this.entryId = entryId;
    }

    public String getExpectedEntryHash() {
        return expectedEntryHash;
    }

    public void setExpectedEntryHash(String expectedEntryHash) {
        this.expectedEntryHash = expectedEntryHash;
    }

    public String getBaseRevisionId() {
        return baseRevisionId;
    }

    public void setBaseRevisionId(String baseRevisionId) {
        this.baseRevisionId = baseRevisionId;
    }
}
