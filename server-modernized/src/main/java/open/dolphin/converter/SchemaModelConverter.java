package open.dolphin.converter;

import java.util.Date;
import java.util.Arrays;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.infomodel.UserModel;

/**
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
public final class SchemaModelConverter implements IInfoModelConverter {

    private SchemaModel model;

    public SchemaModelConverter() {
    }

    //----------------------------------------------------

    public long getId() {
        return model.getId();
    }

    public Date getConfirmed() {
        return model.getConfirmed();
    }

    public Date getStarted() {
        return model.getStarted();
    }

    public Date getEnded() {
        return model.getEnded();
    }

    public Date getRecorded() {
        return model.getRecorded();
    }

    public long getLinkId() {
        return model.getLinkId();
    }

    public String getLinkRelation() {
        return model.getLinkRelation();
    }

    public String getStatus() {
        return model.getStatus();
    }

//    public UserModel getUserModel() {
//        return model.getUserModel();
//    }
//
//    public KarteBean getKarteBean() {
//        return model.getKarteBean();
//    }
    public UserModelConverter getUserModel() {
        if (model.getUserModel()!=null) {
            UserModelConverter con = new UserModelConverter();
            con.setModel(model.getUserModel());
            return con;
        }
        return null;
    }

    public KarteBeanConverter getKarteBean() {
        if (model.getKarteBean()!=null) {
            KarteBeanConverter con = new KarteBeanConverter();
            con.setModel(model.getKarteBean());
            return con;
        }
        return null;
    }

    //-----------------------------------------------------------

    public ExtRefModelConverter getExtRefModel() {
        if (model.getExtRefModel()!=null) {
            ExtRefModelConverter con = new ExtRefModelConverter();
            con.setModel(model.getExtRefModel());
            return con;
        }
        return null;
    }

    public String getUri() {
        return model.getUri();
    }

    public String getDigest() {
        return model.getDigest();
    }

    public byte[] getImageBytes() {
        byte[] imageBytes = model.getImageBytes();
        return imageBytes == null ? null : Arrays.copyOf(imageBytes, imageBytes.length);
    }

    @Override
    public void setModel(IInfoModel m) {
        this.model = ModelCopySupport.copy((SchemaModel) m, SchemaModel::new);
        model.setKarteBean(toKarteReference(model.getKarteBean()));
        model.setUserModel(toUserReference(model.getUserModel()));
    }

    private KarteBean toKarteReference(KarteBean source) {
        if (source == null) {
            return null;
        }
        KarteBean reference = new KarteBean();
        reference.setId(source.getId());
        return reference;
    }

    private UserModel toUserReference(UserModel source) {
        if (source == null) {
            return null;
        }
        UserModel reference = new UserModel();
        reference.setId(source.getId());
        return reference;
    }
}
