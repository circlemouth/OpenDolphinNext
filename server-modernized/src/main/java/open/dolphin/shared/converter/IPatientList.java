package open.dolphin.shared.converter;

import java.util.ArrayList;
import java.util.List;
import open.dolphin.converter.IInfoModelConverter;
import open.dolphin.converter.ModelCopySupport;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.PatientList;
import open.dolphin.infomodel.PatientModel;

public abstract class IPatientList<T> implements IInfoModelConverter {

    private PatientList model;

    protected abstract T createPatientModel(PatientModel model);

    public List<T> getList() {
        List<PatientModel> list = model.getList();
        if (list == null || list.isEmpty()) {
            return null;
        }

        List<T> ret = new ArrayList();
        for (PatientModel m : list) {
            ret.add(createPatientModel(m));
        }

        return ret;
    }

    @Override
    public void setModel(IInfoModel model) {
        this.model = ModelCopySupport.copy((PatientList) model, PatientList::new);
    }
}
