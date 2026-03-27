package open.dolphin.converter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.PatientModel;

/**
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
public final class PatientModelConverter implements IInfoModelConverter {

    private PatientModel model;

    public PatientModelConverter() {
    }

    public long getId() {
        return model.getId();
    }

    public String getFacilityId() {
        return model.getFacilityId();
    }

    public String getPatientId() {
        return model.getPatientId();
    }

    public String getFullName() {
        return model.getFullName();
    }

    public String getKanaName() {
        return model.getKanaName();
    }

    public String getRomanName() {
        return model.getRomanName();
    }

    public String getGender() {
        return model.getGender();
    }

    public String getGenderDesc() {
        return model.getGenderDesc();
    }

    public LocalDate getBirthday() {
        return model.getBirthday();
    }

    public String getNationality() {
        return model.getNationality();
    }

    public String getNationalityDesc() {
        return model.getNationalityDesc();
    }

    public String getMaritalStatus() {
        return model.getMaritalStatus();
    }

    public byte[] getJpegPhoto() {
        byte[] jpegPhoto = model.getJpegPhoto();
        return jpegPhoto == null ? null : Arrays.copyOf(jpegPhoto, jpegPhoto.length);
    }

    public String getMemo() {
        return model.getMemo();
    }

    public SimpleAddressModelConverter getSimpleAddressModel() {
        if (model.getSimpleAddressModel()!=null) {
            SimpleAddressModelConverter con = new SimpleAddressModelConverter();
            con.setModel(model.getSimpleAddressModel());
            return con;
        }
        return null;
    }

    public String getTelephone() {
        return model.getTelephone();
    }

    public String getMobilePhone() {
        return model.getMobilePhone();
    }

    public String getEmail() {
        return model.getEmail();
    }

    public List<HealthInsuranceModelConverter> getHealthInsurances() {
        List<HealthInsuranceModel> list = model.getHealthInsurances();
        if (list==null || list.isEmpty()) {
            return null;
        }
        List<HealthInsuranceModelConverter> ret = new ArrayList<HealthInsuranceModelConverter>();
        for (HealthInsuranceModel m : list) {
            HealthInsuranceModelConverter con = new HealthInsuranceModelConverter();
            con.setModel(m);
            ret.add(con);
        }
        return ret;
    }
    public LocalDateTime getLastVisitAt() {
        return model.getLastVisitAt();
    }
    
    public String getRelations() {
        return model.getRelations();
    }
//minagawa^    
    public String getOwnerUUID() {
        return model.getOwnerUUID();
    }
//minagawa$    
    
//s.oh^ 2014/08/19 施設患者一括表示機能
    public String getAppMemo() {
        return model.getAppMemo();
    }
//s.oh$
    
    @Override
    public void setModel(IInfoModel model) {
        this.model = ModelCopySupport.copy((PatientModel) model, PatientModel::new);
    }
}
