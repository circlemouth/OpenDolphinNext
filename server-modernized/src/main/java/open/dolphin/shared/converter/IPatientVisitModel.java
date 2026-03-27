package open.dolphin.shared.converter;

import open.dolphin.converter.IInfoModelConverter;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;

public abstract class IPatientVisitModel<T> implements IInfoModelConverter {

    private PatientVisitModel model;

    protected abstract T createPatientModel(PatientModel model);

    public IPatientVisitModel() {
    }

    public long getId() {
        return model.getId();
    }

    public T getPatientModel() {
        if (model.getPatientModel() != null) {
            return createPatientModel(model.getPatientModel());
        }
        return null;
    }

    public String getFacilityId() {
        return model.getFacilityId();
    }

    public String getPvtDate() {
        return ModelUtils.formatDateTime(model.getPvtDate());
    }

    public String getAppointment() {
        return model.getAppointment();
    }

    public String getDepartment() {
        return model.getDepartment();
    }

    public int getState() {
        return model.getState();
    }

    public String getInsuranceUid() {
        return model.getInsuranceUid();
    }

    public String getDeptCode() {
        return model.getDeptCode();
    }

    public String getDeptName() {
        return model.getDeptName();
    }

    public String getDoctorId() {
        return model.getDoctorId();
    }

    public String getDoctorName() {
        return model.getDoctorName();
    }

    public String getJmariNumber() {
        return model.getJmariNumber();
    }

    public String getFirstInsurance() {
        return model.getFirstInsurance();
    }

    public String getMemo() {
        return model.getMemo();
    }

    @Override
    public void setModel(IInfoModel model) {
        PatientVisitModel source = (PatientVisitModel) model;
        PatientVisitModel copy = new PatientVisitModel();
        copy.setId(source.getId());
        copy.setPatientModel(source.getPatientModel());
        copy.setFacilityId(source.getFacilityId());
        copy.setNumber(source.getNumber());
        copy.setPvtDate(source.getPvtDate());
        copy.setAppointment(source.getAppointment());
        copy.setDepartment(source.getDepartment());
        copy.setStateBit(PatientVisitModel.BIT_OPEN, source.getStateBit(PatientVisitModel.BIT_OPEN));
        copy.setStateBit(PatientVisitModel.BIT_SAVE_CLAIM, source.getStateBit(PatientVisitModel.BIT_SAVE_CLAIM));
        copy.setStateBit(PatientVisitModel.BIT_MODIFY_CLAIM, source.getStateBit(PatientVisitModel.BIT_MODIFY_CLAIM));
        copy.setStateBit(PatientVisitModel.BIT_TREATMENT, source.getStateBit(PatientVisitModel.BIT_TREATMENT));
        copy.setStateBit(PatientVisitModel.BIT_HURRY, source.getStateBit(PatientVisitModel.BIT_HURRY));
        copy.setStateBit(PatientVisitModel.BIT_GO_OUT, source.getStateBit(PatientVisitModel.BIT_GO_OUT));
        copy.setStateBit(PatientVisitModel.BIT_CANCEL, source.getStateBit(PatientVisitModel.BIT_CANCEL));
        copy.setStateBit(PatientVisitModel.BIT_UNFINISHED, source.getStateBit(PatientVisitModel.BIT_UNFINISHED));
        copy.setStateBit(PatientVisitModel.BIT_NOTUPDATE, source.getStateBit(PatientVisitModel.BIT_NOTUPDATE));
        copy.setInsuranceUid(source.getInsuranceUid());
        copy.setDeptCode(source.getDeptCode());
        copy.setDeptName(source.getDeptName());
        copy.setDoctorId(source.getDoctorId());
        copy.setDoctorName(source.getDoctorName());
        copy.setJmariNumber(source.getJmariNumber());
        copy.setFirstInsurance(source.getFirstInsurance());
        copy.setMemo(source.getMemo());
        this.model = copy;
    }
}
