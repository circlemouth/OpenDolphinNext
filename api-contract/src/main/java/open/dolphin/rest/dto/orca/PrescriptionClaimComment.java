package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class PrescriptionClaimComment {

    private String code;
    private String text;
    private String category;
    private String note;
    private String lowerDrugCode;
    private String lowerUsageCode;
    private String lowerClaimCode;
    private String lowerRouteCode;
    private String lowerTimingCode;
    private String lowerClassCode;

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public String getLowerDrugCode() {
        return lowerDrugCode;
    }

    public void setLowerDrugCode(String lowerDrugCode) {
        this.lowerDrugCode = lowerDrugCode;
    }

    public String getLowerUsageCode() {
        return lowerUsageCode;
    }

    public void setLowerUsageCode(String lowerUsageCode) {
        this.lowerUsageCode = lowerUsageCode;
    }

    public String getLowerClaimCode() {
        return lowerClaimCode;
    }

    public void setLowerClaimCode(String lowerClaimCode) {
        this.lowerClaimCode = lowerClaimCode;
    }

    public String getLowerRouteCode() {
        return lowerRouteCode;
    }

    public void setLowerRouteCode(String lowerRouteCode) {
        this.lowerRouteCode = lowerRouteCode;
    }

    public String getLowerTimingCode() {
        return lowerTimingCode;
    }

    public void setLowerTimingCode(String lowerTimingCode) {
        this.lowerTimingCode = lowerTimingCode;
    }

    public String getLowerClassCode() {
        return lowerClassCode;
    }

    public void setLowerClassCode(String lowerClassCode) {
        this.lowerClassCode = lowerClassCode;
    }
}
