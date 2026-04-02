package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class PrescriptionRp {

    private String rpNumber;
    private String bundleName;
    private String medicalClass;
    private String medicalClassNumber;
    private String usageCode;
    private String usageName;
    private String memo;
    private String started;
    private String remark;
    private Integer refillCount;
    private String refillPattern;
    private String doctorComment;
    private Boolean patientRequested;
    private List<PrescriptionDrug> drugs;
    private List<PrescriptionClaimComment> claimComments;

    public String getRpNumber() {
        return rpNumber;
    }

    public void setRpNumber(String rpNumber) {
        this.rpNumber = rpNumber;
    }

    public String getBundleName() {
        return bundleName;
    }

    public void setBundleName(String bundleName) {
        this.bundleName = bundleName;
    }

    public String getMedicalClass() {
        return medicalClass;
    }

    public void setMedicalClass(String medicalClass) {
        this.medicalClass = medicalClass;
    }

    public String getMedicalClassNumber() {
        return medicalClassNumber;
    }

    public void setMedicalClassNumber(String medicalClassNumber) {
        this.medicalClassNumber = medicalClassNumber;
    }

    public String getUsageCode() {
        return usageCode;
    }

    public void setUsageCode(String usageCode) {
        this.usageCode = usageCode;
    }

    public String getUsageName() {
        return usageName;
    }

    public void setUsageName(String usageName) {
        this.usageName = usageName;
    }

    public String getMemo() {
        return memo;
    }

    public void setMemo(String memo) {
        this.memo = memo;
    }

    public String getStarted() {
        return started;
    }

    public void setStarted(String started) {
        this.started = started;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public Integer getRefillCount() {
        return refillCount;
    }

    public void setRefillCount(Integer refillCount) {
        this.refillCount = refillCount;
    }

    public String getRefillPattern() {
        return refillPattern;
    }

    public void setRefillPattern(String refillPattern) {
        this.refillPattern = refillPattern;
    }

    public String getDoctorComment() {
        return doctorComment;
    }

    public void setDoctorComment(String doctorComment) {
        this.doctorComment = doctorComment;
    }

    public Boolean getPatientRequested() {
        return patientRequested;
    }

    public void setPatientRequested(Boolean patientRequested) {
        this.patientRequested = patientRequested;
    }

    public List<PrescriptionDrug> getDrugs() {
        return drugs;
    }

    public void setDrugs(List<PrescriptionDrug> drugs) {
        this.drugs = drugs;
    }

    public List<PrescriptionClaimComment> getClaimComments() {
        return claimComments;
    }

    public void setClaimComments(List<PrescriptionClaimComment> claimComments) {
        this.claimComments = claimComments;
    }
}
