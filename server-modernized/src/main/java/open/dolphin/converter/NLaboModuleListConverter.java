package open.dolphin.converter;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.NLaboModule;
import open.dolphin.infomodel.NLaboModuleList;

/**
 *
 * @author kazushi Minagawa.
 */
public class NLaboModuleListConverter implements IInfoModelConverter {
    
    private NLaboModuleList model;
    
    public List<NLaboModuleConverter> getList() {
        
        List<NLaboModule> list = model.getList();
        if (list==null || list.isEmpty()) {
            return Collections.emptyList();
        }
        
        List<NLaboModuleConverter> ret = new ArrayList<NLaboModuleConverter>();
        for (NLaboModule m : list) {
            NLaboModuleConverter con = new NLaboModuleConverter();
            con.setModel(m);
            ret.add(con);
        }
        
        return ret;
    }
    
    @Override
    public void setModel(IInfoModel model) {
        NLaboModuleList source = (NLaboModuleList) model;
        NLaboModuleList copy = new NLaboModuleList();
        copy.setList(source.getList() == null ? null : new ArrayList<>(source.getList()));
        this.model = copy;
    }
}
