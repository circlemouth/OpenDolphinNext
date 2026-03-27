package open.dolphin.converter;

import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.RoleModel;

/**
 * RoleModel
 *
 * @author Minagawa,Kazushi
 */
public final class RoleModelConverter implements IInfoModelConverter {
    
    private RoleModel model;

    public RoleModelConverter() {
    }

    public long getId() {
        return model.getId();
    }

    public String getUserId() {
        return model.getUserId();
    }

    public String getRole() {
        return model.getRole();
    }

    @Override
    public void setModel(IInfoModel model) {
        RoleModel source = (RoleModel) model;
        RoleModel copy = new RoleModel();
        copy.setId(source.getId());
        copy.setUserId(source.getUserId());
        copy.setRole(source.getRole());
        this.model = copy;
    }
}
