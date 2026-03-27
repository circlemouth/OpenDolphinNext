package open.dolphin.converter;

import open.dolphin.infomodel.DepartmentModel;
import open.dolphin.infomodel.IInfoModel;

/**
 * DepartmentModel
 *
 * @author Minagawa,Kazushi
 *
 */
public final class DepartmentModelConverter implements IInfoModelConverter {
   
    private DepartmentModel model;

    public DepartmentModelConverter() {
    }
    
    public String getDepartment() {
        return model.getDepartment();
    }

    public String getDepartmentDesc() {
        return model.getDepartmentDesc();
    }

    public String getDepartmentCodeSys() {
        return model.getDepartmentCodeSys();
    }

    @Override
    public void setModel(IInfoModel model) {
        DepartmentModel source = (DepartmentModel) model;
        DepartmentModel copy = new DepartmentModel();
        copy.setDepartment(source.getDepartment());
        copy.setDepartmentDesc(source.getDepartmentDesc());
        copy.setDepartmentCodeSys(source.getDepartmentCodeSys());
        this.model = copy;
    }
}
