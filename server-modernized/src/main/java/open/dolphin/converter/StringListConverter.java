package open.dolphin.converter;

import java.util.ArrayList;
import java.util.List;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.StringList;

/**
 *
 * @author kazushi
 */
public class StringListConverter implements IInfoModelConverter {
    
    private StringList model;

    public List<String> getList() {
        List<String> list = model.getList();
        return list == null ? null : new ArrayList<>(list);
    }
    
    @Override
    public void setModel(IInfoModel model) {
        this.model = ModelCopySupport.copy((StringList) model, StringList::new);
    }
}
