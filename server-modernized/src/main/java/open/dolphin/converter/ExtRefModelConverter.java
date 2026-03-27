package open.dolphin.converter;

import open.dolphin.infomodel.ExtRefModel;
import open.dolphin.infomodel.IInfoModel;

/**
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
public final class ExtRefModelConverter implements IInfoModelConverter {

    private ExtRefModel model;

    public ExtRefModelConverter() {
    }

    public String getContentType() {
        return model.getContentType();
    }

    public String getTitle() {
        return model.getTitle();
    }

    public String getHref() {
        return model.getHref();
    }

    public String getMedicalRole() {
        return model.getMedicalRole();
    }

    public String getSop() {
        return model.getSop();
    }

    public String getUrl() {
        return model.getUrl();
    }

    public String getBucket() {
        return model.getBucket();
    }
    
    public String getImageTime() {
        return model.getImageTime();
    }

    public String getBodyPart() {
        return model.getBodyPart();
    }

    public String getShutterNum() {
        return model.getShutterNum();
    }

    public String getSeqNum() {
        return model.getSeqNum();
    }

    public String getExtension() {
        return model.getExtension();
    }

    @Override
    public void setModel(IInfoModel model) {
        ExtRefModel source = (ExtRefModel) model;
        ExtRefModel copy = new ExtRefModel();
        copy.setContentType(source.getContentType());
        copy.setTitle(source.getTitle());
        copy.setHref(source.getHref());
        copy.setMedicalRole(source.getMedicalRole());
        copy.setSop(source.getSop());
        copy.setUrl(source.getUrl());
        copy.setBucket(source.getBucket());
        copy.setImageTime(source.getImageTime());
        copy.setBodyPart(source.getBodyPart());
        copy.setShutterNum(source.getShutterNum());
        copy.setSeqNum(source.getSeqNum());
        copy.setExtension(source.getExtension());
        this.model = copy;
    }
}
