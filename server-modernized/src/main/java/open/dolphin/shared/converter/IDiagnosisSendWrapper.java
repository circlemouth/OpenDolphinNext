package open.dolphin.shared.converter;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import open.dolphin.infomodel.DiagnosisSendWrapper;
import open.dolphin.infomodel.InfoModel;
import open.dolphin.infomodel.RegisteredDiagnosisModel;

public class IDiagnosisSendWrapper<T extends IRegisteredDiagnosis> extends InfoModel implements Serializable {

    private String confirmDate;

    private String title;

    private String purpose;

    private String groupId;

    private String patientId;

    private String patientName;

    private String patientGender;

    private String facilityName;

    private String jamariCode;

    private String department;

    private String departmentDesc;

    private String creatorName;

    private String creatorId;

    private String creatorLicense;

    private List<T> addedDiagnosis;

    private List<T> updatedDiagnosis;

    public String getConfirmDate() {
        return confirmDate;
    }

    public void setConfirmDate(String confirmdate) {
        this.confirmDate = confirmdate;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpse) {
        this.purpose = purpse;
    }

    public String getGroupId() {
        return groupId;
    }

    public void setGroupId(String groupId) {
        this.groupId = groupId;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getPatientName() {
        return patientName;
    }

    public void setPatientName(String patientName) {
        this.patientName = patientName;
    }

    public String getPatientGender() {
        return patientGender;
    }

    public void setPatientGender(String patientGender) {
        this.patientGender = patientGender;
    }

    public String getFacilityName() {
        return facilityName;
    }

    public void setFacilityName(String facilityName) {
        this.facilityName = facilityName;
    }

    public String getJamariCode() {
        return jamariCode;
    }

    public void setJamariCode(String jamariCode) {
        this.jamariCode = jamariCode;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getDepartmentDesc() {
        return departmentDesc;
    }

    public void setDepartmentDesc(String departmentDesc) {
        this.departmentDesc = departmentDesc;
    }

    public String getCreatorName() {
        return creatorName;
    }

    public void setCreatorName(String creatorName) {
        this.creatorName = creatorName;
    }

    public String getCreatorId() {
        return creatorId;
    }

    public void setCreatorId(String creatorId) {
        this.creatorId = creatorId;
    }

    public String getCreatorLicense() {
        return creatorLicense;
    }

    public void setCreatorLicense(String creatorLicense) {
        this.creatorLicense = creatorLicense;
    }

    public List<T> getAddedDiagnosis() {
        return addedDiagnosis == null ? null : new ArrayList<>(addedDiagnosis);
    }

    public void setAddedDiagnosis(List<T> addedDiagnosis) {
        this.addedDiagnosis = addedDiagnosis == null ? null : new ArrayList<>(addedDiagnosis);
    }

    public List<T> getUpdatedDiagnosis() {
        return updatedDiagnosis == null ? null : new ArrayList<>(updatedDiagnosis);
    }

    public void setUpdatedDiagnosis(List<T> updatedDiagnosis) {
        this.updatedDiagnosis = updatedDiagnosis == null ? null : new ArrayList<>(updatedDiagnosis);
    }

    public DiagnosisSendWrapper toModel() {
        DiagnosisSendWrapper ret = new DiagnosisSendWrapper();

        ret.setConfirmDate(this.getConfirmDate());
        ret.setTitle(this.getTitle());
        ret.setPurpose(this.getPurpose());
        ret.setGroupId(this.getGroupId());
        ret.setPatientId(this.getPatientId());
        ret.setPatientName(this.getPatientName());
        ret.setPatientGender(this.getPatientGender());
        ret.setFacilityName(this.getFacilityName());
        ret.setJamariCode(this.getJamariCode());
        ret.setDepartment(this.getDepartment());
        ret.setDepartmentDesc(this.getDepartmentDesc());
        ret.setCreatorName(this.getCreatorName());
        ret.setCreatorId(this.getCreatorId());
        ret.setCreatorLicense(this.getCreatorLicense());

        if (addedDiagnosis != null && addedDiagnosis.size() > 0) {
            List<RegisteredDiagnosisModel> list = new ArrayList();
            for (T rd : addedDiagnosis) {
                list.add(rd.toModel());
            }
            ret.setAddedDiagnosis(list);
        }

        if (updatedDiagnosis != null && updatedDiagnosis.size() > 0) {
            List<RegisteredDiagnosisModel> list = new ArrayList();
            for (T rd : updatedDiagnosis) {
                list.add(rd.toModel());
            }
            ret.setUpdatedDiagnosis(list);
        }

        return ret;
    }
}
