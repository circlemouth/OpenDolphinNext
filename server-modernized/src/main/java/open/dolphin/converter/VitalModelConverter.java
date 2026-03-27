package open.dolphin.converter;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.RoleModel;
import open.dolphin.infomodel.VitalModel;


/**
 * バイタル対応
 * 
 * @author Life Sciences Computing Corporation.
 */
public final class VitalModelConverter implements IInfoModelConverter {
    
    private VitalModel model;

    public VitalModelConverter(){
    }

    public long getId() {
        return model.getId();
    }

    public String getFacilityPatId() {
        return model.getFacilityPatId();
    }
    
    public String getKarteID() {
        return model.getKarteID();
    }
    
    public String getBodyTemperature() {
        return model.getBodyTemperature();
    }
    
    public String getBloodPressureSystolic() {
        return model.getBloodPressureSystolic();
    }
    
    public String getBloodPressureDiastolic() {
        return model.getBloodPressureDiastolic();
    }
    
    public String getPulseRate() {
        return model.getPulseRate();
    }
    
    public String getSpO2() {
        return model.getSpO2();
    }
    
    public String getRespirationRate() {
        return model.getRespirationRate();
    }
    
    public String getAlgia() {
        return model.getAlgia();
    }
    
    public String getFeel() {
        return model.getFeel();
    }
    
    public String getSleep() {
        return model.getSleep();
    }
    
    public String getMeal() {
        return model.getMeal();
    }
    
    public String getEgestion() {
        return model.getEgestion();
    }
    
    public String getPS() {
        return model.getPS();
    }
    
    public String getDate() {
        return model.getDate();
    }
    
    public String getTime() {
        return model.getTime();
    }
    
    public String getHeight() {
        return model.getHeight();
    }
    
    public String getWeight() {
        return model.getWeight();
    }
    
    public String getSaveDate() {
        return model.getSaveDate();
    }
    
    @Override
    public void setModel(IInfoModel model) {
        VitalModel source = (VitalModel) model;
        VitalModel copy = new VitalModel();
        copy.setId(source.getId());
        copy.setFacilityPatId(source.getFacilityPatId());
        copy.setKarteID(source.getKarteID());
        copy.setBodyTemperature(source.getBodyTemperature());
        copy.setBloodPressureSystolic(source.getBloodPressureSystolic());
        copy.setBloodPressureDiastolic(source.getBloodPressureDiastolic());
        copy.setPulseRate(source.getPulseRate());
        copy.setSpO2(source.getSpO2());
        copy.setRespirationRate(source.getRespirationRate());
        copy.setAlgia(source.getAlgia());
        copy.setFeel(source.getFeel());
        copy.setSleep(source.getSleep());
        copy.setMeal(source.getMeal());
        copy.setEgestion(source.getEgestion());
        copy.setPS(source.getPS());
        copy.setDate(source.getDate());
        copy.setTime(source.getTime());
        copy.setHeight(source.getHeight());
        copy.setWeight(source.getWeight());
        copy.setSaveDate(source.getSaveDate());
        this.model = copy;
    }
}
