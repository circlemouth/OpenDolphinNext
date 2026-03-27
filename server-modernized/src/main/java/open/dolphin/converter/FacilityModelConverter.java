package open.dolphin.converter;

import java.util.Date;
import open.dolphin.infomodel.FacilityModel;
import open.dolphin.infomodel.IInfoModel;

/**
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
public final class FacilityModelConverter implements IInfoModelConverter {

    private FacilityModel model;

    public FacilityModelConverter() {
    }

    public long getId() {
        return model.getId();
    }

    public String getFacilityId() {
        return model.getFacilityId();
    }

    public String getFacilityName() {
        return model.getFacilityName();
    }

    public String getZipCode() {
        return model.getZipCode();
    }

    public String getAddress() {
        return model.getAddress();
    }

    public String getTelephone() {
        return model.getTelephone();
    }

    public String getFacsimile() {
        return model.getFacsimile();
    }

    public String getUrl() {
        return model.getUrl();
    }

    public Date getRegisteredDate() {
        return model.getRegisteredDate();
    }

    public String getMemberType() {
        return model.getMemberType();
    }

    public String getS3URL() {
        return model.getS3URL();
    }

    public String getS3AccessKey() {
        return model.getS3AccessKey();
    }

    public String getS3SecretKey() {
        return model.getS3SecretKey();
    }
    
//    public String getInsuraceFacilityId() {
//        return model.getInsuraceFacilityId();
//    }
//
//    public String getJmariCode() {
//        return model.getJmariCode();
//    }


    @Override
    public void setModel(IInfoModel model) {
        FacilityModel source = (FacilityModel) model;
        FacilityModel copy = new FacilityModel();
        copy.setId(source.getId());
        copy.setFacilityId(source.getFacilityId());
        copy.setFacilityName(source.getFacilityName());
        copy.setZipCode(source.getZipCode());
        copy.setAddress(source.getAddress());
        copy.setTelephone(source.getTelephone());
        copy.setFacsimile(source.getFacsimile());
        copy.setUrl(source.getUrl());
        copy.setRegisteredDate(source.getRegisteredDate() == null ? null : new Date(source.getRegisteredDate().getTime()));
        copy.setMemberType(source.getMemberType());
        copy.setS3URL(source.getS3URL());
        copy.setS3AccessKey(source.getS3AccessKey());
        copy.setS3SecretKey(source.getS3SecretKey());
        this.model = copy;
    }
}
