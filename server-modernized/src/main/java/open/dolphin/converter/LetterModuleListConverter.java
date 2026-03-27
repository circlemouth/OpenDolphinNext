package open.dolphin.converter;

import java.util.ArrayList;
import java.util.List;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.LetterModule;
import open.dolphin.infomodel.LetterModuleList;

/**
 *
 * @author kazushi Minagawa.
 */
public class LetterModuleListConverter implements IInfoModelConverter {
    
    private LetterModuleList model;
    
    public List<LetterModuleConverter> getList() {
        
        List<LetterModule> list = model.getList();
        if (list==null || list.isEmpty()) {
            return null;
        }
        
        List<LetterModuleConverter> ret = new ArrayList<LetterModuleConverter>();
        for (LetterModule m : list) {
            LetterModuleConverter con = new LetterModuleConverter();
            con.setModel(m);
            ret.add(con);
        }
        
        return ret;
    }
    
    @Override
    public void setModel(IInfoModel model) {
        LetterModuleList source = (LetterModuleList) model;
        LetterModuleList copy = new LetterModuleList();
        copy.setList(source.getList() == null ? null : new ArrayList<>(source.getList()));
        this.model = copy;
    }
}
