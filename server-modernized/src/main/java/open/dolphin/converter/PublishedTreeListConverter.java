package open.dolphin.converter;

import java.util.ArrayList;
import java.util.List;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.PublishedTreeList;
import open.dolphin.infomodel.PublishedTreeModel;

/**
 *
 * @author kazushi Minagawa.
 */
public class PublishedTreeListConverter implements IInfoModelConverter {
    
    private PublishedTreeList model;
    
    public List<PublishedTreeModelConverter> getList() {
        
        List<PublishedTreeModel> list = model.getList();
        if (list==null || list.isEmpty()) {
            return null;
        }
        
        List<PublishedTreeModelConverter> ret = new ArrayList<PublishedTreeModelConverter>();
        for (PublishedTreeModel m : list) {
            PublishedTreeModelConverter con = new PublishedTreeModelConverter();
            con.setModel(m);
            ret.add(con);
        }
        
        return ret;
    }
    
    @Override
    public void setModel(IInfoModel model) {
        PublishedTreeList source = (PublishedTreeList) model;
        PublishedTreeList copy = new PublishedTreeList();
        copy.setList(source.getList() == null ? null : new ArrayList<>(source.getList()));
        this.model = copy;
    }
}
