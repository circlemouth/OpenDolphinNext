package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class PrescriptionDrug {

    private String code;
    private String name;
    private String quantity;
    private String unit;
    private String memo;
    private String validFrom;
    private String validTo;
    private Boolean patientRequested;
    private Boolean genericChangeAllowed;
    private Boolean generalNamePrescription;
    private String drugComment;
    private List<PrescriptionClaimComment> claimComments;
    private PrescriptionDoInputMeta doInputMeta;

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getQuantity() {
        return quantity;
    }

    public void setQuantity(String quantity) {
        this.quantity = quantity;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public String getMemo() {
        return memo;
    }

    public void setMemo(String memo) {
        this.memo = memo;
    }

    public String getValidFrom() {
        return validFrom;
    }

    public void setValidFrom(String validFrom) {
        this.validFrom = validFrom;
    }

    public String getValidTo() {
        return validTo;
    }

    public void setValidTo(String validTo) {
        this.validTo = validTo;
    }

    public Boolean getPatientRequested() {
        return patientRequested;
    }

    public void setPatientRequested(Boolean patientRequested) {
        this.patientRequested = patientRequested;
    }

    public Boolean getGenericChangeAllowed() {
        return genericChangeAllowed;
    }

    public void setGenericChangeAllowed(Boolean genericChangeAllowed) {
        this.genericChangeAllowed = genericChangeAllowed;
    }

    public Boolean getGeneralNamePrescription() {
        return generalNamePrescription;
    }

    public void setGeneralNamePrescription(Boolean generalNamePrescription) {
        this.generalNamePrescription = generalNamePrescription;
    }

    public String getDrugComment() {
        return drugComment;
    }

    public void setDrugComment(String drugComment) {
        this.drugComment = drugComment;
    }

    public List<PrescriptionClaimComment> getClaimComments() {
        return claimComments;
    }

    public void setClaimComments(List<PrescriptionClaimComment> claimComments) {
        this.claimComments = claimComments;
    }

    public PrescriptionDoInputMeta getDoInputMeta() {
        return doInputMeta;
    }

    public void setDoInputMeta(PrescriptionDoInputMeta doInputMeta) {
        this.doInputMeta = doInputMeta;
    }
}
