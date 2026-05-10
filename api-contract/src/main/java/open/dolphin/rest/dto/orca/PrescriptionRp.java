package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class PrescriptionRp {

    private String rpNumber;
    private String bundleName;
    private String medicalClass;
    private String medicalClassNumber;
    private Integer days;
    private String prescriptionLocation;
    private String medicationRoute;
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
    private String lowerDrugCode;
    private String lowerUsageCode;
    private String lowerClaimCode;
    private String lowerRouteCode;
    private String lowerTimingCode;
    private String lowerClassCode;

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

    public Integer getDays() {
        return days;
    }

    public void setDays(Integer days) {
        this.days = days;
    }

    public String getPrescriptionLocation() {
        return prescriptionLocation;
    }

    public void setPrescriptionLocation(String prescriptionLocation) {
        this.prescriptionLocation = prescriptionLocation;
    }

    public String getMedicationRoute() {
        return medicationRoute;
    }

    public void setMedicationRoute(String medicationRoute) {
        this.medicationRoute = medicationRoute;
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
